import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { AppScreen } from '@/components/layout/AppScreen';
import { homeTheme } from '@/constants/theme';
import {
  dayKeyEastern,
  deleteDailyNutritionEntry,
  fetchDailyNutritionLog,
  msUntilNextEasternMidnight,
  type DailyNutritionLog,
} from '@/lib/foodAnalysis';

const ACCENT = homeTheme.colors.primary;
const CARD = homeTheme.colors.card;

function formatDateLabel(dateKey: string) {
  // dateKey is the Eastern calendar date; render it as-is (no TZ shift) by
  // anchoring to UTC midnight and formatting in UTC.
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export default function FoodDailyLogScreen() {
  const [dateKey, setDateKey] = useState(dayKeyEastern());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<DailyNutritionLog | null>(null);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);

  const load = useCallback(async (key: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDailyNutritionLog(key);
      setLog(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load daily log');
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-sync to the current Eastern day (and reload) every time the screen is focused.
  useFocusEffect(
    useCallback(() => {
      const key = dayKeyEastern();
      setDateKey(key);
      void load(key);
    }, [load]),
  );

  // Roll the log over to a fresh, blank day exactly at midnight Eastern while
  // the screen stays open.
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const scheduleRollover = () => {
      timeout = setTimeout(() => {
        const key = dayKeyEastern();
        setDateKey(key);
        void load(key);
        scheduleRollover();
      }, msUntilNextEasternMidnight());
    };
    scheduleRollover();
    return () => clearTimeout(timeout);
  }, [load]);

  const totals = useMemo(() => ({
    kcal: Math.round(log?.kcal ?? 0),
    protein_g: Number(log?.protein_g ?? 0),
    carbs_g: Number(log?.carbs_g ?? 0),
    fat_g: Number(log?.fat_g ?? 0),
  }), [log]);

  const entries = log?.entries ?? [];

  function confirmDeleteEntry(index: number) {
    Alert.alert(
      'Delete meal?',
      'This removes the meal from today\'s log and updates daily totals.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                setDeletingIndex(index);
                await deleteDailyNutritionEntry(dateKey, index);
                await load(dateKey);
              } catch (err: unknown) {
                Alert.alert('Error', err instanceof Error ? err.message : 'Could not delete meal');
              } finally {
                setDeletingIndex(null);
              }
            })();
          },
        },
      ],
    );
  }

  return (
    <AppScreen>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Daily Log</Text>
          <Text style={styles.subtitle}>{formatDateLabel(dateKey)}</Text>
        </View>

        {loading && (
          <View style={styles.centerCard}>
            <ActivityIndicator size="large" color={ACCENT} />
            <Text style={styles.mutedText}>Loading daily log...</Text>
          </View>
        )}

        {!loading && error && (
          <View style={styles.errorCard}>
            <Ionicons name="warning-outline" size={16} color={homeTheme.colors.destructive} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {!loading && !error && (
          <>
            <View style={styles.totalsCard}>
              <Text style={styles.totalKcal}>{totals.kcal}</Text>
              <Text style={styles.totalKcalLabel}>calories today</Text>
              <View style={styles.macrosRow}>
                <MacroPill label="Protein" value={`${totals.protein_g.toFixed(1)}g`} />
                <MacroPill label="Carbs" value={`${totals.carbs_g.toFixed(1)}g`} />
                <MacroPill label="Fat" value={`${totals.fat_g.toFixed(1)}g`} />
              </View>
            </View>

            {entries.length === 0 ? (
              <View style={styles.centerCard}>
                <Text style={styles.mutedText}>No meals logged yet today.</Text>
              </View>
            ) : (
              <View style={styles.listCard}>
                <Text style={styles.sectionLabel}>Meals Logged Today</Text>
                {entries.map((entry, index) => {
                  const entryTime = new Date(entry.logged_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  return (
                    <View key={`${entry.logged_at}-${index}`} style={styles.entryCard}>
                      <View style={styles.entryHeader}>
                        <Text style={styles.entryTime}>{entryTime}</Text>
                        <View style={styles.entryActions}>
                          <Text style={styles.entryKcal}>{Math.round(entry.totals.kcal)} kcal</Text>
                          <Pressable
                            onPress={() => confirmDeleteEntry(index)}
                            disabled={deletingIndex === index}
                            style={[styles.deleteBtn, deletingIndex === index && styles.deleteBtnDisabled]}
                          >
                            <Ionicons name="trash-outline" size={16} color={homeTheme.colors.destructive} />
                          </Pressable>
                        </View>
                      </View>
                      {entry.items.map((item, itemIndex) => (
                        <View key={`${item.name}-${itemIndex}`} style={styles.itemRow}>
                          <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                          <Text style={styles.itemKcal}>{Math.round(item.kcal)} kcal</Text>
                        </View>
                      ))}
                    </View>
                  );
                })}
              </View>
            )}

            <Pressable
              style={styles.refreshBtn}
              onPress={() => {
                const key = dayKeyEastern();
                setDateKey(key);
                void load(key);
              }}
            >
              <Ionicons name="refresh" size={16} color={ACCENT} />
              <Text style={styles.refreshBtnText}>Refresh</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </AppScreen>
  );
}

function MacroPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillValue}>{value}</Text>
      <Text style={styles.pillLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 48 },
  header: { alignItems: 'center', marginBottom: 16, marginTop: 8 },
  title: { color: homeTheme.colors.textPrimary, fontSize: 28, fontWeight: '800' },
  subtitle: { color: homeTheme.colors.textMuted, fontSize: 14, marginTop: 4 },
  totalsCard: { backgroundColor: CARD, borderRadius: 16, padding: 16, marginBottom: 14, alignItems: 'center' },
  totalKcal: { color: homeTheme.colors.textPrimary, fontSize: 56, fontWeight: '900', lineHeight: 60 },
  totalKcalLabel: { color: homeTheme.colors.textMuted, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 },
  macrosRow: { flexDirection: 'row', gap: 10, marginTop: 12, width: '100%' },
  pill: { flex: 1, backgroundColor: homeTheme.colors.muted, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  pillValue: { color: ACCENT, fontSize: 16, fontWeight: '800' },
  pillLabel: { color: homeTheme.colors.textMuted, fontSize: 11, textTransform: 'uppercase' },
  listCard: { backgroundColor: CARD, borderRadius: 16, padding: 14 },
  sectionLabel: { color: homeTheme.colors.textMuted, fontSize: 12, textTransform: 'uppercase', marginBottom: 10, letterSpacing: 1 },
  entryCard: { backgroundColor: homeTheme.colors.muted, borderRadius: 12, padding: 10, marginBottom: 10 },
  entryHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  entryActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  entryTime: { color: homeTheme.colors.textPrimary, fontSize: 13, fontWeight: '700' },
  entryKcal: { color: ACCENT, fontSize: 13, fontWeight: '700' },
  deleteBtn: { padding: 4, borderRadius: 8, backgroundColor: homeTheme.colors.card },
  deleteBtnDisabled: { opacity: 0.5 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  itemName: { color: homeTheme.colors.textPrimary, flex: 1, marginRight: 8 },
  itemKcal: { color: homeTheme.colors.textMuted, fontSize: 12 },
  centerCard: { alignItems: 'center', padding: 24, gap: 10, backgroundColor: CARD, borderRadius: 16 },
  mutedText: { color: homeTheme.colors.textMuted },
  errorCard: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: homeTheme.colors.card, borderRadius: 12, padding: 12 },
  errorText: { color: homeTheme.colors.destructive, flex: 1 },
  refreshBtn: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: homeTheme.colors.border,
    borderRadius: 999,
    paddingVertical: 10,
  },
  refreshBtnText: { color: ACCENT, fontWeight: '700' },
});
