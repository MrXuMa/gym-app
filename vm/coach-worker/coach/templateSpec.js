/**
 * Turns a template request (question + advice + context) into a concrete spec:
 * which muscle groups the workout must cover, how intense, how many exercises,
 * and whether it is a modification of a previous workout. Used to constrain the
 * generation prompt and to validate/regenerate the resulting draft.
 */

// Canonical app muscle groups grouped into push / pull / legs / core.
const CATEGORY_MUSCLES = {
  push: ['Chest', 'Shoulders', 'Triceps'],
  pull: ['Back', 'Biceps', 'Rear Delts', 'Grip / Traps'],
  legs: ['Quads', 'Hamstrings', 'Glutes', 'Calves', 'Legs'],
  core: ['Core'],
};

const ALL_MUSCLES = Object.values(CATEGORY_MUSCLES).flat();

const MUSCLE_CATEGORY = (() => {
  const map = new Map();
  for (const [category, muscles] of Object.entries(CATEGORY_MUSCLES)) {
    for (const muscle of muscles) map.set(normalizeMuscle(muscle), category);
  }
  return map;
})();

function normalizeMuscle(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Order matters: multi-word / category aliases are checked first.
const REQUEST_ALIASES = [
  { re: /\bfull[\s-]?body\b/, muscles: ALL_MUSCLES },
  { re: /\bupper(?:\s*body)?\b/, categories: ['push', 'pull'] },
  { re: /\b(?:lower(?:\s*body)?|leg\s*day)\b/, categories: ['legs'] },
  { re: /\bpush(?:\s*day)?\b/, categories: ['push'] },
  { re: /\bpull(?:\s*day)?\b/, categories: ['pull'] },
  { re: /\brear\s*delts?\b/, muscles: ['Rear Delts'] },
  { re: /\barms?\b/, muscles: ['Biceps', 'Triceps'] },
  { re: /\bchest\b/, muscles: ['Chest'] },
  { re: /\bback\b/, muscles: ['Back'] },
  { re: /\b(?:shoulders?|delts?)\b/, muscles: ['Shoulders'] },
  { re: /\btriceps?\b/, muscles: ['Triceps'] },
  { re: /\bbiceps?\b/, muscles: ['Biceps'] },
  { re: /\bquads?\b/, muscles: ['Quads'] },
  { re: /\b(?:hamstrings?|hams)\b/, muscles: ['Hamstrings'] },
  { re: /\bglutes?\b/, muscles: ['Glutes'] },
  { re: /\b(?:calves|calf)\b/, muscles: ['Calves'] },
  { re: /\b(?:legs?)\b/, categories: ['legs'] },
  { re: /\b(?:core|abs|abdominals?)\b/, muscles: ['Core'] },
  { re: /\b(?:traps?|grip)\b/, muscles: ['Grip / Traps'] },
];

const HIGH_INTENSITY_RE =
  /\b(intense|intensity|hard|heavy|brutal|tough|killer|grind|go hard|all out|max(?:imal|imum)?|high volume|high-volume|advanced)\b/i;
const LOW_INTENSITY_RE =
  /\b(chill|light|easy|relaxed|recovery|deload|low volume|low-volume|short|quick|beginner|gentle)\b/i;

const MODIFICATION_RE =
  /\b(same (?:workout|template|session|routine)|replace|swap|substitute|sub out|instead of|change .* (?:to|with|for)|keep .* but|but (?:replace|swap|change|use|do)|like (?:last|the last|the previous|before|yesterday)|previous (?:workout|template|session)|that workout again)\b/i;

function goalsText(context) {
  const goals = context?.athlete_snapshot?.goals ?? context?.profile?.goals ?? [];
  return Array.isArray(goals) ? goals.join(' ').toLowerCase() : '';
}

function collectMusclesFromText(text) {
  const found = new Set();
  const normalized = String(text ?? '').toLowerCase();
  for (const alias of REQUEST_ALIASES) {
    if (!alias.re.test(normalized)) continue;
    if (alias.muscles) {
      for (const m of alias.muscles) found.add(m);
    }
    if (alias.categories) {
      for (const c of alias.categories) for (const m of CATEGORY_MUSCLES[c]) found.add(m);
    }
  }
  return found;
}

function canonicalizeSplitMuscles(muscles) {
  const found = new Set();
  for (const raw of muscles ?? []) {
    const key = normalizeMuscle(raw);
    const match = ALL_MUSCLES.find((m) => normalizeMuscle(m) === key);
    if (match) found.add(match);
    // "Cardio" and other non-strength entries are ignored.
  }
  return found;
}

/** Expand target muscles to their full push/pull/legs family (prevents cross-category leakage). */
function expandToCategories(muscles) {
  const allowed = new Set();
  for (const muscle of muscles) {
    const category = MUSCLE_CATEGORY.get(normalizeMuscle(muscle));
    if (category) {
      for (const m of CATEGORY_MUSCLES[category]) allowed.add(m);
    } else {
      allowed.add(muscle);
    }
  }
  return allowed;
}

function resolveIntensity(question, context) {
  if (HIGH_INTENSITY_RE.test(question)) return 'high';
  if (LOW_INTENSITY_RE.test(question)) return 'low';

  const goals = goalsText(context);
  if (/\b(strength|stronger|power|powerlifting)\b/.test(goals)) return 'high';
  if (/\b(endurance|tone|maintain|general health|wellness)\b/.test(goals)) return 'low';
  return 'moderate';
}

function countRangeForIntensity(intensity) {
  if (intensity === 'high') return { min: 5, max: 8 };
  if (intensity === 'low') return { min: 3, max: 4 };
  return { min: 4, max: 6 };
}

function resolveExerciseCount(question, intensity) {
  const explicit =
    question.match(/\b(\d{1,2})\s*(?:exercises?|movements?|moves|lifts?)\b/i) ||
    question.match(/\b(?:with|do|give me|include|just|only)\s+(\d{1,2})\b/i);
  if (explicit) {
    const n = Math.max(2, Math.min(10, Number(explicit[1])));
    return { min: n, max: n };
  }
  return countRangeForIntensity(intensity);
}

/**
 * @returns {{
 *   targetMuscles: string[],
 *   allowedMuscleNames: string[],
 *   allowedMuscleKeys: Set<string>,
 *   source: 'request'|'split'|'advice'|'open',
 *   intensity: 'low'|'moderate'|'high',
 *   count: { min: number, max: number },
 *   isModification: boolean,
 * }}
 */
function parseRequestSpec(question, advice, context) {
  const q = String(question ?? '');

  let muscles = collectMusclesFromText(q);
  let source = 'request';

  if (muscles.size === 0) {
    const split = context?.training_split;
    const splitMuscles =
      split?.today?.muscles?.length ? split.today.muscles : split?.tomorrow?.muscles;
    const canon = canonicalizeSplitMuscles(splitMuscles);
    if (canon.size > 0) {
      muscles = canon;
      source = 'split';
    }
  }

  if (muscles.size === 0) {
    const fromAdvice = collectMusclesFromText(advice);
    if (fromAdvice.size > 0) {
      muscles = fromAdvice;
      source = 'advice';
    }
  }

  const targetMuscles = [...muscles];
  const allowedMuscleNames = targetMuscles.length ? [...expandToCategories(targetMuscles)] : [];
  const allowedMuscleKeys = new Set(allowedMuscleNames.map((m) => normalizeMuscle(m)));

  const intensity = resolveIntensity(q, context);
  const count = resolveExerciseCount(q, intensity);
  const isModification = MODIFICATION_RE.test(q);

  return {
    targetMuscles,
    allowedMuscleNames,
    allowedMuscleKeys,
    source: targetMuscles.length ? source : 'open',
    intensity,
    count,
    isModification,
  };
}

/** True when the muscle is allowed (open spec allows everything). */
function muscleAllowed(targetMuscle, spec) {
  if (!spec || spec.allowedMuscleKeys.size === 0) return true;
  return spec.allowedMuscleKeys.has(normalizeMuscle(targetMuscle));
}

/** Restrict the catalog the model sees to only the allowed muscle groups. */
function filterCatalogToSpec(catalog, spec) {
  const rows = catalog?.rows ?? [];
  if (!spec || spec.allowedMuscleKeys.size === 0) {
    return { names: catalog?.names ?? [], byMuscle: catalog?.byMuscle ?? {} };
  }

  const names = [];
  const byMuscle = {};
  for (const row of rows) {
    const name = row.name?.trim();
    const muscle = row.target_muscle?.trim();
    if (!name || !muscle) continue;
    if (!spec.allowedMuscleKeys.has(normalizeMuscle(muscle))) continue;
    names.push(name);
    (byMuscle[muscle] ??= []).push(name);
  }
  names.sort((a, b) => a.localeCompare(b));
  for (const muscle of Object.keys(byMuscle)) byMuscle[muscle].sort((a, b) => a.localeCompare(b));
  return { names, byMuscle };
}

function intensityGuidance(intensity) {
  if (intensity === 'high') {
    return 'High intensity: 4-5 working sets per exercise, compounds 5-8 reps at RPE 8-9, lead with the heaviest compound.';
  }
  if (intensity === 'low') {
    return 'Low intensity / recovery: 2-3 sets per exercise, 10-15 reps at RPE 6-7, keep it short and joint-friendly.';
  }
  return 'Moderate intensity: 3-4 sets per exercise, 8-12 reps at RPE 7-8.';
}

module.exports = {
  CATEGORY_MUSCLES,
  parseRequestSpec,
  muscleAllowed,
  filterCatalogToSpec,
  intensityGuidance,
  normalizeMuscle,
};
