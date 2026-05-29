const { config } = require('../config');

async function generate(prompt, { temperature, numPredict } = {}) {
  const response = await fetch(`${config.ollama.host}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.ollama.model,
      prompt,
      stream: false,
      options: {
        temperature: temperature ?? config.ollama.temperatureDefault,
        num_predict: numPredict ?? config.ollama.numPredictPlan,
        num_ctx: config.ollama.numCtx,
      },
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

async function listModels() {
  const response = await fetch(`${config.ollama.host}/api/tags`);
  if (!response.ok) {
    throw new Error(`Ollama returned ${response.status}`);
  }
  return response.json();
}

module.exports = { generate, listModels };
