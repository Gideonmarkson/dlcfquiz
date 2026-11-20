import {
  RoomStatus,
  AcademicLevel,
  QuestionInput,
  RoomRecord,
  QuestionRecord,
  PlayerRecord,
  AnswerRecord,
} from '@/types/quiz';
import crypto from 'crypto';
import { calculateQuestionScore } from './scoring';

/**
 * In-Memory Database Store for Local Development & Seamless Testing
 * Used automatically when Supabase credentials are not yet configured or placeholder.
 * This guarantees zero crashes and immediate testing out-of-the-box.
 */

// Global singletons across module reloads in Next.js dev server
const globalStore = globalThis as unknown as {
  __mock_rooms?: Map<string, RoomRecord>;
  __mock_questions?: Map<string, QuestionRecord[]>;
  __mock_players?: Map<string, PlayerRecord[]>;
  __mock_answers?: Map<string, AnswerRecord[]>;
};

if (!globalStore.__mock_rooms) globalStore.__mock_rooms = new Map();
if (!globalStore.__mock_questions) globalStore.__mock_questions = new Map();
if (!globalStore.__mock_players) globalStore.__mock_players = new Map();
if (!globalStore.__mock_answers) globalStore.__mock_answers = new Map();

const rooms = globalStore.__mock_rooms;
const questions = globalStore.__mock_questions;
const players = globalStore.__mock_players;
const answers = globalStore.__mock_answers;

export function isUsingMockDb(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return !url || url.includes('placeholder') || !key || key.includes('placeholder');
}

export function mockCreateRoom(params: {
  pin: string;
  title: string;
  host_secret_hash: string;
  host_recovery_code: string;
}): RoomRecord {
  const roomId = crypto.randomUUID();
  const room: RoomRecord = {
    id: roomId,
    pin: params.pin,
    title: params.title,
    host_secret_hash: params.host_secret_hash,
    host_recovery_code: params.host_recovery_code,
    status: 'LOBBY',
    current_question_index: -1,
    question_started_at: null,
    hype_enabled: true,
    allow_late_join: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  rooms.set(room.id, room);
  rooms.set(room.pin, room);
  questions.set(room.id, []);
  players.set(room.id, []);
  answers.set(room.id, []);

  return room;
}

export function mockGetRoomByPin(pin: string): RoomRecord | null {
  return rooms.get(pin) || null;
}

export function mockInsertQuestions(roomId: string, qs: QuestionInput[]): QuestionRecord[] {
  const rows: QuestionRecord[] = qs.map((q, idx) => ({
    id: crypto.randomUUID(),
    room_id: roomId,
    order_index: idx,
    prompt: q.prompt,
    option_a: q.options[0],
    option_b: q.options[1],
    option_c: q.options[2],
    option_d: q.options[3],
    correct_option_index: q.correctOptionIndex,
    scripture_ref: q.scriptureRef,
    explanation: q.explanation || null,
    time_limit_sec: q.timeLimitSec,
    created_at: new Date().toISOString(),
  }));

  questions.set(roomId, rows);
  return rows;
}

export function mockGetQuestions(roomId: string): QuestionRecord[] {
  return questions.get(roomId) || [];
}

export function mockUpdateRoom(roomId: string, updates: Partial<RoomRecord>): RoomRecord | null {
  const room = rooms.get(roomId);
  if (!room) return null;

  const updated: RoomRecord = {
    ...room,
    ...updates,
    updated_at: new Date().toISOString(),
  };

  rooms.set(room.id, updated);
  rooms.set(room.pin, updated);
  return updated;
}

export function mockAddPlayer(roomId: string, nickname: string, academicLevel: AcademicLevel): PlayerRecord {
  const list = players.get(roomId) || [];
  const player: PlayerRecord = {
    id: crypto.randomUUID(),
    room_id: roomId,
    player_token: crypto.randomUUID(),
    nickname,
    academic_level: academicLevel,
    total_score: 0,
    correct_count: 0,
    answered_count: 0,
    total_correct_response_ms: 0,
    is_kicked: false,
    joined_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
  };

  list.push(player);
  players.set(roomId, list);
  return player;
}

export function mockGetPlayers(roomId: string): PlayerRecord[] {
  const list = players.get(roomId) || [];
  return list.filter((p) => !p.is_kicked);
}

export function mockGetPlayerByToken(token: string): PlayerRecord | null {
  for (const list of players.values()) {
    const found = list.find((p) => p.player_token === token);
    if (found) return found;
  }
  return null;
}

export function mockKickPlayer(roomId: string, playerId: string): boolean {
  const list = players.get(roomId) || [];
  const player = list.find((p) => p.id === playerId);
  if (player) {
    player.is_kicked = true;
    return true;
  }
  return false;
}

export function mockSubmitAnswer(
  pin: string,
  playerToken: string,
  questionId: string,
  selectedOption: number
): {
  accepted: boolean;
  error_code?: string;
  locked_option?: number;
  answered_count_for_question: number;
} {
  const room = rooms.get(pin);
  if (!room || room.status !== 'QUESTION_ACTIVE' || !room.question_started_at) {
    return { accepted: false, error_code: 'SUBMISSION_WINDOW_CLOSED', answered_count_for_question: 0 };
  }

  const roomPlayers = players.get(room.id) || [];
  const player = roomPlayers.find((p) => p.player_token === playerToken && !p.is_kicked);
  if (!player) {
    return { accepted: false, error_code: 'PLAYER_UNAUTHORIZED', answered_count_for_question: 0 };
  }

  const roomQuestions = questions.get(room.id) || [];
  const question = roomQuestions.find((q) => q.id === questionId && q.order_index === room.current_question_index);
  if (!question) {
    return { accepted: false, error_code: 'QUESTION_MISMATCH', answered_count_for_question: 0 };
  }

  const roomAnswers = answers.get(room.id) || [];
  const existing = roomAnswers.find((a) => a.question_id === question.id && a.player_id === player.id);
  if (existing) {
    const count = roomAnswers.filter((a) => a.question_id === question.id).length;
    return { accepted: true, locked_option: existing.selected_option, answered_count_for_question: count };
  }

  // Calculate timing & score
  const totalMs = question.time_limit_sec * 1000;
  const elapsedMs = Math.max(0, Date.now() - new Date(room.question_started_at).getTime());
  if (elapsedMs > totalMs + 500) {
    return { accepted: false, error_code: 'TIME_EXPIRED', answered_count_for_question: 0 };
  }

  const remainingMs = Math.max(0, totalMs - elapsedMs);
  const isCorrect = selectedOption === question.correct_option_index;
  const points = calculateQuestionScore(isCorrect, remainingMs, totalMs);

  const answerRecord: AnswerRecord = {
    id: crypto.randomUUID(),
    room_id: room.id,
    question_id: question.id,
    player_id: player.id,
    selected_option: selectedOption,
    is_correct: isCorrect,
    response_time_ms: Math.min(elapsedMs, totalMs),
    points_awarded: points,
    submitted_at: new Date().toISOString(),
  };

  roomAnswers.push(answerRecord);
  answers.set(room.id, roomAnswers);

  player.total_score += points;
  if (isCorrect) {
    player.correct_count += 1;
    player.total_correct_response_ms += Math.min(elapsedMs, totalMs);
  }
  player.answered_count += 1;
  player.last_seen_at = new Date().toISOString();

  const count = roomAnswers.filter((a) => a.question_id === question.id).length;
  return { accepted: true, locked_option: selectedOption, answered_count_for_question: count };
}

export function mockGetAnswersForQuestion(roomId: string, questionId: string): AnswerRecord[] {
  const roomAnswers = answers.get(roomId) || [];
  return roomAnswers.filter((a) => a.question_id === questionId);
}
