/**
 * Bounded coach_context rebuild — tune prompt size vs fidelity here.
 *
 * Flow: workouts/profile/weight → merge in contextMerge.js → coach_context row in Supabase.
 * Advice jobs read that JSON only (no per-user files on the VM).
 */

/** Sessions embedded in coach_context.recent_sessions (and derived signals). */
const MAX_RECENT_SESSIONS = 10;

/** Workouts queried for streak / 7d / 28d metrics (can exceed recent_sessions). */
const MAX_METRICS_WORKOUTS = 30;

/** Prior advice one-liners kept for long-term coach memory. */
const MAX_RESPONSE_SUMMARIES = 25;

/** Legacy coach_notes cap (same order of magnitude as summaries). */
const MAX_COACH_NOTES = 5;

/** Body-weight logs window when rebuilding profile weight_trend. */
const WEIGHT_WINDOW_DAYS = 90;

module.exports = {
  MAX_RECENT_SESSIONS,
  MAX_METRICS_WORKOUTS,
  MAX_RESPONSE_SUMMARIES,
  MAX_COACH_NOTES,
  WEIGHT_WINDOW_DAYS,
};
