// Baltic Dry Index — try multiple sources.
import { fetchWithRetry } from '../lib/http.mjs';
import { readHistoryCsv } from '../lib/csv.mjs';
import path from 'node:path';
export const id = 'scrape:bdi';

const URLS = [
  'https://stooq.com/q/d/l/?s=bdi&i=d',
  'https://stooq.com/q/d/l/?s=^bdi&i=d',
  'https://query1.finance.yahoo.com/v7/finance/download/^BDIY?period1=1262304000&period2=9999999999&interval=1d&events=history',
];

export async function fetch({ entries, dataDir }) {
  const results = {};
  let observations = null, lastErr = null;
  for (const url of URLS) {
    try {
      const csv = await fetchWithRetry(url, { tries: 2, timeout: 30000 });
      if (!csv || !csv.match(/Date,/i)) continue;
      const rows = csv.split(/\r?\n/);
      const out = [];
      for (let i = 1; i < rows.length; i++) {
        const cols = rows[i].split(',');
        if (cols.length < 5) continue;
        const d = cols[0];
        const close = Number(cols[4]);
        if (/^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(close) && close > 100) {
          out.push({ date: d, value: close });
        }
      }
      out.sort((a,b)=>a.date.localeCompare(b.date));
      if (out.length > 50) { observations = out; break; }
    } catch (err) { lastErr = err; }
  }

  for (const e of entries) {
    if (observations) {
      results[e.id] = { ok: true, observations };
    } else {
      const existing = await readHistoryCsv(path.join(dataDir, 'history', `${e.id}.csv`));
      results[e.id] = existing.length
        ? { ok: false, observations: existing, error: 'BDI fetch failed; kept last-known-good' }
        : { ok: false, error: `BDI: ${lastErr?.message || 'no data'}` };
    }
  }
  return { results };
}
