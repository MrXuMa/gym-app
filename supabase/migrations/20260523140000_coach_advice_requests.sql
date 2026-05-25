-- Async coach advice jobs (created by coach-api, polled by Expo app)
CREATE TABLE IF NOT EXISTS public.coach_advice_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  response text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS coach_advice_requests_user_created_idx
  ON public.coach_advice_requests (user_id, created_at DESC);

ALTER TABLE public.coach_advice_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY coach_advice_requests_select_own ON public.coach_advice_requests
  FOR SELECT USING (auth.uid() = user_id);

-- Inserts/updates from coach-api use service_role — bypasses RLS.

COMMENT ON TABLE public.coach_advice_requests IS 'Async AI coach advice jobs; coach-api writes, app reads via API or RLS select.';
