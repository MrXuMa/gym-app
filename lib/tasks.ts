import { supabase } from '@/lib/supabase';

export type Task = {
  id: string;
  title: string;
  createdAt: string;
};

const MAX_TASK_TITLE_LENGTH = 200;

export function normalizeTaskTitle(title: string) {
  return title.trim();
}

export function isValidTaskTitle(title: string) {
  const normalized = normalizeTaskTitle(title);
  return normalized.length >= 1 && normalized.length <= MAX_TASK_TITLE_LENGTH;
}

export async function listTasks(): Promise<Task[]> {
  const { data, error } = await supabase
    .from('user_tasks')
    .select('id, title, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
  }));
}

export async function createTask(title: string): Promise<Task> {
  const normalized = normalizeTaskTitle(title);

  if (!isValidTaskTitle(normalized)) {
    throw new Error('Task must be 1–200 characters.');
  }

  const { data, error } = await supabase
    .from('user_tasks')
    .insert({ title: normalized })
    .select('id, title, created_at')
    .single();

  if (error) {
    throw error;
  }

  return {
    id: data.id,
    title: data.title,
    createdAt: data.created_at,
  };
}

/** Mark done by removing the task from the open list. */
export async function completeTask(taskId: string): Promise<void> {
  const { error } = await supabase.from('user_tasks').delete().eq('id', taskId);

  if (error) {
    throw error;
  }
}
