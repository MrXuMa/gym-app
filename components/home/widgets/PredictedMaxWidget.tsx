import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getWidgetSizing, type WidgetSize } from '@/components/home/widgetSizing';
import { homeTheme } from '@/constants/theme';
import { WEIGHT_UNIT_LABEL } from '@/constants/units';
import { WidgetCard } from '@/components/home/WidgetCard';

type PredictedMaxWidgetProps = {
  size?: WidgetSize;
  minimal?: boolean;
  liftName: string;
  predictedMax: number | null;
  onEdit?: () => void;
};

export function PredictedMaxWidget({
  size = 'compact',
  minimal = false,
  liftName,
  predictedMax,
  onEdit,
}: PredictedMaxWidgetProps) {
  const sizing = getWidgetSizing(size, minimal);
  const displayValue = predictedMax != null ? `${predictedMax} ${WEIGHT_UNIT_LABEL}` : '—';
  const subtext =
    predictedMax != null
      ? `Estimated 1RM for ${liftName}.`
      : `Log sets for ${liftName} to estimate your max.`;

  const content = (
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
      {onEdit ? (
        <Pressable
          style={styles.editHint}
          onPress={onEdit}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Change predicted max exercise"
        >
          <Ionicons
            name="create-outline"
            size={minimal ? 12 : 14}
            color={homeTheme.colors.mutedForeground}
          />
        </Pressable>
      ) : null}
    </WidgetCard>
  );

  if (!onEdit) {
    return content;
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
      onLongPress={onEdit}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityLabel="Predicted max widget. Long press to change exercise."
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    flex: 1,
  },
  pressed: {
    opacity: 0.85,
  },
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
  editHint: {
    position: 'absolute',
    top: 6,
    right: 6,
    padding: 4,
    opacity: 0.55,
  },
});
