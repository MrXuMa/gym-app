/**
 * Structured workout template generation from completed coach advice.
 */

const { muscleAllowed, filterCatalogToSpec, intensityGuidance } = require('./coach/templateSpec');

/** Thrown when a draft parses but fails the requested criteria — signals a regenerate. */
class TemplateCriteriaError extends Error {
  constructor(message, correction) {
    super(message);
    this.name = 'TemplateCriteriaError';
    this.correction = correction || message;
  }
}

function normalizeName(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function buildCatalogIndex(exercises) {
  const byExact = new Map();
  const all = [];

  for (const row of exercises ?? []) {
    const name = row.name?.trim();
    if (!name) {
      continue;
    }

    const entry = {
      id: row.id,
      name,
      targetMuscle: row.target_muscle?.trim() || null,
    };

    all.push(entry);
    byExact.set(normalizeName(name), entry);
  }

  return { byExact, all };
}

/** Only exact catalog names match — no fuzzy "squats" → random squat variant. */
function resolveExerciseName(name, catalogIndex) {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) {
    return null;
  }

  return catalogIndex.byExact.get(normalizeName(trimmed)) ?? null;
}

function loggedWeightForExercise(exerciseName, loggedPerformance) {
  const key = normalizeName(exerciseName);
  const entry = (loggedPerformance ?? []).find(
    (row) => normalizeName(row.exercise) === key,
  );
  if (!entry || entry.weight_lbs == null) {
    return null;
  }
  return entry.weight_lbs;
}

function extractJsonObject(text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) {
    throw new Error('Empty template response');
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error('Could not parse template JSON from model output');
  }
}

function describeTarget(spec) {
  if (!spec || !spec.targetMuscles?.length) {
    return 'Target muscles: follow the coach advice and the athlete\'s training split.';
  }
  const wanted = spec.targetMuscles.join(', ');
  const allowed = spec.allowedMuscleNames.join(', ');
  const sourceLabel =
    spec.source === 'request'
      ? 'the athlete explicitly requested these muscle groups'
      : spec.source === 'split'
        ? 'the athlete\'s training split schedules these muscle groups today'
        : 'the coach advice targets these muscle groups';
  return `Target muscle groups: ${wanted} (${sourceLabel}).
Every exercise MUST train one of these allowed muscle groups ONLY: ${allowed}.
Do NOT include exercises for any other muscle group (e.g. no chest/push work on a back/pull day). Out-of-group exercises are rejected.`;
}

function buildTemplatePrompt(context, question, advice, catalog, spec, options = {}) {
  const { previousTemplate = null, correction = null } = options;
  const filtered = filterCatalogToSpec(catalog, spec);
  const allowedNames = filtered.names;
  const catalogByMuscle = filtered.byMuscle;
  const loggedPerformance = Array.isArray(context.logged_performance)
    ? context.logged_performance
    : [];
  const loggedNames = loggedPerformance.map((row) => row.exercise).filter(Boolean);

  const countLine =
    spec.count.min === spec.count.max
      ? `Include EXACTLY ${spec.count.min} exercises.`
      : `Include ${spec.count.min}-${spec.count.max} exercises.`;

  const modificationBlock =
    spec.isModification && previousTemplate
      ? `
==================== MODIFY PREVIOUS WORKOUT ====================
The athlete is asking to reuse/modify their previous workout, NOT to build a brand-new one. Start from previous_template below and change ONLY what the athlete asked (e.g. swap one exercise, adjust sets). Keep every other exercise, its order, and its sets identical.
previous_template:
${JSON.stringify(previousTemplate, null, 2)}
================================================================
`
      : '';

  const correctionBlock = correction
    ? `
==================== FIX REQUIRED (previous attempt rejected) ====================
${correction}
Regenerate the FULL template correcting this. Use only allowed_exercise_names that train the target muscle groups.
=================================================================================
`
    : '';

  return `You are converting coach advice into a workout template JSON object.
${correctionBlock}${modificationBlock}
==================== EXERCISE NAME PROTOCOL (ABSOLUTE — HIGHEST PRIORITY) ====================
Every exercise_name MUST appear VERBATIM (character-for-character, exact spelling and casing) in allowed_exercise_names below. That list is the ONLY valid source of exercise names. NEVER use any name not in the list — no variations, synonyms, plurals, abbreviations, or invented names. Any exercise_name not in allowed_exercise_names is rejected and the template fails. If the movement is not listed, substitute the closest listed entry or omit it.
============================================================================================

==================== WORKOUT REQUIREMENTS (must all be satisfied) ====================
${describeTarget(spec)}
${countLine}
${intensityGuidance(spec.intensity)}
Athlete goals: ${JSON.stringify(context?.athlete_snapshot?.goals ?? context?.profile?.goals ?? [])}.
=====================================================================================

Rules:
- Return ONLY valid JSON. No markdown, no commentary.
- exercise_name MUST be copied character-for-character from allowed_exercise_names. allowed_exercise_names already contains ONLY exercises for the target muscle groups — pick from it.
- FORBIDDEN: any exercise_name not present verbatim in allowed_exercise_names, and any exercise outside the target muscle groups.
- If advice used a name not in the list, choose the closest allowed_exercise_names entry for that movement. Prefer a name from logged_performance when several variants exist.
- Each exercise needs sets with reps (integer); weight is optional number in lbs.
- Only include weight for an exercise if that exact exercise name appears in logged_performance. Never copy a weight from one exercise to another.
- template name: short (max 60 chars), descriptive session label matching the target muscles.

Schema:
{
  "name": "string",
  "exercises": [
    {
      "exercise_name": "exact string from allowed_exercise_names",
      "sets": [{ "reps": 8, "weight": 185 }]
    }
  ]
}

allowed_exercise_names (${allowedNames.length} total — ONLY valid exercise_name values, already filtered to the target muscle groups):
${JSON.stringify(allowedNames)}

logged_performance (only source for weights; prefer these names when choosing variants):
${JSON.stringify(loggedPerformance, null, 2)}

logged_exercise_names:
${JSON.stringify(loggedNames)}

exercise_catalog_by_muscle (target muscle groups only — still copy names from allowed_exercise_names):
${JSON.stringify(catalogByMuscle, null, 2)}

Athlete question:
${question}

Coach advice to convert:
${advice}

JSON template:`;
}

function validateAndResolveDraft(raw, catalogExercises, loggedPerformance, spec = null) {
  const parsed = extractJsonObject(raw);
  const name = String(parsed.name ?? '').trim();
  if (!name) {
    throw new Error('Template missing name');
  }

  if (!Array.isArray(parsed.exercises) || parsed.exercises.length === 0) {
    throw new Error('Template must include at least one exercise');
  }

  const catalogIndex = buildCatalogIndex(catalogExercises);
  const warnings = [];
  const exercises = [];
  let offGroupCount = 0;

  for (const item of parsed.exercises) {
    const exerciseName = String(item.exercise_name ?? item.name ?? '').trim();
    if (!exerciseName) {
      continue;
    }

    const resolved = resolveExerciseName(exerciseName, catalogIndex);
    if (!resolved) {
      warnings.push(
        `Skipped "${exerciseName}" — not an exact catalog name. Use allowed_exercise_names verbatim.`,
      );
      continue;
    }

    if (spec && !muscleAllowed(resolved.targetMuscle, spec)) {
      offGroupCount += 1;
      warnings.push(
        `Skipped "${resolved.name}" (${resolved.targetMuscle}) — outside target muscle groups.`,
      );
      continue;
    }

    const rawSets = Array.isArray(item.sets) ? item.sets : [];
    const sets = [];
    const allowedWeight = loggedWeightForExercise(resolved.name, loggedPerformance);

    for (const set of rawSets.slice(0, 8)) {
      const reps = Number(set.reps);
      if (!Number.isFinite(reps) || reps <= 0) {
        continue;
      }

      let weight = null;
      if (set.weight != null && set.weight !== '') {
        const parsedWeight = Number(set.weight);
        if (Number.isFinite(parsedWeight) && parsedWeight >= 0) {
          if (allowedWeight != null) {
            weight = parsedWeight;
          } else {
            warnings.push(`Dropped weight for ${resolved.name} (not in logged performance)`);
          }
        }
      }

      sets.push({ reps: Math.round(reps), weight });
    }

    if (sets.length === 0) {
      sets.push({ reps: 8, weight: null }, { reps: 8, weight: null }, { reps: 8, weight: null });
    }

    exercises.push({
      exercise_id: resolved.id,
      exercise_name: resolved.name,
      target_muscle: resolved.targetMuscle,
      sets,
    });
  }

  // Criteria checks (target muscle coverage + exercise count) — signal a regenerate.
  if (spec && spec.allowedMuscleNames.length) {
    const minCount = spec.count?.min ?? 1;
    if (exercises.length < minCount) {
      const groups = spec.allowedMuscleNames.join(', ');
      const detail = offGroupCount > 0
        ? `${offGroupCount} exercise(s) were outside the target muscle groups and were rejected. `
        : '';
      throw new TemplateCriteriaError(
        `Only ${exercises.length}/${minCount} valid exercises after group filtering.`,
        `${detail}Only ${exercises.length} valid exercises remain. Provide ${minCount === (spec.count?.max ?? minCount) ? `exactly ${minCount}` : `at least ${minCount}`} exercises, EVERY one training the target muscle groups (${groups}). Use only allowed_exercise_names.`,
      );
    }
  }

  if (exercises.length === 0) {
    throw new Error('No exercises matched the app catalog');
  }

  const maxCount = spec?.count?.max;
  const trimmed = maxCount ? exercises.slice(0, maxCount) : exercises;

  return {
    name: name.slice(0, 80),
    exercises: trimmed,
    warnings,
  };
}

module.exports = {
  buildTemplatePrompt,
  validateAndResolveDraft,
  TemplateCriteriaError,
};
