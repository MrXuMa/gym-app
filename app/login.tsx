import React, { useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AuthCard } from '@/components/auth/AuthCard';
import { AuthScreenLayout } from '@/components/auth/AuthScreenLayout';
import { BirthdayPicker } from '../components/auth/BirthdayPicker';
import { HeightPicker } from '../components/auth/HeightPicker';
import { authPlaceholderColor, authStyles, webInputReset } from '../components/auth/authStyles';
import { homeTheme } from '@/constants/theme';
import { buildBirthday, calculateAge } from '../components/auth/pickerUtils';
import { getAuthRedirectUrl, getEmailForLogin, getPasswordResetRedirectUrl } from '../lib/auth';
import { getPasswordValidationError } from '../lib/passwordValidation';
import { supabase } from '../lib/supabase';

type SignUpResultData = {
  user: { identities?: unknown[] } | null;
  session: unknown | null;
};

function isExistingEmailSignUpResponse(data: SignUpResultData) {
  return Boolean(data.user && !data.session && Array.isArray(data.user.identities) && data.user.identities.length === 0);
}

function getFriendlyAuthError(message: string) {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes('email not confirmed')) {
    return 'This account still needs email confirmation. Check your inbox, or configure custom SMTP in Supabase Auth settings if emails are not sending.';
  }

  if (normalizedMessage.includes('error sending') || normalizedMessage.includes('invalid username')) {
    return 'Auth email delivery is misconfigured. Check your SMTP credentials and verified sender domain in Supabase Auth settings.';
  }

  if (
    normalizedMessage.includes('email') &&
    (normalizedMessage.includes('rate') ||
      normalizedMessage.includes('limit') ||
      normalizedMessage.includes('credit') ||
      normalizedMessage.includes('smtp') ||
      normalizedMessage.includes('send'))
  ) {
    return 'Auth emails are currently rate limited. Configure custom SMTP in Supabase Auth settings so signup and password reset emails can send reliably.';
  }

  return message;
}

export default function Auth() {
  const router = useRouter();
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [registerErrors, setRegisterErrors] = useState<string[]>([]);
  const birthday = buildBirthday(birthMonth, birthDay, birthYear);
  const inputStyle = [authStyles.input, webInputReset];

  function clearMessages() {
    setStatusMessage('');
    setRegisterErrors([]);
  }

  function switchAuthMode() {
    clearMessages();
    setPassword('');
    setConfirmPassword('');
    setFirstName('');
    setLastName('');
    setIsSigningUp((current) => !current);
  }

  function updateField(setter: (value: string) => void) {
    return (value: string) => {
      clearMessages();
      setter(value);
    };
  }

  async function signIn() {
    const login = email.trim();

    clearMessages();
    if (!login || !password) {
      setStatusMessage('Enter your email or username and password.');
      return;
    }

    setLoading(true);

    try {
      const emailForLogin = await getEmailForLogin(login);
      const { error } = await supabase.auth.signInWithPassword({ email: emailForLogin, password });

      if (error) throw new Error(error.message);

      setStatusMessage('Signed in successfully. Redirecting...');
      router.replace('/');
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : 'Could not sign in.';
      const message = getFriendlyAuthError(rawMessage);
      setStatusMessage(message);
    } finally {
      setLoading(false);
    }
  }

  function validateSignUpForm() {
    const errors: string[] = [];
    const parsedWeight = Number.parseFloat(weight);
    const parsedHeight = Number.parseFloat(height);
    const passwordError = getPasswordValidationError(password, { email, username });
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (
      !email.trim() ||
      !firstName.trim() ||
      !lastName.trim() ||
      !username.trim() ||
      !password ||
      !confirmPassword ||
      !birthMonth ||
      !birthDay ||
      !birthYear ||
      !weight.trim() ||
      !height
    ) {
      errors.push('Please fill out every sign-up field.');
    }

    const namePattern = /^[A-Za-z][A-Za-z' -]{0,49}$/;

    if (firstName.trim() && !namePattern.test(firstName.trim())) {
      errors.push('First name can only contain letters, spaces, hyphens, and apostrophes.');
    }

    if (lastName.trim() && !namePattern.test(lastName.trim())) {
      errors.push('Last name can only contain letters, spaces, hyphens, and apostrophes.');
    }

    if (email.trim() && !emailPattern.test(email.trim())) {
      errors.push('Enter a valid email address.');
    }

    if (password !== confirmPassword) {
      errors.push('Passwords do not match.');
    }

    if (passwordError) {
      errors.push(passwordError);
    }

    if (!/^[A-Za-z0-9_]{3,30}$/.test(username.trim())) {
      errors.push('Username must use 3-30 letters, numbers, or underscores.');
    }

    if (calculateAge(birthday) === null) {
      errors.push('Please select a valid month, day, and year.');
    }

    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0 || !Number.isFinite(parsedHeight) || parsedHeight <= 0) {
      errors.push('Weight and height must be positive numbers.');
    }

    if (errors.length > 0) {
      setRegisterErrors(errors);
      return null;
    }

    setRegisterErrors([]);
    return { parsedWeight, parsedHeight };
  }

  async function signUpWithEmail() {
    const validated = validateSignUpForm();

    if (!validated) return;

    setStatusMessage('');
    setRegisterErrors([]);
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: getAuthRedirectUrl('/'),
          data: {
            username: username.trim(),
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            birthday,
            weight: validated.parsedWeight,
            height: validated.parsedHeight,
          },
        },
      });

      if (error) throw new Error(error.message);

      if (isExistingEmailSignUpResponse(data)) {
        const message = 'An account already exists for this email. Log in instead, or use password reset if you forgot your password.';
        setStatusMessage(message);
        setRegisterErrors([message]);
        return;
      }

      if (data.session) {
        setStatusMessage('Account created. Redirecting...');
        router.replace('/');
        return;
      }

      setStatusMessage('Check your email to confirm your account, then log in.');
      Alert.alert('Confirm your email', 'Check your email to confirm your account, then log in.');
      setIsSigningUp(false);
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : 'Could not create account.';
      const message = getFriendlyAuthError(rawMessage);
      setStatusMessage(message);
      setRegisterErrors([message]);
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword() {
    const login = email.trim();

    if (!login) {
      setStatusMessage('Enter your email or username first.');
      return;
    }

    setLoading(true);
    clearMessages();

    try {
      const emailForReset = await getEmailForLogin(login);
      const { error } = await supabase.auth.resetPasswordForEmail(emailForReset, {
        redirectTo: getPasswordResetRedirectUrl(),
      });

      if (error) throw new Error(error.message);

      setStatusMessage('Password reset email sent.');
      Alert.alert('Password reset sent', 'Check your email for the reset link.');
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : 'Could not send password reset.';
      const message = getFriendlyAuthError(rawMessage);
      setStatusMessage(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScreenLayout>
      <AuthCard>
        <Text style={authStyles.header}>{isSigningUp ? 'Register' : 'Login'}</Text>

        <View style={authStyles.field}>
          <TextInput
            onChangeText={updateField(setEmail)}
            value={email}
            placeholder={isSigningUp ? 'Email' : 'Email or username'}
            placeholderTextColor={authPlaceholderColor}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="next"
            style={inputStyle}
          />
          <Text style={authStyles.inputIcon}>@</Text>
        </View>

        {isSigningUp && (
          <>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={[authStyles.field, { flex: 1 }]}>
                <TextInput
                  onChangeText={updateField(setFirstName)}
                  value={firstName}
                  placeholder="First name"
                  placeholderTextColor={authPlaceholderColor}
                  autoCapitalize="words"
                  textContentType="givenName"
                  returnKeyType="next"
                  style={inputStyle}
                />
              </View>

              <View style={[authStyles.field, { flex: 1 }]}>
                <TextInput
                  onChangeText={updateField(setLastName)}
                  value={lastName}
                  placeholder="Last name"
                  placeholderTextColor={authPlaceholderColor}
                  autoCapitalize="words"
                  textContentType="familyName"
                  returnKeyType="next"
                  style={inputStyle}
                />
              </View>
            </View>

            <View style={authStyles.field}>
              <TextInput
                onChangeText={updateField(setUsername)}
                value={username}
                placeholder="Username"
                placeholderTextColor={authPlaceholderColor}
                autoCapitalize="none"
                textContentType="username"
                returnKeyType="next"
                style={inputStyle}
              />
              <Text style={authStyles.inputIcon}>ID</Text>
            </View>

            <BirthdayPicker
              month={birthMonth}
              day={birthDay}
              year={birthYear}
              inputStyle={inputStyle}
              onMonthChange={updateField(setBirthMonth)}
              onDayChange={updateField(setBirthDay)}
              onYearChange={updateField(setBirthYear)}
            />

            <View style={{ flexDirection: 'row', gap: 12, zIndex: 20 }}>
              <View style={[authStyles.field, { flex: 1 }]}>
                <TextInput
                  onChangeText={updateField(setWeight)}
                  value={weight}
                  placeholder="Weight"
                  placeholderTextColor={authPlaceholderColor}
                  keyboardType="decimal-pad"
                  returnKeyType="next"
                  style={inputStyle}
                />
              </View>

              <HeightPicker value={height} inputStyle={inputStyle} onChange={updateField(setHeight)} />
            </View>
          </>
        )}

        <View style={authStyles.field}>
          <TextInput
            onChangeText={updateField(setPassword)}
            value={password}
            secureTextEntry
            placeholder="Password"
            placeholderTextColor={authPlaceholderColor}
            autoCapitalize="none"
            textContentType="password"
            returnKeyType="done"
            onSubmitEditing={isSigningUp ? signUpWithEmail : signIn}
            style={inputStyle}
          />
          <Text style={authStyles.inputIcon}>#</Text>
        </View>

        {isSigningUp ? (
          <>
            <View style={authStyles.field}>
              <TextInput
                onChangeText={updateField(setConfirmPassword)}
                value={confirmPassword}
                secureTextEntry
                placeholder="Confirm password"
                placeholderTextColor={authPlaceholderColor}
                autoCapitalize="none"
                textContentType="password"
                returnKeyType="done"
                onSubmitEditing={signUpWithEmail}
                style={inputStyle}
              />
              <Text style={authStyles.inputIcon}>#</Text>
            </View>

            <Text style={authStyles.passwordHelp}>
              Use 8+ characters with uppercase, lowercase, a number, and a special character. Avoid common passwords.
            </Text>
          </>
        ) : (
          <View style={{ alignItems: 'flex-end', marginBottom: 18 }}>
            <TouchableOpacity disabled={loading} onPress={resetPassword}>
              <Text style={authStyles.optionText}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>
        )}

        {isSigningUp && registerErrors.length > 0 && (
          <View style={authStyles.errorBox}>
            {registerErrors.map((error) => (
              <Text key={error} style={authStyles.errorText}>
                {error}
              </Text>
            ))}
          </View>
        )}

        {statusMessage ? <Text style={authStyles.statusMessage}>{statusMessage}</Text> : null}

        <TouchableOpacity
          style={[authStyles.button, loading && authStyles.disabled]}
          disabled={loading}
          onPress={isSigningUp ? signUpWithEmail : signIn}
        >
          {loading ? (
            <ActivityIndicator color={homeTheme.colors.buttonText} />
          ) : (
            <Text style={authStyles.buttonText}>{isSigningUp ? 'Create Account' : 'Log in'}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={authStyles.footerLink} onPress={switchAuthMode}>
          <Text style={authStyles.footerText}>{isSigningUp ? 'Already have an account? Login' : "Don't have an account? Register"}</Text>
        </TouchableOpacity>
      </AuthCard>
    </AuthScreenLayout>
  );
}
