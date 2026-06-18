-- Template-only coach: drop advice memory, allow blank template prompts, slim context.
-- Applied via Supabase MCP / CLI (migration name: template_only_coach).

-- 1. Allow empty optional prompts when generating a workout template
CREATE OR REPLACE FUNCTION public.request_coach_advice(p_question text, p_wants_template boolean DEFAULT true)
 RETURNS coach_advice_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_question text;
  v_row public.coach_advice_requests;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  v_question := trim(regexp_replace(coalesce(p_question, ''), '\s+', ' ', 'g'));

  IF coalesce(p_wants_template, true) THEN
    IF char_length(v_question) > 500 THEN
      RAISE EXCEPTION 'question must be under 500 characters';
    END IF;
  ELSE
    RAISE EXCEPTION 'General advice is disabled. Generate a workout template instead.';
  END IF;

  DELETE FROM public.coach_advice_requests WHERE user_id = v_user_id;

  INSERT INTO public.coach_advice_requests (user_id, question, status, wants_template)
  VALUES (v_user_id, v_question, 'pending', true)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;

-- 2. Drop advice-memory helpers (no longer written or read)
DROP FUNCTION IF EXISTS public.record_coach_advice_in_context(uuid, text);
DROP FUNCTION IF EXISTS public.record_coach_advice_in_context(uuid);
DROP FUNCTION IF EXISTS public.clear_coach_memory();
DROP FUNCTION IF EXISTS public._coach_advice_summary(text);

-- 3. Drop context_recorded column (advice summaries removed)
ALTER TABLE public.coach_advice_requests
  DROP COLUMN IF EXISTS context_recorded;

-- 4. Strip stale keys from existing coach_context blobs
UPDATE public.coach_context
SET context = context
  - 'response_summaries'
  - 'coach_notes'
  - 'coach_memory'
  - 'last_advice'
  - 'nutrition_summary'
  - 'athlete_snapshot'
  - 'rolling_metrics'
  - 'recent_prs'
  - 'flags',
    updated_at = now();

-- 5. Queue full context rebuild for all users (slim schema v2)
UPDATE public.coach_user_sync_state
SET needs_sync = true,
    sync_requested_at = now();

INSERT INTO public.coach_user_sync_state (user_id, needs_sync, sync_requested_at)
SELECT user_id, true, now()
FROM public.coach_context
ON CONFLICT (user_id) DO UPDATE
  SET needs_sync = true,
      sync_requested_at = excluded.sync_requested_at;
