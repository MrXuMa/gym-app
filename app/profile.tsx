import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppScreen } from '@/components/layout/AppScreen';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/hooks/useProfile';
import { homeTheme } from '@/constants/theme';
import { WEIGHT_UNIT_LABEL } from '@/constants/units';
import {
  deleteWeightLog,
  fetchRecentWeightLogs,
  formatRelativeLogDate,
  getWeightValidationError,
  parseWeightInput,
  updateProfileWeight,
  WEIGHT_MAX_LBS,
  type WeightLogEntry,
} from '@/lib/profileWeight';
import { dayKeyFromDate, fetchTrainingSplit, summarizeSplitForDay } from '@/lib/trainingSplit';

const RECENT_LOGS_LIMIT = 10;

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, displayName, loading, reload } = useProfile();
  const goals = profile?.goals ?? [];
  const hasGoals = goals.length > 0;
  const [splitPreview, setSplitPreview] = useState<string | null>(null);

  const [weightInput, setWeightInput] = useState('');
  const [savingWeight, setSavingWeight] = useState(false);
  const [weightLogs, setWeightLogs] = useState<WeightLogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);
  const [logsExpanded, setLogsExpanded] = useState(false);

  useEffect(() => {
    if (profile?.weight != null) {
      setWeightInput(String(profile.weight));
    }
  }, [profile?.weight]);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const rows = await fetchRecentWeightLogs(RECENT_LOGS_LIMIT);
      setWeightLogs(rows);
    } catch {
      setWeightLogs([]);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const loadSplitPreview = useCallback(async () => {
    try {
      const schedule = await fetchTrainingSplit();
      const today = dayKeyFromDate(new Date());
      setSplitPreview(summarizeSplitForDay(schedule, today));
    } catch {
      setSplitPreview(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadSplitPreview();
    }, [loadSplitPreview]),
  );

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
      await loadLogs();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not update weight.';
      Alert.alert('Could not update weight', message);
    } finally {
      setSavingWeight(false);
    }
  }

  function confirmDeleteLog(log: WeightLogEntry) {
    Alert.alert(
      'Delete weight log?',
      `Remove the ${log.weight} ${WEIGHT_UNIT_LABEL} entry from ${formatRelativeLogDate(log.recordedAt)}. If this is your most recent log, your current weight will fall back to the previous entry.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => void handleDeleteLog(log),
        },
      ],
    );
  }

  async function handleDeleteLog(log: WeightLogEntry) {
    setDeletingLogId(log.id);
    try {
      await deleteWeightLog(log.id);
      await Promise.all([reload(), loadLogs()]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not delete log.';
      Alert.alert('Could not delete log', message);
    } finally {
      setDeletingLogId(null);
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
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
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

            <View style={styles.logsDivider} />

            <Pressable
              style={({ pressed }) => [styles.logsHeader, pressed && styles.logsHeaderPressed]}
              onPress={() => setLogsExpanded((prev) => !prev)}
              accessibilityRole="button"
              accessibilityLabel={
                logsExpanded ? 'Hide recent weight entries' : 'Show recent weight entries'
              }
              accessibilityState={{ expanded: logsExpanded }}
              hitSlop={6}
            >
              <View style={styles.logsHeaderLeft}>
                <Ionicons
                  name={logsExpanded ? 'chevron-down' : 'chevron-forward'}
                  size={14}
                  color={homeTheme.colors.textMuted}
                />
                <Text style={styles.logsTitle}>Recent entries</Text>
              </View>
              {weightLogs.length > 0 ? (
                <Text style={styles.logsCount}>
                  {logsExpanded ? `Showing last ${weightLogs.length}` : `${weightLogs.length} logged`}
                </Text>
              ) : null}
            </Pressable>

            {logsExpanded ? (
              logsLoading ? (
                <ActivityIndicator
                  size="small"
                  color={homeTheme.colors.textMuted}
                  style={styles.logsLoader}
                />
              ) : weightLogs.length === 0 ? (
                <Text style={styles.logsEmpty}>
                  No body weight entries yet. Update your weight above to start logging.
                </Text>
              ) : (
                <View style={styles.logsList}>
                  {weightLogs.map((log) => {
                    const deleting = deletingLogId === log.id;
                    const anyDeleting = deletingLogId !== null;

                    return (
                      <View key={log.id} style={styles.logRow}>
                        <View style={styles.logText}>
                          <Text style={styles.logWeight}>
                            {log.weight} {WEIGHT_UNIT_LABEL}
                          </Text>
                          <Text style={styles.logDate}>
                            {formatRelativeLogDate(log.recordedAt)}
                            {log.source === 'backfill' ? ' • backfill' : ''}
                          </Text>
                        </View>
                        <Pressable
                          style={({ pressed }) => [
                            styles.logDeleteButton,
                            (anyDeleting || pressed) && styles.logDeleteButtonPressed,
                          ]}
                          onPress={() => confirmDeleteLog(log)}
                          disabled={anyDeleting}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={`Delete weight log of ${log.weight} ${WEIGHT_UNIT_LABEL} from ${formatRelativeLogDate(log.recordedAt)}`}
                        >
                          {deleting ? (
                            <ActivityIndicator size="small" color={homeTheme.colors.danger} />
                          ) : (
                            <Ionicons name="trash-outline" size={18} color={homeTheme.colors.danger} />
                          )}
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              )
            ) : null}
          </View>

          <Pressable
            style={styles.goalsSection}
            onPress={() => router.push('/training-split')}
            accessibilityRole="button"
            accessibilityLabel="Training split"
          >
            <View style={styles.goalsHeader}>
              <Text style={styles.goalsTitle}>Training split</Text>
              <Text style={styles.goalsAction}>Edit split</Text>
            </View>
            <Text style={styles.goalsEmpty}>
              {splitPreview
                ? `Today: ${splitPreview}`
                : 'Set your weekly muscle-group plan for coach scheduling.'}
            </Text>
          </Pressable>

          <Pressable
            style={styles.goalsSection}
            onPress={() => router.push('/food-scan')}
            accessibilityRole="button"
            accessibilityLabel="Food scanner"
          >
            <View style={styles.goalsHeader}>
              <Text style={styles.goalsTitle}>Food Scanner</Text>
              <Text style={styles.goalsAction}>Log meal</Text>
            </View>
            <Text style={styles.goalsEmpty}>
              Snap a photo of your food to get an instant macro breakdown.
            </Text>
          </Pressable>

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
        </ScrollView>
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
  body: { flex: 1 },
  bodyContent: {
    paddingHorizontal: homeTheme.spacing.screen,
    paddingTop: 8,
    paddingBottom: 32,
  },
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
  logsDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: homeTheme.colors.border,
    marginTop: 6,
    marginBottom: 4,
  },
  logsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  logsHeaderPressed: { opacity: 0.65 },
  logsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logsTitle: {
    color: homeTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  logsCount: {
    color: homeTheme.colors.textMuted,
    fontSize: 11,
  },
  logsLoader: { marginTop: 8, alignSelf: 'flex-start' },
  logsEmpty: { color: homeTheme.colors.textMuted, fontSize: 13, lineHeight: 18 },
  logsList: { gap: 2 },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: homeTheme.colors.border,
    gap: 12,
  },
  logText: { flex: 1, gap: 2 },
  logWeight: {
    color: homeTheme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  logDate: {
    color: homeTheme.colors.textMuted,
    fontSize: 12,
  },
  logDeleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logDeleteButtonPressed: { opacity: 0.55 },
  signOut: {
    borderWidth: 1,
    borderColor: homeTheme.colors.danger,
    borderRadius: homeTheme.radius.button,
    paddingVertical: 14,
    alignItems: 'center',
  },
  signOutText: { color: homeTheme.colors.danger, fontSize: 15, fontWeight: '700' },
});
