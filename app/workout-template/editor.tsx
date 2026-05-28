import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppScreen } from '@/components/layout/AppScreen';
import { useDockedSetEditor } from '@/hooks/useDockedSetEditor';
import { useScrollToDockedCard } from '@/hooks/useScrollToDockedCard';
import { AddExercisePicker, type ExerciseOption } from '@/components/workout-session/AddExercisePicker';
import { type DraggableExerciseListRef } from '@/components/workout-session/DraggableExerciseList';
import { WorkoutExerciseEditorBody } from '@/components/workout-session/WorkoutExerciseEditorBody';
import { createExerciseCardRenderer } from '@/components/workout-session/renderExerciseSessionCard';
import {
  WORKOUT_EDITOR_COPY,
  workoutEditorStyles as styles,
} from '@/components/workout-session/workoutEditorStyles';
import {
  DEFAULT_WORKOUT_TITLE,
  isValidWorkoutTitle,
  resolveWorkoutTitle,
} from '@/lib/workoutDisplay';
import {
  deleteWorkoutTemplate,
  getWorkoutTemplate,
  saveWorkoutTemplate,
} from '@/lib/workoutTemplates';
import type { SessionExercise, WorkoutSetLog } from '@/lib/workoutSession';
import { fetchExerciseCatalog } from '@/lib/exercises';
import {
  acceptCoachTemplateProposal,
  draftToSessionExercises,
  getCoachTemplateProposal,
} from '@/lib/coachTemplate';
import { homeTheme } from '@/constants/theme';

export default function WorkoutTemplateEditorScreen() {
  const router = useRouter();
  const { templateId, proposalId } = useLocalSearchParams<{ templateId?: string; proposalId?: string }>();
  const isEditing = Boolean(templateId);
  const isCoachDraft = Boolean(proposalId) && !templateId;

  const [templateName, setTemplateName] = useState('');
  const [exercises, setExercises] = useState<SessionExercise[]>([]);
  const [allExercises, setAllExercises] = useState<ExerciseOption[]>([]);
  const [coachWarnings, setCoachWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(isEditing || isCoachDraft);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
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

  const loadCoachProposal = useCallback(async () => {
    if (!proposalId) {
      return;
    }

    setLoading(true);

    try {
      const proposal = await getCoachTemplateProposal(proposalId);
      if (proposal.status !== 'completed' || !proposal.templateDraft) {
        throw new Error('Coach template draft is not ready yet.');
      }

      setTemplateName(proposal.templateDraft.name);
      setExercises(draftToSessionExercises(proposal.templateDraft));
      setCoachWarnings(proposal.templateDraft.warnings ?? []);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load coach draft.';
      Alert.alert('Could not load coach draft', message);
      router.back();
    } finally {
      setLoading(false);
    }
  }, [proposalId, router]);

  const loadTemplate = useCallback(async () => {
    if (!templateId) {
      return;
    }

    setLoading(true);

    try {
      const template = await getWorkoutTemplate(templateId);
      setTemplateName(template.name);
      setExercises(template.exercises);
      setCoachWarnings([]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load template.';
      Alert.alert('Could not load template', message);
      router.back();
    } finally {
      setLoading(false);
    }
  }, [router, templateId]);

  useEffect(() => {
    async function bootstrap() {
      setAllExercises(await fetchExerciseCatalog());
    }

    void bootstrap().catch((error) => {
      const message = error instanceof Error ? error.message : 'Could not load exercises.';
      Alert.alert('Could not load exercises', message);
    });
  }, []);

  useEffect(() => {
    if (proposalId) {
      void loadCoachProposal();
      return;
    }

    void loadTemplate();
  }, [loadCoachProposal, loadTemplate, proposalId]);

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

  function handleRemoveExercise(exerciseId: string) {
    setExercises((current) => current.filter((exercise) => exercise.id !== exerciseId));
  }

  async function handleSave() {
    if (!isValidWorkoutTitle(templateName)) {
      Alert.alert('Name too long', 'Template name must be 80 characters or fewer.');
      return;
    }

    if (dockedEditor) {
      Alert.alert('Unsaved set', 'Tap Save on the set editor below before saving this template.');
      return;
    }

    setSaving(true);

    try {
      await saveWorkoutTemplate(templateId ?? null, resolveWorkoutTitle(templateName), exercises);

      if (proposalId) {
        await acceptCoachTemplateProposal(proposalId);
      }

      router.replace('/start-workout' as never);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save template.';
      Alert.alert('Could not save template', message);
    } finally {
      setSaving(false);
    }
  }

  function confirmDeleteTemplate() {
    if (!templateId) {
      return;
    }

    Alert.alert('Delete template?', 'Remove this template permanently?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);

          try {
            await deleteWorkoutTemplate(templateId);
            router.replace('/start-workout' as never);
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Could not delete template.';
            Alert.alert('Could not delete template', message);
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  }

  const renderExercise = useMemo(
    () =>
      createExerciseCardRenderer({
        workoutId: 'template',
        localOnly: true,
        editingExerciseId,
        setEditingExerciseId,
        handleDockedEditorChange,
        handleSetsChange,
        handleRemoveExercise,
      }),
    [editingExerciseId, setEditingExerciseId, handleDockedEditorChange],
  );

  const screenTitle = isCoachDraft ? 'Review Coach Draft' : isEditing ? 'Edit Template' : 'Create Template';

  if (loading) {
    return (
      <AppScreen title={screenTitle} showProfile={false}>
        <ActivityIndicator style={styles.loader} size="large" color={homeTheme.colors.textPrimary} />
      </AppScreen>
    );
  }

  return (
    <AppScreen
      title={screenTitle}
      showProfile={false}
      headerRight={
        <Pressable
          style={saving ? styles.disabled : undefined}
          disabled={saving}
          onPress={() => void handleSave()}
        >
          {saving ? (
            <ActivityIndicator size="small" color={homeTheme.colors.navYellow} />
          ) : (
            <Text style={[styles.headerActionText, styles.headerActionPrimary]}>Save</Text>
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
          onReorder={setExercises}
          onAddExercise={() => setPickerVisible(true)}
          scrollRef={scrollRef}
          renderExercise={renderExercise}
          dockedEditor={dockedEditor}
          dockEditorActions={dockEditorActions}
          header={
            <>
              {isCoachDraft ? (
                <View style={styles.coachBanner}>
                  <Text style={styles.coachBannerTitle}>Coach draft — review before saving</Text>
                  <Text style={styles.coachBannerText}>
                    Same editor as live workouts: reorder blocks, edit sets, then tap Save.
                  </Text>
                  {coachWarnings.length > 0 ? (
                    <Text style={styles.coachBannerWarnings}>{coachWarnings.join(' ')}</Text>
                  ) : null}
                </View>
              ) : null}

              <View style={styles.nameSection}>
                <Text style={styles.fieldLabel}>Template name</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={templateName}
                  onChangeText={setTemplateName}
                  placeholder={DEFAULT_WORKOUT_TITLE}
                  placeholderTextColor={homeTheme.colors.textMuted}
                  maxLength={80}
                />
              </View>
            </>
          }
          secondaryAction={
            isEditing
              ? {
                  label: 'Delete template',
                  onPress: confirmDeleteTemplate,
                  loading: deleting,
                  accessibilityLabel: 'Delete template',
                }
              : undefined
          }
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
