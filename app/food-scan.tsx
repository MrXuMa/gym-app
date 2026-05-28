import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppScreen } from '@/components/layout/AppScreen';
import { homeTheme } from '@/constants/theme';
import { useProfile } from '@/hooks/useProfile';
import {
  pickFoodImage,
  prepareImageForUpload,
  uploadFoodImage,
  analyzeFood,
  saveNutritionLog,
  type FoodItem,
  type FoodAnalysisResult,
} from '@/lib/foodAnalysis';

type Step = 'idle' | 'picking' | 'uploading' | 'analyzing' | 'review' | 'saving' | 'done';

const ACCENT = '#4ade80';
const CARD = '#1a1a2e';
const SURFACE = '#16213e';

export default function FoodScanScreen() {
  const router = useRouter();
  const { profile } = useProfile();

  const [step, setStep] = useState<Step>('idle');
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [result, setResult] = useState<FoodAnalysisResult | null>(null);
  const [editedItems, setEditedItems] = useState<FoodItem[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const userId = profile?.id ?? '';

  async function startScan(source: 'camera' | 'library') {
    if (!userId) {
      Alert.alert('Not signed in', 'Please sign in to use this feature.');
      return;
    }
    setErrorMsg(null);
    setResult(null);
    setEditedItems([]);
    setPreviewUri(null);

    try {
      setStep('picking');
      const uri = await pickFoodImage(source);
      if (!uri) { setStep('idle'); return; }

      setPreviewUri(uri);

      setStep('uploading');
      const { blob } = await prepareImageForUpload(uri);
      const imagePath = await uploadFoodImage(userId, blob);

      setStep('analyzing');
      const res = await analyzeFood(imagePath);

      setResult(res);
      setEditedItems(res.items.map(i => ({ ...i })));
      setStep('review');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      if (msg === 'cancelled') { setStep('idle'); return; }
      setErrorMsg(msg);
      setStep('idle');
    }
  }

  function updateItem(index: number, field: keyof FoodItem, value: string) {
    setEditedItems(prev => {
      const next = [...prev];
      const item = { ...next[index] };
      if (field === 'name') {
        item.name = value;
      } else {
        (item as Record<string, unknown>)[field] = value === '' ? 0 : parseFloat(value) || 0;
      }
      next[index] = item;
      return next;
    });
  }

  function removeItem(index: number) {
    setEditedItems(prev => prev.filter((_, i) => i !== index));
  }

  function computedTotals() {
    return editedItems.reduce(
      (acc, item) => ({
        kcal: acc.kcal + (item.kcal || 0),
        protein_g: acc.protein_g + (item.protein_g || 0),
        carbs_g: acc.carbs_g + (item.carbs_g || 0),
        fat_g: acc.fat_g + (item.fat_g || 0),
      }),
      { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
    );
  }

  async function confirmLog() {
    if (editedItems.length === 0) {
      Alert.alert('No items', 'Add at least one food item before saving.');
      return;
    }
    setStep('saving');
    try {
      const totals = computedTotals();
      await saveNutritionLog(editedItems, totals, 'photo');
      setStep('done');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not save';
      Alert.alert('Error', msg);
      setStep('review');
    }
  }

  const totals = computedTotals();
  const isLoading = ['picking', 'uploading', 'analyzing', 'saving'].includes(step);

  if (step === 'done') {
    return (
      <AppScreen>
        <View style={styles.centered}>
          <Ionicons name="checkmark-circle" size={64} color={ACCENT} />
          <Text style={styles.doneTitle}>Logged!</Text>
          <Text style={styles.doneSubtitle}>
            {Math.round(totals.kcal)} kcal · {totals.protein_g.toFixed(1)}g protein
          </Text>
          <Pressable style={styles.primaryBtn} onPress={() => router.back()}>
            <Text style={styles.primaryBtnText}>Back</Text>
          </Pressable>
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </Pressable>
          <Text style={styles.title}>Food Scanner</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Error banner */}
        {errorMsg && (
          <View style={styles.errorBanner}>
            <Ionicons name="warning-outline" size={16} color="#f87171" />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        {/* Loading overlay */}
        {isLoading && (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={ACCENT} />
            <Text style={styles.loadingText}>
              {step === 'picking' ? 'Opening picker…'
                : step === 'uploading' ? 'Uploading image…'
                : step === 'analyzing' ? 'Analyzing with Gemini…'
                : 'Saving…'}
            </Text>
          </View>
        )}

        {/* Scan buttons (idle state) */}
        {step === 'idle' && (
          <View style={styles.sourceRow}>
            <Pressable style={styles.sourceBtn} onPress={() => startScan('camera')}>
              <Ionicons name="camera" size={28} color={ACCENT} />
              <Text style={styles.sourceBtnText}>Take Photo</Text>
            </Pressable>
            <Pressable style={styles.sourceBtn} onPress={() => startScan('library')}>
              <Ionicons name="images" size={28} color={ACCENT} />
              <Text style={styles.sourceBtnText}>Choose Photo</Text>
            </Pressable>
          </View>
        )}

        {/* Image preview (review state) */}
        {step === 'review' && previewUri && (
          <Image source={{ uri: previewUri }} style={styles.preview} resizeMode="cover" />
        )}

        {/* Review / edit items */}
        {step === 'review' && (
          <>
            <Text style={styles.sectionLabel}>Detected Items</Text>
            <Text style={styles.hint}>Tap a number to edit · swipe ✕ to remove</Text>

            {editedItems.map((item, idx) => (
              <View key={idx} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <TextInput
                    style={styles.itemName}
                    value={item.name}
                    onChangeText={v => updateItem(idx, 'name', v)}
                    placeholderTextColor="#666"
                  />
                  <Pressable onPress={() => removeItem(idx)} hitSlop={8}>
                    <Ionicons name="close-circle" size={20} color="#f87171" />
                  </Pressable>
                </View>
                <View style={styles.macroRow}>
                  {(['kcal', 'protein_g', 'carbs_g', 'fat_g'] as (keyof FoodItem)[]).map(field => (
                    <View key={field} style={styles.macroField}>
                      <Text style={styles.macroLabel}>
                        {field === 'kcal' ? 'kcal'
                          : field === 'protein_g' ? 'protein'
                          : field === 'carbs_g' ? 'carbs'
                          : 'fat'}
                      </Text>
                      <TextInput
                        style={styles.macroInput}
                        value={String(item[field] ?? '')}
                        onChangeText={v => updateItem(idx, field, v)}
                        keyboardType="decimal-pad"
                        placeholderTextColor="#555"
                      />
                    </View>
                  ))}
                </View>
              </View>
            ))}

            {/* Totals card */}
            <View style={styles.totalsCard}>
              <Text style={styles.totalsTitle}>Total</Text>
              <View style={styles.macroRow}>
                {[
                  { label: 'kcal', value: Math.round(totals.kcal) },
                  { label: 'protein', value: totals.protein_g.toFixed(1) + 'g' },
                  { label: 'carbs', value: totals.carbs_g.toFixed(1) + 'g' },
                  { label: 'fat', value: totals.fat_g.toFixed(1) + 'g' },
                ].map(m => (
                  <View key={m.label} style={styles.totalItem}>
                    <Text style={styles.totalValue}>{m.value}</Text>
                    <Text style={styles.totalLabel}>{m.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Action buttons */}
            <View style={styles.actionRow}>
              <Pressable style={styles.secondaryBtn} onPress={() => setStep('idle')}>
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

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: { color: '#fff', fontSize: 20, fontWeight: '700' },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2d1b1b',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { color: '#f87171', flex: 1, fontSize: 14 },

  loadingCard: {
    alignItems: 'center',
    gap: 12,
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 32,
    marginBottom: 20,
  },
  loadingText: { color: '#aaa', fontSize: 15 },

  sourceRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 24,
  },
  sourceBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 10,
    backgroundColor: CARD,
    borderRadius: 16,
    paddingVertical: 32,
    borderWidth: 1,
    borderColor: '#2a2a40',
  },
  sourceBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  preview: {
    width: '100%',
    height: 200,
    borderRadius: 14,
    marginBottom: 16,
  },

  sectionLabel: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  hint: { color: '#666', fontSize: 12, marginBottom: 12 },

  itemCard: {
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    gap: 8,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    paddingBottom: 2,
  },
  macroRow: {
    flexDirection: 'row',
    gap: 8,
  },
  macroField: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  macroLabel: { color: '#666', fontSize: 10, textTransform: 'uppercase' },
  macroInput: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: SURFACE,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
    width: '100%',
  },

  totalsCard: {
    backgroundColor: '#0f3460',
    borderRadius: 14,
    padding: 16,
    marginTop: 8,
    marginBottom: 20,
    gap: 12,
  },
  totalsTitle: { color: ACCENT, fontSize: 16, fontWeight: '700' },
  totalItem: { flex: 1, alignItems: 'center', gap: 2 },
  totalValue: { color: '#fff', fontSize: 16, fontWeight: '700' },
  totalLabel: { color: '#aaa', fontSize: 11, textTransform: 'uppercase' },

  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryBtn: {
    flex: 2,
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#000', fontSize: 16, fontWeight: '700' },
  secondaryBtn: {
    flex: 1,
    backgroundColor: '#2a2a40',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
  },
  doneTitle: { color: '#fff', fontSize: 28, fontWeight: '800' },
  doneSubtitle: { color: '#aaa', fontSize: 16, textAlign: 'center' },
});
