/** Generic message for failed sign-in (avoids username/email enumeration). */
export const SIGN_IN_FAILED_MESSAGE = 'Incorrect email, username, or password.';

const TECHNICAL_PATTERN =
  /supabase|postgres|relation |policy |rpc |jwt |pgrst|row-level|violates|constraint|SQLSTATE|HTTP \d{3}|gemini|invalid json/i;

/** Strip internal DB/API details before showing errors in the UI. */
export function toUserFacingError(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (!(error instanceof Error)) {
    return fallback;
  }

  const message = error.message.trim();
  if (!message || TECHNICAL_PATTERN.test(message)) {
    return fallback;
  }

  return message;
}

export function sanitizeCoachJobError(error: string | null | undefined): string {
  if (!error?.trim() || TECHNICAL_PATTERN.test(error)) {
    return 'Template generation failed. Try again in a moment.';
  }
  return error.trim();
}

/** Shorthand for UI catch blocks. */
export function getErrorMessage(error: unknown, fallback: string): string {
  return toUserFacingError(error, fallback);
}

const COACH_RPC_MESSAGES: Record<string, string> = {
  coach_job_in_progress: 'A workout is already being generated. Please wait.',
  coach_job_cooldown: 'Please wait a moment before requesting another workout.',
};

export function mapCoachRpcErrorMessage(raw: string): string {
  for (const [code, message] of Object.entries(COACH_RPC_MESSAGES)) {
    if (raw.includes(code)) return message;
  }
  return toUserFacingError(new Error(raw), 'Workout generation is not available right now.');
}
