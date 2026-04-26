// Class 8 net-orders scraper. ACT Research and FTR both publish monthly.
// Press releases typically include a number like "X,XXX units" alongside
// "preliminary North American Class 8 net orders for [month]".
//
// We try a couple of canonical sources; degrade to last-known-good on failure.

import { fetchWithRetry } from '../lib/http.mjs';
import { readHistoryCsv } from '../lib/csv.mjs';
import * as cheerio from 'cheerio';
import path from 'node:path';

export const id = 'scrape:act-ftr';

const URLS = [
  'https://www.actresearch.net/news/news-press-releases',
  'https://ftrintel.com/news',
];

export async function fetch({ entries, dataDir }) {
  const results = {};
  let parsed = null;
  for (const url of URLS) {
    try {
      const html = await fetchWithRetry(url, { tries: 2, timeout: 30000 });
      const p = parseListing(html, url);
      if (p) { parsed = p; break; }
    } catch { /* try next */ }
  }

  for (const e of entries) {
    const existing = await readHistoryCsv(path.join(dataDir, 'history', `${e.id}.csv`));
    const map = new Map(existing.map(o => [o.date, o.value]));
    if (parsed && Number.isFinite(parsed.value)) map.set(parsed.date, parsed.value);
    const obs = [...map.entries()].map(([d, v]) => ({ date: d, value: v })).sort((a, b) => a.date.localeCompare(b.date));
    results[e.id] = obs.length
      ? { ok: !!parsed, observations: obs, error: parsed ? null : 'ACT/FTR parse failed; kept last-known-good' }
      : { ok: false, error: 'ACT/FTR: no values parsed' };
  }
  return { results };
}

function parseListing(html, baseUrl) {
  const $ = cheerio.load(html);
  // Heuristic: pull article snippets and look for "Class 8 net orders" pattern.
  let best = null;
  $('article, .news-item, .press-release, li, p').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ');
    const dateMatch = text.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})/);
    const orderMatch = text.match(/Class\s*8[^\d]{0,80}([\d,]{3,6})\s*units/i);
    if (dateMatch && orderMatch) {
      const months = { January:'01', February:'02', March:'03', April:'04', May:'05', June:'06', July:'07', August:'08', September:'09', October:'10', November:'11', December:'12' };
      const date = `${dateMatch[2]}-${months[dateMatch[1]]}-01`;
      const value = Number(orderMatch[1].replace(/,/g, '')) / 1000; // thousands
      if (Number.isFinite(value) && (!best || date > best.date)) {
        best = { date, value };
      }
    }
  });
  return best;
}
