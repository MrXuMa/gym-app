import { supabase } from '@/lib/supabase';

const BENCH_EXERCISE_PATTERN = /bench/i;

function toDateKey(iso: string) {
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function startOfWeek(date: Date) {
  const start = new Date(date);
  const day = start.getDay();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - day);
  return start;
}

function epleyOneRepMax(weight: number, reps: number) {
  if (reps <= 0 || weight <= 0) {
    return 0;
  }

  if (reps === 1) {
    return weight;
  }

  return Math.round(weight * (1 + reps / 30));
}

function computeStreak(workoutDates: string[]) {
  if (workoutDates.length === 0) {
    return 0;
  }

  const dayKeys = new Set(workoutDates.map(toDateKey));
  const sortedKeys = [...dayKeys].sort((a, b) => {
    const [ay, am, ad] = a.split('-').map(Number);
    const [by, bm, bd] = b.split('-').map(Number);
    return new Date(by, bm, bd).getTime() - new Date(ay, am, ad).getTime();
  });

  const mostRecent = sortedKeys[0];
  const [y, m, d] = mostRecent.split('-').map(Number);
  let cursor = new Date(y, m, d);
  cursor.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (cursor.getTime() < yesterday.getTime()) {
    return 0;
  }

  let streak = 0;

  while (dayKeys.has(toDateKey(cursor.toISOString()))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export type HomeMetrics = {
  streakDays: number;
  workoutsThisWeek: number;
  currentWeight: number | null;
  weightTrendLabel: 'Gain' | 'Lose' | 'Maintain' | '—';
  predictedMax: number | null;
  predictedLiftName: string;
};

export async function fetchHomeMetrics(): Promise<HomeMetrics> {
  const defaultMetrics: HomeMetrics = {
    streakDays: 0,
    workoutsThisWeek: 0,
    currentWeight: null,
    weightTrendLabel: '—',
    predictedMax: null,
    predictedLiftName: 'Bench Press',
  };

  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError || !userResult.user) {
    return defaultMetrics;
  }

  const userId = userResult.user.id;
  const weekStart = startOfWeek(new Date());

  const [profileResult, workoutsResult, exercisesResult] = await Promise.all([
    supabase.from('profiles_with_age').select('weight').eq('id', userId).maybeSingle(),
    supabase
      .from('user_workouts')
      .select('id, date')
      .eq('status', 'completed')
      .order('date', { ascending: false }),
    supabase.from('exercises').select('id, name'),
  ]);

  const workoutDates = (workoutsResult.data ?? [])
    .map((workout) => workout.date)
    .filter((date): date is string => Boolean(date));

  const workoutsThisWeek = workoutDates.filter((date) => new Date(date) >= weekStart).length;
  const streakDays = computeStreak(workoutDates);

  const currentWeight = profileResult.data?.weight ?? null;

  let predictedMax: number | null = null;
  let predictedLiftName = 'Bench Press';

  const benchExercise = (exercisesResult.data ?? []).find((exercise) =>
    BENCH_EXERCISE_PATTERN.test(exercise.name),
  );

  if (benchExercise) {
    predictedLiftName = benchExercise.name;

    const { data: logs } = await supabase
      .from('workout_logs')
      .select('weight, reps')
      .eq('exercise_id', benchExercise.id)
      .not('weight', 'is', null);

    let bestEstimate = 0;

    for (const log of logs ?? []) {
      if (log.weight == null || log.reps == null) {
        continue;
      }

      const estimate = epleyOneRepMax(log.weight, log.reps);
      if (estimate > bestEstimate) {
        bestEstimate = estimate;
      }
    }

    predictedMax = bestEstimate > 0 ? bestEstimate : null;
  }

  return {
    streakDays,
    workoutsThisWeek,
    currentWeight,
    weightTrendLabel: '—',
    predictedMax,
    predictedLiftName,
  };
}
