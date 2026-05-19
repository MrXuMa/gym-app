import { StyleSheet, Text } from 'react-native';
import { getWidgetSizing, type WidgetSize } from '@/components/home/widgetSizing';
import { homeTheme } from '@/constants/theme';
import { WidgetCard } from '@/components/home/WidgetCard';

type PredictedMaxWidgetProps = {
  size?: WidgetSize;
  liftName: string;
  predictedMax: number | null;
};

export function PredictedMaxWidget({ size = 'compact', liftName, predictedMax }: PredictedMaxWidgetProps) {
  const sizing = getWidgetSizing(size);
  const displayValue = predictedMax != null ? `${predictedMax} lb` : '— lb';
  const subtext =
    predictedMax != null
      ? `Estimated 1RM for ${liftName}.`
      : `Log sets for ${liftName} to estimate your max.`;

  return (
    <WidgetCard title="Predicted Max" size={size}>
      <Text style={styles.liftName} numberOfLines={1}>
        {liftName}
      </Text>
      <Text style={[styles.value, { fontSize: sizing.valueFontSize }]} numberOfLines={1}>
        {displayValue}
      </Text>
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
  liftName: {
    color: homeTheme.colors.accent,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  value: {
    color: homeTheme.colors.textPrimary,
    fontWeight: '700',
  },
  subtext: {
    color: homeTheme.colors.textMuted,
  },
});
