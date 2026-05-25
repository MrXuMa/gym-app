-- Single active coach advice per user; summarize completed advice into coach_context.

ALTER TABLE public.coach_advice_requests
  ADD COLUMN IF NOT EXISTS context_recorded boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.coach_advice_requests.context_recorded IS
  'True after record_coach_advice_in_context has merged this response into coach_context.';

-- Advice rows are created via RPC only (replaces direct client INSERT).
DROP POLICY IF EXISTS coach_advice_requests_insert_own ON public.coach_advice_requests;

CREATE OR REPLACE FUNCTION public.request_coach_advice(p_question text)
RETURNS public.coach_advice_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_question text;
  v_row public.coach_advice_requests;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  v_question := trim(regexp_replace(p_question, '\s+', ' ', 'g'));

  IF char_length(v_question) < 8 THEN
    RAISE EXCEPTION 'question must be at least 8 characters';
  END IF;

  IF char_length(v_question) > 500 THEN
    RAISE EXCEPTION 'question must be under 500 characters';
  END IF;

  DELETE FROM public.coach_advice_requests WHERE user_id = v_user_id;

  INSERT INTO public.coach_advice_requests (user_id, question, status)
  VALUES (v_user_id, v_question, 'pending')
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.request_coach_advice(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_coach_advice(text) TO authenticated;

CREATE OR REPLACE FUNCTION public._coach_advice_summary(p_response text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT left(trim(p_response), 400);
$$;

CREATE OR REPLACE FUNCTION public.record_coach_advice_in_context(p_advice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_advice public.coach_advice_requests;
  v_summary text;
  v_note jsonb;
  v_context jsonb;
  v_notes jsonb;
BEGIN
  SELECT * INTO v_advice
  FROM public.coach_advice_requests
  WHERE id = p_advice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'advice not found';
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() <> v_advice.user_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_advice.status <> 'completed' OR v_advice.response IS NULL THEN
    RETURN;
  END IF;

  IF v_advice.context_recorded THEN
    RETURN;
  END IF;

  v_summary := public._coach_advice_summary(v_advice.response);
  v_note := jsonb_build_object(
    'at', v_advice.completed_at,
    'question', left(v_advice.question, 120),
    'summary', v_summary
  );

  SELECT context INTO v_context
  FROM public.coach_context
  WHERE user_id = v_advice.user_id;

  IF v_context IS NULL THEN
    v_context := '{}'::jsonb;
  END IF;

  v_notes := coalesce(v_context->'coach_notes', '[]'::jsonb);
  v_notes := jsonb_build_array(v_note) || v_notes;

  v_notes := coalesce(
    (
      SELECT jsonb_agg(elem)
      FROM (
        SELECT elem
        FROM jsonb_array_elements(v_notes) AS elem
        LIMIT 5
      ) capped
    ),
    '[]'::jsonb
  );

  v_context := jsonb_set(v_context, '{last_advice}', v_note, true);
  v_context := jsonb_set(v_context, '{coach_notes}', v_notes, true);

  INSERT INTO public.coach_context (user_id, context, updated_at)
  VALUES (v_advice.user_id, v_context, now())
  ON CONFLICT (user_id) DO UPDATE
    SET context = excluded.context,
        updated_at = excluded.updated_at;

  UPDATE public.coach_advice_requests
  SET context_recorded = true
  WHERE id = p_advice_id;

  INSERT INTO public.coach_user_sync_state (user_id, needs_sync, sync_requested_at)
  VALUES (v_advice.user_id, true, now())
  ON CONFLICT (user_id) DO UPDATE
    SET needs_sync = true,
        sync_requested_at = excluded.sync_requested_at;
END;
$$;

REVOKE ALL ON FUNCTION public.record_coach_advice_in_context(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_coach_advice_in_context(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_coach_advice_in_context(uuid) TO service_role;
