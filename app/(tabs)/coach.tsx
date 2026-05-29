import { CoachAdviceCard } from '@/components/coach/CoachAdviceCard';
import { CoachAdviceComposer } from '@/components/coach/CoachAdviceComposer';
import { CoachSetupBanner } from '@/components/coach/CoachSetupBanner';
import { AppScreen } from '@/components/layout/AppScreen';
import { Button } from '@/components/ui/button';
import { homeTheme } from '@/constants/theme';
import { useCoach } from '@/hooks/useCoach';
import { useCoachTemplateProposal } from '@/hooks/useCoachTemplateProposal';
import {
  CoachNotConfiguredError,
  CoachServiceUnavailableError,
  CoachUnauthorizedError,
  isValidCoachQuestion,
} from '@/lib/coach';
import { getCoachTemplateProposalForAdvice } from '@/lib/coachTemplate';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function CoachScreen() {
  const router = useRouter();
  const { request, loading, refreshing, submitting, clearingMemory, isConfigured, connectionError, refresh, requestAdvice, clearMemory } =
    useCoach();
  const {
    proposal: templateProposal,
    generating: generatingTemplate,
    error: templateError,
    requestTemplate,
    refreshForAdvice,
    clearError: clearTemplateError,
  } = useCoachTemplateProposal();
  const [question, setQuestion] = useState('');
  const [templateMode, setTemplateMode] = useState(false);
  const autoTemplateAdviceRef = useRef<string | null>(null);

  useEffect(() => {
    const completed = request;
    if (!completed || completed.status !== 'completed') {
      return;
    }

    let cancelled = false;

    void (async () => {
      await refreshForAdvice(completed.id);
      if (cancelled || !completed.wantsTemplate) {
        return;
      }
      if (autoTemplateAdviceRef.current === completed.id) {
        return;
      }

      try {
        const existing = await getCoachTemplateProposalForAdvice(completed.id);
        if (cancelled) {
          return;
        }
        autoTemplateAdviceRef.current = completed.id;
        if (!existing) {
          void requestTemplate(completed.id);
        }
      } catch {
        // Auto-generation is best-effort; the manual "Create template" button stays available.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [request?.id, request?.status, request?.wantsTemplate, refreshForAdvice, requestTemplate]);

  const handleCreateTemplate = useCallback(() => {
    if (!request || request.status !== 'completed') {
      return;
    }

    clearTemplateError();
    void requestTemplate(request.id);
  }, [clearTemplateError, request, requestTemplate]);

  const handleReviewTemplate = useCallback(() => {
    if (!templateProposal || templateProposal.status !== 'completed') {
      return;
    }

    router.push({
      pathname: '/workout-template/editor',
      params: { proposalId: templateProposal.id },
    } as never);
  }, [router, templateProposal]);

  async function handleSubmit() {
    if (!isValidCoachQuestion(question)) {
      return;
    }

    Keyboard.dismiss();

    if (!isConfigured) {
      Alert.alert(
        'Coach unavailable',
        'Supabase is not configured in this build. Advice requests require a connected backend.',
      );
      return;
    }

    try {
      const created = await requestAdvice(question, templateMode);
      if (created) {
        setQuestion('');
      }
    } catch (error) {
      if (error instanceof CoachNotConfiguredError) {
        Alert.alert('Coach unavailable', error.message);
        return;
      }

      if (error instanceof CoachServiceUnavailableError) {
        Alert.alert('Coach unavailable', error.message);
        return;
      }

      if (error instanceof CoachUnauthorizedError) {
        Alert.alert('Sign in required', error.message);
        return;
      }

      const message = error instanceof Error ? error.message : 'Could not request advice.';
      Alert.alert('Could not request advice', message);
    }
  }

  function handleClearMemoryPress() {
    Alert.alert(
      'Clear coach memory?',
      'This removes all past advice summaries the coach uses for continuity. Your workouts and metrics are not deleted. Use this if earlier advice was wrong or unhelpful.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear memory',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await clearMemory();
                Alert.alert('Coach memory cleared', 'Past advice summaries were removed. New advice will start fresh.');
              } catch (error) {
                if (error instanceof CoachNotConfiguredError) {
                  Alert.alert('Coach unavailable', error.message);
                  return;
                }

                if (error instanceof CoachServiceUnavailableError) {
                  Alert.alert('Could not clear memory', error.message);
                  return;
                }

                if (error instanceof CoachUnauthorizedError) {
                  Alert.alert('Sign in required', error.message);
                  return;
                }

                Alert.alert('Could not clear memory', 'Something went wrong. Try again.');
              }
            })();
          },
        },
      ],
    );
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
          Personalized training advice based on your workouts and metrics
        </Text>

        <CoachSetupBanner isConfigured={isConfigured} connectionError={connectionError} />

        <CoachAdviceComposer
          question={question}
          onChangeQuestion={setQuestion}
          onSubmit={() => void handleSubmit()}
          templateMode={templateMode}
          onToggleTemplateMode={setTemplateMode}
          submitting={submitting}
        />

        <View style={styles.responseSection}>
          <Text style={styles.sectionTitle}>Coach response</Text>

          {loading ? (
            <ActivityIndicator style={styles.loader} color={homeTheme.colors.foreground} />
          ) : !request ? (
            <Text style={styles.emptyText}>
              Ask a question above to get personalized advice based on your training.
            </Text>
          ) : (
            <CoachAdviceCard
              request={request}
              templateProposalStatus={templateProposal?.adviceId === request.id ? templateProposal.status : null}
              templateBusy={generatingTemplate}
              onCreateTemplate={handleCreateTemplate}
              onReviewTemplate={handleReviewTemplate}
            />
          )}

          {templateError ? <Text style={styles.templateError}>{templateError}</Text> : null}
        </View>

        {isConfigured ? (
          <Button
            label="Clear coach memory"
            variant="outline"
            onPress={handleClearMemoryPress}
            loading={clearingMemory}
            disabled={submitting || loading}
            fullWidth
          />
        ) : null}
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
  templateError: {
    color: homeTheme.colors.destructive,
    fontSize: 13,
    lineHeight: 18,
  },
});
