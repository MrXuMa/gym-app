const { rest } = require('../lib/supabase');
const { rebuildUserCoachContext } = require('../context/merge');

async function pollContextSync() {
  try {
    const rows = await rest(
      'GET',
      'coach_user_sync_state?needs_sync=eq.true&select=user_id&order=sync_requested_at.asc&limit=3',
    );

    for (const row of rows) {
      try {
        const result = await rebuildUserCoachContext(row.user_id, rest);
        await rest('PATCH', `coach_user_sync_state?user_id=eq.${row.user_id}`, {
          body: { needs_sync: false },
        });
        console.log(
          `[coach-worker] context rebuilt user=${row.user_id} sessions=${result.sessionCount}`,
        );
      } catch (syncError) {
        console.error(
          `[coach-worker] context rebuild failed user=${row.user_id}:`,
          syncError instanceof Error ? syncError.message : syncError,
        );
      }
    }
  } catch (error) {
    console.error(
      '[coach-worker] context sync poll error:',
      error instanceof Error ? error.message : error,
    );
  }
}

module.exports = { pollContextSync };
