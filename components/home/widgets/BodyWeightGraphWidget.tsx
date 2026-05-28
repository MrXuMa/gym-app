import { useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { homeTheme } from '@/constants/theme';
import { WEIGHT_UNIT_LABEL } from '@/constants/units';
import { WidgetCard } from '@/components/home/WidgetCard';
import type { WeightHistoryPoint } from '@/lib/homeMetrics';

const CHART_HEIGHT = 160;
const CHART_INNER_PADDING_X = 14;
const CHART_INNER_PADDING_TOP = 8;
const CHART_INNER_PADDING_BOTTOM = 28;
const Y_AXIS_LABEL_WIDTH = 36;
const Y_GRID_LINES = 4;
const X_LABEL_TARGET_COUNT = 5;
const DOT_SIZE = 8;
const LINE_THICKNESS = 2;

type BodyWeightGraphWidgetProps = {
  weightHistory: WeightHistoryPoint[];
};

type PlotPoint = {
  x: number;
  y: number;
  weight: number;
  date: Date;
};

function formatDateMMDDYYYY(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}/${day}/${date.getFullYear()}`;
}

/**
 * Picks evenly spaced indices so we render approximately `target` labels
 * along the X axis without overcrowding when the history is dense.
 */
function pickLabelIndices(total: number, target: number) {
  if (total <= 0) {
    return new Set<number>();
  }
  if (total <= target) {
    return new Set<number>(Array.from({ length: total }, (_, i) => i));
  }

  const indices = new Set<number>();
  for (let i = 0; i < target; i += 1) {
    const idx = Math.round((i * (total - 1)) / (target - 1));
    indices.add(idx);
  }
  return indices;
}

/**
 * Connects two plot points with a thin rotated View. Uses transformOrigin so the
 * segment pivots from its top-left corner — no SVG dependency required.
 */
function LineSegment({ from, to }: { from: PlotPoint; to: PlotPoint }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (!Number.isFinite(length) || length === 0) {
    return null;
  }
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.segment,
        {
          left: from.x,
          top: from.y - LINE_THICKNESS / 2,
          width: length,
          transform: [{ rotate: `${angleDeg}deg` }],
        },
      ]}
    />
  );
}

export function BodyWeightGraphWidget({ weightHistory }: BodyWeightGraphWidgetProps) {
  const [chartWidth, setChartWidth] = useState(0);

  const sortedHistory = useMemo(() => {
    return [...weightHistory]
      .map((point) => ({ ...point, date: new Date(point.recordedAt) }))
      .filter((point) => !Number.isNaN(point.date.getTime()) && Number.isFinite(point.weight))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [weightHistory]);

  const { points, minWeight, maxWeight } = useMemo(() => {
    if (chartWidth <= 0 || sortedHistory.length === 0) {
      return { points: [] as PlotPoint[], minWeight: 0, maxWeight: 0 };
    }

    const weights = sortedHistory.map((p) => p.weight);
    const minRaw = Math.min(...weights);
    const maxRaw = Math.max(...weights);
    // Pad the range so the line never sits flush against the top/bottom edge.
    const span = maxRaw - minRaw;
    const padding = span === 0 ? Math.max(1, maxRaw * 0.05) : span * 0.1;
    const minScaled = minRaw - padding;
    const maxScaled = maxRaw + padding;
    const scaledSpan = maxScaled - minScaled;

    const usableWidth = chartWidth - Y_AXIS_LABEL_WIDTH - CHART_INNER_PADDING_X * 2;
    const usableHeight = CHART_HEIGHT - CHART_INNER_PADDING_TOP - CHART_INNER_PADDING_BOTTOM;

    const xStep = sortedHistory.length === 1 ? 0 : usableWidth / (sortedHistory.length - 1);
    const baseX = Y_AXIS_LABEL_WIDTH + CHART_INNER_PADDING_X;

    const plotted: PlotPoint[] = sortedHistory.map((point, index) => {
      const ratio = scaledSpan === 0 ? 0.5 : (point.weight - minScaled) / scaledSpan;
      const x = sortedHistory.length === 1 ? baseX + usableWidth / 2 : baseX + xStep * index;
      const y = CHART_INNER_PADDING_TOP + (1 - ratio) * usableHeight;
      return { x, y, weight: point.weight, date: point.date };
    });

    return { points: plotted, minWeight: minScaled, maxWeight: maxScaled };
  }, [chartWidth, sortedHistory]);

  const yAxisLabels = useMemo(() => {
    if (points.length === 0) {
      return [];
    }
    const labels: { value: number; y: number }[] = [];
    const usableHeight = CHART_HEIGHT - CHART_INNER_PADDING_TOP - CHART_INNER_PADDING_BOTTOM;
    for (let i = 0; i < Y_GRID_LINES; i += 1) {
      const ratio = i / (Y_GRID_LINES - 1);
      const value = maxWeight - ratio * (maxWeight - minWeight);
      const y = CHART_INNER_PADDING_TOP + ratio * usableHeight;
      labels.push({ value, y });
    }
    return labels;
  }, [maxWeight, minWeight, points.length]);

  const labelIndices = useMemo(
    () => pickLabelIndices(points.length, X_LABEL_TARGET_COUNT),
    [points.length],
  );

  function handleLayout(event: LayoutChangeEvent) {
    setChartWidth(event.nativeEvent.layout.width);
  }

  return (
    <WidgetCard title="Body weight trend">
      {sortedHistory.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            Log your body weight in Profile to start tracking your trend.
          </Text>
        </View>
      ) : (
        <View style={styles.chart} onLayout={handleLayout}>
          {yAxisLabels.map((label) => (
            <View
              key={`grid-${label.y.toFixed(2)}`}
              pointerEvents="none"
              style={[styles.gridLine, { top: label.y, left: Y_AXIS_LABEL_WIDTH }]}
            />
          ))}
          {yAxisLabels.map((label) => (
            <Text
              key={`y-label-${label.y.toFixed(2)}`}
              style={[styles.yLabel, { top: label.y - 7 }]}
              numberOfLines={1}
            >
              {Math.round(label.value)}
            </Text>
          ))}

          {points.map((point, index) => {
            if (index === 0) {
              return null;
            }
            return (
              <LineSegment
                key={`seg-${index}`}
                from={points[index - 1]}
                to={point}
              />
            );
          })}

          {points.map((point, index) => (
            <View
              key={`dot-${index}`}
              pointerEvents="none"
              style={[
                styles.dot,
                {
                  left: point.x - DOT_SIZE / 2,
                  top: point.y - DOT_SIZE / 2,
                },
              ]}
            />
          ))}

          {points.map((point, index) => {
            if (!labelIndices.has(index)) {
              return null;
            }
            return (
              <Text
                key={`x-label-${index}`}
                style={[
                  styles.xLabel,
                  {
                    left: point.x - 38,
                    top: CHART_HEIGHT - CHART_INNER_PADDING_BOTTOM + 6,
                  },
                ]}
                numberOfLines={1}
              >
                {formatDateMMDDYYYY(point.date)}
              </Text>
            );
          })}

          <Text style={styles.unitLabel}>{WEIGHT_UNIT_LABEL}</Text>
        </View>
      )}
    </WidgetCard>
  );
}

const styles = StyleSheet.create({
  empty: {
    height: CHART_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  emptyText: {
    color: homeTheme.colors.mutedForeground,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  chart: {
    height: CHART_HEIGHT,
    position: 'relative',
  },
  gridLine: {
    position: 'absolute',
    right: CHART_INNER_PADDING_X,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(163, 163, 163, 0.18)',
  },
  yLabel: {
    position: 'absolute',
    left: 0,
    width: Y_AXIS_LABEL_WIDTH - 4,
    textAlign: 'right',
    color: homeTheme.colors.mutedForeground,
    fontSize: 10,
    fontVariant: ['tabular-nums'],
  },
  segment: {
    position: 'absolute',
    height: LINE_THICKNESS,
    backgroundColor: homeTheme.colors.primary,
    borderRadius: LINE_THICKNESS / 2,
    transformOrigin: '0 50%',
  },
  dot: {
    position: 'absolute',
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: homeTheme.colors.primary,
    borderWidth: 1.5,
    borderColor: homeTheme.colors.background,
  },
  xLabel: {
    position: 'absolute',
    width: 76,
    textAlign: 'center',
    color: homeTheme.colors.mutedForeground,
    fontSize: 10,
    fontVariant: ['tabular-nums'],
  },
  unitLabel: {
    position: 'absolute',
    top: 0,
    left: 0,
    color: homeTheme.colors.mutedForeground,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
