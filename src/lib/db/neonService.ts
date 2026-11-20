import { neon } from '@neondatabase/serverless';
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

function getSql() {
  const url = getDbUrl();
  if (!url) {
    throw new Error('DATABASE_URL is not configured for Neon.');
  }
  return neon(url);
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

  const createdQuestions: QuestionRecord[] = [];
  for (let idx = 0; idx < params.questions.length; idx++) {
    const q = params.questions[idx];
    const qRows = await sql`
      INSERT INTO public.questions
      (room_id, order_index, prompt, option_a, option_b, option_c, option_d, correct_option_index, scripture_ref, explanation, time_limit_sec)
      VALUES (
        ${room.id},
        ${idx},
        ${q.prompt},
        ${q.options[0]},
        ${q.options[1]},
        ${q.options[2]},
        ${q.options[3]},
        ${q.correctOptionIndex},
        ${q.scriptureRef},
        ${q.explanation || null},
        ${q.timeLimitSec}
      )
      RETURNING *
    `;
    createdQuestions.push(qRows[0] as QuestionRecord);
  }

  invalidateRoomCache(params.pin);
  return { room, questions: createdQuestions };
}

// --- 2. GET ROOM BY PIN ---
export async function getRoomByPinFromNeon(pin: string): Promise<RoomRecord | null> {
  const sql = getSql();
  const cleanPin = pin.trim();
  const rows = await sql`SELECT * FROM public.rooms WHERE TRIM(pin) = ${cleanPin} LIMIT 1`;
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
    SELECT id, pin, status, current_question_index FROM public.rooms WHERE TRIM(pin) = ${cleanPin}
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

  // 1. Fetch room
  const cleanPin = params.pin.trim();
  const roomRows = await sql`SELECT * FROM public.rooms WHERE TRIM(pin) = ${cleanPin}`;
  if (roomRows.length === 0) {
    return { success: false, error: 'Room not found', statusCode: 404 };
  }

  const room = roomRows[0] as RoomRecord;

  // 2. Verify Host auth if provided
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

  // 3. Questions & Players
  const allQuestions = (await sql`
    SELECT * FROM public.questions WHERE room_id = ${room.id} ORDER BY order_index ASC
  `) as QuestionRecord[];
  const totalQuestions = allQuestions.length;

  const allPlayers = (await sql`
    SELECT * FROM public.players WHERE room_id = ${room.id} AND is_kicked = false ORDER BY total_score DESC, total_correct_response_ms ASC, joined_at ASC
  `) as PlayerRecord[];

  const now = new Date();
  let updatedRoom = room;
  let publicQuestion: PublicQuestionDTO | undefined;
  let revealedAnswer: RevealedAnswerDTO | undefined;
  let top5: LeaderboardEntryDTO[] | undefined;
  let podium: LeaderboardEntryDTO[] | undefined;

  if (params.targetState === 'QUESTION_ACTIVE') {
    const nextQIdx =
      params.questionIndex !== undefined ? params.questionIndex : room.current_question_index + 1;

    if (nextQIdx < 0 || nextQIdx >= totalQuestions) {
      return { success: false, error: 'Question index out of bounds', statusCode: 400 };
    }

    const activeQ = allQuestions[nextQIdx];
    const updateRows = await sql`
      UPDATE public.rooms
      SET status = 'QUESTION_ACTIVE',
          current_question_index = ${nextQIdx},
          question_started_at = ${now.toISOString()},
          updated_at = ${now.toISOString()}
      WHERE id = ${room.id}
      RETURNING *
    `;
    updatedRoom = updateRows[0] as RoomRecord;

    publicQuestion = {
      id: activeQ.id,
      orderIndex: nextQIdx,
      totalQuestions,
      prompt: activeQ.prompt,
      options: [activeQ.option_a, activeQ.option_b, activeQ.option_c, activeQ.option_d],
      timeLimitSec: activeQ.time_limit_sec,
    };
  } else if (params.targetState === 'ANSWER_REVEALED') {
    const qIdx = room.current_question_index;
    const activeQ = allQuestions[qIdx];
    if (activeQ) {
      const answers = (await sql`
        SELECT * FROM public.answers WHERE room_id = ${room.id} AND question_id = ${activeQ.id}
      `) as AnswerRecord[];

      const optionCounts: [number, number, number, number] = [0, 0, 0, 0];
      const optionPlayerNames: [string[], string[], string[], string[]] = [[], [], [], []];
      const playerMap = new Map(allPlayers.map((p) => [p.id, p.nickname]));

      answers.forEach((a) => {
        if (a.selected_option >= 0 && a.selected_option <= 3) {
          optionCounts[a.selected_option]++;
          const name = playerMap.get(a.player_id);
          if (name) {
            optionPlayerNames[a.selected_option].push(name);
          }
        }
      });

      const totalAnswered =
        optionCounts[0] + optionCounts[1] + optionCounts[2] + optionCounts[3];

      revealedAnswer = {
        questionId: activeQ.id,
        correctOptionIndex: activeQ.correct_option_index as 0 | 1 | 2 | 3,
        scriptureRef: activeQ.scripture_ref,
        explanation: activeQ.explanation,
        optionCounts,
        optionPlayerNames,
        totalAnswered,
      };
    }

    const updateRows = await sql`
      UPDATE public.rooms SET status = 'ANSWER_REVEALED', updated_at = ${now.toISOString()} WHERE id = ${room.id} RETURNING *
    `;
    updatedRoom = updateRows[0] as RoomRecord;
  } else if (params.targetState === 'LEADERBOARD') {
    top5 = allPlayers.slice(0, 5).map((p, idx) => ({
      rank: idx + 1,
      playerId: p.id,
      nickname: p.nickname,
      academicLevel: p.academic_level,
      totalScore: p.total_score,
      correctCount: p.correct_count,
    }));

    const updateRows = await sql`
      UPDATE public.rooms SET status = 'LEADERBOARD', updated_at = ${now.toISOString()} WHERE id = ${room.id} RETURNING *
    `;
    updatedRoom = updateRows[0] as RoomRecord;
  } else if (params.targetState === 'GAME_OVER') {
    podium = allPlayers.slice(0, 10).map((p, idx) => ({
      rank: idx + 1,
      playerId: p.id,
      nickname: p.nickname,
      academicLevel: p.academic_level,
      totalScore: p.total_score,
      correctCount: p.correct_count,
    }));

    const updateRows = await sql`
      UPDATE public.rooms SET status = 'GAME_OVER', updated_at = ${now.toISOString()} WHERE id = ${room.id} RETURNING *
    `;
    updatedRoom = updateRows[0] as RoomRecord;
  }

  invalidateRoomCache(params.pin);

  return {
    success: true,
    room: updatedRoom,
    publicQuestion,
    revealedAnswer,
    top5,
    podium,
    statusCode: 200,
  };
}

// --- 7. ROOM SNAPSHOT FOR HOST CONSOLE ---
export async function getHostRoomSnapshotFromNeon(pin: string) {
  const sql = getSql();

  const cleanPin = pin.trim();
  const roomRows = await sql`SELECT * FROM public.rooms WHERE TRIM(pin) = ${cleanPin}`;
  if (roomRows.length === 0) return null;
  const room = roomRows[0] as RoomRecord;

  const questions = (await sql`
    SELECT * FROM public.questions WHERE room_id = ${room.id} ORDER BY order_index ASC
  `) as QuestionRecord[];

  const players = (await sql`
    SELECT id, nickname, academic_level, total_score, correct_count, is_kicked FROM public.players WHERE room_id = ${room.id} ORDER BY total_score DESC, total_correct_response_ms ASC, joined_at ASC
  `) as PlayerRecord[];

  let answeredCount = 0;
  let reveal: RevealedAnswerDTO | null = null;

  if (room.current_question_index >= 0 && questions[room.current_question_index]) {
    const activeQ = questions[room.current_question_index];
    const answers = (await sql`
      SELECT * FROM public.answers WHERE room_id = ${room.id} AND question_id = ${activeQ.id}
    `) as AnswerRecord[];
    answeredCount = answers.length;

    if (room.status === 'ANSWER_REVEALED') {
      const optionCounts: [number, number, number, number] = [0, 0, 0, 0];
      const optionPlayerNames: [string[], string[], string[], string[]] = [[], [], [], []];
      const playerMap = new Map(players.map((p) => [p.id, p.nickname]));

      answers.forEach((a) => {
        if (a.selected_option >= 0 && a.selected_option <= 3) {
          optionCounts[a.selected_option]++;
          const name = playerMap.get(a.player_id);
          if (name) {
            optionPlayerNames[a.selected_option].push(name);
          }
        }
      });

      const totalAnswered =
        optionCounts[0] + optionCounts[1] + optionCounts[2] + optionCounts[3];

      reveal = {
        questionId: activeQ.id,
        correctOptionIndex: activeQ.correct_option_index as 0 | 1 | 2 | 3,
        scriptureRef: activeQ.scripture_ref,
        explanation: activeQ.explanation,
        optionCounts,
        optionPlayerNames,
        totalAnswered,
      };
    }
  }

  const top5: LeaderboardEntryDTO[] = players.slice(0, 5).map((p, idx) => ({
    rank: idx + 1,
    playerId: p.id,
    nickname: p.nickname,
    academicLevel: p.academic_level,
    totalScore: p.total_score,
    correctCount: p.correct_count,
  }));

  const podium: LeaderboardEntryDTO[] = players.slice(0, 10).map((p, idx) => ({
    rank: idx + 1,
    playerId: p.id,
    nickname: p.nickname,
    academicLevel: p.academic_level,
    totalScore: p.total_score,
    correctCount: p.correct_count,
  }));

  let questionEndsAtMs: number | null = null;
  if (
    room.status === 'QUESTION_ACTIVE' &&
    room.question_started_at &&
    room.current_question_index >= 0 &&
    questions[room.current_question_index]
  ) {
    questionEndsAtMs =
      new Date(room.question_started_at).getTime() +
      questions[room.current_question_index].time_limit_sec * 1000;
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
    top5,
    podium,
  };
}

// --- 8. PLAYER SESSION (OPTIMIZED FOR 200 PLAYERS) ---
export async function getPlayerSessionFromNeon(pin: string, playerToken: string) {
  const sql = getSql();

  const cleanPin = pin.trim();
  const rows = await sql`
    SELECT
      r.id as room_id, r.pin, r.status as room_status, r.current_question_index, r.question_started_at,
      p.id as player_id, p.nickname, p.academic_level, p.total_score, p.is_kicked,
      (SELECT COUNT(*)::INTEGER FROM public.players WHERE room_id = r.id AND is_kicked = false) as total_players,
      (SELECT COUNT(*)::INTEGER FROM public.players WHERE room_id = r.id AND is_kicked = false AND total_score > p.total_score) as higher_count
    FROM public.rooms r
    JOIN public.players p ON p.room_id = r.id AND p.player_token = ${playerToken}::uuid
    WHERE TRIM(r.pin) = ${cleanPin}
  `;

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  if (row.is_kicked) return { kicked: true };

  const serverNowMs = Date.now();
  let publicQuestion: PublicQuestionDTO | null = null;
  let lockedOptionForActiveQuestion: number | null = null;
  let questionEndsAtMs: number | null = null;
  let reveal: RevealedAnswerDTO | null = null;

  if (row.current_question_index >= 0) {
    const qRows = await sql`
      SELECT * FROM public.questions WHERE room_id = ${row.room_id} AND order_index = ${row.current_question_index}
    `;

    if (qRows.length > 0) {
      const activeQ = qRows[0] as QuestionRecord;
      const countRows = await sql`
        SELECT COUNT(*)::INTEGER as count FROM public.questions WHERE room_id = ${row.room_id}
      `;
      const totalQuestions = countRows[0]?.count || 1;

      if (row.room_status === 'QUESTION_ACTIVE') {
        publicQuestion = {
          id: activeQ.id,
          orderIndex: row.current_question_index,
          totalQuestions,
          prompt: activeQ.prompt,
          options: [activeQ.option_a, activeQ.option_b, activeQ.option_c, activeQ.option_d],
          timeLimitSec: activeQ.time_limit_sec,
        };

        if (row.question_started_at) {
          questionEndsAtMs =
            new Date(row.question_started_at).getTime() + activeQ.time_limit_sec * 1000;
        }

        const ansRows = await sql`
          SELECT selected_option FROM public.answers WHERE question_id = ${activeQ.id} AND player_id = ${row.player_id}
        `;
        if (ansRows.length > 0) {
          lockedOptionForActiveQuestion = ansRows[0].selected_option;
        }
      } else if (row.room_status === 'ANSWER_REVEALED') {
        const ansAllRows = await sql`
          SELECT selected_option, player_id FROM public.answers WHERE question_id = ${activeQ.id}
        `;
        const optionCounts: [number, number, number, number] = [0, 0, 0, 0];
        ansAllRows.forEach((a) => {
          if (a.selected_option >= 0 && a.selected_option <= 3) {
            optionCounts[a.selected_option]++;
          }
        });

        const totalAnswered =
          optionCounts[0] + optionCounts[1] + optionCounts[2] + optionCounts[3];

        reveal = {
          questionId: activeQ.id,
          correctOptionIndex: activeQ.correct_option_index as 0 | 1 | 2 | 3,
          scriptureRef: activeQ.scripture_ref,
          explanation: activeQ.explanation,
          optionCounts,
          totalAnswered,
        };
      }
    }
  }

  const currentRank = (row.higher_count || 0) + 1;

  return {
    player: {
      id: row.player_id,
      nickname: row.nickname,
      academicLevel: row.academic_level,
      totalScore: row.total_score,
      currentRank,
      totalPlayers: row.total_players || 1,
    },
    roomSnapshot: {
      status: row.room_status as RoomStatus,
      currentQuestionIndex: row.current_question_index,
      questionEndsAtMs,
      serverNowMs,
    },
    activeQuestion: publicQuestion,
    lockedOptionForActiveQuestion,
    reveal,
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
      r.id as room_id, r.status, r.current_question_index,
      p.id as player_id, p.total_score,
      (SELECT COUNT(*)::INTEGER FROM public.players WHERE room_id = r.id AND is_kicked = false) as total_players,
      (SELECT COUNT(*)::INTEGER FROM public.players WHERE room_id = r.id AND is_kicked = false AND total_score > p.total_score) as higher_count
    FROM public.rooms r
    JOIN public.players p ON p.room_id = r.id AND p.player_token = ${playerToken}::uuid
    WHERE r.pin = ${pin}
  `;

  if (rows.length === 0) return null;
  const row = rows[0];

  let targetQuestionId = questionId;
  if (!targetQuestionId && row.current_question_index >= 0) {
    const qRows = await sql`
      SELECT id FROM public.questions WHERE room_id = ${row.room_id} AND order_index = ${row.current_question_index}
    `;
    if (qRows.length > 0) targetQuestionId = qRows[0].id;
  }

  let isCorrect = false;
  let pointsAwarded = 0;
  if (targetQuestionId) {
    const ansRows = await sql`
      SELECT is_correct, points_awarded FROM public.answers WHERE question_id = ${targetQuestionId} AND player_id = ${row.player_id}
    `;
    if (ansRows.length > 0) {
      isCorrect = ansRows[0].is_correct;
      pointsAwarded = ansRows[0].points_awarded;
    }
  }

  const currentRank = (row.higher_count || 0) + 1;
  return {
    isCorrect,
    pointsAwarded,
    cumulativeScore: row.total_score,
    currentRank,
    totalPlayers: row.total_players || 1,
    pointsToNextRank: 0,
  };
}
