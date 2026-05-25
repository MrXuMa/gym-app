import {
  addExerciseToActiveSession,
  addWorkoutSet,
  createActiveWorkoutSession,
  getActiveWorkoutSession,
  type SessionExercise,
  type WorkoutSetLog,
} from '@/lib/workoutSession';
import { saveActiveWorkoutCache } from '@/lib/workoutSessionStorage';
import { resolveWorkoutTitle } from '@/lib/workoutDisplay';
import { supabase } from '@/lib/supabase';

export type WorkoutTemplateListItem = {
  id: string;
  name: string;
  exerciseCount: number;
  updatedAt: string;
};

export type WorkoutTemplateDetail = {
  id: string;
  name: string;
  exercises: SessionExercise[];
};

type TemplateExerciseRow = {
  id: string;
  exercise_id: string;
  sort_order: number;
  exercises: { name: string; target_muscle: string | null } | { name: string; target_muscle: string | null }[] | null;
};

type TemplateSetRow = {
  id: string;
  template_exercise_id: string;
  set_number: number;
  reps: number | null;
  weight: number | null;
};

function getExerciseMeta(
  exercises: TemplateExerciseRow['exercises'],
): { name: string; targetMuscle: string | null } {
  if (Array.isArray(exercises)) {
    return { name: exercises[0]?.name ?? 'Exercise', targetMuscle: exercises[0]?.target_muscle ?? null };
  }

  return { name: exercises?.name ?? 'Exercise', targetMuscle: exercises?.target_muscle ?? null };
}

export async function listWorkoutTemplates(): Promise<WorkoutTemplateListItem[]> {
  const { data, error } = await supabase
    .from('workout_templates')
    .select('id, name, updated_at, workout_template_exercises(id)')
    .order('updated_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => {
    const exerciseRows = row.workout_template_exercises as { id: string }[] | null;

    return {
      id: row.id,
      name: row.name,
      exerciseCount: exerciseRows?.length ?? 0,
      updatedAt: row.updated_at,
    };
  });
}

export async function getWorkoutTemplate(templateId: string): Promise<WorkoutTemplateDetail> {
  const [templateResult, exerciseResult] = await Promise.all([
    supabase.from('workout_templates').select('id, name').eq('id', templateId).single(),
    supabase
      .from('workout_template_exercises')
      .select('id, exercise_id, sort_order, exercises(name, target_muscle)')
      .eq('template_id', templateId)
      .order('sort_order', { ascending: true }),
  ]);

  if (templateResult.error) {
    throw templateResult.error;
  }

  if (exerciseResult.error) {
    throw exerciseResult.error;
  }

  const templateExerciseRows = exerciseResult.data ?? [];
  const templateExerciseIds = templateExerciseRows.map((row) => row.id);

  let setRows: TemplateSetRow[] = [];

  if (templateExerciseIds.length > 0) {
    const setResult = await supabase
      .from('workout_template_sets')
      .select('id, template_exercise_id, set_number, reps, weight')
      .in('template_exercise_id', templateExerciseIds)
      .order('set_number', { ascending: true });

    if (setResult.error) {
      throw setResult.error;
    }

    setRows = (setResult.data ?? []) as TemplateSetRow[];
  }

  const setsByTemplateExercise = new Map<string, WorkoutSetLog[]>();

  for (const row of setRows) {
    const sets = setsByTemplateExercise.get(row.template_exercise_id) ?? [];
    sets.push({
      id: row.id,
      exerciseId: '',
      setNumber: row.set_number,
      reps: row.reps,
      weight: row.weight,
    });
    setsByTemplateExercise.set(row.template_exercise_id, sets);
  }

  const exercises: SessionExercise[] = templateExerciseRows.map((row) => {
    const typed = row as TemplateExerciseRow;
    const meta = getExerciseMeta(typed.exercises);
    const sets = (setsByTemplateExercise.get(typed.id) ?? []).map((set) => ({
      ...set,
      exerciseId: typed.exercise_id,
    }));

    return {
      id: typed.exercise_id,
      name: meta.name,
      targetMuscle: meta.targetMuscle,
      sets: sets.sort((a, b) => a.setNumber - b.setNumber),
    };
  });

  return {
    id: templateResult.data.id,
    name: templateResult.data.name,
    exercises,
  };
}

export async function saveWorkoutTemplate(
  templateId: string | null,
  name: string,
  exercises: SessionExercise[],
): Promise<string> {
  const trimmedName = resolveWorkoutTitle(name);

  let id = templateId;

  if (id) {
    const { error } = await supabase
      .from('workout_templates')
      .update({ name: trimmedName })
      .eq('id', id);

    if (error) {
      throw error;
    }

    const { error: deleteExercisesError } = await supabase
      .from('workout_template_exercises')
      .delete()
      .eq('template_id', id);

    if (deleteExercisesError) {
      throw deleteExercisesError;
    }
  } else {
    const { data, error } = await supabase
      .from('workout_templates')
      .insert({ name: trimmedName })
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    id = data.id;
  }

  for (let index = 0; index < exercises.length; index += 1) {
    const exercise = exercises[index];
    const { data: exerciseRow, error: exerciseError } = await supabase
      .from('workout_template_exercises')
      .insert({
        template_id: id,
        exercise_id: exercise.id,
        sort_order: index,
      })
      .select('id')
      .single();

    if (exerciseError) {
      throw exerciseError;
    }

    const sortedSets = [...exercise.sets].sort((a, b) => a.setNumber - b.setNumber);

    for (let setIndex = 0; setIndex < sortedSets.length; setIndex += 1) {
      const set = sortedSets[setIndex];
      const { error: setError } = await supabase.from('workout_template_sets').insert({
        template_exercise_id: exerciseRow.id,
        set_number: setIndex + 1,
        reps: set.reps,
        weight: set.weight,
      });

      if (setError) {
        throw setError;
      }
    }
  }

  if (!id) {
    throw new Error('Could not save template.');
  }

  return id;
}

export async function deleteWorkoutTemplate(templateId: string): Promise<void> {
  const { error } = await supabase.from('workout_templates').delete().eq('id', templateId);

  if (error) {
    throw error;
  }
}

export async function startWorkoutFromTemplate(templateId: string): Promise<string> {
  const existing = await getActiveWorkoutSession();
  if (existing) {
    return existing.id;
  }

  const template = await getWorkoutTemplate(templateId);

  if (template.exercises.length === 0) {
    throw new Error('Add at least one exercise to this template before starting.');
  }

  const session = await createActiveWorkoutSession(resolveWorkoutTitle(template.name));

  const exerciseIds: string[] = [];

  for (const exercise of template.exercises) {
    exerciseIds.push(exercise.id);
    await addExerciseToActiveSession(session.id, exercise.id);

    const sortedSets = [...exercise.sets].sort((a, b) => a.setNumber - b.setNumber);

    for (const set of sortedSets) {
      await addWorkoutSet(session.id, exercise.id, set.reps, set.weight);
    }
  }

  await saveActiveWorkoutCache({
    workoutId: session.id,
    startedAt: session.startedAt,
    exerciseIds,
  });

  return session.id;
}
