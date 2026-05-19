import { StyleSheet, Text, View } from 'react-native';
import { getWidgetSizing, type WidgetSize } from '@/components/home/widgetSizing';
import { homeTheme } from '@/constants/theme';
import { WidgetCard } from '@/components/home/WidgetCard';

type WeightTrendWidgetProps = {
  size?: WidgetSize;
  currentWeight: number | null;
  trendLabel: 'Gain' | 'Lose' | 'Maintain' | '—';
};

const SPARKLINE_HEIGHTS = [17, 24, 20, 28, 23, 30, 26];

type SparklinePlaceholderProps = {
  width: number;
  height: number;
};

function SparklinePlaceholder({ width, height }: SparklinePlaceholderProps) {
  return (
    <View style={[styles.sparkline, { width, height }]}>
      {SPARKLINE_HEIGHTS.map((barHeight, index) => (
        <View key={index} style={[styles.sparkBar, { height: barHeight }]} />
      ))}
    </View>
  );
}

export function WeightTrendWidget({
  size = 'compact',
  currentWeight,
  trendLabel,
}: WeightTrendWidgetProps) {
  const sizing = getWidgetSizing(size);
  const weightDisplay = currentWeight != null ? `${currentWeight} lb` : '—';
  const subtext =
    trendLabel === '—'
      ? 'Body weight history coming soon.'
      : `Trend: ${trendLabel}`;

  return (
    <WidgetCard title="Body Weight" size={size}>
      <View style={styles.row}>
        <View style={styles.valueBlock}>
          <Text style={[styles.value, { fontSize: sizing.valueFontSize }]}>{weightDisplay}</Text>
          <Text style={styles.trend}>{trendLabel === '—' ? 'No trend yet' : trendLabel}</Text>
        </View>
        <SparklinePlaceholder width={sizing.sparklineWidth} height={sizing.sparklineHeight} />
      </View>
      <Text
        style={[styles.subtext, { fontSize: sizing.subtextFontSize, lineHeight: sizing.subtextLineHeight }]}
        numberOfLines={size === 'large' ? undefined : 2}
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
    gap: 12,
  },
  valueBlock: {
    flex: 1,
  },
  value: {
    color: homeTheme.colors.textPrimary,
    fontWeight: '700',
  },
  trend: {
    color: homeTheme.colors.accent,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sparkline: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 3,
    opacity: 0.45,
  },
  sparkBar: {
    flex: 1,
    backgroundColor: homeTheme.colors.textPrimary,
    borderRadius: 2,
    minHeight: 4,
  },
  subtext: {
    color: homeTheme.colors.textMuted,
  },
});
