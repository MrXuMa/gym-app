import { useCallback, useEffect, useState } from 'react';
import { getErrorMessage } from '@/lib/userFacingError';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { confirmAsync, notify } from '@/lib/platformAlert';
import { AppScreen } from '@/components/layout/AppScreen';
import { useOpenSwipeable } from '@/hooks/useOpenSwipeable';
import { StartWorkoutModeToggle, type StartWorkoutMode } from '@/components/start-workout/StartWorkoutModeToggle';
import { TemplateListRow } from '@/components/start-workout/TemplateListRow';
import { DEFAULT_WORKOUT_TITLE, isValidWorkoutTitle } from '@/lib/workoutDisplay';
import { getActiveWorkoutSession } from '@/lib/workoutSession';
import { startWorkoutSession } from '@/lib/workouts';
import {
  deleteWorkoutTemplate,
  listWorkoutTemplates,
  startWorkoutFromTemplate,
  type WorkoutTemplateListItem,
} from '@/lib/workoutTemplates';
import { homeTheme } from '@/constants/theme';

export default function StartWorkoutScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<StartWorkoutMode>('blank');
  const [workoutTitle, setWorkoutTitle] = useState('');
  const [templates, setTemplates] = useState<WorkoutTemplateListItem[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [going, setGoing] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const { close: closeOpenSwipe, onWillOpen: handleSwipeableWillOpen } = useOpenSwipeable();

  const loadTemplates = useCallback(async () => {
    setLoadingTemplates(true);

    try {
      const rows = await listWorkoutTemplates();
      setTemplates(rows);
      setSelectedTemplateId((current) =>
        current && rows.some((row) => row.id === current) ? current : null,
      );
    } catch (error) {
      const message = getErrorMessage(error, 'Could not load templates.');
      notify('Could not load templates', message);
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  useEffect(() => {
    async function checkActive() {
      try {
        const active = await getActiveWorkoutSession();
        if (active) {
          router.replace({ pathname: '/workout-session', params: { workoutId: active.id } });
        }
      } catch {
        // User can still start from this screen if check fails.
      }
    }

    void checkActive();
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      void loadTemplates();
    }, [loadTemplates]),
  );

  async function handleGo() {
    setGoing(true);

    try {
      if (mode === 'blank') {
        if (!isValidWorkoutTitle(workoutTitle)) {
          notify('Name too long', 'Workout name must be 80 characters or fewer.');
          return;
        }

        const workoutId = await startWorkoutSession(workoutTitle);
        router.replace({ pathname: '/workout-session', params: { workoutId } });
        return;
      }

      if (!selectedTemplateId) {
        return;
      }

      const workoutId = await startWorkoutFromTemplate(selectedTemplateId);
      router.replace({ pathname: '/workout-session', params: { workoutId } });
    } catch (error) {
      const message = getErrorMessage(error, 'Could not start workout.');
      notify('Could not start workout', message);
    } finally {
      setGoing(false);
    }
  }

  function handleCreateTemplate() {
    router.push('/workout-template/editor' as never);
  }

  function handleEditTemplate(templateId: string) {
    router.push({ pathname: '/workout-template/editor', params: { templateId } } as never);
  }

  async function confirmDeleteTemplate(template: WorkoutTemplateListItem) {
    const confirmed = await confirmAsync({
      title: 'Delete template?',
      message: `Remove "${template.name}"? This cannot be undone.`,
      confirmText: 'Delete',
      destructive: true,
    });
    if (!confirmed) return;

    setDeletingTemplateId(template.id);
    try {
      await deleteWorkoutTemplate(template.id);
      if (selectedTemplateId === template.id) {
        setSelectedTemplateId(null);
      }

      await loadTemplates();
    } catch (error) {
      const message = getErrorMessage(error, 'Could not delete template.');
      notify('Could not delete template', message);
    } finally {
      setDeletingTemplateId(null);
    }
  }

  const canGo = mode === 'blank' || selectedTemplateId !== null;

  return (
    <AppScreen
      title="Start Workout"
      showProfile={false}
      headerLeft={
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Go back">
          <Text style={styles.backButton}>Back</Text>
        </Pressable>
      }
    >
      <View style={styles.body}>
        <StartWorkoutModeToggle mode={mode} onChange={setMode} />

        {mode === 'blank' ? (
          <View style={styles.blankSection}>
            <Text style={styles.label}>Workout name (optional)</Text>
            <TextInput
              style={styles.input}
              value={workoutTitle}
              onChangeText={setWorkoutTitle}
              placeholder={DEFAULT_WORKOUT_TITLE}
              placeholderTextColor={homeTheme.colors.textMuted}
              maxLength={80}
            />
            <Text style={styles.hint}>Leave blank to use “{DEFAULT_WORKOUT_TITLE}”.</Text>
          </View>
        ) : (
          <View style={styles.templateSection}>
            <Text style={styles.sectionTitle}>Your templates</Text>
            <Text style={styles.hint}>Tap to select · long-press to edit · swipe to delete</Text>

            {loadingTemplates ? (
              <ActivityIndicator style={styles.templateLoader} color={homeTheme.colors.textPrimary} />
            ) : templates.length === 0 ? (
              <Text style={styles.emptyTemplates}>No templates yet. Create one below.</Text>
            ) : (
              <FlatList
                data={templates}
                keyExtractor={(item) => item.id}
                style={styles.templateList}
                contentContainerStyle={styles.templateListContent}
                showsVerticalScrollIndicator={false}
                onScrollBeginDrag={closeOpenSwipe}
                renderItem={({ item }) => (
                  <TemplateListRow
                    template={item}
                    selected={selectedTemplateId === item.id}
                    deleting={deletingTemplateId === item.id}
                    onSelect={() => setSelectedTemplateId(item.id)}
                    onEdit={() => handleEditTemplate(item.id)}
                    onDelete={() => void confirmDeleteTemplate(item)}
                    onSwipeableWillOpen={handleSwipeableWillOpen}
                  />
                )}
              />
            )}

            <Pressable style={styles.secondaryButton} onPress={handleCreateTemplate}>
              <Text style={styles.secondaryButtonText}>Create template</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.footer}>
          <Pressable
            style={[styles.goButton, (!canGo || going) && styles.goButtonDisabled]}
            disabled={!canGo || going}
            onPress={() => void handleGo()}
            accessibilityRole="button"
            accessibilityLabel="Go"
          >
            {going ? (
              <ActivityIndicator color={homeTheme.colors.tabBar} />
            ) : (
              <Text style={styles.goButtonText}>Go</Text>
            )}
          </Pressable>
        </View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingHorizontal: homeTheme.spacing.screen,
    paddingTop: 8,
  },
  backButton: {
    color: homeTheme.colors.navYellow,
    fontWeight: '700',
    fontSize: 15,
  },
  blankSection: {
    flex: 1,
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
  hint: {
    color: homeTheme.colors.textMuted,
    fontSize: 13,
    marginTop: 8,
    lineHeight: 18,
  },
  templateSection: {
    flex: 1,
  },
  sectionTitle: {
    color: homeTheme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  templateLoader: {
    marginTop: 24,
  },
  emptyTemplates: {
    color: homeTheme.colors.textMuted,
    fontSize: 14,
    marginTop: 16,
    lineHeight: 20,
  },
  templateList: {
    flex: 1,
    marginTop: 12,
  },
  templateListContent: {
    paddingBottom: 12,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: homeTheme.colors.border,
    borderRadius: homeTheme.radius.button,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  secondaryButtonText: {
    color: homeTheme.colors.textPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
  footer: {
    paddingVertical: 12,
  },
  goButton: {
    backgroundColor: homeTheme.colors.navYellow,
    borderRadius: homeTheme.radius.button,
    paddingVertical: 14,
    alignItems: 'center',
  },
  goButtonDisabled: {
    opacity: 0.45,
  },
  goButtonText: {
    color: homeTheme.colors.tabBar,
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
