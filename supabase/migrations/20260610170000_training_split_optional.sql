-- Optional training split: users can disable weekly split; coach uses request/history instead.

ALTER TABLE public.split_information
  ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true;

UPDATE public.split_information
SET enabled = true
WHERE enabled IS NULL;

CREATE OR REPLACE FUNCTION public._empty_split_schedule()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT '{
    "sun": [], "mon": [], "tue": [], "wed": [], "thu": [], "fri": [], "sat": []
  }'::jsonb;
$$;

CREATE OR REPLACE FUNCTION public._default_split_schedule()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT '{
    "sun": ["Core", "Cardio"],
    "mon": ["Chest", "Triceps"],
    "tue": ["Back", "Biceps"],
    "wed": ["Quads"],
    "thu": ["Chest", "Triceps"],
    "fri": ["Back", "Biceps"],
    "sat": ["Quads", "Glutes"]
  }'::jsonb;
$$;

CREATE OR REPLACE FUNCTION public.get_training_split()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_enabled boolean;
  v_schedule jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT enabled, schedule
  INTO v_enabled, v_schedule
  FROM public.split_information
  WHERE user_id = v_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'enabled', true,
      'schedule', public._default_split_schedule()
    );
  END IF;

  RETURN jsonb_build_object(
    'enabled', COALESCE(v_enabled, true),
    'schedule', CASE
      WHEN COALESCE(v_enabled, true) THEN COALESCE(v_schedule, public._default_split_schedule())
      ELSE public._empty_split_schedule()
    END
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_training_split(p_schedule jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  INSERT INTO public.split_information (user_id, enabled, schedule, updated_at)
  VALUES (v_user_id, true, p_schedule, now())
  ON CONFLICT (user_id) DO UPDATE
    SET enabled = true,
        schedule = EXCLUDED.schedule,
        updated_at = now();

  PERFORM public.enqueue_coach_context_sync();

  RETURN public.get_training_split();
END;
$function$;

CREATE OR REPLACE FUNCTION public.remove_training_split()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  INSERT INTO public.split_information (user_id, enabled, schedule, updated_at)
  VALUES (v_user_id, false, public._empty_split_schedule(), now())
  ON CONFLICT (user_id) DO UPDATE
    SET enabled = false,
        schedule = public._empty_split_schedule(),
        updated_at = now();

  PERFORM public.enqueue_coach_context_sync();

  RETURN public.get_training_split();
END;
$function$;

GRANT EXECUTE ON FUNCTION public.remove_training_split() TO authenticated;
