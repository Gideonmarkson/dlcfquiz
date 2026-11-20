export type RoomStatus =
  | 'DRAFT'
  | 'LOBBY'
  | 'QUESTION_ACTIVE'
  | 'ANSWER_REVEALED'
  | 'LEADERBOARD'
  | 'GAME_OVER';

export type AcademicLevel = '100L' | '200L' | '300L' | '400L' | '500L' | 'PG/STAFF';

export type HypeEmoji = '🔥' | '🚀' | '👏' | '💡' | '⚡';

/** Safe client-facing question payload during QUESTION_ACTIVE (NO correct_option_index or scripture_ref) */
export interface PublicQuestionDTO {
  id: string;
  orderIndex: number;
  totalQuestions: number;
  prompt: string;
  options: [string, string, string, string]; // [A, B, C, D]
  timeLimitSec: number;
}

/** Host question structure including correct answers */
export interface HostQuestionDTO {
  id: string;
  orderIndex: number;
  prompt: string;
  options: [string, string, string, string];
  correctOptionIndex: 0 | 1 | 2 | 3;
  scriptureRef: string;
  explanation?: string | null;
  timeLimitSec: number;
}

/** Input format when creating/editing questions */
export interface QuestionInput {
  prompt: string;
  options: [string, string, string, string];
  correctOptionIndex: 0 | 1 | 2 | 3;
  scriptureRef: string;
  explanation?: string | null;
  timeLimitSec: number;
}

/** Revealed question payload broadcasted ONLY on ANSWER_REVEALED */
export interface RevealedAnswerDTO {
  questionId: string;
  correctOptionIndex: 0 | 1 | 2 | 3;
  scriptureRef: string;
  explanation?: string | null;
  optionCounts: [number, number, number, number];
  optionPlayerNames?: [string[], string[], string[], string[]];
  totalAnswered: number;
}

export interface LeaderboardEntryDTO {
  rank: number;
  playerId: string;
  nickname: string;
  academicLevel: AcademicLevel;
  totalScore: number;
  correctCount: number;
  rankDelta?: number; // e.g., +2, -1, 0
}

export interface StateChangePayload {
  status: RoomStatus;
  currentQuestionIndex: number;
  serverNowMs: number;
  questionEndsAtMs?: number;
  question?: PublicQuestionDTO;
  reveal?: RevealedAnswerDTO;
  top5?: LeaderboardEntryDTO[];
  podium?: LeaderboardEntryDTO[];
  totalPlayers: number;
}

export interface TimerSyncPayload {
  serverNowMs: number;
  questionEndsAtMs: number;
  answeredCount: number;
  totalPlayers: number;
}

export interface LobbyUpdatePayload {
  action: 'join' | 'kick';
  player: { id: string; nickname: string; academicLevel: AcademicLevel };
  totalPlayers: number;
}

export interface HypePayload {
  id: string;        // 4-char random nonce for React key
  e: HypeEmoji;      // Compact emoji key
  l: AcademicLevel;  // Academic level badge tag
}

/** Ephemeral Realtime Broadcast Events on channel `room:{pin}` (0 DB writes) */
export type RealtimeBroadcastEvent =
  | {
      event: 'state_change';
      payload: StateChangePayload;
    }
  | {
      event: 'timer_sync';
      payload: TimerSyncPayload;
    }
  | {
      event: 'lobby_update';
      payload: LobbyUpdatePayload;
    }
  | {
      event: 'hype';
      payload: HypePayload;
    };

/** Player session data stored in localStorage */
export interface PlayerSessionStorage {
  pin: string;
  playerId: string;
  playerToken: string;
  nickname: string;
  academicLevel: AcademicLevel;
}

/** Database entity types */
export interface RoomRecord {
  id: string;
  pin: string;
  title: string;
  host_secret_hash: string;
  host_recovery_code: string;
  status: RoomStatus;
  current_question_index: number;
  question_started_at: string | null;
  hype_enabled: boolean;
  allow_late_join: boolean;
  created_at: string;
  updated_at: string;
}

export interface QuestionRecord {
  id: string;
  room_id: string;
  order_index: number;
  prompt: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option_index: number;
  scripture_ref: string;
  explanation: string | null;
  time_limit_sec: number;
  created_at: string;
}

export interface PlayerRecord {
  id: string;
  room_id: string;
  player_token: string;
  nickname: string;
  academic_level: AcademicLevel;
  total_score: number;
  correct_count: number;
  answered_count: number;
  total_correct_response_ms: number;
  is_kicked: boolean;
  joined_at: string;
  last_seen_at: string;
}

export interface AnswerRecord {
  id: string;
  room_id: string;
  question_id: string;
  player_id: string;
  selected_option: number;
  is_correct: boolean;
  response_time_ms: number;
  points_awarded: number;
  submitted_at: string;
}
