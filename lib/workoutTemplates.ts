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
import { draftToSessionExercises, sessionExercisesToContent } from '@/lib/coachTemplate';
import type { CoachTemplateDraft } from '@/lib/coach';
import { supabase } from '@/lib/supabase';

export type WorkoutTemplateListItem = {
  id: string;
  name: string;
  exerciseCount: number;
  updatedAt: string;
  source: 'manual' | 'coach';
};

export type WorkoutTemplateDetail = {
  id: string;
  name: string;
  exercises: SessionExercise[];
  source: 'manual' | 'coach';
  coachJobId: string | null;
};

type TemplateContent = {
  exercises: CoachTemplateDraft['exercises'];
};

function exerciseCountFromContent(content: TemplateContent | null | undefined): number {
  return Array.isArray(content?.exercises) ? content.exercises.length : 0;
}

export async function listWorkoutTemplates(): Promise<WorkoutTemplateListItem[]> {
  const { data, error } = await supabase
    .from('workout_templates')
    .select('id, name, updated_at, source, content')
    .order('updated_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    exerciseCount: exerciseCountFromContent(row.content as TemplateContent),
    updatedAt: row.updated_at,
    source: (row.source as 'manual' | 'coach') ?? 'manual',
  }));
}

export async function getWorkoutTemplate(templateId: string): Promise<WorkoutTemplateDetail> {
  const { data, error } = await supabase
    .from('workout_templates')
    .select('id, name, content, source, coach_job_id')
    .eq('id', templateId)
    .single();

  if (error) throw error;

  const content = (data.content ?? { exercises: [] }) as TemplateContent;
  const draft: CoachTemplateDraft = {
    name: data.name,
    exercises: content.exercises ?? [],
  };

  return {
    id: data.id,
    name: data.name,
    exercises: draftToSessionExercises(draft),
    source: (data.source as 'manual' | 'coach') ?? 'manual',
    coachJobId: data.coach_job_id ?? null,
  };
}

export type SaveWorkoutTemplateOptions = {
  coachJobId?: string | null;
};

export async function saveWorkoutTemplate(
  templateId: string | null,
  name: string,
  exercises: SessionExercise[],
  options: SaveWorkoutTemplateOptions = {},
): Promise<string> {
  const trimmedName = resolveWorkoutTitle(name);
  const content = sessionExercisesToContent(exercises);
  const coachJobId = options.coachJobId ?? null;

  if (templateId) {
    const { error } = await supabase
      .from('workout_templates')
      .update({
        name: trimmedName,
        content,
        updated_at: new Date().toISOString(),
        ...(coachJobId ? { coach_job_id: coachJobId, source: 'coach' as const } : {}),
      })
      .eq('id', templateId);

    if (error) throw error;
    return templateId;
  }

  const { data, error } = await supabase
    .from('workout_templates')
    .insert({
      name: trimmedName,
      content,
      source: coachJobId ? 'coach' : 'manual',
      coach_job_id: coachJobId,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

export async function deleteWorkoutTemplate(templateId: string): Promise<void> {
  const { error } = await supabase.from('workout_templates').delete().eq('id', templateId);
  if (error) throw error;
}

export async function startWorkoutFromTemplate(templateId: string): Promise<string> {
  const existing = await getActiveWorkoutSession();
  if (existing) return existing.id;

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
