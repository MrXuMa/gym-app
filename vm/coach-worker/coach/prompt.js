const { COACH_PRINCIPLES_COMPACT } = require('./knowledge');
const { formatWeeklySplitBlock } = require('../trainingSplit');
const { MAX_RESPONSE_SUMMARIES_IN_PROMPT } = require('../context/limits');
const {
  buildPlanFormatInstructions,
  buildReasoningFormatInstructions,
} = require('./formatInstructions');

const NUTRITION_TOPIC_RE =
  /\b(calorie|calories|kcal|protein|carb|carbs|fat|macro|macros|eat|eating|food|meal|meals|nutrition|diet|bulk|cut|deficit|surplus|hungry|fasting|breakfast|lunch|dinner)\b/i;

function classifyTopic(question, mode) {
  if (NUTRITION_TOPIC_RE.test(String(question ?? ''))) return 'nutrition';
  if (mode === 'plan') return 'training';
  return 'general';
}

function filterCatalogForPlan(catalog, context) {
  const names = new Set(context.logged_exercise_names ?? []);

  const muscles = new Set();
  const split = context.training_split;
  for (const m of split?.tomorrow?.muscles ?? []) muscles.add(m);
  for (const m of split?.today?.muscles ?? []) muscles.add(m);

  const byMuscle = catalog?.byMuscle ?? {};
  for (const muscle of muscles) {
    const key = Object.keys(byMuscle).find(
      (k) => k.toLowerCase() === String(muscle).toLowerCase(),
    );
    for (const n of key ? byMuscle[key] : []) names.add(n);
  }

  if (names.size < 5 && Array.isArray(catalog?.names)) {
    for (const n of catalog.names.slice(0, 50)) names.add(n);
  }

  return [...names].sort();
}

function formatSnapshotBlock(snapshot) {
  if (!snapshot) return '\nATHLETE SNAPSHOT: unavailable.\n';
  return `\nATHLETE SNAPSHOT (precomputed heuristics — trust these for holistic decisions):\n${JSON.stringify(snapshot, null, 2)}\n`;
}

function formatTodayNutritionBlock(nutrition) {
  if (!nutrition?.today) return '\nTODAY\'S MEALS: none logged yet.\n';

  const today = nutrition.today;
  const meals = Array.isArray(today.meals) ? today.meals : [];
  const mealLines =
    meals.length > 0
      ? meals
          .map((meal, idx) => {
            const items = Array.isArray(meal.items) ? meal.items : [];
            const foods =
              items.length > 0
                ? items
                    .map(
                      (it) =>
                        `${it.name}${it.portion_g ? ` (${it.portion_g}g)` : ''} [${it.kcal}kcal/${it.protein_g}P]`,
                    )
                    .join(', ')
                : 'no items';
            const t = meal.totals ?? {};
            return `  • Meal ${idx + 1}: ${foods} → ${t.kcal ?? 0} kcal | P ${t.protein_g ?? 0}g`;
          })
          .join('\n')
      : '  • No meals yet.';
  return `\nTODAY'S MEALS (full detail — only day with per-food data):\n${mealLines}\n`;
}

function formatSchedulingBlockCompact(signals) {
  if (!signals) return '';
  const avoid =
    (signals.muscles_recently_trained_avoid ?? []).map((m) => m.muscle).join(', ') || 'none';
  const ready =
    (signals.muscles_ready_for_training ?? []).map((m) => m.muscle).join(', ') || 'none';
  const last = signals.last_session;
  const lastLine = last
    ? `Last session: "${last.title ?? 'workout'}" (${signals.days_since_last_workout ?? '?'}d ago) — ${(last.muscle_groups ?? []).join(', ') || 'muscles n/a'}.`
    : 'No prior sessions logged.';
  return `
SCHEDULING (from logs):
- ${lastLine}
- Do NOT train (<48h): ${avoid}.
- Ready: ${ready}.
- Hint: ${signals.programming_hint ?? 'n/a'}.
`;
}

function buildExerciseProtocol(allowedNames, mode) {
  if (mode !== 'plan') {
    return `EXERCISE NAMES: Only mention exercises from logged_exercise_names when citing a specific lift. Do not invent names. If suggesting a movement without a logged name, describe it generically (e.g. "a row variation") without a catalog name.`;
  }
  return `EXERCISE NAME PROTOCOL (mandatory for plan mode):
- Every exercise you prescribe MUST appear verbatim in allowed_exercise_names below.
- No synonyms, plurals, or invented names.
allowed_exercise_names (${allowedNames.length}):
${JSON.stringify(allowedNames)}`;
}

/**
 * Structured extras NOT already shown in a dedicated prose block, to avoid
 * duplicating athlete_snapshot, allowed_exercise_names, logged_performance,
 * lift_trends, the weekly split, and scheduling in the prompt twice.
 */
function buildPromptContext(context, mode, topic) {
  const base = {
    units: context.units ?? { weight: 'lbs' },
    flags: context.flags ?? [],
    last_advice: context.last_advice ?? null,
  };

  const hasSplitBlock = topic !== 'nutrition' && mode === 'plan';
  const hasSchedulingBlock = topic !== 'nutrition' && (mode === 'plan' || topic === 'training');

  // TODAY'S MEALS block already covers the nutrition topic; only add today's
  // numbers as JSON when a non-nutrition reasoning answer might reference them.
  if (mode === 'reasoning' && topic !== 'nutrition') {
    base.nutrition_today = context.nutrition_summary?.today ?? null;
  }

  if (topic !== 'nutrition' && !hasSplitBlock) {
    base.training_split = context.training_split
      ? { today: context.training_split.today, tomorrow: context.training_split.tomorrow }
      : null;
  }

  if (topic !== 'nutrition' && !hasSchedulingBlock) {
    base.training_signals_compact = context.training_signals
      ? {
          days_since_last_workout: context.training_signals.days_since_last_workout,
          muscles_recently_trained_avoid: context.training_signals.muscles_recently_trained_avoid,
          muscles_ready_for_training: context.training_signals.muscles_ready_for_training,
          programming_hint: context.training_signals.programming_hint,
        }
      : null;
  }

  // Exercise-name guard when the full LOGGED LIFTS block / allow-list isn't shown.
  if (topic !== 'nutrition') {
    base.logged_exercise_names = context.logged_exercise_names ?? [];
  }

  return base;
}

function buildCoreRules(mode, topic) {
  const rules = [
    'Trust athlete_snapshot for holistic judgment (goals, recovery, nutrition verdict, goal_alignment_verdict).',
    'logged_performance is the ONLY source for specific weights; never transfer weights between lifts.',
    'Never claim foods on past days — only daily totals in snapshot.nutrition / nutrition trends.',
    'Prior coach_memory is continuity only — NOT workout logs.',
    'Stay in coaching scope: training, recovery, nutrition, sleep, hydration.',
  ];

  if (mode === 'plan' || topic === 'training') {
    rules.push(
      'Scheduling: follow training_split for today/tomorrow first; respect muscles in snapshot.recovery.avoid_next_session.',
    );
  }

  if (topic === 'nutrition') {
    rules.push(
      'Use TODAY\'S MEALS for present intake; use snapshot.nutrition for targets, gaps, and trends.',
    );
  }

  return rules.map((r) => `- ${r}`).join('\n');
}

function buildCompactPrompt(context, question, catalog, mode) {
  const name = context.athlete_snapshot?.display_name ?? context.profile?.display_name ?? 'Athlete';
  const topic = classifyTopic(question, mode);
  const snapshot = context.athlete_snapshot;
  const summaries = Array.isArray(context.response_summaries)
    ? context.response_summaries.slice(0, MAX_RESPONSE_SUMMARIES_IN_PROMPT)
    : [];

  const allowedNames = mode === 'plan' ? filterCatalogForPlan(catalog, context) : [];

  const blocks = [
    `You are a strength coach advising ${name}.`,
    buildExerciseProtocol(allowedNames, mode),
    `\n${COACH_PRINCIPLES_COMPACT}`,
    formatSnapshotBlock(snapshot),
  ];

  if (topic === 'nutrition') {
    blocks.push(formatTodayNutritionBlock(context.nutrition_summary));
  }

  if (topic !== 'nutrition') {
    if (mode === 'plan') {
      blocks.push(formatWeeklySplitBlock(context.training_split));
      blocks.push(formatSchedulingBlockCompact(context.training_signals));
    } else if (topic === 'training') {
      blocks.push(formatSchedulingBlockCompact(context.training_signals));
    }

    if ((mode === 'plan' || topic === 'training') && context.logged_performance?.length) {
      blocks.push(
        `\nLOGGED LIFTS (ground truth for weights):\n${JSON.stringify(context.logged_performance, null, 2)}`,
      );
    }

    if ((mode === 'plan' || topic === 'training') && context.lift_trends?.length) {
      blocks.push(
        `\nLIFT TRENDS (e1RM last sessions):\n${JSON.stringify(context.lift_trends, null, 2)}`,
      );
    }
  }

  const memory =
    context.coach_memory ||
    (summaries.length
      ? summaries.map((s) => s.summary ?? s.note).filter(Boolean).join(' | ')
      : null);
  if (memory) {
    blocks.push(`\nCOACH MEMORY (continuity, not logs): ${memory}`);
  }

  const promptContext = buildPromptContext(context, mode, topic);
  const formatInstructions =
    mode === 'plan' ? buildPlanFormatInstructions() : buildReasoningFormatInstructions();

  return `${blocks.join('\n')}
RESPONSE RULES:
${buildCoreRules(mode, topic)}

RESPONSE MODE: ${mode.toUpperCase()} | TOPIC: ${topic.toUpperCase()}
${formatInstructions}

SUPPORTING CONTEXT (JSON — no duplicate raw session dumps):
${JSON.stringify(promptContext, null, 2)}

Athlete question:
${question}

${mode === 'plan' ? 'REMINDER: every exercise name must be verbatim from allowed_exercise_names.' : ''}

Coach advice:`;
}

module.exports = {
  classifyTopic,
  filterCatalogForPlan,
  buildCompactPrompt,
  buildPromptContext,
};
