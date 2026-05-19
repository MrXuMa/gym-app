import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppScreen } from '@/components/layout/AppScreen';
import { useOpenSwipeable } from '@/hooks/useOpenSwipeable';
import { AddExercisePicker, type ExerciseOption } from '@/components/workout-session/AddExercisePicker';
import { ExerciseSessionCard } from '@/components/workout-session/ExerciseSessionCard';
import { loadWorkoutSession, removeExerciseFromSession, type SessionExercise, type WorkoutSetLog } from '@/lib/workoutSession';
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
  const { close: closeOpenSwipe, onWillOpen: handleSwipeableWillOpen } = useOpenSwipeable();

  const loadWorkout = useCallback(async () => {
    if (!workoutId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const [sessionResult, workoutMeta, exercisesResult] = await Promise.all([
        loadWorkoutSession(workoutId, { useActiveCache: false }),
        supabase.from('user_workouts').select('duration_seconds, status, date').eq('id', workoutId).single(),
        supabase.from('exercises').select('id, name, target_muscle').order('name'),
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

      if (exercisesResult.error) {
        throw exercisesResult.error;
      }

      setExercises(sessionResult.exercises);
      setWorkoutTitle(sessionResult.title);
      setWorkoutDate(workoutMeta.data.date);
      setDurationSeconds(workoutMeta.data.duration_seconds);
      setAllExercises(
        (exercisesResult.data ?? []).map((exercise) => ({
          id: exercise.id,
          name: exercise.name,
          targetMuscle: exercise.target_muscle,
        })),
      );
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

  function handleAddExercise(exerciseId: string) {
    const selected = allExercises.find((exercise) => exercise.id === exerciseId);
    if (!selected) {
      return;
    }

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
      <View style={styles.body}>
        <View style={styles.meta}>
          <Text style={styles.metaTitle} numberOfLines={2}>
            {workoutTitle}
          </Text>
          <Text style={styles.metaDetails}>
            {formatWorkoutDurationText(durationSeconds)} · {formatWorkoutDateText(workoutDate)}
          </Text>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={closeOpenSwipe}
        >
          {exercises.length === 0 ? (
            <Text style={styles.emptyExercises}>Add a workout block to log or fix sets.</Text>
          ) : (
            exercises.map((exercise) => (
              <ExerciseSessionCard
                key={exercise.id}
                workoutId={workoutId}
                exercise={exercise}
                removing={removingExerciseId === exercise.id}
                onSetsChange={handleSetsChange}
                onRemove={() => handleRemoveExercise(exercise.id)}
                onSwipeableWillOpen={handleSwipeableWillOpen}
              />
            ))
          )}

          <Pressable style={styles.addWorkoutButton} onPress={() => setPickerVisible(true)}>
            <Text style={styles.addWorkoutText}>Add workout</Text>
          </Pressable>
        </ScrollView>

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
      </View>

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
    borderColor: homeTheme.colors.surfaceBorder,
    backgroundColor: homeTheme.colors.surface,
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
