import { useCallback, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppScreen } from '@/components/layout/AppScreen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  MAX_GOALS,
  MAX_WORDS_PER_GOAL,
  SAMPLE_GOALS,
  firstEmptySlotIndex,
  slotsFromGoals,
  validateGoalText,
} from '@/lib/goals';
import { fetchProfileGoals, saveProfileGoals } from '@/lib/profileGoals';
import { homeTheme } from '@/constants/theme';

export default function GoalsScreen() {
  const router = useRouter();
  const [slots, setSlots] = useState<[string, string, string]>(['', '', '']);
  const [hasExistingGoals, setHasExistingGoals] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadGoals = useCallback(async () => {
    setLoading(true);

    try {
      const goals = await fetchProfileGoals();
      setSlots(slotsFromGoals(goals));
      setHasExistingGoals(goals.length > 0);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load goals.';
      Alert.alert('Could not load goals', message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadGoals();
    }, [loadGoals]),
  );

  function updateSlot(index: number, value: string) {
    setSlots((current) => {
      const next = [...current] as [string, string, string];
      next[index] = value;
      return next;
    });
  }

  function applySampleGoal(sample: string) {
    const emptyIndex = firstEmptySlotIndex(slots);
    if (emptyIndex == null) {
      Alert.alert('All slots full', 'Clear a goal slot to use a sample.');
      return;
    }

    updateSlot(emptyIndex, sample);
  }

  async function handleSave() {
    for (const slot of slots) {
      const error = validateGoalText(slot);
      if (error) {
        Alert.alert('Invalid goal', error);
        return;
      }
    }

    const filled = slots.map((slot) => slot.trim()).filter(Boolean);
    if (filled.length === 0) {
      Alert.alert('Add a goal', 'Enter at least one personal goal.');
      return;
    }

    setSaving(true);

    try {
      await saveProfileGoals(slots);
      router.back();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save goals.';
      Alert.alert('Could not save goals', message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppScreen
      title="Personal Goals"
      showProfile={false}
      headerLeft={
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Go back">
          <Text style={styles.backButton}>Back</Text>
        </Pressable>
      }
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.lead}>
            Add up to {MAX_GOALS} goals ({MAX_WORDS_PER_GOAL} words max each). You can leave unused slots empty.
          </Text>

          <View style={styles.samples}>
            <Text style={styles.samplesLabel}>Quick add</Text>
            <View style={styles.sampleRow}>
              {SAMPLE_GOALS.map((sample) => (
                <Pressable
                  key={sample}
                  style={styles.sampleChip}
                  onPress={() => applySampleGoal(sample)}
                  accessibilityRole="button"
                  accessibilityLabel={`Add sample goal ${sample}`}
                >
                  <Text style={styles.sampleChipText}>{sample}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.slots}>
            {slots.map((slot, index) => (
              <View key={index} style={styles.slotBlock}>
                <Text style={styles.slotLabel}>Goal {index + 1}</Text>
                <Input
                  value={slot}
                  onChangeText={(value) => updateSlot(index, value)}
                  placeholder={index === 0 ? 'e.g. lose weight' : 'Optional'}
                  editable={!loading && !saving}
                  maxLength={120}
                />
              </View>
            ))}
          </View>

          <Button
            label={hasExistingGoals ? 'Update goals' : 'Add goals'}
            onPress={handleSave}
            loading={saving}
            disabled={loading}
            fullWidth
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: {
    paddingHorizontal: homeTheme.spacing.screen,
    paddingTop: 8,
    paddingBottom: 32,
    gap: 20,
  },
  backButton: {
    color: homeTheme.colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  lead: {
    color: homeTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  samples: { gap: 10 },
  samplesLabel: {
    color: homeTheme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  sampleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sampleChip: {
    borderWidth: 1,
    borderColor: homeTheme.colors.border,
    borderRadius: homeTheme.radius.button,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: homeTheme.colors.card,
  },
  sampleChipText: {
    color: homeTheme.colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  slots: { gap: 14 },
  slotBlock: { gap: 6 },
  slotLabel: {
    color: homeTheme.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
});
