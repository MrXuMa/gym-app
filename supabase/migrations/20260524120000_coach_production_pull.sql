-- Production pull model: app writes to Supabase; homelab worker pulls work.
-- Debounced context sync (one pending flag per user — handles complete + delete).

CREATE TABLE IF NOT EXISTS public.coach_user_sync_state (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  needs_sync boolean NOT NULL DEFAULT true,
  sync_requested_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coach_user_sync_state_pending_idx
  ON public.coach_user_sync_state (sync_requested_at)
  WHERE needs_sync = true;

ALTER TABLE public.coach_user_sync_state ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.coach_user_sync_state IS
  'Debounced coach context rebuild queue; worker on homelab polls needs_sync=true.';

-- App calls this after workout complete, delete, or profile changes.
CREATE OR REPLACE FUNCTION public.enqueue_coach_context_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  INSERT INTO public.coach_user_sync_state (user_id, needs_sync, sync_requested_at)
  VALUES (auth.uid(), true, now())
  ON CONFLICT (user_id) DO UPDATE
    SET needs_sync = true,
        sync_requested_at = excluded.sync_requested_at;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_coach_context_sync() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_coach_context_sync() TO authenticated;

-- App inserts advice jobs directly (homelab worker polls pending rows).
CREATE POLICY coach_advice_requests_insert_own ON public.coach_advice_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Faster worker claim queries
CREATE INDEX IF NOT EXISTS coach_advice_requests_pending_idx
  ON public.coach_advice_requests (created_at)
  WHERE status = 'pending';
