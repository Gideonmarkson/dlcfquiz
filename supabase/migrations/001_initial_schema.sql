-- Enable cryptographic UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Custom ENUM types
CREATE TYPE room_status AS ENUM (
  'DRAFT',
  'LOBBY',
  'QUESTION_ACTIVE',
  'ANSWER_REVEALED',
  'LEADERBOARD',
  'GAME_OVER'
);

CREATE TYPE academic_level AS ENUM (
  '100L',
  '200L',
  '300L',
  '400L',
  '500L',
  'PG/STAFF'
);

-- 1. ROOMS TABLE
CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pin CHAR(6) NOT NULL UNIQUE CHECK (pin ~ '^[0-9]{6}$'),
  title VARCHAR(120) NOT NULL DEFAULT 'DLCF AFIT Live Bible Quiz',
  host_secret_hash CHAR(64) NOT NULL, -- SHA-256 hex digest of host secret
  host_recovery_code CHAR(8) NOT NULL, -- Uppercase alphanumeric recovery key
  status room_status NOT NULL DEFAULT 'DRAFT',
  current_question_index INTEGER NOT NULL DEFAULT -1,
  question_started_at TIMESTAMPTZ NULL,
  hype_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  allow_late_join BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rooms_pin ON public.rooms (pin);
CREATE INDEX idx_rooms_status_created ON public.rooms (status, created_at DESC);

-- 2. QUESTIONS TABLE
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL CHECK (order_index >= 0),
  prompt TEXT NOT NULL CHECK (char_length(prompt) BETWEEN 5 AND 400),
  option_a VARCHAR(160) NOT NULL,
  option_b VARCHAR(160) NOT NULL,
  option_c VARCHAR(160) NOT NULL,
  option_d VARCHAR(160) NOT NULL,
  correct_option_index SMALLINT NOT NULL CHECK (correct_option_index BETWEEN 0 AND 3),
  scripture_ref VARCHAR(120) NOT NULL, -- e.g. '2 Timothy 2:15'
  explanation VARCHAR(280) NULL,       -- Optional concise doctrinal note
  time_limit_sec SMALLINT NOT NULL DEFAULT 20 CHECK (time_limit_sec BETWEEN 5 AND 60),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (room_id, order_index)
);

CREATE INDEX idx_questions_room_order ON public.questions (room_id, order_index);

-- 3. PLAYERS TABLE
CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  player_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  nickname VARCHAR(20) NOT NULL CHECK (char_length(trim(nickname)) >= 2),
  nickname_normalized VARCHAR(20) GENERATED ALWAYS AS (lower(trim(nickname))) STORED,
  academic_level academic_level NOT NULL,
  total_score INTEGER NOT NULL DEFAULT 0 CHECK (total_score >= 0),
  correct_count INTEGER NOT NULL DEFAULT 0 CHECK (correct_count >= 0),
  answered_count INTEGER NOT NULL DEFAULT 0 CHECK (answered_count >= 0),
  total_correct_response_ms BIGINT NOT NULL DEFAULT 0 CHECK (total_correct_response_ms >= 0),
  is_kicked BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (room_id, nickname_normalized)
);

-- Covering index for O(log N) Top-5 and full leaderboard sorting
CREATE INDEX idx_players_leaderboard
  ON public.players (room_id, is_kicked, total_score DESC, total_correct_response_ms ASC, joined_at ASC);

CREATE INDEX idx_players_token ON public.players (player_token);

-- 4. ANSWERS TABLE
CREATE TABLE public.answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  selected_option SMALLINT NOT NULL CHECK (selected_option BETWEEN 0 AND 3),
  is_correct BOOLEAN NOT NULL,
  response_time_ms INTEGER NOT NULL CHECK (response_time_ms >= 0),
  points_awarded INTEGER NOT NULL DEFAULT 0 CHECK (points_awarded BETWEEN 0 AND 1000),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (question_id, player_id)
);

CREATE INDEX idx_answers_question ON public.answers (question_id);
CREATE INDEX idx_answers_player_room ON public.answers (room_id, player_id);

-- ROW LEVEL SECURITY (LOCKED DOWN BY DEFAULT — ALL WRITES & READS VIA SERVER ROUTE HANDLERS)
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;

-- Deny direct anon table reads so correct_option_index & host_secret_hash can NEVER leak via Supabase PostgREST
CREATE POLICY "deny_anon_rooms" ON public.rooms FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon_questions" ON public.questions FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon_players" ON public.players FOR ALL TO anon USING (false);
CREATE POLICY "deny_anon_answers" ON public.answers FOR ALL TO anon USING (false);
