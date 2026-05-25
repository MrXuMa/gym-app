import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getWidgetSizing, type WidgetSize } from '@/components/home/widgetSizing';
import { homeTheme } from '@/constants/theme';
import { WidgetCard } from '@/components/home/WidgetCard';

type WeekSummaryWidgetProps = {
  size?: WidgetSize;
  minimal?: boolean;
  workoutsThisWeek: number;
  onPress: () => void;
};

export function WeekSummaryWidget({
  size = 'compact',
  minimal = false,
  workoutsThisWeek,
  onPress,
}: WeekSummaryWidgetProps) {
  const sizing = getWidgetSizing(size, minimal);
  const subtext =
    workoutsThisWeek === 0
      ? 'No workouts logged this week yet.'
      : workoutsThisWeek === 1
        ? 'One session logged. Tap for history.'
        : `${workoutsThisWeek} sessions logged. Tap for history.`;

  return (
    <Pressable style={styles.pressable} onPress={onPress}>
      <WidgetCard title="This week" size={size} minimal={minimal}>
        <View style={styles.valueBlock}>
          <Text style={[styles.value, { fontSize: sizing.valueFontSize }]}>{workoutsThisWeek}</Text>
          <Text style={[styles.unit, { fontSize: sizing.unitFontSize }]}>workouts</Text>
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
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
  subtext: {
    color: homeTheme.colors.mutedForeground,
    marginTop: 6,
  },
});
