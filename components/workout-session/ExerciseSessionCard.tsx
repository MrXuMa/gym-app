import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { RectButton, Swipeable } from 'react-native-gesture-handler';
import type { Swipeable as SwipeableRef } from 'react-native-gesture-handler';
import { useOpenSwipeable } from '@/hooks/useOpenSwipeable';
import { Ionicons } from '@expo/vector-icons';
import {
  addWorkoutSet,
  deleteExerciseSet,
  MAX_SETS_PER_EXERCISE,
  updateWorkoutSet,
  type SessionExercise,
  type WorkoutSetLog,
} from '@/lib/workoutSession';
import { homeTheme } from '@/constants/theme';

const SET_ROW_HEIGHT = 52;
const VISIBLE_SET_ROWS = 5;
const DELETE_WIDTH = 80;

type ExerciseSessionCardProps = {
  workoutId: string;
  exercise: SessionExercise;
  removing?: boolean;
  onSetsChange: (exerciseId: string, sets: WorkoutSetLog[]) => void;
  onRemove: () => void;
  onSwipeableWillOpen: (ref: SwipeableRef) => void;
};

function parseReps(value: string) {
  return /^\d+$/.test(value.trim()) ? Number.parseInt(value, 10) : Number.NaN;
}

function parseWeight(value: string) {
  if (!value.trim()) {
    return null;
  }

  return /^\d+(\.\d+)?$/.test(value.trim()) ? Number.parseFloat(value) : Number.NaN;
}

type SetRowProps = {
  set: WorkoutSetLog;
  saving: boolean;
  deleting: boolean;
  onSave: (setId: string, reps: number, weight: number | null) => Promise<void>;
  onDelete: () => void;
  onSwipeableWillOpen: (ref: SwipeableRef) => void;
};

function SetRow({ set, saving, deleting, onSave, onDelete, onSwipeableWillOpen }: SetRowProps) {
  const swipeableRef = useRef<SwipeableRef>(null);
  const [reps, setReps] = useState(String(set.reps));
  const [weight, setWeight] = useState(set.weight === null ? '' : String(set.weight));

  useEffect(() => {
    setReps(String(set.reps));
    setWeight(set.weight === null ? '' : String(set.weight));
  }, [set.id, set.reps, set.weight]);

  async function persistSet() {
    const parsedReps = parseReps(reps);
    const parsedWeight = parseWeight(weight);

    if (!Number.isFinite(parsedReps) || parsedReps <= 0) {
      Alert.alert('Invalid reps', 'Reps must be a positive whole number.');
      setReps(String(set.reps));
      return;
    }

    if (parsedWeight !== null && (!Number.isFinite(parsedWeight) || parsedWeight < 0)) {
      Alert.alert('Invalid weight', 'Weight must be empty or a non-negative number.');
      setWeight(set.weight === null ? '' : String(set.weight));
      return;
    }

    if (parsedReps === set.reps && parsedWeight === set.weight) {
      return;
    }

    await onSave(set.id, parsedReps, parsedWeight);
  }

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
            <Ionicons name="trash-outline" size={20} color="#fff" />
            <Text style={styles.deleteLabel}>Delete</Text>
          </View>
        )}
      </RectButton>
    );
  }

  return (
    <View style={styles.setRowWrapper}>
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        rightThreshold={40}
        overshootRight={false}
        friction={2}
        onSwipeableWillOpen={handleWillOpen}
      >
        <View style={[styles.setRow, saving && styles.setRowSaving]}>
          <Text style={styles.setLabel}>Set {set.setNumber}</Text>
          <TextInput
            style={styles.input}
            value={weight}
            onChangeText={setWeight}
            onEndEditing={persistSet}
            keyboardType="decimal-pad"
            placeholder="Weight"
            placeholderTextColor={homeTheme.colors.textMuted}
            editable={!saving}
          />
          <TextInput
            style={styles.input}
            value={reps}
            onChangeText={setReps}
            onEndEditing={persistSet}
            keyboardType="number-pad"
            placeholder="Reps"
            placeholderTextColor={homeTheme.colors.textMuted}
            editable={!saving}
          />
        </View>
      </Swipeable>
    </View>
  );
}

function WorkoutBlockHeader({
  exercise,
  removing,
  onRemove,
}: {
  exercise: SessionExercise;
  removing: boolean;
  onRemove: () => void;
}) {
  function confirmRemove() {
    Alert.alert(
      'Remove workout block?',
      `Remove "${exercise.name}" and all logged sets from this session?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: onRemove },
      ],
    );
  }

  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text style={styles.title}>{exercise.name}</Text>
        {exercise.targetMuscle ? <Text style={styles.muscle}>{exercise.targetMuscle}</Text> : null}
      </View>
      <Pressable
        style={styles.removeBlockButton}
        onPress={confirmRemove}
        disabled={removing}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${exercise.name}`}
      >
        {removing ? (
          <ActivityIndicator size="small" color={homeTheme.colors.danger} />
        ) : (
          <Ionicons name="trash-outline" size={22} color={homeTheme.colors.danger} />
        )}
      </Pressable>
    </View>
  );
}

export function ExerciseSessionCard({
  workoutId,
  exercise,
  removing = false,
  onSetsChange,
  onRemove,
  onSwipeableWillOpen,
}: ExerciseSessionCardProps) {
  const [adding, setAdding] = useState(false);
  const [savingSetId, setSavingSetId] = useState<string | null>(null);
  const [deletingSetId, setDeletingSetId] = useState<string | null>(null);
  const { close: closeOpenRow, onWillOpen: handleSetSwipeableWillOpen } = useOpenSwipeable();
  const atMaxSets = exercise.sets.length >= MAX_SETS_PER_EXERCISE;
  const setsScrollMaxHeight = VISIBLE_SET_ROWS * SET_ROW_HEIGHT + (VISIBLE_SET_ROWS - 1) * 8;

  function handleSetRowWillOpen(ref: SwipeableRef) {
    handleSetSwipeableWillOpen(ref);
    onSwipeableWillOpen(ref);
  }

  async function handleAddSet() {
    if (atMaxSets) {
      return;
    }

    closeOpenRow();
    setAdding(true);

    try {
      const newSet = await addWorkoutSet(workoutId, exercise.id, 10, null);
      onSetsChange(exercise.id, [...exercise.sets, newSet]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not add set.';
      Alert.alert('Could not add set', message);
    } finally {
      setAdding(false);
    }
  }

  async function handleSaveSet(setId: string, reps: number, weight: number | null) {
    setSavingSetId(setId);

    try {
      await updateWorkoutSet(setId, reps, weight);
      onSetsChange(
        exercise.id,
        exercise.sets.map((set) => (set.id === setId ? { ...set, reps, weight } : set)),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save set.';
      Alert.alert('Could not save set', message);
    } finally {
      setSavingSetId(null);
    }
  }

  async function handleDeleteSet(setId: string) {
    setDeletingSetId(setId);

    try {
      const updatedSets = await deleteExerciseSet(workoutId, exercise.id, setId);
      onSetsChange(exercise.id, updatedSets);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not delete set.';
      Alert.alert('Could not delete set', message);
    } finally {
      setDeletingSetId(null);
    }
  }

  return (
    <View style={styles.card}>
      <WorkoutBlockHeader exercise={exercise} removing={removing} onRemove={onRemove} />

      {exercise.sets.length === 0 ? (
        <Text style={styles.emptySets}>No sets yet. Add your first set below.</Text>
      ) : (
        <>
          <Text style={styles.hint}>Swipe left on a set to delete.</Text>
          <ScrollView
            style={[styles.setsScroll, { maxHeight: setsScrollMaxHeight }]}
            nestedScrollEnabled
            showsVerticalScrollIndicator={exercise.sets.length > VISIBLE_SET_ROWS}
            onScrollBeginDrag={closeOpenRow}
          >
            {exercise.sets.map((set) => (
              <SetRow
                key={set.id}
                set={set}
                saving={savingSetId === set.id}
                deleting={deletingSetId === set.id}
                onSave={handleSaveSet}
                onDelete={() => handleDeleteSet(set.id)}
                onSwipeableWillOpen={handleSetRowWillOpen}
              />
            ))}
          </ScrollView>
        </>
      )}

      <Pressable
        style={[styles.addSetButton, (adding || atMaxSets) && styles.disabled]}
        disabled={adding || atMaxSets}
        onPress={handleAddSet}
      >
        {adding ? (
          <ActivityIndicator color={homeTheme.colors.textPrimary} />
        ) : (
          <Text style={styles.addSetText}>
            {atMaxSets ? `Max ${MAX_SETS_PER_EXERCISE} sets` : 'Add set'}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: homeTheme.colors.surfaceBorder,
    borderRadius: homeTheme.radius.card,
    backgroundColor: homeTheme.colors.surface,
    padding: 14,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  headerText: {
    flex: 1,
  },
  removeBlockButton: {
    padding: 4,
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: homeTheme.colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  muscle: {
    color: homeTheme.colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  emptySets: {
    color: homeTheme.colors.textMuted,
    fontSize: 13,
    marginBottom: 10,
  },
  hint: {
    color: homeTheme.colors.textMuted,
    fontSize: 11,
    marginBottom: 8,
  },
  setsScroll: {
    marginBottom: 10,
  },
  setRowWrapper: {
    marginBottom: 8,
    backgroundColor: homeTheme.colors.surface,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: SET_ROW_HEIGHT,
    backgroundColor: homeTheme.colors.surface,
  },
  setRowSaving: {
    opacity: 0.65,
  },
  setLabel: {
    width: 44,
    color: homeTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: homeTheme.colors.surfaceBorder,
    borderRadius: homeTheme.radius.button,
    paddingVertical: 8,
    paddingHorizontal: 10,
    color: homeTheme.colors.textPrimary,
    backgroundColor: homeTheme.colors.background,
    fontSize: 14,
  },
  deleteAction: {
    width: DELETE_WIDTH,
    backgroundColor: homeTheme.colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 0,
  },
  deleteContent: {
    alignItems: 'center',
    gap: 4,
  },
  deleteLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  addSetButton: {
    borderWidth: 1,
    borderColor: homeTheme.colors.surfaceBorder,
    borderRadius: homeTheme.radius.button,
    paddingVertical: 10,
    alignItems: 'center',
  },
  addSetText: {
    color: homeTheme.colors.textPrimary,
    fontWeight: '600',
    fontSize: 14,
  },
  disabled: {
    opacity: 0.6,
  },
});
