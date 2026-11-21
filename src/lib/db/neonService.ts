import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import {
  RoomRecord,
  QuestionRecord,
  PlayerRecord,
  AnswerRecord,
  QuestionInput,
  RoomStatus,
  AcademicLevel,
  PublicQuestionDTO,
  RevealedAnswerDTO,
  LeaderboardEntryDTO,
} from '@/types/quiz';
import { verifyHostSecret } from '@/lib/auth/hostAuth';

/**
 * Neon PostgreSQL Serverless Service (HTTP-based Tagged Template Client)
 * High-performance, pooled HTTP connections optimized for 200+ concurrent students.
 */

function getDbUrl(): string {
  const url =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    '';
  return url.trim();
}

export function isNeonAvailable(): boolean {
  const url = getDbUrl();
  return Boolean(url && url.startsWith('postgres') && !url.includes('placeholder'));
}

let cachedSql: NeonQueryFunction<false, false> | null = null;

function getSql() {
  if (cachedSql) return cachedSql;
  const url = getDbUrl();
  if (!url) {
    throw new Error('DATABASE_URL is not configured for Neon.');
  }
  cachedSql = neon(url);
  return cachedSql;
}

// In-memory cache for ultra-fast session reads (500ms TTL)
const sessionCache = new Map<string, { time: number; data: unknown }>();
const CACHE_TTL_MS = 600;

export function invalidateRoomCache(pin: string) {
  for (const key of sessionCache.keys()) {
    if (key.startsWith(`room:${pin}`)) {
      sessionCache.delete(key);
    }
  }
}

// --- 1. ROOM CREATION ---
export async function createRoomInNeon(params: {
  pin: string;
  title: string;
  hostSecretHash: string;
  hostRecoveryCode: string;
  questions: QuestionInput[];
}): Promise<{ room: RoomRecord; questions: QuestionRecord[] }> {
  const sql = getSql();

  const titleClean = params.title.slice(0, 120);
  const roomRows = await sql`
    INSERT INTO public.rooms (pin, title, host_secret_hash, host_recovery_code, status, current_question_index)
    VALUES (${params.pin}, ${titleClean}, ${params.hostSecretHash}, ${params.hostRecoveryCode}, 'LOBBY', -1)
    RETURNING *
  `;
  const room = roomRows[0] as RoomRecord;

  // All question inserts go to Neon in a single HTTP request instead of one per question.
  const results = params.questions.length
    ? await sql.transaction(
        params.questions.map(
          (q, idx) => sql`
            INSERT INTO public.questions
            (room_id, order_index, prompt, option_a, option_b, option_c, option_d, correct_option_index, scripture_ref, explanation, time_limit_sec)
            VALUES (
              ${room.id}, ${idx}, ${q.prompt},
              ${q.options[0]}, ${q.options[1]}, ${q.options[2]}, ${q.options[3]},
              ${q.correctOptionIndex}, ${q.scriptureRef}, ${q.explanation || null}, ${q.timeLimitSec}
            )
            RETURNING *
          `
        )
      )
    : [];
  const createdQuestions = (results as unknown as QuestionRecord[][]).map((rows) => rows[0]);

  invalidateRoomCache(params.pin);
  return { room, questions: createdQuestions };
}

// --- 2. GET ROOM BY PIN ---
export async function getRoomByPinFromNeon(pin: string): Promise<RoomRecord | null> {
  const sql = getSql();
  const cleanPin = pin.trim();
  const rows = await sql`SELECT * FROM public.rooms WHERE pin = ${cleanPin}::bpchar LIMIT 1`;
  if (rows.length === 0) return null;
  return rows[0] as RoomRecord;
}

// --- 3. GET QUESTIONS FOR ROOM ---
export async function getQuestionsForRoomFromNeon(roomId: string): Promise<QuestionRecord[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM public.questions WHERE room_id = ${roomId} ORDER BY order_index ASC
  `;
  return rows as QuestionRecord[];
}

// --- 4. PLAYER JOIN ---
export async function joinPlayerInNeon(params: {
  pin: string;
  nickname: string;
  academicLevel: AcademicLevel;
  existingToken?: string;
}): Promise<{
  success: boolean;
  player?: PlayerRecord;
  resumed?: boolean;
  error?: string;
  statusCode: number;
  totalPlayers?: number;
}> {
  const sql = getSql();

  // 1. Get room (match trimmed pin)
  const cleanPin = params.pin.trim();
  const roomRows = await sql`
    SELECT id, pin, status, current_question_index FROM public.rooms WHERE pin = ${cleanPin}::bpchar
  `;
  if (roomRows.length === 0) {
    return { success: false, error: 'Room PIN not found.', statusCode: 404 };
  }

  const room = roomRows[0];
  if (room.status === 'GAME_OVER') {
    return { success: false, error: 'This quiz session has already ended.', statusCode: 409 };
  }

  // 2. Resume if existing token
  if (params.existingToken) {
    const existingRows = await sql`
      SELECT * FROM public.players WHERE room_id = ${room.id} AND player_token = ${params.existingToken}::uuid AND is_kicked = false
    `;
    if (existingRows.length > 0) {
      invalidateRoomCache(params.pin);
      return {
        success: true,
        player: existingRows[0] as PlayerRecord,
        resumed: true,
        statusCode: 200,
      };
    }
  }

  // 3. Auto-disambiguate duplicate names so students NEVER get blocked from joining
  let assignedNick = params.nickname.trim();
  const normalized = assignedNick.toLowerCase();
  const dupRows = await sql`
    SELECT id, nickname FROM public.players WHERE room_id = ${room.id} AND LOWER(TRIM(nickname)) = ${normalized}
  `;
  if (dupRows.length > 0) {
    const withLevel = `${assignedNick} (${params.academicLevel})`;
    const checkWithLevel = await sql`
      SELECT id FROM public.players WHERE room_id = ${room.id} AND LOWER(TRIM(nickname)) = ${withLevel.toLowerCase()}
    `;
    if (checkWithLevel.length === 0) {
      assignedNick = withLevel;
    } else {
      assignedNick = `${assignedNick} #${dupRows.length + 1}`;
    }
  }

  // 4. Insert new player
  const insertRows = await sql`
    INSERT INTO public.players (room_id, nickname, academic_level)
    VALUES (${room.id}, ${assignedNick}, ${params.academicLevel})
    RETURNING *
  `;
  const newPlayer = insertRows[0] as PlayerRecord;

  const countRows = await sql`
    SELECT COUNT(*)::INTEGER as count FROM public.players WHERE room_id = ${room.id} AND is_kicked = false
  `;
  const totalPlayers = countRows[0]?.count || 1;

  invalidateRoomCache(params.pin);
  return {
    success: true,
    player: newPlayer,
    resumed: false,
    statusCode: 201,
    totalPlayers,
  };
}

// --- 5. SUBMIT ANSWER ---
export async function submitAnswerInNeon(params: {
  pin: string;
  playerToken: string;
  questionId: string;
  selectedOption: number;
}): Promise<{
  accepted: boolean;
  errorCode?: string;
  lockedOption?: number;
  answeredCount?: number;
}> {
  const sql = getSql();

  const rows = await sql`
    SELECT * FROM public.submit_player_answer(
      ${params.pin.trim()},
      ${params.playerToken}::uuid,
      ${params.questionId}::uuid,
      ${params.selectedOption}::smallint
    )
  `;

  invalidateRoomCache(params.pin);

  if (rows.length > 0) {
    const row = rows[0];
    return {
      accepted: row.accepted,
      errorCode: row.error_code,
      lockedOption: row.locked_option,
      answeredCount: row.answered_count_for_question,
    };
  }

  return { accepted: false, errorCode: 'SUBMISSION_FAILED' };
}


// --- Shared helpers ---------------------------------------------------------

function toLeaderboard(players: PlayerRecord[], limit: number): LeaderboardEntryDTO[] {
  return players.slice(0, limit).map((p, idx) => ({
    rank: idx + 1,
    playerId: p.id,
    nickname: p.nickname,
    academicLevel: p.academic_level,
    totalScore: p.total_score,
    correctCount: p.correct_count,
  }));
}

function buildReveal(
  question: QuestionRecord,
  answers: { selected_option: number; player_id: string }[],
  nicknameById?: Map<string, string>
): RevealedAnswerDTO {
  const optionCounts: [number, number, number, number] = [0, 0, 0, 0];
  const optionPlayerNames: [string[], string[], string[], string[]] = [[], [], [], []];

  for (const a of answers) {
    if (a.selected_option < 0 || a.selected_option > 3) continue;
    optionCounts[a.selected_option]++;
    const name = nicknameById?.get(a.player_id);
    if (name) optionPlayerNames[a.selected_option].push(name);
  }

  return {
    questionId: question.id,
    correctOptionIndex: question.correct_option_index as 0 | 1 | 2 | 3,
    scriptureRef: question.scripture_ref,
    explanation: question.explanation,
    optionCounts,
    ...(nicknameById ? { optionPlayerNames } : {}),
    totalAnswered: optionCounts[0] + optionCounts[1] + optionCounts[2] + optionCounts[3],
  };
}

/**
 * Reads everything the host console needs in ONE HTTP request to Neon
 * (four statements in a single read-only transaction), instead of 4 sequential round trips.
 */
async function readRoomBundle(pin: string, includeKicked: boolean) {
  const sql = getSql();
  const cleanPin = pin.trim();

  const [roomRows, questionRows, playerRows, answerRows] = await sql.transaction(
    [
      sql`SELECT * FROM public.rooms WHERE pin = ${cleanPin}::bpchar`,
      sql`
        SELECT q.* FROM public.questions q
        JOIN public.rooms r ON r.id = q.room_id
        WHERE r.pin = ${cleanPin}::bpchar
        ORDER BY q.order_index ASC
      `,
      sql`
        SELECT p.id, p.nickname, p.academic_level, p.total_score, p.correct_count, p.is_kicked
        FROM public.players p
        JOIN public.rooms r ON r.id = p.room_id
        WHERE r.pin = ${cleanPin}::bpchar AND (${includeKicked} OR p.is_kicked = false)
        ORDER BY p.total_score DESC, p.total_correct_response_ms ASC, p.joined_at ASC
      `,
      sql`
        SELECT a.selected_option, a.player_id
        FROM public.answers a
        JOIN public.rooms r ON r.id = a.room_id
        JOIN public.questions q ON q.id = a.question_id AND q.order_index = r.current_question_index
        WHERE r.pin = ${cleanPin}::bpchar
      `,
    ],
    { readOnly: true }
  );

  if (roomRows.length === 0) return null;

  return {
    room: roomRows[0] as RoomRecord,
    questions: questionRows as QuestionRecord[],
    players: playerRows as PlayerRecord[],
    currentAnswers: answerRows as { selected_option: number; player_id: string }[],
  };
}

// --- 6. TRANSITION ROOM STATE ---
export async function transitionRoomInNeon(params: {
  pin: string;
  targetState: RoomStatus;
  questionIndex?: number;
  hostSecret?: string | null;
  recoveryCode?: string | null;
}): Promise<{
  success: boolean;
  room?: RoomRecord;
  publicQuestion?: PublicQuestionDTO;
  revealedAnswer?: RevealedAnswerDTO;
  top5?: LeaderboardEntryDTO[];
  podium?: LeaderboardEntryDTO[];
  error?: string;
  statusCode: number;
}> {
  const sql = getSql();

  // 1. Room, questions, players and current answers in one round trip
  const bundle = await readRoomBundle(params.pin, false);
  if (!bundle) {
    return { success: false, error: 'Room not found', statusCode: 404 };
  }
  const { room, questions: allQuestions, players: allPlayers, currentAnswers } = bundle;

  // 2. Verify host auth if provided
  if (params.hostSecret || params.recoveryCode) {
    const isSecretValid = params.hostSecret
      ? verifyHostSecret(params.hostSecret, room.host_secret_hash)
      : false;
    const isRecoveryValid = params.recoveryCode
      ? params.recoveryCode.toUpperCase() === room.host_recovery_code.toUpperCase()
      : false;

    if (!isSecretValid && !isRecoveryValid) {
      return { success: false, error: 'Unauthorized host session', statusCode: 401 };
    }
  }

  const totalQuestions = allQuestions.length;
  const now = new Date().toISOString();
  let publicQuestion: PublicQuestionDTO | undefined;
  let revealedAnswer: RevealedAnswerDTO | undefined;
  let top5: LeaderboardEntryDTO[] | undefined;
  let podium: LeaderboardEntryDTO[] | undefined;
  let updateRows: Record<string, any>[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any

  if (params.targetState === 'QUESTION_ACTIVE') {
    const nextQIdx =
      params.questionIndex !== undefined ? params.questionIndex : room.current_question_index + 1;

    if (nextQIdx < 0 || nextQIdx >= totalQuestions) {
      return { success: false, error: 'Question index out of bounds', statusCode: 400 };
    }

    const activeQ = allQuestions[nextQIdx];
    updateRows = await sql`
      UPDATE public.rooms
      SET status = 'QUESTION_ACTIVE',
          current_question_index = ${nextQIdx},
          question_started_at = ${now},
          updated_at = ${now}
      WHERE id = ${room.id}
      RETURNING *
    `;

    publicQuestion = {
      id: activeQ.id,
      orderIndex: nextQIdx,
      totalQuestions,
      prompt: activeQ.prompt,
      options: [activeQ.option_a, activeQ.option_b, activeQ.option_c, activeQ.option_d],
      timeLimitSec: activeQ.time_limit_sec,
    };
  } else if (params.targetState === 'ANSWER_REVEALED') {
    const activeQ = allQuestions[room.current_question_index];
    if (activeQ) {
      const nicknameById = new Map(allPlayers.map((p) => [p.id, p.nickname]));
      revealedAnswer = buildReveal(activeQ, currentAnswers, nicknameById);
    }
    updateRows = await sql`
      UPDATE public.rooms SET status = 'ANSWER_REVEALED', updated_at = ${now} WHERE id = ${room.id} RETURNING *
    `;
  } else if (params.targetState === 'LEADERBOARD') {
    top5 = toLeaderboard(allPlayers, 5);
    updateRows = await sql`
      UPDATE public.rooms SET status = 'LEADERBOARD', updated_at = ${now} WHERE id = ${room.id} RETURNING *
    `;
  } else if (params.targetState === 'GAME_OVER') {
    podium = toLeaderboard(allPlayers, 10);
    updateRows = await sql`
      UPDATE public.rooms SET status = 'GAME_OVER', updated_at = ${now} WHERE id = ${room.id} RETURNING *
    `;
  }

  invalidateRoomCache(params.pin);

  return {
    success: true,
    room: (updateRows[0] as RoomRecord | undefined) ?? room,
    publicQuestion,
    revealedAnswer,
    top5,
    podium,
    statusCode: 200,
  };
}

// --- 7. ROOM SNAPSHOT FOR HOST CONSOLE ---
export async function getHostRoomSnapshotFromNeon(pin: string) {
  const bundle = await readRoomBundle(pin, true);
  if (!bundle) return null;
  const { room, questions, players, currentAnswers } = bundle;

  const activeQ =
    room.current_question_index >= 0 ? questions[room.current_question_index] : undefined;
  const answeredCount = activeQ ? currentAnswers.length : 0;

  let reveal: RevealedAnswerDTO | null = null;
  if (activeQ && room.status === 'ANSWER_REVEALED') {
    reveal = buildReveal(activeQ, currentAnswers, new Map(players.map((p) => [p.id, p.nickname])));
  }

  const activePlayers = players.filter((p) => !p.is_kicked);

  let questionEndsAtMs: number | null = null;
  if (room.status === 'QUESTION_ACTIVE' && room.question_started_at && activeQ) {
    questionEndsAtMs = new Date(room.question_started_at).getTime() + activeQ.time_limit_sec * 1000;
  }

  return {
    room: {
      id: room.id,
      pin: room.pin,
      title: room.title,
      status: room.status,
      currentQuestionIndex: room.current_question_index,
      questionStartedAt: room.question_started_at,
      questionEndsAtMs,
      serverNowMs: Date.now(),
    },
    questions: questions.map((q) => ({
      id: q.id,
      orderIndex: q.order_index,
      prompt: q.prompt,
      options: [q.option_a, q.option_b, q.option_c, q.option_d],
      correctOptionIndex: q.correct_option_index,
      scriptureRef: q.scripture_ref,
      explanation: q.explanation,
      timeLimitSec: q.time_limit_sec,
    })),
    players: players.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      academicLevel: p.academic_level,
      totalScore: p.total_score,
      correctCount: p.correct_count,
      isKicked: p.is_kicked,
    })),
    answeredCount,
    reveal,
    top5: toLeaderboard(activePlayers, 5),
    podium: toLeaderboard(activePlayers, 10),
  };
}

// --- 8. PLAYER SESSION ---
// Polled by every phone in the hall, so it is a single SQL statement: one HTTP round trip.
export async function getPlayerSessionFromNeon(pin: string, playerToken: string) {
  const sql = getSql();
  const cleanPin = pin.trim();

  const rows = await sql`
    SELECT
      r.id AS room_id, r.status AS room_status, r.current_question_index, r.question_started_at,
      p.id AS player_id, p.nickname, p.academic_level, p.total_score, p.correct_count, p.is_kicked,
      (SELECT COUNT(*)::int FROM public.players x WHERE x.room_id = r.id AND x.is_kicked = false) AS total_players,
      (SELECT COUNT(*)::int FROM public.players x
         WHERE x.room_id = r.id AND x.is_kicked = false AND x.total_score > p.total_score) AS higher_count,
      (SELECT COUNT(*)::int FROM public.questions x WHERE x.room_id = r.id) AS total_questions,
      q.id AS q_id, q.prompt, q.option_a, q.option_b, q.option_c, q.option_d, q.time_limit_sec,
      q.correct_option_index, q.scripture_ref, q.explanation,
      a.selected_option AS my_option, a.is_correct AS my_is_correct, a.points_awarded AS my_points,
      CASE WHEN r.status = 'ANSWER_REVEALED' THEN (
        SELECT ARRAY[
          COUNT(*) FILTER (WHERE s.selected_option = 0),
          COUNT(*) FILTER (WHERE s.selected_option = 1),
          COUNT(*) FILTER (WHERE s.selected_option = 2),
          COUNT(*) FILTER (WHERE s.selected_option = 3)
        ]::int[]
        FROM public.answers s WHERE s.question_id = q.id
      ) END AS option_counts
    FROM public.rooms r
    JOIN public.players p ON p.room_id = r.id AND p.player_token = ${playerToken}::uuid
    LEFT JOIN public.questions q ON q.room_id = r.id AND q.order_index = r.current_question_index
    LEFT JOIN public.answers a ON a.question_id = q.id AND a.player_id = p.id
    WHERE r.pin = ${cleanPin}::bpchar
  `;

  if (rows.length === 0) return null;
  const row = rows[0];
  if (row.is_kicked) return { kicked: true as const };

  let publicQuestion: PublicQuestionDTO | null = null;
  let lockedOptionForActiveQuestion: number | null = null;
  let questionEndsAtMs: number | null = null;
  let reveal: RevealedAnswerDTO | null = null;
  let myResult: { isCorrect: boolean; pointsAwarded: number } | null = null;

  if (row.q_id && row.room_status === 'QUESTION_ACTIVE') {
    publicQuestion = {
      id: row.q_id,
      orderIndex: row.current_question_index,
      totalQuestions: row.total_questions || 1,
      prompt: row.prompt,
      options: [row.option_a, row.option_b, row.option_c, row.option_d],
      timeLimitSec: row.time_limit_sec,
    };
    if (row.question_started_at) {
      questionEndsAtMs = new Date(row.question_started_at).getTime() + row.time_limit_sec * 1000;
    }
    lockedOptionForActiveQuestion = row.my_option ?? null;
  } else if (row.q_id && row.room_status === 'ANSWER_REVEALED') {
    const counts = (row.option_counts as number[] | null) ?? [0, 0, 0, 0];
    reveal = {
      questionId: row.q_id,
      correctOptionIndex: row.correct_option_index as 0 | 1 | 2 | 3,
      scriptureRef: row.scripture_ref,
      explanation: row.explanation,
      optionCounts: [counts[0], counts[1], counts[2], counts[3]],
      totalAnswered: counts[0] + counts[1] + counts[2] + counts[3],
    };
    lockedOptionForActiveQuestion = row.my_option ?? null;
    myResult = {
      isCorrect: Boolean(row.my_is_correct),
      pointsAwarded: row.my_points ?? 0,
    };
  }

  return {
    player: {
      id: row.player_id,
      nickname: row.nickname,
      academicLevel: row.academic_level,
      totalScore: row.total_score,
      correctCount: row.correct_count,
      currentRank: (row.higher_count || 0) + 1,
      totalPlayers: row.total_players || 1,
    },
    roomSnapshot: {
      status: row.room_status as RoomStatus,
      currentQuestionIndex: row.current_question_index,
      questionEndsAtMs,
      serverNowMs: Date.now(),
    },
    activeQuestion: publicQuestion,
    lockedOptionForActiveQuestion,
    reveal,
    myResult,
  };
}

// --- 9. PERSONAL RESULT FOR REVEALED QUESTION ---
export async function getPlayerResultFromNeon(
  pin: string,
  playerToken: string,
  questionId?: string | null
) {
  const sql = getSql();

  const rows = await sql`
    SELECT
      p.total_score,
      (SELECT COUNT(*)::int FROM public.players x WHERE x.room_id = r.id AND x.is_kicked = false) AS total_players,
      (SELECT COUNT(*)::int FROM public.players x
         WHERE x.room_id = r.id AND x.is_kicked = false AND x.total_score > p.total_score) AS higher_count,
      a.is_correct, a.points_awarded
    FROM public.rooms r
    JOIN public.players p ON p.room_id = r.id AND p.player_token = ${playerToken}::uuid
    LEFT JOIN public.questions q
      ON q.room_id = r.id
     AND (q.id = ${questionId ?? null}::uuid OR (${questionId ?? null}::uuid IS NULL AND q.order_index = r.current_question_index))
    LEFT JOIN public.answers a ON a.question_id = q.id AND a.player_id = p.id
    WHERE r.pin = ${pin.trim()}::bpchar
  `;

  if (rows.length === 0) return null;
  const row = rows[0];

  return {
    isCorrect: Boolean(row.is_correct),
    pointsAwarded: row.points_awarded ?? 0,
    cumulativeScore: row.total_score,
    currentRank: (row.higher_count || 0) + 1,
    totalPlayers: row.total_players || 1,
    pointsToNextRank: 0,
  };
}
