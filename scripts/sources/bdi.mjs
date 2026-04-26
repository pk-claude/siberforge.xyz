// Baltic Dry Index — scrape from public sources.
// Yahoo Finance carries ^BDI on some endpoints, but it's unreliable. We try
// tradingeconomics.com which serves a public chart; if that fails, we fall
// back to the Stooq CSV endpoint for $BDI which often works.

import { fetchWithRetry } from '../lib/http.mjs';
import { readHistoryCsv } from '../lib/csv.mjs';
import path from 'node:path';

export const id = 'scrape:bdi';

const STOOQ_URL = 'https://stooq.com/q/d/l/?s=%5Ebdi&i=d';
const FALLBACK_URLS = [
  'https://stooq.com/q/d/l/?s=baltic&i=d',
];

export async function fetch({ entries, dataDir }) {
  const results = {};
  let csv = null;
  for (const url of [STOOQ_URL, ...FALLBACK_URLS]) {
    try {
      csv = await fetchWithRetry(url, { tries: 2, timeout: 30000 });
      if (csv && csv.includes('Date,')) break;
    } catch { /* try next */ }
  }

  if (!csv) {
    for (const e of entries) {
      const existing = await readHistoryCsv(path.join(dataDir, 'history', `${e.id}.csv`));
      results[e.id] = existing.length
        ? { ok: false, observations: existing, error: 'BDI fetch failed (kept last-known-good)' }
        : { ok: false, error: 'BDI fetch failed and no history' };
    }
    return { results };
  }

  // Parse CSV: header Date,Open,High,Low,Close,...
  const lines = csv.split(/\r?\n/);
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 5) continue;
    const date = cols[0];
    const close = Number(cols[4]);
    if (/^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(close)) {
      out.push({ date, value: close });
    }
  }
  out.sort((a, b) => a.date.localeCompare(b.date));

  for (const e of entries) {
    if (e.id === 'BDI') {
      results[e.id] = out.length ? { ok: true, observations: out } : { ok: false, error: 'no BDI rows parsed' };
    }
  }
  return { results };
}
