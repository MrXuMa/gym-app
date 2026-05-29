import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from './supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FoodItem {
  name: string;
  estimated_portion_g?: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface FoodTotals {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface FoodAnalysisResult {
  request_id: string;
  id: string;
  items: FoodItem[];
  totals: FoodTotals;
  model: string;
  created_at: string;
}

export interface NutritionLog {
  id: string;
  user_id: string;
  logged_at: string;
  items: FoodItem[];
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  source: 'photo' | 'manual';
  created_at: string;
  log_date?: string;
  entries?: NutritionEntry[];
}

export interface NutritionEntry {
  logged_at: string;
  source: 'photo' | 'manual';
  items: FoodItem[];
  totals: FoodTotals;
}

export interface DailyNutritionLog {
  id: string;
  user_id: string;
  log_date: string;
  entries: NutritionEntry[];
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  created_at: string;
  logged_at: string;
}

const NETWORK_TIMEOUT_MS = 15000;
// Vision analysis legitimately takes longer than a normal DB/auth roundtrip
// (image upload + Gemini inference, plus a possible token-budget retry), so it
// gets its own, more generous budget.
const ANALYSIS_TIMEOUT_MS = 60000;

async function withTimeout<T>(promise: Promise<T>, label: string, timeoutMs = NETWORK_TIMEOUT_MS): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out. Check your connection and try again.`)), timeoutMs),
    ),
  ]);
}

// Day boundaries follow the user's local Eastern calendar (handles EST/EDT
// automatically) so a "day" of eating runs midnight-to-midnight Eastern, not UTC.
const EASTERN_TIME_ZONE = 'America/New_York';

/** YYYY-MM-DD for the given instant in Eastern time (the daily-log row key). */
export function dayKeyEastern(date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: EASTERN_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Milliseconds remaining until the next midnight in Eastern time. */
export function msUntilNextEasternMidnight(now = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: EASTERN_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  let hour = get('hour');
  if (hour === 24) hour = 0; // some runtimes emit '24' at midnight
  const elapsedMs =
    (hour * 3600 + get('minute') * 60 + get('second')) * 1000 + now.getMilliseconds();

  const dayMs = 24 * 60 * 60 * 1000;
  return Math.max(1000, dayMs - elapsedMs);
}

function sumEntries(entries: NutritionEntry[]): FoodTotals {
  return entries.reduce(
    (acc, entry) => ({
      kcal: acc.kcal + (entry.totals.kcal || 0),
      protein_g: acc.protein_g + (entry.totals.protein_g || 0),
      carbs_g: acc.carbs_g + (entry.totals.carbs_g || 0),
      fat_g: acc.fat_g + (entry.totals.fat_g || 0),
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );
}

// ─── Image helpers ─────────────────────────────────────────────────────────────

/** Pick an image from the camera roll or capture a new photo. */
export async function pickFoodImage(source: 'camera' | 'library'): Promise<string | null> {
  if (source === 'camera') {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') throw new Error('Camera permission denied');
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (result.canceled) return null;
    return result.assets[0].uri;
  } else {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') throw new Error('Media library permission denied');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (result.canceled) return null;
    return result.assets[0].uri;
  }
}

export interface PreparedFoodImage {
  uri: string;
  base64: string;
}

/** Resize/compress and return both URI + base64 payload. */
export async function prepareImageForAnalysis(uri: string): Promise<PreparedFoodImage> {
  const manipulated = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1024 } }],
    {
      compress: 0.82,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    },
  );

  if (!manipulated.base64) {
    throw new Error('Could not encode image for analysis');
  }

  return { uri: manipulated.uri, base64: manipulated.base64 };
}

// ─── Edge Function call ───────────────────────────────────────────────────────

/**
 * Ask the `analyze-food` Edge Function to analyse the image.
 * Sends the precomputed base64 payload directly — no storage round-trip needed.
 */
export async function analyzeFood(imageBase64: string): Promise<FoodAnalysisResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error('Not authenticated');
  if (!imageBase64) throw new Error('Could not read image file');

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  const url = `${supabaseUrl}/functions/v1/analyze-food`;

  const response = await withTimeout(
    fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image_data: imageBase64, mime_type: 'image/jpeg' }),
    }),
    'Food analysis request',
    ANALYSIS_TIMEOUT_MS,
  );

  const json = await response.json();
  if (!response.ok) throw new Error(json?.error ?? `HTTP ${response.status}`);
  return json as FoodAnalysisResult;
}

// ─── Nutrition log helpers ────────────────────────────────────────────────────

/** Save a confirmed nutrition entry to `nutrition_logs`. */
export async function saveNutritionLog(
  items: FoodItem[],
  totals: FoodTotals,
  source: 'photo' | 'manual' = 'photo',
): Promise<void> {
  const {
    data: { user },
    error: userError,
  } = await withTimeout(supabase.auth.getUser(), 'Loading user');
  if (userError || !user?.id) {
    throw new Error('Not authenticated');
  }

  const today = dayKeyEastern();

  const { data: existing, error: loadError } = await withTimeout(
    supabase
      .from('nutrition_logs')
      .select('id, entries, log_date')
      .eq('user_id', user.id)
      .eq('log_date', today)
      .maybeSingle(),
    'Loading daily nutrition log',
  );

  if (loadError) throw new Error(`Could not save nutrition log: ${loadError.message}`);

  const newEntry: NutritionEntry = {
    logged_at: new Date().toISOString(),
    source,
    items,
    totals: {
      kcal: Math.round(totals.kcal),
      protein_g: totals.protein_g,
      carbs_g: totals.carbs_g,
      fat_g: totals.fat_g,
    },
  };

  const existingEntries = Array.isArray(existing?.entries) ? (existing.entries as NutritionEntry[]) : [];
  const nextEntries = [...existingEntries, newEntry];
  const dailyTotals = sumEntries(nextEntries);

  if (existing?.id) {
    const { error } = await withTimeout(
      supabase
        .from('nutrition_logs')
        .update({
          entries: nextEntries,
          items: nextEntries.flatMap((entry) => entry.items),
          kcal: Math.round(dailyTotals.kcal),
          protein_g: dailyTotals.protein_g,
          carbs_g: dailyTotals.carbs_g,
          fat_g: dailyTotals.fat_g,
          source: 'photo',
          logged_at: newEntry.logged_at,
        })
        .eq('id', existing.id),
      'Saving meal',
    );
    if (error) throw new Error(`Could not save nutrition log: ${error.message}`);
    return;
  }

  const { error } = await withTimeout(
    supabase
      .from('nutrition_logs')
      .insert({
        user_id: user.id,
        log_date: today,
        entries: [newEntry],
        items,
        kcal: Math.round(newEntry.totals.kcal),
        protein_g: newEntry.totals.protein_g,
        carbs_g: newEntry.totals.carbs_g,
        fat_g: newEntry.totals.fat_g,
        source: 'photo',
        logged_at: newEntry.logged_at,
      }),
    'Saving meal',
  );
  if (error) throw new Error(`Could not save nutrition log: ${error.message}`);
}

/** Fetch recent nutrition logs for the current user (last N days). */
export async function fetchRecentNutritionLogs(days = 7): Promise<NutritionLog[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('nutrition_logs')
    .select('*')
    .gte('logged_at', since)
    .order('logged_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as NutritionLog[];
}

/** Fetch one daily nutrition row for YYYY-MM-DD (UTC date key). */
export async function fetchDailyNutritionLog(date: string): Promise<DailyNutritionLog | null> {
  const { data, error } = await withTimeout(
    supabase
      .from('nutrition_logs')
      .select('id,user_id,log_date,entries,kcal,protein_g,carbs_g,fat_g,created_at,logged_at')
      .eq('log_date', date)
      .maybeSingle(),
    'Loading daily nutrition log',
  );

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    id: data.id,
    user_id: data.user_id,
    log_date: data.log_date,
    entries: Array.isArray(data.entries) ? (data.entries as NutritionEntry[]) : [],
    kcal: Number(data.kcal ?? 0),
    protein_g: Number(data.protein_g ?? 0),
    carbs_g: Number(data.carbs_g ?? 0),
    fat_g: Number(data.fat_g ?? 0),
    created_at: data.created_at,
    logged_at: data.logged_at,
  };
}

/** Delete one meal entry from a daily nutrition row by entry index. */
export async function deleteDailyNutritionEntry(date: string, entryIndex: number): Promise<void> {
  const {
    data: { user },
    error: userError,
  } = await withTimeout(supabase.auth.getUser(), 'Loading user');
  if (userError || !user?.id) {
    throw new Error('Not authenticated');
  }

  const { data: existing, error: loadError } = await withTimeout(
    supabase
      .from('nutrition_logs')
      .select('id, entries')
      .eq('user_id', user.id)
      .eq('log_date', date)
      .maybeSingle(),
    'Loading daily nutrition log',
  );
  if (loadError) throw new Error(`Could not delete meal: ${loadError.message}`);
  if (!existing?.id) throw new Error('No daily log found for this date');

  const existingEntries = Array.isArray(existing.entries) ? (existing.entries as NutritionEntry[]) : [];
  if (entryIndex < 0 || entryIndex >= existingEntries.length) {
    throw new Error('Meal entry no longer exists');
  }

  const nextEntries = existingEntries.filter((_, idx) => idx !== entryIndex);

  if (nextEntries.length === 0) {
    const { error } = await withTimeout(
      supabase.from('nutrition_logs').delete().eq('id', existing.id),
      'Deleting meal',
    );
    if (error) throw new Error(`Could not delete meal: ${error.message}`);
    return;
  }

  const totals = sumEntries(nextEntries);
  const latestLoggedAt = nextEntries[nextEntries.length - 1]?.logged_at ?? new Date().toISOString();
  const { error } = await withTimeout(
    supabase
      .from('nutrition_logs')
      .update({
        entries: nextEntries,
        items: nextEntries.flatMap((entry) => entry.items),
        kcal: Math.round(totals.kcal),
        protein_g: totals.protein_g,
        carbs_g: totals.carbs_g,
        fat_g: totals.fat_g,
        logged_at: latestLoggedAt,
        source: 'photo',
      })
      .eq('id', existing.id),
    'Deleting meal',
  );

  if (error) throw new Error(`Could not delete meal: ${error.message}`);
}

/** Sum macros for a given calendar day (YYYY-MM-DD). */
export function dailyMacroTotals(logs: NutritionLog[], date: string): FoodTotals {
  const dayLogs = logs.filter(l => l.logged_at.startsWith(date));
  return dayLogs.reduce<FoodTotals>(
    (acc, l) => ({
      kcal: acc.kcal + (l.kcal ?? 0),
      protein_g: acc.protein_g + (Number(l.protein_g) ?? 0),
      carbs_g: acc.carbs_g + (Number(l.carbs_g) ?? 0),
      fat_g: acc.fat_g + (Number(l.fat_g) ?? 0),
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );
}

// ─── Full pipeline ─────────────────────────────────────────────────────────────

/**
 * Convenience: pick → prepare → analyze in one call.
 * Returns the processed local URI and analysis result.
 */
export async function fullFoodScanPipeline(
  source: 'camera' | 'library',
  onProgress?: (step: 'picked' | 'analyzing') => void,
): Promise<{ imageUri: string; result: FoodAnalysisResult }> {
  const uri = await pickFoodImage(source);
  if (!uri) throw new Error('cancelled');

  onProgress?.('picked');
  const prepared = await prepareImageForAnalysis(uri);

  onProgress?.('analyzing');
  const result = await analyzeFood(prepared.base64);

  return { imageUri: prepared.uri, result };
}
