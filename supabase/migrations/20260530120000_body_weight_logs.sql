-- Body weight history (for trend tracking in coach context + UI).

CREATE TABLE IF NOT EXISTS public.body_weight_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  weight numeric NOT NULL CHECK (weight > 0 AND weight <= 1000),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'backfill'))
);

CREATE INDEX IF NOT EXISTS body_weight_logs_user_recorded_idx
  ON public.body_weight_logs (user_id, recorded_at DESC);

ALTER TABLE public.body_weight_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS body_weight_logs_select_own ON public.body_weight_logs;
DROP POLICY IF EXISTS body_weight_logs_insert_own ON public.body_weight_logs;

CREATE POLICY body_weight_logs_select_own ON public.body_weight_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY body_weight_logs_insert_own ON public.body_weight_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.body_weight_logs IS
  'Body weight history; one row per user-initiated update. Used for coach context weight_trend + home widget sparkline.';

-- Backfill: seed one log row per existing user from their current profile weight.
INSERT INTO public.body_weight_logs (user_id, weight, recorded_at, source)
SELECT p.id, p.weight, p.updated_at, 'backfill'
FROM public.profiles p
WHERE p.weight IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.body_weight_logs l WHERE l.user_id = p.id
  );

-- Update the existing RPC to also append a log row on every successful update.
CREATE OR REPLACE FUNCTION public.update_profile_weight(p_weight numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_normalized numeric;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_weight IS NULL THEN
    RAISE EXCEPTION 'weight required';
  END IF;

  IF p_weight <= 0 THEN
    RAISE EXCEPTION 'weight must be greater than 0';
  END IF;

  IF p_weight > 1000 THEN
    RAISE EXCEPTION 'weight must be 1000 or less';
  END IF;

  v_normalized := round(p_weight::numeric, 1);

  UPDATE public.profiles
  SET weight = v_normalized,
      updated_at = now()
  WHERE id = v_user_id;

  INSERT INTO public.body_weight_logs (user_id, weight, source)
  VALUES (v_user_id, v_normalized, 'manual');

  PERFORM public.enqueue_coach_context_sync();

  RETURN v_normalized;
END;
$$;

REVOKE ALL ON FUNCTION public.update_profile_weight(numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_profile_weight(numeric) TO authenticated;
