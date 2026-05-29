-- Raw scan results live only in the HTTP response; confirmed meals are in nutrition_logs.
DROP TABLE IF EXISTS public.food_analysis_results;

-- Reset request log and track quota per calendar day (Eastern), not rolling 24h.
TRUNCATE TABLE public.food_analysis_requests;

ALTER TABLE public.food_analysis_requests
  ADD COLUMN IF NOT EXISTS log_date date;

ALTER TABLE public.food_analysis_requests
  ALTER COLUMN log_date SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_food_analysis_requests_user_log_date
  ON public.food_analysis_requests (user_id, log_date);

COMMENT ON COLUMN public.food_analysis_requests.log_date IS
  'Calendar day (America/New_York) for daily rate-limit accounting; rows older than today are purged.';
