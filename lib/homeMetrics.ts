import { supabase } from '@/lib/supabase';
import { dayKeyEastern, countMealsInNutritionRows, mondayOfWeekContaining, weekDateKeysFromMonday } from '@/lib/foodAnalysis';
import {
  summarizeWeightLogs,
  weightTrendToLabel,
  WEIGHT_TREND_WINDOW_DAYS,
  type WeightTrendLabel,
} from '@/lib/weightTrend';
import { changeSinceLastEntry } from '@/lib/weightWidgetHelpers';
import { getTodaySplitMuscles, parseTrainingSplitResponse } from '@/lib/trainingSplit';

const BENCH_EXERCISE_PATTERN = /bench/i;

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

export type HomeMetrics = {
  workoutsThisWeek: number;
  currentWeight: number | null;
  weightTrendLabel: WeightTrendLabel;
  weightChangeLbs: number | null;
  weightTrendSpanDays: number | null;
  /** Latest log minus the previous log (entry-to-entry). */
  weightChangeSinceLastLbs: number | null;
  predictedMax: number | null;
  predictedLiftName: string;
  predictedLiftExerciseId: string | null;
  /** Full body-weight log series (oldest → newest), used by the graph widget. */
  weightHistory: WeightHistoryPoint[];
  /** Eastern calendar day nutrition totals (zeros when nothing logged). */
  todayCalories: number;
  todayProteinG: number;
  todayCarbsG: number;
  todayFatG: number;
  /** Today's split muscle groups, or null when no split is configured. */
  todaySplitMuscles: string[] | null;
  /** Meal entries logged Mon–Sun this week (Eastern calendar). */
  mealsThisWeek: number;
};

export type FetchHomeMetricsOptions = {
  predictedMaxExerciseId?: string | null;
};

export async function fetchHomeMetrics(
  options: FetchHomeMetricsOptions = {},
): Promise<HomeMetrics> {
  const defaultMetrics: HomeMetrics = {
    workoutsThisWeek: 0,
    currentWeight: null,
    weightTrendLabel: '—',
    weightChangeLbs: null,
    weightTrendSpanDays: null,
    weightChangeSinceLastLbs: null,
    predictedMax: null,
    predictedLiftName: 'Bench Press',
    predictedLiftExerciseId: null,
    weightHistory: [],
    todayCalories: 0,
    todayProteinG: 0,
    todayCarbsG: 0,
    todayFatG: 0,
    todaySplitMuscles: null,
    mealsThisWeek: 0,
  };

  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError || !userResult.user) {
    return defaultMetrics;
  }

  const userId = userResult.user.id;
  const weekStart = startOfWeek(new Date());
  const weightTrendCutoff = new Date();
  weightTrendCutoff.setDate(weightTrendCutoff.getDate() - WEIGHT_TREND_WINDOW_DAYS);

  const weekStartMonday = mondayOfWeekContaining(dayKeyEastern());
  const weekDateKeys = weekDateKeysFromMonday(weekStartMonday);

  const [profileResult, workoutsResult, exercisesResult, weightLogsResult, nutritionResult, splitResult, weekNutritionResult] =
    await Promise.all([
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
      .order('recorded_at', { ascending: true }),
    supabase
      .from('nutrition_logs')
      .select('kcal, protein_g, carbs_g, fat_g')
      .eq('log_date', dayKeyEastern())
      .maybeSingle(),
    supabase.rpc('get_training_split'),
    supabase.from('nutrition_logs').select('entries').in('log_date', weekDateKeys),
  ]);

  const workoutDates = (workoutsResult.data ?? [])
    .map((workout) => workout.date)
    .filter((date): date is string => Boolean(date));

  const workoutsThisWeek = workoutDates.filter((date) => new Date(date) >= weekStart).length;

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

  const allWeightLogs = (weightLogsResult.data ?? [])
    .map((row): WeightHistoryPoint => ({
      weight: Number(row.weight),
      recordedAt: row.recorded_at,
    }))
    .filter((row) => Number.isFinite(row.weight) && row.recordedAt);

  // Trend summary still uses the 90-day window so the trend label / weight widget
  // stay focused on recent change. The graph widget renders the full history.
  const recentWeightLogs = allWeightLogs.filter(
    (row) => new Date(row.recordedAt) >= weightTrendCutoff,
  );
  const weightSummary = summarizeWeightLogs(recentWeightLogs);
  const weightChangeSinceLastLbs = changeSinceLastEntry(allWeightLogs);

  const nutritionRow = nutritionResult.data;
  const todayCalories = Math.round(nutritionRow?.kcal ?? 0);
  const todayProteinG = Number(nutritionRow?.protein_g ?? 0);
  const todayCarbsG = Number(nutritionRow?.carbs_g ?? 0);
  const todayFatG = Number(nutritionRow?.fat_g ?? 0);
  const todaySplitMuscles = splitResult.error
    ? null
    : getTodaySplitMuscles(parseTrainingSplitResponse(splitResult.data));
  const mealsThisWeek = countMealsInNutritionRows(weekNutritionResult.data ?? []);

  return {
    workoutsThisWeek,
    currentWeight: weightSummary.latestLbs ?? currentWeight,
    weightTrendLabel: weightTrendToLabel(weightSummary.trend),
    weightChangeLbs: weightSummary.changeLbs,
    weightTrendSpanDays: weightSummary.spanDays,
    weightChangeSinceLastLbs,
    predictedMax,
    predictedLiftName,
    predictedLiftExerciseId,
    weightHistory: allWeightLogs,
    todayCalories,
    todayProteinG,
    todayCarbsG,
    todayFatG,
    todaySplitMuscles,
    mealsThisWeek,
  };
}
