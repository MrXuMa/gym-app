/**
 * Process-level cache for the global exercise catalog.
 *
 * The catalog (~200+ rows) is the same for every user, so storing it in each
 * coach_context blob or fetching it per job is wasteful. This module fetches
 * once per process, refreshes on a TTL, and de-dupes concurrent refreshes.
 */

const TTL_MS = Number(process.env.COACH_CATALOG_TTL_MS || 10 * 60 * 1000);

let cache = null;
let inflight = null;

function groupByMuscle(rows) {
  const grouped = {};

  for (const row of rows ?? []) {
    const name = row.name?.trim();
    if (!name) continue;

    const muscle = row.target_muscle?.trim() || 'Other';
    (grouped[muscle] ??= []).push(name);
  }

  for (const muscle of Object.keys(grouped)) {
    grouped[muscle].sort((a, b) => a.localeCompare(b));
  }

  return grouped;
}

async function fetchCatalog(supabaseRest) {
  const rows = await supabaseRest(
    'GET',
    'exercises?select=id,name,target_muscle&order=name.asc',
  );
  const safe = rows ?? [];

  return {
    rows: safe,
    byMuscle: groupByMuscle(safe),
    count: safe.length,
    fetchedAt: Date.now(),
  };
}

async function loadCatalogCached(supabaseRest, { force = false } = {}) {
  if (!force && cache && Date.now() - cache.fetchedAt < TTL_MS) {
    return cache;
  }

  if (inflight) {
    return inflight;
  }

  inflight = fetchCatalog(supabaseRest)
    .then((next) => {
      cache = next;
      return next;
    })
    .catch((error) => {
      if (cache) {
        console.warn(
          '[coach-worker] catalog refresh failed, serving stale cache:',
          error instanceof Error ? error.message : error,
        );
        return cache;
      }
      throw error;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

module.exports = { loadCatalogCached };
