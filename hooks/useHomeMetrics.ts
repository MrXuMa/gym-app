import { useCallback, useEffect, useState } from 'react';
import { fetchHomeMetrics, type HomeMetrics } from '@/lib/homeMetrics';
import { loadWidgetSettings, updateWidgetSettings, type WidgetSettings } from '@/lib/widgetSettings';

const EMPTY: HomeMetrics = {
  streakDays: 0,
  workoutsThisWeek: 0,
  currentWeight: null,
  weightTrendLabel: '—',
  weightChangeLbs: null,
  weightTrendSpanDays: null,
  predictedMax: null,
  predictedLiftName: 'Bench Press',
  predictedLiftExerciseId: null,
};

const EMPTY_SETTINGS: WidgetSettings = {
  predictedMaxExerciseId: null,
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

  return {
    metrics,
    settings,
    loading,
    refreshing,
    refresh,
    setPredictedMaxExerciseId,
  };
}
