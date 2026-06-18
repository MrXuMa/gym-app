-- Recurring tasks: user-local reset time + completion timestamp (replaces Eastern date).

ALTER TABLE public.bulletin_tasks
  ADD COLUMN IF NOT EXISTS reset_time_local time NOT NULL DEFAULT '00:00:00',
  ADD COLUMN IF NOT EXISTS last_completed_at timestamptz;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bulletin_tasks'
      AND column_name = 'last_completed_date'
  ) THEN
    UPDATE public.bulletin_tasks
    SET last_completed_at = (last_completed_date::timestamp AT TIME ZONE 'America/New_York')
    WHERE last_completed_date IS NOT NULL
      AND last_completed_at IS NULL;

    ALTER TABLE public.bulletin_tasks DROP COLUMN last_completed_date;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.active_bulletin_task_count(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer
  FROM public.bulletin_tasks t
  WHERE t.user_id = p_user_id;
$$;
