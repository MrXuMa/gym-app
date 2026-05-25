import { enqueueCoachContextSync } from '@/lib/coachContextSync';
import { resolveWorkoutTitle } from '@/lib/workoutDisplay';
import { createActiveWorkoutSession } from '@/lib/workoutSession';
import { clearActiveWorkoutCache, getActiveWorkoutCache } from '@/lib/workoutSessionStorage';
import { supabase } from '@/lib/supabase';

export type WorkoutExerciseSummary = {
  exerciseId: string;
  name: string;
  targetMuscle: string | null;
};

export type WorkoutListItem = {
  id: string;
  title: string;
  date: string | null;
  durationSeconds: number | null;
  exercises: WorkoutExerciseSummary[];
};

/** Starts a new active workout and returns its id. */
export async function startWorkoutSession(title: string) {
  const session = await createActiveWorkoutSession(resolveWorkoutTitle(title));
  return session.id;
}

export async function deleteWorkout(workoutId: string) {
  const { error } = await supabase.from('user_workouts').delete().eq('id', workoutId);

  if (error) {
    throw error;
  }

  const cache = await getActiveWorkoutCache();
  if (cache?.workoutId === workoutId) {
    await clearActiveWorkoutCache();
  }

  void enqueueCoachContextSync();
}

type ExerciseRelation = { name?: string | null; target_muscle?: string | null } | null;

function readExerciseRelation(value: unknown): ExerciseRelation {
  if (Array.isArray(value)) {
    return (value[0] as ExerciseRelation) ?? null;
  }
  return (value as ExerciseRelation) ?? null;
}

/**
 * Fetches all completed workouts for the signed-in user, including the ordered
 * list of exercises performed in each session (names only — set/rep/weight detail
 * is intentionally omitted from the list view to keep cards short).
 */
export async function fetchCompletedWorkouts(): Promise<WorkoutListItem[]> {
  const { data: workoutRows, error: workoutError } = await supabase
    .from('user_workouts')
    .select('id, title, date, duration_seconds')
    .eq('status', 'completed')
    .order('date', { ascending: false });

  if (workoutError) {
    throw workoutError;
  }

  const workouts = workoutRows ?? [];
  if (workouts.length === 0) {
    return [];
  }

  const workoutIds = workouts.map((workout) => workout.id);

  const { data: logRows, error: logError } = await supabase
    .from('workout_logs')
    .select('workout_id, exercise_id, set_number, exercises(name, target_muscle)')
    .in('workout_id', workoutIds)
    .order('set_number', { ascending: true });

  if (logError) {
    throw logError;
  }

  type ExerciseAccumulator = {
    name: string;
    targetMuscle: string | null;
    firstSeenAt: number;
  };

  const byWorkout = new Map<string, Map<string, ExerciseAccumulator>>();

  (logRows ?? []).forEach((log, index) => {
    if (!log.workout_id || !log.exercise_id) {
      return;
    }

    let workoutMap = byWorkout.get(log.workout_id);
    if (!workoutMap) {
      workoutMap = new Map();
      byWorkout.set(log.workout_id, workoutMap);
    }

    if (workoutMap.has(log.exercise_id)) {
      return;
    }

    const relation = readExerciseRelation(log.exercises);
    workoutMap.set(log.exercise_id, {
      name: relation?.name?.trim() || 'Exercise',
      targetMuscle: relation?.target_muscle?.trim() || null,
      firstSeenAt: index,
    });
  });

  return workouts.map((workout) => {
    const workoutMap = byWorkout.get(workout.id);
    const exercises: WorkoutExerciseSummary[] = workoutMap
      ? Array.from(workoutMap.entries())
          .sort(([, a], [, b]) => a.firstSeenAt - b.firstSeenAt)
          .map(([exerciseId, entry]) => ({
            exerciseId,
            name: entry.name,
            targetMuscle: entry.targetMuscle,
          }))
      : [];

    return {
      id: workout.id,
      title: workout.title,
      date: workout.date,
      durationSeconds: workout.duration_seconds,
      exercises,
    };
  });
}
