-- Harden bulletin helper: callers may only count their own tasks.

CREATE OR REPLACE FUNCTION public.active_bulletin_task_count(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'unauthorized'
      USING ERRCODE = '42501';
  END IF;

  RETURN (
    SELECT count(*)::integer
    FROM public.bulletin_tasks t
    WHERE t.user_id = p_user_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.active_bulletin_task_count(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.active_bulletin_task_count(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.active_bulletin_task_count(uuid) FROM authenticated;
