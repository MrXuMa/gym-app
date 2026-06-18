import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { fetchHomeMetrics, type HomeMetrics } from '@/lib/homeMetrics';
import {
  disableWidget,
  enableWidget,
  loadWidgetSettings,
  moveWidgetInOrder,
  reorderEnabledWidgets,
  updateWidgetSettings,
  DEFAULT_ENABLED_WIDGET_IDS,
  type WidgetId,
  type WidgetSettings,
} from '@/lib/widgetSettings';

const EMPTY: HomeMetrics = {
  workoutsThisWeek: 0,
  currentWeight: null,
  weightTrendLabel: '—',
  weightChangeLbs: null,
  weightTrendSpanDays: null,
  weightChangeSinceLastLbs: null,
  predictedMax: null,
  predictedLiftName: 'Bench Press',
  predictedLiftExerciseId: null,
  weightHistory: [],
  todayCalories: 0,
  todayProteinG: 0,
  todayCarbsG: 0,
  todayFatG: 0,
  todaySplitMuscles: null,
  mealsThisWeek: 0,
};

const EMPTY_SETTINGS: WidgetSettings = {
  predictedMaxExerciseId: null,
  enabledWidgetIds: DEFAULT_ENABLED_WIDGET_IDS,
};

export function useHomeMetrics() {
  const [metrics, setMetrics] = useState<HomeMetrics>(EMPTY);
  const [settings, setSettings] = useState<WidgetSettings>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadWith = useCallback(async (nextSettings: WidgetSettings) => {
    setMetrics(
      await fetchHomeMetrics({ predictedMaxExerciseId: nextSettings.predictedMaxExerciseId }),
    );
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const stored = await loadWidgetSettings();
        setSettings(stored);
        await loadWith(stored);
      } finally {
        setLoading(false);
      }
    })();
  }, [loadWith]);

  useFocusEffect(
    useCallback(() => {
      if (!loading) {
        void loadWith(settings);
      }
    }, [loadWith, settings, loading]),
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadWith(settings);
    } finally {
      setRefreshing(false);
    }
  }, [loadWith, settings]);

  const setPredictedMaxExerciseId = useCallback(
    async (exerciseId: string | null) => {
      const next = await updateWidgetSettings({ predictedMaxExerciseId: exerciseId });
      setSettings(next);
      await loadWith(next);
    },
    [loadWith],
  );

  const addWidget = useCallback(async (id: WidgetId) => {
    const next = await enableWidget(id);
    setSettings(next);
  }, []);

  const removeWidget = useCallback(async (id: WidgetId) => {
    const next = await disableWidget(id);
    setSettings(next);
  }, []);

  const moveWidget = useCallback(async (id: WidgetId, direction: 'up' | 'down') => {
    const reordered = moveWidgetInOrder(settings.enabledWidgetIds, id, direction);
    if (reordered === settings.enabledWidgetIds) {
      return;
    }

    const next = await reorderEnabledWidgets(reordered);
    setSettings(next);
  }, [settings.enabledWidgetIds]);

  const reorderWidgets = useCallback(async (orderedIds: WidgetId[]) => {
    const next = await reorderEnabledWidgets(orderedIds);
    setSettings(next);
  }, []);

  return {
    metrics,
    settings,
    loading,
    refreshing,
    refresh,
    setPredictedMaxExerciseId,
    addWidget,
    removeWidget,
    moveWidget,
    reorderWidgets,
  };
}
