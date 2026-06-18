-- Rebuild coach_context in the database (schema v4). Worker calls this via RPC.

CREATE OR REPLACE FUNCTION public.rebuild_coach_context(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_profile record;
  v_schedule jsonb;
  v_goals text[];
  v_name text;
  v_today_key text;
  v_tomorrow_key text;
  v_today_label text;
  v_tomorrow_label text;
  v_sessions jsonb;
  v_performance jsonb;
  v_avoid text[];
  v_ready text[];
  v_has_logs boolean;
  v_context jsonb;
  v_day_labels text[] := ARRAY['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  v_day_keys text[] := ARRAY['sun','mon','tue','wed','thu','fri','sat'];
BEGIN
  SELECT id, first_name, last_name, username, goals, age, weight, height
  INTO v_profile
  FROM public.profiles_with_age
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found for user %', p_user_id;
  END IF;

  v_goals := COALESCE(v_profile.goals, ARRAY[]::text[]);

  v_name := NULLIF(trim(COALESCE(v_profile.first_name, '') || ' ' || COALESCE(v_profile.last_name, '')), '');
  IF v_name IS NULL THEN
    v_name := COALESCE(NULLIF(trim(v_profile.username), ''), 'Athlete');
  END IF;

  SELECT schedule
  INTO v_schedule
  FROM public.split_information
  WHERE user_id = p_user_id
  LIMIT 1;

  v_schedule := COALESCE(v_schedule, '{
    "sun": ["Core", "Cardio"],
    "mon": ["Chest", "Triceps"],
    "tue": ["Back", "Biceps"],
    "wed": ["Quads", "Hamstrings"],
    "thu": ["Chest", "Triceps"],
    "fri": ["Back", "Biceps"],
    "sat": ["Quads", "Glutes"]
  }'::jsonb);

  v_today_key := v_day_keys[EXTRACT(DOW FROM current_date)::int + 1];
  v_tomorrow_key := v_day_keys[EXTRACT(DOW FROM current_date + 1)::int + 1];
  v_today_label := v_day_labels[EXTRACT(DOW FROM current_date)::int + 1];
  v_tomorrow_label := v_day_labels[EXTRACT(DOW FROM current_date + 1)::int + 1];

  WITH week_workouts AS (
    SELECT uw.id, uw.title, uw.date, uw.ended_at, uw.started_at
    FROM public.user_workouts uw
    WHERE uw.user_id = p_user_id
      AND uw.status = 'completed'
      AND COALESCE(uw.date, uw.ended_at::date, uw.started_at::date) >= (current_date - 7)
    ORDER BY COALESCE(uw.date, uw.ended_at::date, uw.started_at::date) DESC
    LIMIT 10
  ),
  exercise_sets AS (
    SELECT
      w.id AS workout_id,
      w.title,
      COALESCE(w.date, w.ended_at::date, w.started_at::date) AS session_date,
      e.name AS exercise_name,
      e.target_muscle,
      wl.reps,
      wl.weight,
      wl.set_number
    FROM week_workouts w
    JOIN public.workout_logs wl ON wl.workout_id = w.id
    JOIN public.exercises e ON e.id = wl.exercise_id
    WHERE wl.reps IS NOT NULL AND wl.reps > 0
  ),
  session_rows AS (
    SELECT
      to_char(session_date, 'YYYY-MM-DD') AS date,
      COALESCE(NULLIF(trim(title), ''), 'Workout') AS title,
      jsonb_agg(
        jsonb_build_object(
          'name', exercise_name,
          'muscle', target_muscle,
          'sets', sets
        )
        ORDER BY exercise_name
      ) AS exercises
    FROM (
      SELECT
        session_date,
        title,
        exercise_name,
        target_muscle,
        jsonb_agg(
          jsonb_build_object(
            'reps', reps,
            'weight', CASE WHEN weight IS NOT NULL AND weight >= 0 THEN round(weight::numeric, 1) ELSE NULL END
          )
          ORDER BY set_number
        ) AS sets
      FROM exercise_sets
      GROUP BY session_date, title, exercise_name, target_muscle
    ) grouped
    GROUP BY session_date, title
    ORDER BY session_date DESC
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(s)), '[]'::jsonb)
  INTO v_sessions
  FROM session_rows s;

  v_has_logs := jsonb_array_length(COALESCE(v_sessions, '[]'::jsonb)) > 0;

  WITH week_workouts AS (
    SELECT uw.id
    FROM public.user_workouts uw
    WHERE uw.user_id = p_user_id
      AND uw.status = 'completed'
      AND COALESCE(uw.date, uw.ended_at::date, uw.started_at::date) >= (current_date - 7)
  ),
  ranked AS (
    SELECT
      e.name AS exercise_name,
      wl.weight,
      wl.reps,
      CASE
        WHEN wl.reps = 1 THEN wl.weight
        ELSE wl.weight * (1 + wl.reps::numeric / 30)
      END AS e1rm
    FROM week_workouts w
    JOIN public.workout_logs wl ON wl.workout_id = w.id
    JOIN public.exercises e ON e.id = wl.exercise_id
    WHERE wl.weight IS NOT NULL AND wl.weight > 0
      AND wl.reps IS NOT NULL AND wl.reps > 0
  ),
  best AS (
    SELECT DISTINCT ON (lower(exercise_name))
      exercise_name,
      round(weight::numeric, 1) AS weight_lbs,
      reps::int AS reps,
      e1rm
    FROM ranked
    ORDER BY lower(exercise_name), e1rm DESC
  )
  SELECT COALESCE(
    jsonb_object_agg(
      exercise_name,
      jsonb_build_object('weight_lbs', weight_lbs, 'reps', reps)
    ),
    '{}'::jsonb
  )
  INTO v_performance
  FROM (
    SELECT * FROM best ORDER BY e1rm DESC LIMIT 30
  ) top_perf;

  SELECT COALESCE(array_agg(DISTINCT e.target_muscle) FILTER (WHERE e.target_muscle IS NOT NULL), ARRAY[]::text[])
  INTO v_avoid
  FROM public.user_workouts uw
  JOIN public.workout_logs wl ON wl.workout_id = uw.id
  JOIN public.exercises e ON e.id = wl.exercise_id
  WHERE uw.user_id = p_user_id
    AND uw.status = 'completed'
    AND COALESCE(uw.date, uw.ended_at::date, uw.started_at::date) >= (current_date - 2);

  SELECT COALESCE(array_agg(muscle), ARRAY[]::text[])
  INTO v_ready
  FROM (
    SELECT DISTINCT trim(value) AS muscle
    FROM jsonb_array_elements_text(COALESCE(v_schedule -> v_today_key, '[]'::jsonb)) AS value
    WHERE trim(value) <> ''
      AND NOT (trim(value) = ANY (COALESCE(v_avoid, ARRAY[]::text[])))
  ) today_ready;

  v_context := jsonb_build_object(
    'schema_version', 4,
    'updated_at', now(),
    'goals', to_jsonb(v_goals),
    'athlete', jsonb_build_object(
      'name', v_name,
      'age', v_profile.age,
      'weight_lbs', CASE WHEN v_profile.weight IS NOT NULL THEN round(v_profile.weight::numeric, 1) ELSE NULL END,
      'height_in', CASE WHEN v_profile.height IS NOT NULL THEN round(v_profile.height::numeric, 1) ELSE NULL END
    ),
    'split', jsonb_build_object(
      'week', v_schedule,
      'today', jsonb_build_object(
        'day', v_today_label,
        'muscles', COALESCE(v_schedule -> v_today_key, '[]'::jsonb)
      ),
      'tomorrow', jsonb_build_object(
        'day', v_tomorrow_label,
        'muscles', COALESCE(v_schedule -> v_tomorrow_key, '[]'::jsonb)
      )
    ),
    'recovery', jsonb_build_object(
      'avoid', to_jsonb(COALESCE(v_avoid, ARRAY[]::text[])),
      'ready', to_jsonb(COALESCE(v_ready, ARRAY[]::text[]))
    ),
    'training_data', jsonb_build_object(
      'has_week_logs', v_has_logs,
      'sessions', COALESCE(v_sessions, '[]'::jsonb),
      'performance_by_exercise', COALESCE(v_performance, '{}'::jsonb)
    )
  );

  INSERT INTO public.coach_context (user_id, context, version, updated_at)
  VALUES (p_user_id, v_context, 4, now())
  ON CONFLICT (user_id) DO UPDATE
    SET context = EXCLUDED.context,
        version = 4,
        updated_at = now();
END;
$function$;

REVOKE ALL ON FUNCTION public.rebuild_coach_context(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rebuild_coach_context(uuid) TO service_role;
