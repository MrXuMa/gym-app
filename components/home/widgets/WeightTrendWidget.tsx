import { StyleSheet, Text, View } from 'react-native';
import { getWidgetSizing, type WidgetSize } from '@/components/home/widgetSizing';
import { homeTheme } from '@/constants/theme';
import { WEIGHT_UNIT_LABEL } from '@/constants/units';
import { WidgetCard } from '@/components/home/WidgetCard';
import { WeightSparkline } from '@/components/home/widgets/WeightSparkline';
import { formatWeightChangeSinceLast } from '@/lib/weightWidgetHelpers';

type WeightTrendWidgetProps = {
  size?: WidgetSize;
  currentWeight: number | null;
  changeSinceLastLbs?: number | null;
  recentWeights?: number[];
};

export function WeightTrendWidget({
  size = 'small',
  currentWeight,
  changeSinceLastLbs,
  recentWeights = [],
}: WeightTrendWidgetProps) {
  const sizing = getWidgetSizing(size);
  const weightDisplay = currentWeight != null ? `${currentWeight} ${WEIGHT_UNIT_LABEL}` : '—';
  const hasHistory = recentWeights.length > 0;
  const changeText =
    changeSinceLastLbs != null ? formatWeightChangeSinceLast(changeSinceLastLbs) : null;
  const trendText =
    currentWeight == null
      ? 'No weight logged'
      : changeText ?? (recentWeights.length === 1 ? 'First weigh-in' : 'Log again to compare');
  const subtext =
    currentWeight == null
      ? 'Log your weight in Profile to track changes.'
      : changeSinceLastLbs != null
        ? 'Compared to your previous weigh-in'
        : 'Add another weigh-in to see change since last';

  return (
    <WidgetCard title="Body weight" size={size}>
      <View style={styles.row}>
        <View style={styles.valueBlock}>
          <Text style={[styles.value, { fontSize: sizing.valueFontSize }]} numberOfLines={1}>
            {weightDisplay}
          </Text>
          <Text
            style={[
              styles.secondary,
              { fontSize: sizing.secondaryFontSize, lineHeight: sizing.secondaryLineHeight },
            ]}
            numberOfLines={2}
          >
            {trendText}
          </Text>
        </View>
        {hasHistory ? (
          <WeightSparkline
            weights={recentWeights}
            width={sizing.sparklineWidth}
            height={sizing.sparklineHeight}
          />
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
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
    flex: 1,
  },
  valueBlock: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  value: {
    color: homeTheme.colors.foreground,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  secondary: {
    color: homeTheme.colors.mutedForeground,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  subtext: {
    color: homeTheme.colors.mutedForeground,
    marginTop: 6,
  },
});
