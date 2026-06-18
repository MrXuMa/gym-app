-- Collapse coach job tables (2→1) and saved templates (3→1 JSON document).

-- 1. New async job table
CREATE TABLE public.coach_template_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status = ANY (ARRAY['pending'::text, 'running'::text, 'completed'::text, 'failed'::text])),
  template_draft jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  accepted_at timestamptz,
  saved_template_id uuid
);

CREATE INDEX coach_template_jobs_user_created_idx
  ON public.coach_template_jobs (user_id, created_at DESC);

ALTER TABLE public.coach_template_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY coach_template_jobs_select_own ON public.coach_template_jobs
  FOR SELECT USING (auth.uid() = user_id);

-- 2. Extend saved templates with JSON content
ALTER TABLE public.workout_templates
  ADD COLUMN IF NOT EXISTS content jsonb,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual'
    CHECK (source = ANY (ARRAY['manual'::text, 'coach'::text])),
  ADD COLUMN IF NOT EXISTS coach_job_id uuid;

-- 3. Backfill content from normalized exercise/set tables
WITH exercise_rows AS (
  SELECT
    te.template_id,
    te.sort_order,
    te.exercise_id,
    e.name AS exercise_name,
    e.target_muscle,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'reps', ts.reps,
            'weight', ts.weight
          ) ORDER BY ts.set_number
        )
        FROM public.workout_template_sets ts
        WHERE ts.template_exercise_id = te.id
      ),
      '[]'::jsonb
    ) AS sets
  FROM public.workout_template_exercises te
  JOIN public.exercises e ON e.id = te.exercise_id
),
grouped AS (
  SELECT
    template_id,
    jsonb_agg(
      jsonb_build_object(
        'exercise_id', exercise_id,
        'exercise_name', exercise_name,
        'target_muscle', target_muscle,
        'sets', sets
      ) ORDER BY sort_order
    ) AS exercises
  FROM exercise_rows
  GROUP BY template_id
)
UPDATE public.workout_templates wt
SET content = jsonb_build_object('exercises', COALESCE(g.exercises, '[]'::jsonb))
FROM grouped g
WHERE wt.id = g.template_id;

UPDATE public.workout_templates
SET content = '{"exercises":[]}'::jsonb
WHERE content IS NULL;

ALTER TABLE public.workout_templates
  ALTER COLUMN content SET NOT NULL;

-- 4. Migrate in-flight coach rows into coach_template_jobs
INSERT INTO public.coach_template_jobs (
  id, user_id, prompt, status, template_draft, error, created_at, completed_at, accepted_at
)
SELECT
  COALESCE(p.id, a.id),
  a.user_id,
  COALESCE(a.question, ''),
  COALESCE(p.status, a.status),
  p.template_draft,
  COALESCE(p.error, a.error),
  a.created_at,
  COALESCE(p.completed_at, a.completed_at),
  p.accepted_at
FROM public.coach_advice_requests a
LEFT JOIN public.coach_template_proposals p ON p.advice_id = a.id;

-- 5. Link saved_template_id FK after workout_templates exists
ALTER TABLE public.coach_template_jobs
  ADD CONSTRAINT coach_template_jobs_saved_template_id_fkey
  FOREIGN KEY (saved_template_id) REFERENCES public.workout_templates(id) ON DELETE SET NULL;

ALTER TABLE public.workout_templates
  ADD CONSTRAINT workout_templates_coach_job_id_fkey
  FOREIGN KEY (coach_job_id) REFERENCES public.coach_template_jobs(id) ON DELETE SET NULL;

-- 6. RPCs
CREATE OR REPLACE FUNCTION public.request_coach_template_job(p_prompt text DEFAULT '')
RETURNS public.coach_template_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_prompt text;
  v_row public.coach_template_jobs;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  v_prompt := trim(regexp_replace(coalesce(p_prompt, ''), '\s+', ' ', 'g'));

  IF char_length(v_prompt) > 500 THEN
    RAISE EXCEPTION 'prompt must be under 500 characters';
  END IF;

  DELETE FROM public.coach_template_jobs WHERE user_id = v_user_id;

  INSERT INTO public.coach_template_jobs (user_id, prompt, status)
  VALUES (v_user_id, v_prompt, 'pending')
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.accept_coach_template_job(
  p_job_id uuid,
  p_saved_template_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  UPDATE public.coach_template_jobs
  SET
    accepted_at = now(),
    saved_template_id = p_saved_template_id
  WHERE id = p_job_id
    AND user_id = v_user_id
    AND status = 'completed'
    AND accepted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'job not found or already accepted';
  END IF;

  UPDATE public.workout_templates
  SET coach_job_id = p_job_id, source = 'coach'
  WHERE id = p_saved_template_id
    AND user_id = v_user_id;
END;
$function$;

-- 7. Drop legacy RPCs first (they depend on dropped table types)
DROP FUNCTION IF EXISTS public.request_coach_advice(text, boolean);
DROP FUNCTION IF EXISTS public.request_coach_template_from_advice(uuid);
DROP FUNCTION IF EXISTS public.accept_coach_template_proposal(uuid);

-- 8. Drop legacy coach + normalized template tables
DROP TABLE IF EXISTS public.coach_template_proposals;
DROP TABLE IF EXISTS public.coach_advice_requests;
DROP TABLE IF EXISTS public.workout_template_sets;
DROP TABLE IF EXISTS public.workout_template_exercises;
