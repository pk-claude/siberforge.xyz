// Suez Canal Authority — monthly transit count from monthly statistics page.
// Public stats: https://www.suezcanal.gov.eg/English/Navigation/Pages/NavigationStatistics.aspx
// Approach: scrape the navigation statistics page for the most recent month and transit count.
import { fetchWithRetry } from '../lib/http.mjs';
import { readHistoryCsv } from '../lib/csv.mjs';
import * as cheerio from 'cheerio';
import path from 'node:path';

export const id = 'scrape:suez-canal';
const URL = 'https://www.suezcanal.gov.eg/English/Navigation/Pages/NavigationStatistics.aspx';

export async function fetch({ entries, dataDir }) {
  const results = {};
  let html = null, parsed = null;
  try { html = await fetchWithRetry(URL, { tries: 2, timeout: 30000 }); } catch {}

  if (html) {
    const $ = cheerio.load(html);
    const text = $('body').text().replace(/\s+/g, ' ');
    // Look for "Number of Transit" or similar with monthly values
    const m = text.match(/(\d{4})\s+(\d{1,3}(?:,\d{3})*)\s+(?:transit|ship)/i);
    if (m) {
      parsed = { date: `${m[1]}-12-31`, value: Number(m[2].replace(/,/g, '')) };
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
        ? { ok: false, observations: existing, error: 'Suez parser pending; kept last-known-good' }
        : { ok: false, error: 'Suez: no data parsed (page layout drift; needs URL/regex update)' };
    }
  }
  return { results };
}
