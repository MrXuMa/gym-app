-- Personal training goals on profiles (up to 3, max 10 words each).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS goals text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_goals_count_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_goals_count_check
  CHECK (cardinality(goals) <= 3);

CREATE OR REPLACE FUNCTION public.profile_goals_are_valid(p_goals text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    bool_and(
      char_length(trim(g)) >= 1
      AND cardinality(regexp_split_to_array(trim(g), '\s+')) <= 10
    ),
    true
  )
  FROM unnest(COALESCE(p_goals, ARRAY[]::text[])) AS g;
$$;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_goals_words_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_goals_words_check
  CHECK (public.profile_goals_are_valid(goals));

DROP VIEW IF EXISTS public.profiles_with_age;

CREATE VIEW public.profiles_with_age
WITH (security_invoker = true)
AS
SELECT
  id,
  email,
  username,
  first_name,
  last_name,
  birthday,
  EXTRACT(
    year FROM age(CURRENT_DATE::timestamp with time zone, birthday::timestamp with time zone)
  )::integer AS age,
  weight,
  height,
  goals,
  created_at,
  updated_at
FROM public.profiles;

GRANT SELECT ON public.profiles_with_age TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.update_profile_goals(p_goals text[])
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized text[] := ARRAY[]::text[];
  g text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_goals IS NULL THEN
    RAISE EXCEPTION 'goals required';
  END IF;

  FOREACH g IN ARRAY p_goals LOOP
    g := trim(g);
    IF g = '' THEN
      CONTINUE;
    END IF;

    IF cardinality(regexp_split_to_array(g, '\s+')) > 10 THEN
      RAISE EXCEPTION 'each goal must be at most 10 words';
    END IF;

    normalized := array_append(normalized, g);
  END LOOP;

  IF cardinality(normalized) < 1 THEN
    RAISE EXCEPTION 'add at least one goal';
  END IF;

  IF cardinality(normalized) > 3 THEN
    RAISE EXCEPTION 'at most 3 goals allowed';
  END IF;

  UPDATE public.profiles
  SET goals = normalized,
      updated_at = now()
  WHERE id = auth.uid();

  PERFORM public.enqueue_coach_context_sync();

  RETURN normalized;
END;
$$;

REVOKE ALL ON FUNCTION public.update_profile_goals(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_profile_goals(text[]) TO authenticated;

COMMENT ON COLUMN public.profiles.goals IS 'Up to 3 personal training goals; each goal max 10 words.';
