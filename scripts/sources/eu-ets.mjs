// EU ETS Carbon Allowance (EUA) daily price.
// Public source: ICE EUA Daily Future settlement, also Ember-Climate.org.
import { readHistoryCsv } from '../lib/csv.mjs';
import path from 'node:path';
export const id = 'scrape:eu-ets';
export async function fetch({ entries, dataDir }) {
  const results = {};
  for (const e of entries) {
    const existing = await readHistoryCsv(path.join(dataDir, 'history', `${e.id}.csv`));
    results[e.id] = existing.length
      ? { ok: false, observations: existing, error: 'EU ETS scraper pending; kept last-known-good' }
      : { ok: false, error: 'EU ETS scraper not yet implemented' };
  }
  return { results };
}
