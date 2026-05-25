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

function resolveExerciseName(name, catalogIndex) {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) {
    return null;
  }

  const key = normalizeName(trimmed);
  const exact = catalogIndex.byExact.get(key);
  if (exact) {
    return exact;
  }

  const containsMatches = catalogIndex.all.filter((entry) => {
    const entryKey = normalizeName(entry.name);
    return entryKey.includes(key) || key.includes(entryKey);
  });

  if (containsMatches.length === 1) {
    return containsMatches[0];
  }

  if (containsMatches.length > 1) {
    const wordMatch = containsMatches.find((entry) => normalizeName(entry.name) === key);
    if (wordMatch) {
      return wordMatch;
    }
  }

  return null;
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

function buildTemplatePrompt(context, question, advice, catalogByMuscle) {
  const catalog = catalogByMuscle ?? {};
  const loggedPerformance = Array.isArray(context.logged_performance)
    ? context.logged_performance
    : [];

  return `You are converting coach advice into a workout template JSON object.

Rules:
- Return ONLY valid JSON. No markdown, no commentary.
- Use exercise names EXACTLY as they appear in exercise_catalog_by_muscle (character-for-character).
- Include 4–8 exercises when the advice describes a full session; fewer only if advice is narrow.
- Each exercise needs 2–5 sets with reps (integer). weight is optional number in lbs.
- Only include weight for an exercise if that exact exercise name appears in logged_performance.
- Never copy a weight from one exercise to another.
- template name: short (max 60 chars), descriptive session label.
- Do not invent exercises outside the catalog.

Schema:
{
  "name": "string",
  "exercises": [
    {
      "exercise_name": "exact catalog name",
      "sets": [{ "reps": 8, "weight": 185 }]
    }
  ]
}

logged_performance (only source for weights):
${JSON.stringify(loggedPerformance, null, 2)}

exercise_catalog_by_muscle:
${JSON.stringify(catalog, null, 2)}

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
      warnings.push(`Skipped unknown exercise: ${exerciseName}`);
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
