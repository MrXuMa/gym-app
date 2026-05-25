import { useRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { RectButton, Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { formatWorkoutDateText, formatWorkoutDurationText } from '@/lib/workoutDisplay';
import type { WorkoutListItem } from '@/lib/workouts';
import { homeTheme } from '@/constants/theme';

export type { WorkoutListItem } from '@/lib/workouts';

const DELETE_WIDTH = 88;
const MAX_VISIBLE_EXERCISES = 6;

type WorkoutListRowProps = {
  workout: WorkoutListItem;
  deleting: boolean;
  onPress: () => void;
  onDelete: () => void;
  onSwipeableWillOpen: (ref: Swipeable) => void;
};

export function WorkoutListRow({
  workout,
  deleting,
  onPress,
  onDelete,
  onSwipeableWillOpen,
}: WorkoutListRowProps) {
  const swipeableRef = useRef<Swipeable>(null);

  function handleWillOpen() {
    if (swipeableRef.current) {
      onSwipeableWillOpen(swipeableRef.current);
    }
  }

  function renderRightActions() {
    return (
      <RectButton
        style={styles.deleteAction}
        onPress={() => {
          swipeableRef.current?.close();
          onDelete();
        }}
        enabled={!deleting}
      >
        {deleting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <View style={styles.deleteContent}>
            <Ionicons name="trash-outline" size={22} color="#fff" />
            <Text style={styles.deleteLabel}>Delete</Text>
          </View>
        )}
      </RectButton>
    );
  }

  const visibleExercises = workout.exercises.slice(0, MAX_VISIBLE_EXERCISES);
  const hiddenCount = Math.max(0, workout.exercises.length - visibleExercises.length);

  return (
    <View style={styles.wrapper}>
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        rightThreshold={40}
        overshootRight={false}
        friction={2}
        onSwipeableWillOpen={handleWillOpen}
      >
        <Pressable
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`Open ${workout.title}`}
        >
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>
              {workout.title}
            </Text>
            <Text style={styles.meta}>
              {formatWorkoutDurationText(workout.durationSeconds)} ·{' '}
              {formatWorkoutDateText(workout.date)}
            </Text>
          </View>

          {workout.exercises.length === 0 ? (
            <Text style={styles.emptyExercises}>No exercises logged.</Text>
          ) : (
            <View style={styles.exerciseList}>
              {visibleExercises.map((exercise) => (
                <Text key={exercise.exerciseId} style={styles.exerciseName} numberOfLines={1}>
                  {exercise.name}
                </Text>
              ))}

              {hiddenCount > 0 ? (
                <Text style={styles.moreText}>
                  +{hiddenCount} more {hiddenCount === 1 ? 'exercise' : 'exercises'}
                </Text>
              ) : null}
            </View>
          )}
        </Pressable>
      </Swipeable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: homeTheme.spacing.cardGap,
    borderRadius: homeTheme.radius.card,
    overflow: 'hidden',
    backgroundColor: homeTheme.colors.background,
  },
  card: {
    backgroundColor: homeTheme.colors.card,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: homeTheme.colors.border,
    borderRadius: homeTheme.radius.card,
    gap: 12,
  },
  cardPressed: {
    opacity: 0.92,
  },
  header: {
    gap: 4,
  },
  title: {
    color: homeTheme.colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  meta: {
    color: homeTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  exerciseList: {
    borderTopWidth: 1,
    borderTopColor: homeTheme.colors.border,
    paddingTop: 10,
    gap: 4,
  },
  exerciseName: {
    color: homeTheme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  moreText: {
    color: homeTheme.colors.mutedForeground,
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 2,
  },
  emptyExercises: {
    color: homeTheme.colors.textMuted,
    fontSize: 13,
    fontStyle: 'italic',
    borderTopWidth: 1,
    borderTopColor: homeTheme.colors.border,
    paddingTop: 10,
  },
  deleteAction: {
    width: DELETE_WIDTH,
    backgroundColor: homeTheme.colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: homeTheme.spacing.cardGap,
    borderRadius: homeTheme.radius.card,
  },
  deleteContent: {
    alignItems: 'center',
    gap: 4,
  },
  deleteLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
