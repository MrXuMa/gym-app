import { supabase } from '@/lib/supabase';
import {
  summarizeWeightLogs,
  weightTrendToLabel,
  WEIGHT_TREND_WINDOW_DAYS,
  type WeightTrendLabel,
} from '@/lib/weightTrend';

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

/**
 * Strict-today streak: returns the number of consecutive days (including today)
 * the user has logged a workout. If there is no workout dated today, the streak
 * is 0 — historical sequences without a tail at today do not count.
 *
 * Mirrors vm/coach-worker/contextMerge.js#computeStreak so the home widget and
 * coach context never disagree.
 */
function computeStreak(workoutDates: string[]) {
  if (workoutDates.length === 0) {
    return 0;
  }

  const dayKeys = new Set(workoutDates.map(toDateKey));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!dayKeys.has(toDateKey(today.toISOString()))) {
    return 0;
  }

  let streak = 0;
  const cursor = new Date(today);
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
  weightTrendLabel: WeightTrendLabel;
  weightChangeLbs: number | null;
  weightTrendSpanDays: number | null;
  predictedMax: number | null;
  predictedLiftName: string;
  predictedLiftExerciseId: string | null;
};

export type FetchHomeMetricsOptions = {
  predictedMaxExerciseId?: string | null;
};

export async function fetchHomeMetrics(
  options: FetchHomeMetricsOptions = {},
): Promise<HomeMetrics> {
  const defaultMetrics: HomeMetrics = {
    streakDays: 0,
    workoutsThisWeek: 0,
    currentWeight: null,
    weightTrendLabel: '—',
    weightChangeLbs: null,
    weightTrendSpanDays: null,
    predictedMax: null,
    predictedLiftName: 'Bench Press',
    predictedLiftExerciseId: null,
  };

  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError || !userResult.user) {
    return defaultMetrics;
  }

  const userId = userResult.user.id;
  const weekStart = startOfWeek(new Date());
  const weightCutoff = new Date();
  weightCutoff.setDate(weightCutoff.getDate() - WEIGHT_TREND_WINDOW_DAYS);

  const [profileResult, workoutsResult, exercisesResult, weightLogsResult] = await Promise.all([
    supabase.from('profiles_with_age').select('weight').eq('id', userId).maybeSingle(),
    supabase
      .from('user_workouts')
      .select('id, date')
      .eq('status', 'completed')
      .order('date', { ascending: false }),
    supabase.from('exercises').select('id, name'),
    supabase
      .from('body_weight_logs')
      .select('weight, recorded_at')
      .gte('recorded_at', weightCutoff.toISOString())
      .order('recorded_at', { ascending: true }),
  ]);

  const workoutDates = (workoutsResult.data ?? [])
    .map((workout) => workout.date)
    .filter((date): date is string => Boolean(date));

  const workoutsThisWeek = workoutDates.filter((date) => new Date(date) >= weekStart).length;
  const streakDays = computeStreak(workoutDates);

  const currentWeight = profileResult.data?.weight ?? null;

  const exercises = exercisesResult.data ?? [];
  const chosenId = options.predictedMaxExerciseId ?? null;

  const targetExercise =
    (chosenId ? exercises.find((exercise) => exercise.id === chosenId) : null) ??
    exercises.find((exercise) => BENCH_EXERCISE_PATTERN.test(exercise.name)) ??
    null;

  let predictedMax: number | null = null;
  let predictedLiftName = targetExercise?.name ?? 'Bench Press';
  const predictedLiftExerciseId = targetExercise?.id ?? null;

  if (targetExercise) {
    const { data: logs } = await supabase
      .from('workout_logs')
      .select('weight, reps')
      .eq('exercise_id', targetExercise.id)
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

  const weightSummary = summarizeWeightLogs(
    (weightLogsResult.data ?? []).map((row) => ({
      weight: Number(row.weight),
      recordedAt: row.recorded_at,
    })),
  );

  return {
    streakDays,
    workoutsThisWeek,
    currentWeight: weightSummary.latestLbs ?? currentWeight,
    weightTrendLabel: weightTrendToLabel(weightSummary.trend),
    weightChangeLbs: weightSummary.changeLbs,
    weightTrendSpanDays: weightSummary.spanDays,
    predictedMax,
    predictedLiftName,
    predictedLiftExerciseId,
  };
}
