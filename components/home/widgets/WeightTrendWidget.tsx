import { StyleSheet, Text, View } from 'react-native';
import { getWidgetSizing, type WidgetSize } from '@/components/home/widgetSizing';
import { homeTheme } from '@/constants/theme';
import { WEIGHT_UNIT_LABEL } from '@/constants/units';
import { WidgetCard } from '@/components/home/WidgetCard';

type WeightTrendWidgetProps = {
  size?: WidgetSize;
  minimal?: boolean;
  currentWeight: number | null;
  trendLabel: 'Gain' | 'Lose' | 'Maintain' | '—';
  changeLbs?: number | null;
  spanDays?: number | null;
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

function formatChange(changeLbs: number | null | undefined): string | null {
  if (changeLbs == null || !Number.isFinite(changeLbs) || Math.abs(changeLbs) < 0.05) {
    return null;
  }

  const sign = changeLbs > 0 ? '+' : '−';
  return `${sign}${Math.abs(changeLbs).toFixed(1)} ${WEIGHT_UNIT_LABEL}`;
}

export function WeightTrendWidget({
  size = 'compact',
  minimal = false,
  currentWeight,
  trendLabel,
  changeLbs,
  spanDays,
}: WeightTrendWidgetProps) {
  const sizing = getWidgetSizing(size, minimal);
  const weightDisplay = currentWeight != null ? `${currentWeight} ${WEIGHT_UNIT_LABEL}` : '—';
  const changeText = formatChange(changeLbs);
  const trendText = trendLabel === '—' ? 'No trend' : changeText ?? trendLabel;
  const subtext =
    trendLabel === '—'
      ? 'Log your weight in Profile to see a trend.'
      : changeText && spanDays
        ? `${trendLabel} • ${changeText} over ${spanDays}d`
        : `Trend: ${trendLabel}`;

  return (
    <WidgetCard title="Body weight" size={size} minimal={minimal}>
      <View style={styles.row}>
        <View style={styles.valueBlock}>
          <Text style={[styles.value, { fontSize: sizing.valueFontSize }]} numberOfLines={1}>
            {weightDisplay}
          </Text>
          <Text style={[styles.trend, minimal && styles.trendMinimal]} numberOfLines={1}>
            {trendText}
          </Text>
        </View>
        {sizing.showSparkline ? (
          <SparklinePlaceholder width={sizing.sparklineWidth} height={sizing.sparklineHeight} />
        ) : null}
      </View>
      {sizing.showSubtext ? (
        <Text
          style={[styles.subtext, { fontSize: sizing.subtextFontSize, lineHeight: sizing.subtextLineHeight }]}
          numberOfLines={size === 'large' ? undefined : 2}
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
    gap: 8,
  },
  valueBlock: {
    flex: 1,
    gap: 2,
  },
  value: {
    color: homeTheme.colors.foreground,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  trend: {
    color: homeTheme.colors.primary,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  trendMinimal: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'none',
    letterSpacing: 0,
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
    backgroundColor: homeTheme.colors.foreground,
    borderRadius: 2,
    minHeight: 4,
  },
  subtext: {
    color: homeTheme.colors.mutedForeground,
    marginTop: 6,
  },
});
