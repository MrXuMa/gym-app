import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { homeTheme } from '@/constants/theme';
import { MEAL_ACCENT, MEAL_ICONS } from '@/components/food/nutritionTheme';
import { MEAL_LABELS, MEAL_ORDER, type MealType } from '@/lib/foodAnalysis';

type MealPickerProps = {
  value: MealType;
  onChange: (meal: MealType) => void;
  compact?: boolean;
};

export function MealPicker({ value, onChange, compact = false }: MealPickerProps) {
  return (
    <View style={[styles.row, compact && styles.rowCompact]}>
      {MEAL_ORDER.map((meal) => {
        const selected = value === meal;
        const accent = MEAL_ACCENT[meal];
        return (
          <Pressable
            key={meal}
            style={[
              styles.chip,
              compact && styles.chipCompact,
              selected && { borderColor: accent, backgroundColor: `${accent}22` },
            ]}
            onPress={() => onChange(meal)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={MEAL_LABELS[meal]}
          >
            <Ionicons
              name={MEAL_ICONS[meal]}
              size={compact ? 14 : 16}
              color={selected ? accent : homeTheme.colors.textMuted}
            />
            <Text
              style={[
                styles.chipLabel,
                compact && styles.chipLabelCompact,
                selected && { color: accent },
              ]}
              numberOfLines={1}
            >
              {compact ? MEAL_LABELS[meal].slice(0, 1) : MEAL_LABELS[meal]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rowCompact: { gap: 6 },
  chip: {
    flex: 1,
    minWidth: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: homeTheme.colors.border,
    backgroundColor: homeTheme.colors.muted,
  },
  chipCompact: {
    minWidth: 0,
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 2,
  },
  chipLabel: {
    color: homeTheme.colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  chipLabelCompact: { fontSize: 11 },
});
