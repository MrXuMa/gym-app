import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchExerciseCatalog } from '@/lib/exercises';
import { useScrollToDockedCard } from '@/hooks/useScrollToDockedCard';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { confirmAsync, notify } from '@/lib/platformAlert';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppScreen } from '@/components/layout/AppScreen';
import { AddExercisePicker, type ExerciseOption } from '@/components/workout-session/AddExercisePicker';
import { type DraggableExerciseListRef } from '@/components/workout-session/DraggableExerciseList';
import { WorkoutExerciseEditorBody } from '@/components/workout-session/WorkoutExerciseEditorBody';
import { WorkoutMetaHeader } from '@/components/workout-session/WorkoutMetaHeader';
import { createExerciseCardRenderer } from '@/components/workout-session/renderExerciseSessionCard';
import { getErrorMessage } from '@/lib/userFacingError';
import {
  WORKOUT_EDITOR_COPY,
  workoutEditorStyles as styles,
} from '@/components/workout-session/workoutEditorStyles';
import { useDockedSetEditor } from '@/hooks/useDockedSetEditor';
import {
  addExerciseToActiveSession,
  loadWorkoutSession,
  removeExerciseFromSession,
  reorderWorkoutExercises,
  type SessionExercise,
  type WorkoutSetLog,
} from '@/lib/workoutSession';
import { formatWorkoutDateText, formatWorkoutDurationText } from '@/lib/workoutDisplay';
import { deleteWorkout } from '@/lib/workouts';
import { supabase } from '@/lib/supabase';
import { homeTheme } from '@/constants/theme';

export default function EditWorkoutScreen() {
  const router = useRouter();
  const { workoutId } = useLocalSearchParams<{ workoutId?: string }>();
  const [exercises, setExercises] = useState<SessionExercise[]>([]);
  const [allExercises, setAllExercises] = useState<ExerciseOption[]>([]);
  const [workoutTitle, setWorkoutTitle] = useState('');
  const [workoutDate, setWorkoutDate] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [removingExerciseId, setRemovingExerciseId] = useState<string | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const scrollRef = useRef<DraggableExerciseListRef>(null);
  const {
    editingExerciseId,
    setEditingExerciseId,
    dockedEditor,
    dockedExerciseId,
    handleDockedEditorChange,
    dockEditorActions,
  } = useDockedSetEditor();

  const exerciseIds = exercises.map((exercise) => exercise.id);
  useScrollToDockedCard(scrollRef, { current: {} }, dockedExerciseId, exerciseIds);

  const loadWorkout = useCallback(async () => {
    if (!workoutId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const [sessionResult, workoutMeta, catalog] = await Promise.all([
        loadWorkoutSession(workoutId, { useActiveCache: false }),
        supabase.from('user_workouts').select('duration_seconds, status, date').eq('id', workoutId).single(),
        fetchExerciseCatalog(),
      ]);

      if (workoutMeta.error) {
        throw workoutMeta.error;
      }

      if (workoutMeta.data.status === 'active') {
        notify('Active session', 'This workout is still in progress. Opening the live session instead.');
        router.replace({ pathname: '/workout-session', params: { workoutId } });
        return;
      }

      setExercises(sessionResult.exercises);
      setWorkoutTitle(sessionResult.title);
      setWorkoutDate(workoutMeta.data.date);
      setDurationSeconds(workoutMeta.data.duration_seconds);
      setAllExercises(catalog);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not load workout.');
      notify('Could not load workout', message);
    } finally {
      setLoading(false);
    }
  }, [router, workoutId]);

  useEffect(() => {
    loadWorkout();
  }, [loadWorkout]);

  function handleSetsChange(exerciseId: string, sets: WorkoutSetLog[]) {
    setExercises((current) =>
      current.map((exercise) => (exercise.id === exerciseId ? { ...exercise, sets } : exercise)),
    );
  }

  async function handleAddExercise(exerciseId: string) {
    if (!workoutId) {
      return;
    }

    const selected = allExercises.find((exercise) => exercise.id === exerciseId);
    if (!selected) {
      return;
    }

    try {
      await addExerciseToActiveSession(workoutId, exerciseId);
      setExercises((current) => {
        if (current.some((exercise) => exercise.id === exerciseId)) {
          return current;
        }

        return [
          ...current,
          {
            id: selected.id,
            name: selected.name,
            targetMuscle: selected.targetMuscle,
            sets: [],
          },
        ];
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : WORKOUT_EDITOR_COPY.addExerciseFailed;
      notify('Could not add exercise', message);
    }
  }

  async function handleRemoveExercise(exerciseId: string) {
    if (!workoutId) {
      return;
    }

    setRemovingExerciseId(exerciseId);

    try {
      await removeExerciseFromSession(workoutId, exerciseId);
      setExercises((current) => current.filter((exercise) => exercise.id !== exerciseId));
    } catch (error) {
      const message = error instanceof Error ? error.message : WORKOUT_EDITOR_COPY.removeExerciseFailed;
      notify('Could not remove exercise', message);
    } finally {
      setRemovingExerciseId(null);
    }
  }

  async function confirmDeleteWorkout() {
    if (!workoutId) {
      return;
    }

    const confirmed = await confirmAsync({
      title: 'Delete workout?',
      message: 'Remove this session and all logged sets? This cannot be undone.',
      confirmText: 'Delete',
      destructive: true,
    });
    if (!confirmed) return;

    setDeleting(true);
    try {
      await deleteWorkout(workoutId);
      router.back();
    } catch (error) {
      const message = getErrorMessage(error, 'Could not delete workout.');
      notify('Delete failed', message);
    } finally {
      setDeleting(false);
    }
  }

  function handleReorderExercises(next: SessionExercise[]) {
    setExercises(next);
    if (!workoutId) {
      return;
    }

    void reorderWorkoutExercises(
      workoutId,
      next.map((exercise) => exercise.id),
    );
  }

  const renderExercise = useMemo(
    () =>
      createExerciseCardRenderer({
        workoutId: workoutId ?? '',
        editingExerciseId,
        setEditingExerciseId,
        handleDockedEditorChange,
        handleSetsChange,
        handleRemoveExercise,
        removingExerciseId,
      }),
    [workoutId, editingExerciseId, setEditingExerciseId, handleDockedEditorChange, removingExerciseId],
  );

  if (loading) {
    return (
      <AppScreen title="Edit Workout" showProfile={false}>
        <ActivityIndicator style={styles.loader} size="large" color={homeTheme.colors.textPrimary} />
      </AppScreen>
    );
  }

  if (!workoutId) {
    return (
      <AppScreen title="Edit Workout" showProfile={false}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>No workout selected.</Text>
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen
      title="Edit Workout"
      showProfile={false}
      headerRight={
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Done editing"
        >
          <Text style={[styles.headerActionText, styles.headerActionPrimary]}>Done</Text>
        </Pressable>
      }
    >
      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 4 : 0}
      >
        <WorkoutExerciseEditorBody
          exercises={exercises}
          onReorder={handleReorderExercises}
          onAddExercise={() => setPickerVisible(true)}
          scrollRef={scrollRef}
          renderExercise={renderExercise}
          dockedEditor={dockedEditor}
          dockEditorActions={dockEditorActions}
          header={
            <WorkoutMetaHeader
              title={workoutTitle}
              subtitle={`${formatWorkoutDurationText(durationSeconds)} · ${formatWorkoutDateText(workoutDate)}`}
            />
          }
          secondaryAction={{
            label: 'Delete workout',
            onPress: () => void confirmDeleteWorkout(),
            loading: deleting,
            accessibilityLabel: 'Delete workout',
          }}
        />
      </KeyboardAvoidingView>

      <AddExercisePicker
        visible={pickerVisible}
        exercises={allExercises}
        selectedExerciseIds={exerciseIds}
        onClose={() => setPickerVisible(false)}
        onSelect={handleAddExercise}
      />
    </AppScreen>
  );
}
