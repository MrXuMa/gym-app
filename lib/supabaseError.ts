import { toUserFacingError } from '@/lib/userFacingError';

/** Throw a sanitized Error when a Supabase client call returns an error. */
export function throwIfSupabaseError(
  error: { message: string } | null,
  fallback = 'Something went wrong. Please try again.',
): void {
  if (error) {
    throw new Error(toUserFacingError(error, fallback));
  }
}
