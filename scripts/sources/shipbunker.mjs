// Ship & Bunker — VLSFO daily prices from the World Top Ports widget on the prices page.
// The page layout uses <a class="unit sg-sin up"><span class="name">Singapore</span>...755.00...
// Approach: per-port pattern match for name + first price.
import { fetchWithRetry } from '../lib/http.mjs';
import { readHistoryCsv } from '../lib/csv.mjs';
import path from 'node:path';

export const id = 'scrape:shipbunker';
const URL = 'https://shipandbunker.com/prices';

const PORT_PATTERNS = {
  BUNKER_VLSFO_SIN: { name: 'Singapore', cssCode: 'sg-sin' },
  BUNKER_VLSFO_RTM: { name: 'Rotterdam', cssCode: 'nl-rtm' },
};

export async function fetch({ entries, dataDir }) {
  const results = {};
  let html = null;
  try {
    html = await fetchWithRetry(URL, {
      tries: 3, timeout: 30000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36' },
    });
  } catch (err) {
    for (const e of entries) {
      const existing = await readHistoryCsv(path.join(dataDir, 'history', `${e.id}.csv`));
      results[e.id] = existing.length
        ? { ok: false, observations: existing, error: `Ship&Bunker fetch: ${err.message}; kept last-known-good` }
        : { ok: false, error: `Ship&Bunker: ${err.message}` };
    }
    return { results };
  }

  // Strip tags, then find each port name followed by first numeric (XXX.XX) within ~200 chars.
  const stripped = html.replace(/<[^>]+>/g, ' || ').replace(/\s+/g, ' ');
  const date = new Date().toISOString().slice(0, 10);

  for (const e of entries) {
    const cfg = PORT_PATTERNS[e.id];
    const existing = await readHistoryCsv(path.join(dataDir, 'history', `${e.id}.csv`));
    let value = null;
    if (cfg) {
      // Match port name then price within next 200 chars
      const re = new RegExp(`${cfg.name}[\\s\\S]{0,300}?(\\d{3,4}\\.\\d{2})`, 'i');
      const m = stripped.match(re);
      if (m) value = Number(m[1]);
    }
    const map = new Map(existing.map(o => [o.date, o.value]));
    if (Number.isFinite(value)) map.set(date, value);
    const obs = [...map.entries()].map(([d,v]) => ({date:d,value:v})).sort((a,b)=>a.date.localeCompare(b.date));
    results[e.id] = obs.length
      ? { ok: Number.isFinite(value), observations: obs, error: Number.isFinite(value) ? null : 'Ship&Bunker parse failed; kept last-known-good' }
      : { ok: false, error: 'Ship&Bunker: no value parsed' };
  }
  return { results };
}
