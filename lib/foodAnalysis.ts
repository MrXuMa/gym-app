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

/** Resize + compress the image to ≤1024px wide, JPEG ≤300 KB. */
export async function prepareImageForUpload(uri: string): Promise<{ uri: string; blob: Blob }> {
  const manipulated = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1024 } }],
    { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG },
  );

  const response = await fetch(manipulated.uri);
  const blob = await response.blob();
  return { uri: manipulated.uri, blob };
}

// ─── Supabase storage ─────────────────────────────────────────────────────────

/**
 * Upload a prepared food image blob to the `food-images` bucket.
 * Returns the storage path (relative, no bucket prefix).
 */
export async function uploadFoodImage(userId: string, blob: Blob): Promise<string> {
  const ts = Date.now();
  const path = `${userId}/${ts}.jpg`;

  const { error } = await supabase.storage
    .from('food-images')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false });

  if (error) throw new Error(`Upload failed: ${error.message}`);
  return path;
}

// ─── Edge Function call ───────────────────────────────────────────────────────

/**
 * Ask the `analyze-food` Edge Function to analyse the uploaded image.
 * The function handles rate limiting, queuing, and Gemini API calls.
 */
export async function analyzeFood(imagePath: string): Promise<FoodAnalysisResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  const url = `${supabaseUrl}/functions/v1/analyze-food`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ image_path: imagePath }),
  });

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
): Promise<NutritionLog> {
  const { data, error } = await supabase
    .from('nutrition_logs')
    .insert({
      items,
      kcal: Math.round(totals.kcal),
      protein_g: totals.protein_g,
      carbs_g: totals.carbs_g,
      fat_g: totals.fat_g,
      source,
    })
    .select('*')
    .single();

  if (error) throw new Error(`Could not save nutrition log: ${error.message}`);
  return data as NutritionLog;
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
 * Convenience: pick → prepare → upload → analyze in one call.
 * Returns the raw result for the confirmation screen.
 */
export async function fullFoodScanPipeline(
  source: 'camera' | 'library',
  userId: string,
  onProgress?: (step: 'picked' | 'uploading' | 'analyzing') => void,
): Promise<{ imagePath: string; result: FoodAnalysisResult }> {
  const uri = await pickFoodImage(source);
  if (!uri) throw new Error('cancelled');

  onProgress?.('picked');
  const { blob } = await prepareImageForUpload(uri);

  onProgress?.('uploading');
  const imagePath = await uploadFoodImage(userId, blob);

  onProgress?.('analyzing');
  const result = await analyzeFood(imagePath);

  return { imagePath, result };
}
