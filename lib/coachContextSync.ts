/**
 * Debounced coach context rebuild via Supabase queue (workout complete/delete).
 */

import { supabase } from '@/lib/supabase';

export async function enqueueCoachContextSync(): Promise<void> {
  const { error } = await supabase.rpc('enqueue_coach_context_sync');

  if (error) {
    console.warn('[coach] context sync enqueue failed:', error.message);
    return;
  }

  if (__DEV__) {
    console.log('[coach] context sync enqueued');
  }
}
