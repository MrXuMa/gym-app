import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getWidgetSizing, type WidgetSize } from '@/components/home/widgetSizing';
import { homeTheme } from '@/constants/theme';
import { WidgetCard } from '@/components/home/WidgetCard';

type StreakWidgetProps = {
  size?: WidgetSize;
  streakDays: number;
};

export function StreakWidget({ size = 'compact', streakDays }: StreakWidgetProps) {
  const sizing = getWidgetSizing(size);
  const subtext =
    streakDays === 0
      ? 'Log a workout to begin your streak.'
      : streakDays === 1
        ? 'One day strong. Keep it going.'
        : `${streakDays} consecutive days logged.`;

  return (
    <WidgetCard title="Streak" size={size}>
      <View style={styles.row}>
        <View style={styles.valueBlock}>
          <Text style={[styles.value, { fontSize: sizing.valueFontSize }]}>{streakDays}</Text>
          <Text style={[styles.unit, { fontSize: sizing.unitFontSize }]}>days</Text>
        </View>
        <Ionicons name="library-outline" size={sizing.iconSize} color={homeTheme.colors.accent} />
      </View>
      <Text
        style={[styles.subtext, { fontSize: sizing.subtextFontSize, lineHeight: sizing.subtextLineHeight }]}
        numberOfLines={size === 'large' ? undefined : 3}
      >
        {subtext}
      </Text>
    </WidgetCard>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  valueBlock: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  value: {
    color: homeTheme.colors.textPrimary,
    fontWeight: '700',
  },
  unit: {
    color: homeTheme.colors.textMuted,
    marginBottom: 4,
  },
  subtext: {
    color: homeTheme.colors.textMuted,
  },
});
