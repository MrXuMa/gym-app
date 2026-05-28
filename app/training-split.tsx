import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppScreen } from '@/components/layout/AppScreen';
import { Button } from '@/components/ui/button';
import { TrainingSplitEditor } from '@/components/profile/TrainingSplitEditor';
import { homeTheme } from '@/constants/theme';
import {
  DEFAULT_TRAINING_SPLIT,
  fetchCatalogMuscleGroups,
  fetchTrainingSplit,
  filterScheduleToCatalog,
  saveTrainingSplit,
  schedulesEqual,
  type TrainingSplitSchedule,
} from '@/lib/trainingSplit';

export default function TrainingSplitScreen() {
  const router = useRouter();
  const [schedule, setSchedule] = useState<TrainingSplitSchedule | null>(null);
  const [savedSchedule, setSavedSchedule] = useState<TrainingSplitSchedule | null>(null);
  const [catalogMuscles, setCatalogMuscles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSplit = useCallback(async () => {
    setLoading(true);

    try {
      const [muscles, split] = await Promise.all([fetchCatalogMuscleGroups(), fetchTrainingSplit()]);
      setCatalogMuscles(muscles);
      const filtered = filterScheduleToCatalog(split, muscles);
      setSchedule(filtered);
      setSavedSchedule(filtered);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load training split.';
      Alert.alert('Could not load split', message, [{ text: 'OK', onPress: () => router.back() }]);
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
    schedule != null && savedSchedule != null && !schedulesEqual(schedule, savedSchedule);

  async function handleSave() {
    if (!schedule) return;

    setSaving(true);
    try {
      const saved = await saveTrainingSplit(schedule);
      const filtered = filterScheduleToCatalog(saved, catalogMuscles);
      setSchedule(filtered);
      setSavedSchedule(filtered);
      Alert.alert('Saved', 'Your weekly split is updated. Coach advice will use this plan.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save split.';
      Alert.alert('Could not save split', message);
    } finally {
      setSaving(false);
    }
  }

  function handleResetDefault() {
    Alert.alert(
      'Reset to default split?',
      'This restores the default Push/Pull/Legs weekly plan (Mon chest/tri, Tue back/bi, etc.).',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          onPress: () => {
            if (!catalogMuscles.length) {
              setSchedule({ ...DEFAULT_TRAINING_SPLIT });
              return;
            }
            setSchedule(filterScheduleToCatalog(DEFAULT_TRAINING_SPLIT, catalogMuscles));
          },
        },
      ],
    );
  }

  return (
    <AppScreen title="Training split" showProfile={false}>
      {loading || !schedule ? (
        <ActivityIndicator style={styles.loader} size="large" color={homeTheme.colors.textPrimary} />
      ) : (
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.lead}>
            Set which muscle groups you train each day. Your coach uses this when you ask what to
            train tomorrow.
          </Text>

          <TrainingSplitEditor
            schedule={schedule}
            catalogMuscles={catalogMuscles}
            onChange={setSchedule}
          />

          <View style={styles.actions}>
            <Button
              label={saving ? 'Saving…' : 'Save split'}
              onPress={() => void handleSave()}
              disabled={!dirty || saving}
            />

            <Pressable
              style={({ pressed }) => [styles.resetButton, pressed && styles.resetButtonPressed]}
              onPress={handleResetDefault}
              disabled={saving}
            >
              <Text style={styles.resetButtonText}>Reset to default PPL split</Text>
            </Pressable>
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
  actions: {
    gap: 12,
    marginTop: 8,
  },
  resetButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  resetButtonPressed: { opacity: 0.7 },
  resetButtonText: {
    color: homeTheme.colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
});
