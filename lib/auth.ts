import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { getErrorMessage, SIGN_IN_FAILED_MESSAGE } from './userFacingError';
import { supabase } from './supabase';

export { SIGN_IN_FAILED_MESSAGE };

const AUTH_EMAIL_NOISE_PATTERN =
  /email.*(confirm|confirmation|send|sending|smtp|deliver|rate|limit)|error sending confirmation/i;

export function isAuthEmailDeliveryError(message: string) {
  return AUTH_EMAIL_NOISE_PATTERN.test(message.trim());
}

export function sanitizeSignUpError(message: string) {
  if (
    isAuthEmailDeliveryError(message) ||
    message.toLowerCase().includes('email not confirmed')
  ) {
    return 'Could not create account. Try again, or log in if you already registered.';
  }

  return getErrorMessage(new Error(message), 'Could not create account.');
}

export function sanitizePasswordResetError(message: string) {
  if (isAuthEmailDeliveryError(message)) {
    return 'Could not start password reset. Try again later.';
  }

  return getErrorMessage(new Error(message), 'Could not start password reset.');
}

export async function signInAfterSignUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  return !error && Boolean(data.session);
}

export async function getEmailForLogin(login: string) {
  const normalizedLogin = login.trim();

  if (normalizedLogin.includes('@')) {
    return normalizedLogin.toLowerCase();
  }

  const { data, error } = await supabase.rpc('get_email_for_username', {
    username_input: normalizedLogin,
  });

  if (error || !data) {
    throw new Error(SIGN_IN_FAILED_MESSAGE);
  }

  return data;
}

export function getAuthRedirectUrl(path = '/') {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}${path}`;
  }

  return Linking.createURL(path);
}

export function getPasswordResetRedirectUrl() {
  return getAuthRedirectUrl('/reset-password');
}
