-- Workout templates (per-user)
CREATE TABLE public.workout_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) >= 1 AND char_length(name) <= 80),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.workout_template_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.workout_templates(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES public.exercises(id),
  sort_order integer NOT NULL CHECK (sort_order >= 0),
  UNIQUE (template_id, exercise_id)
);

CREATE TABLE public.workout_template_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_exercise_id uuid NOT NULL REFERENCES public.workout_template_exercises(id) ON DELETE CASCADE,
  set_number integer NOT NULL CHECK (set_number >= 1),
  reps integer CHECK (reps IS NULL OR reps > 0),
  weight numeric CHECK (weight IS NULL OR weight >= 0),
  UNIQUE (template_exercise_id, set_number)
);

CREATE INDEX workout_templates_user_id_idx ON public.workout_templates(user_id);
CREATE INDEX workout_template_exercises_template_id_idx ON public.workout_template_exercises(template_id);
CREATE INDEX workout_template_sets_template_exercise_id_idx ON public.workout_template_sets(template_exercise_id);

ALTER TABLE public.workout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_template_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_template_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY workout_templates_select ON public.workout_templates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY workout_templates_insert ON public.workout_templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY workout_templates_update ON public.workout_templates FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY workout_templates_delete ON public.workout_templates FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY workout_template_exercises_select ON public.workout_template_exercises FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.workout_templates t WHERE t.id = template_id AND t.user_id = auth.uid())
);
CREATE POLICY workout_template_exercises_insert ON public.workout_template_exercises FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.workout_templates t WHERE t.id = template_id AND t.user_id = auth.uid())
);
CREATE POLICY workout_template_exercises_update ON public.workout_template_exercises FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.workout_templates t WHERE t.id = template_id AND t.user_id = auth.uid())
);
CREATE POLICY workout_template_exercises_delete ON public.workout_template_exercises FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.workout_templates t WHERE t.id = template_id AND t.user_id = auth.uid())
);

CREATE POLICY workout_template_sets_select ON public.workout_template_sets FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.workout_template_exercises te
    JOIN public.workout_templates t ON t.id = te.template_id
    WHERE te.id = template_exercise_id AND t.user_id = auth.uid()
  )
);
CREATE POLICY workout_template_sets_insert ON public.workout_template_sets FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.workout_template_exercises te
    JOIN public.workout_templates t ON t.id = te.template_id
    WHERE te.id = template_exercise_id AND t.user_id = auth.uid()
  )
);
CREATE POLICY workout_template_sets_update ON public.workout_template_sets FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.workout_template_exercises te
    JOIN public.workout_templates t ON t.id = te.template_id
    WHERE te.id = template_exercise_id AND t.user_id = auth.uid()
  )
);
CREATE POLICY workout_template_sets_delete ON public.workout_template_sets FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.workout_template_exercises te
    JOIN public.workout_templates t ON t.id = te.template_id
    WHERE te.id = template_exercise_id AND t.user_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.set_workout_templates_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER workout_templates_updated_at
  BEFORE UPDATE ON public.workout_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_workout_templates_updated_at();
