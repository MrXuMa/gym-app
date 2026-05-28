/**
 * Rebuild coach_context for one user from bounded Supabase queries.
 * Used by the Supabase pull worker — workout/profile data is rebuilt from source;
 * advice memory (response_summaries, last_advice, coach_notes) is preserved.
 *
 * Durable storage: coach_context.context in Supabase only (see coachContextLimits.js).
 */

const { buildTrainingSignals } = require('./trainingSignals');
const { buildTrainingSplitContext } = require('./trainingSplit');
const {
  MAX_COACH_NOTES,
  MAX_METRICS_WORKOUTS,
  MAX_RECENT_SESSIONS,
  MAX_RESPONSE_SUMMARIES,
  WEIGHT_WINDOW_DAYS,
} = require('./coachContextLimits');
const {
  buildLoggedPerformance,
  buildLoggedExerciseNames,
  summarizeWeightLogs,
} = require('./contextHelpers');

function epley(weight, reps) {
  if (!weight || !reps || weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return Math.round(weight);
  return Math.round(weight * (1 + reps / 30));
}

function toDateKey(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * Strict-today streak: returns the number of consecutive days (including today)
 * the athlete has logged a workout. If there is no workout dated today, the
 * streak is 0 — historical sequences without a tail at today do not count.
 */
function computeStreak(dates) {
  if (!dates.length) return 0;

  const keys = new Set(dates.map(toDateKey));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!keys.has(toDateKey(today.toISOString()))) {
    return 0;
  }

  let streak = 0;
  const cursor = new Date(today);
  while (keys.has(toDateKey(cursor.toISOString()))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function startOfWeek(d) {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  s.setDate(s.getDate() - s.getDay());
  return s;
}

/**
 * Summarise the last 7 days of nutrition logs into daily macro averages.
 * Included in coach context so the LLM can comment on nutrition trends.
 */
function buildNutritionSummary(logs) {
  if (!Array.isArray(logs) || logs.length === 0) return null;

  const byDay = new Map();
  for (const row of logs) {
    const day = (row.logged_at ?? '').slice(0, 10);
    if (!day) continue;
    const existing = byDay.get(day) ?? { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, entries: 0 };
    existing.kcal += row.kcal ?? 0;
    existing.protein_g += parseFloat(row.protein_g ?? 0);
    existing.carbs_g += parseFloat(row.carbs_g ?? 0);
    existing.fat_g += parseFloat(row.fat_g ?? 0);
    existing.entries += 1;
    byDay.set(day, existing);
  }

  const days = [...byDay.entries()].sort(([a], [b]) => b.localeCompare(a));
  const totals = days.reduce((acc, [, v]) => ({
    kcal: acc.kcal + v.kcal,
    protein_g: acc.protein_g + v.protein_g,
    carbs_g: acc.carbs_g + v.carbs_g,
    fat_g: acc.fat_g + v.fat_g,
  }), { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });

  const n = days.length || 1;
  return {
    days_logged: days.length,
    avg_kcal_per_day: Math.round(totals.kcal / n),
    avg_protein_g: Math.round(totals.protein_g / n),
    avg_carbs_g: Math.round(totals.carbs_g / n),
    avg_fat_g: Math.round(totals.fat_g / n),
    daily: days.slice(0, 7).map(([date, v]) => ({
      date,
      kcal: Math.round(v.kcal),
      protein_g: Math.round(v.protein_g),
      carbs_g: Math.round(v.carbs_g),
      fat_g: Math.round(v.fat_g),
    })),
  };
}

function normalizeLastAdvice(raw) {
  if (!raw || typeof raw !== 'object') {
    return { at: null, question: null, summary: null };
  }
  return {
    at: raw.at ?? null,
    question: raw.question ?? raw.topic ?? null,
    summary: raw.summary ?? null,
  };
}

function normalizeResponseSummaries(previousContext) {
  const raw = Array.isArray(previousContext.response_summaries)
    ? previousContext.response_summaries
    : Array.isArray(previousContext.coach_notes)
      ? previousContext.coach_notes
      : [];

  return raw
    .filter((entry) => entry && typeof entry === 'object')
    .slice(0, MAX_RESPONSE_SUMMARIES);
}

function normalizeCoachNotes(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((note) => note && typeof note === 'object')
    .slice(0, MAX_COACH_NOTES);
}

function buildSessionSummary(workout, logsForWorkout) {
  const byExercise = new Map();

  for (const log of logsForWorkout) {
    const ex = log.exercises ?? {};
    const entry = byExercise.get(log.exercise_id) ?? {
      name: ex.name ?? 'Exercise',
      muscle: ex.target_muscle ?? null,
      sets: [],
    };
    if (log.weight != null && log.reps != null) {
      entry.sets.push({
        weight_lbs: log.weight,
        reps: log.reps,
        e1rm_lbs: epley(log.weight, log.reps),
      });
    }
    byExercise.set(log.exercise_id, entry);
  }

  const topSets = [];
  const muscles = new Set();
  for (const exercise of byExercise.values()) {
    if (exercise.muscle) muscles.add(exercise.muscle);

    const best = exercise.sets.reduce(
      (top, set) => (set.e1rm_lbs > (top?.e1rm_lbs ?? 0) ? set : top),
      null,
    );
    if (best) {
      topSets.push({
        exercise: exercise.name,
        weight_lbs: best.weight_lbs,
        reps: best.reps,
        e1rm_lbs: best.e1rm_lbs,
      });
    }
  }
  topSets.sort((a, b) => b.e1rm_lbs - a.e1rm_lbs);

  return {
    workout_id: workout.id,
    date: workout.date ?? workout.ended_at ?? workout.started_at,
    title: workout.title,
    duration_min:
      workout.duration_seconds != null ? Math.round(workout.duration_seconds / 60) : null,
    top_sets: topSets.slice(0, 5),
    muscle_groups: [...muscles],
  };
}

async function upsertCoachContext(userId, context, supabaseRest) {
  const patched = await supabaseRest('PATCH', `coach_context?user_id=eq.${userId}`, {
    body: { context, updated_at: context.updated_at },
    prefer: 'return=representation',
  });

  if (!Array.isArray(patched) || patched.length === 0) {
    await supabaseRest('POST', 'coach_context', {
      body: { user_id: userId, context, updated_at: context.updated_at },
      prefer: 'return=representation',
    });
  }
}

/**
 * @param {string} userId
 * @param {(method: string, path: string, opts?: object) => Promise<unknown>} supabaseRest
 */
async function rebuildUserCoachContext(userId, supabaseRest) {
  const weightCutoff = new Date();
  weightCutoff.setDate(weightCutoff.getDate() - WEIGHT_WINDOW_DAYS);

  const nutritionCutoff = new Date();
  nutritionCutoff.setDate(nutritionCutoff.getDate() - 7);

  const [profiles, recentWorkouts, previousRows, weightLogs, splitRows, nutritionLogs] = await Promise.all([
    supabaseRest(
      'GET',
      `profiles?id=eq.${userId}&select=username,first_name,last_name,weight,goals&limit=1`,
    ),
    supabaseRest(
      'GET',
      `user_workouts?user_id=eq.${userId}&status=eq.completed&select=id,title,date,started_at,ended_at,duration_seconds&order=date.desc&limit=${MAX_METRICS_WORKOUTS}`,
    ),
    supabaseRest('GET', `coach_context?user_id=eq.${userId}&select=context&limit=1`).catch(
      () => [],
    ),
    supabaseRest(
      'GET',
      `body_weight_logs?user_id=eq.${userId}&recorded_at=gte.${weightCutoff.toISOString()}&select=weight,recorded_at&order=recorded_at.asc`,
    ).catch(() => []),
    supabaseRest(
      'GET',
      `split_information?user_id=eq.${userId}&select=schedule&limit=1`,
    ).catch(() => []),
    supabaseRest(
      'GET',
      `nutrition_logs?user_id=eq.${userId}&logged_at=gte.${nutritionCutoff.toISOString()}&select=logged_at,kcal,protein_g,carbs_g,fat_g&order=logged_at.desc&limit=50`,
    ).catch(() => []),
  ]);

  const profile = profiles[0] ?? {};
  const splitSchedule = splitRows[0]?.schedule ?? null;
  const trainingSplit = buildTrainingSplitContext(splitSchedule);
  const previousContext = previousRows[0]?.context ?? {};
  const sessionWorkouts = recentWorkouts.slice(0, MAX_RECENT_SESSIONS);
  const sessionIds = sessionWorkouts.map((w) => w.id);

  let logs = [];
  if (sessionIds.length > 0) {
    logs = await supabaseRest(
      'GET',
      `workout_logs?workout_id=in.(${sessionIds.join(',')})&select=workout_id,exercise_id,set_number,reps,weight,exercises(name,target_muscle)`,
    );
  }

  const logsByWorkout = new Map();
  for (const log of logs) {
    const list = logsByWorkout.get(log.workout_id) ?? [];
    list.push(log);
    logsByWorkout.set(log.workout_id, list);
  }

  const recentSessions = sessionWorkouts.map((workout) =>
    buildSessionSummary(workout, logsByWorkout.get(workout.id) ?? []),
  );

  const dates = recentWorkouts.map((w) => w.date).filter(Boolean);
  const now = new Date();
  const weekStart = startOfWeek(now);
  const day28Ago = new Date(now);
  day28Ago.setDate(day28Ago.getDate() - 28);

  const displayName =
    [profile.first_name, profile.last_name].filter(Boolean).join(' ') ||
    profile.username ||
    'Athlete';

  const profileGoals = Array.isArray(profile.goals)
    ? profile.goals.filter((goal) => typeof goal === 'string' && goal.trim())
    : [];

  const weightSummary = summarizeWeightLogs(weightLogs ?? []);

  const context = {
    schema_version: 1,
    user_id: userId,
    updated_at: new Date().toISOString(),
    units: { weight: 'lbs' },
    profile: {
      display_name: displayName,
      weight_lbs:
        profile.weight ?? weightSummary.latest_lbs ?? previousContext.profile?.weight_lbs ?? null,
      goals: profileGoals.length > 0 ? profileGoals : (previousContext.profile?.goals ?? []),
      weight_trend: weightSummary.trend,
      weight_change_lbs: weightSummary.change_lbs,
      weight_trend_span_days: weightSummary.span_days,
      weight_history_lbs: weightSummary.history,
    },
    rolling_metrics: {
      streak_days: computeStreak(dates),
      workouts_last_7d: dates.filter((d) => new Date(d) >= weekStart).length,
      workouts_last_28d: dates.filter((d) => new Date(d) >= day28Ago).length,
      weekly_volume_by_muscle: previousContext.rolling_metrics?.weekly_volume_by_muscle ?? {},
      weight_trend: weightSummary.trend,
      weight_change_lbs_90d: weightSummary.change_lbs,
    },
    recent_prs: previousContext.recent_prs ?? [],
    recent_sessions: recentSessions,
    logged_performance: buildLoggedPerformance(recentSessions),
    logged_exercise_names: buildLoggedExerciseNames(recentSessions),
    training_signals: buildTrainingSignals(recentSessions),
    training_split: trainingSplit,
    nutrition_summary: buildNutritionSummary(nutritionLogs ?? []),
    flags: previousContext.flags ?? [],
    response_summaries: normalizeResponseSummaries(previousContext),
    last_advice: normalizeLastAdvice(previousContext.last_advice),
    coach_notes: normalizeCoachNotes(previousContext.coach_notes),
  };

  await upsertCoachContext(userId, context, supabaseRest);

  return { userId, sessionCount: recentSessions.length };
}

module.exports = { rebuildUserCoachContext };
