/**
 * Deterministic recovery / scheduling hints from recent_sessions.
 * Helps the LLM give definitive "train tomorrow" answers instead of vague lists.
 */

const RECOVERY_HOURS = 48;
const MS_PER_HOUR = 60 * 60 * 1000;

function normalizeMuscle(muscle) {
  if (!muscle || typeof muscle !== 'string') {
    return null;
  }
  return muscle.trim();
}

function parseSessionDate(session) {
  const raw = session?.date;
  if (!raw) {
    return null;
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * @param {Array<{ date?: string, muscle_groups?: string[] }>} recentSessions newest first
 */
function buildTrainingSignals(recentSessions) {
  const now = Date.now();
  const lastTrained = new Map();
  const weeklyCounts = new Map();

  const weekAgo = now - 7 * 24 * MS_PER_HOUR;

  for (const session of recentSessions) {
    const sessionDate = parseSessionDate(session);
    if (!sessionDate) {
      continue;
    }

    const sessionMs = sessionDate.getTime();
    const muscles = Array.isArray(session.muscle_groups) ? session.muscle_groups : [];

    for (const rawMuscle of muscles) {
      const muscle = normalizeMuscle(rawMuscle);
      if (!muscle) {
        continue;
      }

      if (!lastTrained.has(muscle) || sessionMs > lastTrained.get(muscle).trained_at_ms) {
        lastTrained.set(muscle, {
          trained_at_ms: sessionMs,
          trained_at: sessionDate.toISOString(),
          session_title: session.title ?? null,
        });
      }

      if (sessionMs >= weekAgo) {
        weeklyCounts.set(muscle, (weeklyCounts.get(muscle) ?? 0) + 1);
      }
    }
  }

  const daysSinceLastHit = {};
  const readyForTraining = [];
  const recentlyTrained = [];

  for (const [muscle, info] of lastTrained.entries()) {
    const hoursSince = (now - info.trained_at_ms) / MS_PER_HOUR;
    const daysSince = Math.round((hoursSince / 24) * 10) / 10;
    daysSinceLastHit[muscle] = daysSince;

    if (hoursSince >= RECOVERY_HOURS) {
      readyForTraining.push({
        muscle,
        days_since_last_session: daysSince,
        sessions_last_7d: weeklyCounts.get(muscle) ?? 0,
      });
    } else {
      recentlyTrained.push({
        muscle,
        hours_since_last_session: Math.round(hoursSince),
        last_session_title: info.session_title,
      });
    }
  }

  readyForTraining.sort((a, b) => {
    if (a.sessions_last_7d !== b.sessions_last_7d) {
      return a.sessions_last_7d - b.sessions_last_7d;
    }
    return b.days_since_last_session - a.days_since_last_session;
  });

  const lastSession = recentSessions[0] ?? null;
  const lastSessionDate = parseSessionDate(lastSession);

  return {
    recovery_window_hours: RECOVERY_HOURS,
    last_session: lastSession
      ? {
          date: lastSession.date ?? null,
          title: lastSession.title ?? null,
          muscle_groups: lastSession.muscle_groups ?? [],
        }
      : null,
    days_since_last_workout: lastSessionDate
      ? Math.round(((now - lastSessionDate.getTime()) / (24 * MS_PER_HOUR)) * 10) / 10
      : null,
    days_since_last_hit_by_muscle: daysSinceLastHit,
    muscles_ready_for_training: readyForTraining.slice(0, 8),
    muscles_recently_trained_avoid: recentlyTrained.slice(0, 8),
    weekly_session_count_by_muscle: Object.fromEntries(weeklyCounts),
    programming_hint:
      readyForTraining.length > 0
        ? `Prioritize muscles with ≥${RECOVERY_HOURS}h recovery and lower weekly frequency: ${readyForTraining
            .slice(0, 3)
            .map((r) => r.muscle)
            .join(', ')}.`
        : 'No muscle recovery data yet — use goals and general push/pull/legs structure.',
  };
}

module.exports = { buildTrainingSignals };
