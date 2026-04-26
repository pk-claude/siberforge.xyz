// FRED source — direct API (not via Vercel proxy) since we have FRED_API_KEY in env.
import { fetchWithRetry, pMapLimit } from '../lib/http.mjs';

const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations';

export const id = 'fred';

/**
 * fetch({ entries, env })
 *   entries: array of indicator entries with source==='fred' and sourceId set
 *   env: process.env-like object
 * returns: { results: { [id]: { ok, observations?, error? } } }
 */
export async function fetch({ entries, env }) {
  const key = env.FRED_API_KEY;
  if (!key) {
    return Object.fromEntries(entries.map(e => [e.id, { ok: false, error: 'FRED_API_KEY missing in env' }]));
  }

  // Earliest start: 2010-01-01 by default.
  const start = '2010-01-01';

  const results = {};
  await pMapLimit(entries, 6, async (entry) => {
    try {
      const observations = await fetchOne(entry.sourceId, key, start);
      results[entry.id] = { ok: true, observations };
    } catch (err) {
      results[entry.id] = { ok: false, error: String(err.message || err) };
    }
  });
  return { results };
}

async function fetchOne(seriesId, key, start) {
  const url = new URL(FRED_BASE);
  url.searchParams.set('series_id', seriesId);
  url.searchParams.set('api_key', key);
  url.searchParams.set('file_type', 'json');
  url.searchParams.set('observation_start', start);

  const json = await fetchWithRetry(url.toString(), { expectJson: true, tries: 4 });
  return (json.observations || [])
    .filter(o => o.value !== '.' && o.value !== null && o.value !== undefined)
    .map(o => ({ date: o.date, value: Number(o.value) }))
    .filter(o => Number.isFinite(o.value));
}
