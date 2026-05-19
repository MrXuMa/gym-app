import { formatDuration } from '@/lib/workoutSession';

export function normalizeWorkoutTitle(title: string) {
  return title.trim();
}

export function isValidWorkoutTitle(title: string) {
  const normalized = normalizeWorkoutTitle(title);
  return normalized.length >= 1 && normalized.length <= 80;
}

/** e.g. "Tuesday, May 19, 2026" */
export function formatWorkoutDateText(dateIso: string | null) {
  if (!dateIso) {
    return 'Date unknown';
  }

  return new Date(dateIso).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/** e.g. "42 min" or "1:05:22" for longer sessions */
export function formatWorkoutDurationText(durationSeconds: number | null) {
  if (durationSeconds === null || durationSeconds < 0) {
    return 'Duration unknown';
  }

  if (durationSeconds < 3600) {
    const minutes = Math.max(1, Math.round(durationSeconds / 60));
    return `${minutes} min`;
  }

  return formatDuration(durationSeconds);
}
