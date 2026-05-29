const { config } = require('../config');

const PLAN_QUESTION_RE =
  /\b(what should i train|what should i hit|what (?:do|should i do) tomorrow|what to (?:do|train)(?:\s+tomorrow|\s+today)?|give me a workout|plan my (?:session|workout)|build me a routine|design a workout|workout for (?:today|tomorrow)|train (?:today|tomorrow)|my next session should)\b/i;

const REASONING_QUESTION_RE =
  /\b(how many|how much|how often|how long|is it optimal|is optimal|should i|why\b|what is the best|what's the best|what are the best|too (?:much|little)|optimal|frequency|per week|weekly|volume|enough sets|explain|compare|versus|vs\.?|better to|difference between|when should i|can i|do i need|recommend|ideal|typical|average|science|research|evidence)\b/i;

function classifyAdviceMode(question) {
  const normalized = String(question ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ');

  // Explicit "give me a workout / what should I train" requests win, even though
  // they may also contain a reasoning trigger like "should i".
  if (PLAN_QUESTION_RE.test(normalized)) return 'plan';
  if (REASONING_QUESTION_RE.test(normalized)) return 'reasoning';
  return 'reasoning';
}

function numPredictForMode(mode) {
  const { numPredictPlan, numPredictReasoning } = config.ollama;
  return mode === 'plan' ? numPredictPlan : numPredictReasoning;
}

module.exports = { classifyAdviceMode, numPredictForMode };
