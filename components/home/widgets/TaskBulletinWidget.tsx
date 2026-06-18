import { useEffect, useState } from 'react';
import { getErrorMessage } from '@/lib/userFacingError';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getWidgetSizing } from '@/components/home/widgetSizing';
import { TaskBulletinAddSheet } from '@/components/home/TaskBulletinAddSheet';
import { WidgetCard } from '@/components/home/WidgetCard';
import { homeTheme } from '@/constants/theme';
import { useBulletinTasks } from '@/hooks/useBulletinTasks';
import { formatRecurringResetLabel } from '@/components/home/LocalTimePicker';
import { MAX_BULLETIN_TASKS, type BulletinTask, type BulletinTaskType } from '@/lib/bulletinTasks';
import { registerBulletinAddListener } from '@/lib/bulletinTaskUi';

export function TaskBulletinWidget() {
  const sizing = getWidgetSizing('large');
  const { tasks, recurringTasks, totalCount, loading, mutatingId, addTask, completeTask, removeTask } =
    useBulletinTasks();
  const [addVisible, setAddVisible] = useState(false);

  useEffect(() => {
    registerBulletinAddListener(() => setAddVisible(true));
    return () => registerBulletinAddListener(null);
  }, []);

  function openAddSheet() {
    setAddVisible(true);
  }

  async function handleAdd(title: string, taskType: BulletinTaskType, resetTimeLocal?: string) {
    await addTask(title, taskType, resetTimeLocal);
  }

  function handleDeleteRecurring(task: BulletinTask) {
    Alert.alert('Delete recurring task?', `"${task.title}" will not come back.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void removeTask(task.id).catch((error) => {
            const message = getErrorMessage(error, 'Could not delete task.');
            Alert.alert('Could not delete task', message);
          });
        },
      },
    ]);
  }

  function handleComplete(task: BulletinTask) {
    void completeTask(task).catch((error) => {
      const message = getErrorMessage(error, 'Could not complete task.');
      Alert.alert('Could not complete task', message);
    });
  }

  function handleRemove(task: BulletinTask) {
    Alert.alert('Remove task?', task.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void removeTask(task.id).catch((error) => {
            const message = getErrorMessage(error, 'Could not remove task.');
            Alert.alert('Could not remove task', message);
          });
        },
      },
    ]);
  }

  return (
    <>
      <WidgetCard title="Task bulletin" size="large">
        <View style={styles.content}>
          {loading ? (
            <View style={[styles.scrollArea, { maxHeight: sizing.bodyMaxHeight }]}>
              <ActivityIndicator color={homeTheme.colors.textPrimary} />
            </View>
          ) : tasks.length === 0 ? (
            <View style={[styles.scrollArea, styles.emptyState, { maxHeight: sizing.bodyMaxHeight }]}>
              <Text style={styles.emptyTitle}>No tasks yet</Text>
              <Text style={styles.emptyBody}>Add temporary or recurring tasks to track your day.</Text>
            </View>
          ) : (
            <ScrollView
              style={{ maxHeight: sizing.bodyMaxHeight }}
              contentContainerStyle={styles.listContent}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  busy={mutatingId === task.id}
                  onComplete={() => handleComplete(task)}
                  onRemove={() => handleRemove(task)}
                />
              ))}
            </ScrollView>
          )}

          <View style={styles.footer}>
            <Text style={styles.count}>
              {tasks.length}/{MAX_BULLETIN_TASKS}
            </Text>
            <Pressable
              style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
              onPress={openAddSheet}
              disabled={totalCount >= MAX_BULLETIN_TASKS}
              accessibilityRole="button"
              accessibilityLabel="Add task"
            >
              <Ionicons name="add" size={18} color={homeTheme.colors.primary} />
              <Text style={styles.addButtonText}>Add task</Text>
            </Pressable>
          </View>
        </View>
      </WidgetCard>

      <TaskBulletinAddSheet
        visible={addVisible}
        activeCount={tasks.length}
        totalCount={totalCount}
        recurringTasks={recurringTasks}
        mutatingId={mutatingId}
        onClose={() => setAddVisible(false)}
        onAdd={handleAdd}
        onDeleteRecurring={handleDeleteRecurring}
      />
    </>
  );
}

type TaskRowProps = {
  task: BulletinTask;
  busy: boolean;
  onComplete: () => void;
  onRemove: () => void;
};

function TaskRow({ task, busy, onComplete, onRemove }: TaskRowProps) {
  return (
    <View style={styles.row}>
      <Pressable
        style={({ pressed }) => [styles.checkButton, pressed && styles.checkButtonPressed]}
        onPress={onComplete}
        disabled={busy}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: false }}
        accessibilityLabel={`Complete ${task.title}`}
      >
        {busy ? (
          <ActivityIndicator size="small" color={homeTheme.colors.primary} />
        ) : (
          <Ionicons name="ellipse-outline" size={22} color={homeTheme.colors.primary} />
        )}
      </Pressable>

      <View style={styles.rowText}>
        <Text style={styles.taskTitle} numberOfLines={2}>
          {task.title}
        </Text>
        <Text style={styles.taskMeta}>
          {task.task_type === 'recurring'
            ? formatRecurringResetLabel(task.reset_time_local)
            : 'Temporary'}
        </Text>
      </View>

      <Pressable
        style={({ pressed }) => [styles.removeButton, pressed && styles.checkButtonPressed]}
        onPress={onRemove}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${task.title}`}
      >
        <Ionicons name="close" size={18} color={homeTheme.colors.mutedForeground} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 10,
    flex: 1,
  },
  scrollArea: {
    minHeight: 112,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    paddingHorizontal: 8,
  },
  emptyTitle: {
    color: homeTheme.colors.foreground,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptyBody: {
    color: homeTheme.colors.mutedForeground,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  listContent: {
    gap: 8,
    paddingBottom: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: homeTheme.radius.card,
    borderWidth: 1,
    borderColor: homeTheme.colors.border,
    backgroundColor: homeTheme.colors.card,
  },
  checkButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkButtonPressed: {
    opacity: 0.7,
  },
  rowText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  taskTitle: {
    color: homeTheme.colors.foreground,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  taskMeta: {
    color: homeTheme.colors.mutedForeground,
    fontSize: 11,
    lineHeight: 14,
  },
  removeButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  count: {
    color: homeTheme.colors.mutedForeground,
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  addButtonPressed: {
    opacity: 0.7,
  },
  addButtonText: {
    color: homeTheme.colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
});
