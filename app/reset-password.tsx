import React, { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Session } from '@supabase/supabase-js';
import { AuthCard } from '@/components/auth/AuthCard';
import { AuthScreenLayout } from '@/components/auth/AuthScreenLayout';
import { authPlaceholderColor, authStyles, webInputReset } from '@/components/auth/authStyles';
import { Button } from '@/components/ui/button';
import { getPasswordValidationError } from '../lib/passwordValidation';
import { supabase } from '../lib/supabase';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Checking reset link...');
  const [errors, setErrors] = useState<string[]>([]);
  const inputStyle = [authStyles.input, webInputReset];

  function clearErrors() {
    setErrors([]);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setStatusMessage(data.session ? 'Enter your new password.' : 'Use the reset link from your email to open this page.');
      setCheckingSession(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setSession(session);
        setStatusMessage('Enter your new password.');
        setCheckingSession(false);
      }
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  async function updatePassword() {
    const passwordError = getPasswordValidationError(password);

    if (!session) {
      setErrors(['Open this page from the password reset email.']);
      return;
    }

    if (passwordError) {
      setErrors([passwordError]);
      return;
    }

    if (password !== confirmPassword) {
      setErrors(['Passwords do not match.']);
      return;
    }

    setLoading(true);
    setStatusMessage('');
    setErrors([]);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setStatusMessage(error.message);
      setErrors([error.message]);
      setLoading(false);
      return;
    }

    setStatusMessage('Password updated. Redirecting to login...');
    await supabase.auth.signOut();
    router.replace('/login');
    setLoading(false);
  }

  return (
    <AuthScreenLayout>
      <AuthCard>
        <Text style={authStyles.header}>Reset password</Text>
        <Text style={[authStyles.statusMessage, { marginBottom: 16 }]}>{statusMessage}</Text>

        <View style={authStyles.field}>
          <TextInput
            value={password}
            onChangeText={(value) => {
              clearErrors();
              setPassword(value);
            }}
            secureTextEntry
            placeholder="New password"
            placeholderTextColor={authPlaceholderColor}
            autoCapitalize="none"
            textContentType="newPassword"
            style={inputStyle}
          />
        </View>

        <View style={authStyles.field}>
          <TextInput
            value={confirmPassword}
            onChangeText={(value) => {
              clearErrors();
              setConfirmPassword(value);
            }}
            secureTextEntry
            placeholder="Confirm new password"
            placeholderTextColor={authPlaceholderColor}
            autoCapitalize="none"
            textContentType="newPassword"
            returnKeyType="done"
            onSubmitEditing={updatePassword}
            style={inputStyle}
          />
        </View>

        <Text style={authStyles.passwordHelp}>
          Use 8+ characters with uppercase, lowercase, a number, and a special character.
        </Text>

        {errors.length > 0 ? (
          <View style={authStyles.errorBox}>
            {errors.map((error) => (
              <Text key={error} style={authStyles.errorText}>
                {error}
              </Text>
            ))}
          </View>
        ) : null}

        <View style={authStyles.actions}>
          <Button
            label="Update password"
            fullWidth
            loading={loading || checkingSession}
            disabled={checkingSession || !session}
            onPress={updatePassword}
          />
        </View>

        <Pressable style={authStyles.footerLink} onPress={() => router.replace('/login')}>
          <Text style={authStyles.footerText}>
            Back to <Text style={authStyles.footerTextHighlight}>Log in</Text>
          </Text>
        </Pressable>
      </AuthCard>
    </AuthScreenLayout>
  );
}
