-- Template-focused coach context (schema v3): strip non-template keys and queue rebuild.

UPDATE public.coach_context
SET context = (
  context
  - 'response_summaries'
  - 'coach_notes'
  - 'coach_memory'
  - 'last_advice'
  - 'nutrition_summary'
  - 'athlete_snapshot'
  - 'rolling_metrics'
  - 'recent_prs'
  - 'flags'
  - 'logged_exercise_names'
  - 'recent_sessions'
) || jsonb_build_object('schema_version', 3),
    version = 3,
    updated_at = now();

UPDATE public.coach_user_sync_state
SET needs_sync = true,
    sync_requested_at = now();

INSERT INTO public.coach_user_sync_state (user_id, needs_sync, sync_requested_at)
SELECT user_id, true, now()
FROM public.coach_context
ON CONFLICT (user_id) DO UPDATE
  SET needs_sync = true,
      sync_requested_at = excluded.sync_requested_at;
