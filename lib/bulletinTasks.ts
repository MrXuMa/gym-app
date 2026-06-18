import { supabase } from '@/lib/supabase';
import { throwIfSupabaseError } from '@/lib/supabaseError';

export const MAX_BULLETIN_TASKS = 15;

export type BulletinTaskType = 'temporary' | 'recurring';

export type BulletinTask = {
  id: string;
  title: string;
  task_type: BulletinTaskType;
  sort_order: number;
  /** Local clock time (HH:MM:SS) when recurring tasks reset. */
  reset_time_local: string;
  last_completed_at: string | null;
  created_at: string;
  updated_at: string;
};

const TASK_SELECT =
  'id, title, task_type, sort_order, reset_time_local, last_completed_at, created_at, updated_at';

function mapRow(row: Record<string, unknown>): BulletinTask {
  return {
    id: String(row.id),
    title: String(row.title),
    task_type: row.task_type as BulletinTaskType,
    sort_order: Number(row.sort_order),
    reset_time_local: normalizeResetTimeLocal(String(row.reset_time_local ?? '00:00:00')),
    last_completed_at: row.last_completed_at ? String(row.last_completed_at) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export function normalizeResetTimeLocal(value: string): string {
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) {
    return '00:00:00';
  }
  const hours = Math.min(23, Math.max(0, Number(match[1])));
  const minutes = Math.min(59, Math.max(0, Number(match[2])));
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
}

export function parseResetTimeLocal(value: string): { hours: number; minutes: number } {
  const normalized = normalizeResetTimeLocal(value);
  const [hours, minutes] = normalized.split(':').map(Number);
  return { hours, minutes };
}

export function formatResetTimeLocal(value: string): string {
  const { hours, minutes } = parseResetTimeLocal(value);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

export function toResetTimeInput(hours: number, minutes: number): string {
  return normalizeResetTimeLocal(`${hours}:${minutes}`);
}

/** Most recent local reset boundary at or before `now`. */
export function getLastResetBoundary(resetTimeLocal: string, now = new Date()): Date {
  const { hours, minutes } = parseResetTimeLocal(resetTimeLocal);
  const boundary = new Date(now);
  boundary.setHours(hours, minutes, 0, 0);
  if (now.getTime() < boundary.getTime()) {
    boundary.setDate(boundary.getDate() - 1);
  }
  return boundary;
}

export function getNextResetBoundary(resetTimeLocal: string, now = new Date()): Date {
  const last = getLastResetBoundary(resetTimeLocal, now);
  const next = new Date(last);
  next.setDate(next.getDate() + 1);
  return next;
}

export function isRecurringTaskDue(task: BulletinTask, now = new Date()): boolean {
  if (task.task_type !== 'recurring') {
    return true;
  }
  if (!task.last_completed_at) {
    return true;
  }
  const boundary = getLastResetBoundary(task.reset_time_local, now);
  return new Date(task.last_completed_at).getTime() < boundary.getTime();
}

export function isRecurringTaskSnoozed(task: BulletinTask, now = new Date()): boolean {
  return task.task_type === 'recurring' && !isRecurringTaskDue(task, now);
}

export function filterActiveBulletinTasks(tasks: BulletinTask[], now = new Date()): BulletinTask[] {
  return tasks.filter((task) => {
    if (task.task_type === 'temporary') {
      return true;
    }
    return isRecurringTaskDue(task, now);
  });
}

export async function fetchAllBulletinTasks(): Promise<BulletinTask[]> {
  const { data, error } = await supabase
    .from('bulletin_tasks')
    .select(TASK_SELECT)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    throwIfSupabaseError(error, 'Could not load bulletin tasks.');
  }

  return (data ?? []).map(mapRow);
}

export async function fetchBulletinTasks(): Promise<BulletinTask[]> {
  const all = await fetchAllBulletinTasks();
  return filterActiveBulletinTasks(all);
}

export async function addBulletinTask(
  title: string,
  taskType: BulletinTaskType,
  resetTimeLocal = '00:00:00',
): Promise<BulletinTask> {
  const trimmed = title.trim();
  if (!trimmed) {
    throw new Error('Enter a task title.');
  }

  const all = await fetchAllBulletinTasks();
  if (all.length >= MAX_BULLETIN_TASKS) {
    throw new Error(`Maximum ${MAX_BULLETIN_TASKS} tasks on the bulletin.`);
  }

  const active = filterActiveBulletinTasks(all);
  if (active.length >= MAX_BULLETIN_TASKS) {
    throw new Error(`Maximum ${MAX_BULLETIN_TASKS} active tasks on the bulletin.`);
  }

  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError || !userResult.user) {
    throw new Error('Sign in to add tasks.');
  }

  const { data: maxRow } = await supabase
    .from('bulletin_tasks')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const sortOrder = (maxRow?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from('bulletin_tasks')
    .insert({
      user_id: userResult.user.id,
      title: trimmed,
      task_type: taskType,
      sort_order: sortOrder,
      reset_time_local: taskType === 'recurring' ? normalizeResetTimeLocal(resetTimeLocal) : '00:00:00',
    })
    .select(TASK_SELECT)
    .single();

  if (error) {
    if (error.message.includes('bulletin_task_limit')) {
      throw new Error(`Maximum ${MAX_BULLETIN_TASKS} tasks on the bulletin.`);
    }
    throwIfSupabaseError(error, 'Could not add task.');
  }

  return mapRow(data);
}

export async function completeBulletinTask(task: BulletinTask): Promise<void> {
  if (task.task_type === 'temporary') {
    const { error } = await supabase.from('bulletin_tasks').delete().eq('id', task.id);
    if (error) {
      throwIfSupabaseError(error, 'Could not complete task.');
    }
    return;
  }

  const { error } = await supabase
    .from('bulletin_tasks')
    .update({ last_completed_at: new Date().toISOString() })
    .eq('id', task.id);

  if (error) {
    throwIfSupabaseError(error, 'Could not complete task.');
  }
}

export async function deleteBulletinTask(taskId: string): Promise<void> {
  const { error } = await supabase.from('bulletin_tasks').delete().eq('id', taskId);
  if (error) {
    throwIfSupabaseError(error, 'Could not delete task.');
  }
}
