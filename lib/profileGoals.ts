import { supabase } from '@/lib/supabase';
import { normalizeGoalSlots } from '@/lib/goals';

export async function saveProfileGoals(slots: string[]): Promise<string[]> {
  const goals = normalizeGoalSlots(slots);

  if (goals.length === 0) {
    throw new Error('Add at least one goal');
  }

  const { data, error } = await supabase.rpc('update_profile_goals', {
    p_goals: goals,
  });

  if (error) {
    throw new Error(error.message);
  }

  return Array.isArray(data) ? data : goals;
}

export async function fetchProfileGoals(): Promise<string[]> {
  const { data: userResult } = await supabase.auth.getUser();
  if (!userResult.user) {
    return [];
  }

  const { data, error } = await supabase
    .from('profiles_with_age')
    .select('goals')
    .eq('id', userResult.user.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Array.isArray(data?.goals) ? data.goals.filter(Boolean) : [];
}
