// Drewry World Container Index scraper.
// Drewry publishes the WCI weekly at https://www.drewry.co.uk/supply-chain-advisors/supply-chain-expertise/world-container-index-assessed-by-drewry
// On the page, a JavaScript-rendered chart contains the latest values. The
// composite plus 8 lanes are also typically embedded in a table.
//
// Defensive: if scrape fails, retains last-known-good history.

import { fetchWithRetry } from '../lib/http.mjs';
import { readHistoryCsv } from '../lib/csv.mjs';
import * as cheerio from 'cheerio';
import path from 'node:path';

export const id = 'scrape:drewry';

const PAGE_URL = 'https://www.drewry.co.uk/supply-chain-advisors/supply-chain-expertise/world-container-index-assessed-by-drewry';

// Map indicator id -> lane name expected in Drewry's table
const LANE_MAP = {
  WCI_COMPOSITE: 'Composite',
  WCI_SHA_LA:    'Shanghai - Los Angeles',
  WCI_SHA_RTM:   'Shanghai - Rotterdam',
};

export async function fetch({ entries, dataDir }) {
  const results = {};
  let html = null;
  try {
    html = await fetchWithRetry(PAGE_URL, { tries: 3, timeout: 30000, headers: { 'Accept-Language': 'en-US,en;q=0.9' } });
  } catch (err) {
    // graceful degradation — return last-known-good
    for (const e of entries) {
      const existing = await readHistoryCsv(path.join(dataDir, 'history', `${e.id}.csv`));
      results[e.id] = existing.length
        ? { ok: false, observations: existing, error: `Drewry fetch failed (kept last-known-good): ${err.message}` }
        : { ok: false, error: `Drewry: ${err.message}` };
    }
    return { results };
  }

  // Look for table rows with route name and current price.
  const $ = cheerio.load(html);
  const today = new Date().toISOString().slice(0, 10);
  const lanePrice = {};
  $('table tr, .route-data, .wci-row').each((_, row) => {
    const txt = $(row).text().replace(/\s+/g, ' ').trim();
    for (const [id_, lane] of Object.entries(LANE_MAP)) {
      if (txt.toLowerCase().includes(lane.toLowerCase())) {
        const m = txt.match(/\$?\s*([\d,]{3,})/);
        if (m) lanePrice[id_] = Number(m[1].replace(/,/g, ''));
      }
    }
  });

  for (const e of entries) {
    const existing = await readHistoryCsv(path.join(dataDir, 'history', `${e.id}.csv`));
    const map = new Map(existing.map(o => [o.date, o.value]));
    const fresh = lanePrice[e.id];
    if (Number.isFinite(fresh)) map.set(today, fresh);
    const obs = [...map.entries()].map(([d, v]) => ({ date: d, value: v })).sort((a, b) => a.date.localeCompare(b.date));
    if (obs.length) {
      results[e.id] = { ok: Number.isFinite(fresh), observations: obs, error: Number.isFinite(fresh) ? null : 'parse failed; kept last-known-good' };
    } else {
      results[e.id] = { ok: false, error: 'Drewry: no values parsed and no history' };
    }
  }
  return { results };
}
