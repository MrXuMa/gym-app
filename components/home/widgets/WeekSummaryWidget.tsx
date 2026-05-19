import { Pressable, StyleSheet, Text } from 'react-native';
import { getWidgetSizing, type WidgetSize } from '@/components/home/widgetSizing';
import { homeTheme } from '@/constants/theme';
import { WidgetCard } from '@/components/home/WidgetCard';

type WeekSummaryWidgetProps = {
  size?: WidgetSize;
  workoutsThisWeek: number;
  onPress: () => void;
};

export function WeekSummaryWidget({ size = 'compact', workoutsThisWeek, onPress }: WeekSummaryWidgetProps) {
  const sizing = getWidgetSizing(size);

  const subtext =
    workoutsThisWeek === 0
      ? 'No workouts logged this week yet.'
      : workoutsThisWeek === 1
        ? 'One session logged. Tap for history.'
        : `${workoutsThisWeek} sessions logged. Tap for history.`;

  return (
    <Pressable style={styles.pressable} onPress={onPress}>
      <WidgetCard title="This Week" size={size}>
        <Text style={[styles.value, { fontSize: sizing.valueFontSize }]}>{workoutsThisWeek}</Text>
        <Text style={[styles.unit, { fontSize: sizing.unitFontSize }]}>workouts</Text>
        <Text
          style={[styles.subtext, { fontSize: sizing.subtextFontSize, lineHeight: sizing.subtextLineHeight }]}
          numberOfLines={size === 'large' ? undefined : 3}
        >
          {subtext}
        </Text>
      </WidgetCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    flex: 1,
  },
  value: {
    color: homeTheme.colors.textPrimary,
    fontWeight: '700',
  },
  unit: {
    color: homeTheme.colors.textMuted,
    marginTop: 2,
  },
  subtext: {
    color: homeTheme.colors.textMuted,
  },
});
