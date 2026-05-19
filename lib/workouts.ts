import { createActiveWorkoutSession } from '@/lib/workoutSession';
import { clearActiveWorkoutCache, getActiveWorkoutCache } from '@/lib/workoutSessionStorage';
import { supabase } from '@/lib/supabase';

export async function createWorkoutSession(title: string) {
  const session = await createActiveWorkoutSession(title);
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
}
