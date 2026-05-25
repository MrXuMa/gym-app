import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchExerciseCatalog } from '@/lib/exercises';
import { useScrollToDockedCard } from '@/hooks/useScrollToDockedCard';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppScreen } from '@/components/layout/AppScreen';
import { AddExercisePicker, type ExerciseOption } from '@/components/workout-session/AddExercisePicker';
import { ExerciseSessionCard } from '@/components/workout-session/ExerciseSessionCard';
import { SetEditorDock } from '@/components/workout-session/SetEditorDock';
import { useDockedSetEditor } from '@/hooks/useDockedSetEditor';
import {
  addExerciseToActiveSession,
  loadWorkoutSession,
  removeExerciseFromSession,
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

  const loadWorkout = useCallback(async () => {
    if (!workoutId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const [sessionResult, workoutMeta, catalog] = await Promise.all([
        loadWorkoutSession(workoutId),
        supabase.from('user_workouts').select('duration_seconds, status, date').eq('id', workoutId).single(),
        fetchExerciseCatalog(),
      ]);

      if (workoutMeta.error) {
        throw workoutMeta.error;
      }

      if (workoutMeta.data.status === 'active') {
        Alert.alert('Active session', 'This workout is still in progress. Opening the live session instead.', [
          {
            text: 'OK',
            onPress: () =>
              router.replace({ pathname: '/workout-session', params: { workoutId } }),
          },
        ]);
        return;
      }

      setExercises(sessionResult.exercises);
      setWorkoutTitle(sessionResult.title);
      setWorkoutDate(workoutMeta.data.date);
      setDurationSeconds(workoutMeta.data.duration_seconds);
      setAllExercises(catalog);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load workout.';
      Alert.alert('Could not load workout', message);
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

  function confirmDeleteWorkout() {
    if (!workoutId) {
      return;
    }

    Alert.alert('Delete workout?', 'Remove this session and all logged sets? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteWorkout(workoutId);
            router.back();
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Could not delete workout.';
            Alert.alert('Delete failed', message);
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  }

  const selectedExerciseIds = exercises.map((exercise) => exercise.id);

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
          <Text style={styles.emptyTitle}>No workout selected.</Text>
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
          <Text style={styles.doneButton}>Done</Text>
        </Pressable>
      }
    >
      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 4 : 0}
      >
        <View style={styles.meta}>
          <Text style={styles.metaTitle} numberOfLines={2}>
            {workoutTitle}
          </Text>
          <Text style={styles.metaDetails}>
            {formatWorkoutDurationText(durationSeconds)} · {formatWorkoutDateText(workoutDate)}
          </Text>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.scrollView}
          contentContainerStyle={[styles.scroll, dockedEditor && styles.scrollWithDock]}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          {exercises.length === 0 ? (
            <Text style={styles.emptyExercises}>Add a workout block to log or fix sets.</Text>
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

          <Pressable style={styles.addWorkoutButton} onPress={() => setPickerVisible(true)}>
            <Text style={styles.addWorkoutText}>Add workout</Text>
          </Pressable>
        </ScrollView>

        {dockedEditor ? <SetEditorDock {...dockedEditor} {...dockEditorActions} /> : null}

        <View style={styles.footer}>
          <Pressable
            style={[styles.deleteWorkoutButton, deleting && styles.disabled]}
            disabled={deleting}
            onPress={confirmDeleteWorkout}
            accessibilityRole="button"
            accessibilityLabel="Delete workout"
          >
            {deleting ? (
              <ActivityIndicator size="small" color={homeTheme.colors.danger} />
            ) : (
              <Text style={styles.deleteWorkoutText}>Delete workout</Text>
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
  meta: {
    marginHorizontal: homeTheme.spacing.screen,
    marginBottom: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: homeTheme.radius.card,
    borderWidth: 1,
    borderColor: homeTheme.colors.border,
    backgroundColor: homeTheme.colors.card,
  },
  metaTitle: {
    color: homeTheme.colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
    lineHeight: 24,
  },
  metaDetails: {
    color: homeTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  scrollView: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: homeTheme.spacing.screen,
    paddingBottom: 16,
  },
  scrollWithDock: {
    paddingBottom: 8,
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
    marginTop: 4,
  },
  addWorkoutText: {
    color: homeTheme.colors.tabBar,
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  footer: {
    paddingHorizontal: homeTheme.spacing.screen,
    paddingBottom: 12,
    paddingTop: 4,
    alignItems: 'flex-start',
  },
  deleteWorkoutButton: {
    paddingVertical: 4,
  },
  deleteWorkoutText: {
    color: homeTheme.colors.danger,
    fontWeight: '600',
    fontSize: 13,
  },
  doneButton: {
    color: homeTheme.colors.navYellow,
    fontWeight: '700',
    fontSize: 15,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: homeTheme.spacing.screen,
  },
  emptyTitle: {
    color: homeTheme.colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.6,
  },
});
