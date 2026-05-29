const { config } = require('../config');
const { rest, rpc } = require('../lib/supabase');
const { generate } = require('../lib/ollama');
const { patchRow, markFailed } = require('../lib/jobQueue');
const { loadCatalogCached } = require('../coachCatalogCache');
const { buildCompactPrompt } = require('../coach/prompt');
const { classifyAdviceMode, numPredictForMode } = require('../coach/adviceMode');
const { COACH_PRINCIPLES_COMPACT, estimateTokens } = require('../coach/knowledge');
const { sanitizeAdviceSummary } = require('../context/memory');
const { readCoachContext } = require('./readContext');

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
    const raw = await generate(prompt, {
      temperature: config.ollama.temperatureSummary,
      numPredict: config.ollama.numPredictSummary,
    });
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
    await rpc('record_coach_advice_in_context', args);
    console.log(
      `[coach-worker] advice ${adviceId} summary recorded` + (summary ? `: ${summary}` : ''),
    );
  } catch (error) {
    console.error(
      `[coach-worker] record_coach_advice_in_context failed for ${adviceId}:`,
      error instanceof Error ? error.message : error,
    );
  }
}

function logPromptBudget(prompt, mode) {
  const generalTokens = estimateTokens(COACH_PRINCIPLES_COMPACT);
  const totalTokens = estimateTokens(prompt);
  console.log(
    `[coach-worker] prompt ~${totalTokens} tokens (general ~${generalTokens}, mode=${mode}, num_predict=${numPredictForMode(mode)}, num_ctx=${config.ollama.numCtx})`,
  );
}

async function processAdviceJob(requestId) {
  try {
    const rows = await rest(
      'GET',
      `coach_advice_requests?id=eq.${requestId}&select=*&limit=1`,
    );
    const row = rows[0];
    if (!row || row.status === 'completed' || row.status === 'failed') return;

    if (row.question.length > config.limits.maxQuestionLength) {
      throw new Error(`Question exceeds ${config.limits.maxQuestionLength} characters`);
    }

    if (row.status === 'pending') {
      await patchRow('coach_advice_requests', requestId, { status: 'running' });
    }

    const [context, catalog] = await Promise.all([
      readCoachContext(row.user_id),
      loadCatalogCached(rest),
    ]);

    const mode = classifyAdviceMode(row.question, { wantsTemplate: row.wants_template === true });
    const prompt = buildCompactPrompt(context, row.question, catalog, mode);
    logPromptBudget(prompt, mode);

    const advice = await generate(prompt, { numPredict: numPredictForMode(mode) });
    const summary = await summarizeAdvice(row.question, advice);

    await patchRow('coach_advice_requests', requestId, {
      status: 'completed',
      response: advice,
      error: null,
      completed_at: new Date().toISOString(),
    });

    console.log(`[coach-worker] advice ${requestId} done — summary: ${summary}`);
    await recordCoachAdviceInContext(requestId, summary);
  } catch (error) {
    await markFailed('coach_advice_requests', requestId, error, 'advice');
  }
}

module.exports = { processAdviceJob };
