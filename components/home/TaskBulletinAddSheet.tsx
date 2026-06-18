import { useEffect, useState } from 'react';
import { getErrorMessage } from '@/lib/userFacingError';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LocalTimePicker } from '@/components/home/LocalTimePicker';
import { homeTheme } from '@/constants/theme';
import {
  formatResetTimeLocal,
  getNextResetBoundary,
  isRecurringTaskSnoozed,
  MAX_BULLETIN_TASKS,
  toResetTimeInput,
  type BulletinTask,
  type BulletinTaskType,
} from '@/lib/bulletinTasks';

type TaskBulletinAddSheetProps = {
  visible: boolean;
  activeCount: number;
  totalCount: number;
  recurringTasks: BulletinTask[];
  mutatingId: string | null;
  onClose: () => void;
  onAdd: (title: string, taskType: BulletinTaskType, resetTimeLocal?: string) => Promise<void>;
  onDeleteRecurring: (task: BulletinTask) => void;
};

const TASK_TYPES: { id: BulletinTaskType; label: string; hint: string }[] = [
  {
    id: 'temporary',
    label: 'Temporary',
    hint: 'Check off once and it is removed.',
  },
  {
    id: 'recurring',
    label: 'Recurring',
    hint: 'Comes back at the time you choose.',
  },
];

export function TaskBulletinAddSheet({
  visible,
  activeCount,
  totalCount,
  recurringTasks,
  mutatingId,
  onClose,
  onAdd,
  onDeleteRecurring,
}: TaskBulletinAddSheetProps) {
  const [title, setTitle] = useState('');
  const [taskType, setTaskType] = useState<BulletinTaskType>('temporary');
  const [resetHours, setResetHours] = useState(6);
  const [resetMinutes, setResetMinutes] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) {
      setTitle('');
      setTaskType('temporary');
      setResetHours(6);
      setResetMinutes(0);
      setSaving(false);
    }
  }, [visible]);

  async function handleSave() {
    if (totalCount >= MAX_BULLETIN_TASKS) {
      Alert.alert('Task limit reached', `You can have up to ${MAX_BULLETIN_TASKS} tasks saved.`);
      return;
    }

    if (activeCount >= MAX_BULLETIN_TASKS) {
      Alert.alert('Task limit reached', `You can have up to ${MAX_BULLETIN_TASKS} active tasks on the bulletin.`);
      return;
    }

    setSaving(true);
    try {
      const resetTimeLocal =
        taskType === 'recurring' ? toResetTimeInput(resetHours, resetMinutes) : undefined;
      await onAdd(title, taskType, resetTimeLocal);
      onClose();
    } catch (error) {
      const message = getErrorMessage(error, 'Could not add task.');
      Alert.alert('Could not add task', message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Add task</Text>
            <Text style={styles.subtitle}>
              {activeCount}/{MAX_BULLETIN_TASKS} active · {totalCount}/{MAX_BULLETIN_TASKS} saved
            </Text>
          </View>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={28} color={homeTheme.colors.foreground} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.form}>
            <Text style={styles.label}>Task</Text>
            <Input
              value={title}
              onChangeText={setTitle}
              placeholder="What do you need to do?"
              maxLength={200}
            />

            <Text style={styles.label}>Type</Text>
            <View style={styles.typeRow}>
              {TASK_TYPES.map((option) => {
                const selected = taskType === option.id;
                return (
                  <Pressable
                    key={option.id}
                    style={[styles.typeCard, selected && styles.typeCardSelected]}
                    onPress={() => setTaskType(option.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <Text style={[styles.typeLabel, selected && styles.typeLabelSelected]}>{option.label}</Text>
                    <Text style={styles.typeHint}>{option.hint}</Text>
                  </Pressable>
                );
              })}
            </View>

            {taskType === 'recurring' ? (
              <>
                <Text style={styles.label}>Comes back at</Text>
                <LocalTimePicker
                  hours={resetHours}
                  minutes={resetMinutes}
                  onChange={(hours, minutes) => {
                    setResetHours(hours);
                    setResetMinutes(minutes);
                  }}
                />
              </>
            ) : null}

            <Button
              label={saving ? 'Adding…' : 'Add to bulletin'}
              onPress={() => void handleSave()}
              disabled={saving || title.trim().length === 0}
              fullWidth
            />
          </View>

          <View style={styles.recurringSection}>
            <Text style={styles.sectionTitle}>Your recurring tasks</Text>
            <Text style={styles.sectionHint}>
              Completed recurring tasks stay here until they come back. Delete any you no longer need.
            </Text>

            {recurringTasks.length === 0 ? (
              <Text style={styles.emptyRecurring}>No recurring tasks saved yet.</Text>
            ) : (
              <View style={styles.recurringList}>
                {recurringTasks.map((task) => (
                  <RecurringTaskRow
                    key={task.id}
                    task={task}
                    busy={mutatingId === task.id}
                    onDelete={() => onDeleteRecurring(task)}
                  />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

type RecurringTaskRowProps = {
  task: BulletinTask;
  busy: boolean;
  onDelete: () => void;
};

function RecurringTaskRow({ task, busy, onDelete }: RecurringTaskRowProps) {
  const snoozed = isRecurringTaskSnoozed(task);
  const statusText = snoozed
    ? `Comes back ${formatResetTimeLocal(task.reset_time_local)} · ${formatNextReturn(task)}`
    : `On bulletin · resets ${formatResetTimeLocal(task.reset_time_local)}`;

  return (
    <View style={styles.recurringRow}>
      <View style={styles.recurringText}>
        <Text style={styles.recurringTitle} numberOfLines={2}>
          {task.title}
        </Text>
        <Text style={styles.recurringMeta} numberOfLines={2}>
          {statusText}
        </Text>
      </View>
      <Pressable
        style={({ pressed }) => [styles.deleteButton, pressed && styles.deleteButtonPressed]}
        onPress={onDelete}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={`Delete recurring task ${task.title}`}
      >
        {busy ? (
          <ActivityIndicator size="small" color={homeTheme.colors.destructive} />
        ) : (
          <Ionicons name="trash-outline" size={18} color={homeTheme.colors.destructive} />
        )}
      </Pressable>
    </View>
  );
}

function formatNextReturn(task: BulletinTask): string {
  const next = getNextResetBoundary(task.reset_time_local);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const isToday =
    next.getFullYear() === today.getFullYear() &&
    next.getMonth() === today.getMonth() &&
    next.getDate() === today.getDate();
  const isTomorrow =
    next.getFullYear() === tomorrow.getFullYear() &&
    next.getMonth() === tomorrow.getMonth() &&
    next.getDate() === tomorrow.getDate();

  const time = formatResetTimeLocal(task.reset_time_local);
  if (isToday) {
    return `today at ${time}`;
  }
  if (isTomorrow) {
    return `tomorrow at ${time}`;
  }
  return next.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: homeTheme.colors.background,
    paddingTop: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
    paddingHorizontal: homeTheme.spacing.screen,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: homeTheme.colors.foreground,
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    color: homeTheme.colors.mutedForeground,
    fontSize: 14,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: homeTheme.spacing.screen,
    paddingBottom: 32,
    gap: 24,
  },
  form: {
    gap: 12,
  },
  label: {
    color: homeTheme.colors.mutedForeground,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 4,
  },
  typeRow: {
    gap: 10,
  },
  typeCard: {
    borderWidth: 1,
    borderColor: homeTheme.colors.border,
    borderRadius: homeTheme.radius.card,
    backgroundColor: homeTheme.colors.card,
    padding: 14,
    gap: 4,
  },
  typeCardSelected: {
    borderColor: homeTheme.colors.primary,
  },
  typeLabel: {
    color: homeTheme.colors.foreground,
    fontSize: 15,
    fontWeight: '600',
  },
  typeLabelSelected: {
    color: homeTheme.colors.primary,
  },
  typeHint: {
    color: homeTheme.colors.mutedForeground,
    fontSize: 12,
    lineHeight: 16,
  },
  recurringSection: {
    gap: 10,
  },
  sectionTitle: {
    color: homeTheme.colors.foreground,
    fontSize: 16,
    fontWeight: '700',
  },
  sectionHint: {
    color: homeTheme.colors.mutedForeground,
    fontSize: 13,
    lineHeight: 18,
  },
  emptyRecurring: {
    color: homeTheme.colors.mutedForeground,
    fontSize: 13,
    fontStyle: 'italic',
  },
  recurringList: {
    gap: 8,
  },
  recurringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: homeTheme.radius.card,
    borderWidth: 1,
    borderColor: homeTheme.colors.border,
    backgroundColor: homeTheme.colors.card,
  },
  recurringText: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  recurringTitle: {
    color: homeTheme.colors.foreground,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  recurringMeta: {
    color: homeTheme.colors.mutedForeground,
    fontSize: 11,
    lineHeight: 14,
  },
  deleteButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonPressed: {
    opacity: 0.7,
  },
});
