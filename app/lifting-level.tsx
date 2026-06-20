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
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { notify } from '@/lib/platformAlert';
import { AppScreen } from '@/components/layout/AppScreen';
import { Button } from '@/components/ui/button';
import {
  fetchProfileLiftingLevel,
  LIFTING_LEVEL_OPTIONS,
  type LiftingLevel,
  saveProfileLiftingLevel,
} from '@/lib/liftingLevel';
import { homeTheme } from '@/constants/theme';

export default function LiftingLevelScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<LiftingLevel | null>(null);
  const [initial, setInitial] = useState<LiftingLevel | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadLevel = useCallback(async () => {
    setLoading(true);
    try {
      const level = await fetchProfileLiftingLevel();
      setSelected(level);
      setInitial(level);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not load lifting level.');
      notify('Could not load lifting level', message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadLevel();
    }, [loadLevel]),
  );

  async function handleSave() {
    if (!selected) {
      notify('Select a level', 'Choose the option that best matches your training history.');
      return;
    }

    setSaving(true);
    try {
      const saved = await saveProfileLiftingLevel(selected);
      setInitial(saved);
      setSelected(saved);
      router.back();
    } catch (error) {
      const message = getErrorMessage(error, 'Could not save lifting level.');
      notify('Could not save', message);
    } finally {
      setSaving(false);
    }
  }

  const changed = selected != null && selected !== initial;

  return (
    <AppScreen title="Lifting level" showProfile={false}>
      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color={homeTheme.colors.textPrimary} />
      ) : (
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.lead}>
            Your coach uses this to scale exercise selection, volume, and rep schemes in generated
            workouts.
          </Text>

          <View style={styles.list}>
            {LIFTING_LEVEL_OPTIONS.map((option) => {
              const active = selected === option.value;
              return (
                <Pressable
                  key={option.value}
                  style={[styles.option, active && styles.optionActive]}
                  onPress={() => setSelected(option.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                >
                  <View style={styles.optionHeader}>
                    <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>
                      {option.label}
                    </Text>
                    <Text style={styles.optionYears}>{option.years}</Text>
                  </View>
                  <Text style={styles.optionDescription}>{option.description}</Text>
                  {active ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={homeTheme.colors.primary}
                      style={styles.check}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          <Button
            label="Save lifting level"
            onPress={() => void handleSave()}
            loading={saving}
            disabled={!changed || saving}
            fullWidth
          />
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
    paddingBottom: 32,
    gap: 20,
  },
  lead: {
    color: homeTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  list: { gap: 10 },
  option: {
    backgroundColor: homeTheme.colors.card,
    borderRadius: homeTheme.radius.card,
    borderWidth: 1,
    borderColor: homeTheme.colors.border,
    padding: 16,
    gap: 6,
  },
  optionActive: {
    borderColor: homeTheme.colors.primary,
    backgroundColor: homeTheme.colors.background,
  },
  optionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  optionLabel: {
    color: homeTheme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  optionLabelActive: {
    color: homeTheme.colors.primary,
  },
  optionYears: {
    color: homeTheme.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  optionDescription: {
    color: homeTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    paddingRight: 28,
  },
  check: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
});
