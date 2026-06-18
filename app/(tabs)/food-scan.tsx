import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AppScreen } from '@/components/layout/AppScreen';
import { FoodScanErrorScreen } from '@/components/food/FoodScanErrorScreen';
import { MacroSummary } from '@/components/food/MacroSummary';
import { MealPicker } from '@/components/food/MealPicker';
import { homeTheme } from '@/constants/theme';
import {
  pickFoodImage,
  prepareImageForAnalysis,
  analyzeFood,
  saveNutritionLog,
  inferMealFromTime,
  isFoodAnalysisError,
  FOOD_SCAN_DAILY_LIMIT,
  MEAL_LABELS,
  type FoodItem,
  type FoodAnalysisErrorCode,
  type MealType,
} from '@/lib/foodAnalysis';

type Step = 'idle' | 'picking' | 'analyzing' | 'review' | 'saving' | 'done' | 'error';

const ACCENT = homeTheme.colors.primary;
const CARD = homeTheme.colors.card;

export default function FoodScanScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('idle');
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [items, setItems] = useState<FoodItem[]>([]);
  const [meal, setMeal] = useState<MealType>(inferMealFromTime());
  const [errorCode, setErrorCode] = useState<FoodAnalysisErrorCode>('analysis_failed');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastScanSource, setLastScanSource] = useState<'camera' | 'library' | null>(null);
  const [atDailyLimit, setAtDailyLimit] = useState(false);

  function setAnalysisError(err: unknown) {
    if (isFoodAnalysisError(err)) {
      setErrorCode(err.code);
      setErrorMessage(err.message);
      if (err.code === 'limit_reached') {
        setAtDailyLimit(true);
      }
    } else {
      setErrorCode('analysis_failed');
      setErrorMessage('We could not analyze this photo. Please try again.');
    }
    setStep('error');
  }

  async function startScan(source: 'camera' | 'library') {
    if (atDailyLimit) {
      setErrorCode('limit_reached');
      setErrorMessage(
        `Limit reached. You can scan up to ${FOOD_SCAN_DAILY_LIMIT} meals per day. Try again tomorrow.`,
      );
      setStep('error');
      return;
    }

    setErrorMessage(null);
    setItems([]);
    setPreviewUri(null);
    setMeal(inferMealFromTime());
    setLastScanSource(source);

    try {
      setStep('picking');
      const uri = await pickFoodImage(source);
      if (!uri) { setStep('idle'); return; }

      const prepared = await prepareImageForAnalysis(uri);
      setPreviewUri(prepared.uri);

      setStep('analyzing');
      const res = await analyzeFood(prepared.base64);
      setItems(res.items.map(i => ({ ...i })));
      setStep('review');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      if (msg === 'cancelled') { setStep('idle'); return; }
      setAnalysisError(err);
    }
  }

  function totals() {
    return items.reduce(
      (acc, item) => ({
        kcal:      acc.kcal      + (item.kcal      || 0),
        protein_g: acc.protein_g + (item.protein_g || 0),
        carbs_g:   acc.carbs_g   + (item.carbs_g   || 0),
        fat_g:     acc.fat_g     + (item.fat_g     || 0),
      }),
      { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
    );
  }

  async function confirmLog() {
    if (items.length === 0) {
      Alert.alert('No items', 'Nothing to log.');
      return;
    }
    setStep('saving');
    try {
      const t = totals();
      await saveNutritionLog(items, t, 'photo', meal);
      setStep('done');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not save';
      Alert.alert('Error', msg);
      setStep('review');
    }
  }

  function resetAll() {
    setStep('idle');
    setPreviewUri(null);
    setItems([]);
    setMeal(inferMealFromTime());
    setErrorMessage(null);
    setLastScanSource(null);
  }

  function handleErrorRetry() {
    if (lastScanSource) {
      void startScan(lastScanSource);
      return;
    }
    resetAll();
  }

  const t = totals();
  const isLoading = ['picking', 'analyzing', 'saving'].includes(step);
  const scanDisabled = atDailyLimit;

  if (step === 'done') {
    return (
      <AppScreen>
        <View style={styles.centered}>
          <Ionicons name="checkmark-circle" size={72} color={ACCENT} />
          <Text style={styles.doneTitle}>Added to {MEAL_LABELS[meal]}!</Text>
          <Text style={styles.doneKcal}>{Math.round(t.kcal)} kcal</Text>
          <MacroSummary totals={t} showKcal={false} />
          <View style={styles.doneActions}>
            <Pressable style={styles.donePrimaryBtn} onPress={resetAll}>
              <Text style={styles.primaryBtnText}>Log Another</Text>
            </Pressable>
            <Pressable style={styles.doneSecondaryBtn} onPress={() => router.push('/(tabs)/log')}>
              <Text style={styles.secondaryBtnText}>View Log</Text>
            </Pressable>
          </View>
        </View>
      </AppScreen>
    );
  }

  if (step === 'error' && errorMessage) {
    return (
      <AppScreen>
        <FoodScanErrorScreen
          code={errorCode}
          message={errorMessage}
          onRetry={handleErrorRetry}
          onDismiss={resetAll}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Food Scanner</Text>
          <Text style={styles.subtitle}>Snap a photo for instant macros</Text>
        </View>

        {isLoading && (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={ACCENT} />
            <Text style={styles.loadingText}>
              {step === 'picking'   ? 'Opening picker…'
               : step === 'analyzing' ? 'Analyzing food…'
               : 'Saving…'}
            </Text>
          </View>
        )}

        {step === 'idle' && (
          <>
            {atDailyLimit && (
              <View style={styles.limitBanner}>
                <Ionicons name="ban-outline" size={18} color={homeTheme.colors.destructive} />
                <Text style={styles.limitBannerText}>
                  Limit reached. You've used all {FOOD_SCAN_DAILY_LIMIT} scans for today.
                </Text>
              </View>
            )}
            <View style={styles.sourceRow}>
            <Pressable
              style={[styles.sourceBtn, scanDisabled && styles.sourceBtnDisabled]}
              onPress={() => startScan('camera')}
              disabled={scanDisabled}
            >
              <Ionicons name="camera" size={32} color={scanDisabled ? homeTheme.colors.textMuted : ACCENT} />
              <Text style={[styles.sourceBtnText, scanDisabled && styles.sourceBtnTextDisabled]}>Take Photo</Text>
            </Pressable>
            <Pressable
              style={[styles.sourceBtn, scanDisabled && styles.sourceBtnDisabled]}
              onPress={() => startScan('library')}
              disabled={scanDisabled}
            >
              <Ionicons name="images" size={32} color={scanDisabled ? homeTheme.colors.textMuted : ACCENT} />
              <Text style={[styles.sourceBtnText, scanDisabled && styles.sourceBtnTextDisabled]}>Choose Photo</Text>
            </Pressable>
          </View>
          </>
        )}

        {step === 'review' && (
          <>
            {previewUri && (
              <Image source={{ uri: previewUri }} style={styles.preview} resizeMode="cover" />
            )}

            <View style={styles.macroCard}>
              <MacroSummary totals={t} />
            </View>

            <Text style={styles.sectionLabel}>Add to</Text>
            <MealPicker value={meal} onChange={setMeal} />

            <Text style={styles.sectionLabel}>Detected Items</Text>
            {items.map((item, idx) => (
              <View key={idx} style={styles.foodRow}>
                <View style={styles.foodDot} />
                <Text style={styles.foodName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.foodKcal}>{Math.round(item.kcal)} kcal</Text>
              </View>
            ))}

            <View style={styles.actionRow}>
              <Pressable style={styles.secondaryBtn} onPress={resetAll}>
                <Text style={styles.secondaryBtnText}>Retake</Text>
              </Pressable>
              <Pressable style={styles.primaryBtn} onPress={confirmLog}>
                <Text style={styles.primaryBtnText}>Add to {MEAL_LABELS[meal]}</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 48 },
  header: { alignItems: 'center', marginBottom: 24, marginTop: 8 },
  title:    { color: homeTheme.colors.textPrimary, fontSize: 28, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: homeTheme.colors.textMuted, fontSize: 14, textAlign: 'center', marginTop: 4 },
  loadingCard: {
    alignItems: 'center',
    gap: 14,
    backgroundColor: CARD,
    borderRadius: 20,
    padding: 40,
    marginBottom: 20,
  },
  loadingText: { color: homeTheme.colors.textMuted, fontSize: 15 },
  limitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: homeTheme.colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: homeTheme.colors.destructive,
  },
  limitBannerText: { color: homeTheme.colors.textPrimary, flex: 1, fontSize: 14, lineHeight: 20 },
  sourceRow: { flexDirection: 'row', gap: 16, marginTop: 16 },
  sourceBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 12,
    backgroundColor: CARD,
    borderRadius: 20,
    paddingVertical: 36,
    borderWidth: 1,
    borderColor: homeTheme.colors.border,
  },
  sourceBtnDisabled: { opacity: 0.45 },
  sourceBtnText: { color: homeTheme.colors.textPrimary, fontSize: 15, fontWeight: '600' },
  sourceBtnTextDisabled: { color: homeTheme.colors.textMuted },
  preview: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    marginBottom: 20,
  },
  macroCard: {
    width: '100%',
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
  },
  sectionLabel: {
    color: homeTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 8,
  },
  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: homeTheme.colors.border,
  },
  foodDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ACCENT,
  },
  foodName: { flex: 1, color: homeTheme.colors.textPrimary, fontSize: 15 },
  foodKcal: { color: homeTheme.colors.textMuted, fontSize: 14, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  primaryBtn: {
    flex: 2,
    backgroundColor: homeTheme.colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: homeTheme.colors.primaryForeground, fontSize: 16, fontWeight: '800' },
  secondaryBtn: {
    flex: 1,
    backgroundColor: homeTheme.colors.secondary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryBtnText: { color: homeTheme.colors.secondaryForeground, fontSize: 16, fontWeight: '600' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32, width: '100%' },
  doneTitle: { color: homeTheme.colors.textPrimary, fontSize: 28, fontWeight: '900', textAlign: 'center' },
  doneKcal:  { color: ACCENT, fontSize: 48, fontWeight: '900' },
  doneActions: { width: '100%', gap: 10, marginTop: 16 },
  donePrimaryBtn: {
    width: '100%',
    backgroundColor: homeTheme.colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  doneSecondaryBtn: {
    width: '100%',
    backgroundColor: homeTheme.colors.secondary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
});
