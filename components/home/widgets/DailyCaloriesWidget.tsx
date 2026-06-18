import { StyleSheet, Text, View } from 'react-native';
import { getWidgetSizing, type WidgetSize } from '@/components/home/widgetSizing';
import { MACRO_COLORS } from '@/components/food/nutritionTheme';
import { homeTheme } from '@/constants/theme';
import { WidgetCard } from '@/components/home/WidgetCard';

type DailyCaloriesWidgetProps = {
  size?: WidgetSize;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export function DailyCaloriesWidget({
  size = 'small',
  kcal,
  protein_g,
  carbs_g,
  fat_g,
}: DailyCaloriesWidgetProps) {
  const sizing = getWidgetSizing(size);
  const macroTotal = protein_g + carbs_g + fat_g;
  const hasMacros = macroTotal > 0;
  const subtext =
    kcal === 0
      ? 'Nothing logged yet. Tap to add food.'
      : 'Tap to view your log.';

  return (
    <WidgetCard title="Calories today" size={size}>
      <View style={styles.content}>
        <View style={styles.valueBlock}>
          <Text style={[styles.value, { fontSize: sizing.valueFontSize }]}>{Math.round(kcal)}</Text>
          <Text style={[styles.unit, { fontSize: sizing.unitFontSize }]}>kcal</Text>
        </View>

        {hasMacros ? (
          <View style={styles.macroBar}>
            <View
              style={[
                styles.macroSegment,
                { flex: protein_g / macroTotal, backgroundColor: MACRO_COLORS.protein },
              ]}
            />
            <View
              style={[
                styles.macroSegment,
                { flex: carbs_g / macroTotal, backgroundColor: MACRO_COLORS.carbs },
              ]}
            />
            <View
              style={[
                styles.macroSegment,
                { flex: fat_g / macroTotal, backgroundColor: MACRO_COLORS.fat },
              ]}
            />
          </View>
        ) : (
          <View style={[styles.macroBar, styles.macroBarEmpty]} />
        )}
      </View>

      {sizing.showSubtext ? (
        <Text
          style={[styles.subtext, { fontSize: sizing.subtextFontSize, lineHeight: sizing.subtextLineHeight }]}
          numberOfLines={2}
        >
          {subtext}
        </Text>
      ) : null}
    </WidgetCard>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 8,
    justifyContent: 'center',
    flex: 1,
  },
  valueBlock: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  value: {
    color: homeTheme.colors.foreground,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  unit: {
    color: homeTheme.colors.mutedForeground,
    fontWeight: '500',
  },
  macroBar: {
    flexDirection: 'row',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    gap: 1,
  },
  macroBarEmpty: {
    backgroundColor: homeTheme.colors.muted,
  },
  macroSegment: {
    borderRadius: 2,
    minWidth: 2,
  },
  subtext: {
    color: homeTheme.colors.mutedForeground,
    marginTop: 6,
  },
});
