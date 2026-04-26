// BTS Border Crossing/Entry Statistics — US-Mexico truck crossings.
// Public data at https://explore.dot.gov/views/BorderCrossingData/...
// First pass: returns last-known-good; scraper to be tuned.
import { readHistoryCsv } from '../lib/csv.mjs';
import path from 'node:path';
export const id = 'scrape:bts-borders';
export async function fetch({ entries, dataDir }) {
  const results = {};
  for (const e of entries) {
    const existing = await readHistoryCsv(path.join(dataDir, 'history', `${e.id}.csv`));
    results[e.id] = existing.length
      ? { ok: false, observations: existing, error: 'BTS scraper pending; kept last-known-good' }
      : { ok: false, error: 'BTS scraper not yet implemented; awaiting first parse' };
  }
  return { results };
}
