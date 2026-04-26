// Shanghai Containerized Freight Index — scraper.
// Source: en.sse.net.cn (Shanghai Shipping Exchange).
// SSE updates SCFI every Friday. The page lists the composite plus per-route values.

import { fetchWithRetry } from '../lib/http.mjs';
import { readHistoryCsv } from '../lib/csv.mjs';
import * as cheerio from 'cheerio';
import path from 'node:path';

export const id = 'scrape:scfi';

const URL = 'https://en.sse.net.cn/indices/scfinew.jsp';

export async function fetch({ entries, dataDir }) {
  const results = {};
  let html;
  try { html = await fetchWithRetry(URL, { tries: 3, timeout: 30000 }); }
  catch (err) {
    for (const e of entries) {
      const existing = await readHistoryCsv(path.join(dataDir, 'history', `${e.id}.csv`));
      results[e.id] = existing.length
        ? { ok: false, observations: existing, error: `SCFI fetch failed (kept last-known-good): ${err.message}` }
        : { ok: false, error: `SCFI: ${err.message}` };
    }
    return { results };
  }

  const $ = cheerio.load(html);
  // SCFI page typically has a header indicating the published date and a row labeled "Composite Index".
  const text = $('body').text().replace(/\s+/g, ' ');
  // Date pattern: "2026-04-25" or "Apr 25, 2026"
  const dateMatch = text.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/) || text.match(/([A-Z][a-z]+)\s+(\d{1,2}),\s+(20\d{2})/);
  const date = dateMatch
    ? (dateMatch[0].includes('-') || dateMatch[0].includes('/') || dateMatch[0].includes('.')
        ? `${dateMatch[1]}-${String(dateMatch[2]).padStart(2,'0')}-${String(dateMatch[3]).padStart(2,'0')}`
        : null)
    : new Date().toISOString().slice(0, 10);
  // Composite value: appears near "Composite Index" — pick the next number with 3-4 digits.
  const compMatch = text.match(/Composite\s*Index[^\d]*([\d,]{3,7}\.?\d*)/i);
  const value = compMatch ? Number(compMatch[1].replace(/,/g, '')) : NaN;

  for (const e of entries) {
    const existing = await readHistoryCsv(path.join(dataDir, 'history', `${e.id}.csv`));
    const map = new Map(existing.map(o => [o.date, o.value]));
    if (e.id === 'SCFI' && Number.isFinite(value) && date) map.set(date, value);
    const obs = [...map.entries()].map(([d, v]) => ({ date: d, value: v })).sort((a, b) => a.date.localeCompare(b.date));
    results[e.id] = obs.length
      ? { ok: Number.isFinite(value), observations: obs, error: Number.isFinite(value) ? null : 'parse failed; kept last-known-good' }
      : { ok: false, error: 'SCFI: no values parsed' };
  }
  return { results };
}
