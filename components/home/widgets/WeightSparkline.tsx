import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { homeTheme } from '@/constants/theme';

const MIN_BAR_HEIGHT = 5;

type WeightSparklineProps = {
  weights: number[];
  width?: number;
  height: number;
};

export function WeightSparkline({ weights, width, height }: WeightSparklineProps) {
  const barHeights = useMemo(() => {
    if (weights.length === 0) {
      return [];
    }

    const min = Math.min(...weights);
    const max = Math.max(...weights);
    const span = max - min;
    const maxBar = height - 2;

    return weights.map((weight) => {
      if (span === 0) {
        return Math.round(maxBar * 0.55);
      }
      const ratio = (weight - min) / span;
      return Math.round(MIN_BAR_HEIGHT + ratio * (maxBar - MIN_BAR_HEIGHT));
    });
  }, [height, weights]);

  if (weights.length === 0) {
    return <View style={[styles.empty, { width, height }]} />;
  }

  return (
    <View
      style={[
        styles.sparkline,
        { height },
        width != null ? { width } : styles.sparklineFullWidth,
      ]}
      accessibilityLabel="Weight trend sparkline"
    >
      {barHeights.map((barHeight, index) => {
        const isLatest = index === barHeights.length - 1;
        return (
          <View
            key={`bar-${index}`}
            style={[
              styles.sparkBar,
              { height: barHeight },
              isLatest ? styles.sparkBarLatest : styles.sparkBarMuted,
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  sparkline: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 3,
  },
  sparklineFullWidth: {
    width: '100%',
    gap: 4,
  },
  empty: {
    borderRadius: 6,
    backgroundColor: homeTheme.colors.muted,
  },
  sparkBar: {
    flex: 1,
    borderRadius: 2,
    minWidth: 3,
  },
  sparkBarMuted: {
    backgroundColor: 'rgba(163, 163, 163, 0.35)',
  },
  sparkBarLatest: {
    backgroundColor: homeTheme.colors.primary,
  },
});
