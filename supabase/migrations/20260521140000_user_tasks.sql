CREATE TABLE public.user_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(trim(title)) >= 1 AND char_length(title) <= 200),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX user_tasks_user_id_created_at_idx ON public.user_tasks(user_id, created_at DESC);

ALTER TABLE public.user_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_tasks_select ON public.user_tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY user_tasks_insert ON public.user_tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY user_tasks_delete ON public.user_tasks FOR DELETE USING (auth.uid() = user_id);
