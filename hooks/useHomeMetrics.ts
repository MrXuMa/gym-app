import { useCallback, useEffect, useState } from 'react';
import { fetchHomeMetrics, type HomeMetrics } from '@/lib/homeMetrics';

const EMPTY: HomeMetrics = {
  streakDays: 0,
  workoutsThisWeek: 0,
  currentWeight: null,
  weightTrendLabel: '—',
  predictedMax: null,
  predictedLiftName: 'Bench Press',
};

export function useHomeMetrics() {
  const [metrics, setMetrics] = useState<HomeMetrics>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setMetrics(await fetchHomeMetrics());
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return { metrics, loading, refreshing, refresh };
}
