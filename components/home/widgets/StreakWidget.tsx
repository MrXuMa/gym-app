import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getWidgetSizing, type WidgetSize } from '@/components/home/widgetSizing';
import { homeTheme } from '@/constants/theme';
import { WidgetCard } from '@/components/home/WidgetCard';

type StreakWidgetProps = {
  size?: WidgetSize;
  minimal?: boolean;
  streakDays: number;
};

export function StreakWidget({ size = 'compact', minimal = false, streakDays }: StreakWidgetProps) {
  const sizing = getWidgetSizing(size, minimal);
  const subtext =
    streakDays === 0
      ? 'Log a workout to begin your streak.'
      : streakDays === 1
        ? 'One day strong. Keep it going.'
        : `${streakDays} consecutive days logged.`;

  return (
    <WidgetCard title="Streak" size={size} minimal={minimal}>
      <View style={styles.row}>
        <View style={styles.valueBlock}>
          <Text style={[styles.value, { fontSize: sizing.valueFontSize }]}>{streakDays}</Text>
          <Text style={[styles.unit, { fontSize: sizing.unitFontSize }]}>days</Text>
        </View>
        {sizing.showIcon ? (
          <Ionicons name="library-outline" size={sizing.iconSize} color={homeTheme.colors.primary} />
        ) : null}
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
