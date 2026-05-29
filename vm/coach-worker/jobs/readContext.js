const { rest } = require('../lib/supabase');

async function readCoachContext(userId) {
  const rows = await rest(
    'GET',
    `coach_context?user_id=eq.${userId}&select=context&limit=1`,
  );
  if (rows[0]?.context) return rows[0].context;

  throw new Error(
    'No coach context in Supabase. Complete a workout (or wait for context sync) so your training summary can be built.',
  );
}

module.exports = { readCoachContext };
