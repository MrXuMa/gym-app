/**
 * Coach worker — pulls advice + template + context-sync jobs from Supabase, runs Ollama.
 * HTTP is health checks only (local monitoring). Phones talk to Supabase, not this service.
 */
const express = require('express');
const { rebuildUserCoachContext } = require('./contextMerge');
const { GENERAL_COACH_KNOWLEDGE, estimateTokens } = require('./coachGeneralKnowledge');
const { sanitizeAdviceSummary } = require('./contextHelpers');
const { buildTemplatePrompt, validateAndResolveDraft } = require('./coachTemplate');
const { loadCatalogCached } = require('./coachCatalogCache');

// ---------- config ----------
const app = express();
const port = Number(process.env.PORT || 8080);
const ollamaHost = (process.env.OLLAMA_HOST || 'http://ollama:11434').replace(/\/$/, '');
const modelName = process.env.MODEL_NAME || 'llama3.1:8b';
const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const MAX_QUESTION_LENGTH = 500;
/** Ollama context window. 8192 fits llama3.1:8b Q4 on 8GB VRAM with room for general + athlete context. */
const coachNumCtx = Number(process.env.COACH_NUM_CTX || 8192);
/** Max tokens for session-plan answers (Focus + exercise list). */
const coachNumPredict = Number(process.env.COACH_NUM_PREDICT || 350);
/** Max tokens for reasoning / education answers (longer explanations). */
const coachNumPredictReasoning = Number(process.env.COACH_NUM_PREDICT_REASONING || 520);

const PLAN_QUESTION_RE =
  /\b(what should i train|what should i hit|what (?:do|should i do) tomorrow|what to (?:do|train)(?:\s+tomorrow|\s+today)?|give me a workout|plan my (?:session|workout)|build me a routine|design a workout|workout for (?:today|tomorrow)|train (?:today|tomorrow)|my next session should)\b/i;

const REASONING_QUESTION_RE =
  /\b(how many|how much|how often|how long|is it optimal|is optimal|should i|why\b|what is the best|what's the best|what are the best|too (?:much|little)|optimal|frequency|per week|weekly|volume|enough sets|explain|compare|versus|vs\.?|better to|difference between|when should i|can i|do i need|recommend|ideal|typical|average|science|research|evidence)\b/i;

/**
 * @returns {'plan' | 'reasoning'}
 */
function classifyAdviceMode(question) {
  const normalized = String(question ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ');

  if (REASONING_QUESTION_RE.test(normalized)) {
    return 'reasoning';
  }

  if (PLAN_QUESTION_RE.test(normalized)) {
    return 'plan';
  }

  // Default to reasoning — avoids dumping a workout template on general questions.
  return 'reasoning';
}

function numPredictForAdviceMode(mode) {
  return mode === 'plan' ? coachNumPredict : coachNumPredictReasoning;
}

// ---------- supabase REST ----------
async function supabaseRest(method, path, { body, prefer } = {}) {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase is not configured on coach-api');
  }

  const headers = {
    apikey: supabaseServiceKey,
    Authorization: `Bearer ${supabaseServiceKey}`,
    'Content-Type': 'application/json',
  };
  if (prefer) headers.Prefer = prefer;

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase ${method} ${path} failed (${response.status}): ${text}`);
  }

  if (response.status === 204) return null;

  const text = await response.text();
  if (!text.trim()) return null;
  return JSON.parse(text);
}

async function supabaseRpc(functionName, args = {}) {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase is not configured on coach-api');
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers: {
      apikey: supabaseServiceKey,
      Authorization: `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase RPC ${functionName} failed (${response.status}): ${text}`);
  }

  const text = await response.text();
  return text.trim() ? JSON.parse(text) : null;
}

// ---------- shared job-row helpers ----------
async function patchJobRow(table, id, patch) {
  const rows = await supabaseRest('PATCH', `${table}?id=eq.${id}`, {
    body: patch,
    prefer: 'return=representation',
  });
  return rows?.[0] ?? null;
}

async function markJobFailed(table, id, error, label) {
  const message = error instanceof Error ? error.message : `${label} failed`;
  console.error(`[coach-worker] ${label} ${id} failed:`, message);
  try {
    await patchJobRow(table, id, {
      status: 'failed',
      error: message,
      completed_at: new Date().toISOString(),
    });
  } catch (patchError) {
    console.error(`[coach-worker] could not mark ${label} ${id} failed:`, patchError);
  }
}

async function pollAndClaimQueue({ table, limit, label, processFn }) {
  try {
    const rows = await supabaseRest(
      'GET',
      `${table}?status=eq.pending&select=id&order=created_at.asc&limit=${limit}`,
    );

    for (const row of rows) {
      try {
        const claimed = await supabaseRest(
          'PATCH',
          `${table}?id=eq.${row.id}&status=eq.pending`,
          { body: { status: 'running' }, prefer: 'return=representation' },
        );
        if (claimed?.[0]) {
          console.log(`[coach-worker] processing ${label} ${row.id}`);
          await processFn(row.id);
        }
      } catch (jobError) {
        console.error(`[coach-worker] ${label} ${row.id} failed:`, jobError);
      }
    }
  } catch (error) {
    console.error(
      `[coach-worker] ${label} poll error:`,
      error instanceof Error ? error.message : error,
    );
  }
}

async function recoverStaleRunning({ table, label }) {
  try {
    const rows = await supabaseRest(
      'GET',
      `${table}?status=eq.running&select=id&order=created_at.asc`,
    );
    for (const row of rows) {
      await patchJobRow(table, row.id, { status: 'pending' });
      console.log(`[coach-worker] reset stale ${label} ${row.id} → pending`);
    }
  } catch (error) {
    console.error(
      `[coach-worker] could not recover stale ${label}:`,
      error instanceof Error ? error.message : error,
    );
  }
}

// ---------- coach context ----------
async function readCoachContext(userId) {
  const rows = await supabaseRest(
    'GET',
    `coach_context?user_id=eq.${userId}&select=context&limit=1`,
  );
  if (rows[0]?.context) {
    return rows[0].context;
  }

  throw new Error(
    'No coach context in Supabase. Complete a workout (or wait for context sync) so your training summary can be built.',
  );
}

// ---------- advice prompt ----------
const { formatWeeklySplitBlock } = require('./trainingSplit');

const PUSH_MUSCLES = new Set(['chest', 'shoulders', 'triceps']);
const PULL_MUSCLES = new Set(['back', 'biceps', 'rear delts', 'grip', 'traps', 'grip / traps']);
const LEG_MUSCLES = new Set(['quads', 'hamstrings', 'glutes', 'calves', 'legs']);

function pplBucket(muscle) {
  const key = muscle?.toLowerCase().trim();
  if (!key) return null;
  if (PUSH_MUSCLES.has(key)) return 'Push';
  if (PULL_MUSCLES.has(key)) return 'Pull';
  if (LEG_MUSCLES.has(key)) return 'Legs';
  return null;
}

/**
 * Convert deterministic training_signals into a plain-text block the LLM
 * cannot miss — listed AS A HARD CONSTRAINT above the JSON dump because the
 * 8B model otherwise buries its head in the JSON and ignores the avoid list.
 */
function formatSchedulingSignals(signals) {
  if (!signals) return '';

  const window = signals.recovery_window_hours ?? 48;
  const avoid = Array.isArray(signals.muscles_recently_trained_avoid)
    ? signals.muscles_recently_trained_avoid
    : [];
  const ready = Array.isArray(signals.muscles_ready_for_training)
    ? signals.muscles_ready_for_training
    : [];

  const lastSession = signals.last_session;
  const lastLine = lastSession
    ? `Most recent session (${signals.days_since_last_workout ?? '?'}d ago): "${lastSession.title ?? 'untitled'}" hit ${lastSession.muscle_groups?.length ? lastSession.muscle_groups.join(', ') : 'no tracked muscles'}.`
    : 'No prior sessions logged.';

  const avoidLine = avoid.length
    ? avoid
        .map((m) => `${m.muscle} (${m.hours_since_last_session}h ago)`)
        .join('; ')
    : 'none';
  const readyLine = ready.length
    ? ready
        .map(
          (m) =>
            `${m.muscle} (${m.days_since_last_session}d since last hit, ${m.sessions_last_7d}× last 7d)`,
        )
        .join('; ')
    : 'none — fall back to push/pull/legs based on last session';

  // Bucket avoid/ready into push/pull/legs for an explicit P/P/L recommendation.
  const buckets = { Push: { avoid: [], ready: [] }, Pull: { avoid: [], ready: [] }, Legs: { avoid: [], ready: [] } };
  for (const m of avoid) {
    const b = pplBucket(m.muscle);
    if (b) buckets[b].avoid.push(m.muscle);
  }
  for (const m of ready) {
    const b = pplBucket(m.muscle);
    if (b) buckets[b].ready.push(m.muscle);
  }

  const pplLines = ['Push', 'Pull', 'Legs'].map((cat) => {
    const { avoid: a, ready: r } = buckets[cat];
    if (a.length && !r.length) return `- ${cat}: AVOID (recently trained: ${a.join(', ')})`;
    if (!a.length && r.length) return `- ${cat}: READY (${r.join(', ')})`;
    if (a.length && r.length) return `- ${cat}: PARTIAL — avoid ${a.join(', ')}; ${r.join(', ')} still ready`;
    return `- ${cat}: no data`;
  });

  const recommendation = (() => {
    const fullyReady = ['Push', 'Pull', 'Legs'].filter(
      (c) => buckets[c].ready.length > 0 && buckets[c].avoid.length === 0,
    );
    const fullyAvoid = ['Push', 'Pull', 'Legs'].filter(
      (c) => buckets[c].avoid.length > 0 && buckets[c].ready.length === 0,
    );
    if (fullyReady.length > 0) {
      return `Pick from: ${fullyReady.join(' or ')}. Do NOT pick: ${fullyAvoid.join(', ') || 'n/a'}.`;
    }
    return 'No fully ready P/P/L category — pick the one with the most ready muscles and skip any recently-trained muscles within it.';
  })();

  return `
SCHEDULING SIGNALS (deterministic; computed from training logs — these override any general guidance):
- ${lastLine}
- DO NOT TRAIN tomorrow (trained <${window}h ago): ${avoidLine}.
- READY to train (≥${window}h since last hit; prioritize lowest sessions_last_7d): ${readyLine}.
- Push/Pull/Legs status:
${pplLines.join('\n')}
- Recommendation: ${recommendation}
- Programming hint: ${signals.programming_hint ?? 'n/a'}.
`;
}

function buildPrompt(context, question, catalog, mode = classifyAdviceMode(question)) {
  const name = context.profile?.display_name ?? 'Athlete';
  const summaries = Array.isArray(context.response_summaries)
    ? context.response_summaries.slice(0, 15)
    : Array.isArray(context.coach_notes)
      ? context.coach_notes.slice(0, 15)
      : [];

  const loggedPerformance = Array.isArray(context.logged_performance)
    ? context.logged_performance
    : (context.recent_sessions ?? []).flatMap((session) => session.top_sets ?? []);

  const promptContext = {
    units: context.units ?? { weight: 'lbs' },
    profile: context.profile,
    rolling_metrics: context.rolling_metrics,
    training_signals: context.training_signals ?? null,
    training_split: context.training_split ?? null,
    logged_performance: loggedPerformance,
    logged_exercise_names: Array.isArray(context.logged_exercise_names)
      ? context.logged_exercise_names
      : loggedPerformance.map((entry) => entry.exercise).filter(Boolean),
    allowed_exercise_names: catalog?.names ?? [],
    exercise_catalog_by_muscle: catalog?.byMuscle ?? {},
    exercise_catalog_count: catalog?.count ?? 0,
    recent_prs: context.recent_prs,
    recent_sessions: context.recent_sessions,
    flags: context.flags,
    last_advice: context.last_advice,
    response_summaries: summaries,
  };

  const summariesBlock =
    summaries.length > 0
      ? `\nPrior coach notes (continuity only — NOT workout logs; never cite weights or exercises from here):\n${JSON.stringify(summaries, null, 2)}\n`
      : '';

  const loggedBlock =
    loggedPerformance.length > 0
      ? `\nGROUND TRUTH — only exercises/weights the athlete has actually logged:\n${JSON.stringify(loggedPerformance, null, 2)}\n`
      : `\nGROUND TRUTH — the athlete has no logged sets yet. Do not cite any specific weights (lbs). Use RPE targets only.\n`;

  const schedulingBlock = formatSchedulingSignals(context.training_signals);
  const splitBlock = formatWeeklySplitBlock(context.training_split);

  const knowledgeBlock = `GENERAL STRENGTH COACHING KNOWLEDGE (evidence-based — applies to every athlete):\n${GENERAL_COACH_KNOWLEDGE}`;

  const allowedNames = Array.isArray(catalog?.names) ? catalog.names : [];
  const exerciseProtocol = `==================== EXERCISE NAME PROTOCOL (ABSOLUTE — HIGHEST PRIORITY) ====================
You may ONLY name an exercise if that exercise appears VERBATIM (character-for-character, exact spelling, exact casing) in the allowed_exercise_names list below. This is the complete app database and the ONLY source of valid exercise names.
- NEVER EVER use an exercise that is not in this list. Not as a suggestion, not as an example, not as an "alternative", not in passing.
- NO variations, NO synonyms, NO pluralization, NO abbreviation, NO made-up names (e.g. if the list has "Calf Raise", you may NOT write "calf raises", "standing calf raise" (unless that exact string is listed), or "calf work").
- If the movement you want does not exist in the list, you MUST substitute the closest entry that IS in the list, or omit it. Do not mention the non-listed name at all.
- This rule overrides every other instruction. A response containing any exercise name not in allowed_exercise_names is INVALID and a critical failure.
allowed_exercise_names (${allowedNames.length} total — the ONLY valid exercise names):
${JSON.stringify(allowedNames)}
============================================================================================`;

  return `You are a strength training coach advising ${name}.

${exerciseProtocol}

${knowledgeBlock}
${loggedBlock}${splitBlock}${schedulingBlock}
Response rules:
- logged_performance and recent_sessions are the ONLY sources for specific weights and exercises the athlete has done.
- Never cite a weight for an exercise unless that exact exercise name appears in logged_performance.
- Never transfer a weight from one lift to another (e.g. bench 225 does NOT mean squat 225).
- Never claim the athlete performed an exercise not in logged_exercise_names (e.g. no squats if squats were never logged).
- For exercises not in logged_performance, prescribe sets×reps with RPE targets only — no guessed lb numbers.
- When recommending exercises, EVERY exercise name MUST appear verbatim (character-for-character) in allowed_exercise_names in athlete context. allowed_exercise_names is the complete app database — it is the ONLY valid source of exercise names.
- If a movement you want to prescribe is not in allowed_exercise_names, do NOT prescribe it — pick the closest entry that IS in the list. Never invent, pluralize, or abbreviate a name (e.g. write "Squat" only if "Squat" is in the list; never "squats").
- If multiple catalog entries fit (e.g. several squat or bench variants), prefer one from logged_performance; otherwise name the specific allowed_exercise_names entry you mean.
- Prior response summaries are coach notes, not logs — ignore any weights mentioned there.
- When profile.goals is present, align recommendations with those goals.
- profile.weight_trend reflects body weight change over the last ~90 days ('gaining' / 'losing' / 'maintaining' / 'unknown'). Cross-check against goals before recommending a cut/bulk — e.g. if the goal is muscle gain but weight_trend is 'losing', note the mismatch and suggest a calorie adjustment.
- **HARD CONSTRAINT — scheduling questions ("what should I train tomorrow / today / next session"):** Follow the USER WEEKLY TRAINING SPLIT block first — prescribe the muscles scheduled for that day (today or tomorrow as asked). You MUST NOT target muscle groups listed under "DO NOT TRAIN tomorrow" in SCHEDULING SIGNALS; if a scheduled muscle is on cooldown, say so and suggest the next split day whose muscles are ready (or ready subsets). P/P/L READY/Avoid in SCHEDULING SIGNALS is secondary recovery guidance only — never override the athlete's weekly split with a different pattern (e.g. "train chest every other day"). Stating "train chest" the day after a chest session when chest is not on today's/tomorrow's split is a critical error.
- If recommending a new exercise they have never logged, mention briefly that it is a fresh suggestion (no prior load on file).
- Stay on training and recovery only.

RESPONSE MODE FOR THIS QUESTION: ${mode.toUpperCase()}
${mode === 'plan' ? buildPlanFormatInstructions() : buildReasoningFormatInstructions()}
${summariesBlock}
Athlete context (JSON):
${JSON.stringify(promptContext, null, 2)}

Athlete question:
${question}

REMINDER BEFORE YOU WRITE: every exercise you name must be copied verbatim from allowed_exercise_names. If it is not in that list, do not write it. No exceptions.

Coach advice:`;
}

function buildReasoningFormatInstructions() {
  return `
REASONING FORMAT (mandatory for this question — do NOT output a workout template):
- This is an educational / analytical question. Answer with clear reasoning, not a session prescription.
- Do NOT use a "Focus:" line. Do NOT list a full workout (no 4–6 exercise bullet prescription).
- You MAY mention 1–2 example exercise names from allowed_exercise_names only if it clarifies a point — not as a workout plan.
- Structure: (1) direct answer in the first 1–2 sentences, (2) brief why/evidence from general coaching knowledge and their logs when relevant, (3) optional 2–4 bullet takeaways.
- Cover tradeoffs when useful (e.g. frequency vs recovery, volume landmarks, beginner vs intermediate).
- Max ~280 words. Plain prose and simple bullets only — no markdown tables, no bold headers, no emojis.
- Examples of REASONING questions: "how many workouts for quads", "is 20 sets too much", "should I train legs twice a week", "why am I stalling", "what is optimal frequency".
- Example — Q: "How many quad workouts per week is optimal?" → Explain 2×/week vs 1×/week for most lifters, volume landmarks (~10–20 hard sets/week), recovery 48–72h, tie to their recent leg frequency if in context — do NOT output a workout list.
`;
}

function buildPlanFormatInstructions() {
  return `
PLAN FORMAT (mandatory for this question — short session prescription, minimal essay):
- The athlete asked what to train / for a workout plan. Output EXACTLY this shape:
  Line 1: "**Focus: <Push|Pull|Legs> — <one-line label>**"
  Lines 2–7: "- <Exact name from allowed_exercise_names> — <sets>×<reps> @ RPE <n>" (use "@ <weight>lb" only if that exact name appears in logged_performance)
  Optional final line: one short sentence (≤20 words) tying to recovery or goals.
- Max ~180 words. No long paragraphs. No "how/why" lecture — they want the plan.
`;
}

function logPromptBudget(prompt, mode) {
  const generalTokens = estimateTokens(GENERAL_COACH_KNOWLEDGE);
  const totalTokens = estimateTokens(prompt);
  console.log(
    `[coach-worker] prompt budget ~${totalTokens} tokens (general ~${generalTokens}, mode=${mode}, num_predict=${numPredictForAdviceMode(mode)}, num_ctx=${coachNumCtx})`,
  );
}

// ---------- ollama ----------
async function callOllama(prompt, { temperature = 0.25, numPredict = coachNumPredict } = {}) {
  const response = await fetch(`${ollamaHost}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelName,
      prompt,
      stream: false,
      options: { temperature, num_predict: numPredict, num_ctx: coachNumCtx },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ollama returned ${response.status}: ${text}`);
  }

  const body = await response.json();
  const text = (body.response || '').trim();
  if (!text) throw new Error('Ollama returned an empty response');
  return text;
}

// ---------- advice flow ----------
function normalizeOneSentenceSummary(text) {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';

  const firstSentence = cleaned.split(/(?<=[.!?])\s+/)[0]?.trim() ?? cleaned;
  return firstSentence.length > 400
    ? `${firstSentence.slice(0, 397).trimEnd()}...`
    : firstSentence;
}

async function summarizeAdvice(question, advice) {
  const prompt = `Write exactly one sentence summarizing the coach advice below for future training context.
Rules:
- One sentence only. No bullet points or labels.
- Qualitative focus only: session type, strategy, or emphasis.
- Do NOT include any numbers (no weights, reps, sets, RPE values, or percentages).
- Do not repeat the question verbatim.

Athlete question:
${question}

Coach advice:
${advice}

One-sentence summary:`;

  try {
    const raw = await callOllama(prompt, { temperature: 0.15, numPredict: 100 });
    const summary = sanitizeAdviceSummary(normalizeOneSentenceSummary(raw));
    if (summary) return summary;
  } catch (error) {
    console.warn(
      '[coach-worker] LLM summary failed, using truncated fallback:',
      error instanceof Error ? error.message : error,
    );
  }

  return sanitizeAdviceSummary(normalizeOneSentenceSummary(advice.slice(0, 400)));
}

async function recordCoachAdviceInContext(adviceId, summary) {
  try {
    const args = { p_advice_id: adviceId };
    if (summary) args.p_summary = summary;

    await supabaseRpc('record_coach_advice_in_context', args);
    console.log(
      `[coach-worker] advice ${adviceId} summary recorded in coach_context` +
        (summary ? `: ${summary}` : ''),
    );
  } catch (error) {
    console.error(
      `[coach-worker] record_coach_advice_in_context failed for ${adviceId}:`,
      error instanceof Error ? error.message : error,
    );
  }
}

async function processAdviceJob(requestId) {
  try {
    const rows = await supabaseRest(
      'GET',
      `coach_advice_requests?id=eq.${requestId}&select=*&limit=1`,
    );
    const row = rows[0];
    if (!row || row.status === 'completed' || row.status === 'failed') return;

    if (row.question.length > MAX_QUESTION_LENGTH) {
      throw new Error(`Question exceeds ${MAX_QUESTION_LENGTH} characters`);
    }

    if (row.status === 'pending') {
      await patchJobRow('coach_advice_requests', requestId, { status: 'running' });
    }

    const [context, catalog] = await Promise.all([
      readCoachContext(row.user_id),
      loadCatalogCached(supabaseRest),
    ]);

    const adviceMode = classifyAdviceMode(row.question);
    const prompt = buildPrompt(context, row.question, catalog, adviceMode);
    logPromptBudget(prompt, adviceMode);

    const advice = await callOllama(prompt, {
      numPredict: numPredictForAdviceMode(adviceMode),
    });
    const summary = await summarizeAdvice(row.question, advice);

    await patchJobRow('coach_advice_requests', requestId, {
      status: 'completed',
      response: advice,
      error: null,
      completed_at: new Date().toISOString(),
    });

    console.log(`[coach-worker] advice ${requestId} LLM summary: ${summary}`);
    await recordCoachAdviceInContext(requestId, summary);
  } catch (error) {
    await markJobFailed('coach_advice_requests', requestId, error, 'advice job');
  }
}

// ---------- template proposal flow ----------
async function processTemplateProposalJob(proposalId) {
  try {
    const rows = await supabaseRest(
      'GET',
      `coach_template_proposals?id=eq.${proposalId}&select=*&limit=1`,
    );
    const proposal = rows[0];
    if (!proposal || proposal.status === 'completed' || proposal.status === 'failed') return;

    const adviceRows = await supabaseRest(
      'GET',
      `coach_advice_requests?id=eq.${proposal.advice_id}&select=*&limit=1`,
    );
    const advice = adviceRows[0];
    if (!advice?.response) {
      throw new Error('Linked coach advice is missing a response');
    }

    if (proposal.status === 'pending') {
      await patchJobRow('coach_template_proposals', proposalId, { status: 'running' });
    }

    const [context, catalog] = await Promise.all([
      readCoachContext(proposal.user_id),
      loadCatalogCached(supabaseRest),
    ]);

    const prompt = buildTemplatePrompt(context, advice.question, advice.response, catalog);
    const raw = await callOllama(prompt, { temperature: 0.1, numPredict: 900 });
    const draft = validateAndResolveDraft(raw, catalog.rows, context.logged_performance);

    await patchJobRow('coach_template_proposals', proposalId, {
      status: 'completed',
      template_draft: draft,
      error: null,
      completed_at: new Date().toISOString(),
    });

    console.log(
      `[coach-worker] template proposal ${proposalId} ready (${draft.exercises.length} exercises)`,
    );
  } catch (error) {
    await markJobFailed('coach_template_proposals', proposalId, error, 'template proposal');
  }
}

// ---------- context sync flow ----------
async function pollSupabaseContextSync() {
  try {
    const rows = await supabaseRest(
      'GET',
      'coach_user_sync_state?needs_sync=eq.true&select=user_id&order=sync_requested_at.asc&limit=3',
    );

    for (const row of rows) {
      try {
        const result = await rebuildUserCoachContext(row.user_id, supabaseRest);
        await supabaseRest('PATCH', `coach_user_sync_state?user_id=eq.${row.user_id}`, {
          body: { needs_sync: false },
        });
        console.log(
          `[coach-worker] context rebuilt user=${row.user_id} sessions=${result.sessionCount}`,
        );
      } catch (syncError) {
        console.error(
          `[coach-worker] context rebuild failed user=${row.user_id}:`,
          syncError instanceof Error ? syncError.message : syncError,
        );
      }
    }
  } catch (error) {
    console.error(
      '[coach-worker] context sync poll error:',
      error instanceof Error ? error.message : error,
    );
  }
}

// ---------- pull workers ----------
const ADVICE_QUEUE = {
  table: 'coach_advice_requests',
  limit: 3,
  label: 'advice job',
  processFn: processAdviceJob,
};
const TEMPLATE_QUEUE = {
  table: 'coach_template_proposals',
  limit: 2,
  label: 'template proposal',
  processFn: processTemplateProposalJob,
};

function startSupabasePullWorkers() {
  console.log(
    '[coach-worker] Supabase pull workers enabled (advice 4s, templates 6s, context 15s)',
  );
  void pollAndClaimQueue(ADVICE_QUEUE);
  void pollAndClaimQueue(TEMPLATE_QUEUE);
  void pollSupabaseContextSync();

  setInterval(() => void pollAndClaimQueue(ADVICE_QUEUE), 4000);
  setInterval(() => void pollAndClaimQueue(TEMPLATE_QUEUE), 6000);
  setInterval(() => void pollSupabaseContextSync(), 15000);
}

// ---------- HTTP ----------
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'coach-worker' });
});

app.get('/health/ollama', async (_req, res) => {
  try {
    const response = await fetch(`${ollamaHost}/api/tags`);
    if (!response.ok) {
      res.status(502).json({ ok: false, error: `Ollama returned ${response.status}` });
      return;
    }
    const body = await response.json();
    res.json({ ok: true, ollama: ollamaHost, models: body.models?.length ?? 0 });
  } catch (error) {
    res.status(502).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Ollama unreachable',
    });
  }
});

// ---------- bootstrap ----------
async function start() {
  await recoverStaleRunning({ table: 'coach_advice_requests', label: 'advice job' });
  await recoverStaleRunning({ table: 'coach_template_proposals', label: 'template proposal' });

  try {
    const catalog = await loadCatalogCached(supabaseRest, { force: true });
    console.log(
      `[coach-worker] catalog cache warmed (${catalog.count} exercises, ${Object.keys(catalog.byMuscle).length} muscle groups)`,
    );
  } catch (error) {
    console.warn(
      '[coach-worker] catalog warmup failed (will retry per-job):',
      error instanceof Error ? error.message : error,
    );
  }

  startSupabasePullWorkers();
}

app.listen(port, '0.0.0.0', () => {
  console.log(
    `[coach-worker] listening on 0.0.0.0:${port} (ollama=${ollamaHost}, model=${modelName}, num_ctx=${coachNumCtx})`,
  );
  void start();
});

process.on('uncaughtException', (error) => {
  console.error('[coach-worker] uncaughtException:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('[coach-worker] unhandledRejection:', reason);
});
