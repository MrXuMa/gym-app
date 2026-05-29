/**
 * Central configuration — read process.env once at startup.
 */

function envInt(key, fallback) {
  const n = Number(process.env[key]);
  return Number.isFinite(n) ? n : fallback;
}

const config = Object.freeze({
  port: envInt('PORT', 8080),
  ollama: {
    host: (process.env.OLLAMA_HOST || 'http://ollama:11434').replace(/\/$/, ''),
    model: process.env.MODEL_NAME || 'llama3.1:8b',
    numCtx: envInt('COACH_NUM_CTX', 8192),
    numPredictPlan: envInt('COACH_NUM_PREDICT', 350),
    numPredictReasoning: envInt('COACH_NUM_PREDICT_REASONING', 520),
    temperatureDefault: 0.25,
    temperatureTemplate: 0.1,
    temperatureSummary: 0.15,
    numPredictTemplate: 900,
    numPredictSummary: 100,
  },
  supabase: {
    url: (process.env.SUPABASE_URL || '').replace(/\/$/, ''),
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },
  limits: {
    maxQuestionLength: 500,
    advicePollLimit: 3,
    templatePollLimit: 2,
    contextSyncPollLimit: 3,
    advicePollMs: 4000,
    templatePollMs: 6000,
    contextSyncPollMs: 15000,
  },
});

function assertSupabaseConfigured() {
  if (!config.supabase.url || !config.supabase.serviceKey) {
    throw new Error('Supabase is not configured on coach-worker');
  }
}

module.exports = { config, assertSupabaseConfigured };
