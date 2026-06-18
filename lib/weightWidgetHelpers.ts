import { WEIGHT_UNIT_LABEL } from '@/constants/units';
import type { WeightHistoryPoint } from '@/lib/homeMetrics';

export const WEIGHT_HISTORY_LIMIT = 10;

export function getRecentWeightEntries(
  history: WeightHistoryPoint[],
  limit = WEIGHT_HISTORY_LIMIT,
): WeightHistoryPoint[] {
  return [...history]
    .filter((point) => Number.isFinite(point.weight) && point.recordedAt)
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime())
    .slice(-limit);
}

export function changeSinceLastEntry(entries: WeightHistoryPoint[]): number | null {
  const latest = entries.at(-1)?.weight;
  const previous = entries.at(-2)?.weight;
  if (latest == null || previous == null) {
    return null;
  }
  return latest - previous;
}

export function formatWeightChangeSinceLast(changeLbs: number): string {
  if (!Number.isFinite(changeLbs) || Math.abs(changeLbs) < 0.05) {
    return 'Same as last log';
  }
  const sign = changeLbs > 0 ? '+' : '−';
  return `${sign}${Math.abs(changeLbs).toFixed(1)} ${WEIGHT_UNIT_LABEL} since last`;
}
