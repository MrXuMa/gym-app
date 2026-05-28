import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchExerciseCatalog } from '@/lib/exercises';
import { useScrollToDockedCard } from '@/hooks/useScrollToDockedCard';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { AppScreen } from '@/components/layout/AppScreen';
import { AddExercisePicker, type ExerciseOption } from '@/components/workout-session/AddExercisePicker';
import { type DraggableExerciseListRef } from '@/components/workout-session/DraggableExerciseList';
import { SessionTimer } from '@/components/workout-session/SessionTimer';
import { WorkoutExerciseEditorBody } from '@/components/workout-session/WorkoutExerciseEditorBody';
import { createExerciseCardRenderer } from '@/components/workout-session/renderExerciseSessionCard';
import {
  WORKOUT_EDITOR_COPY,
  workoutEditorStyles as styles,
} from '@/components/workout-session/workoutEditorStyles';
import { useDockedSetEditor } from '@/hooks/useDockedSetEditor';
import {
  addExerciseToActiveSession,
  cancelActiveWorkoutSession,
  endActiveWorkoutSession,
  getActiveWorkoutSession,
  loadWorkoutSession,
  removeExerciseFromSession,
  reorderWorkoutExercises,
  type SessionExercise,
  type WorkoutSetLog,
} from '@/lib/workoutSession';
import { homeTheme } from '@/constants/theme';

export default function WorkoutSessionScreen() {
  const router = useRouter();
  const { workoutId: workoutIdParam } = useLocalSearchParams<{ workoutId?: string }>();
  const [workoutId, setWorkoutId] = useState<string | null>(workoutIdParam ?? null);
  const [workoutTitle, setWorkoutTitle] = useState('');
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [exercises, setExercises] = useState<SessionExercise[]>([]);
  const [allExercises, setAllExercises] = useState<ExerciseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);
  const [discarding, setDiscarding] = useState(false);
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

  useEffect(() => {
    async function bootstrap() {
      setLoading(true);

      try {
        let id = workoutIdParam ?? null;

        if (!id) {
          const active = await getActiveWorkoutSession();
          id = active?.id ?? null;
        }

        if (!id) {
          setLoading(false);
          return;
        }

        const [sessionResult, catalog] = await Promise.all([loadWorkoutSession(id), fetchExerciseCatalog()]);

        setWorkoutId(sessionResult.workoutId);
        setWorkoutTitle(sessionResult.title);
        setStartedAt(sessionResult.startedAt);
        setExercises(sessionResult.exercises);
        setAllExercises(catalog);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load workout session.';
        Alert.alert('Session error', message);
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
  }, [workoutIdParam]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
      return () => subscription.remove();
    }, []),
  );

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
      Alert.alert('Could not add exercise', message);
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
      Alert.alert('Could not remove exercise', message);
    } finally {
      setRemovingExerciseId(null);
    }
  }

  function confirmDiscardSession() {
    Alert.alert(
      'Discard session?',
      'This will delete the entire workout session and all logged data. This cannot be undone.',
      [
        { text: 'Keep going', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: handleDiscardSession },
      ],
    );
  }

  async function handleDiscardSession() {
    if (!workoutId) {
      return;
    }

    setDiscarding(true);

    try {
      await cancelActiveWorkoutSession(workoutId);
      router.replace('/(tabs)/workouts');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not discard session.';
      Alert.alert('Could not discard session', message);
    } finally {
      setDiscarding(false);
    }
  }

  function confirmEndWorkout() {
    Alert.alert(
      'End workout?',
      'Your session will be saved. You can edit it later from Workouts.',
      [
        { text: 'Keep going', style: 'cancel' },
        { text: 'End workout', style: 'destructive', onPress: handleEndWorkout },
      ],
    );
  }

  async function handleEndWorkout() {
    if (!workoutId || !startedAt) {
      return;
    }

    setEnding(true);

    try {
      await endActiveWorkoutSession(workoutId, startedAt);
      router.replace('/(tabs)/workouts');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not end workout.';
      Alert.alert('Could not end workout', message);
    } finally {
      setEnding(false);
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
    [
      workoutId,
      editingExerciseId,
      setEditingExerciseId,
      handleDockedEditorChange,
      removingExerciseId,
    ],
  );

  if (loading) {
    return (
      <AppScreen title="Workout Session" showProfile={false}>
        <ActivityIndicator style={styles.loader} size="large" color={homeTheme.colors.textPrimary} />
      </AppScreen>
    );
  }

  if (!workoutId || !startedAt) {
    return (
      <AppScreen title="Workout Session" showProfile={false}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>No active workout session.</Text>
          <Pressable style={styles.primaryButton} onPress={() => router.replace('/(tabs)/workouts')}>
            <Text style={styles.primaryButtonText}>Go to workouts</Text>
          </Pressable>
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen
      title="Workout Session"
      showProfile={false}
      headerRight={
        <Pressable
          style={ending ? styles.disabled : undefined}
          disabled={ending}
          onPress={confirmEndWorkout}
          accessibilityRole="button"
          accessibilityLabel="End workout"
        >
          {ending ? (
            <ActivityIndicator size="small" color={homeTheme.colors.danger} />
          ) : (
            <Text style={[styles.headerActionText, styles.headerActionDanger]}>End</Text>
          )}
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
          header={<SessionTimer title={workoutTitle} startedAt={startedAt} />}
          secondaryAction={{
            label: 'Discard session',
            onPress: confirmDiscardSession,
            loading: discarding,
            accessibilityLabel: 'Discard session',
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
