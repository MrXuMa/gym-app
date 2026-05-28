import { type ReactElement, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import {
  DraggableExerciseList,
  type DraggableExerciseListRef,
  type ExerciseDragRenderProps,
} from '@/components/workout-session/DraggableExerciseList';
import {
  SetEditorDock,
  type DockedSetEditorActions,
  type DockedSetEditorView,
} from '@/components/workout-session/SetEditorDock';
import {
  WORKOUT_EDITOR_COPY,
  workoutEditorStyles as styles,
} from '@/components/workout-session/workoutEditorStyles';
import type { SessionExercise } from '@/lib/workoutSession';
import { homeTheme } from '@/constants/theme';
import type { RefObject } from 'react';

type SecondaryAction = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  accessibilityLabel?: string;
};

type WorkoutExerciseEditorBodyProps = {
  exercises: SessionExercise[];
  onReorder: (exercises: SessionExercise[]) => void;
  onAddExercise: () => void;
  renderExercise: (props: ExerciseDragRenderProps) => ReactElement;
  dockedEditor: DockedSetEditorView | null;
  dockEditorActions: DockedSetEditorActions;
  scrollRef?: RefObject<DraggableExerciseListRef | null>;
  header?: ReactNode;
  showReorderHint?: boolean;
  emptyMessage?: string;
  addExerciseLabel?: string;
  secondaryAction?: SecondaryAction;
};

export function WorkoutExerciseEditorBody({
  exercises,
  onReorder,
  onAddExercise,
  renderExercise,
  dockedEditor,
  dockEditorActions,
  scrollRef,
  header,
  showReorderHint = true,
  emptyMessage = WORKOUT_EDITOR_COPY.emptyExercises,
  addExerciseLabel = WORKOUT_EDITOR_COPY.addExercise,
  secondaryAction,
}: WorkoutExerciseEditorBodyProps) {
  return (
    <>
      {header}

      {showReorderHint && exercises.length > 1 ? (
        <Text style={styles.reorderHint}>{WORKOUT_EDITOR_COPY.reorderHint}</Text>
      ) : null}

      <View style={styles.exerciseList}>
        <DraggableExerciseList
          scrollRef={scrollRef}
          exercises={exercises}
          onReorder={onReorder}
          emptyMessage={emptyMessage}
          contentContainerStyle={[
            styles.scrollContent,
            styles.scrollContentFlex,
            dockedEditor && styles.scrollWithDock,
          ]}
          renderExercise={renderExercise}
        />
      </View>

      {dockedEditor ? <SetEditorDock {...dockedEditor} {...dockEditorActions} /> : null}

      <View style={styles.footer}>
        <Pressable
          style={styles.primaryButton}
          onPress={onAddExercise}
          accessibilityRole="button"
          accessibilityLabel={addExerciseLabel}
        >
          <Text style={styles.primaryButtonText}>{addExerciseLabel}</Text>
        </Pressable>

        {secondaryAction ? (
          <Pressable
            style={[styles.destructiveButton, secondaryAction.loading && styles.disabled]}
            onPress={secondaryAction.onPress}
            disabled={secondaryAction.loading}
            accessibilityRole="button"
            accessibilityLabel={secondaryAction.accessibilityLabel ?? secondaryAction.label}
          >
            {secondaryAction.loading ? (
              <ActivityIndicator size="small" color={homeTheme.colors.danger} />
            ) : (
              <Text style={styles.destructiveButtonText}>{secondaryAction.label}</Text>
            )}
          </Pressable>
        ) : null}
      </View>
    </>
  );
}
