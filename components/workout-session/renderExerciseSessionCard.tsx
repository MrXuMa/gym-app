import type { ReactElement } from 'react';
import { ExerciseSessionCard } from '@/components/workout-session/ExerciseSessionCard';
import type { ExerciseDragRenderProps } from '@/components/workout-session/DraggableExerciseList';
import type { SessionExercise, WorkoutSetLog } from '@/lib/workoutSession';
import type { DockedSetEditorPayload } from '@/components/workout-session/SetEditorDock';

export type ExerciseCardEditorContext = {
  workoutId: string;
  localOnly?: boolean;
  editingExerciseId: string | null;
  setEditingExerciseId: (exerciseId: string | null) => void;
  handleDockedEditorChange: (exerciseId: string, payload: DockedSetEditorPayload | null) => void;
  handleSetsChange: (exerciseId: string, sets: WorkoutSetLog[]) => void;
  handleRemoveExercise: (exerciseId: string) => void;
  removingExerciseId?: string | null;
};

export function renderExerciseSessionCard(
  context: ExerciseCardEditorContext,
  { exercise, drag, isActive }: ExerciseDragRenderProps,
): ReactElement {
  return (
    <ExerciseSessionCard
      workoutId={context.workoutId}
      exercise={exercise}
      localOnly={context.localOnly}
      drag={drag}
      isDragging={isActive}
      editingExerciseId={context.editingExerciseId}
      onEditingExerciseIdChange={context.setEditingExerciseId}
      onDockedEditorChange={(payload) => context.handleDockedEditorChange(exercise.id, payload)}
      removing={context.removingExerciseId === exercise.id}
      onSetsChange={context.handleSetsChange}
      onRemove={() => context.handleRemoveExercise(exercise.id)}
    />
  );
}

export function createExerciseCardRenderer(context: ExerciseCardEditorContext) {
  return (props: ExerciseDragRenderProps) => renderExerciseSessionCard(context, props);
}
