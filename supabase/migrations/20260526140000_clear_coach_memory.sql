-- Clear long-term coach advice memory (response_summaries, legacy coach_notes, last_advice).

CREATE OR REPLACE FUNCTION public.clear_coach_memory()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_context jsonb;
  v_empty_advice jsonb := jsonb_build_object(
    'at', null,
    'question', null,
    'summary', null
  );
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT context INTO v_context
  FROM public.coach_context
  WHERE user_id = auth.uid();

  IF v_context IS NULL THEN
    v_context := '{}'::jsonb;
  END IF;

  v_context := jsonb_set(v_context, '{response_summaries}', '[]'::jsonb, true);
  v_context := jsonb_set(v_context, '{coach_notes}', '[]'::jsonb, true);
  v_context := jsonb_set(v_context, '{last_advice}', v_empty_advice, true);

  INSERT INTO public.coach_context (user_id, context, updated_at)
  VALUES (auth.uid(), v_context, now())
  ON CONFLICT (user_id) DO UPDATE
    SET context = excluded.context,
        updated_at = excluded.updated_at;

  PERFORM public.enqueue_coach_context_sync();
END;
$$;

REVOKE ALL ON FUNCTION public.clear_coach_memory() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_coach_memory() TO authenticated;

COMMENT ON FUNCTION public.clear_coach_memory() IS
  'Wipes response_summaries, coach_notes, and last_advice for the signed-in user; enqueues VM context file sync.';
