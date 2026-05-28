import { supabase } from '@/lib/supabase';
import { enqueueCoachContextSync } from '@/lib/coachContextSync';
import {
  clearActiveWorkoutCache,
  clearWorkoutExerciseOrder,
  getActiveWorkoutCache,
  getWorkoutExerciseOrder,
  saveActiveWorkoutCache,
  saveWorkoutExerciseOrder,
  type ActiveWorkoutCache,
} from '@/lib/workoutSessionStorage';

function mergeExerciseOrder(idPool: string[], preferredOrder: string[] | null): string[] {
  if (!preferredOrder?.length) {
    return idPool;
  }

  const result: string[] = [];
  const pool = new Set(idPool);

  for (const id of preferredOrder) {
    if (pool.has(id) && !result.includes(id)) {
      result.push(id);
    }
  }

  for (const id of idPool) {
    if (!result.includes(id)) {
      result.push(id);
    }
  }

  return result;
}

export const MAX_SETS_PER_EXERCISE = 15;

export type ActiveWorkout = {
  id: string;
  startedAt: string;
};

export type WorkoutSetLog = {
  id: string;
  exerciseId: string;
  setNumber: number;
  reps: number | null;
  weight: number | null;
};

export type SessionExercise = {
  id: string;
  name: string;
  targetMuscle: string | null;
  sets: WorkoutSetLog[];
};

export type WorkoutSessionData = {
  workoutId: string;
  title: string;
  startedAt: string;
  exercises: SessionExercise[];
};

function getExerciseName(exercises: { name?: string } | { name?: string }[] | null) {
  if (Array.isArray(exercises)) {
    return exercises[0]?.name ?? 'Exercise';
  }

  return exercises?.name ?? 'Exercise';
}

function getExerciseMuscle(exercises: { target_muscle?: string } | { target_muscle?: string }[] | null) {
  if (Array.isArray(exercises)) {
    return exercises[0]?.target_muscle ?? null;
  }

  return exercises?.target_muscle ?? null;
}

export async function getActiveWorkoutSession(): Promise<ActiveWorkout | null> {
  const { data, error } = await supabase
    .from('user_workouts')
    .select('id, started_at')
    .eq('status', 'active')
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.started_at) {
    return null;
  }

  return { id: data.id, startedAt: data.started_at };
}

export async function createActiveWorkoutSession(title: string): Promise<ActiveWorkout> {
  const existing = await getActiveWorkoutSession();
  if (existing) {
    return existing;
  }

  const trimmedTitle = title.trim();
  if (!trimmedTitle) {
    throw new Error('Workout name is required.');
  }

  if (trimmedTitle.length > 80) {
    throw new Error('Workout name must be 80 characters or fewer.');
  }

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('user_workouts')
    .insert({
      title: trimmedTitle,
      date: now,
      status: 'active',
      started_at: now,
    })
    .select('id, started_at')
    .single();

  if (error) {
    throw error;
  }

  await saveActiveWorkoutCache({
    workoutId: data.id,
    startedAt: data.started_at,
    exerciseIds: [],
  });

  return { id: data.id, startedAt: data.started_at };
}

export async function removeExerciseFromSession(workoutId: string, exerciseId: string): Promise<void> {
  const { error: logsError } = await supabase
    .from('workout_logs')
    .delete()
    .eq('workout_id', workoutId)
    .eq('exercise_id', exerciseId);

  if (logsError) {
    throw logsError;
  }

  const cache = await getActiveWorkoutCache();
  if (cache?.workoutId === workoutId) {
    await saveActiveWorkoutCache({
      ...cache,
      exerciseIds: cache.exerciseIds.filter((id) => id !== exerciseId),
    });
  }
}

export async function cancelActiveWorkoutSession(workoutId: string): Promise<void> {
  const { error } = await supabase.from('user_workouts').delete().eq('id', workoutId);

  if (error) {
    throw error;
  }

  await clearActiveWorkoutCache();
  await clearWorkoutExerciseOrder(workoutId);
}

export async function reorderWorkoutExercises(workoutId: string, exerciseIds: string[]): Promise<void> {
  await saveWorkoutExerciseOrder(workoutId, exerciseIds);

  const cache = await getActiveWorkoutCache();
  if (cache?.workoutId === workoutId) {
    await saveActiveWorkoutCache({
      ...cache,
      exerciseIds,
    });
  }
}

export async function addExerciseToActiveSession(workoutId: string, exerciseId: string): Promise<void> {
  const cache = (await getActiveWorkoutCache()) ?? {
    workoutId,
    startedAt: new Date().toISOString(),
    exerciseIds: [],
  };

  if (cache.workoutId !== workoutId) {
    await saveActiveWorkoutCache({ workoutId, startedAt: cache.startedAt, exerciseIds: [exerciseId] });
    return;
  }

  if (cache.exerciseIds.includes(exerciseId)) {
    return;
  }

  await saveActiveWorkoutCache({
    ...cache,
    exerciseIds: [...cache.exerciseIds, exerciseId],
  });
}

export async function loadWorkoutSession(
  workoutId: string,
  options?: { useActiveCache?: boolean },
): Promise<WorkoutSessionData> {
  const useActiveCache = options?.useActiveCache ?? true;

  const [workoutResult, logsResult, exercisesResult, cache] = await Promise.all([
    supabase.from('user_workouts').select('id, title, started_at, status').eq('id', workoutId).single(),
    supabase
      .from('workout_logs')
      .select('id, exercise_id, set_number, reps, weight, exercises(name, target_muscle)')
      .eq('workout_id', workoutId)
      .order('set_number', { ascending: true }),
    supabase.from('exercises').select('id, name, target_muscle').order('name'),
    useActiveCache ? getActiveWorkoutCache() : Promise.resolve(null),
  ]);

  if (workoutResult.error) {
    throw workoutResult.error;
  }

  if (logsResult.error) {
    throw logsResult.error;
  }

  if (exercisesResult.error) {
    throw exercisesResult.error;
  }

  const exerciseMap = new Map(
    (exercisesResult.data ?? []).map((exercise) => [
      exercise.id,
      { id: exercise.id, name: exercise.name, targetMuscle: exercise.target_muscle },
    ]),
  );

  const setsByExercise = new Map<string, WorkoutSetLog[]>();

  for (const log of logsResult.data ?? []) {
    if (!log.exercise_id) {
      continue;
    }

    const sets = setsByExercise.get(log.exercise_id) ?? [];
    sets.push({
      id: log.id,
      exerciseId: log.exercise_id,
      setNumber: log.set_number,
      reps: log.reps,
      weight: log.weight,
    });
    setsByExercise.set(log.exercise_id, sets);
  }

  const cacheIds = useActiveCache && cache?.workoutId === workoutId ? cache.exerciseIds : [];
  const idPool: string[] = [];

  for (const exerciseId of cacheIds) {
    if (!idPool.includes(exerciseId)) {
      idPool.push(exerciseId);
    }
  }

  for (const exerciseId of setsByExercise.keys()) {
    if (!idPool.includes(exerciseId)) {
      idPool.push(exerciseId);
    }
  }

  const persistedOrder = await getWorkoutExerciseOrder(workoutId);
  const preferredOrder = cacheIds.length > 0 ? cacheIds : persistedOrder;
  const orderedExerciseIds = mergeExerciseOrder(idPool, preferredOrder);

  const exercises: SessionExercise[] = orderedExerciseIds.map((exerciseId) => {
    const meta = exerciseMap.get(exerciseId);
    const sets = setsByExercise.get(exerciseId) ?? [];

    return {
      id: exerciseId,
      name: meta?.name ?? getExerciseName(null),
      targetMuscle: meta?.targetMuscle ?? null,
      sets: sets.sort((a, b) => a.setNumber - b.setNumber),
    };
  });

  if (useActiveCache && workoutResult.data.status === 'active' && cache?.workoutId === workoutId) {
    await saveActiveWorkoutCache({
      workoutId,
      startedAt: workoutResult.data.started_at,
      exerciseIds: orderedExerciseIds,
    });
  }

  return {
    workoutId,
    title: workoutResult.data.title,
    startedAt: workoutResult.data.started_at,
    exercises,
  };
}

export async function addWorkoutSet(
  workoutId: string,
  exerciseId: string,
  reps: number | null,
  weight: number | null,
): Promise<WorkoutSetLog> {
  const { data: existing, error: countError } = await supabase
    .from('workout_logs')
    .select('set_number')
    .eq('workout_id', workoutId)
    .eq('exercise_id', exerciseId)
    .order('set_number', { ascending: false })
    .limit(1);

  if (countError) {
    throw countError;
  }

  const nextSetNumber = (existing?.[0]?.set_number ?? 0) + 1;

  if (nextSetNumber > MAX_SETS_PER_EXERCISE) {
    throw new Error(`You can log up to ${MAX_SETS_PER_EXERCISE} sets per exercise.`);
  }

  const { data, error } = await supabase
    .from('workout_logs')
    .insert({
      workout_id: workoutId,
      exercise_id: exerciseId,
      sets: 1,
      set_number: nextSetNumber,
      reps,
      weight,
    })
    .select('id, exercise_id, set_number, reps, weight')
    .single();

  if (error) {
    throw error;
  }

  return {
    id: data.id,
    exerciseId: data.exercise_id,
    setNumber: data.set_number,
    reps: data.reps,
    weight: data.weight,
  };
}

export async function updateWorkoutSet(
  logId: string,
  reps: number | null,
  weight: number | null,
): Promise<void> {
  const { error } = await supabase.from('workout_logs').update({ reps, weight }).eq('id', logId);

  if (error) {
    throw error;
  }
}

async function renumberExerciseSets(workoutId: string, exerciseId: string): Promise<WorkoutSetLog[]> {
  const { data: remaining, error: fetchError } = await supabase
    .from('workout_logs')
    .select('id, exercise_id, set_number, reps, weight')
    .eq('workout_id', workoutId)
    .eq('exercise_id', exerciseId)
    .order('set_number', { ascending: true });

  if (fetchError) {
    throw fetchError;
  }

  const renumbered: WorkoutSetLog[] = [];

  for (let index = 0; index < (remaining ?? []).length; index += 1) {
    const row = remaining![index];
    const newSetNumber = index + 1;

    if (row.set_number !== newSetNumber) {
      const { error: updateError } = await supabase
        .from('workout_logs')
        .update({ set_number: newSetNumber })
        .eq('id', row.id);

      if (updateError) {
        throw updateError;
      }
    }

    renumbered.push({
      id: row.id,
      exerciseId: row.exercise_id,
      setNumber: newSetNumber,
      reps: row.reps,
      weight: row.weight,
    });
  }

  return renumbered;
}

export async function deleteExerciseSet(
  workoutId: string,
  exerciseId: string,
  logId: string,
): Promise<WorkoutSetLog[]> {
  const { error } = await supabase.from('workout_logs').delete().eq('id', logId);

  if (error) {
    throw error;
  }

  return renumberExerciseSets(workoutId, exerciseId);
}

function hasLoggedReps(reps: number | null): boolean {
  return reps != null && Number.isFinite(reps) && reps > 0;
}

async function pruneIncompleteWorkoutSets(workoutId: string): Promise<void> {
  const { data: logs, error } = await supabase
    .from('workout_logs')
    .select('id, exercise_id, reps')
    .eq('workout_id', workoutId);

  if (error) {
    throw error;
  }

  const incomplete = (logs ?? []).filter((row) => !hasLoggedReps(row.reps));
  if (incomplete.length === 0) {
    return;
  }

  const { error: deleteError } = await supabase
    .from('workout_logs')
    .delete()
    .in(
      'id',
      incomplete.map((row) => row.id),
    );

  if (deleteError) {
    throw deleteError;
  }

  const exerciseIds = [...new Set(incomplete.map((row) => row.exercise_id))];
  for (const exerciseId of exerciseIds) {
    await renumberExerciseSets(workoutId, exerciseId);
  }
}

export async function endActiveWorkoutSession(workoutId: string, startedAt: string): Promise<void> {
  await pruneIncompleteWorkoutSets(workoutId);

  const endedAt = new Date();
  const started = new Date(startedAt);
  const durationSeconds = Math.max(0, Math.floor((endedAt.getTime() - started.getTime()) / 1000));
  const endedIso = endedAt.toISOString();

  const { error } = await supabase
    .from('user_workouts')
    .update({
      status: 'completed',
      ended_at: endedIso,
      date: endedIso,
      duration_seconds: durationSeconds,
    })
    .eq('id', workoutId)
    .eq('status', 'active');

  if (error) {
    throw error;
  }

  const cache = await getActiveWorkoutCache();
  if (cache?.workoutId === workoutId && cache.exerciseIds.length > 0) {
    await saveWorkoutExerciseOrder(workoutId, cache.exerciseIds);
  }

  await clearActiveWorkoutCache();

  void enqueueCoachContextSync();
}

export function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
