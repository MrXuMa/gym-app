/**
 * Body weight trend helper — mirrors vm/coach-worker/weightTrend.js so the app and
 * coach context agree on what 'gaining' / 'losing' / 'maintaining' means.
 */

export const WEIGHT_TREND_WINDOW_DAYS = 90;
const MIN_SPAN_DAYS = 14;
const THRESHOLD_LBS = 2;

export type WeightTrend = 'gaining' | 'losing' | 'maintaining' | 'unknown';

export type WeightLogPoint = {
  weight: number;
  recordedAt: string;
};

export type WeightTrendSummary = {
  trend: WeightTrend;
  changeLbs: number | null;
  spanDays: number | null;
  latestLbs: number | null;
  oldestLbs: number | null;
  sampleCount: number;
};

export type WeightTrendLabel = 'Gain' | 'Lose' | 'Maintain' | '—';

function roundOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

export function summarizeWeightLogs(logs: WeightLogPoint[]): WeightTrendSummary {
  if (!Array.isArray(logs) || logs.length === 0) {
    return {
      trend: 'unknown',
      changeLbs: null,
      spanDays: null,
      latestLbs: null,
      oldestLbs: null,
      sampleCount: 0,
    };
  }

  const normalized = logs
    .filter(
      (row) => Number.isFinite(row.weight) && typeof row.recordedAt === 'string' && row.recordedAt,
    )
    .sort(
      (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
    );

  if (normalized.length === 0) {
    return {
      trend: 'unknown',
      changeLbs: null,
      spanDays: null,
      latestLbs: null,
      oldestLbs: null,
      sampleCount: 0,
    };
  }

  const oldest = normalized[0];
  const latest = normalized[normalized.length - 1];
  const change = roundOneDecimal(latest.weight - oldest.weight);
  const spanDays = Math.round(
    (new Date(latest.recordedAt).getTime() - new Date(oldest.recordedAt).getTime()) /
      (1000 * 60 * 60 * 24),
  );

  let trend: WeightTrend = 'unknown';
  if (normalized.length >= 2 && spanDays >= MIN_SPAN_DAYS) {
    if (change >= THRESHOLD_LBS) trend = 'gaining';
    else if (change <= -THRESHOLD_LBS) trend = 'losing';
    else trend = 'maintaining';
  }

  return {
    trend,
    changeLbs: change,
    spanDays,
    latestLbs: roundOneDecimal(latest.weight),
    oldestLbs: roundOneDecimal(oldest.weight),
    sampleCount: normalized.length,
  };
}

export function weightTrendToLabel(trend: WeightTrend): WeightTrendLabel {
  switch (trend) {
    case 'gaining':
      return 'Gain';
    case 'losing':
      return 'Lose';
    case 'maintaining':
      return 'Maintain';
    default:
      return '—';
  }
}
