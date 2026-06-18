import { createClient } from 'jsr:@supabase/supabase-js@2';

const GEMINI_MODELS = (
  Deno.env.get('GEMINI_MODELS')?.split(',').map((m: string) => m.trim()).filter(Boolean) ??
  ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash']
);
const parsedDailyLimit = Number(Deno.env.get('FOOD_ANALYSIS_DAILY_LIMIT'));
const MAX_REQUESTS_PER_DAY = Number.isFinite(parsedDailyLimit) ? Math.max(0, Math.floor(parsedDailyLimit)) : 20;
const EASTERN_TIME_ZONE = 'America/New_York';

/** YYYY-MM-DD in Eastern time — matches nutrition_logs.log_date. */
function dayKeyEastern(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: EASTERN_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

const SYSTEM_PROMPT = `Analyze the food in this image. Respond with ONLY a raw JSON object — no markdown, no explanation, no code fences.

Format:
{"items":[{"name":"food name","estimated_portion_g":150,"kcal":300,"protein_g":25,"carbs_g":30,"fat_g":8}],"totals":{"kcal":300,"protein_g":25,"carbs_g":30,"fat_g":8}}

Rules:
- List every distinct food or dish you can see
- Estimate portion sizes from visual cues (plate size, utensils, typical servings)
- Use a standard single serving if portion is unclear
- Round all numbers to 1 decimal place
- Return ONLY the JSON object, nothing else`;

function corsHeaders() {
  const origin = Deno.env.get('ALLOWED_ORIGIN')?.trim() || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

type ParsedFoodResult = {
  items: Array<{
    name: string;
    estimated_portion_g: number;
    kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  }>;
  totals: {
    kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  };
};

function toFiniteNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.max(0, n) * 10) / 10;
}

function stripMarkdownFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') {
      depth += 1;
      continue;
    }

    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
}

function tryParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    // Common model issue: trailing commas before ] or }
    const withoutTrailingCommas = text.replace(/,\s*([}\]])/g, '$1');
    try {
      return JSON.parse(withoutTrailingCommas);
    } catch {
      return null;
    }
  }
}

function parseGeminiFoodJson(rawText: string): ParsedFoodResult {
  const trimmed = rawText.trim();
  const fenceStripped = stripMarkdownFences(trimmed);
  const extractedFromTrimmed = extractFirstJsonObject(fenceStripped);
  const extractedFromRaw = extractFirstJsonObject(trimmed);

  const attempts = [trimmed, fenceStripped, extractedFromTrimmed, extractedFromRaw]
    .filter((value): value is string => Boolean(value && value.trim()))
    .map((value) => value.trim())
    .filter((value, idx, arr) => arr.indexOf(value) === idx);

  let parsedUnknown: unknown | null = null;
  for (const attempt of attempts) {
    parsedUnknown = tryParseJson(attempt);
    if (parsedUnknown !== null) break;
  }

  if (!parsedUnknown || typeof parsedUnknown !== 'object') {
    console.error('Gemini returned invalid JSON:', trimmed.slice(0, 500));
    throw new Error('FOOD_ANALYSIS_PARSE_FAILED');
  }

  const parsed = parsedUnknown as Record<string, unknown>;
  const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
  const rawTotals =
    parsed.totals && typeof parsed.totals === 'object'
      ? (parsed.totals as Record<string, unknown>)
      : {};

  const items = rawItems
    .map((item) => (item && typeof item === 'object' ? (item as Record<string, unknown>) : null))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item) => ({
      name: typeof item.name === 'string' ? item.name.trim() : 'Unknown food',
      estimated_portion_g: toFiniteNumber(item.estimated_portion_g),
      kcal: toFiniteNumber(item.kcal),
      protein_g: toFiniteNumber(item.protein_g),
      carbs_g: toFiniteNumber(item.carbs_g),
      fat_g: toFiniteNumber(item.fat_g),
    }))
    .filter((item) => item.name.length > 0);

  const totals = {
    kcal: toFiniteNumber(rawTotals.kcal),
    protein_g: toFiniteNumber(rawTotals.protein_g),
    carbs_g: toFiniteNumber(rawTotals.carbs_g),
    fat_g: toFiniteNumber(rawTotals.fat_g),
  };

  if (items.length === 0) {
    throw new Error('FOOD_ANALYSIS_PARSE_FAILED');
  }

  return { items, totals };
}

function buildGeminiRequestBody(model: string, mimeType: string, imageData: string, maxOutputTokens: number): string {
  const generationConfig: Record<string, unknown> = {
    temperature: 0.1,
    maxOutputTokens,
    responseMimeType: 'application/json',
  };

  // gemini-2.5-* models reason with "thinking" tokens that are drawn from the
  // same output budget. Left on, they consume the whole budget and truncate the
  // JSON mid-object for anything beyond a trivial single item. Disable it so the
  // full budget is available for the actual response. Older fallback models
  // (2.0/1.5) do not support thinkingConfig, so only set it for 2.5.
  if (model.includes('2.5')) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }

  return JSON.stringify({
    contents: [{
      parts: [
        { inline_data: { mime_type: mimeType, data: imageData } },
        { text: SYSTEM_PROMPT },
      ],
    }],
    generationConfig,
  });
}

function collectCandidateText(geminiBody: any): string {
  const parts = geminiBody?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .map((part: any) => (typeof part?.text === 'string' ? part.text : ''))
    .join('\n')
    .trim();
}

function userFacingAnalysisError(err: unknown): { message: string; code: string } {
  const raw = err instanceof Error ? err.message : 'Unknown error';

  if (raw === 'FOOD_ANALYSIS_PARSE_FAILED') {
    return {
      code: 'parse_failed',
      message: 'We could not read the food in this photo. Try a clearer picture with good lighting.',
    };
  }

  return {
    code: 'analysis_failed',
    message: 'Food analysis failed. Please try again in a moment.',
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() });
  }

  try {
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      return Response.json({ error: 'Service not configured' }, { status: 503, headers: corsHeaders() });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return Response.json({ error: 'Missing authorization' }, { status: 401, headers: corsHeaders() });
    }

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const today = dayKeyEastern();

    const body = await req.json();

    const imageData: string = body.image_data;
    const mimeType: string = body.mime_type ?? 'image/jpeg';

    if (!imageData) {
      return Response.json({ error: 'image_data is required' }, { status: 400, headers: corsHeaders() });
    }

    const estimatedBytes = Math.ceil(imageData.length * 0.75);
    if (estimatedBytes > 4 * 1024 * 1024) {
      return Response.json(
        { error: 'Image too large for analysis (max 4 MB). Please use a smaller photo.' },
        { status: 400, headers: corsHeaders() },
      );
    }

    console.log(`Received image: ~${Math.round(estimatedBytes / 1024)} KB, mimeType: ${mimeType}`);

    const imagePath = `inline/${user.id}/${Date.now()}`;
    const { data: requestId, error: reserveError } = await serviceClient.rpc(
      'reserve_food_analysis_request',
      {
        p_user_id: user.id,
        p_log_date: today,
        p_daily_limit: MAX_REQUESTS_PER_DAY,
        p_image_path: imagePath,
      },
    );

    if (reserveError) {
      const code = reserveError.message ?? '';
      if (code.includes('daily_limit_reached')) {
        return Response.json(
          {
            error: `Daily scan limit reached. You can scan up to ${MAX_REQUESTS_PER_DAY} meals per day.`,
            code: 'limit_reached',
            limit: MAX_REQUESTS_PER_DAY,
          },
          { status: 429, headers: corsHeaders() },
        );
      }
      if (code.includes('scan_in_progress')) {
        return Response.json(
          {
            error: 'A scan is already in progress. Please wait a moment and try again.',
            code: 'in_progress',
          },
          { status: 429, headers: corsHeaders() },
        );
      }
      console.error('reserve_food_analysis_request failed:', reserveError.message);
      return Response.json(
        { error: 'Food scan is temporarily unavailable. Please try again.', code: 'unavailable' },
        { status: 503, headers: corsHeaders() },
      );
    }

    if (!requestId) {
      return Response.json({ error: 'Could not create analysis job' }, { status: 500, headers: corsHeaders() });
    }

    try {
      // Call Gemini with model fallback (some keys/endpoints do not expose all model slugs).
      // With thinking disabled, 2048 output tokens comfortably fits a multi-item meal in a
      // single pass; 4096 is a safety net for unusually large plates. Keeping this list short
      // avoids stacking multiple slow vision calls that blow past the client timeout.
      const tokenAttempts = [2048, 4096];
      let parsed: ParsedFoodResult | null = null;
      let modelUsed: string | null = null;
      const modelErrors: string[] = [];
      const parseErrors: string[] = [];

      for (const maxOutputTokens of tokenAttempts) {
        let geminiBody: any = null;
        let modelForThisPass: string | null = null;

        for (const model of GEMINI_MODELS) {
          const requestBody = buildGeminiRequestBody(model, mimeType, imageData, maxOutputTokens);
          const modelUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;
          const geminiResponse = await fetch(modelUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: requestBody,
          });

          if (geminiResponse.ok) {
            geminiBody = await geminiResponse.json();
            modelForThisPass = model;
            break;
          }

          const errText = await geminiResponse.text();
          modelErrors.push(`${model} (tokens=${maxOutputTokens}) -> ${geminiResponse.status}: ${errText}`);
        }

        if (!geminiBody || !modelForThisPass) continue;

        modelUsed = modelForThisPass;
        const finishReason = geminiBody?.candidates?.[0]?.finishReason ?? 'unknown';
        const rawText = collectCandidateText(geminiBody);
        console.log(`Gemini raw response (tokens=${maxOutputTokens}, finish=${finishReason}): ${rawText.slice(0, 300)}`);

        try {
          parsed = parseGeminiFoodJson(rawText);
          break;
        } catch (parseErr) {
          const parseMessage = parseErr instanceof Error ? parseErr.message : 'Unknown parse error';
          parseErrors.push(`tokens=${maxOutputTokens}, finish=${finishReason}, parse=${parseMessage}`);
          // Continue to a larger token budget; many failures are truncation.
          continue;
        }
      }

      if (!parsed || !modelUsed) {
        console.error('Gemini parse failed', { parseErrors, modelErrors });
        throw new Error('FOOD_ANALYSIS_PARSE_FAILED');
      }

      const createdAt = new Date().toISOString();

      await serviceClient
        .from('food_analysis_requests')
        .update({ status: 'complete' })
        .eq('id', requestId);

      // Return analysis inline — nutrition_logs is the durable store after the user confirms.
      return Response.json(
        {
          request_id: requestId,
          id: requestId,
          items: parsed.items,
          totals: parsed.totals,
          model: modelUsed,
          created_at: createdAt,
        },
        { status: 200, headers: corsHeaders() },
      );
    } catch (err) {
      const { message, code } = userFacingAnalysisError(err);
      console.error('Food analysis failed:', err instanceof Error ? err.message : err);
      await serviceClient
        .from('food_analysis_requests')
        .update({ status: 'failed', error: code })
        .eq('id', requestId);

      return Response.json({ error: message, code }, { status: 500, headers: corsHeaders() });
    }
  } catch (err) {
    console.error('Unexpected analyze-food error:', err);
    return Response.json(
      { error: 'Something went wrong. Please try again.', code: 'analysis_failed' },
      { status: 500, headers: corsHeaders() },
    );
  }
});
