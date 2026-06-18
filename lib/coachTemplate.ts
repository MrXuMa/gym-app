/**
 * Helpers for coach template draft JSON (shared by jobs and saved templates).
 */
import type { SessionExercise, WorkoutSetLog } from '@/lib/workoutSession';
import type { CoachTemplateDraft } from '@/lib/coach';

export type { CoachTemplateDraft };

export function draftToSessionExercises(draft: CoachTemplateDraft): SessionExercise[] {
  return draft.exercises.map((exercise) => {
    const sets: WorkoutSetLog[] = exercise.sets.map((set, index) => ({
      id: `draft-${exercise.exercise_id}-${index}`,
      exerciseId: exercise.exercise_id,
      setNumber: index + 1,
      reps: set.reps,
      weight: set.weight,
    }));

    return {
      id: exercise.exercise_id,
      name: exercise.exercise_name,
      targetMuscle: exercise.target_muscle,
      sets,
    };
  });
}

export function sessionExercisesToContent(exercises: SessionExercise[]) {
  return {
    exercises: exercises.map((exercise) => ({
      exercise_id: exercise.id,
      exercise_name: exercise.name,
      target_muscle: exercise.targetMuscle,
      sets: exercise.sets.map((set) => ({
        reps: set.reps,
        weight: set.weight,
      })),
    })),
  };
}
