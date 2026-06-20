import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { notify } from '@/lib/platformAlert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MealPicker } from '@/components/food/MealPicker';
import { MacroSummary } from '@/components/food/MacroSummary';
import { homeTheme } from '@/constants/theme';
import {
  getFdcFoodDetail,
  searchFdcFoods,
  type FdcFoodDetail,
  type FdcSearchFood,
} from '@/lib/fdcFood';
import {
  inferMealFromTime,
  saveNutritionLog,
  type MealType,
} from '@/lib/foodAnalysis';

type ManualFoodSheetProps = {
  visible: boolean;
  dateKey: string;
  initialMeal?: MealType;
  onClose: () => void;
  onSaved: () => void;
};

type Step = 'search' | 'confirm';

function parseGrams(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n);
}

export function ManualFoodSheet({ visible, dateKey, initialMeal, onClose, onSaved }: ManualFoodSheetProps) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('search');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<FdcSearchFood[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<FdcFoodDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [grams, setGrams] = useState('100');
  const [meal, setMeal] = useState<MealType>(inferMealFromTime());
  const [saving, setSaving] = useState(false);

  const reset = useCallback(() => {
    setStep('search');
    setQuery('');
    setResults([]);
    setSearchError(null);
    setSelected(null);
    setGrams('100');
    setMeal(inferMealFromTime());
  }, []);

  useEffect(() => {
    if (!visible) {
      reset();
      return;
    }
    if (initialMeal) {
      setMeal(initialMeal);
    }
  }, [visible, initialMeal, reset]);

  useEffect(() => {
    if (!visible || step !== 'search') return;

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearchError(null);
      return;
    }

    const timeout = setTimeout(() => {
      void (async () => {
        setSearching(true);
        setSearchError(null);
        try {
          const data = await searchFdcFoods(trimmed);
          setResults(data.foods);
        } catch (err: unknown) {
          setResults([]);
          setSearchError(err instanceof Error ? err.message : 'Search failed');
        } finally {
          setSearching(false);
        }
      })();
    }, 350);

    return () => clearTimeout(timeout);
  }, [query, visible, step]);

  const portionGrams = parseGrams(grams);

  const previewMacros = useMemo(() => {
    if (!selected) return null;
    const factor = portionGrams > 0 ? portionGrams / 100 : 1;
    return {
      kcal: Math.round(selected.per_100g.kcal * factor),
      protein_g: Math.round(selected.per_100g.protein_g * factor * 10) / 10,
      carbs_g: Math.round(selected.per_100g.carbs_g * factor * 10) / 10,
      fat_g: Math.round(selected.per_100g.fat_g * factor * 10) / 10,
    };
  }, [selected, portionGrams]);

  async function pickFood(food: FdcSearchFood) {
    setLoadingDetail(true);
    setSearchError(null);
    try {
      const detail = await getFdcFoodDetail(food.fdc_id);
      setSelected(detail);
      setGrams(String(detail.default_grams));
      setStep('confirm');
    } catch (err: unknown) {
      notify('Error', err instanceof Error ? err.message : 'Could not load food details');
    } finally {
      setLoadingDetail(false);
    }
  }

  async function handleSave() {
    if (!selected || portionGrams <= 0) {
      notify('Invalid portion', 'Enter a portion size in grams.');
      return;
    }
    if (!previewMacros) return;

    setSaving(true);
    try {
      const item = {
        name: selected.brand ? `${selected.name} (${selected.brand})` : selected.name,
        fdc_id: selected.fdc_id,
        estimated_portion_g: portionGrams,
        kcal: previewMacros.kcal,
        protein_g: previewMacros.protein_g,
        carbs_g: previewMacros.carbs_g,
        fat_g: previewMacros.fat_g,
      };

      await saveNutritionLog([item], previewMacros, 'manual', meal, dateKey);
      onSaved();
      onClose();
    } catch (err: unknown) {
      notify('Error', err instanceof Error ? err.message : 'Could not save food');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable onPress={step === 'confirm' ? () => setStep('search') : onClose} hitSlop={12}>
            <Text style={styles.headerAction}>{step === 'confirm' ? 'Back' : 'Cancel'}</Text>
          </Pressable>
          <Text style={styles.title}>{step === 'search' ? 'Add food' : 'Portion'}</Text>
          <View style={styles.headerSpacer} />
        </View>

        {step === 'search' && (
          <View style={styles.body}>
            <View style={styles.searchRow}>
              <Ionicons name="search" size={18} color={homeTheme.colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Search USDA FoodData Central…"
                placeholderTextColor={homeTheme.colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                accessibilityLabel="Search foods"
              />
              {searching && <ActivityIndicator size="small" color={homeTheme.colors.primary} />}
            </View>

            <Text style={styles.hint}>Chicken breast, Greek yogurt, banana…</Text>

            {searchError && (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>{searchError}</Text>
              </View>
            )}

            {loadingDetail && (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color={homeTheme.colors.primary} />
              </View>
            )}

            {searching && results.length === 0 && query.trim().length >= 2 && (
              <View style={styles.centered}>
                <Text style={styles.searchingText}>Searching…</Text>
              </View>
            )}

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.results}>
              {results.map((food) => (
                <Pressable
                  key={food.fdc_id}
                  style={styles.resultRow}
                  onPress={() => void pickFood(food)}
                  disabled={loadingDetail}
                >
                  <View style={styles.resultText}>
                    <Text style={styles.resultName} numberOfLines={2}>{food.name}</Text>
                    <Text style={styles.resultMeta} numberOfLines={1}>
                      {[food.brand, food.data_type].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <Text style={styles.resultKcal}>{Math.round(food.per_100g.kcal)} kcal/100g</Text>
                </Pressable>
              ))}

              {!searching && query.trim().length >= 2 && results.length === 0 && !searchError && (
                <Text style={styles.emptyText}>No foods found. Try a different search.</Text>
              )}
            </ScrollView>
          </View>
        )}

        {step === 'confirm' && selected && previewMacros && (
          <ScrollView contentContainerStyle={styles.confirmBody} keyboardShouldPersistTaps="handled">
            <Text style={styles.foodTitle}>{selected.name}</Text>
            {selected.brand ? <Text style={styles.foodBrand}>{selected.brand}</Text> : null}
            {selected.serving_description ? (
              <Text style={styles.servingHint}>{selected.serving_description}</Text>
            ) : null}

            <Text style={styles.sectionLabel}>Portion (grams)</Text>
            <TextInput
              style={styles.gramsInput}
              value={grams}
              onChangeText={setGrams}
              keyboardType="number-pad"
              placeholder="100"
              placeholderTextColor={homeTheme.colors.textMuted}
            />

            <View style={styles.macroCard}>
              <MacroSummary totals={previewMacros} kcalLabel="for this portion" compact />
            </View>

            <Text style={styles.sectionLabel}>Add to</Text>
            <MealPicker value={meal} onChange={setMeal} />

            <Pressable
              style={[styles.saveBtn, (saving || portionGrams <= 0) && styles.saveBtnDisabled]}
              onPress={() => void handleSave()}
              disabled={saving || portionGrams <= 0}
            >
              {saving ? (
                <ActivityIndicator color={homeTheme.colors.primaryForeground} />
              ) : (
                <Text style={styles.saveBtnText}>Add to log</Text>
              )}
            </Pressable>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: homeTheme.colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: homeTheme.colors.border,
  },
  title: { color: homeTheme.colors.textPrimary, fontSize: 17, fontWeight: '700' },
  headerAction: { color: homeTheme.colors.primary, fontSize: 16, fontWeight: '600', minWidth: 52 },
  headerSpacer: { minWidth: 52 },
  body: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: homeTheme.colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: homeTheme.colors.border,
  },
  searchInput: { flex: 1, color: homeTheme.colors.textPrimary, fontSize: 16 },
  hint: { color: homeTheme.colors.textMuted, fontSize: 13, marginTop: 8, marginBottom: 12 },
  errorCard: {
    backgroundColor: homeTheme.colors.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: homeTheme.colors.destructive,
  },
  errorText: { color: homeTheme.colors.destructive, fontSize: 14 },
  centered: { paddingVertical: 32, alignItems: 'center' },
  searchingText: { color: homeTheme.colors.textMuted, fontSize: 14 },
  results: { paddingBottom: 32, gap: 8 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: homeTheme.colors.card,
    borderRadius: 12,
    padding: 14,
  },
  resultText: { flex: 1, gap: 4 },
  resultName: { color: homeTheme.colors.textPrimary, fontSize: 15, fontWeight: '600' },
  resultMeta: { color: homeTheme.colors.textMuted, fontSize: 12 },
  resultKcal: { color: homeTheme.colors.primary, fontSize: 13, fontWeight: '700' },
  emptyText: { color: homeTheme.colors.textMuted, textAlign: 'center', marginTop: 24 },
  confirmBody: { padding: 20, paddingBottom: 48, gap: 10 },
  foodTitle: { color: homeTheme.colors.textPrimary, fontSize: 22, fontWeight: '800' },
  foodBrand: { color: homeTheme.colors.textMuted, fontSize: 14 },
  servingHint: { color: homeTheme.colors.textMuted, fontSize: 13, fontStyle: 'italic' },
  sectionLabel: {
    color: homeTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 8,
  },
  gramsInput: {
    backgroundColor: homeTheme.colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: homeTheme.colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: homeTheme.colors.border,
  },
  macroCard: {
    backgroundColor: homeTheme.colors.card,
    borderRadius: 16,
    padding: 14,
    marginTop: 4,
  },
  saveBtn: {
    marginTop: 16,
    backgroundColor: homeTheme.colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { color: homeTheme.colors.primaryForeground, fontSize: 16, fontWeight: '800' },
});
