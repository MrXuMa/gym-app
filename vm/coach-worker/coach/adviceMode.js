const { config } = require('../config');

const PLAN_QUESTION_RE =
  /\b(what should i (?:train|hit|do)|what (?:do|should i do)(?: today| tomorrow)?|what to (?:do|train)(?:\s+tomorrow|\s+today)?|workout for (?:today|tomorrow|me|the day)|train (?:today|tomorrow)|my next (?:session|workout)|my (?:workout|session|routine) for (?:today|tomorrow))\b/i;

// "create/make/build ... [a leg] workout" — a workout-building verb followed,
// within a short window, by a session noun.
const PLAN_REQUEST_RE =
  /\b(?:create|make|build|design|generate|give me|plan|put together|write)\b[^.?!]{0,40}\b(?:workout|session|routine|training|lift day|leg day|push day|pull day|upper day|lower day)\b/i;

const REASONING_QUESTION_RE =
  /\b(how many|how much|how often|how long|is it optimal|is optimal|should i|why\b|what is the best|what's the best|what are the best|too (?:much|little)|optimal|frequency|per week|weekly|volume|enough sets|explain|compare|versus|vs\.?|better to|difference between|when should i|can i|do i need|recommend|ideal|typical|average|science|research|evidence)\b/i;

function classifyAdviceMode(question, { wantsTemplate = false } = {}) {
  // When the user explicitly flips the "Template Generator" toggle, they want a
  // concrete session prescription — skip heuristics and force plan mode.
  if (wantsTemplate) return 'plan';

  const normalized = String(question ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ');

  // Explicit "give me a workout / what should I train" requests win, even though
  // they may also contain a reasoning trigger like "should i".
  if (PLAN_QUESTION_RE.test(normalized) || PLAN_REQUEST_RE.test(normalized)) return 'plan';
  if (REASONING_QUESTION_RE.test(normalized)) return 'reasoning';
  return 'reasoning';
}

function numPredictForMode(mode) {
  const { numPredictPlan, numPredictReasoning } = config.ollama;
  return mode === 'plan' ? numPredictPlan : numPredictReasoning;
}

module.exports = { classifyAdviceMode, numPredictForMode };
