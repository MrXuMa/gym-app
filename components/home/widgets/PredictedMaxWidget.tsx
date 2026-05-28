import { StyleSheet, Text } from 'react-native';
import { getWidgetSizing, type WidgetSize } from '@/components/home/widgetSizing';
import { homeTheme } from '@/constants/theme';
import { WEIGHT_UNIT_LABEL } from '@/constants/units';
import { WidgetCard } from '@/components/home/WidgetCard';

type PredictedMaxWidgetProps = {
  size?: WidgetSize;
  minimal?: boolean;
  liftName: string;
  predictedMax: number | null;
};

export function PredictedMaxWidget({
  size = 'compact',
  minimal = false,
  liftName,
  predictedMax,
}: PredictedMaxWidgetProps) {
  const sizing = getWidgetSizing(size, minimal);
  const displayValue = predictedMax != null ? `${predictedMax} ${WEIGHT_UNIT_LABEL}` : '—';
  const subtext =
    predictedMax != null
      ? `Estimated 1RM for ${liftName}.`
      : `Log sets for ${liftName} to estimate your max.`;

  return (
    <WidgetCard title="Predicted max" size={size} minimal={minimal}>
      <Text style={[styles.value, { fontSize: sizing.valueFontSize }]} numberOfLines={1}>
        {displayValue}
      </Text>
      <Text style={[styles.liftName, minimal && styles.liftNameMinimal]} numberOfLines={1}>
        {liftName}
      </Text>
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
  value: {
    color: homeTheme.colors.foreground,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  liftName: {
    color: homeTheme.colors.primary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  liftNameMinimal: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  subtext: {
    color: homeTheme.colors.mutedForeground,
    marginTop: 6,
  },
});
