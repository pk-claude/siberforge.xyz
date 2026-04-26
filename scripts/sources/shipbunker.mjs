// Ship & Bunker VLSFO daily prices.
// Public landing: https://shipandbunker.com/prices
// We pull the World Bunker Prices table with current VLSFO values for major ports.

import { fetchWithRetry } from '../lib/http.mjs';
import { readHistoryCsv } from '../lib/csv.mjs';
import * as cheerio from 'cheerio';
import path from 'node:path';

export const id = 'scrape:shipbunker';

const URL = 'https://shipandbunker.com/prices';

const PORT_MAP = {
  BUNKER_VLSFO_SIN: 'Singapore',
  BUNKER_VLSFO_RTM: 'Rotterdam',
};

export async function fetch({ entries, dataDir }) {
  const results = {};
  let html;
  try { html = await fetchWithRetry(URL, { tries: 3, timeout: 30000 }); }
  catch (err) {
    for (const e of entries) {
      const existing = await readHistoryCsv(path.join(dataDir, 'history', `${e.id}.csv`));
      results[e.id] = existing.length
        ? { ok: false, observations: existing, error: `Ship&Bunker fetch failed (kept last-known-good): ${err.message}` }
        : { ok: false, error: `Ship&Bunker: ${err.message}` };
    }
    return { results };
  }

  const $ = cheerio.load(html);
  // Look in tables for rows where the first cell is a port name we want.
  const date = new Date().toISOString().slice(0, 10);
  const fresh = {};
  $('table tr').each((_, tr) => {
    const cells = $(tr).find('td').map((_, td) => $(td).text().trim()).get();
    if (cells.length < 2) return;
    const portCell = cells[0];
    for (const [id_, port] of Object.entries(PORT_MAP)) {
      if (portCell.toLowerCase().startsWith(port.toLowerCase())) {
        // Find the VLSFO column — typically a number 400-1500
        for (const c of cells.slice(1)) {
          const m = c.match(/([\d,]{3,5}(?:\.\d+)?)/);
          if (m) {
            const v = Number(m[1].replace(/,/g, ''));
            if (v > 250 && v < 1500) { fresh[id_] = v; break; }
          }
        }
      }
    }
  });

  for (const e of entries) {
    const existing = await readHistoryCsv(path.join(dataDir, 'history', `${e.id}.csv`));
    const map = new Map(existing.map(o => [o.date, o.value]));
    if (Number.isFinite(fresh[e.id])) map.set(date, fresh[e.id]);
    const obs = [...map.entries()].map(([d, v]) => ({ date: d, value: v })).sort((a, b) => a.date.localeCompare(b.date));
    results[e.id] = obs.length
      ? { ok: Number.isFinite(fresh[e.id]), observations: obs, error: Number.isFinite(fresh[e.id]) ? null : 'parse failed; kept last-known-good' }
      : { ok: false, error: 'Ship&Bunker: no value parsed' };
  }
  return { results };
}
