// EU ETS Carbon Allowance daily price. Source: Ember Climate's public CSV.
// https://ember-climate.org/data-catalogue/carbon-price-tracker/
// Direct CSV: https://ember-climate.org/app/uploads/2022/04/european-carbon-price-tracker.csv
import { fetchWithRetry } from '../lib/http.mjs';
import { readHistoryCsv } from '../lib/csv.mjs';
import path from 'node:path';

export const id = 'scrape:eu-ets';
const URL = 'https://ember-climate.org/app/uploads/2022/04/european-carbon-price-tracker.csv';

export async function fetch({ entries, dataDir }) {
  const results = {};
  let observations = null, lastErr = null;
  try {
    const csv = await fetchWithRetry(URL, { tries: 3, timeout: 45000 });
    const rows = csv.split(/\r?\n/);
    const out = [];
    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i].split(',');
      if (cols.length < 2) continue;
      const d = cols[0].trim();
      const v = Number(cols[1]);
      if (/^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(v)) out.push({ date: d, value: v });
    }
    out.sort((a,b)=>a.date.localeCompare(b.date));
    if (out.length > 50) observations = out;
  } catch (err) { lastErr = err; }

  for (const e of entries) {
    if (e.id !== 'EU_ETS_CARBON') { results[e.id] = {ok:false,error:'unknown'}; continue; }
    if (observations) {
      results[e.id] = { ok: true, observations };
    } else {
      const existing = await readHistoryCsv(path.join(dataDir, 'history', `${e.id}.csv`));
      results[e.id] = existing.length
        ? { ok: false, observations: existing, error: 'EU ETS fetch failed; kept last-known-good' }
        : { ok: false, error: `EU ETS: ${lastErr?.message || 'no data'}` };
    }
  }
  return { results };
}
