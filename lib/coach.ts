/**
 * AI Coach client — Supabase only.
 * One advice request per user at a time; summaries merge into coach_context on completion.
 */
import { supabase } from '@/lib/supabase';

export type CoachAdviceStatus = 'pending' | 'running' | 'completed' | 'failed';

export type CoachAdviceRequest = {
  id: string;
  userId: string;
  question: string;
  status: CoachAdviceStatus;
  response: string | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
  contextRecorded: boolean;
};

export type CreateCoachAdviceInput = {
  question: string;
};

const MAX_QUESTION_LENGTH = 500;
const MIN_QUESTION_LENGTH = 8;

export class CoachNotConfiguredError extends Error {
  constructor() {
    super('Coach is not available.');
    this.name = 'CoachNotConfiguredError';
  }
}

export class CoachServiceUnavailableError extends Error {
  constructor(message = 'Coach advice is not available right now.') {
    super(message);
    this.name = 'CoachServiceUnavailableError';
  }
}

export class CoachUnauthorizedError extends Error {
  constructor(message = 'Sign in to request coach advice.') {
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

export function normalizeCoachQuestion(question: string): string {
  return question.trim().replace(/\s+/g, ' ');
}

export function isValidCoachQuestion(question: string): boolean {
  const normalized = normalizeCoachQuestion(question);
  return normalized.length >= MIN_QUESTION_LENGTH && normalized.length <= MAX_QUESTION_LENGTH;
}

export function getCoachQuestionValidationMessage(question: string): string | null {
  const normalized = normalizeCoachQuestion(question);

  if (normalized.length < MIN_QUESTION_LENGTH) {
    return `Ask at least ${MIN_QUESTION_LENGTH} characters.`;
  }

  if (normalized.length > MAX_QUESTION_LENGTH) {
    return `Keep your question under ${MAX_QUESTION_LENGTH} characters.`;
  }

  return null;
}

export function isCoachAdviceTerminal(status: CoachAdviceStatus): boolean {
  return status === 'completed' || status === 'failed';
}

function mapAdviceRow(row: {
  id: string;
  user_id: string;
  question: string;
  status: CoachAdviceStatus;
  response: string | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
  context_recorded?: boolean;
}): CoachAdviceRequest {
  return {
    id: row.id,
    userId: row.user_id,
    question: row.question,
    status: row.status,
    response: row.response ?? null,
    error: row.error ?? null,
    createdAt: row.created_at,
    completedAt: row.completed_at ?? null,
    contextRecorded: row.context_recorded ?? false,
  };
}

/** Latest (only) advice row for the signed-in user — RLS scopes to own rows. */
export async function getLatestCoachAdviceRequest(): Promise<CoachAdviceRequest | null> {
  if (!isCoachConfigured()) {
    return null;
  }

  const { data, error } = await supabase
    .from('coach_advice_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new CoachServiceUnavailableError(error.message);
  }

  return data ? mapAdviceRow(data) : null;
}

export async function createCoachAdviceRequest(
  input: CreateCoachAdviceInput,
): Promise<CoachAdviceRequest> {
  if (!isCoachConfigured()) {
    throw new CoachNotConfiguredError();
  }

  const question = normalizeCoachQuestion(input.question);
  const validationMessage = getCoachQuestionValidationMessage(question);

  if (validationMessage) {
    throw new Error(validationMessage);
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.user?.id) {
    throw new CoachUnauthorizedError();
  }

  const { data, error } = await supabase.rpc('request_coach_advice', {
    p_question: question,
  });

  if (error) {
    throw new CoachServiceUnavailableError(error.message);
  }

  return mapAdviceRow(data);
}

export async function getCoachAdviceRequest(requestId: string): Promise<CoachAdviceRequest> {
  if (!isCoachConfigured()) {
    throw new CoachNotConfiguredError();
  }

  const { data, error } = await supabase
    .from('coach_advice_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (error) {
    throw new CoachServiceUnavailableError(error.message);
  }

  return mapAdviceRow(data);
}

/** Merge a completed advice response summary into coach_context (idempotent). */
export async function recordCoachAdviceInContext(requestId: string): Promise<void> {
  const { error } = await supabase.rpc('record_coach_advice_in_context', {
    p_advice_id: requestId,
  });

  if (error) {
    console.warn('[coach] could not record advice in context:', error.message);
  }
}

/** Remove past advice summaries from coach memory (does not delete workout data). */
export async function clearCoachMemory(): Promise<void> {
  if (!isCoachConfigured()) {
    throw new CoachNotConfiguredError();
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.user?.id) {
    throw new CoachUnauthorizedError();
  }

  const { error } = await supabase.rpc('clear_coach_memory');

  if (error) {
    throw new CoachServiceUnavailableError(error.message);
  }
}
