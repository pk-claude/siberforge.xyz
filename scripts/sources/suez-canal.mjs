// Suez Canal Authority monthly transit statistics.
// Public press releases at https://www.suezcanal.gov.eg/English/News/Pages/SCA-News.aspx
import { readHistoryCsv } from '../lib/csv.mjs';
import path from 'node:path';
export const id = 'scrape:suez-canal';
export async function fetch({ entries, dataDir }) {
  const results = {};
  for (const e of entries) {
    const existing = await readHistoryCsv(path.join(dataDir, 'history', `${e.id}.csv`));
    results[e.id] = existing.length
      ? { ok: false, observations: existing, error: 'Suez scraper pending; kept last-known-good' }
      : { ok: false, error: 'Suez scraper not yet implemented' };
  }
  return { results };
}
