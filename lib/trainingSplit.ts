import { supabase } from '@/lib/supabase';
import { throwIfSupabaseError } from '@/lib/supabaseError';
import { fetchExerciseCatalog } from '@/lib/exercises';

export const SPLIT_DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export type SplitDayKey = (typeof SPLIT_DAY_KEYS)[number];

export type TrainingSplitSchedule = Record<SplitDayKey, string[]>;

export type TrainingSplitState = {
  enabled: boolean;
  schedule: TrainingSplitSchedule;
};

export const SPLIT_DAY_LABELS: Record<SplitDayKey, string> = {
  sun: 'SUN',
  mon: 'MON',
  tue: 'TUE',
  wed: 'WED',
  thu: 'THU',
  fri: 'FRI',
  sat: 'SAT',
};

/** Default PPL-style split; DB RPC filters muscles to catalog on save/load. */
export const DEFAULT_TRAINING_SPLIT: TrainingSplitSchedule = {
  sun: ['Core', 'Cardio'],
  mon: ['Chest', 'Triceps'],
  tue: ['Back', 'Biceps'],
  wed: ['Quads'],
  thu: ['Chest', 'Triceps'],
  fri: ['Back', 'Biceps'],
  sat: ['Quads', 'Glutes'],
};

export function emptyTrainingSplit(): TrainingSplitSchedule {
  return {
    sun: [],
    mon: [],
    tue: [],
    wed: [],
    thu: [],
    fri: [],
    sat: [],
  };
}

function isSplitDayKey(value: string): value is SplitDayKey {
  return (SPLIT_DAY_KEYS as readonly string[]).includes(value);
}

function normalizeScheduleObject(raw: unknown, fallbackToDefault: boolean): TrainingSplitSchedule {
  const base = emptyTrainingSplit();

  if (!raw || typeof raw !== 'object') {
    return fallbackToDefault ? { ...base, ...DEFAULT_TRAINING_SPLIT } : base;
  }

  for (const key of SPLIT_DAY_KEYS) {
    const muscles = (raw as Record<string, unknown>)[key];
    if (Array.isArray(muscles)) {
      base[key] = muscles.filter((m): m is string => typeof m === 'string' && m.trim().length > 0);
    }
  }

  return dedupeMusclesPerDay(base);
}

export function parseTrainingSplitResponse(raw: unknown): TrainingSplitState {
  if (raw && typeof raw === 'object' && 'schedule' in raw) {
    const row = raw as { enabled?: unknown; schedule?: unknown };
    const enabled = row.enabled !== false;
    return {
      enabled,
      schedule: normalizeScheduleObject(row.schedule, enabled),
    };
  }

  return {
    enabled: true,
    schedule: normalizeScheduleObject(raw, true),
  };
}

/** @deprecated Use parseTrainingSplitResponse — kept for callers expecting schedule only. */
export function normalizeTrainingSplit(raw: unknown): TrainingSplitSchedule {
  return parseTrainingSplitResponse(raw).schedule;
}

export function isSplitConfigured(state: TrainingSplitState): boolean {
  return state.enabled;
}

/** No duplicate muscle on the same day; multiple different groups per day allowed. */
export function dedupeMusclesPerDay(schedule: TrainingSplitSchedule): TrainingSplitSchedule {
  const next = emptyTrainingSplit();

  for (const key of SPLIT_DAY_KEYS) {
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const muscle of schedule[key]) {
      const trimmed = muscle.trim();
      if (!trimmed || seen.has(trimmed)) continue;
      seen.add(trimmed);
      unique.push(trimmed);
    }
    next[key] = unique;
  }

  return next;
}

export function dayHasMuscle(schedule: TrainingSplitSchedule, day: SplitDayKey, muscle: string): boolean {
  return schedule[day].includes(muscle);
}

export function schedulesEqual(a: TrainingSplitSchedule, b: TrainingSplitSchedule): boolean {
  return SPLIT_DAY_KEYS.every((key) => {
    const left = a[key];
    const right = b[key];
    if (left.length !== right.length) return false;
    return left.every((muscle, index) => muscle === right[index]);
  });
}

export async function fetchCatalogMuscleGroups(): Promise<string[]> {
  const exercises = await fetchExerciseCatalog();
  const groups = new Set<string>();

  for (const exercise of exercises) {
    if (exercise.targetMuscle?.trim()) {
      groups.add(exercise.targetMuscle.trim());
    }
  }

  return [...groups].sort((a, b) => a.localeCompare(b));
}

export async function fetchTrainingSplitState(): Promise<TrainingSplitState> {
  const { data, error } = await supabase.rpc('get_training_split');

  if (error) {
    throwIfSupabaseError(error, 'Could not load training split.');
  }

  return parseTrainingSplitResponse(data);
}

export async function fetchTrainingSplit(): Promise<TrainingSplitSchedule> {
  const state = await fetchTrainingSplitState();
  return state.schedule;
}

export async function saveTrainingSplit(schedule: TrainingSplitSchedule): Promise<TrainingSplitState> {
  const payload: Record<string, string[]> = {};
  for (const key of SPLIT_DAY_KEYS) {
    payload[key] = schedule[key];
  }

  const { data, error } = await supabase.rpc('upsert_training_split', {
    p_schedule: payload,
  });

  if (error) {
    throwIfSupabaseError(error, 'Could not save training split.');
  }

  return parseTrainingSplitResponse(data);
}

export async function removeTrainingSplit(): Promise<TrainingSplitState> {
  const { data, error } = await supabase.rpc('remove_training_split');

  if (error) {
    throwIfSupabaseError(error, 'Could not remove training split.');
  }

  return parseTrainingSplitResponse(data);
}

export function filterScheduleToCatalog(
  schedule: TrainingSplitSchedule,
  catalogMuscles: string[],
): TrainingSplitSchedule {
  const allowed = new Set(catalogMuscles);
  const next = emptyTrainingSplit();

  for (const key of SPLIT_DAY_KEYS) {
    next[key] = schedule[key].filter((muscle) => allowed.has(muscle));
  }

  return dedupeMusclesPerDay(next);
}

export function moveMuscleBetweenDays(
  schedule: TrainingSplitSchedule,
  muscle: string,
  fromDay: SplitDayKey | 'palette',
  toDay: SplitDayKey,
): TrainingSplitSchedule {
  if (dayHasMuscle(schedule, toDay, muscle)) {
    return dedupeMusclesPerDay(schedule);
  }

  const next = emptyTrainingSplit();

  for (const key of SPLIT_DAY_KEYS) {
    next[key] = [...schedule[key]];
  }

  if (fromDay !== 'palette') {
    next[fromDay] = next[fromDay].filter((m) => m !== muscle);
  }

  next[toDay] = [...next[toDay], muscle];

  return dedupeMusclesPerDay(next);
}

export function removeMuscleFromDay(
  schedule: TrainingSplitSchedule,
  muscle: string,
  day: SplitDayKey,
): TrainingSplitSchedule {
  return {
    ...schedule,
    [day]: schedule[day].filter((m) => m !== muscle),
  };
}

export function dayKeyFromDate(date: Date): SplitDayKey {
  const index = date.getDay();
  return SPLIT_DAY_KEYS[index] ?? 'sun';
}

/** Muscles scheduled for `date`, or null when the user has no split configured. */
export function getTodaySplitMuscles(state: TrainingSplitState, date = new Date()): string[] | null {
  if (!isSplitConfigured(state)) {
    return null;
  }
  return [...state.schedule[dayKeyFromDate(date)]];
}

export function summarizeSplitForDay(schedule: TrainingSplitSchedule, day: SplitDayKey): string {
  const muscles = schedule[day];
  if (!muscles.length) return 'Rest / not scheduled';
  return muscles.join(', ');
}

export type DayLayout = { x: number; y: number; width: number; height: number };

export function findDropDayKey(
  layouts: Partial<Record<SplitDayKey, DayLayout>>,
  x: number,
  y: number,
): SplitDayKey | null {
  for (const key of SPLIT_DAY_KEYS) {
    const box = layouts[key];
    if (!box) continue;
    if (x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height) {
      return key;
    }
  }
  return null;
}
