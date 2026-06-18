import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from './supabase';
import { throwIfSupabaseError } from './supabaseError';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FoodItem {
  name: string;
  estimated_portion_g?: number;
  fdc_id?: number;
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

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

export const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snacks'];

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
};

export interface NutritionEntry {
  logged_at: string;
  source: 'photo' | 'manual';
  meal?: MealType;
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

/** Max Gemini food scans per user per Eastern calendar day (matches edge function). */
export const FOOD_SCAN_DAILY_LIMIT = 20;

export type FoodAnalysisErrorCode =
  | 'limit_reached'
  | 'analysis_failed'
  | 'parse_failed'
  | 'in_progress'
  | 'unauthorized'
  | 'timeout'
  | 'invalid_response'
  | 'unknown';

export class FoodAnalysisError extends Error {
  readonly code: FoodAnalysisErrorCode;

  constructor(code: FoodAnalysisErrorCode, message: string) {
    super(message);
    this.name = 'FoodAnalysisError';
    this.code = code;
  }
}

export function isFoodAnalysisError(err: unknown): err is FoodAnalysisError {
  return err instanceof FoodAnalysisError;
}

type AnalysisErrorBody = {
  error?: string;
  code?: string;
  limit?: number;
};

function looksTechnical(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return true;
  if (/gemini|invalid json|parse failed|model errors|HTTP \d{3}/i.test(trimmed)) return true;
  return false;
}

function mapAnalysisError(status: number, body: AnalysisErrorBody): FoodAnalysisError {
  const code = (body.code ?? '') as FoodAnalysisErrorCode;
  const limit = body.limit ?? FOOD_SCAN_DAILY_LIMIT;

  if (status === 429 && (code === 'limit_reached' || code === 'in_progress')) {
    if (code === 'in_progress') {
      return new FoodAnalysisError(
        'in_progress',
        'A scan is already in progress. Please wait a moment and try again.',
      );
    }
    return new FoodAnalysisError(
      'limit_reached',
      `Limit reached. You can scan up to ${limit} meals per day. Try again tomorrow.`,
    );
  }

  if (code === 'parse_failed') {
    return new FoodAnalysisError(
      'parse_failed',
      body.error && !looksTechnical(body.error)
        ? body.error
        : 'We could not read the food in this photo. Try a clearer picture with good lighting.',
    );
  }

  if (status === 401) {
    return new FoodAnalysisError('unauthorized', 'Please sign in to scan food.');
  }

  if (status === 429) {
    return new FoodAnalysisError(
      'limit_reached',
      `Limit reached. You can scan up to ${limit} meals per day. Try again tomorrow.`,
    );
  }

  if (body.error && !looksTechnical(body.error)) {
    return new FoodAnalysisError(
      code === 'analysis_failed' || code === 'parse_failed' ? code : 'analysis_failed',
      body.error,
    );
  }

  return new FoodAnalysisError(
    'analysis_failed',
    'We could not analyze this photo. Please try again with a clearer picture.',
  );
}

function validateAnalysisResult(json: unknown): FoodAnalysisResult {
  if (!json || typeof json !== 'object') {
    throw new FoodAnalysisError('invalid_response', 'We could not analyze this photo. Please try again.');
  }

  const payload = json as Partial<FoodAnalysisResult>;
  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    throw new FoodAnalysisError(
      'parse_failed',
      'We could not identify any food in this photo. Try a different angle or better lighting.',
    );
  }

  return payload as FoodAnalysisResult;
}

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

export function totalsFromItems(items: FoodItem[]): FoodTotals {
  return items.reduce(
    (acc, item) => ({
      kcal: acc.kcal + (item.kcal || 0),
      protein_g: acc.protein_g + (item.protein_g || 0),
      carbs_g: acc.carbs_g + (item.carbs_g || 0),
      fat_g: acc.fat_g + (item.fat_g || 0),
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );
}

/** Infer meal bucket from Eastern local hour when not explicitly set. */
export function inferMealFromTime(isoOrDate: string | Date = new Date()): MealType {
  const date = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  let hour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: EASTERN_TIME_ZONE,
      hour: 'numeric',
      hour12: false,
    }).format(date),
  );
  if (hour === 24) hour = 0;
  if (hour < 11) return 'breakfast';
  if (hour < 16) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snacks';
}

export function entryMeal(entry: NutritionEntry): MealType {
  return entry.meal ?? inferMealFromTime(entry.logged_at);
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Monday (YYYY-MM-DD) of the calendar week containing `dateKey`. */
export function mondayOfWeekContaining(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00.000Z`);
  const dow = d.getUTCDay();
  const daysFromMonday = dow === 0 ? 6 : dow - 1;
  return addDaysToDateKey(dateKey, -daysFromMonday);
}

/** Seven date keys Mon–Sun starting at `mondayKey`. */
export function weekDateKeysFromMonday(mondayKey: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysToDateKey(mondayKey, i));
}

export function shiftWeek(mondayKey: string, weeks: number): string {
  return addDaysToDateKey(mondayKey, weeks * 7);
}

export type WeekNutritionSummary = {
  weekStart: string;
  days: Array<{ dateKey: string; log: DailyNutritionLog | null }>;
  totals: FoodTotals;
  averageKcal: number;
  daysWithData: number;
};

function mapDailyRow(data: {
  id: string;
  user_id: string;
  log_date: string;
  entries: unknown;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  created_at: string;
  logged_at: string;
}): DailyNutritionLog {
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

async function loadDailyLogForUser(userId: string, logDate: string) {
  return await withTimeout(
    supabase
      .from('nutrition_logs')
      .select('id, entries, log_date')
      .eq('user_id', userId)
      .eq('log_date', logDate)
      .maybeSingle(),
    'Loading daily nutrition log',
  );
}

async function persistDailyLog(userId: string, logDate: string, entries: NutritionEntry[]): Promise<void> {
  const dailyTotals = sumEntries(entries);
  const latestLoggedAt = entries[entries.length - 1]?.logged_at ?? new Date().toISOString();
  const flatItems = entries.flatMap((entry) => entry.items);
  const hasManual = entries.some((e) => e.source === 'manual');
  const rowSource = hasManual ? 'manual' : 'photo';

  const { data: existing, error: loadError } = await loadDailyLogForUser(userId, logDate);
  if (loadError) throwIfSupabaseError(loadError, 'Could not save nutrition log.');

  if (entries.length === 0) {
    if (existing?.id) {
      const { error } = await withTimeout(
        supabase.from('nutrition_logs').delete().eq('id', existing.id),
        'Saving meal',
      );
      if (error) throwIfSupabaseError(error, 'Could not save nutrition log.');
    }
    return;
  }

  const payload = {
    entries,
    items: flatItems,
    kcal: Math.round(dailyTotals.kcal),
    protein_g: dailyTotals.protein_g,
    carbs_g: dailyTotals.carbs_g,
    fat_g: dailyTotals.fat_g,
    source: rowSource,
    logged_at: latestLoggedAt,
  };

  if (existing?.id) {
    const { error } = await withTimeout(
      supabase.from('nutrition_logs').update(payload).eq('id', existing.id),
      'Saving meal',
    );
    if (error) throwIfSupabaseError(error, 'Could not save nutrition log.');
    return;
  }

  const { error } = await withTimeout(
    supabase.from('nutrition_logs').insert({
      user_id: userId,
      log_date: logDate,
      ...payload,
    }),
    'Saving meal',
  );
  if (error) throw new Error(`Could not save nutrition log: ${error.message}`);
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
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new FoodAnalysisError('unauthorized', 'Please sign in to scan food.');
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new FoodAnalysisError('unauthorized', 'Please sign in to scan food.');
  if (!imageBase64) throw new FoodAnalysisError('analysis_failed', 'Could not read image file');

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  const url = `${supabaseUrl}/functions/v1/analyze-food`;

  let response: Response;
  try {
    response = await withTimeout(
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
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('timed out')) {
      throw new FoodAnalysisError('timeout', 'Analysis took too long. Check your connection and try again.');
    }
    throw new FoodAnalysisError('analysis_failed', 'Could not reach the food scanner. Check your connection.');
  }

  let json: AnalysisErrorBody & Partial<FoodAnalysisResult>;
  try {
    json = await response.json();
  } catch {
    throw new FoodAnalysisError('invalid_response', 'We could not analyze this photo. Please try again.');
  }

  if (!response.ok) {
    throw mapAnalysisError(response.status, json);
  }

  return validateAnalysisResult(json);
}

// ─── Nutrition log helpers ────────────────────────────────────────────────────

/** Save a confirmed nutrition entry to `nutrition_logs`. */
export async function saveNutritionLog(
  items: FoodItem[],
  totals: FoodTotals,
  source: 'photo' | 'manual' = 'photo',
  meal: MealType = inferMealFromTime(),
  logDate?: string,
): Promise<void> {
  const {
    data: { user },
    error: userError,
  } = await withTimeout(supabase.auth.getUser(), 'Loading user');
  if (userError || !user?.id) {
    throw new Error('Not authenticated');
  }

  const date = logDate ?? dayKeyEastern();

  const { data: existing, error: loadError } = await loadDailyLogForUser(user.id, date);
  if (loadError) throwIfSupabaseError(loadError, 'Could not save nutrition log.');

  const newEntry: NutritionEntry = {
    logged_at: new Date().toISOString(),
    source,
    meal,
    items,
    totals: {
      kcal: Math.round(totals.kcal),
      protein_g: totals.protein_g,
      carbs_g: totals.carbs_g,
      fat_g: totals.fat_g,
    },
  };

  const existingEntries = Array.isArray(existing?.entries) ? (existing.entries as NutritionEntry[]) : [];
  await persistDailyLog(user.id, date, [...existingEntries, newEntry]);
}

/** Fetch one daily nutrition row for YYYY-MM-DD (Eastern log_date key). */
export async function fetchDailyNutritionLog(date: string): Promise<DailyNutritionLog | null> {
  const { data, error } = await withTimeout(
    supabase
      .from('nutrition_logs')
      .select('id,user_id,log_date,entries,kcal,protein_g,carbs_g,fat_g,created_at,logged_at')
      .eq('log_date', date)
      .maybeSingle(),
    'Loading daily nutrition log',
  );

  if (error) throwIfSupabaseError(error, 'Could not load nutrition log.');
  if (!data) return null;

  return mapDailyRow(data);
}

/** Fetch nutrition logs for a calendar week (Mon–Sun). */
export async function fetchWeekNutritionLogs(weekStartMonday: string): Promise<WeekNutritionSummary> {
  const dateKeys = weekDateKeysFromMonday(weekStartMonday);

  const { data, error } = await withTimeout(
    supabase
      .from('nutrition_logs')
      .select('id,user_id,log_date,entries,kcal,protein_g,carbs_g,fat_g,created_at,logged_at')
      .in('log_date', dateKeys),
    'Loading week nutrition log',
  );

  if (error) throwIfSupabaseError(error, 'Could not load nutrition log.');

  const byDate = new Map<string, DailyNutritionLog>();
  for (const row of data ?? []) {
    byDate.set(row.log_date, mapDailyRow(row));
  }

  const days = dateKeys.map((dateKey) => ({
    dateKey,
    log: byDate.get(dateKey) ?? null,
  }));

  const totals = days.reduce<FoodTotals>(
    (acc, day) => ({
      kcal: acc.kcal + (day.log?.kcal ?? 0),
      protein_g: acc.protein_g + (day.log?.protein_g ?? 0),
      carbs_g: acc.carbs_g + (day.log?.carbs_g ?? 0),
      fat_g: acc.fat_g + (day.log?.fat_g ?? 0),
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );

  const daysWithData = days.filter((d) => d.log && d.log.kcal > 0).length;
  const averageKcal = daysWithData > 0 ? Math.round(totals.kcal / daysWithData) : 0;

  return { weekStart: weekStartMonday, days, totals, averageKcal, daysWithData };
}

/** Count individual meal entries across daily nutrition rows. */
export function countMealsInNutritionRows(rows: Array<{ entries?: unknown }>): number {
  let count = 0;
  for (const row of rows) {
    if (Array.isArray(row.entries)) {
      count += row.entries.length;
    }
  }
  return count;
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

  const { data: existing, error: loadError } = await loadDailyLogForUser(user.id, date);
  if (loadError) throw new Error(`Could not delete meal: ${loadError.message}`);
  if (!existing?.id) throw new Error('No daily log found for this date');

  const existingEntries = Array.isArray(existing.entries) ? (existing.entries as NutritionEntry[]) : [];
  if (entryIndex < 0 || entryIndex >= existingEntries.length) {
    throw new Error('Meal entry no longer exists');
  }

  const nextEntries = existingEntries.filter((_, idx) => idx !== entryIndex);
  await persistDailyLog(user.id, date, nextEntries);
}

/** Update meal slot and/or items on an existing entry. */
export async function updateNutritionEntry(
  date: string,
  entryIndex: number,
  updates: { meal?: MealType; items?: FoodItem[] },
): Promise<void> {
  const {
    data: { user },
    error: userError,
  } = await withTimeout(supabase.auth.getUser(), 'Loading user');
  if (userError || !user?.id) {
    throw new Error('Not authenticated');
  }

  const { data: existing, error: loadError } = await loadDailyLogForUser(user.id, date);
  if (loadError) throw new Error(`Could not update meal: ${loadError.message}`);
  if (!existing?.id) throw new Error('No daily log found for this date');

  const existingEntries = Array.isArray(existing.entries) ? (existing.entries as NutritionEntry[]) : [];
  if (entryIndex < 0 || entryIndex >= existingEntries.length) {
    throw new Error('Meal entry no longer exists');
  }

  const current = existingEntries[entryIndex];
  const nextItems = updates.items ?? current.items;
  const itemTotals = totalsFromItems(nextItems);

  const nextEntry: NutritionEntry = {
    ...current,
    meal: updates.meal ?? current.meal ?? entryMeal(current),
    items: nextItems,
    totals: {
      kcal: Math.round(itemTotals.kcal),
      protein_g: itemTotals.protein_g,
      carbs_g: itemTotals.carbs_g,
      fat_g: itemTotals.fat_g,
    },
  };

  const nextEntries = [...existingEntries];
  nextEntries[entryIndex] = nextEntry;
  await persistDailyLog(user.id, date, nextEntries);
}
