/**
 * Per-device home widget preferences.
 *
 * Stored in AsyncStorage. When we later add a full widget editor (reorder, add/remove,
 * cross-device sync), this module is the single source of truth the rest of the app
 * reads through — so the storage backend can move to Supabase without touching callers.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@gym-app/widget-settings/v1';

export type WidgetSettings = {
  predictedMaxExerciseId: string | null;
};

const DEFAULT_SETTINGS: WidgetSettings = {
  predictedMaxExerciseId: null,
};

function normalize(raw: unknown): WidgetSettings {
  if (!raw || typeof raw !== 'object') {
    return DEFAULT_SETTINGS;
  }

  const value = raw as Partial<WidgetSettings>;

  return {
    predictedMaxExerciseId:
      typeof value.predictedMaxExerciseId === 'string' && value.predictedMaxExerciseId.trim().length > 0
        ? value.predictedMaxExerciseId
        : null,
  };
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
