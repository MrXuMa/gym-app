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

type WidgetGridProps = {
  metrics: HomeMetrics;
  onEditPredictedMax?: () => void;
};

const HOME_COLUMNS = 2;

function chunkWidgets(widgets: ReactElement[], columns: number) {
  const rows: ReactElement[][] = [];

  for (let index = 0; index < widgets.length; index += columns) {
    rows.push(widgets.slice(index, index + columns));
  }

  return rows;
}

export function WidgetGrid({ metrics, onEditPredictedMax }: WidgetGridProps) {
  const router = useRouter();
  const widgetSize: WidgetSize = 'compact';
  const minimal = true;

  const widgets: ReactElement[] = [
    <StreakWidget key="streak" size={widgetSize} minimal={minimal} streakDays={metrics.streakDays} />,
    <PredictedMaxWidget
      key="predicted-max"
      size={widgetSize}
      minimal={minimal}
      liftName={metrics.predictedLiftName}
      predictedMax={metrics.predictedMax}
      onEdit={onEditPredictedMax}
    />,
    <WeightTrendWidget
      key="weight"
      size={widgetSize}
      minimal={minimal}
      currentWeight={metrics.currentWeight}
      trendLabel={metrics.weightTrendLabel}
      changeLbs={metrics.weightChangeLbs}
      spanDays={metrics.weightTrendSpanDays}
    />,
    <WeekSummaryWidget
      key="week"
      size={widgetSize}
      minimal={minimal}
      workoutsThisWeek={metrics.workoutsThisWeek}
      onPress={() => router.push('/workouts')}
    />,
  ];

  const rows = chunkWidgets(widgets, HOME_COLUMNS);

  return (
    <View style={styles.grid}>
      {rows.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={styles.row}>
          {row.map((widget, columnIndex) => (
            <View
              key={`cell-${rowIndex}-${columnIndex}`}
              style={styles.homeCell}
            >
              {widget}
            </View>
          ))}
          {row.length < HOME_COLUMNS ? (
            <View style={[styles.homeCell, styles.cellSpacer]} />
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  homeCell: {
    flex: 1,
    alignSelf: 'stretch',
  },
  cellSpacer: {
    opacity: 0,
  },
});
