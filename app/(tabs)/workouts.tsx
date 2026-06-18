import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { AppScreen } from '@/components/layout/AppScreen';
import { useOpenSwipeable } from '@/hooks/useOpenSwipeable';
import { WorkoutListRow } from '@/components/workouts/WorkoutListRow';
import { deleteWorkout, fetchCompletedWorkouts, type WorkoutListItem } from '@/lib/workouts';
import { homeTheme } from '@/constants/theme';
import { getErrorMessage } from '@/lib/userFacingError';

export default function WorkoutsTabScreen() {
  const router = useRouter();
  const [workouts, setWorkouts] = useState<WorkoutListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { close: closeOpenRow, onWillOpen: handleSwipeableWillOpen } = useOpenSwipeable();

  const loadWorkouts = useCallback(async () => {
    setLoading(true);
    try {
      const items = await fetchCompletedWorkouts();
      setWorkouts(items);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not load workouts.');
      Alert.alert('Could not load workouts', message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkouts();
  }, [loadWorkouts]);

  function confirmDelete(workout: WorkoutListItem) {
    Alert.alert(
      'Delete workout?',
      `Remove "${workout.title}" and all logged sets? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => handleDelete(workout.id),
        },
      ],
    );
  }

  async function handleDelete(workoutId: string) {
    setDeletingId(workoutId);

    try {
      await deleteWorkout(workoutId);
      setWorkouts((current) => current.filter((workout) => workout.id !== workoutId));
    } catch (error) {
      const message = getErrorMessage(error, 'Could not delete workout.');
      Alert.alert('Delete failed', message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <AppScreen title="Workouts" showCrossWatermark>
      <Text style={styles.sectionTitle}>Recent sessions</Text>
      <Text style={styles.hint}>Swipe left on a session to delete.</Text>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={homeTheme.colors.textPrimary} />
      ) : (
        <FlatList
          data={workouts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          onScrollBeginDrag={closeOpenRow}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No workouts logged yet. Tap Start Workout below.</Text>
          }
          renderItem={({ item }) => (
            <WorkoutListRow
              workout={item}
              deleting={deletingId === item.id}
              onPress={() => {
                closeOpenRow();
                router.push({ pathname: '/modal', params: { workoutId: item.id } });
              }}
              onDelete={() => confirmDelete(item)}
              onSwipeableWillOpen={handleSwipeableWillOpen}
            />
          )}
        />
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    color: homeTheme.colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    paddingHorizontal: homeTheme.spacing.screen,
    marginTop: 4,
    marginBottom: 4,
  },
  hint: {
    color: homeTheme.colors.textMuted,
    fontSize: 12,
    paddingHorizontal: homeTheme.spacing.screen,
    marginBottom: 8,
  },
  loader: {
    marginTop: 24,
  },
  list: {
    paddingHorizontal: homeTheme.spacing.screen,
    paddingBottom: 24,
  },
  emptyText: {
    color: homeTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
});
