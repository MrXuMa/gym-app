const { config } = require('../config');
const { rest } = require('../lib/supabase');
const { generate } = require('../lib/ollama');
const { patchRow, markFailed } = require('../lib/jobQueue');
const { loadCatalogCached } = require('../coachCatalogCache');
const { buildTemplatePrompt, validateAndResolveDraft } = require('../coachTemplate');
const { parseRequestSpec } = require('../coach/templateSpec');
const { readCoachContext } = require('./readContext');

const MAX_TEMPLATE_ATTEMPTS = 3;

/** Latest previously-generated template for this user, for "same workout but…" requests. */
async function fetchPreviousTemplate(userId, currentProposalId) {
  try {
    const rows = await rest(
      'GET',
      `coach_template_proposals?user_id=eq.${userId}&status=eq.completed&id=neq.${currentProposalId}&template_draft=not.is.null&select=template_draft&order=created_at.desc&limit=1`,
    );
    return rows[0]?.template_draft ?? null;
  } catch {
    return null;
  }
}

async function processTemplateProposalJob(proposalId) {
  try {
    const rows = await rest(
      'GET',
      `coach_template_proposals?id=eq.${proposalId}&select=*&limit=1`,
    );
    const proposal = rows[0];
    if (!proposal || proposal.status === 'completed' || proposal.status === 'failed') return;

    const adviceRows = await rest(
      'GET',
      `coach_advice_requests?id=eq.${proposal.advice_id}&select=*&limit=1`,
    );
    const advice = adviceRows[0];
    if (!advice?.response) {
      throw new Error('Linked coach advice is missing a response');
    }

    if (proposal.status === 'pending') {
      await patchRow('coach_template_proposals', proposalId, { status: 'running' });
    }

    const [context, catalog, previousTemplate] = await Promise.all([
      readCoachContext(proposal.user_id),
      loadCatalogCached(rest),
      fetchPreviousTemplate(proposal.user_id, proposalId),
    ]);

    const spec = parseRequestSpec(advice.question, advice.response, context);
    console.log(
      `[coach-worker] template ${proposalId} spec: muscles=[${spec.targetMuscles.join(', ') || 'open'}] (${spec.source}), intensity=${spec.intensity}, count=${spec.count.min}-${spec.count.max}, modify=${spec.isModification}`,
    );

    let draft = null;
    let correction = null;
    let lastError = null;

    for (let attempt = 1; attempt <= MAX_TEMPLATE_ATTEMPTS; attempt += 1) {
      const prompt = buildTemplatePrompt(context, advice.question, advice.response, catalog, spec, {
        previousTemplate,
        correction,
      });
      const raw = await generate(prompt, {
        temperature: config.ollama.temperatureTemplate,
        numPredict: config.ollama.numPredictTemplate,
      });

      try {
        draft = validateAndResolveDraft(raw, catalog.rows, context.logged_performance, spec);
        break;
      } catch (err) {
        lastError = err;
        correction = err.correction || err.message;
        console.warn(
          `[coach-worker] template ${proposalId} attempt ${attempt}/${MAX_TEMPLATE_ATTEMPTS} rejected: ${correction}`,
        );
      }
    }

    if (!draft) {
      throw lastError ?? new Error('Template generation failed after retries');
    }

    await patchRow('coach_template_proposals', proposalId, {
      status: 'completed',
      template_draft: draft,
      error: null,
      completed_at: new Date().toISOString(),
    });

    console.log(
      `[coach-worker] template ${proposalId} ready (${draft.exercises.length} exercises, target=[${spec.targetMuscles.join(', ') || 'open'}])`,
    );
  } catch (error) {
    await markFailed('coach_template_proposals', proposalId, error, 'template');
  }
}

module.exports = { processTemplateProposalJob };
