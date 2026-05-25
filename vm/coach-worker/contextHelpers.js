/**
 * Helpers that shape Supabase rows into the JSON the coach prompt consumes:
 *   - buildLoggedPerformance / buildLoggedExerciseNames — top-set allowlist per exercise
 *   - sanitizeAdviceSummary                              — strip weights from saved summaries
 *   - summarizeWeightLogs                                — 90-day body weight trend
 */

const WEIGHT_WINDOW_DAYS = 90;
const WEIGHT_MIN_SPAN_DAYS = 14;
const WEIGHT_THRESHOLD_LBS = 2;
const WEIGHT_MAX_HISTORY_POINTS = 12;

function roundOneDecimal(value) {
  return Math.round(value * 10) / 10;
}

/**
 * Best top-set per exercise across recent sessions. The LLM treats this as the
 * authoritative weight log — never invents weights for exercises missing from it.
 */
function buildLoggedPerformance(recentSessions) {
  const byExercise = new Map();

  for (const session of recentSessions ?? []) {
    for (const set of session.top_sets ?? []) {
      const exercise = set.exercise?.trim();
      if (!exercise || set.weight_lbs == null) {
        continue;
      }

      const candidate = {
        exercise,
        weight_lbs: set.weight_lbs,
        reps: set.reps ?? null,
        e1rm_lbs: set.e1rm_lbs ?? null,
        last_date: session.date ?? null,
      };

      const prev = byExercise.get(exercise);
      if (!prev || (candidate.e1rm_lbs ?? 0) > (prev.e1rm_lbs ?? 0)) {
        byExercise.set(exercise, candidate);
      }
    }
  }

  return [...byExercise.values()].sort((a, b) => (b.e1rm_lbs ?? 0) - (a.e1rm_lbs ?? 0));
}

function buildLoggedExerciseNames(recentSessions) {
  return buildLoggedPerformance(recentSessions).map((entry) => entry.exercise);
}

/** Strip lb/kg numbers from stored summaries so bad advice does not become "memory". */
function sanitizeAdviceSummary(text) {
  return text
    .replace(/\b\d+(?:\.\d+)?\s*(?:lbs?|pounds?|kg|kilograms?)\b/gi, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Body weight trend from body_weight_logs (any order in, oldest→newest out).
 *   trend: 'gaining' | 'losing' | 'maintaining' | 'unknown'
 *   change_lbs / span_days: null if no logs; can be 0 with a single log
 */
function summarizeWeightLogs(logs) {
  const empty = {
    trend: 'unknown',
    change_lbs: null,
    span_days: null,
    latest_lbs: null,
    oldest_lbs: null,
    sample_count: 0,
    history: [],
  };

  if (!Array.isArray(logs) || logs.length === 0) {
    return empty;
  }

  const normalized = logs
    .map((row) => ({ weight: Number(row.weight), recorded_at: row.recorded_at }))
    .filter((row) => Number.isFinite(row.weight) && row.recorded_at)
    .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());

  if (normalized.length === 0) {
    return empty;
  }

  const oldest = normalized[0];
  const latest = normalized[normalized.length - 1];
  const change = roundOneDecimal(latest.weight - oldest.weight);
  const spanDays = Math.round(
    (new Date(latest.recorded_at).getTime() - new Date(oldest.recorded_at).getTime()) /
      (1000 * 60 * 60 * 24),
  );

  let trend = 'unknown';
  if (normalized.length >= 2 && spanDays >= WEIGHT_MIN_SPAN_DAYS) {
    if (change >= WEIGHT_THRESHOLD_LBS) trend = 'gaining';
    else if (change <= -WEIGHT_THRESHOLD_LBS) trend = 'losing';
    else trend = 'maintaining';
  }

  let history = normalized;
  if (history.length > WEIGHT_MAX_HISTORY_POINTS) {
    const step = (history.length - 1) / (WEIGHT_MAX_HISTORY_POINTS - 1);
    const sampled = [];
    for (let i = 0; i < WEIGHT_MAX_HISTORY_POINTS; i += 1) {
      sampled.push(history[Math.round(i * step)]);
    }
    history = sampled;
  }

  return {
    trend,
    change_lbs: change,
    span_days: spanDays,
    latest_lbs: roundOneDecimal(latest.weight),
    oldest_lbs: roundOneDecimal(oldest.weight),
    sample_count: normalized.length,
    history: history.map((row) => ({
      date: row.recorded_at,
      weight_lbs: roundOneDecimal(row.weight),
    })),
  };
}

module.exports = {
  buildLoggedPerformance,
  buildLoggedExerciseNames,
  sanitizeAdviceSummary,
  summarizeWeightLogs,
  WEIGHT_WINDOW_DAYS,
};
