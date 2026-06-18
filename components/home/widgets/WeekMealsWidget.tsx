import { StyleSheet, Text, View } from 'react-native';
import { getWidgetSizing, type WidgetSize } from '@/components/home/widgetSizing';
import { homeTheme } from '@/constants/theme';
import { WidgetCard } from '@/components/home/WidgetCard';

type WeekMealsWidgetProps = {
  size?: WidgetSize;
  mealsThisWeek: number;
};

export function WeekMealsWidget({ size = 'small', mealsThisWeek }: WeekMealsWidgetProps) {
  const sizing = getWidgetSizing(size);
  const subtext =
    mealsThisWeek === 0
      ? 'No meals logged this week yet.'
      : mealsThisWeek === 1
        ? 'One meal logged. Tap to open your log.'
        : `${mealsThisWeek} meals logged. Tap to open your log.`;

  return (
    <WidgetCard title="Meals this week" size={size}>
      <View style={styles.valueBlock}>
        <Text style={[styles.value, { fontSize: sizing.valueFontSize }]}>{mealsThisWeek}</Text>
        <Text style={[styles.unit, { fontSize: sizing.unitFontSize }]}>meals</Text>
      </View>
      {sizing.showSubtext ? (
        <Text
          style={[styles.subtext, { fontSize: sizing.subtextFontSize, lineHeight: sizing.subtextLineHeight }]}
          numberOfLines={size === 'large' ? undefined : 3}
        >
          {subtext}
        </Text>
      ) : null}
    </WidgetCard>
  );
}

const styles = StyleSheet.create({
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
  subtext: {
    color: homeTheme.colors.mutedForeground,
    marginTop: 6,
  },
});
