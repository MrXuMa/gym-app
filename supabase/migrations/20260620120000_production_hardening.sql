-- Coach: rate limit + block concurrent jobs
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

  IF EXISTS (
    SELECT 1
    FROM public.coach_template_jobs
    WHERE user_id = v_user_id
      AND status IN ('pending', 'running')
  ) THEN
    RAISE EXCEPTION 'coach_job_in_progress';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.coach_template_jobs
    WHERE user_id = v_user_id
      AND created_at > now() - interval '30 seconds'
  ) THEN
    RAISE EXCEPTION 'coach_job_cooldown';
  END IF;

  v_prompt := trim(regexp_replace(coalesce(p_prompt, ''), '\s+', ' ', 'g'));

  IF char_length(v_prompt) > 500 THEN
    RAISE EXCEPTION 'prompt must be under 500 characters';
  END IF;

  DELETE FROM public.coach_template_jobs
  WHERE user_id = v_user_id
    AND status IN ('completed', 'failed');

  INSERT INTO public.coach_template_jobs (user_id, prompt, status)
  VALUES (v_user_id, v_prompt, 'pending')
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;

-- Food scan: atomic daily quota + in-progress guard (service_role only)
CREATE OR REPLACE FUNCTION public.reserve_food_analysis_request(
  p_user_id uuid,
  p_log_date date,
  p_daily_limit int,
  p_image_path text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_count int;
  v_id uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid user';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text || p_log_date::text));

  DELETE FROM public.food_analysis_requests
  WHERE log_date < p_log_date;

  IF EXISTS (
    SELECT 1
    FROM public.food_analysis_requests
    WHERE user_id = p_user_id
      AND log_date = p_log_date
      AND status IN ('pending', 'running')
  ) THEN
    RAISE EXCEPTION 'scan_in_progress';
  END IF;

  SELECT count(*)::int INTO v_count
  FROM public.food_analysis_requests
  WHERE user_id = p_user_id
    AND log_date = p_log_date;

  IF p_daily_limit > 0 AND v_count >= p_daily_limit THEN
    RAISE EXCEPTION 'daily_limit_reached';
  END IF;

  INSERT INTO public.food_analysis_requests (user_id, log_date, image_path, status)
  VALUES (p_user_id, p_log_date, p_image_path, 'running')
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.reserve_food_analysis_request(uuid, date, int, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserve_food_analysis_request(uuid, date, int, text) FROM anon;
REVOKE ALL ON FUNCTION public.reserve_food_analysis_request(uuid, date, int, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_food_analysis_request(uuid, date, int, text) TO service_role;

-- Food search: atomic daily quota (service_role only)
CREATE OR REPLACE FUNCTION public.reserve_food_search_request(
  p_user_id uuid,
  p_log_date date,
  p_daily_limit int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_count int;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid user';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('search:' || p_user_id::text || p_log_date::text));

  DELETE FROM public.food_search_requests
  WHERE log_date < p_log_date;

  SELECT count(*)::int INTO v_count
  FROM public.food_search_requests
  WHERE user_id = p_user_id
    AND log_date = p_log_date;

  IF p_daily_limit > 0 AND v_count >= p_daily_limit THEN
    RAISE EXCEPTION 'search_limit_reached';
  END IF;

  INSERT INTO public.food_search_requests (user_id, log_date)
  VALUES (p_user_id, p_log_date);
END;
$function$;

REVOKE ALL ON FUNCTION public.reserve_food_search_request(uuid, date, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserve_food_search_request(uuid, date, int) FROM anon;
REVOKE ALL ON FUNCTION public.reserve_food_search_request(uuid, date, int) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_food_search_request(uuid, date, int) TO service_role;
