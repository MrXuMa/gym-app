import { supabase } from '@/lib/supabase';

export type ExerciseCatalogItem = {
  id: string;
  name: string;
  targetMuscle: string | null;
};

export async function fetchExerciseCatalog(): Promise<ExerciseCatalogItem[]> {
  const { data, error } = await supabase.from('exercises').select('id, name, target_muscle').order('name');

  if (error) {
    throw error;
  }

  return (data ?? []).map((exercise) => ({
    id: exercise.id,
    name: exercise.name,
    targetMuscle: exercise.target_muscle,
  }));
}
