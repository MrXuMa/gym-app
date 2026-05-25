-- Allow optional reps on template sets and workout logs
ALTER TABLE public.workout_template_sets
  ALTER COLUMN reps DROP NOT NULL;

ALTER TABLE public.workout_template_sets
  DROP CONSTRAINT IF EXISTS workout_template_sets_reps_check;

ALTER TABLE public.workout_logs
  ALTER COLUMN reps DROP NOT NULL;
