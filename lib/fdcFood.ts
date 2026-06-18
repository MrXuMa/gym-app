import { supabase } from './supabase';
import type { FoodTotals } from './foodAnalysis';

const SEARCH_TIMEOUT_MS = 15000;

export type FdcSearchFood = {
  fdc_id: number;
  name: string;
  brand: string | null;
  data_type: string;
  per_100g: FoodTotals;
};

export type FdcFoodDetail = FdcSearchFood & {
  default_grams: number;
  serving_description: string | null;
  portion_grams: number;
  macros: FoodTotals;
};

type SearchResponse = {
  foods: FdcSearchFood[];
  total_hits: number;
  page: number;
};

type ErrorBody = {
  error?: string;
  code?: string;
};

async function callSearchFood<T>(body: Record<string, unknown>): Promise<T> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const token = userData?.user ? (await supabase.auth.getSession()).data.session?.access_token : null;
  if (userError || !token) throw new Error('Please sign in to search food.');

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  const url = `${supabaseUrl}/functions/v1/search-food`;

  const response = await Promise.race([
    fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Food search timed out. Try again.')), SEARCH_TIMEOUT_MS),
    ),
  ]);

  let json: ErrorBody & Partial<T>;
  try {
    json = await response.json();
  } catch {
    throw new Error('Food search failed. Please try again.');
  }

  if (!response.ok) {
    if (json.code === 'limit_reached') {
      throw new Error(json.error ?? 'Daily food search limit reached. Try again tomorrow.');
    }
    if (json.code === 'not_configured') {
      throw new Error('Food search is temporarily unavailable. Please try again later.');
    }
    throw new Error(json.error ?? 'Food search failed. Please try again.');
  }

  return json as T;
}

export async function searchFdcFoods(query: string, page = 1): Promise<SearchResponse> {
  return await callSearchFood<SearchResponse>({ action: 'search', query, page });
}

export async function getFdcFoodDetail(fdcId: number, grams?: number): Promise<FdcFoodDetail> {
  return await callSearchFood<FdcFoodDetail>({
    action: 'detail',
    fdc_id: fdcId,
    grams,
  });
}
