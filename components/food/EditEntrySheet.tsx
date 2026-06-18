import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MacroSummary } from '@/components/food/MacroSummary';
import { MealPicker } from '@/components/food/MealPicker';
import { homeTheme } from '@/constants/theme';
import {
  deleteDailyNutritionEntry,
  entryMeal,
  totalsFromItems,
  updateNutritionEntry,
  type FoodItem,
  type MealType,
  type NutritionEntry,
} from '@/lib/foodAnalysis';

type EditEntrySheetProps = {
  visible: boolean;
  dateKey: string;
  entryIndex: number;
  entry: NutritionEntry | null;
  onClose: () => void;
  onSaved: () => void;
};

function parseNum(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

export function EditEntrySheet({
  visible,
  dateKey,
  entryIndex,
  entry,
  onClose,
  onSaved,
}: EditEntrySheetProps) {
  const insets = useSafeAreaInsets();
  const [meal, setMeal] = useState<MealType>('lunch');
  const [items, setItems] = useState<FoodItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!entry) return;
    setMeal(entryMeal(entry));
    setItems(entry.items.map((i) => ({ ...i })));
  }, [entry, visible]);

  const totals = totalsFromItems(items);
  const hasBlankItem = items.some((i) => !i.name.trim());

  function updateItem(index: number, patch: Partial<FoodItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function removeItem(index: number) {
    if (items.length <= 1) {
      Alert.alert('Cannot remove', 'A meal must have at least one item.');
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    const validItems = items.filter((i) => i.name.trim().length > 0);
    if (validItems.length === 0) {
      Alert.alert('Missing items', 'Add at least one food item.');
      return;
    }
    setSaving(true);
    try {
      await updateNutritionEntry(dateKey, entryIndex, { meal, items: validItems });
      onSaved();
      onClose();
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not save changes');
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    Alert.alert('Delete meal?', 'This removes the meal from your log.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setSaving(true);
            try {
              await deleteDailyNutritionEntry(dateKey, entryIndex);
              onSaved();
              onClose();
            } catch (err: unknown) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Could not delete meal');
            } finally {
              setSaving(false);
            }
          })();
        },
      },
    ]);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cancel">
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Text style={styles.title}>Edit meal</Text>
          <Pressable
            onPress={() => void handleSave()}
            disabled={saving || !entry || hasBlankItem}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Save"
          >
            {saving ? (
              <ActivityIndicator size="small" color={homeTheme.colors.primary} />
            ) : (
              <Text style={[styles.saveText, (!entry || hasBlankItem) && styles.saveTextDisabled]}>Save</Text>
            )}
          </Pressable>
        </View>

        {!entry ? (
          <View style={styles.missingEntry}>
            <Text style={styles.missingEntryText}>This meal entry is no longer available.</Text>
            <Pressable style={styles.missingEntryBtn} onPress={onClose} accessibilityRole="button">
              <Text style={styles.missingEntryBtnText}>Close</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.sectionLabel}>Meal</Text>
            <MealPicker value={meal} onChange={setMeal} />

            <View style={styles.macroCard}>
              <MacroSummary totals={totals} kcalLabel="meal total" compact />
            </View>

            <Text style={styles.sectionLabel}>Items</Text>
            {items.map((item, index) => (
              <View key={index} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <TextInput
                    style={[styles.nameInput, !item.name.trim() && styles.nameInputError]}
                    value={item.name}
                    onChangeText={(text) => updateItem(index, { name: text })}
                    placeholder="Food name"
                    placeholderTextColor={homeTheme.colors.textMuted}
                  />
                  <Pressable
                    onPress={() => removeItem(index)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Remove item"
                  >
                    <Ionicons name="close-circle" size={22} color={homeTheme.colors.textMuted} />
                  </Pressable>
                </View>
                <View style={styles.macroGrid}>
                  <MacroField
                    label="Kcal"
                    value={String(Math.round(item.kcal))}
                    onChange={(v) => updateItem(index, { kcal: parseNum(v) })}
                  />
                  <MacroField
                    label="Protein"
                    value={String(item.protein_g)}
                    onChange={(v) => updateItem(index, { protein_g: parseNum(v) })}
                  />
                  <MacroField
                    label="Carbs"
                    value={String(item.carbs_g)}
                    onChange={(v) => updateItem(index, { carbs_g: parseNum(v) })}
                  />
                  <MacroField
                    label="Fat"
                    value={String(item.fat_g)}
                    onChange={(v) => updateItem(index, { fat_g: parseNum(v) })}
                  />
                </View>
              </View>
            ))}

            <Pressable
              style={styles.addItemBtn}
              onPress={() =>
                setItems((prev) => [
                  ...prev,
                  { name: '', kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
                ])
              }
            >
              <Ionicons name="add-circle-outline" size={20} color={homeTheme.colors.primary} />
              <Text style={styles.addItemText}>Add item</Text>
            </Pressable>

            <Pressable style={styles.deleteBtn} onPress={confirmDelete} disabled={saving}>
              <Ionicons name="trash-outline" size={18} color={homeTheme.colors.destructive} />
              <Text style={styles.deleteText}>Delete meal</Text>
            </Pressable>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function MacroField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.macroField}>
      <Text style={styles.macroFieldLabel}>{label}</Text>
      <TextInput
        style={styles.macroInput}
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        placeholderTextColor={homeTheme.colors.textMuted}
      />
    </View>
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
  cancelText: { color: homeTheme.colors.textMuted, fontSize: 16 },
  saveText: { color: homeTheme.colors.primary, fontSize: 16, fontWeight: '700' },
  saveTextDisabled: { opacity: 0.4 },
  content: { padding: 20, paddingBottom: 48, gap: 14 },
  sectionLabel: {
    color: homeTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
  },
  macroCard: {
    backgroundColor: homeTheme.colors.card,
    borderRadius: 16,
    padding: 14,
  },
  itemCard: {
    backgroundColor: homeTheme.colors.card,
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nameInput: {
    flex: 1,
    color: homeTheme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 4,
  },
  nameInputError: {
    borderBottomWidth: 1,
    borderBottomColor: homeTheme.colors.destructive,
  },
  macroGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  macroField: { flex: 1, minWidth: '45%' },
  macroFieldLabel: { color: homeTheme.colors.textMuted, fontSize: 11, marginBottom: 4 },
  macroInput: {
    backgroundColor: homeTheme.colors.muted,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: homeTheme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  addItemText: { color: homeTheme.colors.primary, fontWeight: '700' },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: homeTheme.colors.destructive,
  },
  deleteText: { color: homeTheme.colors.destructive, fontWeight: '700' },
  missingEntry: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  missingEntryText: { color: homeTheme.colors.textMuted, fontSize: 16, textAlign: 'center' },
  missingEntryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: homeTheme.colors.card,
    borderWidth: 1,
    borderColor: homeTheme.colors.border,
  },
  missingEntryBtnText: { color: homeTheme.colors.primary, fontWeight: '700' },
});
