import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Keyboard, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { AppScreen } from '@/components/layout/AppScreen';
import { TaskRow } from '@/components/tasks/TaskRow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { completeTask, createTask, isValidTaskTitle, listTasks, type Task } from '@/lib/tasks';
import { homeTheme } from '@/constants/theme';

export default function TasksScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [draftTitle, setDraftTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    setLoading(true);

    try {
      setTasks(await listTasks());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load tasks.';
      Alert.alert('Could not load tasks', message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadTasks();
    }, [loadTasks]),
  );

  async function handleAddTask() {
    if (!isValidTaskTitle(draftTitle)) {
      Alert.alert('Invalid task', 'Enter a task between 1 and 200 characters.');
      return;
    }

    setCreating(true);

    try {
      const task = await createTask(draftTitle);
      setTasks((current) => [task, ...current]);
      setDraftTitle('');
      Keyboard.dismiss();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not add task.';
      Alert.alert('Could not add task', message);
    } finally {
      setCreating(false);
    }
  }

  async function handleCompleteTask(taskId: string) {
    setCompletingId(taskId);

    try {
      await completeTask(taskId);
      setTasks((current) => current.filter((task) => task.id !== taskId));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not complete task.';
      Alert.alert('Could not complete task', message);
    } finally {
      setCompletingId(null);
    }
  }

  const canAdd = isValidTaskTitle(draftTitle) && !creating;

  return (
    <AppScreen title="Tasks" showCrossWatermark>
      <View style={styles.composer}>
        <Input
          style={styles.input}
          value={draftTitle}
          onChangeText={setDraftTitle}
          placeholder="New task…"
          maxLength={200}
          returnKeyType="done"
          onSubmitEditing={() => {
            if (canAdd) {
              void handleAddTask();
            }
          }}
          editable={!creating}
        />
        <Button label="Add" onPress={() => void handleAddTask()} disabled={!canAdd} loading={creating} />
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={homeTheme.colors.foreground} />
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={styles.emptyText}>No open tasks. Add one above to get started.</Text>
          }
          renderItem={({ item }) => (
            <TaskRow
              task={item}
              completing={completingId === item.id}
              onComplete={() => void handleCompleteTask(item.id)}
            />
          )}
        />
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: homeTheme.spacing.screen,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: homeTheme.colors.border,
  },
  input: {
    flex: 1,
  },
  loader: {
    marginTop: 24,
  },
  list: {
    paddingHorizontal: homeTheme.spacing.screen,
    paddingBottom: 24,
    flexGrow: 1,
  },
  emptyText: {
    color: homeTheme.colors.mutedForeground,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 16,
  },
});
