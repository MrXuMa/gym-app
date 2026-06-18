-- Home task bulletin: temporary (one-and-done) and recurring (resets at Eastern midnight).

CREATE TABLE public.bulletin_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text NOT NULL,
  task_type text NOT NULL CHECK (task_type IN ('temporary', 'recurring')),
  sort_order integer NOT NULL DEFAULT 0,
  last_completed_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bulletin_tasks_title_len CHECK (char_length(trim(title)) BETWEEN 1 AND 200)
);

CREATE INDEX bulletin_tasks_user_id_idx ON public.bulletin_tasks (user_id);
CREATE INDEX bulletin_tasks_user_sort_idx ON public.bulletin_tasks (user_id, sort_order);

ALTER TABLE public.bulletin_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY bulletin_tasks_select_own ON public.bulletin_tasks
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY bulletin_tasks_insert_own ON public.bulletin_tasks
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY bulletin_tasks_update_own ON public.bulletin_tasks
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY bulletin_tasks_delete_own ON public.bulletin_tasks
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION public.eastern_today_date()
RETURNS date
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (timezone('America/New_York', now()))::date;
$$;

CREATE OR REPLACE FUNCTION public.active_bulletin_task_count(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer
  FROM public.bulletin_tasks t
  WHERE t.user_id = p_user_id
    AND (
      t.task_type = 'temporary'
      OR t.last_completed_date IS NULL
      OR t.last_completed_date < public.eastern_today_date()
    );
$$;

CREATE OR REPLACE FUNCTION public.bulletin_tasks_limit_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.active_bulletin_task_count(NEW.user_id) >= 15 THEN
    RAISE EXCEPTION 'bulletin_task_limit'
      USING ERRCODE = 'check_violation',
            MESSAGE = 'Maximum 15 active tasks on the bulletin.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER bulletin_tasks_limit_check
  BEFORE INSERT ON public.bulletin_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.bulletin_tasks_limit_check();

CREATE OR REPLACE FUNCTION public.touch_bulletin_tasks_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER bulletin_tasks_updated_at
  BEFORE UPDATE ON public.bulletin_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_bulletin_tasks_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bulletin_tasks TO authenticated;

REVOKE ALL ON FUNCTION public.active_bulletin_task_count(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bulletin_tasks_limit_check() FROM PUBLIC;
