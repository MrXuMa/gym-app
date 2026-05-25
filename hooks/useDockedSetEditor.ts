import { useCallback, useRef, useState } from 'react';
import type {
  DockedSetEditorActions,
  DockedSetEditorPayload,
  DockedSetEditorView,
} from '@/components/workout-session/SetEditorDock';

export function useDockedSetEditor() {
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [dockedEditor, setDockedEditor] = useState<DockedSetEditorView | null>(null);
  const actionsRef = useRef<DockedSetEditorActions | null>(null);

  const handleDockedEditorChange = useCallback(
    (exerciseId: string, payload: DockedSetEditorPayload | null) => {
      if (payload) {
        actionsRef.current = {
          onChangeReps: payload.onChangeReps,
          onChangeWeight: payload.onChangeWeight,
          onSave: payload.onSave,
          onClose: payload.onClose,
        };

        const nextView: DockedSetEditorView = {
          exerciseId: payload.exerciseId,
          exerciseName: payload.exerciseName,
          displayNumber: payload.displayNumber,
          reps: payload.reps,
          weight: payload.weight,
          saving: payload.saving,
        };

        setDockedEditor((current) => {
          if (
            current &&
            current.exerciseId === nextView.exerciseId &&
            current.exerciseName === nextView.exerciseName &&
            current.displayNumber === nextView.displayNumber &&
            current.reps === nextView.reps &&
            current.weight === nextView.weight &&
            current.saving === nextView.saving
          ) {
            return current;
          }

          return nextView;
        });
        setEditingExerciseId(exerciseId);
        return;
      }

      actionsRef.current = null;
      setEditingExerciseId((current) => (current === exerciseId ? null : current));
      setDockedEditor((current) => (current?.exerciseId === exerciseId ? null : current));
    },
    [],
  );

  const onChangeReps = useCallback((value: string) => {
    actionsRef.current?.onChangeReps(value);
  }, []);

  const onChangeWeight = useCallback((value: string) => {
    actionsRef.current?.onChangeWeight(value);
  }, []);

  const onSave = useCallback(() => {
    actionsRef.current?.onSave();
  }, []);

  const onClose = useCallback(() => {
    actionsRef.current?.onClose();
  }, []);

  return {
    editingExerciseId,
    setEditingExerciseId,
    dockedEditor,
    dockedExerciseId: dockedEditor?.exerciseId ?? null,
    handleDockedEditorChange,
    dockEditorActions: {
      onChangeReps,
      onChangeWeight,
      onSave,
      onClose,
    },
  };
}
