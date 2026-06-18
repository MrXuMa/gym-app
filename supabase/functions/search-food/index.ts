import { createClient } from 'jsr:@supabase/supabase-js@2';

const FDC_BASE = 'https://api.nal.usda.gov/fdc/v1';
const SEARCH_DATA_TYPES = ['Foundation', 'SR Legacy', 'Branded', 'Survey (FNDDS)'];
const MAX_SEARCH_REQUESTS_PER_DAY = 200;

const NUTRIENT_IDS = {
  energy: new Set([1008, 2047, 208]),
  protein: new Set([1003, 203]),
  carbs: new Set([1005, 205]),
  fat: new Set([1004, 204]),
};

/** kJ energy entries — skip when a kcal energy value exists. */
const ENERGY_KJ_IDS = new Set([1062, 268]);

const EASTERN_TIME_ZONE = 'America/New_York';

function dayKeyEastern(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: EASTERN_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function nutrientKeys(n: FdcNutrient): number[] {
  const keys: number[] = [];
  const add = (v: unknown) => {
    const num = Number(v);
    if (Number.isFinite(num)) keys.push(num);
  };
  add(n.nutrientId);
  add(n.nutrient?.id);
  add(n.nutrientNumber);
  add(n.number);
  add(n.nutrient?.number);
  return keys;
}

function matchesNutrient(keys: number[], allowed: Set<number>): boolean {
  return keys.some((k) => allowed.has(k));
}

function corsHeaders() {
  const origin = Deno.env.get('ALLOWED_ORIGIN')?.trim() || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

type MacroTotals = {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

type FdcNutrient = {
  nutrientId?: number;
  nutrientNumber?: number | string;
  number?: number | string;
  nutrient?: { id?: number; number?: number | string; unitName?: string };
  nutrientName?: string;
  value?: number;
  amount?: number;
  unitName?: string;
};

type LabelNutrientValue = { value?: number };
type LabelNutrients = {
  calories?: LabelNutrientValue;
  protein?: LabelNutrientValue;
  carbohydrates?: LabelNutrientValue;
  fat?: LabelNutrientValue;
};

function nutrientAmount(n: FdcNutrient): number {
  const amount = Number(n.amount ?? n.value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function nutrientUnit(n: FdcNutrient): string {
  return (n.unitName ?? n.nutrient?.unitName ?? '').toLowerCase();
}

function macrosFromNutrients(nutrients: FdcNutrient[] | undefined): MacroTotals {
  const list = Array.isArray(nutrients) ? nutrients : [];
  let kcal = 0;
  let protein_g = 0;
  let carbs_g = 0;
  let fat_g = 0;

  for (const n of list) {
    const keys = nutrientKeys(n);
    if (keys.length === 0) continue;

    const amount = nutrientAmount(n);
    const unit = nutrientUnit(n);

    if (matchesNutrient(keys, NUTRIENT_IDS.energy)) {
      if (keys.some((k) => ENERGY_KJ_IDS.has(k)) || unit === 'kj') continue;
      if (kcal === 0) kcal = amount;
      continue;
    }
    if (matchesNutrient(keys, NUTRIENT_IDS.protein) && protein_g === 0) {
      protein_g = amount;
      continue;
    }
    if (matchesNutrient(keys, NUTRIENT_IDS.carbs) && carbs_g === 0) {
      carbs_g = amount;
      continue;
    }
    if (matchesNutrient(keys, NUTRIENT_IDS.fat) && fat_g === 0) {
      fat_g = amount;
    }
  }

  return {
    kcal: Math.round(kcal * 10) / 10,
    protein_g: Math.round(protein_g * 10) / 10,
    carbs_g: Math.round(carbs_g * 10) / 10,
    fat_g: Math.round(fat_g * 10) / 10,
  };
}

/** Branded foods often only expose label facts per serving — normalize to per 100g. */
function macrosFromLabelNutrients(label: LabelNutrients, servingGrams: number): MacroTotals | null {
  const kcal = label.calories?.value;
  const protein_g = label.protein?.value;
  const carbs_g = label.carbohydrates?.value;
  const fat_g = label.fat?.value;

  const hasAny = [kcal, protein_g, carbs_g, fat_g].some((v) => v !== undefined && v !== null);
  if (!hasAny) return null;

  const basis = servingGrams > 0 ? servingGrams : 100;
  const toPer100g = (v: number) => Math.round(v * (100 / basis) * 10) / 10;

  return {
    kcal: Math.round((kcal ?? 0) * (100 / basis)),
    protein_g: toPer100g(protein_g ?? 0),
    carbs_g: toPer100g(carbs_g ?? 0),
    fat_g: toPer100g(fat_g ?? 0),
  };
}

function resolvePer100gMacros(food: Record<string, unknown>, servingGrams: number): MacroTotals {
  let per100g = macrosFromNutrients(food.foodNutrients as FdcNutrient[]);
  if (food.labelNutrients) {
    const fromLabel = macrosFromLabelNutrients(food.labelNutrients as LabelNutrients, servingGrams);
    if (fromLabel) {
      if (per100g.kcal === 0 && fromLabel.kcal > 0) per100g.kcal = fromLabel.kcal;
      if (per100g.protein_g === 0 && fromLabel.protein_g > 0) per100g.protein_g = fromLabel.protein_g;
      if (per100g.carbs_g === 0 && fromLabel.carbs_g > 0) per100g.carbs_g = fromLabel.carbs_g;
      if (per100g.fat_g === 0 && fromLabel.fat_g > 0) per100g.fat_g = fromLabel.fat_g;
    }
  }
  return per100g;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function scaleMacros(macros: MacroTotals, grams: number, basisGrams: number): MacroTotals {
  const factor = basisGrams > 0 ? grams / basisGrams : 1;
  return {
    kcal: Math.round(macros.kcal * factor),
    protein_g: round1(macros.protein_g * factor),
    carbs_g: round1(macros.carbs_g * factor),
    fat_g: round1(macros.fat_g * factor),
  };
}

type SearchFood = {
  fdc_id: number;
  name: string;
  brand: string | null;
  data_type: string;
  per_100g: MacroTotals;
};

type FoodDetail = SearchFood & {
  default_grams: number;
  serving_description: string | null;
};

const FDC_ENV_NAMES = ['FDC_API_KEY', 'FCD_API_KEY', 'fdc_api_key', 'USDA_FDC_API_KEY'] as const;

function resolveFdcApiKey(): string | null {
  for (const name of FDC_ENV_NAMES) {
    const value = Deno.env.get(name)?.trim();
    if (value) return value;
  }
  return null;
}

async function fdcFetch(path: string, init?: RequestInit, apiKey?: string) {
  const url = new URL(`${FDC_BASE}${path}`);
  url.searchParams.set('api_key', apiKey ?? '');

  const response = await fetch(url.toString(), init);
  if (!response.ok) {
    const text = await response.text();
    console.error('FDC API error', response.status, text.slice(0, 300));
    throw new Error('FDC_REQUEST_FAILED');
  }
  return await response.json();
}

async function searchFoods(query: string, page: number, apiKey: string) {
  const body = {
    query: query.trim(),
    dataType: SEARCH_DATA_TYPES,
    pageSize: 20,
    pageNumber: Math.max(1, Math.min(page, 5)),
  };

  const json = await fdcFetch(
    '/foods/search',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    apiKey,
  );

  const foods = Array.isArray(json.foods) ? json.foods : [];
  const results: SearchFood[] = foods
    .map((food: Record<string, unknown>) => {
      const fdcId = Number(food.fdcId);
      if (!Number.isFinite(fdcId)) return null;

      const description = typeof food.description === 'string' ? food.description.trim() : '';
      if (!description) return null;

      const brand =
        typeof food.brandOwner === 'string' && food.brandOwner.trim()
          ? food.brandOwner.trim()
          : typeof food.brandName === 'string' && food.brandName.trim()
            ? food.brandName.trim()
            : null;

      const servingSize = Number(food.servingSize);
      const servingUnit =
        typeof food.servingSizeUnit === 'string' ? food.servingSizeUnit.toLowerCase() : '';
      let servingGrams = 100;
      if (
        Number.isFinite(servingSize) &&
        servingSize > 0 &&
        (servingUnit === 'g' || servingUnit === 'grm' || servingUnit === 'gm')
      ) {
        servingGrams = servingSize;
      }

      return {
        fdc_id: fdcId,
        name: description,
        brand,
        data_type: typeof food.dataType === 'string' ? food.dataType : 'Unknown',
        per_100g: resolvePer100gMacros(food, servingGrams),
      } satisfies SearchFood;
    })
    .filter((item: SearchFood | null): item is SearchFood => Boolean(item));

  return {
    foods: results,
    total_hits: Number(json.totalHits ?? results.length),
    page: body.pageNumber,
  };
}

async function getFoodDetail(fdcId: number, apiKey: string): Promise<FoodDetail> {
  const food = await fdcFetch(`/food/${fdcId}`, undefined, apiKey);

  const description = typeof food.description === 'string' ? food.description.trim() : 'Unknown food';
  const brand =
    typeof food.brandOwner === 'string' && food.brandOwner.trim()
      ? food.brandOwner.trim()
      : null;

  const servingSize = Number(food.servingSize);
  const servingUnit = typeof food.servingSizeUnit === 'string' ? food.servingSizeUnit.toLowerCase() : '';
  const household = typeof food.householdServingFullText === 'string' ? food.householdServingFullText : null;

  let defaultGrams = 100;
  let servingDescription: string | null = null;

  if (Number.isFinite(servingSize) && servingSize > 0 && (servingUnit === 'g' || servingUnit === 'grm' || servingUnit === 'gm')) {
    defaultGrams = Math.round(servingSize);
    servingDescription = household ?? `${defaultGrams} g serving`;
  } else if (household) {
    servingDescription = household;
  }

  const per100g = resolvePer100gMacros(food, defaultGrams);

  return {
    fdc_id: fdcId,
    name: description,
    brand,
    data_type: typeof food.dataType === 'string' ? food.dataType : 'Unknown',
    per_100g: per100g,
    default_grams: defaultGrams,
    serving_description: servingDescription,
  };
}

async function assertSearchRateLimit(
  serviceClient: ReturnType<typeof createClient>,
  userId: string,
): Promise<void> {
  const today = dayKeyEastern();

  const { error } = await serviceClient.rpc('reserve_food_search_request', {
    p_user_id: userId,
    p_log_date: today,
    p_daily_limit: MAX_SEARCH_REQUESTS_PER_DAY,
  });

  if (!error) return;

  const code = error.message ?? '';
  if (code.includes('search_limit_reached')) {
    throw new Error('SEARCH_LIMIT_REACHED');
  }
  console.error('reserve_food_search_request failed:', error.message);
  throw new Error('RATE_LIMIT_UNAVAILABLE');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() });
  }

  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders() });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return Response.json({ error: 'Missing authorization' }, { status: 401, headers: corsHeaders() });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const fdcApiKey = resolveFdcApiKey();
    if (!fdcApiKey) {
      console.error('FDC API key not found; checked env:', FDC_ENV_NAMES.join(', '));
      return Response.json(
        { error: 'Food search is not configured yet.', code: 'not_configured' },
        { status: 503, headers: corsHeaders() },
      );
    }

    const body = await req.json();
    const action = typeof body.action === 'string' ? body.action : '';

    if (action === 'search' || action === 'detail') {
      try {
        await assertSearchRateLimit(serviceClient, user.id);
      } catch (err) {
        if (err instanceof Error && err.message === 'SEARCH_LIMIT_REACHED') {
          return Response.json(
            {
              error: `Daily search limit reached (${MAX_SEARCH_REQUESTS_PER_DAY} lookups per day).`,
              code: 'limit_reached',
            },
            { status: 429, headers: corsHeaders() },
          );
        }
        if (err instanceof Error && err.message === 'RATE_LIMIT_UNAVAILABLE') {
          return Response.json(
            { error: 'Food search is temporarily unavailable. Please try again.', code: 'unavailable' },
            { status: 503, headers: corsHeaders() },
          );
        }
        throw err;
      }
    }

    if (action === 'search') {
      const query = typeof body.query === 'string' ? body.query.trim() : '';
      if (query.length < 2) {
        return Response.json(
          { error: 'Enter at least 2 characters to search.' },
          { status: 400, headers: corsHeaders() },
        );
      }
      if (query.length > 120) {
        return Response.json(
          { error: 'Search query is too long.' },
          { status: 400, headers: corsHeaders() },
        );
      }

      const page = Number(body.page ?? 1);
      const result = await searchFoods(query, page, fdcApiKey);
      return Response.json(result, { status: 200, headers: corsHeaders() });
    }

    if (action === 'detail') {
      const fdcId = Number(body.fdc_id);
      if (!Number.isFinite(fdcId)) {
        return Response.json({ error: 'fdc_id is required' }, { status: 400, headers: corsHeaders() });
      }

      const detail = await getFoodDetail(fdcId, fdcApiKey);
      const grams = Number(body.grams);
      const portionGrams = Number.isFinite(grams) && grams > 0 ? grams : detail.default_grams;
      const macros = scaleMacros(detail.per_100g, portionGrams, 100);

      return Response.json(
        {
          ...detail,
          portion_grams: portionGrams,
          macros,
        },
        { status: 200, headers: corsHeaders() },
      );
    }

    return Response.json({ error: 'Unknown action' }, { status: 400, headers: corsHeaders() });
  } catch (err) {
    console.error('search-food error:', err);
    const message =
      err instanceof Error && err.message === 'FDC_REQUEST_FAILED'
        ? 'Could not reach the food database. Try again in a moment.'
        : 'Food search failed. Please try again.';
    return Response.json({ error: message, code: 'search_failed' }, { status: 500, headers: corsHeaders() });
  }
});
