-- Security Advisor fixes: search_path hardening + lock down internal/service-only RPCs.

-- 1. Immutable / trigger helpers: pin search_path
ALTER FUNCTION public._empty_split_schedule() SET search_path = public;
ALTER FUNCTION public._default_split_schedule() SET search_path = public;
ALTER FUNCTION public.default_training_split_schedule() SET search_path = public;
ALTER FUNCTION public._lifting_split_muscles(jsonb) SET search_path = public;
ALTER FUNCTION public.profile_goals_are_valid(text[]) SET search_path = public;

CREATE OR REPLACE FUNCTION public.set_workout_templates_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- 2. Bulletin helpers: trigger-only, not client RPCs
REVOKE ALL ON FUNCTION public.active_bulletin_task_count(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.active_bulletin_task_count(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.active_bulletin_task_count(uuid) FROM authenticated;

REVOKE ALL ON FUNCTION public.bulletin_tasks_limit_check() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bulletin_tasks_limit_check() FROM anon;
REVOKE ALL ON FUNCTION public.bulletin_tasks_limit_check() FROM authenticated;

-- 3. Food quota RPCs: edge functions only (service_role)
REVOKE ALL ON FUNCTION public.reserve_food_analysis_request(uuid, date, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserve_food_analysis_request(uuid, date, integer, text) FROM anon;
REVOKE ALL ON FUNCTION public.reserve_food_analysis_request(uuid, date, integer, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_food_analysis_request(uuid, date, integer, text) TO service_role;

REVOKE ALL ON FUNCTION public.reserve_food_search_request(uuid, date, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserve_food_search_request(uuid, date, integer) FROM anon;
REVOKE ALL ON FUNCTION public.reserve_food_search_request(uuid, date, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_food_search_request(uuid, date, integer) TO service_role;

-- 4. Username login lookup: pre-auth only (anon). Signed-in users don't need this RPC.
REVOKE ALL ON FUNCTION public.get_email_for_username(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_email_for_username(text) TO anon;
