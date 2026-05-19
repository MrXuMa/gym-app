import { useRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { RectButton, Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { formatWorkoutDateText, formatWorkoutDurationText } from '@/lib/workoutDisplay';
import { homeTheme } from '@/constants/theme';

const DELETE_WIDTH = 88;

export type WorkoutListItem = {
  id: string;
  title: string;
  date: string | null;
  durationSeconds: number | null;
};

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
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          onPress={onPress}
        >
          <Text style={styles.title}>{workout.title}</Text>
          <Text style={styles.meta}>
            {formatWorkoutDurationText(workout.durationSeconds)} · {formatWorkoutDateText(workout.date)}
          </Text>
        </Pressable>
      </Swipeable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 1,
    backgroundColor: homeTheme.colors.background,
  },
  row: {
    backgroundColor: homeTheme.colors.surface,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: homeTheme.colors.surfaceBorder,
  },
  rowPressed: {
    opacity: 0.92,
  },
  title: {
    color: homeTheme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  meta: {
    color: homeTheme.colors.textMuted,
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
  },
  deleteAction: {
    width: DELETE_WIDTH,
    backgroundColor: homeTheme.colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 1,
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
