/**
 * AI Coach client — single coach_template_jobs table.
 */
import { supabase } from '@/lib/supabase';
import { mapCoachRpcErrorMessage } from '@/lib/userFacingError';

export type CoachTemplateJobStatus = 'pending' | 'running' | 'completed' | 'failed';

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

export type CoachTemplateJob = {
  id: string;
  userId: string;
  prompt: string;
  status: CoachTemplateJobStatus;
  templateDraft: CoachTemplateDraft | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
  acceptedAt: string | null;
  savedTemplateId: string | null;
};

const MAX_PROMPT_LENGTH = 500;
const NETWORK_TIMEOUT_MS = 15000;

async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out. Check your connection and try again.`)), NETWORK_TIMEOUT_MS),
    ),
  ]);
}

export class CoachNotConfiguredError extends Error {
  constructor() {
    super('Coach is not available.');
    this.name = 'CoachNotConfiguredError';
  }
}

export class CoachServiceUnavailableError extends Error {
  constructor(message = 'Workout generation is not available right now.') {
    super(message);
    this.name = 'CoachServiceUnavailableError';
  }
}

export class CoachUnauthorizedError extends Error {
  constructor(message = 'Sign in to generate a workout.') {
    super(message);
    this.name = 'CoachUnauthorizedError';
  }
}

export function isCoachConfigured(): boolean {
  return Boolean(
    process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  );
}

export function normalizeCoachPrompt(prompt: string): string {
  return prompt.trim().replace(/\s+/g, ' ');
}

export function isValidCoachPrompt(prompt: string): boolean {
  return normalizeCoachPrompt(prompt).length <= MAX_PROMPT_LENGTH;
}

export function getCoachPromptValidationMessage(prompt: string): string | null {
  const normalized = normalizeCoachPrompt(prompt);
  if (normalized.length > MAX_PROMPT_LENGTH) {
    return `Keep your note under ${MAX_PROMPT_LENGTH} characters.`;
  }
  return null;
}

export function isCoachJobTerminal(status: CoachTemplateJobStatus): boolean {
  return status === 'completed' || status === 'failed';
}

function mapJobRow(row: {
  id: string;
  user_id: string;
  prompt: string;
  status: CoachTemplateJobStatus;
  template_draft: CoachTemplateDraft | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
  accepted_at: string | null;
  saved_template_id: string | null;
}): CoachTemplateJob {
  return {
    id: row.id,
    userId: row.user_id,
    prompt: row.prompt,
    status: row.status,
    templateDraft: row.template_draft ?? null,
    error: row.error ?? null,
    createdAt: row.created_at,
    completedAt: row.completed_at ?? null,
    acceptedAt: row.accepted_at ?? null,
    savedTemplateId: row.saved_template_id ?? null,
  };
}

export async function getLatestCoachTemplateJob(): Promise<CoachTemplateJob | null> {
  if (!isCoachConfigured()) return null;

  const { data, error } = await withTimeout(
    supabase
      .from('coach_template_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    'Loading coach status',
  );

  if (error) throw new CoachServiceUnavailableError();
  return data ? mapJobRow(data) : null;
}

function throwCoachRpcError(error: { message: string }): never {
  throw new Error(mapCoachRpcErrorMessage(error.message));
}

export async function createCoachTemplateJob(prompt: string): Promise<CoachTemplateJob> {
  if (!isCoachConfigured()) throw new CoachNotConfiguredError();

  const normalized = normalizeCoachPrompt(prompt);
  const validationMessage = getCoachPromptValidationMessage(normalized);
  if (validationMessage) throw new Error(validationMessage);

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user?.id) {
    throw new CoachUnauthorizedError();
  }

  const { data, error } = await withTimeout(
    supabase.rpc('request_coach_template_job', { p_prompt: normalized }),
    'Submitting workout request',
  );

  if (error) throwCoachRpcError(error);
  return mapJobRow(data);
}

export async function getCoachTemplateJob(jobId: string): Promise<CoachTemplateJob> {
  if (!isCoachConfigured()) throw new CoachNotConfiguredError();

  const { data, error } = await withTimeout(
    supabase.from('coach_template_jobs').select('*').eq('id', jobId).single(),
    'Refreshing workout status',
  );

  if (error) throw new CoachServiceUnavailableError();
  return mapJobRow(data);
}

export async function acceptCoachTemplateJob(
  jobId: string,
  savedTemplateId: string,
): Promise<void> {
  const { error } = await supabase.rpc('accept_coach_template_job', {
    p_job_id: jobId,
    p_saved_template_id: savedTemplateId,
  });

  if (error) {
    console.warn('[coach] could not mark job accepted:', error.message);
  }
}
