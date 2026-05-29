const { config } = require('../config');
const { rest } = require('../lib/supabase');
const { generate } = require('../lib/ollama');
const { patchRow, markFailed } = require('../lib/jobQueue');
const { loadCatalogCached } = require('../coachCatalogCache');
const { buildTemplatePrompt, validateAndResolveDraft } = require('../coachTemplate');
const { readCoachContext } = require('./readContext');

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

    const [context, catalog] = await Promise.all([
      readCoachContext(proposal.user_id),
      loadCatalogCached(rest),
    ]);

    const prompt = buildTemplatePrompt(context, advice.question, advice.response, catalog);
    const raw = await generate(prompt, {
      temperature: config.ollama.temperatureTemplate,
      numPredict: config.ollama.numPredictTemplate,
    });
    const draft = validateAndResolveDraft(raw, catalog.rows, context.logged_performance);

    await patchRow('coach_template_proposals', proposalId, {
      status: 'completed',
      template_draft: draft,
      error: null,
      completed_at: new Date().toISOString(),
    });

    console.log(
      `[coach-worker] template ${proposalId} ready (${draft.exercises.length} exercises)`,
    );
  } catch (error) {
    await markFailed('coach_template_proposals', proposalId, error, 'template');
  }
}

module.exports = { processTemplateProposalJob };
