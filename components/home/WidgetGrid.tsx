import { ReactElement } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { WidgetSize } from '@/components/home/widgetSizing';
import type { HomeMetrics } from '@/lib/homeMetrics';
import { homeTheme } from '@/constants/theme';
import { StreakWidget } from '@/components/home/widgets/StreakWidget';
import { PredictedMaxWidget } from '@/components/home/widgets/PredictedMaxWidget';
import { WeightTrendWidget } from '@/components/home/widgets/WeightTrendWidget';
import { WeekSummaryWidget } from '@/components/home/widgets/WeekSummaryWidget';

export type WidgetGridLayout = 'home' | 'metrics';

type WidgetGridProps = {
  metrics: HomeMetrics;
  layout?: WidgetGridLayout;
};

const HOME_COLUMNS = 2;
const METRICS_COLUMNS = 1;

function chunkWidgets(widgets: ReactElement[], columns: number) {
  const rows: ReactElement[][] = [];

  for (let index = 0; index < widgets.length; index += columns) {
    rows.push(widgets.slice(index, index + columns));
  }

  return rows;
}

export function WidgetGrid({ metrics, layout = 'home' }: WidgetGridProps) {
  const router = useRouter();
  const isMetricsLayout = layout === 'metrics';
  const columns = isMetricsLayout ? METRICS_COLUMNS : HOME_COLUMNS;
  const widgetSize: WidgetSize = isMetricsLayout ? 'large' : 'compact';

  const widgets: ReactElement[] = [
    <StreakWidget key="streak" size={widgetSize} streakDays={metrics.streakDays} />,
    <PredictedMaxWidget
      key="predicted-max"
      size={widgetSize}
      liftName={metrics.predictedLiftName}
      predictedMax={metrics.predictedMax}
    />,
    <WeightTrendWidget
      key="weight"
      size={widgetSize}
      currentWeight={metrics.currentWeight}
      trendLabel={metrics.weightTrendLabel}
    />,
    <WeekSummaryWidget
      key="week"
      size={widgetSize}
      workoutsThisWeek={metrics.workoutsThisWeek}
      onPress={() => router.push('/workouts')}
    />,
  ];

  const rows = chunkWidgets(widgets, columns);

  return (
    <View style={styles.grid}>
      {rows.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={styles.row}>
          {row.map((widget, columnIndex) => (
            <View
              key={`cell-${rowIndex}-${columnIndex}`}
              style={isMetricsLayout ? styles.metricsCell : styles.homeCell}
            >
              {widget}
            </View>
          ))}
          {!isMetricsLayout && row.length < columns ? (
            <View style={[styles.homeCell, styles.cellSpacer]} />
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: homeTheme.spacing.cardGap,
  },
  row: {
    flexDirection: 'row',
    gap: homeTheme.spacing.cardGap,
  },
  homeCell: {
    flex: 1,
    aspectRatio: 1,
  },
  metricsCell: {
    width: '100%',
  },
  cellSpacer: {
    opacity: 0,
  },
});
