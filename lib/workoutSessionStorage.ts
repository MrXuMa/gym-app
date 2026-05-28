import AsyncStorage from '@react-native-async-storage/async-storage';

const ACTIVE_WORKOUT_KEY = '@gym-app/active-workout';
const EXERCISE_ORDER_KEY = '@gym-app/workout-exercise-order';

export type WorkoutExerciseOrderMap = Record<string, string[]>;

export type ActiveWorkoutCache = {
  workoutId: string;
  startedAt: string;
  exerciseIds: string[];
};

export async function getActiveWorkoutCache(): Promise<ActiveWorkoutCache | null> {
  const raw = await AsyncStorage.getItem(ACTIVE_WORKOUT_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as ActiveWorkoutCache;
  } catch {
    return null;
  }
}

export async function saveActiveWorkoutCache(cache: ActiveWorkoutCache): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_WORKOUT_KEY, JSON.stringify(cache));
}

export async function clearActiveWorkoutCache(): Promise<void> {
  await AsyncStorage.removeItem(ACTIVE_WORKOUT_KEY);
}

async function readExerciseOrderMap(): Promise<WorkoutExerciseOrderMap> {
  const raw = await AsyncStorage.getItem(EXERCISE_ORDER_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as WorkoutExerciseOrderMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function getWorkoutExerciseOrder(workoutId: string): Promise<string[] | null> {
  const map = await readExerciseOrderMap();
  const order = map[workoutId];
  return Array.isArray(order) && order.length > 0 ? order : null;
}

export async function saveWorkoutExerciseOrder(workoutId: string, exerciseIds: string[]): Promise<void> {
  const map = await readExerciseOrderMap();
  map[workoutId] = exerciseIds;
  await AsyncStorage.setItem(EXERCISE_ORDER_KEY, JSON.stringify(map));
}

export async function clearWorkoutExerciseOrder(workoutId: string): Promise<void> {
  const map = await readExerciseOrderMap();
  if (!(workoutId in map)) {
    return;
  }

  delete map[workoutId];
  await AsyncStorage.setItem(EXERCISE_ORDER_KEY, JSON.stringify(map));
}
