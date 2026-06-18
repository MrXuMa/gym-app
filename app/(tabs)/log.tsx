import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppScreen } from '@/components/layout/AppScreen';
import { EditEntrySheet } from '@/components/food/EditEntrySheet';
import { ManualFoodSheet } from '@/components/food/ManualFoodSheet';
import { MacroSummary } from '@/components/food/MacroSummary';
import { MEAL_ACCENT, MEAL_ICONS, MACRO_COLORS } from '@/components/food/nutritionTheme';
import { homeTheme } from '@/constants/theme';
import {
  dayKeyEastern,
  entryMeal,
  fetchDailyNutritionLog,
  fetchWeekNutritionLogs,
  MEAL_LABELS,
  MEAL_ORDER,
  mondayOfWeekContaining,
  msUntilNextEasternMidnight,
  shiftWeek,
  type DailyNutritionLog,
  type MealType,
  type NutritionEntry,
  type WeekNutritionSummary,
} from '@/lib/foodAnalysis';

type ViewMode = 'day' | 'week';

const CARD = homeTheme.colors.card;
const ACCENT = homeTheme.colors.primary;
const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatDateLabel(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function formatWeekRange(weekStart: string) {
  const end = new Date(`${weekStart}T12:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 6);
  const startLabel = new Date(`${weekStart}T00:00:00.000Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const endLabel = end.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  return `${startLabel} – ${endLabel}`;
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

type GroupedMeal = {
  meal: MealType;
  entries: Array<{ entry: NutritionEntry; index: number }>;
  kcal: number;
};

function groupEntriesByMeal(entries: NutritionEntry[]): GroupedMeal[] {
  const buckets = new Map<MealType, Array<{ entry: NutritionEntry; index: number }>>();
  for (const meal of MEAL_ORDER) {
    buckets.set(meal, []);
  }
  entries.forEach((entry, index) => {
    const meal = entryMeal(entry);
    buckets.get(meal)?.push({ entry, index });
  });

  return MEAL_ORDER.map((meal) => {
    const mealEntries = buckets.get(meal) ?? [];
    const kcal = mealEntries.reduce((sum, { entry }) => sum + entry.totals.kcal, 0);
    return { meal, entries: mealEntries, kcal };
  });
}

export default function LogScreen() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [dateKey, setDateKey] = useState(dayKeyEastern());
  const [weekStart, setWeekStart] = useState(() => mondayOfWeekContaining(dayKeyEastern()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dayLog, setDayLog] = useState<DailyNutritionLog | null>(null);
  const [weekSummary, setWeekSummary] = useState<WeekNutritionSummary | null>(null);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [manualAddOpen, setManualAddOpen] = useState(false);
  const [manualAddMeal, setManualAddMeal] = useState<MealType | null>(null);
  const dayRequestRef = useRef(0);
  const weekRequestRef = useRef(0);
  const hasFocusedRef = useRef(false);

  function openManualAdd(meal?: MealType) {
    setManualAddMeal(meal ?? null);
    setManualAddOpen(true);
  }

  function closeManualAdd() {
    setManualAddOpen(false);
    setManualAddMeal(null);
  }

  const loadDay = useCallback(async (key: string) => {
    const requestId = ++dayRequestRef.current;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDailyNutritionLog(key);
      if (requestId !== dayRequestRef.current) return;
      setDayLog(data);
    } catch (err: unknown) {
      if (requestId !== dayRequestRef.current) return;
      setError(err instanceof Error ? err.message : 'Could not load log');
    } finally {
      if (requestId === dayRequestRef.current) setLoading(false);
    }
  }, []);

  const loadWeek = useCallback(async (monday: string) => {
    const requestId = ++weekRequestRef.current;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWeekNutritionLogs(monday);
      if (requestId !== weekRequestRef.current) return;
      setWeekSummary(data);
    } catch (err: unknown) {
      if (requestId !== weekRequestRef.current) return;
      setError(err instanceof Error ? err.message : 'Could not load week');
    } finally {
      if (requestId === weekRequestRef.current) setLoading(false);
    }
  }, []);

  const reload = useCallback(() => {
    if (viewMode === 'day') {
      void loadDay(dateKey);
    } else {
      void loadWeek(weekStart);
    }
  }, [viewMode, dateKey, weekStart, loadDay, loadWeek]);

  useFocusEffect(
    useCallback(() => {
      if (!hasFocusedRef.current) {
        hasFocusedRef.current = true;
        return;
      }
      reload();
    }, [reload]),
  );

  useEffect(() => {
    reload();
    setEditIndex(null);
  }, [viewMode, dateKey, weekStart, reload]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const scheduleRollover = () => {
      timeout = setTimeout(() => {
        const today = dayKeyEastern();
        setDateKey(today);
        setWeekStart(mondayOfWeekContaining(today));
        scheduleRollover();
      }, msUntilNextEasternMidnight());
    };
    scheduleRollover();
    return () => clearTimeout(timeout);
  }, []);

  const dayTotals = useMemo(
    () => ({
      kcal: Math.round(dayLog?.kcal ?? 0),
      protein_g: Number(dayLog?.protein_g ?? 0),
      carbs_g: Number(dayLog?.carbs_g ?? 0),
      fat_g: Number(dayLog?.fat_g ?? 0),
    }),
    [dayLog],
  );

  const mealGroups = useMemo(
    () => groupEntriesByMeal(dayLog?.entries ?? []),
    [dayLog],
  );

  const isToday = dateKey === dayKeyEastern();
  const isFutureDay = dateKey > dayKeyEastern();
  const editEntry = editIndex !== null ? dayLog?.entries[editIndex] ?? null : null;
  const hasDayEntries = (dayLog?.entries.length ?? 0) > 0;

  function openDayFromWeek(targetDate: string) {
    setDateKey(targetDate);
    setViewMode('day');
  }

  return (
    <AppScreen title="Log">
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.subtitle}>
            {viewMode === 'day' ? formatDateLabel(dateKey) : formatWeekRange(weekStart)}
          </Text>

          <View style={styles.segmented}>
            <SegmentButton label="Day" active={viewMode === 'day'} onPress={() => setViewMode('day')} />
            <SegmentButton label="Week" active={viewMode === 'week'} onPress={() => setViewMode('week')} />
          </View>
        </View>

        {viewMode === 'day' && (
          <View style={styles.navRow}>
            <NavButton
              icon="chevron-back"
              onPress={() => setDateKey((k) => addDaysToDateKey(k, -1))}
              accessibilityLabel="Previous day"
            />
            <Pressable
              onPress={() => {
                const today = dayKeyEastern();
                setDateKey(today);
                setWeekStart(mondayOfWeekContaining(today));
              }}
              disabled={isToday}
            >
              <Text style={[styles.todayBtn, isToday && styles.todayBtnMuted]}>
                {isToday ? 'Today' : 'Go to today'}
              </Text>
            </Pressable>
            <NavButton
              icon="chevron-forward"
              onPress={() => setDateKey((k) => addDaysToDateKey(k, 1))}
              disabled={dateKey >= dayKeyEastern()}
              accessibilityLabel="Next day"
            />
          </View>
        )}

        {viewMode === 'week' && (
          <View style={styles.navRow}>
            <NavButton icon="chevron-back" onPress={() => setWeekStart((w) => shiftWeek(w, -1))} accessibilityLabel="Previous week" />
            <Pressable
              onPress={() => {
                const today = dayKeyEastern();
                setWeekStart(mondayOfWeekContaining(today));
              }}
            >
              <Text style={styles.todayBtn}>This week</Text>
            </Pressable>
            <NavButton icon="chevron-forward" onPress={() => setWeekStart((w) => shiftWeek(w, 1))} accessibilityLabel="Next week" />
          </View>
        )}

        {loading && !dayLog && !weekSummary && (
          <View style={styles.centerCard}>
            <ActivityIndicator size="large" color={ACCENT} />
            <Text style={styles.mutedText}>Loading…</Text>
          </View>
        )}

        {!loading && error && (
          <View style={styles.errorCard}>
            <Ionicons name="warning-outline" size={16} color={homeTheme.colors.destructive} />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={reload} hitSlop={8} accessibilityRole="button" accessibilityLabel="Try again">
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        )}

        {!error && viewMode === 'day' && (dayLog || !loading) && (
          <>
            {isFutureDay && (
              <View style={styles.futureBanner}>
                <Text style={styles.futureBannerText}>Future date — log meals when the day arrives.</Text>
              </View>
            )}

            <View style={styles.totalsCard}>
              <MacroSummary totals={dayTotals} kcalLabel={isToday ? 'calories today' : 'calories'} />
            </View>

            {!hasDayEntries && (
              <View style={styles.emptyDayCard}>
                <Text style={styles.emptyDayTitle}>No meals logged</Text>
                <Text style={styles.emptyDayText}>Search USDA foods or scan a photo to get started.</Text>
              </View>
            )}

            {mealGroups.map(({ meal, entries, kcal }) => (
              <MealSection
                key={meal}
                meal={meal}
                kcal={kcal}
                entries={entries}
                onEdit={(index) => setEditIndex(index)}
                onManualAdd={() => openManualAdd(meal)}
              />
            ))}

            <View style={styles.actionRow}>
              <Pressable style={styles.secondaryCta} onPress={() => openManualAdd()}>
                <Ionicons name="search-outline" size={20} color={ACCENT} />
                <Text style={styles.scanCtaText}>Add manually</Text>
              </Pressable>
              <Pressable style={styles.secondaryCta} onPress={() => router.push('/(tabs)/food-scan')}>
                <Ionicons name="camera-outline" size={20} color={ACCENT} />
                <Text style={styles.scanCtaText}>Scan food</Text>
              </Pressable>
            </View>
          </>
        )}

        {!error && viewMode === 'week' && weekSummary && (
          <>
            <View style={styles.totalsCard}>
              {weekSummary.daysWithData === 0 ? (
                <Text style={styles.weekEmptyText}>No meals logged this week</Text>
              ) : (
                <>
                  <Text style={styles.weekAvg}>{weekSummary.averageKcal}</Text>
                  <Text style={styles.weekAvgLabel}>avg kcal / day</Text>
                </>
              )}
              <MacroSummary totals={weekSummary.totals} kcalLabel="week total" compact />
            </View>

            <View style={styles.weekGrid}>
              {weekSummary.days.map((day, i) => {
                const hasLog = day.log !== null;
                const kcal = Math.round(day.log?.kcal ?? 0);
                const isTodayCard = day.dateKey === dayKeyEastern();
                const macroTotal =
                  (day.log?.protein_g ?? 0) + (day.log?.carbs_g ?? 0) + (day.log?.fat_g ?? 0) || 1;
                return (
                  <Pressable
                    key={day.dateKey}
                    style={[styles.weekDayCard, isTodayCard && styles.weekDayCardToday]}
                    onPress={() => openDayFromWeek(day.dateKey)}
                    accessibilityRole="button"
                    accessibilityLabel={`${WEEKDAY_SHORT[i]}, ${hasLog ? `${kcal} calories` : 'no log'}`}
                  >
                    <Text style={styles.weekDayName}>{WEEKDAY_SHORT[i]}</Text>
                    <Text style={[styles.weekDayKcal, !hasLog && styles.weekDayKcalEmpty]}>
                      {hasLog ? kcal : '—'}
                    </Text>
                    <Text style={styles.weekDayUnit}>{hasLog ? 'kcal' : 'no log'}</Text>
                    {hasLog && kcal > 0 && (
                      <View style={styles.weekMiniBar}>
                        <View
                          style={[
                            styles.weekMiniSegment,
                            { flex: (day.log?.protein_g ?? 0) / macroTotal, backgroundColor: MACRO_COLORS.protein },
                          ]}
                        />
                        <View
                          style={[
                            styles.weekMiniSegment,
                            { flex: (day.log?.carbs_g ?? 0) / macroTotal, backgroundColor: MACRO_COLORS.carbs },
                          ]}
                        />
                        <View
                          style={[
                            styles.weekMiniSegment,
                            { flex: (day.log?.fat_g ?? 0) / macroTotal, backgroundColor: MACRO_COLORS.fat },
                          ]}
                        />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      <ManualFoodSheet
        visible={manualAddOpen}
        dateKey={dateKey}
        initialMeal={manualAddMeal ?? undefined}
        onClose={closeManualAdd}
        onSaved={reload}
      />

      <EditEntrySheet
        visible={editIndex !== null}
        dateKey={dateKey}
        entryIndex={editIndex ?? 0}
        entry={editEntry}
        onClose={() => setEditIndex(null)}
        onSaved={reload}
      />
    </AppScreen>
  );
}

function SegmentButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.segment, active && styles.segmentActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function NavButton({
  icon,
  onPress,
  disabled = false,
  accessibilityLabel,
}: {
  icon: 'chevron-back' | 'chevron-forward';
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      style={[styles.navBtn, disabled && styles.navBtnDisabled]}
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
    >
      <Ionicons name={icon} size={22} color={homeTheme.colors.textPrimary} />
    </Pressable>
  );
}

function MealSection({
  meal,
  kcal,
  entries,
  onEdit,
  onManualAdd,
}: {
  meal: MealType;
  kcal: number;
  entries: Array<{ entry: NutritionEntry; index: number }>;
  onEdit: (index: number) => void;
  onManualAdd: () => void;
}) {
  const accent = MEAL_ACCENT[meal];
  const icon = MEAL_ICONS[meal];

  return (
    <View style={styles.mealSection}>
      <View style={styles.mealHeader}>
        <View style={styles.mealTitleRow}>
          <Ionicons name={icon} size={18} color={accent} />
          <Text style={[styles.mealTitle, { color: accent }]}>{MEAL_LABELS[meal]}</Text>
        </View>
        <Text style={styles.mealKcal}>{kcal > 0 ? `${Math.round(kcal)} kcal` : '—'}</Text>
      </View>

      {entries.length === 0 ? (
        <Pressable style={styles.emptyMeal} onPress={onManualAdd} accessibilityRole="button" accessibilityLabel={`Add food to ${MEAL_LABELS[meal]}`}>
          <Text style={styles.emptyMealText}>Nothing logged yet</Text>
          <Ionicons name="add" size={18} color={homeTheme.colors.textMuted} />
        </Pressable>
      ) : (
        <>
          {entries.map(({ entry, index }) => {
            const time = new Date(entry.logged_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });
            return (
              <Pressable key={`${entry.logged_at}-${index}`} style={styles.entryCard} onPress={() => onEdit(index)} accessibilityRole="button" accessibilityLabel={`Edit meal, ${Math.round(entry.totals.kcal)} calories`}>
                <View style={styles.entryTop}>
                  <Text style={styles.entryTime}>{time}</Text>
                  <View style={styles.entryMeta}>
                    <Text style={styles.entryKcal}>{Math.round(entry.totals.kcal)} kcal</Text>
                    <Ionicons name="chevron-forward" size={14} color={homeTheme.colors.textMuted} />
                  </View>
                </View>
                {entry.items.map((item, itemIndex) => (
                  <View key={`${item.name}-${itemIndex}`} style={styles.itemRow}>
                    <Text style={styles.itemName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.itemKcal}>{Math.round(item.kcal)}</Text>
                  </View>
                ))}
              </Pressable>
            );
          })}
          <Pressable style={styles.addFoodRow} onPress={onManualAdd} accessibilityRole="button" accessibilityLabel={`Add food to ${MEAL_LABELS[meal]}`}>
            <Ionicons name="add" size={18} color={accent} />
            <Text style={[styles.addFoodText, { color: accent }]}>Add food</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: homeTheme.spacing.screen, paddingBottom: 48 },
  header: { alignItems: 'center', marginBottom: 12 },
  subtitle: { color: homeTheme.colors.textMuted, fontSize: 14, textAlign: 'center' },
  segmented: {
    flexDirection: 'row',
    marginTop: 12,
    backgroundColor: homeTheme.colors.muted,
    borderRadius: 12,
    padding: 4,
    width: '100%',
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  segmentActive: { backgroundColor: CARD },
  segmentLabel: { color: homeTheme.colors.textMuted, fontSize: 14, fontWeight: '600' },
  segmentLabelActive: { color: homeTheme.colors.textPrimary, fontWeight: '800' },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: CARD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnDisabled: { opacity: 0.35 },
  todayBtn: { color: ACCENT, fontSize: 14, fontWeight: '700' },
  todayBtnMuted: { color: homeTheme.colors.textMuted },
  totalsCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  weekAvg: {
    color: homeTheme.colors.textPrimary,
    fontSize: 40,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 44,
  },
  weekAvgLabel: {
    color: homeTheme.colors.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 12,
  },
  weekEmptyText: {
    color: homeTheme.colors.textMuted,
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: '600',
  },
  weekGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  weekDayCard: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: homeTheme.colors.border,
  },
  weekDayCardToday: { borderColor: ACCENT },
  weekDayName: { color: homeTheme.colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  weekDayKcal: { color: homeTheme.colors.textPrimary, fontSize: 28, fontWeight: '900', marginTop: 4 },
  weekDayKcalEmpty: { color: homeTheme.colors.textMuted, fontSize: 24 },
  weekDayUnit: { color: homeTheme.colors.textMuted, fontSize: 11, marginBottom: 8 },
  weekMiniBar: { flexDirection: 'row', height: 4, borderRadius: 2, overflow: 'hidden', gap: 1 },
  weekMiniSegment: { borderRadius: 2 },
  mealSection: { marginBottom: 14 },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  mealTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mealTitle: { fontSize: 16, fontWeight: '800' },
  mealKcal: { color: homeTheme.colors.textMuted, fontSize: 14, fontWeight: '600' },
  emptyMeal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: homeTheme.colors.border,
    borderStyle: 'dashed',
  },
  emptyMealText: { color: homeTheme.colors.textMuted, fontSize: 14 },
  addFoodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: homeTheme.colors.border,
    borderStyle: 'dashed',
  },
  addFoodText: { fontSize: 14, fontWeight: '700' },
  entryCard: {
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  entryTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  entryMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  entryTime: { color: homeTheme.colors.textMuted, fontSize: 12, fontWeight: '600' },
  entryKcal: { color: ACCENT, fontSize: 13, fontWeight: '700' },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  itemName: { color: homeTheme.colors.textPrimary, flex: 1, marginRight: 8, fontSize: 14 },
  itemKcal: { color: homeTheme.colors.textMuted, fontSize: 12 },
  scanCtaText: { color: ACCENT, fontWeight: '700', fontSize: 15 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  secondaryCta: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: homeTheme.colors.border,
    backgroundColor: CARD,
  },
  centerCard: { alignItems: 'center', padding: 32, gap: 10, backgroundColor: CARD, borderRadius: 16 },
  mutedText: { color: homeTheme.colors.textMuted },
  errorCard: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  errorText: { color: homeTheme.colors.destructive, flex: 1 },
  retryText: { color: ACCENT, fontWeight: '700', fontSize: 14 },
  futureBanner: {
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: homeTheme.colors.border,
  },
  futureBannerText: { color: homeTheme.colors.textMuted, fontSize: 14, textAlign: 'center' },
  emptyDayCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    gap: 6,
  },
  emptyDayTitle: { color: homeTheme.colors.textPrimary, fontSize: 17, fontWeight: '800' },
  emptyDayText: { color: homeTheme.colors.textMuted, fontSize: 14, textAlign: 'center' },
});
