import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { AppScreen } from '@/components/layout/AppScreen';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/hooks/useProfile';
import { homeTheme } from '@/constants/theme';
import { WEIGHT_UNIT_LABEL } from '@/constants/units';
import {
  getWeightValidationError,
  parseWeightInput,
  updateProfileWeight,
  WEIGHT_MAX_LBS,
} from '@/lib/profileWeight';

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, displayName, loading, reload } = useProfile();
  const goals = profile?.goals ?? [];
  const hasGoals = goals.length > 0;

  const [weightInput, setWeightInput] = useState('');
  const [savingWeight, setSavingWeight] = useState(false);

  useEffect(() => {
    if (profile?.weight != null) {
      setWeightInput(String(profile.weight));
    }
  }, [profile?.weight]);

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert('Sign out failed', error.message);
  }

  async function handleSaveWeight() {
    const parsed = parseWeightInput(weightInput);
    const validationError = getWeightValidationError(parsed);

    if (validationError || parsed == null) {
      Alert.alert('Invalid weight', validationError ?? 'Enter a number.');
      return;
    }

    Keyboard.dismiss();
    setSavingWeight(true);

    try {
      const saved = await updateProfileWeight(parsed);
      setWeightInput(String(saved));
      await reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not update weight.';
      Alert.alert('Could not update weight', message);
    } finally {
      setSavingWeight(false);
    }
  }

  const parsedWeight = parseWeightInput(weightInput);
  const validationError = weightInput.trim() ? getWeightValidationError(parsedWeight) : null;
  const weightChanged = parsedWeight != null && parsedWeight !== profile?.weight;
  const canSaveWeight = weightChanged && validationError == null && !savingWeight;

  return (
    <AppScreen title="Profile" showProfile={false}>
      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color={homeTheme.colors.textPrimary} />
      ) : (
        <View style={styles.body}>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.username}>@{profile?.username ?? '—'}</Text>

          <View style={styles.card}>
            <Row label="Email" value={profile?.email ?? '—'} />
            <Row label="Age" value={profile?.age != null ? String(profile.age) : '—'} />
            <Row
              label="Weight"
              value={profile?.weight != null ? `${profile.weight} ${WEIGHT_UNIT_LABEL}` : '—'}
            />
            <Row label="Height" value={profile?.height != null ? `${profile.height} in` : '—'} />
          </View>

          <View style={styles.weightSection}>
            <View style={styles.weightHeader}>
              <Text style={styles.weightTitle}>Body weight</Text>
              <Text style={styles.weightHint}>Used by coach context</Text>
            </View>

            <Text style={styles.weightLabel}>Current weight ({WEIGHT_UNIT_LABEL})</Text>

            <View style={styles.weightRow}>
              <TextInput
                style={styles.weightInput}
                value={weightInput}
                onChangeText={setWeightInput}
                keyboardType="decimal-pad"
                inputMode="decimal"
                placeholder="e.g. 185"
                placeholderTextColor={homeTheme.colors.textMuted}
                maxLength={6}
                editable={!savingWeight}
                returnKeyType="done"
                onSubmitEditing={() => {
                  if (canSaveWeight) void handleSaveWeight();
                }}
              />

              <Pressable
                style={[styles.weightButton, !canSaveWeight && styles.weightButtonDisabled]}
                onPress={() => void handleSaveWeight()}
                disabled={!canSaveWeight}
              >
                {savingWeight ? (
                  <ActivityIndicator size="small" color={homeTheme.colors.tabBar} />
                ) : (
                  <Text style={styles.weightButtonText}>Update</Text>
                )}
              </Pressable>
            </View>

            {validationError ? (
              <Text style={styles.weightError}>{validationError}</Text>
            ) : (
              <Text style={styles.weightHelp}>
                Enter a number between 1 and {WEIGHT_MAX_LBS} {WEIGHT_UNIT_LABEL}.
              </Text>
            )}
          </View>

          <Pressable
            style={styles.goalsSection}
            onPress={() => router.push('/goals')}
            accessibilityRole="button"
            accessibilityLabel="Personal goals"
          >
            <View style={styles.goalsHeader}>
              <Text style={styles.goalsTitle}>Personal goals</Text>
              <Text style={styles.goalsAction}>{hasGoals ? 'Update goals' : 'Add goals'}</Text>
            </View>

            {hasGoals ? (
              <View style={styles.goalsList}>
                {goals.map((goal, index) => (
                  <View key={`${goal}-${index}`} style={styles.goalRow}>
                    <Text style={styles.goalBullet}>•</Text>
                    <Text style={styles.goalText}>{goal}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.goalsEmpty}>Set up to 3 training goals for your coach.</Text>
            )}
          </Pressable>

          <Pressable style={styles.signOut} onPress={signOut}>
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>
      )}
    </AppScreen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: 48 },
  body: { flex: 1, paddingHorizontal: homeTheme.spacing.screen, paddingTop: 8 },
  name: { color: homeTheme.colors.textPrimary, fontSize: 26, fontWeight: '700' },
  username: { color: homeTheme.colors.textMuted, fontSize: 15, marginTop: 4, marginBottom: 20 },
  card: {
    backgroundColor: homeTheme.colors.card,
    borderRadius: homeTheme.radius.card,
    borderWidth: 1,
    borderColor: homeTheme.colors.border,
    padding: 16,
    gap: 12,
    marginBottom: 16,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowLabel: { color: homeTheme.colors.textMuted, fontSize: 14 },
  rowValue: {
    color: homeTheme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  goalsSection: {
    backgroundColor: homeTheme.colors.card,
    borderRadius: homeTheme.radius.card,
    borderWidth: 1,
    borderColor: homeTheme.colors.border,
    padding: 16,
    marginBottom: 24,
    gap: 10,
  },
  goalsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  goalsTitle: { color: homeTheme.colors.textPrimary, fontSize: 16, fontWeight: '700' },
  goalsAction: { color: homeTheme.colors.primary, fontSize: 13, fontWeight: '700' },
  goalsList: { gap: 6 },
  goalRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  goalBullet: { color: homeTheme.colors.primary, fontSize: 16, lineHeight: 20 },
  goalText: {
    flex: 1,
    color: homeTheme.colors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
    textTransform: 'capitalize',
  },
  goalsEmpty: { color: homeTheme.colors.textMuted, fontSize: 14, lineHeight: 20 },
  weightSection: {
    backgroundColor: homeTheme.colors.card,
    borderRadius: homeTheme.radius.card,
    borderWidth: 1,
    borderColor: homeTheme.colors.border,
    padding: 16,
    marginBottom: 16,
    gap: 10,
  },
  weightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  weightTitle: { color: homeTheme.colors.textPrimary, fontSize: 16, fontWeight: '700' },
  weightHint: { color: homeTheme.colors.textMuted, fontSize: 12 },
  weightLabel: {
    color: homeTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  weightRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  weightInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: homeTheme.colors.border,
    borderRadius: homeTheme.radius.button,
    backgroundColor: homeTheme.colors.background,
    color: homeTheme.colors.textPrimary,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  weightButton: {
    backgroundColor: homeTheme.colors.navYellow,
    borderRadius: homeTheme.radius.button,
    paddingHorizontal: 18,
    paddingVertical: 12,
    minWidth: 92,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weightButtonDisabled: { opacity: 0.5 },
  weightButtonText: { color: homeTheme.colors.tabBar, fontWeight: '700', fontSize: 14 },
  weightHelp: { color: homeTheme.colors.textMuted, fontSize: 12 },
  weightError: { color: homeTheme.colors.danger, fontSize: 12 },
  signOut: {
    borderWidth: 1,
    borderColor: homeTheme.colors.danger,
    borderRadius: homeTheme.radius.button,
    paddingVertical: 14,
    alignItems: 'center',
  },
  signOutText: { color: homeTheme.colors.danger, fontSize: 15, fontWeight: '700' },
});
