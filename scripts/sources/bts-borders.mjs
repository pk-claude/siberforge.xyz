// BTS Border Crossing Statistics — US-Mexico truck crossings.
// API: https://data.bts.gov/resource/keg4-3bc2.json (Socrata public)
// Filters: country=Mexico, measure=Trucks; sums across ports.
import { fetchWithRetry } from '../lib/http.mjs';
import { readHistoryCsv } from '../lib/csv.mjs';
import path from 'node:path';
export const id = 'scrape:bts-borders';

const URL = 'https://data.bts.gov/resource/keg4-3bc2.json?$where=border%3D%22US-Mexico%20Border%22%20AND%20measure%3D%22Trucks%22&$limit=50000';

export async function fetch({ entries, dataDir }) {
  const results = {};
  let observations = null, lastErr = null;
  try {
    const json = await fetchWithRetry(URL, { expectJson: true, tries: 3, timeout: 45000 });
    // BTS data: each row has port_name, date (YYYY-MM-01), value
    const monthly = new Map();
    for (const row of json) {
      const date = (row.date || '').slice(0, 10);
      const v = Number(row.value);
      if (!date || !Number.isFinite(v)) continue;
      monthly.set(date, (monthly.get(date) || 0) + v);
    }
    observations = [...monthly.entries()]
      .map(([date, value]) => ({ date, value: value / 1000 }))  // thousands
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch (err) { lastErr = err; }

  for (const e of entries) {
    if (e.id !== 'BORDER_MX_TRUCKS') { results[e.id] = { ok:false, error:'unknown' }; continue; }
    if (observations && observations.length > 0) {
      results[e.id] = { ok: true, observations };
    } else {
      const existing = await readHistoryCsv(path.join(dataDir, 'history', `${e.id}.csv`));
      results[e.id] = existing.length
        ? { ok: false, observations: existing, error: `BTS fetch failed (${lastErr?.message || 'unknown'}); kept last-known-good` }
        : { ok: false, error: `BTS: ${lastErr?.message || 'no data'}` };
    }
  }
  return { results };
}
