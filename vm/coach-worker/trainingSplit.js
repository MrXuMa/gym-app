/**
 * Weekly training split helpers for coach context and prompts.
 */

const SPLIT_DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const SPLIT_DAY_LABELS = {
  sun: 'Sunday',
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
};

const DEFAULT_SCHEDULE = {
  sun: ['Core', 'Cardio'],
  mon: ['Chest', 'Triceps'],
  tue: ['Back', 'Biceps'],
  wed: ['Quads'],
  thu: ['Chest', 'Triceps'],
  fri: ['Back', 'Biceps'],
  sat: ['Quads', 'Glutes'],
};

function dayKeyFromDate(date) {
  return SPLIT_DAY_KEYS[date.getDay()] ?? 'sun';
}

function normalizeSchedule(raw) {
  const base = {};
  for (const key of SPLIT_DAY_KEYS) {
    base[key] = [];
  }

  if (!raw || typeof raw !== 'object') {
    return { ...base, ...DEFAULT_SCHEDULE };
  }

  for (const key of SPLIT_DAY_KEYS) {
    const muscles = raw[key];
    if (Array.isArray(muscles)) {
      const cleaned = muscles
        .filter((m) => typeof m === 'string' && m.trim())
        .map((m) => m.trim());
      base[key] = [...new Set(cleaned)];
    }
  }

  return base;
}

/**
 * @param {Record<string, string[]> | null | undefined} scheduleRow
 */
function buildTrainingSplitContext(scheduleRow) {
  const schedule = normalizeSchedule(scheduleRow);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayKey = dayKeyFromDate(now);
  const tomorrowKey = dayKeyFromDate(tomorrow);

  const scheduleByDay = {};
  for (const key of SPLIT_DAY_KEYS) {
    scheduleByDay[key] = {
      label: SPLIT_DAY_LABELS[key],
      short_label: key.toUpperCase(),
      muscles: schedule[key] ?? [],
    };
  }

  return {
    schedule,
    schedule_by_day: scheduleByDay,
    today: {
      day_key: todayKey,
      day_label: SPLIT_DAY_LABELS[todayKey],
      muscles: schedule[todayKey] ?? [],
    },
    tomorrow: {
      day_key: tomorrowKey,
      day_label: SPLIT_DAY_LABELS[tomorrowKey],
      muscles: schedule[tomorrowKey] ?? [],
    },
  };
}

/**
 * @param {ReturnType<typeof buildTrainingSplitContext> | null | undefined} trainingSplit
 */
function formatWeeklySplitBlock(trainingSplit) {
  if (!trainingSplit?.schedule_by_day) return '';

  const weekLines = SPLIT_DAY_KEYS.map((key) => {
    const day = trainingSplit.schedule_by_day[key];
    const muscles = day?.muscles?.length ? day.muscles.join(', ') : 'rest / not scheduled';
    return `- ${day.label} (${day.short_label}): ${muscles}`;
  });

  const tomorrow = trainingSplit.tomorrow;
  const tomorrowMuscles = tomorrow.muscles?.length
    ? tomorrow.muscles.join(', ')
    : 'none — treat as rest or ask athlete to update split';

  const today = trainingSplit.today;
  const todayMuscles = today.muscles?.length ? today.muscles.join(', ') : 'none';

  return `
USER WEEKLY TRAINING SPLIT (set by athlete in profile — authoritative for scheduling questions):
${weekLines.join('\n')}
- Today (${today.day_label}): ${todayMuscles}.
- Tomorrow (${tomorrow.day_label}): ${tomorrowMuscles}.
RULES:
- When the athlete asks what to train tomorrow, next session, or today, your primary focus MUST match the scheduled muscles for that day.
- Do NOT prescribe a different split pattern (e.g. "train chest every other day") if it conflicts with this weekly plan.
- If a scheduled muscle is listed under DO NOT TRAIN in SCHEDULING SIGNALS, do not program it — explain the cooldown and suggest the next scheduled day in their split whose muscles are ready, or ready subsets only.
- Empty scheduled days = rest or optional light work; do not fill with heavy work for muscles trained yesterday unless the split schedules them.
`;
}

module.exports = {
  SPLIT_DAY_KEYS,
  buildTrainingSplitContext,
  formatWeeklySplitBlock,
  normalizeSchedule,
};
