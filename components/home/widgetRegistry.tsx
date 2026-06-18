import type { ReactElement } from 'react';
import type { Ionicons } from '@expo/vector-icons';
import type { HomeMetrics } from '@/lib/homeMetrics';
import { WIDGET_IDS, type WidgetId } from '@/lib/widgetSettings';
import type { WidgetSize } from '@/components/home/widgetSizing';
import { PredictedMaxWidget } from '@/components/home/widgets/PredictedMaxWidget';
import { WeightTrendWidget } from '@/components/home/widgets/WeightTrendWidget';
import { WeekSummaryWidget } from '@/components/home/widgets/WeekSummaryWidget';
import { DailyCaloriesWidget } from '@/components/home/widgets/DailyCaloriesWidget';
import { TodaySplitWidget } from '@/components/home/widgets/TodaySplitWidget';
import { WeekMealsWidget } from '@/components/home/widgets/WeekMealsWidget';
import { TaskBulletinWidget } from '@/components/home/widgets/TaskBulletinWidget';
import { getRecentWeightEntries } from '@/lib/weightWidgetHelpers';
import { requestBulletinAdd } from '@/lib/bulletinTaskUi';

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
  openLog: () => void;
  openTrainingSplit: () => void;
};

export type WidgetRenderContext = {
  metrics: HomeMetrics;
  callbacks: WidgetCallbacks;
};

export type WidgetDefinition = {
  id: WidgetId;
  title: string;
  description: string;
  size: WidgetSize;
  iconName: keyof typeof Ionicons.glyphMap;
  render(ctx: WidgetRenderContext): WidgetRenderResult;
};

const REGISTRY: Record<WidgetId, WidgetDefinition> = {
  'predicted-max': {
    id: 'predicted-max',
    title: 'Predicted max',
    description: 'Estimated 1RM for the lift you choose.',
    size: 'small',
    iconName: 'barbell-outline',
    render: ({ metrics, callbacks }) => ({
      element: (
        <PredictedMaxWidget
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
    description: 'Latest weight and change since your last log.',
    size: 'small',
    iconName: 'speedometer-outline',
    render: ({ metrics }) => ({
      element: (
        <WeightTrendWidget
          currentWeight={metrics.currentWeight}
          changeSinceLastLbs={metrics.weightChangeSinceLastLbs}
          recentWeights={getRecentWeightEntries(metrics.weightHistory, 7).map((point) => point.weight)}
        />
      ),
    }),
  },
  'week-summary': {
    id: 'week-summary',
    title: 'This week',
    description: 'Workouts logged so far this week.',
    size: 'small',
    iconName: 'calendar-outline',
    render: ({ metrics, callbacks }) => ({
      element: <WeekSummaryWidget workoutsThisWeek={metrics.workoutsThisWeek} />,
      onPress: callbacks.openWorkouts,
    }),
  },
  'daily-calories': {
    id: 'daily-calories',
    title: 'Calories today',
    description: "Today's food log total in kilocalories.",
    size: 'small',
    iconName: 'restaurant-outline',
    render: ({ metrics, callbacks }) => ({
      element: (
        <DailyCaloriesWidget
          kcal={metrics.todayCalories}
          protein_g={metrics.todayProteinG}
          carbs_g={metrics.todayCarbsG}
          fat_g={metrics.todayFatG}
        />
      ),
      onPress: callbacks.openLog,
    }),
  },
  'today-split': {
    id: 'today-split',
    title: 'Hit today',
    description: "Today's muscle groups from your training split.",
    size: 'small',
    iconName: 'fitness-outline',
    render: ({ metrics, callbacks }) => ({
      element: <TodaySplitWidget muscles={metrics.todaySplitMuscles} />,
      onPress: callbacks.openTrainingSplit,
    }),
  },
  'week-meals': {
    id: 'week-meals',
    title: 'Meals this week',
    description: 'Meal entries logged so far this week.',
    size: 'small',
    iconName: 'fast-food-outline',
    render: ({ metrics, callbacks }) => ({
      element: <WeekMealsWidget mealsThisWeek={metrics.mealsThisWeek} />,
      onPress: callbacks.openLog,
    }),
  },
  'task-bulletin': {
    id: 'task-bulletin',
    title: 'Task bulletin',
    description: 'Temporary and recurring daily tasks (up to 15).',
    size: 'large',
    iconName: 'checkbox-outline',
    render: () => ({
      element: <TaskBulletinWidget />,
      editActions: [
        {
          id: 'add-task',
          label: 'Add task',
          iconName: 'add-circle-outline',
          onSelect: requestBulletinAdd,
        },
      ],
    }),
  },
};

export const ALL_WIDGET_DEFINITIONS: WidgetDefinition[] = WIDGET_IDS.map((id) => REGISTRY[id]);

export function getWidgetDefinition(id: WidgetId): WidgetDefinition {
  return REGISTRY[id];
}
