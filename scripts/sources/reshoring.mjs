// Reshoring Initiative annual report — total announced reshoring + FDI jobs.
import { readHistoryCsv } from '../lib/csv.mjs';
import path from 'node:path';
export const id = 'scrape:reshoring';
export async function fetch({ entries, dataDir }) {
  const results = {};
  for (const e of entries) {
    const existing = await readHistoryCsv(path.join(dataDir, 'history', `${e.id}.csv`));
    results[e.id] = existing.length
      ? { ok: false, observations: existing, error: 'Reshoring annual scraper pending; kept last-known-good' }
      : { ok: false, error: 'Reshoring scraper not yet implemented (annual)' };
  }
  return { results };
}
