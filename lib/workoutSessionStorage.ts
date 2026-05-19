import AsyncStorage from '@react-native-async-storage/async-storage';

const ACTIVE_WORKOUT_KEY = '@gym-app/active-workout';

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
