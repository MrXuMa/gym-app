export const MAX_GOALS = 3;
export const MAX_WORDS_PER_GOAL = 10;

export const SAMPLE_GOALS = [
  'lose weight',
  'add muscle',
  'get stronger',
  'improve endurance',
] as const;

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function validateGoalText(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  if (countWords(trimmed) > MAX_WORDS_PER_GOAL) {
    return `Maximum ${MAX_WORDS_PER_GOAL} words per goal`;
  }

  return null;
}

export function normalizeGoalSlots(slots: string[]): string[] {
  return slots.map((slot) => slot.trim()).filter(Boolean).slice(0, MAX_GOALS);
}

export function slotsFromGoals(goals: string[] | null | undefined): [string, string, string] {
  const next: [string, string, string] = ['', '', ''];
  (goals ?? []).slice(0, MAX_GOALS).forEach((goal, index) => {
    next[index] = goal;
  });
  return next;
}

export function firstEmptySlotIndex(slots: string[]): number | null {
  const index = slots.findIndex((slot) => !slot.trim());
  return index === -1 ? null : index;
}
