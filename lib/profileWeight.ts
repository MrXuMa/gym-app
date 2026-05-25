import { supabase } from '@/lib/supabase';

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
    throw new Error(error.message);
  }

  return typeof data === 'number' ? data : weight;
}
