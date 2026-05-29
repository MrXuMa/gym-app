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
import { homeTheme } from '@/constants/theme';
import {
  pickFoodImage,
  prepareImageForAnalysis,
  analyzeFood,
  saveNutritionLog,
  type FoodItem,
  type FoodAnalysisResult,
} from '@/lib/foodAnalysis';

type Step = 'idle' | 'picking' | 'analyzing' | 'review' | 'saving' | 'done';

const ACCENT = homeTheme.colors.primary;
const CARD = homeTheme.colors.card;

// Macro colour coding
const MACRO_COLORS = {
  protein: '#60a5fa',
  carbs: homeTheme.colors.primary,
  fat: homeTheme.colors.destructive,
};

export default function FoodScanScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('idle');
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [result, setResult] = useState<FoodAnalysisResult | null>(null);
  const [items, setItems] = useState<FoodItem[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function startScan(source: 'camera' | 'library') {
    setErrorMsg(null);
    setResult(null);
    setItems([]);
    setPreviewUri(null);

    try {
      setStep('picking');
      const uri = await pickFoodImage(source);
      if (!uri) { setStep('idle'); return; }

      // Resize/compress first, and get a base64 payload for analysis
      const prepared = await prepareImageForAnalysis(uri);
      setPreviewUri(prepared.uri);

      setStep('analyzing');
      const res = await analyzeFood(prepared.base64);
      setResult(res);
      setItems(res.items.map(i => ({ ...i })));
      setStep('review');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      if (msg === 'cancelled') { setStep('idle'); return; }
      setErrorMsg(msg);
      setStep('idle');
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
      await saveNutritionLog(items, t, 'photo');
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
    setResult(null);
    setItems([]);
    setErrorMsg(null);
  }

  const t = totals();
  const isLoading = ['picking', 'analyzing', 'saving'].includes(step);
  const totalMacroG = t.protein_g + t.carbs_g + t.fat_g || 1;

  // ── Done screen ──────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <AppScreen>
        <View style={styles.centered}>
          <Ionicons name="checkmark-circle" size={72} color={ACCENT} />
          <Text style={styles.doneTitle}>Logged!</Text>
          <Text style={styles.doneKcal}>{Math.round(t.kcal)} kcal</Text>
          <View style={styles.doneMacroRow}>
            <MacroPill label="Protein" value={`${t.protein_g.toFixed(1)}g`} color={MACRO_COLORS.protein} />
            <MacroPill label="Carbs"   value={`${t.carbs_g.toFixed(1)}g`}   color={MACRO_COLORS.carbs} />
            <MacroPill label="Fat"     value={`${t.fat_g.toFixed(1)}g`}     color={MACRO_COLORS.fat} />
          </View>
          <Pressable style={styles.donePrimaryBtn} onPress={resetAll}>
            <Text style={styles.primaryBtnText}>Log Another</Text>
          </Pressable>
        </View>
      </AppScreen>
    );
  }

  // ── Main screen ──────────────────────────────────────────────────────────
  return (
    <AppScreen>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Food Scanner</Text>
          <Text style={styles.subtitle}>Snap a photo for instant macros</Text>
          <Pressable style={styles.dailyLogBtn} onPress={() => router.push('/food-daily-log')}>
            <Ionicons name="calendar-outline" size={16} color={ACCENT} />
            <Text style={styles.dailyLogBtnText}>View Daily Log</Text>
          </Pressable>
        </View>

        {/* Error banner */}
        {errorMsg && (
          <View style={styles.errorBanner}>
            <Ionicons name="warning-outline" size={16} color={homeTheme.colors.destructive} />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        {/* Loading card */}
        {isLoading && (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={ACCENT} />
            <Text style={styles.loadingText}>
              {step === 'picking'   ? 'Opening picker…'
               : step === 'analyzing' ? 'Analyzing with Gemini…'
               : 'Saving…'}
            </Text>
          </View>
        )}

        {/* Pick source buttons */}
        {step === 'idle' && (
          <View style={styles.sourceRow}>
            <Pressable style={styles.sourceBtn} onPress={() => startScan('camera')}>
              <Ionicons name="camera" size={32} color={ACCENT} />
              <Text style={styles.sourceBtnText}>Take Photo</Text>
            </Pressable>
            <Pressable style={styles.sourceBtn} onPress={() => startScan('library')}>
              <Ionicons name="images" size={32} color={ACCENT} />
              <Text style={styles.sourceBtnText}>Choose Photo</Text>
            </Pressable>
          </View>
        )}

        {/* ── Review display ── */}
        {step === 'review' && (
          <>
            {/* Image thumbnail */}
            {previewUri && (
              <Image source={{ uri: previewUri }} style={styles.preview} resizeMode="cover" />
            )}

            {/* Big calorie display */}
            <View style={styles.kcalCard}>
              <Text style={styles.kcalNumber}>{Math.round(t.kcal)}</Text>
              <Text style={styles.kcalLabel}>calories</Text>
            </View>

            {/* Macro bar */}
            <View style={styles.macroBarContainer}>
              {t.protein_g > 0 && (
                <View style={[styles.macroBarSegment, { flex: t.protein_g / totalMacroG, backgroundColor: MACRO_COLORS.protein }]} />
              )}
              {t.carbs_g > 0 && (
                <View style={[styles.macroBarSegment, { flex: t.carbs_g / totalMacroG, backgroundColor: MACRO_COLORS.carbs }]} />
              )}
              {t.fat_g > 0 && (
                <View style={[styles.macroBarSegment, { flex: t.fat_g / totalMacroG, backgroundColor: MACRO_COLORS.fat }]} />
              )}
            </View>

            {/* Macro pills */}
            <View style={styles.macroPillRow}>
              <MacroPill label="Protein" value={`${t.protein_g.toFixed(1)}g`} color={MACRO_COLORS.protein} />
              <MacroPill label="Carbs"   value={`${t.carbs_g.toFixed(1)}g`}   color={MACRO_COLORS.carbs} />
              <MacroPill label="Fat"     value={`${t.fat_g.toFixed(1)}g`}     color={MACRO_COLORS.fat} />
            </View>

            {/* Food item list */}
            <Text style={styles.sectionLabel}>Detected Items</Text>
            {items.map((item, idx) => (
              <View key={idx} style={styles.foodRow}>
                <View style={styles.foodDot} />
                <Text style={styles.foodName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.foodKcal}>{Math.round(item.kcal)} kcal</Text>
              </View>
            ))}

            {/* Actions */}
            <View style={styles.actionRow}>
              <Pressable style={styles.secondaryBtn} onPress={resetAll}>
                <Text style={styles.secondaryBtnText}>Retake</Text>
              </Pressable>
              <Pressable style={styles.primaryBtn} onPress={confirmLog}>
                <Text style={styles.primaryBtnText}>Log This Meal</Text>
              </Pressable>
            </View>
          </>
        )}

      </ScrollView>
    </AppScreen>
  );
}

// ── MacroPill component ───────────────────────────────────────────────────────
function MacroPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[styles.pill, { borderColor: color }]}>
      <Text style={[styles.pillValue, { color }]}>{value}</Text>
      <Text style={styles.pillLabel}>{label}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 48 },

  header: { alignItems: 'center', marginBottom: 24, marginTop: 8 },
  title:    { color: homeTheme.colors.textPrimary, fontSize: 28, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: homeTheme.colors.textMuted, fontSize: 14, textAlign: 'center', marginTop: 4 },
  dailyLogBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: homeTheme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: CARD,
  },
  dailyLogBtnText: { color: homeTheme.colors.primary, fontSize: 13, fontWeight: '700' },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: homeTheme.colors.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { color: homeTheme.colors.destructive, flex: 1, fontSize: 14 },

  loadingCard: {
    alignItems: 'center',
    gap: 14,
    backgroundColor: CARD,
    borderRadius: 20,
    padding: 40,
    marginBottom: 20,
  },
  loadingText: { color: homeTheme.colors.textMuted, fontSize: 15 },

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
  sourceBtnText: { color: homeTheme.colors.textPrimary, fontSize: 15, fontWeight: '600' },

  preview: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    marginBottom: 20,
  },

  // Calorie display
  kcalCard: {
    alignItems: 'center',
    marginBottom: 16,
  },
  kcalNumber: {
    color: homeTheme.colors.textPrimary,
    fontSize: 72,
    fontWeight: '900',
    lineHeight: 76,
  },
  kcalLabel: {
    color: homeTheme.colors.textMuted,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  // Macro bar
  macroBarContainer: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 14,
    gap: 2,
  },
  macroBarSegment: { borderRadius: 4 },

  // Macro pills
  macroPillRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  pill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    backgroundColor: homeTheme.colors.muted,
    gap: 2,
  },
  pillValue: { fontSize: 18, fontWeight: '800' },
  pillLabel: { color: homeTheme.colors.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Food item list
  sectionLabel: {
    color: homeTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
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

  // Actions
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

  // Done screen
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  doneTitle: { color: homeTheme.colors.textPrimary, fontSize: 32, fontWeight: '900' },
  doneKcal:  { color: ACCENT, fontSize: 48, fontWeight: '900' },
  doneMacroRow: { flexDirection: 'row', gap: 10, marginTop: 4, marginBottom: 16 },
  donePrimaryBtn: {
    width: 220,
    backgroundColor: homeTheme.colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
});
