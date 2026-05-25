import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchExerciseCatalog } from '@/lib/exercises';
import { useScrollToDockedCard } from '@/hooks/useScrollToDockedCard';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { AppScreen } from '@/components/layout/AppScreen';
import { AddExercisePicker, type ExerciseOption } from '@/components/workout-session/AddExercisePicker';
import { ExerciseSessionCard } from '@/components/workout-session/ExerciseSessionCard';
import { SessionTimer } from '@/components/workout-session/SessionTimer';
import { SetEditorDock } from '@/components/workout-session/SetEditorDock';
import { useDockedSetEditor } from '@/hooks/useDockedSetEditor';
import {
  addExerciseToActiveSession,
  cancelActiveWorkoutSession,
  endActiveWorkoutSession,
  getActiveWorkoutSession,
  loadWorkoutSession,
  removeExerciseFromSession,
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
  const scrollRef = useRef<ScrollView>(null);
  const cardOffsetsRef = useRef<Record<string, number>>({});
  const {
    editingExerciseId,
    setEditingExerciseId,
    dockedEditor,
    dockedExerciseId,
    handleDockedEditorChange,
    dockEditorActions,
  } = useDockedSetEditor();

  useScrollToDockedCard(scrollRef, cardOffsetsRef, dockedExerciseId);

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
      const message = error instanceof Error ? error.message : 'Could not add workout.';
      Alert.alert('Could not add workout', message);
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
      const message = error instanceof Error ? error.message : 'Could not remove workout.';
      Alert.alert('Could not remove workout', message);
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

  const selectedExerciseIds = exercises.map((exercise) => exercise.id);

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
          <Text style={styles.emptyTitle}>No active workout session.</Text>
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
          style={[styles.endButton, ending && styles.disabled]}
          disabled={ending}
          onPress={confirmEndWorkout}
          accessibilityRole="button"
          accessibilityLabel="End workout"
        >
          {ending ? (
            <ActivityIndicator size="small" color={homeTheme.colors.danger} />
          ) : (
            <Text style={styles.endButtonText}>End</Text>
          )}
        </Pressable>
      }
    >
      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 4 : 0}
      >
        <SessionTimer title={workoutTitle} startedAt={startedAt} />

        <ScrollView
          ref={scrollRef}
          style={styles.scrollView}
          contentContainerStyle={[styles.scroll, dockedEditor && styles.scrollWithDock]}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          {exercises.length === 0 ? (
            <Text style={styles.emptyExercises}>Add a workout to start logging sets.</Text>
          ) : (
            exercises.map((exercise) => (
              <View
                key={exercise.id}
                onLayout={(event) => {
                  cardOffsetsRef.current[exercise.id] = event.nativeEvent.layout.y;
                }}
              >
                <ExerciseSessionCard
                  workoutId={workoutId}
                  exercise={exercise}
                  editingExerciseId={editingExerciseId}
                  onEditingExerciseIdChange={setEditingExerciseId}
                  onDockedEditorChange={(payload) => handleDockedEditorChange(exercise.id, payload)}
                  removing={removingExerciseId === exercise.id}
                  onSetsChange={handleSetsChange}
                  onRemove={() => handleRemoveExercise(exercise.id)}
                />
              </View>
            ))
          )}
        </ScrollView>

        {dockedEditor ? <SetEditorDock {...dockedEditor} {...dockEditorActions} /> : null}

        <View style={styles.footer}>
          <Pressable style={styles.addWorkoutButton} onPress={() => setPickerVisible(true)}>
            <Text style={styles.addWorkoutText}>Add workout</Text>
          </Pressable>
          <Pressable
            style={[styles.discardButton, discarding && styles.disabled]}
            disabled={discarding}
            onPress={confirmDiscardSession}
            accessibilityRole="button"
            accessibilityLabel="Discard session"
          >
            {discarding ? (
              <ActivityIndicator size="small" color={homeTheme.colors.danger} />
            ) : (
              <Text style={styles.discardButtonText}>Discard session</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <AddExercisePicker
        visible={pickerVisible}
        exercises={allExercises}
        selectedExerciseIds={selectedExerciseIds}
        onClose={() => setPickerVisible(false)}
        onSelect={handleAddExercise}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  loader: {
    marginTop: 48,
  },
  body: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: homeTheme.spacing.screen,
    paddingBottom: 24,
  },
  scrollWithDock: {
    paddingBottom: 8,
  },
  footer: {
    paddingHorizontal: homeTheme.spacing.screen,
    paddingBottom: 12,
    paddingTop: 8,
    gap: 10,
  },
  emptyExercises: {
    color: homeTheme.colors.textMuted,
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  addWorkoutButton: {
    backgroundColor: homeTheme.colors.navYellow,
    borderRadius: homeTheme.radius.button,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addWorkoutText: {
    color: homeTheme.colors.tabBar,
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  discardButton: {
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  discardButtonText: {
    color: homeTheme.colors.danger,
    fontWeight: '600',
    fontSize: 13,
  },
  endButton: {
    minWidth: 52,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  endButtonText: {
    color: homeTheme.colors.danger,
    fontWeight: '700',
    fontSize: 15,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: homeTheme.spacing.screen,
    gap: 16,
  },
  emptyTitle: {
    color: homeTheme.colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: homeTheme.colors.navYellow,
    borderRadius: homeTheme.radius.button,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: homeTheme.colors.tabBar,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.6,
  },
});
