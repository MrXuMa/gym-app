-- Allow users to update their body weight from the app; refresh coach context.

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

  PERFORM public.enqueue_coach_context_sync();

  RETURN v_normalized;
END;
$$;

REVOKE ALL ON FUNCTION public.update_profile_weight(numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_profile_weight(numeric) TO authenticated;

COMMENT ON FUNCTION public.update_profile_weight(numeric) IS
  'Updates the signed-in user''s body weight (lbs) and enqueues a coach context rebuild. Accepts 0 < weight <= 1000.';
