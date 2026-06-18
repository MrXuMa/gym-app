-- Security hardening: lock down privileged RPCs, fix security-invoker view, add FK indexes.

-- profiles_with_age must respect caller RLS (not bypass via SECURITY DEFINER view).
DROP VIEW IF EXISTS public.profiles_with_age;

CREATE VIEW public.profiles_with_age
WITH (security_invoker = true) AS
SELECT
  id,
  email,
  username,
  first_name,
  last_name,
  birthday,
  EXTRACT(year FROM age(CURRENT_DATE::timestamp with time zone, birthday::timestamp with time zone))::integer AS age,
  weight,
  height,
  goals,
  created_at,
  updated_at,
  lifting_level
FROM public.profiles;

GRANT SELECT ON public.profiles_with_age TO authenticated;
GRANT SELECT ON public.profiles_with_age TO service_role;

-- Worker-only: rebuilding another user's coach context must not be callable from the client API.
REVOKE ALL ON FUNCTION public.rebuild_coach_context(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rebuild_coach_context(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.rebuild_coach_context(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rebuild_coach_context(uuid) TO service_role;

-- Authenticated-only RPCs (login still uses get_email_for_username before a session exists).
REVOKE EXECUTE ON FUNCTION public.enqueue_coach_context_sync() FROM anon;
REVOKE EXECUTE ON FUNCTION public.accept_coach_template_job(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_body_weight_log(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_training_split() FROM anon;
REVOKE EXECUTE ON FUNCTION public.remove_training_split() FROM anon;
REVOKE EXECUTE ON FUNCTION public.request_coach_template_job(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_profile_goals(text[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_profile_lifting_level(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_profile_weight(numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.upsert_training_split(jsonb) FROM anon;

GRANT EXECUTE ON FUNCTION public.enqueue_coach_context_sync() TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_coach_template_job(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_body_weight_log(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_training_split() TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_training_split() TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_coach_template_job(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_profile_goals(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_profile_lifting_level(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_profile_weight(numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_training_split(jsonb) TO authenticated;

-- coach_user_sync_state: RLS enabled, no policies = deny for anon/authenticated (service role only).
COMMENT ON TABLE public.coach_user_sync_state IS 'Internal worker queue; no client policies by design.';

-- FK covering indexes flagged by Supabase advisors.
CREATE INDEX IF NOT EXISTS coach_template_jobs_saved_template_id_idx
  ON public.coach_template_jobs (saved_template_id);

CREATE INDEX IF NOT EXISTS workout_templates_coach_job_id_idx
  ON public.workout_templates (coach_job_id);

-- RLS initplan optimization on food tables (hot paths).
DROP POLICY IF EXISTS nutrition_logs_select_own ON public.nutrition_logs;
CREATE POLICY nutrition_logs_select_own ON public.nutrition_logs
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS nutrition_logs_insert_own ON public.nutrition_logs;
CREATE POLICY nutrition_logs_insert_own ON public.nutrition_logs
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS nutrition_logs_update_own ON public.nutrition_logs;
CREATE POLICY nutrition_logs_update_own ON public.nutrition_logs
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS nutrition_logs_delete_own ON public.nutrition_logs;
CREATE POLICY nutrition_logs_delete_own ON public.nutrition_logs
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS food_analysis_requests_select_own ON public.food_analysis_requests;
CREATE POLICY food_analysis_requests_select_own ON public.food_analysis_requests
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS food_analysis_requests_insert_own ON public.food_analysis_requests;
CREATE POLICY food_analysis_requests_insert_own ON public.food_analysis_requests
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS food_analysis_requests_update_own ON public.food_analysis_requests;
CREATE POLICY food_analysis_requests_update_own ON public.food_analysis_requests
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- anon inherits PUBLIC; revoke default PUBLIC execute then re-grant explicitly.
REVOKE ALL ON FUNCTION public.accept_coach_template_job(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_body_weight_log(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enqueue_coach_context_sync() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_training_split() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remove_training_split() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.request_coach_template_job(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_profile_goals(text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_profile_lifting_level(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_profile_weight(numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_training_split(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_email_for_username(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_email_for_username(text) TO authenticated;
