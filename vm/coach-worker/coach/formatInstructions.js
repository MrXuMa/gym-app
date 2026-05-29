function buildReasoningFormatInstructions() {
  return `
REASONING FORMAT (mandatory for this question — do NOT output a workout template):
- This is an educational / analytical question. Answer with clear reasoning, not a session prescription.
- Do NOT use a "Focus:" line. Do NOT list a full workout (no 4–6 exercise bullet prescription).
- You MAY mention 1–2 example exercise names from allowed_exercise_names only if it clarifies a point — not as a workout plan.
- Structure: (1) direct answer in the first 1–2 sentences, (2) brief why/evidence from general coaching knowledge and their logs when relevant, (3) optional 2–4 bullet takeaways.
- Cover tradeoffs when useful (e.g. frequency vs recovery, volume landmarks, beginner vs intermediate).
- Max ~280 words. Plain prose and simple bullets only — no markdown tables, no bold headers, no emojis.
- Nutrition/lifestyle reasoning questions are also in scope: protein intake, calorie targets, recovery habits.
- Example — Q: "How many quad workouts per week is optimal?" → Explain 2×/week vs 1×/week, volume landmarks, recovery — do NOT output a workout list.
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

module.exports = { buildReasoningFormatInstructions, buildPlanFormatInstructions };
