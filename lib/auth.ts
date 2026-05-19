import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { supabase } from './supabase';

export async function getEmailForLogin(login: string) {
  const normalizedLogin = login.trim();

  if (normalizedLogin.includes('@')) {
    return normalizedLogin.toLowerCase();
  }

  const { data, error } = await supabase.rpc('get_email_for_username', {
    username_input: normalizedLogin,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error('No account found for that username.');
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
