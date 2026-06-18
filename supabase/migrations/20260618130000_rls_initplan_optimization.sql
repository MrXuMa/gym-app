-- Optimize RLS policies: evaluate auth.uid() once per query (initplan), not per row.

-- body_weight_logs
DROP POLICY IF EXISTS body_weight_logs_select_own ON public.body_weight_logs;
CREATE POLICY body_weight_logs_select_own ON public.body_weight_logs
  FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS body_weight_logs_insert_own ON public.body_weight_logs;
CREATE POLICY body_weight_logs_insert_own ON public.body_weight_logs
  FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

-- coach_context
DROP POLICY IF EXISTS coach_context_select_own ON public.coach_context;
CREATE POLICY coach_context_select_own ON public.coach_context
  FOR SELECT
  USING ((select auth.uid()) = user_id);

-- coach_template_jobs
DROP POLICY IF EXISTS coach_template_jobs_select_own ON public.coach_template_jobs;
CREATE POLICY coach_template_jobs_select_own ON public.coach_template_jobs
  FOR SELECT
  USING ((select auth.uid()) = user_id);

-- split_information
DROP POLICY IF EXISTS split_information_select_own ON public.split_information;
CREATE POLICY split_information_select_own ON public.split_information
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS split_information_insert_own ON public.split_information;
CREATE POLICY split_information_insert_own ON public.split_information
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS split_information_update_own ON public.split_information;
CREATE POLICY split_information_update_own ON public.split_information
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- workout_templates
DROP POLICY IF EXISTS workout_templates_select ON public.workout_templates;
CREATE POLICY workout_templates_select ON public.workout_templates
  FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS workout_templates_insert ON public.workout_templates;
CREATE POLICY workout_templates_insert ON public.workout_templates
  FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS workout_templates_update ON public.workout_templates;
CREATE POLICY workout_templates_update ON public.workout_templates
  FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS workout_templates_delete ON public.workout_templates;
CREATE POLICY workout_templates_delete ON public.workout_templates
  FOR DELETE
  USING ((select auth.uid()) = user_id);
