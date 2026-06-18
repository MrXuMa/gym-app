import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  addBulletinTask,
  completeBulletinTask,
  deleteBulletinTask,
  fetchAllBulletinTasks,
  filterActiveBulletinTasks,
  type BulletinTask,
  type BulletinTaskType,
} from '@/lib/bulletinTasks';

export function useBulletinTasks() {
  const [tasks, setTasks] = useState<BulletinTask[]>([]);
  const [recurringTasks, setRecurringTasks] = useState<BulletinTask[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [mutatingId, setMutatingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const all = await fetchAllBulletinTasks();
    setTotalCount(all.length);
    setRecurringTasks(all.filter((task) => task.task_type === 'recurring'));
    setTasks(filterActiveBulletinTasks(all));
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      void (async () => {
        try {
          const all = await fetchAllBulletinTasks();
          if (!cancelled) {
            setTotalCount(all.length);
            setRecurringTasks(all.filter((task) => task.task_type === 'recurring'));
            setTasks(filterActiveBulletinTasks(all));
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      })();

      return () => {
        cancelled = true;
      };
    }, []),
  );

  const addTask = useCallback(
    async (title: string, taskType: BulletinTaskType, resetTimeLocal?: string) => {
      const created = await addBulletinTask(title, taskType, resetTimeLocal);
      const all = await fetchAllBulletinTasks();
      setTotalCount(all.length);
      setRecurringTasks(all.filter((task) => task.task_type === 'recurring'));
      setTasks(filterActiveBulletinTasks(all));
      return created;
    },
    [],
  );

  const completeTask = useCallback(async (task: BulletinTask) => {
    setMutatingId(task.id);
    try {
      await completeBulletinTask(task);
      const all = await fetchAllBulletinTasks();
      setTotalCount(all.length);
      setRecurringTasks(all.filter((row) => row.task_type === 'recurring'));
      setTasks(filterActiveBulletinTasks(all));
    } finally {
      setMutatingId(null);
    }
  }, []);

  const removeTask = useCallback(async (taskId: string) => {
    setMutatingId(taskId);
    try {
      await deleteBulletinTask(taskId);
      const all = await fetchAllBulletinTasks();
      setTotalCount(all.length);
      setRecurringTasks(all.filter((row) => row.task_type === 'recurring'));
      setTasks(filterActiveBulletinTasks(all));
    } finally {
      setMutatingId(null);
    }
  }, []);

  return {
    tasks,
    recurringTasks,
    totalCount,
    loading,
    mutatingId,
    reload,
    addTask,
    completeTask,
    removeTask,
  };
}
