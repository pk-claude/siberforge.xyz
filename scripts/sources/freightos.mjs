// Freightos Baltic Index (FBX) — global composite.
// Public page: https://fbx.freightos.com/
// FBX is updated daily; the front page shows the current global composite.

import { fetchWithRetry } from '../lib/http.mjs';
import { readHistoryCsv } from '../lib/csv.mjs';
import * as cheerio from 'cheerio';
import path from 'node:path';

export const id = 'scrape:freightos';

const URL = 'https://fbx.freightos.com/';

export async function fetch({ entries, dataDir }) {
  const results = {};
  let html;
  try { html = await fetchWithRetry(URL, { tries: 3, timeout: 30000 }); }
  catch (err) {
    for (const e of entries) {
      const existing = await readHistoryCsv(path.join(dataDir, 'history', `${e.id}.csv`));
      results[e.id] = existing.length
        ? { ok: false, observations: existing, error: `FBX fetch failed (kept last-known-good): ${err.message}` }
        : { ok: false, error: `FBX: ${err.message}` };
    }
    return { results };
  }

  const $ = cheerio.load(html);
  const text = $('body').text().replace(/\s+/g, ' ');
  // Look for the global composite. The page typically has a large headline number.
  // Pattern attempt: look for the dollar amount near "Global" or "Composite" or "Index".
  const candidates = [];
  for (const m of text.matchAll(/\$?\s*([\d,]{3,5}(?:\.\d+)?)/g)) {
    const v = Number(m[1].replace(/,/g, ''));
    if (v > 500 && v < 25000) candidates.push(v);
  }
  // Pick the median candidate as a reasonable guess if multiple
  candidates.sort((a, b) => a - b);
  const value = candidates.length ? candidates[Math.floor(candidates.length / 2)] : NaN;
  const date = new Date().toISOString().slice(0, 10);

  for (const e of entries) {
    const existing = await readHistoryCsv(path.join(dataDir, 'history', `${e.id}.csv`));
    const map = new Map(existing.map(o => [o.date, o.value]));
    if (e.id === 'FBX_GLOBAL' && Number.isFinite(value)) map.set(date, value);
    const obs = [...map.entries()].map(([d, v]) => ({ date: d, value: v })).sort((a, b) => a.date.localeCompare(b.date));
    results[e.id] = obs.length
      ? { ok: Number.isFinite(value), observations: obs, error: Number.isFinite(value) ? null : 'parse failed; kept last-known-good' }
      : { ok: false, error: 'FBX: no values parsed' };
  }
  return { results };
}
