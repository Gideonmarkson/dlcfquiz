CREATE OR REPLACE FUNCTION public.submit_player_answer(
  p_pin CHAR(6),
  p_player_token UUID,
  p_question_id UUID,
  p_selected_option SMALLINT
)
RETURNS TABLE (
  accepted BOOLEAN,
  error_code TEXT,
  locked_option SMALLINT,
  answered_count_for_question INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_room public.rooms%ROWTYPE;
  v_player public.players%ROWTYPE;
  v_question public.questions%ROWTYPE;
  v_existing_option SMALLINT;
  v_elapsed_ms INTEGER;
  v_total_ms INTEGER;
  v_remaining_ms INTEGER;
  v_is_correct BOOLEAN;
  v_points INTEGER;
  v_q_count INTEGER;
BEGIN
  -- 1. Validate Room
  SELECT * INTO v_room FROM public.rooms WHERE pin = p_pin;
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'ROOM_NOT_FOUND', NULL::SMALLINT, 0;
    RETURN;
  END IF;

  IF v_room.status <> 'QUESTION_ACTIVE' OR v_room.question_started_at IS NULL THEN
    RETURN QUERY SELECT FALSE, 'SUBMISSION_WINDOW_CLOSED', NULL::SMALLINT, 0;
    RETURN;
  END IF;

  -- 2. Validate Player
  SELECT * INTO v_player
  FROM public.players
  WHERE room_id = v_room.id AND player_token = p_player_token AND is_kicked = FALSE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'PLAYER_UNAUTHORIZED', NULL::SMALLINT, 0;
    RETURN;
  END IF;

  -- 3. Validate Active Question
  SELECT * INTO v_question
  FROM public.questions
  WHERE id = p_question_id AND room_id = v_room.id AND order_index = v_room.current_question_index;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'QUESTION_MISMATCH', NULL::SMALLINT, 0;
    RETURN;
  END IF;

  -- 4. Idempotency check (return previously locked choice safely)
  SELECT selected_option INTO v_existing_option
  FROM public.answers
  WHERE question_id = v_question.id AND player_id = v_player.id;

  IF FOUND THEN
    SELECT COUNT(*)::INTEGER INTO v_q_count FROM public.answers WHERE question_id = v_question.id;
    RETURN QUERY SELECT TRUE, 'ALREADY_SUBMITTED', v_existing_option, v_q_count;
    RETURN;
  END IF;

  -- 5. Authoritative Server Timing Calculation (+500ms 3G network grace window)
  v_total_ms := v_question.time_limit_sec * 1000;
  v_elapsed_ms := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - v_room.question_started_at)) * 1000)::INTEGER);

  IF v_elapsed_ms > (v_total_ms + 500) THEN
    RETURN QUERY SELECT FALSE, 'TIME_EXPIRED', NULL::SMALLINT, 0;
    RETURN;
  END IF;

  v_remaining_ms := GREATEST(0, LEAST(v_total_ms, v_total_ms - v_elapsed_ms));
  v_is_correct := (p_selected_option = v_question.correct_option_index);

  -- Exact Speed + Accuracy Formula: 500 + Math.round(500 * (timeRemainingMs / totalQuestionTimeMs))
  IF v_is_correct THEN
    v_points := 500 + ROUND(500.0 * (v_remaining_ms::NUMERIC / v_total_ms::NUMERIC))::INTEGER;
  ELSE
    v_points := 0;
  END IF;

  -- 6. Atomic Insert + Player Cumulative Update
  INSERT INTO public.answers (
    room_id, question_id, player_id, selected_option, is_correct, response_time_ms, points_awarded
  ) VALUES (
    v_room.id, v_question.id, v_player.id, p_selected_option, v_is_correct, LEAST(v_elapsed_ms, v_total_ms), v_points
  );

  UPDATE public.players
  SET
    total_score = total_score + v_points,
    correct_count = correct_count + (CASE WHEN v_is_correct THEN 1 ELSE 0 END),
    answered_count = answered_count + 1,
    total_correct_response_ms = total_correct_response_ms + (CASE WHEN v_is_correct THEN LEAST(v_elapsed_ms, v_total_ms) ELSE 0 END),
    last_seen_at = NOW()
  WHERE id = v_player.id;

  SELECT COUNT(*)::INTEGER INTO v_q_count FROM public.answers WHERE question_id = v_question.id;

  RETURN QUERY SELECT TRUE, NULL::TEXT, p_selected_option, v_q_count;
END;
$$;
