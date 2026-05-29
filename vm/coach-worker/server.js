/**
 * Coach worker — pulls advice + template + context-sync jobs from Supabase, runs Ollama.
 * HTTP is health checks only. Phones talk to Supabase, not this service.
 */
const express = require('express');
const { config } = require('./config');
const { listModels } = require('./lib/ollama');
const { rest } = require('./lib/supabase');
const { resetStaleRunning, startPoller } = require('./lib/jobQueue');
const { loadCatalogCached } = require('./coachCatalogCache');
const { processAdviceJob } = require('./jobs/advice');
const { processTemplateProposalJob } = require('./jobs/template');
const { pollContextSync } = require('./jobs/contextSync');

const app = express();

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'coach-worker' });
});

app.get('/health/ollama', async (_req, res) => {
  try {
    const body = await listModels();
    res.json({
      ok: true,
      ollama: config.ollama.host,
      models: body.models?.length ?? 0,
    });
  } catch (error) {
    res.status(502).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Ollama unreachable',
    });
  }
});

function startPullWorkers() {
  const { limits } = config;
  console.log('[coach-worker] pull workers: advice 4s, templates 6s, context 15s');

  startPoller({
    table: 'coach_advice_requests',
    limit: limits.advicePollLimit,
    label: 'advice',
    handler: processAdviceJob,
    intervalMs: limits.advicePollMs,
  });

  startPoller({
    table: 'coach_template_proposals',
    limit: limits.templatePollLimit,
    label: 'template',
    handler: processTemplateProposalJob,
    intervalMs: limits.templatePollMs,
  });

  void pollContextSync();
  setInterval(() => void pollContextSync(), limits.contextSyncPollMs);
}

async function bootstrap() {
  await resetStaleRunning({ table: 'coach_advice_requests', label: 'advice' });
  await resetStaleRunning({ table: 'coach_template_proposals', label: 'template' });

  try {
    const catalog = await loadCatalogCached(rest, { force: true });
    console.log(
      `[coach-worker] catalog warmed (${catalog.count} exercises, ${Object.keys(catalog.byMuscle).length} muscle groups)`,
    );
  } catch (error) {
    console.warn(
      '[coach-worker] catalog warmup failed (will retry per-job):',
      error instanceof Error ? error.message : error,
    );
  }

  startPullWorkers();
}

app.listen(config.port, '0.0.0.0', () => {
  const { ollama, port } = config;
  console.log(
    `[coach-worker] listening on 0.0.0.0:${port} (ollama=${ollama.host}, model=${ollama.model}, num_ctx=${ollama.numCtx})`,
  );
  void bootstrap();
});

process.on('uncaughtException', (error) => {
  console.error('[coach-worker] uncaughtException:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('[coach-worker] unhandledRejection:', reason);
});
