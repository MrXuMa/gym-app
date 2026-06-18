import { StyleSheet, Text, View } from 'react-native';
import { getWidgetSizing, type WidgetSize } from '@/components/home/widgetSizing';
import { homeTheme } from '@/constants/theme';
import { WidgetCard } from '@/components/home/WidgetCard';

const VISIBLE_MUSCLE_LIMIT = 3;

type TodaySplitWidgetProps = {
  size?: WidgetSize;
  muscles: string[] | null;
};

export function TodaySplitWidget({ size = 'small', muscles }: TodaySplitWidgetProps) {
  const sizing = getWidgetSizing(size);

  return (
    <WidgetCard title="Hit today" size={size}>
      {renderBody(muscles, sizing)}
    </WidgetCard>
  );
}

function renderBody(muscles: string[] | null, sizing: ReturnType<typeof getWidgetSizing>) {
  if (muscles === null) {
    return (
      <>
        <Text style={[styles.value, { fontSize: sizing.valueFontSize }]} numberOfLines={1}>
          None
        </Text>
        <Text
          style={[
            styles.secondary,
            { fontSize: sizing.secondaryFontSize, lineHeight: sizing.secondaryLineHeight },
          ]}
          numberOfLines={1}
        >
          No split set
        </Text>
      </>
    );
  }

  if (muscles.length === 0) {
    return (
      <>
        <Text style={[styles.value, { fontSize: sizing.valueFontSize }]} numberOfLines={1}>
          Rest
        </Text>
        <Text
          style={[
            styles.secondary,
            { fontSize: sizing.secondaryFontSize, lineHeight: sizing.secondaryLineHeight },
          ]}
          numberOfLines={1}
        >
          Nothing scheduled
        </Text>
      </>
    );
  }

  if (muscles.length === 1) {
    return (
      <>
        <Text style={[styles.value, { fontSize: sizing.valueFontSize }]} numberOfLines={1}>
          {muscles[0]}
        </Text>
        <Text
          style={[
            styles.secondary,
            { fontSize: sizing.secondaryFontSize, lineHeight: sizing.secondaryLineHeight },
          ]}
          numberOfLines={1}
        >
          Scheduled for today
        </Text>
      </>
    );
  }

  const visible = muscles.slice(0, VISIBLE_MUSCLE_LIMIT);

  return (
    <View style={styles.muscleList}>
      {visible.map((muscle) => (
        <Text
          key={muscle}
          style={[
            styles.detail,
            { fontSize: sizing.detailFontSize, lineHeight: sizing.detailLineHeight },
          ]}
          numberOfLines={1}
        >
          {muscle}
        </Text>
      ))}
    </View>
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
  muscleList: {
    gap: 2,
  },
  detail: {
    color: homeTheme.colors.foreground,
    fontWeight: '600',
  },
});
