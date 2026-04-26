// Panama Canal Authority monthly transit statistics.
// Public stats at https://pancanal.com/en/stats-data/
import { readHistoryCsv } from '../lib/csv.mjs';
import path from 'node:path';
export const id = 'scrape:panama-canal';
export async function fetch({ entries, dataDir }) {
  const results = {};
  for (const e of entries) {
    const existing = await readHistoryCsv(path.join(dataDir, 'history', `${e.id}.csv`));
    results[e.id] = existing.length
      ? { ok: false, observations: existing, error: 'Panama scraper pending; kept last-known-good' }
      : { ok: false, error: 'Panama scraper not yet implemented' };
  }
  return { results };
}
