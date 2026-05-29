const { rest } = require('./supabase');

async function patchRow(table, id, patch) {
  const rows = await rest('PATCH', `${table}?id=eq.${id}`, {
    body: patch,
    prefer: 'return=representation',
  });
  return rows?.[0] ?? null;
}

async function markFailed(table, id, error, label) {
  const message = error instanceof Error ? error.message : `${label} failed`;
  console.error(`[coach-worker] ${label} ${id}: ${message}`);
  try {
    await patchRow(table, id, {
      status: 'failed',
      error: message,
      completed_at: new Date().toISOString(),
    });
  } catch (patchError) {
    console.error(`[coach-worker] could not mark ${label} ${id} failed:`, patchError);
  }
}

async function claimPending({ table, limit, label, handler }) {
  try {
    const rows = await rest(
      'GET',
      `${table}?status=eq.pending&select=id&order=created_at.asc&limit=${limit}`,
    );

    for (const row of rows) {
      try {
        const claimed = await rest('PATCH', `${table}?id=eq.${row.id}&status=eq.pending`, {
          body: { status: 'running' },
          prefer: 'return=representation',
        });
        if (claimed?.[0]) {
          console.log(`[coach-worker] ${label} ${row.id}`);
          await handler(row.id);
        }
      } catch (err) {
        console.error(`[coach-worker] ${label} ${row.id} error:`, err);
      }
    }
  } catch (err) {
    console.error(`[coach-worker] ${label} poll error:`, err instanceof Error ? err.message : err);
  }
}

async function resetStaleRunning({ table, label }) {
  try {
    const rows = await rest('GET', `${table}?status=eq.running&select=id&order=created_at.asc`);
    for (const row of rows ?? []) {
      await patchRow(table, row.id, { status: 'pending' });
      console.log(`[coach-worker] reset stale ${label} ${row.id} → pending`);
    }
  } catch (err) {
    console.error(`[coach-worker] reset stale ${label}:`, err instanceof Error ? err.message : err);
  }
}

function startPoller({ table, limit, label, handler, intervalMs }) {
  void claimPending({ table, limit, label, handler });
  setInterval(() => void claimPending({ table, limit, label, handler }), intervalMs);
}

module.exports = { patchRow, markFailed, claimPending, resetStaleRunning, startPoller };
