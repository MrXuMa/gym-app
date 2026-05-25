-- Optional LLM-generated one-sentence summary from the VM worker.

CREATE OR REPLACE FUNCTION public.record_coach_advice_in_context(
  p_advice_id uuid,
  p_summary text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_advice public.coach_advice_requests;
  v_summary text;
  v_entry jsonb;
  v_context jsonb;
  v_summaries jsonb;
  v_max_summaries constant int := 25;
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

  IF p_summary IS NOT NULL AND length(trim(p_summary)) > 0 THEN
    v_summary := left(trim(p_summary), 400);
  ELSE
    v_summary := public._coach_advice_summary(v_advice.response);
  END IF;

  v_entry := jsonb_build_object(
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

  v_summaries := coalesce(v_context->'response_summaries', '[]'::jsonb);

  IF jsonb_array_length(v_summaries) = 0
     AND jsonb_array_length(coalesce(v_context->'coach_notes', '[]'::jsonb)) > 0 THEN
    v_summaries := v_context->'coach_notes';
  END IF;

  v_summaries := jsonb_build_array(v_entry) || v_summaries;

  v_summaries := coalesce(
    (
      SELECT jsonb_agg(elem)
      FROM (
        SELECT elem
        FROM jsonb_array_elements(v_summaries) AS elem
        LIMIT v_max_summaries
      ) capped
    ),
    '[]'::jsonb
  );

  v_context := jsonb_set(v_context, '{response_summaries}', v_summaries, true);
  v_context := jsonb_set(v_context, '{last_advice}', v_entry, true);

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

COMMENT ON FUNCTION public.record_coach_advice_in_context(uuid, text) IS
  'Appends advice summary to response_summaries. Worker may pass p_summary from a second LLM call; otherwise truncates response.';
