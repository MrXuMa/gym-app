-- Coach context schema v4: worker rebuilds goals-first slim JSON with weight protocol.

UPDATE public.coach_user_sync_state
SET needs_sync = true,
    sync_requested_at = now();

INSERT INTO public.coach_user_sync_state (user_id, needs_sync, sync_requested_at)
SELECT user_id, true, now()
FROM public.coach_context
ON CONFLICT (user_id) DO UPDATE
  SET needs_sync = true,
      sync_requested_at = excluded.sync_requested_at;

INSERT INTO public.coach_user_sync_state (user_id, needs_sync, sync_requested_at)
SELECT id, true, now()
FROM auth.users
WHERE NOT EXISTS (
  SELECT 1 FROM public.coach_user_sync_state s WHERE s.user_id = users.id
)
ON CONFLICT (user_id) DO NOTHING;
