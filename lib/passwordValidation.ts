import { ROCKYOU_COMMON_PASSWORDS } from './rockyouCommonPasswords';

type PasswordValidationOptions = {
  email?: string;
  username?: string;
};

export function getPasswordValidationError(password: string, options: PasswordValidationOptions = {}) {
  const normalizedPassword = password.toLowerCase();
  const rockyouCandidate = normalizedPassword.replace(/[^a-z0-9]/g, '');
  const emailName = options.email?.trim().split('@')[0]?.toLowerCase();
  const normalizedUsername = options.username?.trim().toLowerCase();

  if (password.length < 8) {
    return 'Password must be at least 8 characters.';
  }

  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
    return 'Password must include uppercase and lowercase letters.';
  }

  if (!/\d/.test(password)) {
    return 'Password must include at least one number.';
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'Password must include at least one special character.';
  }

  if (ROCKYOU_COMMON_PASSWORDS.has(normalizedPassword) || ROCKYOU_COMMON_PASSWORDS.has(rockyouCandidate)) {
    return 'Choose a less common password.';
  }

  if (normalizedUsername && normalizedPassword.includes(normalizedUsername)) {
    return 'Password cannot contain your username.';
  }

  if (emailName && normalizedPassword.includes(emailName)) {
    return 'Password cannot contain your email name.';
  }

  return null;
}
