-- food_analysis_requests is only used by the analyze-food edge function (service_role).
-- Client INSERT/UPDATE allowed rate-limit bypass and scan blocking.
DROP POLICY IF EXISTS food_analysis_requests_insert_own ON public.food_analysis_requests;
DROP POLICY IF EXISTS food_analysis_requests_update_own ON public.food_analysis_requests;
DROP POLICY IF EXISTS food_analysis_requests_select_own ON public.food_analysis_requests;

REVOKE ALL ON public.food_analysis_requests FROM authenticated;
REVOKE ALL ON public.food_analysis_requests FROM anon;

-- Rate-limit accounting for search-food edge function (service_role only).
CREATE TABLE IF NOT EXISTS public.food_search_requests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS food_search_requests_user_date_idx
  ON public.food_search_requests (user_id, log_date);

ALTER TABLE public.food_search_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.food_search_requests FROM authenticated;
REVOKE ALL ON public.food_search_requests FROM anon;
