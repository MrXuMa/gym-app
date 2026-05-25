-- Per-user coach memory (mirrors /data/coach/users/{id}/coach_context.json on homelab)
CREATE TABLE IF NOT EXISTS public.coach_context (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  version int NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coach_context_updated_at_idx ON public.coach_context (updated_at DESC);

ALTER TABLE public.coach_context ENABLE ROW LEVEL SECURITY;

CREATE POLICY coach_context_select_own ON public.coach_context
  FOR SELECT USING (auth.uid() = user_id);

-- Inserts/updates from server (n8n, coach-api) use service_role key — bypasses RLS.

COMMENT ON TABLE public.coach_context IS 'Derived coach memory for LLM context; canonical workout data stays in user_workouts/workout_logs.';
