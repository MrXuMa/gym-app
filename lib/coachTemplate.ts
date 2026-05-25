/**
 * Coach-generated workout template proposals — async draft from completed advice.
 */
import type { SessionExercise, WorkoutSetLog } from '@/lib/workoutSession';
import { supabase } from '@/lib/supabase';
import {
  CoachNotConfiguredError,
  CoachServiceUnavailableError,
  CoachUnauthorizedError,
  isCoachConfigured,
} from '@/lib/coach';

export type CoachTemplateProposalStatus = 'pending' | 'running' | 'completed' | 'failed';

export type CoachTemplateDraftExercise = {
  exercise_id: string;
  exercise_name: string;
  target_muscle: string | null;
  sets: { reps: number; weight: number | null }[];
};

export type CoachTemplateDraft = {
  name: string;
  exercises: CoachTemplateDraftExercise[];
  warnings?: string[];
};

export type CoachTemplateProposal = {
  id: string;
  adviceId: string;
  status: CoachTemplateProposalStatus;
  templateDraft: CoachTemplateDraft | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
  acceptedAt: string | null;
};

function mapProposalRow(row: {
  id: string;
  advice_id: string;
  status: CoachTemplateProposalStatus;
  template_draft: CoachTemplateDraft | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
  accepted_at: string | null;
}): CoachTemplateProposal {
  return {
    id: row.id,
    adviceId: row.advice_id,
    status: row.status,
    templateDraft: row.template_draft ?? null,
    error: row.error ?? null,
    createdAt: row.created_at,
    completedAt: row.completed_at ?? null,
    acceptedAt: row.accepted_at ?? null,
  };
}

export function isCoachTemplateProposalTerminal(status: CoachTemplateProposalStatus): boolean {
  return status === 'completed' || status === 'failed';
}

export function draftToSessionExercises(draft: CoachTemplateDraft): SessionExercise[] {
  return draft.exercises.map((exercise) => {
    const sets: WorkoutSetLog[] = exercise.sets.map((set, index) => ({
      id: `draft-${exercise.exercise_id}-${index}`,
      exerciseId: exercise.exercise_id,
      setNumber: index + 1,
      reps: set.reps,
      weight: set.weight,
    }));

    return {
      id: exercise.exercise_id,
      name: exercise.exercise_name,
      targetMuscle: exercise.target_muscle,
      sets,
    };
  });
}

export async function requestCoachTemplateFromAdvice(
  adviceId: string,
): Promise<CoachTemplateProposal> {
  if (!isCoachConfigured()) {
    throw new CoachNotConfiguredError();
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.user?.id) {
    throw new CoachUnauthorizedError();
  }

  const { data, error } = await supabase.rpc('request_coach_template_from_advice', {
    p_advice_id: adviceId,
  });

  if (error) {
    throw new CoachServiceUnavailableError(error.message);
  }

  return mapProposalRow(data);
}

export async function getCoachTemplateProposal(
  proposalId: string,
): Promise<CoachTemplateProposal> {
  if (!isCoachConfigured()) {
    throw new CoachNotConfiguredError();
  }

  const { data, error } = await supabase
    .from('coach_template_proposals')
    .select('*')
    .eq('id', proposalId)
    .single();

  if (error) {
    throw new CoachServiceUnavailableError(error.message);
  }

  return mapProposalRow(data);
}

export async function getCoachTemplateProposalForAdvice(
  adviceId: string,
): Promise<CoachTemplateProposal | null> {
  if (!isCoachConfigured()) {
    return null;
  }

  const { data, error } = await supabase
    .from('coach_template_proposals')
    .select('*')
    .eq('advice_id', adviceId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new CoachServiceUnavailableError(error.message);
  }

  return data ? mapProposalRow(data) : null;
}

export async function acceptCoachTemplateProposal(proposalId: string): Promise<void> {
  const { error } = await supabase.rpc('accept_coach_template_proposal', {
    p_proposal_id: proposalId,
  });

  if (error) {
    console.warn('[coach] could not mark template proposal accepted:', error.message);
  }
}
