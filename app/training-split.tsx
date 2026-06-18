import { useCallback, useState } from 'react';
import { getErrorMessage } from '@/lib/userFacingError';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { confirmAsync, notify } from '@/lib/platformAlert';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppScreen } from '@/components/layout/AppScreen';
import { Button } from '@/components/ui/button';
import { TrainingSplitEditor } from '@/components/profile/TrainingSplitEditor';
import { homeTheme } from '@/constants/theme';
import {
  DEFAULT_TRAINING_SPLIT,
  fetchCatalogMuscleGroups,
  fetchTrainingSplitState,
  filterScheduleToCatalog,
  removeTrainingSplit,
  saveTrainingSplit,
  schedulesEqual,
  type TrainingSplitSchedule,
  type TrainingSplitState,
} from '@/lib/trainingSplit';

export default function TrainingSplitScreen() {
  const router = useRouter();
  const [splitState, setSplitState] = useState<TrainingSplitState | null>(null);
  const [savedState, setSavedState] = useState<TrainingSplitState | null>(null);
  const [catalogMuscles, setCatalogMuscles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  const schedule = splitState?.schedule ?? null;
  const splitEnabled = splitState?.enabled ?? true;

  const loadSplit = useCallback(async () => {
    setLoading(true);

    try {
      const [muscles, state] = await Promise.all([fetchCatalogMuscleGroups(), fetchTrainingSplitState()]);
      setCatalogMuscles(muscles);
      const filtered = {
        enabled: state.enabled,
        schedule: filterScheduleToCatalog(state.schedule, muscles),
      };
      setSplitState(filtered);
      setSavedState(filtered);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not load training split.');
      notify('Could not load split', message);
      router.back();
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      void loadSplit();
    }, [loadSplit]),
  );

  const dirty =
    splitState != null &&
    savedState != null &&
    (splitState.enabled !== savedState.enabled ||
      (splitState.enabled && !schedulesEqual(splitState.schedule, savedState.schedule)));

  function updateSchedule(next: TrainingSplitSchedule) {
    setSplitState((prev) => (prev ? { ...prev, schedule: next, enabled: true } : prev));
  }

  async function handleSave() {
    if (!schedule || !splitEnabled) return;

    setSaving(true);
    try {
      const saved = await saveTrainingSplit(schedule);
      const filtered = {
        enabled: saved.enabled,
        schedule: filterScheduleToCatalog(saved.schedule, catalogMuscles),
      };
      setSplitState(filtered);
      setSavedState(filtered);
      notify('Saved', 'Your weekly split is updated. Coach will use this plan.');
    } catch (error) {
      const message = getErrorMessage(error, 'Could not save split.');
      notify('Could not save split', message);
    } finally {
      setSaving(false);
    }
  }

  async function handleResetDefault() {
    const confirmed = await confirmAsync({
      title: 'Reset to default split?',
      message: 'This restores the default Push/Pull/Legs weekly plan and re-enables split-based workouts.',
      confirmText: 'Reset',
    });
    if (!confirmed) return;

    const nextSchedule = catalogMuscles.length
      ? filterScheduleToCatalog(DEFAULT_TRAINING_SPLIT, catalogMuscles)
      : { ...DEFAULT_TRAINING_SPLIT };
    setSplitState({ enabled: true, schedule: nextSchedule });
  }

  async function handleRemoveSplit() {
    const confirmed = await confirmAsync({
      title: 'Remove training split?',
      message:
        'Coach will no longer follow a weekly plan. Workouts will be based on your request, recent logs, or a starter push/pull/legs rotation.',
      confirmText: 'Remove split',
      destructive: true,
    });
    if (!confirmed) return;

    setRemoving(true);
    try {
      const saved = await removeTrainingSplit();
      const filtered = {
        enabled: saved.enabled,
        schedule: filterScheduleToCatalog(saved.schedule, catalogMuscles),
      };
      setSplitState(filtered);
      setSavedState(filtered);
      notify('Split removed', 'Coach will use your requests and workout history instead.');
    } catch (error) {
      const message = getErrorMessage(error, 'Could not remove split.');
      notify('Could not remove split', message);
    } finally {
      setRemoving(false);
    }
  }

  function handleEnableSplit() {
    const nextSchedule = catalogMuscles.length
      ? filterScheduleToCatalog(DEFAULT_TRAINING_SPLIT, catalogMuscles)
      : { ...DEFAULT_TRAINING_SPLIT };
    setSplitState({ enabled: true, schedule: nextSchedule });
  }

  return (
    <AppScreen title="Training split" showProfile={false}>
      {loading || !splitState || !schedule ? (
        <ActivityIndicator style={styles.loader} size="large" color={homeTheme.colors.textPrimary} />
      ) : (
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {splitEnabled ? (
            <>
              <Text style={styles.lead}>
                Plan which muscle groups you train each day.
              </Text>

              <TrainingSplitEditor
                schedule={schedule}
                catalogMuscles={catalogMuscles}
                onChange={updateSchedule}
              />
            </>
          ) : (
            <View style={styles.disabledCard}>
              <Text style={styles.disabledTitle}>No weekly split</Text>
              <Text style={styles.disabledBody}>
                Coach uses your notes and workout history instead of a weekly plan.
              </Text>
              <Button label="Set up weekly split" onPress={handleEnableSplit} disabled={removing} />
            </View>
          )}

          <View style={styles.actions}>
            {splitEnabled ? (
              <>
                <Button
                  label={saving ? 'Saving…' : 'Save split'}
                  onPress={() => void handleSave()}
                  disabled={!dirty || saving || removing}
                />

                <Pressable
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]}
                  onPress={() => void handleResetDefault()}
                  disabled={saving || removing}
                >
                  <Text style={styles.secondaryButtonText}>Reset to default PPL split</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [styles.dangerButton, pressed && styles.secondaryButtonPressed]}
                  onPress={() => void handleRemoveSplit()}
                  disabled={saving || removing}
                >
                  <Text style={styles.dangerButtonText}>
                    {removing ? 'Removing…' : 'Remove training split'}
                  </Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </ScrollView>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: 48 },
  body: { flex: 1 },
  bodyContent: {
    paddingHorizontal: homeTheme.spacing.screen,
    paddingTop: 8,
    paddingBottom: 40,
    gap: 16,
  },
  lead: {
    color: homeTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  disabledCard: {
    gap: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: homeTheme.colors.card,
    borderWidth: 1,
    borderColor: homeTheme.colors.border,
  },
  disabledTitle: {
    color: homeTheme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  disabledBody: {
    color: homeTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    gap: 12,
    marginTop: 8,
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  secondaryButtonPressed: { opacity: 0.7 },
  secondaryButtonText: {
    color: homeTheme.colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
  dangerButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  dangerButtonText: {
    color: homeTheme.colors.destructive,
    fontSize: 14,
    fontWeight: '500',
  },
});
