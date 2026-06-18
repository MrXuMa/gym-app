import { StyleSheet, Text } from 'react-native';
import { getWidgetSizing, type WidgetSize } from '@/components/home/widgetSizing';
import { homeTheme } from '@/constants/theme';
import { WEIGHT_UNIT_LABEL } from '@/constants/units';
import { WidgetCard } from '@/components/home/WidgetCard';

type PredictedMaxWidgetProps = {
  size?: WidgetSize;
  liftName: string;
  predictedMax: number | null;
};

export function PredictedMaxWidget({
  size = 'small',
  liftName,
  predictedMax,
}: PredictedMaxWidgetProps) {
  const sizing = getWidgetSizing(size);
  const displayValue = predictedMax != null ? `${predictedMax} ${WEIGHT_UNIT_LABEL}` : '—';
  const subtext =
    predictedMax != null
      ? `Estimated 1RM for ${liftName}.`
      : `Log sets for ${liftName} to estimate your max.`;

  return (
    <WidgetCard title="Predicted max" size={size}>
      <Text style={[styles.value, { fontSize: sizing.valueFontSize }]} numberOfLines={1}>
        {displayValue}
      </Text>
      <Text
        style={[
          styles.secondary,
          { fontSize: sizing.secondaryFontSize, lineHeight: sizing.secondaryLineHeight },
        ]}
        numberOfLines={1}
      >
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
  secondary: {
    color: homeTheme.colors.mutedForeground,
    fontWeight: '500',
  },
  subtext: {
    color: homeTheme.colors.mutedForeground,
    marginTop: 6,
  },
});
