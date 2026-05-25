import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppScreen } from '@/components/layout/AppScreen';
import { useDockedSetEditor } from '@/hooks/useDockedSetEditor';
import { AddExercisePicker, type ExerciseOption } from '@/components/workout-session/AddExercisePicker';
import { ExerciseSessionCard } from '@/components/workout-session/ExerciseSessionCard';
import { SetEditorDock } from '@/components/workout-session/SetEditorDock';
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

  const {
    editingExerciseId,
    setEditingExerciseId,
    dockedEditor,
    handleDockedEditorChange,
    dockEditorActions,
  } = useDockedSetEditor();

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

  const selectedExerciseIds = exercises.map((exercise) => exercise.id);

  if (loading) {
    return (
      <AppScreen
        title={isCoachDraft ? 'Review Coach Draft' : isEditing ? 'Edit Template' : 'Create Template'}
        showProfile={false}
      >
        <ActivityIndicator style={styles.loader} size="large" color={homeTheme.colors.textPrimary} />
      </AppScreen>
    );
  }

  return (
    <AppScreen
      title={isCoachDraft ? 'Review Coach Draft' : isEditing ? 'Edit Template' : 'Create Template'}
      showProfile={false}
      headerRight={
        <Pressable
          style={[styles.saveHeaderButton, saving && styles.disabled]}
          disabled={saving}
          onPress={() => void handleSave()}
        >
          {saving ? (
            <ActivityIndicator size="small" color={homeTheme.colors.navYellow} />
          ) : (
            <Text style={styles.saveHeaderText}>Save</Text>
          )}
        </Pressable>
      }
    >
      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 4 : 0}
      >
        {isCoachDraft ? (
          <View style={styles.coachBanner}>
            <Text style={styles.coachBannerTitle}>Coach draft — review before saving</Text>
            <Text style={styles.coachBannerText}>
              Edit exercises and sets, then tap Save to add this template to Start Workout.
            </Text>
            {coachWarnings.length > 0 ? (
              <Text style={styles.coachBannerWarnings}>{coachWarnings.join(' ')}</Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.nameSection}>
          <Text style={styles.label}>Template name</Text>
          <TextInput
            style={styles.input}
            value={templateName}
            onChangeText={setTemplateName}
            placeholder={DEFAULT_WORKOUT_TITLE}
            placeholderTextColor={homeTheme.colors.textMuted}
            maxLength={80}
          />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scroll, dockedEditor && styles.scrollWithDock]}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          {exercises.length === 0 ? (
            <Text style={styles.emptyExercises}>Add exercises and default sets for this template.</Text>
          ) : (
            exercises.map((exercise) => (
              <ExerciseSessionCard
                key={exercise.id}
                workoutId="template"
                localOnly
                editingExerciseId={editingExerciseId}
                onEditingExerciseIdChange={setEditingExerciseId}
                onDockedEditorChange={(payload) => handleDockedEditorChange(exercise.id, payload)}
                exercise={exercise}
                onSetsChange={handleSetsChange}
                onRemove={() => handleRemoveExercise(exercise.id)}
              />
            ))
          )}

          <Pressable style={styles.addWorkoutButton} onPress={() => setPickerVisible(true)}>
            <Text style={styles.addWorkoutText}>Add exercise</Text>
          </Pressable>

          {isEditing ? (
            <Pressable
              style={[styles.deleteTemplateButton, deleting && styles.disabled]}
              disabled={deleting}
              onPress={confirmDeleteTemplate}
            >
              {deleting ? (
                <ActivityIndicator size="small" color={homeTheme.colors.danger} />
              ) : (
                <Text style={styles.deleteTemplateText}>Delete template</Text>
              )}
            </Pressable>
          ) : null}
        </ScrollView>

        {dockedEditor ? <SetEditorDock {...dockedEditor} {...dockEditorActions} /> : null}
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
  saveHeaderButton: {
    minWidth: 52,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  saveHeaderText: {
    color: homeTheme.colors.navYellow,
    fontWeight: '700',
    fontSize: 15,
  },
  coachBanner: {
    marginHorizontal: homeTheme.spacing.screen,
    marginTop: 8,
    padding: 12,
    borderRadius: homeTheme.radius.button,
    backgroundColor: homeTheme.colors.card,
    borderWidth: 1,
    borderColor: homeTheme.colors.border,
    gap: 6,
  },
  coachBannerTitle: {
    color: homeTheme.colors.foreground,
    fontSize: 14,
    fontWeight: '700',
  },
  coachBannerText: {
    color: homeTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  coachBannerWarnings: {
    color: homeTheme.colors.destructive,
    fontSize: 12,
    lineHeight: 17,
  },
  nameSection: {
    paddingHorizontal: homeTheme.spacing.screen,
    paddingTop: 8,
    paddingBottom: 12,
  },
  label: {
    color: homeTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: homeTheme.colors.border,
    borderRadius: homeTheme.radius.button,
    backgroundColor: homeTheme.colors.card,
    color: homeTheme.colors.textPrimary,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
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
  deleteTemplateButton: {
    marginTop: 16,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  deleteTemplateText: {
    color: homeTheme.colors.danger,
    fontWeight: '600',
    fontSize: 13,
  },
  disabled: {
    opacity: 0.6,
  },
});
