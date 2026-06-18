/**
 * Per-device home widget preferences.
 *
 * Stored in AsyncStorage. When we later add cross-device sync, this module is
 * the single source of truth the rest of the app reads through — so the storage
 * backend can move to Supabase without touching callers.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@gym-app/widget-settings/v1';

/** Stable widget identifiers. Adding a new widget? Add it here AND in widgetRegistry. */
export const WIDGET_IDS = [
  'predicted-max',
  'weight-trend',
  'week-summary',
  'daily-calories',
  'today-split',
  'task-bulletin',
  'week-meals',
] as const;

export type WidgetId = (typeof WIDGET_IDS)[number];

/** Widgets shown by default on a brand-new install (order = render order). */
export const DEFAULT_ENABLED_WIDGET_IDS: WidgetId[] = [
  'predicted-max',
  'weight-trend',
  'week-summary',
];

export type WidgetSettings = {
  predictedMaxExerciseId: string | null;
  /** Ordered list of widget ids currently rendered on the home screen. */
  enabledWidgetIds: WidgetId[];
};

const DEFAULT_SETTINGS: WidgetSettings = {
  predictedMaxExerciseId: null,
  enabledWidgetIds: DEFAULT_ENABLED_WIDGET_IDS,
};

function isWidgetId(value: unknown): value is WidgetId {
  return typeof value === 'string' && (WIDGET_IDS as readonly string[]).includes(value);
}

function normalize(raw: unknown): WidgetSettings {
  if (!raw || typeof raw !== 'object') {
    return DEFAULT_SETTINGS;
  }

  const value = raw as Partial<WidgetSettings>;

  const predictedMaxExerciseId =
    typeof value.predictedMaxExerciseId === 'string' && value.predictedMaxExerciseId.trim().length > 0
      ? value.predictedMaxExerciseId
      : null;

  // Migration: pre-v2 settings have no enabledWidgetIds — assume defaults so existing
  // users keep seeing the four original widgets.
  let enabledWidgetIds: WidgetId[];
  if (Array.isArray(value.enabledWidgetIds)) {
    const seen = new Set<WidgetId>();
    enabledWidgetIds = [];
    for (const candidate of value.enabledWidgetIds) {
      if (isWidgetId(candidate) && !seen.has(candidate)) {
        seen.add(candidate);
        enabledWidgetIds.push(candidate);
      }
    }
  } else {
    enabledWidgetIds = DEFAULT_ENABLED_WIDGET_IDS;
  }

  return { predictedMaxExerciseId, enabledWidgetIds };
}

export async function loadWidgetSettings(): Promise<WidgetSettings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_SETTINGS;
    }

    return normalize(JSON.parse(raw));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveWidgetSettings(settings: WidgetSettings): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalize(settings)));
}

export async function updateWidgetSettings(
  patch: Partial<WidgetSettings>,
): Promise<WidgetSettings> {
  const current = await loadWidgetSettings();
  const next = normalize({ ...current, ...patch });
  await saveWidgetSettings(next);
  return next;
}

/** Adds a widget to the end of the enabled list if not already present. */
export async function enableWidget(id: WidgetId): Promise<WidgetSettings> {
  const current = await loadWidgetSettings();
  if (current.enabledWidgetIds.includes(id)) {
    return current;
  }
  return updateWidgetSettings({ enabledWidgetIds: [...current.enabledWidgetIds, id] });
}

/** Swaps a widget one step earlier or later in the home layout order. */
export function moveWidgetInOrder(
  ids: WidgetId[],
  id: WidgetId,
  direction: 'up' | 'down',
): WidgetId[] {
  const index = ids.indexOf(id);
  if (index < 0) {
    return ids;
  }

  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= ids.length) {
    return ids;
  }

  const next = [...ids];
  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  return next;
}

export async function reorderEnabledWidgets(orderedIds: WidgetId[]): Promise<WidgetSettings> {
  const current = await loadWidgetSettings();
  const seen = new Set<WidgetId>();
  const normalized: WidgetId[] = [];

  for (const candidate of orderedIds) {
    if (isWidgetId(candidate) && current.enabledWidgetIds.includes(candidate) && !seen.has(candidate)) {
      seen.add(candidate);
      normalized.push(candidate);
    }
  }

  for (const id of current.enabledWidgetIds) {
    if (!seen.has(id)) {
      normalized.push(id);
    }
  }

  return updateWidgetSettings({ enabledWidgetIds: normalized });
}

/** Removes a widget from the enabled list. */
export async function disableWidget(id: WidgetId): Promise<WidgetSettings> {
  const current = await loadWidgetSettings();
  if (!current.enabledWidgetIds.includes(id)) {
    return current;
  }
  return updateWidgetSettings({
    enabledWidgetIds: current.enabledWidgetIds.filter((widgetId) => widgetId !== id),
  });
}
