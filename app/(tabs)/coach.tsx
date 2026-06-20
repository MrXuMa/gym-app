import { CoachAdviceCard } from '@/components/coach/CoachAdviceCard';
import { CoachAdviceComposer } from '@/components/coach/CoachAdviceComposer';
import { CoachSetupBanner } from '@/components/coach/CoachSetupBanner';
import { AppScreen } from '@/components/layout/AppScreen';
import { homeTheme } from '@/constants/theme';
import { useCoach } from '@/hooks/useCoach';
import {
  CoachNotConfiguredError,
  CoachServiceUnavailableError,
  CoachUnauthorizedError,
  isValidCoachPrompt,
} from '@/lib/coach';
import { getErrorMessage } from '@/lib/userFacingError';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { notify } from '@/lib/platformAlert';

export default function CoachScreen() {
  const router = useRouter();
  const { job, loading, refreshing, submitting, isConfigured, connectionError, refresh, requestWorkout } =
    useCoach();
  const [prompt, setPrompt] = useState('');

  const handleReviewTemplate = useCallback(() => {
    if (!job || job.status !== 'completed') return;

    router.push({
      pathname: '/workout-template/editor',
      params: { jobId: job.id },
    } as never);
  }, [router, job]);

  async function handleSubmit() {
    if (!isValidCoachPrompt(prompt)) return;

    Keyboard.dismiss();

    if (!isConfigured) {
      notify(
        'Coach unavailable',
        'Supabase is not configured in this build. Workout generation requires a connected backend.',
      );
      return;
    }

    try {
      const created = await requestWorkout(prompt);
      if (created) setPrompt('');
    } catch (error) {
      if (error instanceof CoachNotConfiguredError) {
        notify('Coach unavailable', error.message);
        return;
      }
      if (error instanceof CoachServiceUnavailableError) {
        notify('Coach unavailable', error.message);
        return;
      }
      if (error instanceof CoachUnauthorizedError) {
        notify('Sign in required', error.message);
        return;
      }
      const message = getErrorMessage(error, 'Could not request workout.');
      notify('Could not generate workout', message);
    }
  }

  async function handleRetry() {
    if (!job) return;
    try {
      await requestWorkout(job.prompt);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not retry workout generation.');
      notify('Could not generate workout', message);
    }
  }

  return (
    <AppScreen title="Coach" showCrossWatermark>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          isConfigured ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void refresh()}
              tintColor={homeTheme.colors.textPrimary}
            />
          ) : undefined
        }
      >
        <Text style={styles.lead}>
          Generate saveable workout templates from your split, goals, and training logs
        </Text>

        <CoachSetupBanner isConfigured={isConfigured} connectionError={connectionError} />

        <CoachAdviceComposer
          question={prompt}
          onChangeQuestion={setPrompt}
          onSubmit={() => void handleSubmit()}
          submitting={submitting}
          disabled={!isConfigured}
        />

        <View style={styles.responseSection}>
          <Text style={styles.sectionTitle}>Workout status</Text>

          {loading ? (
            <ActivityIndicator style={styles.loader} color={homeTheme.colors.foreground} />
          ) : !job ? (
            <Text style={styles.emptyText}>
              Tap Generate workout above to build a template from your training context.
            </Text>
          ) : (
            <CoachAdviceCard
              job={job}
              onReviewTemplate={handleReviewTemplate}
              onRetry={job.status === 'failed' ? () => void handleRetry() : undefined}
            />
          )}
        </View>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: homeTheme.spacing.screen,
    paddingBottom: 24,
    gap: 20,
  },
  lead: {
    color: homeTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  responseSection: {
    gap: 12,
  },
  sectionTitle: {
    color: homeTheme.colors.mutedForeground,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  loader: {
    marginTop: 8,
  },
  emptyText: {
    color: homeTheme.colors.mutedForeground,
    fontSize: 14,
    lineHeight: 20,
  },
});
