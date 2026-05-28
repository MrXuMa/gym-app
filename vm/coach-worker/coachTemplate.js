/**
 * Structured workout template generation from completed coach advice.
 */

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

function buildTemplatePrompt(context, question, advice, catalog) {
  const catalogByMuscle = catalog?.byMuscle ?? {};
  const allowedNames = Array.isArray(catalog?.names) ? catalog.names : [];
  const loggedPerformance = Array.isArray(context.logged_performance)
    ? context.logged_performance
    : [];
  const loggedNames = loggedPerformance.map((row) => row.exercise).filter(Boolean);

  return `You are converting coach advice into a workout template JSON object.

==================== EXERCISE NAME PROTOCOL (ABSOLUTE — HIGHEST PRIORITY) ====================
Every exercise_name MUST appear VERBATIM (character-for-character, exact spelling and casing) in allowed_exercise_names below. That list is the complete app database and the ONLY valid source of exercise names. NEVER use any name not in the list — no variations, synonyms, plurals, abbreviations, or invented names. Any exercise_name not in allowed_exercise_names is rejected and the template fails. If the movement is not listed, substitute the closest listed entry or omit it.
============================================================================================

Rules:
- Return ONLY valid JSON. No markdown, no commentary.
- exercise_name MUST be copied character-for-character from allowed_exercise_names (the app database). No exceptions. allowed_exercise_names is the ONLY valid source of exercise names.
- FORBIDDEN: any exercise_name that is not present verbatim in allowed_exercise_names. Do not invent, pluralize, or abbreviate (e.g. "Squats" is invalid if the list only contains "Squat"). Any name not in the list is rejected.
- If advice used a name not in the list, choose the best matching allowed_exercise_names entry for that movement. When several variants exist (e.g. squat or bench family), prefer a name from logged_performance if present; otherwise pick the standard barbell variant from the list.
- Include 4–8 exercises when the advice describes a full session; fewer only if advice is narrow.
- Each exercise needs 2–5 sets with reps (integer). weight is optional number in lbs.
- Only include weight for an exercise if that exact exercise name appears in logged_performance.
- Never copy a weight from one exercise to another.
- template name: short (max 60 chars), descriptive session label.
- Any exercise_name not in allowed_exercise_names will be rejected.

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

allowed_exercise_names (${allowedNames.length} total — ONLY valid exercise_name values):
${JSON.stringify(allowedNames)}

logged_performance (only source for weights; prefer these names when choosing variants):
${JSON.stringify(loggedPerformance, null, 2)}

logged_exercise_names:
${JSON.stringify(loggedNames)}

exercise_catalog_by_muscle (browse by muscle — still copy names from allowed_exercise_names only):
${JSON.stringify(catalogByMuscle, null, 2)}

Athlete question:
${question}

Coach advice to convert:
${advice}

JSON template:`;
}

function validateAndResolveDraft(raw, catalogExercises, loggedPerformance) {
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

  if (exercises.length === 0) {
    throw new Error('No exercises matched the app catalog');
  }

  return {
    name: name.slice(0, 80),
    exercises,
    warnings,
  };
}

module.exports = {
  buildTemplatePrompt,
  validateAndResolveDraft,
};
