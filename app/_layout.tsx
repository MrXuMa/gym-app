import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack, useRouter, useSegments } from 'expo-router';
import type { Session } from '@supabase/supabase-js';
import { getActiveWorkoutSession } from '@/lib/workoutSession';
import { supabase } from '@/lib/supabase';

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);
  const router = useRouter();
  const segments = useSegments();
  const redirectingToSession = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setInitialized(true);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!initialized) return;

    const isOnLoginScreen = segments[0] === 'login';
    const isOnResetPasswordScreen = segments[0] === 'reset-password';
    const isOnPublicAuthScreen = isOnLoginScreen || isOnResetPasswordScreen;

    if (!session && !isOnPublicAuthScreen) {
      router.replace('/login');
    }

    if (session && isOnLoginScreen) {
      router.replace('/');
    }
  }, [initialized, router, segments, session]);

  useEffect(() => {
    if (!initialized || !session) {
      return;
    }

    const isOnPublicAuthScreen =
      segments[0] === 'login' || segments[0] === 'reset-password';
    const isOnWorkoutSession = segments[0] === 'workout-session';
    const isOnEditWorkout = segments[0] === 'modal';
    const rootSegment = segments[0] as string | undefined;
    const isOnStartWorkout = rootSegment === 'start-workout';
    const isOnTemplateEditor = rootSegment === 'workout-template';

    if (isOnPublicAuthScreen || isOnWorkoutSession || isOnEditWorkout || isOnStartWorkout || isOnTemplateEditor) {
      redirectingToSession.current = false;
      return;
    }

    let cancelled = false;

    getActiveWorkoutSession()
      .then((active) => {
        if (cancelled || !active || redirectingToSession.current) {
          return;
        }

        redirectingToSession.current = true;
        router.replace({
          pathname: '/workout-session',
          params: { workoutId: active.id },
        });
      })
      .catch(() => {
        redirectingToSession.current = false;
      });

    return () => {
      cancelled = true;
    };
  }, [initialized, router, segments, session]);

  if (!initialized) {
    return (
      <GestureHandlerRootView style={styles.root}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" />
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={styles.root}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="login" options={{ title: 'Login' }} />
          <Stack.Screen name="reset-password" options={{ title: 'Reset Password' }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="profile" />
          <Stack.Screen name="goals" />
          <Stack.Screen name="training-split" />
          <Stack.Screen name="exercises" />
          <Stack.Screen
            name="modal"
            options={{
              headerShown: false,
              gestureEnabled: true,
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="workout-session"
            options={{
              headerShown: false,
              gestureEnabled: false,
              animation: 'fade',
            }}
          />
          <Stack.Screen
            name="start-workout"
            options={{
              headerShown: false,
              gestureEnabled: true,
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="workout-template/editor"
            options={{
              headerShown: false,
              gestureEnabled: true,
              animation: 'slide_from_right',
            }}
          />
        </Stack>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});