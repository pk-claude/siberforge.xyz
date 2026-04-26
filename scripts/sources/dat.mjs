// DAT spot-rate scraper.
// DAT publishes monthly van/reefer/flatbed national averages in press releases.
// Best-effort: parse from public RateView page; fallback to last-known-good.

import { fetchWithRetry } from '../lib/http.mjs';
import { readHistoryCsv } from '../lib/csv.mjs';
import * as cheerio from 'cheerio';
import path from 'node:path';

export const id = 'scrape:dat';

const URL = 'https://www.dat.com/blog/dat-trendlines-truckload-rates';

const PATTERNS = {
  DAT_VAN_SPOT:     /\bvan\b[^\d$]{0,40}\$?(\d\.\d{2})/i,
  DAT_REEFER_SPOT:  /\breefer\b[^\d$]{0,40}\$?(\d\.\d{2})/i,
  DAT_FLATBED_SPOT: /\bflatbed\b[^\d$]{0,40}\$?(\d\.\d{2})/i,
};

export async function fetch({ entries, dataDir }) {
  const results = {};
  let html;
  try { html = await fetchWithRetry(URL, { tries: 3, timeout: 30000 }); }
  catch (err) {
    for (const e of entries) {
      const existing = await readHistoryCsv(path.join(dataDir, 'history', `${e.id}.csv`));
      results[e.id] = existing.length
        ? { ok: false, observations: existing, error: `DAT fetch: ${err.message}` }
        : { ok: false, error: `DAT: ${err.message}` };
    }
    return { results };
  }
  const $ = cheerio.load(html);
  const text = $('body').text().replace(/\s+/g, ' ');
  const date = (() => {
    const m = text.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})/);
    if (!m) return new Date().toISOString().slice(0, 7) + '-01';
    const months = { January:'01', February:'02', March:'03', April:'04', May:'05', June:'06', July:'07', August:'08', September:'09', October:'10', November:'11', December:'12' };
    return `${m[2]}-${months[m[1]]}-01`;
  })();

  for (const e of entries) {
    const existing = await readHistoryCsv(path.join(dataDir, 'history', `${e.id}.csv`));
    const map = new Map(existing.map(o => [o.date, o.value]));
    const re = PATTERNS[e.id];
    const m = re && text.match(re);
    if (m) map.set(date, Number(m[1]));
    const obs = [...map.entries()].map(([d, v]) => ({ date: d, value: v })).sort((a, b) => a.date.localeCompare(b.date));
    results[e.id] = obs.length
      ? { ok: !!m, observations: obs, error: m ? null : 'DAT parse failed; kept last-known-good' }
      : { ok: false, error: 'DAT: no values parsed' };
  }
  return { results };
}
