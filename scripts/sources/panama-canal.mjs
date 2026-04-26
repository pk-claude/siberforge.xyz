// Panama Canal Authority — monthly transit count.
// Public source: https://pancanal.com/en/stats-data/ - tries the canal stats page.
// Best-effort scrape; falls back gracefully.
import { fetchWithRetry } from '../lib/http.mjs';
import { readHistoryCsv } from '../lib/csv.mjs';
import * as cheerio from 'cheerio';
import path from 'node:path';

export const id = 'scrape:panama-canal';
const URL = 'https://pancanal.com/en/maritime-services/canal-statistics/';

export async function fetch({ entries, dataDir }) {
  const results = {};
  let html = null, parsed = null;
  try { html = await fetchWithRetry(URL, { tries: 2, timeout: 30000 }); } catch {}

  if (html) {
    const $ = cheerio.load(html);
    const text = $('body').text().replace(/\s+/g, ' ');
    // Look for "transits" near a number and a year
    const m = text.match(/(\d{1,3}(?:,\d{3})*)\s+transits?\s+(?:in|during|for)\s+(?:[A-Z][a-z]+\s+)?(20\d{2})/i);
    if (m) {
      parsed = { date: `${m[2]}-12-31`, value: Number(m[1].replace(/,/g, '')) };
    }
  }

  for (const e of entries) {
    const existing = await readHistoryCsv(path.join(dataDir, 'history', `${e.id}.csv`));
    if (parsed) {
      const map = new Map(existing.map(o => [o.date, o.value]));
      map.set(parsed.date, parsed.value);
      const obs = [...map.entries()].map(([d,v]) => ({date:d,value:v})).sort((a,b)=>a.date.localeCompare(b.date));
      results[e.id] = { ok: true, observations: obs };
    } else {
      results[e.id] = existing.length
        ? { ok: false, observations: existing, error: 'Panama parser pending; kept last-known-good' }
        : { ok: false, error: 'Panama: no data parsed (page layout drift; needs URL/regex update)' };
    }
  }
  return { results };
}
