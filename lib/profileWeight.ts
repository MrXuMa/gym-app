import { supabase } from '@/lib/supabase';
import { throwIfSupabaseError } from '@/lib/supabaseError';

export const WEIGHT_MIN_LBS = 0.1;
export const WEIGHT_MAX_LBS = 1000;

export function parseWeightInput(input: string): number | null {
  const cleaned = input.trim().replace(/,/g, '.');
  if (!cleaned) {
    return null;
  }

  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

export function getWeightValidationError(value: number | null): string | null {
  if (value == null) {
    return 'Enter a number.';
  }

  if (value <= 0) {
    return 'Weight must be greater than 0.';
  }

  if (value > WEIGHT_MAX_LBS) {
    return `Weight must be ${WEIGHT_MAX_LBS} or less.`;
  }

  return null;
}

export async function updateProfileWeight(weight: number): Promise<number> {
  const validationError = getWeightValidationError(weight);
  if (validationError) {
    throw new Error(validationError);
  }

  const { data, error } = await supabase.rpc('update_profile_weight', {
    p_weight: weight,
  });

  if (error) {
    throwIfSupabaseError(error, 'Could not update weight.');
  }
}

export type WeightLogEntry = {
  id: string;
  weight: number;
  recordedAt: string;
  source: 'manual' | 'backfill';
};

export async function fetchRecentWeightLogs(limit = 10): Promise<WeightLogEntry[]> {
  const { data, error } = await supabase
    .from('body_weight_logs')
    .select('id, weight, recorded_at, source')
    .order('recorded_at', { ascending: false })
    .limit(limit);

  if (error) {
    throwIfSupabaseError(error, 'Could not load weight history.');
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    weight: Number(row.weight),
    recordedAt: row.recorded_at,
    source: row.source as 'manual' | 'backfill',
  }));
}

/** Returns the new profile weight after deletion (may be null if no logs remain). */
export async function deleteWeightLog(logId: string): Promise<number | null> {
  const { data, error } = await supabase.rpc('delete_body_weight_log', {
    p_log_id: logId,
  });

  if (error) {
    throwIfSupabaseError(error, 'Could not delete weight log.');
  }

  return typeof data === 'number' ? data : null;
}

const DAY_MS = 1000 * 60 * 60 * 24;

export function formatRelativeLogDate(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  const startOfDay = (d: Date) => {
    const next = new Date(d);
    next.setHours(0, 0, 0, 0);
    return next;
  };

  const diffDays = Math.round(
    (startOfDay(now).getTime() - startOfDay(date).getTime()) / DAY_MS,
  );

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
}
