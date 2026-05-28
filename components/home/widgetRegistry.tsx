import type { ReactElement } from 'react';
import type { Ionicons } from '@expo/vector-icons';
import type { HomeMetrics } from '@/lib/homeMetrics';
import { WIDGET_IDS, type WidgetId } from '@/lib/widgetSettings';
import { StreakWidget } from '@/components/home/widgets/StreakWidget';
import { PredictedMaxWidget } from '@/components/home/widgets/PredictedMaxWidget';
import { WeightTrendWidget } from '@/components/home/widgets/WeightTrendWidget';
import { WeekSummaryWidget } from '@/components/home/widgets/WeekSummaryWidget';
import { BodyWeightGraphWidget } from '@/components/home/widgets/BodyWeightGraphWidget';

export type WidgetEditAction = {
  id: string;
  label: string;
  iconName: keyof typeof Ionicons.glyphMap;
  onSelect: () => void;
};

export type WidgetRenderResult = {
  element: ReactElement;
  /** Optional tap handler invoked when the user short-presses the widget. */
  onPress?: () => void;
  /** Extra widget-specific actions shown above "Remove widget" in the edit sheet. */
  editActions?: WidgetEditAction[];
};

export type WidgetCallbacks = {
  openPredictedMaxPicker: () => void;
  openWorkouts: () => void;
};

export type WidgetRenderContext = {
  metrics: HomeMetrics;
  callbacks: WidgetCallbacks;
};

export type WidgetDefinition = {
  id: WidgetId;
  title: string;
  description: string;
  /** Grid columns the widget occupies. 1 = half-row, 2 = full-row. */
  widthSpan: 1 | 2;
  iconName: keyof typeof Ionicons.glyphMap;
  render(ctx: WidgetRenderContext): WidgetRenderResult;
};

const REGISTRY: Record<WidgetId, WidgetDefinition> = {
  streak: {
    id: 'streak',
    title: 'Streak',
    description: 'Consecutive days of logged workouts.',
    widthSpan: 1,
    iconName: 'flame-outline',
    render: ({ metrics }) => ({
      element: (
        <StreakWidget size="compact" minimal streakDays={metrics.streakDays} />
      ),
    }),
  },
  'predicted-max': {
    id: 'predicted-max',
    title: 'Predicted max',
    description: 'Estimated 1RM for the lift you choose.',
    widthSpan: 1,
    iconName: 'barbell-outline',
    render: ({ metrics, callbacks }) => ({
      element: (
        <PredictedMaxWidget
          size="compact"
          minimal
          liftName={metrics.predictedLiftName}
          predictedMax={metrics.predictedMax}
        />
      ),
      editActions: [
        {
          id: 'change-exercise',
          label: 'Change exercise',
          iconName: 'swap-horizontal-outline',
          onSelect: callbacks.openPredictedMaxPicker,
        },
      ],
    }),
  },
  'weight-trend': {
    id: 'weight-trend',
    title: 'Body weight',
    description: 'Latest weight and 90-day trend summary.',
    widthSpan: 1,
    iconName: 'speedometer-outline',
    render: ({ metrics }) => ({
      element: (
        <WeightTrendWidget
          size="compact"
          minimal
          currentWeight={metrics.currentWeight}
          trendLabel={metrics.weightTrendLabel}
          changeLbs={metrics.weightChangeLbs}
          spanDays={metrics.weightTrendSpanDays}
        />
      ),
    }),
  },
  'week-summary': {
    id: 'week-summary',
    title: 'This week',
    description: 'Workouts logged so far this week.',
    widthSpan: 1,
    iconName: 'calendar-outline',
    render: ({ metrics, callbacks }) => ({
      element: (
        <WeekSummaryWidget
          size="compact"
          minimal
          workoutsThisWeek={metrics.workoutsThisWeek}
        />
      ),
      onPress: callbacks.openWorkouts,
    }),
  },
  'body-weight-graph': {
    id: 'body-weight-graph',
    title: 'Body weight graph',
    description: 'Full history of logged body-weight entries.',
    widthSpan: 2,
    iconName: 'analytics-outline',
    render: ({ metrics }) => ({
      element: <BodyWeightGraphWidget weightHistory={metrics.weightHistory} />,
    }),
  },
};

export const ALL_WIDGET_DEFINITIONS: WidgetDefinition[] = WIDGET_IDS.map((id) => REGISTRY[id]);

export function getWidgetDefinition(id: WidgetId): WidgetDefinition {
  return REGISTRY[id];
}
