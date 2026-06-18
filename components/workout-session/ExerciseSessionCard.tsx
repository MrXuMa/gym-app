import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getErrorMessage } from '@/lib/userFacingError';
import {
  addWorkoutSet,
  deleteExerciseSet,
  MAX_SETS_PER_EXERCISE,
  updateWorkoutSet,
  type SessionExercise,
  type WorkoutSetLog,
} from '@/lib/workoutSession';
import { homeTheme } from '@/constants/theme';
import type { DockedSetEditorPayload } from '@/components/workout-session/SetEditorDock';
import { WorkoutDragHandle } from '@/components/workout-session/WorkoutDragHandle';

const CIRCLE_SIZE = 44;

export type DraftWorkoutSet = WorkoutSetLog & { isDraft: true };

type ExerciseSessionCardProps = {
  workoutId: string;
  exercise: SessionExercise;
  localOnly?: boolean;
  removing?: boolean;
  drag?: () => void;
  isDragging?: boolean;
  editingExerciseId?: string | null;
  onEditingExerciseIdChange?: (exerciseId: string | null) => void;
  onDockedEditorChange: (payload: DockedSetEditorPayload | null) => void;
  onSetsChange: (exerciseId: string, sets: WorkoutSetLog[]) => void;
  onRemove: () => void;
};

function isDraftSet(set: WorkoutSetLog | DraftWorkoutSet): set is DraftWorkoutSet {
  if ('isDraft' in set && set.isDraft === true) {
    return true;
  }

  return set.id.startsWith('draft-');
}

function createDraftId() {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function parseReps(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  return /^\d+$/.test(value.trim()) ? Number.parseInt(value, 10) : Number.NaN;
}

function parseWeight(value: string) {
  if (!value.trim()) {
    return null;
  }

  return /^\d+(\.\d+)?$/.test(value.trim()) ? Number.parseFloat(value) : Number.NaN;
}

function hasLoggedReps(reps: number | null): boolean {
  return reps != null && Number.isFinite(reps) && reps > 0;
}

function isIncompleteSet(set: WorkoutSetLog | DraftWorkoutSet): boolean {
  return isDraftSet(set) || !hasLoggedReps(set.reps);
}

/** Saved sets first (by stored order), then drafts — labels are always 1…n by index. */
function buildAllSets(saved: WorkoutSetLog[], drafts: DraftWorkoutSet[]) {
  return [
    ...[...saved].sort((a, b) => a.setNumber - b.setNumber),
    ...drafts,
  ];
}

function renumberDrafts(drafts: DraftWorkoutSet[], savedCount: number) {
  return drafts.map((set, index) => ({
    ...set,
    setNumber: savedCount + index + 1,
  }));
}

function renumberSavedSets(sets: WorkoutSetLog[]) {
  return sets.map((set, index) => ({
    ...set,
    setNumber: index + 1,
  }));
}

function WorkoutBlockHeader({
  exercise,
  removing,
  atMaxSets,
  canDeleteSet,
  deletingSet,
  onAddSet,
  onDeleteSet,
  onRemoveBlock,
}: {
  exercise: SessionExercise;
  removing: boolean;
  atMaxSets: boolean;
  canDeleteSet: boolean;
  deletingSet: boolean;
  onAddSet: () => void;
  onDeleteSet: () => void;
  onRemoveBlock: () => void;
}) {
  function confirmRemoveBlock() {
    Alert.alert(
      'Remove workout block?',
      `Remove "${exercise.name}" and all logged sets from this session?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: onRemoveBlock },
      ],
    );
  }

  return (
    <View style={styles.header}>
      <Pressable
        style={styles.blockRemoveButton}
        onPress={confirmRemoveBlock}
        disabled={removing}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${exercise.name} block`}
      >
        {removing ? (
          <ActivityIndicator size="small" color={homeTheme.colors.danger} />
        ) : (
          <Ionicons name="trash-outline" size={20} color={homeTheme.colors.danger} />
        )}
      </Pressable>

      <View style={styles.headerText}>
        <Text style={styles.title}>{exercise.name}</Text>
        {exercise.targetMuscle ? <Text style={styles.muscle}>{exercise.targetMuscle}</Text> : null}
      </View>

      <Pressable
        style={[styles.headerIconButton, !canDeleteSet && styles.headerIconDisabled]}
        onPress={onDeleteSet}
        disabled={!canDeleteSet || deletingSet}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Delete selected set"
      >
        {deletingSet ? (
          <ActivityIndicator size="small" color={homeTheme.colors.textMuted} />
        ) : (
          <Ionicons
            name="trash-outline"
            size={20}
            color={canDeleteSet ? homeTheme.colors.textPrimary : homeTheme.colors.textMuted}
          />
        )}
      </Pressable>

      <Pressable
        style={[styles.headerIconButton, atMaxSets && styles.headerIconDisabled]}
        onPress={onAddSet}
        disabled={atMaxSets}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Add set"
      >
        <Ionicons
          name="add"
          size={26}
          color={atMaxSets ? homeTheme.colors.textMuted : homeTheme.colors.navYellow}
        />
      </Pressable>
    </View>
  );
}

export function ExerciseSessionCard({
  workoutId,
  exercise,
  localOnly = false,
  removing = false,
  drag,
  isDragging = false,
  editingExerciseId = null,
  onEditingExerciseIdChange,
  onDockedEditorChange,
  onSetsChange,
  onRemove,
}: ExerciseSessionCardProps) {
  const [draftSets, setDraftSets] = useState<DraftWorkoutSet[]>([]);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [editorReps, setEditorReps] = useState('');
  const [editorWeight, setEditorWeight] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingSet, setDeletingSet] = useState(false);

  const allSets = useMemo(
    () => (localOnly ? [...exercise.sets].sort((a, b) => a.setNumber - b.setNumber) : buildAllSets(exercise.sets, draftSets)),
    [draftSets, exercise.sets, localOnly],
  );

  const atMaxSets = allSets.length >= MAX_SETS_PER_EXERCISE;
  const isEditingThisCard = editingExerciseId === null || editingExerciseId === exercise.id;
  const activeSelectedSetId = isEditingThisCard ? selectedSetId : null;
  const selectedSet = allSets.find((set) => set.id === activeSelectedSetId) ?? null;
  const selectedDisplayNumber =
    activeSelectedSetId === null ? null : allSets.findIndex((set) => set.id === activeSelectedSetId) + 1;
  const canDeleteSet = selectedSet !== null;
  const dockPublishKeyRef = useRef<string | null>(null);

  useEffect(() => {
    setDraftSets([]);
    setSelectedSetId(null);
    setEditorReps('');
    setEditorWeight('');
    dockPublishKeyRef.current = null;
  }, [exercise.id]);

  useEffect(() => {
    if (editingExerciseId !== null && editingExerciseId !== exercise.id) {
      setSelectedSetId(null);
    }
  }, [editingExerciseId, exercise.id]);

  useEffect(() => {
    if (!selectedSet) {
      setEditorReps('');
      setEditorWeight('');
      return;
    }

    setEditorReps(selectedSet.reps === null ? '' : String(selectedSet.reps));
    setEditorWeight(selectedSet.weight === null ? '' : String(selectedSet.weight));
  }, [selectedSet]);

  function addDraftSet() {
    if (atMaxSets) {
      return;
    }

    const nextSetNumber = allSets.length + 1;

    if (localOnly) {
      const newSet: WorkoutSetLog = {
        id: createDraftId(),
        exerciseId: exercise.id,
        setNumber: nextSetNumber,
        reps: null,
        weight: null,
      };
      onSetsChange(exercise.id, renumberSavedSets([...exercise.sets, newSet]));
      setSelectedSetId(newSet.id);
      onEditingExerciseIdChange?.(exercise.id);
      return;
    }

    const draft: DraftWorkoutSet = {
      id: createDraftId(),
      exerciseId: exercise.id,
      setNumber: nextSetNumber,
      reps: null,
      weight: null,
      isDraft: true,
    };

    setDraftSets((current) => [...current, draft]);
    setSelectedSetId(draft.id);
    onEditingExerciseIdChange?.(exercise.id);
  }

  function selectSet(setId: string) {
    setSelectedSetId(setId);
    onEditingExerciseIdChange?.(exercise.id);
  }

  const finishEditing = useCallback(() => {
    setSelectedSetId(null);
    onEditingExerciseIdChange?.(null);
    dockPublishKeyRef.current = null;
    onDockedEditorChange(null);
  }, [onDockedEditorChange, onEditingExerciseIdChange]);

  function confirmDeleteSelectedSet() {
    if (!selectedSet) {
      return;
    }

    Alert.alert('Delete set?', `Remove set ${selectedDisplayNumber} from this block?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void handleDeleteSelectedSet();
        },
      },
    ]);
  }

  async function handleDeleteSelectedSet() {
    if (!selectedSet) {
      return;
    }

    setDeletingSet(true);

    try {
      if (isDraftSet(selectedSet)) {
        if (localOnly) {
          const remaining = exercise.sets.filter((set) => set.id !== selectedSet.id);
          onSetsChange(exercise.id, renumberSavedSets(remaining));
          finishEditing();
          return;
        }

        setDraftSets((current) => {
          const remaining = current.filter((set) => set.id !== selectedSet.id);
          return renumberDrafts(remaining, exercise.sets.length);
        });
        finishEditing();
        return;
      }

      if (localOnly) {
        const remaining = exercise.sets.filter((set) => set.id !== selectedSet.id);
        onSetsChange(exercise.id, renumberSavedSets(remaining));
        finishEditing();
        return;
      }

      const updatedSets = await deleteExerciseSet(workoutId, exercise.id, selectedSet.id);
      onSetsChange(exercise.id, renumberSavedSets(updatedSets));
      setDraftSets((current) => renumberDrafts(current, updatedSets.length));
      finishEditing();
    } catch (error) {
      const message = getErrorMessage(error, 'Could not delete set.');
      Alert.alert('Could not delete set', message);
    } finally {
      setDeletingSet(false);
    }
  }

  const handleSaveSet = useCallback(async () => {
    if (!selectedSet) {
      return;
    }

    const parsedReps = parseReps(editorReps);
    const parsedWeight = parseWeight(editorWeight);

    if (parsedReps !== null && (!Number.isFinite(parsedReps) || parsedReps <= 0)) {
      Alert.alert('Invalid reps', 'Reps must be empty or a positive whole number.');
      return;
    }

    if (parsedWeight !== null && (!Number.isFinite(parsedWeight) || parsedWeight < 0)) {
      Alert.alert('Invalid weight', 'Weight must be empty or a non-negative number.');
      return;
    }

    setSaving(true);

    try {
      if (localOnly) {
        onSetsChange(
          exercise.id,
          renumberSavedSets(
            exercise.sets.map((set) => {
              if (set.id !== selectedSet.id) {
                return set;
              }

              return {
                ...set,
                id: isDraftSet(set) ? `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}` : set.id,
                reps: parsedReps,
                weight: parsedWeight,
              };
            }),
          ),
        );
      } else if (isDraftSet(selectedSet)) {
        const newSet = await addWorkoutSet(workoutId, exercise.id, parsedReps, parsedWeight);
        const remainingDrafts = draftSets.filter((set) => set.id !== selectedSet.id);
        onSetsChange(
          exercise.id,
          renumberSavedSets([...exercise.sets, newSet]),
        );
        setDraftSets(renumberDrafts(remainingDrafts, exercise.sets.length + 1));
      } else if (parsedReps !== selectedSet.reps || parsedWeight !== selectedSet.weight) {
        await updateWorkoutSet(selectedSet.id, parsedReps, parsedWeight);
        onSetsChange(
          exercise.id,
          exercise.sets.map((set) =>
            set.id === selectedSet.id ? { ...set, reps: parsedReps, weight: parsedWeight } : set,
          ),
        );
      }

      Keyboard.dismiss();
      setSaving(false);
      finishEditing();
    } catch (error) {
      const message = getErrorMessage(error, 'Could not save set.');
      Alert.alert('Could not save set', message);
      setSaving(false);
    }
  }, [
    selectedSet,
    editorReps,
    editorWeight,
    workoutId,
    exercise.id,
    exercise.sets,
    draftSets,
    localOnly,
    onSetsChange,
    finishEditing,
  ]);

  useEffect(() => {
    const isOwner = editingExerciseId === exercise.id;

    if (!isOwner) {
      dockPublishKeyRef.current = null;
      return;
    }

    if (!selectedSet || selectedDisplayNumber === null) {
      if (dockPublishKeyRef.current !== null) {
        dockPublishKeyRef.current = null;
        onDockedEditorChange(null);
      }
      return;
    }

    const publishKey = `${selectedSet.id}:${selectedDisplayNumber}:${editorReps}:${editorWeight}:${saving}`;
    if (dockPublishKeyRef.current === publishKey) {
      return;
    }

    dockPublishKeyRef.current = publishKey;
    onDockedEditorChange({
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      displayNumber: selectedDisplayNumber,
      reps: editorReps,
      weight: editorWeight,
      saving,
      onChangeReps: setEditorReps,
      onChangeWeight: setEditorWeight,
      onSave: () => {
        void handleSaveSet();
      },
      onClose: finishEditing,
    });
  }, [
    editingExerciseId,
    selectedSet,
    selectedDisplayNumber,
    editorReps,
    editorWeight,
    saving,
    exercise.id,
    exercise.name,
    onDockedEditorChange,
    finishEditing,
    handleSaveSet,
  ]);

  function getCircleOpacity(set: WorkoutSetLog | DraftWorkoutSet) {
    if (set.id === activeSelectedSetId) {
      return 1;
    }

    // Incomplete sets (null reps) stay fully opaque so they are easy to spot before end workout.
    if (isIncompleteSet(set)) {
      return 1;
    }

    return 0.38;
  }

  return (
    <View style={styles.cardRow}>
      {drag ? <WorkoutDragHandle onDrag={drag} disabled={removing} /> : null}
      <View style={[styles.card, isDragging && styles.cardDragging, drag && styles.cardWithHandle]}>
      <WorkoutBlockHeader
        exercise={exercise}
        removing={removing}
        atMaxSets={atMaxSets}
        canDeleteSet={canDeleteSet}
        deletingSet={deletingSet}
        onAddSet={addDraftSet}
        onDeleteSet={confirmDeleteSelectedSet}
        onRemoveBlock={onRemove}
      />

      {allSets.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.circlesRow}
          style={styles.circlesScroll}
        >
          {allSets.map((set, index) => {
            const isSelected = set.id === activeSelectedSetId;
            const isSaved = !isDraftSet(set);
            const incomplete = isIncompleteSet(set);
            const displayNumber = index + 1;
            const statusLabel = !isSaved
              ? ', draft'
              : incomplete
                ? ', incomplete, removed when workout ends'
                : ', saved';

            return (
              <Pressable
                key={set.id}
                style={[
                  styles.setCircle,
                  incomplete && !isSelected && styles.setCircleIncomplete,
                  isSelected && styles.setCircleSelected,
                  { opacity: getCircleOpacity(set) },
                ]}
                onPress={() => selectSet(set.id)}
                accessibilityRole="button"
                accessibilityLabel={`Set ${displayNumber}${statusLabel}`}
                accessibilityState={{ selected: isSelected }}
              >
                <Text style={[styles.setCircleText, isSelected && styles.setCircleTextSelected]}>
                  {displayNumber}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 12,
  },
  card: {
    flex: 1,
    borderWidth: 1,
    borderColor: homeTheme.colors.border,
    borderRadius: homeTheme.radius.card,
    backgroundColor: homeTheme.colors.card,
    padding: 14,
  },
  cardWithHandle: {
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  cardDragging: {
    borderColor: homeTheme.colors.primary,
    shadowColor: homeTheme.colors.primary,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
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
  blockRemoveButton: {
    width: 32,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconDisabled: {
    opacity: 0.45,
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
  circlesScroll: {
    marginBottom: 4,
  },
  circlesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  setCircle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    borderWidth: 1.5,
    borderColor: homeTheme.colors.border,
    backgroundColor: homeTheme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setCircleIncomplete: {
    borderColor: homeTheme.colors.mutedForeground,
    borderStyle: 'dashed',
  },
  setCircleSelected: {
    borderColor: homeTheme.colors.primary,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  setCircleText: {
    color: homeTheme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  setCircleTextSelected: {
    color: homeTheme.colors.primary,
  },
});
