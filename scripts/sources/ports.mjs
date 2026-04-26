// Port throughput scrapers — LA, Long Beach, NY/NJ.
// Each port publishes monthly TEU stats. Format and URL drift between years.
//
// Strategy:
//   * Try canonical stats pages.
//   * Parse month/year and TEU number per row.
//   * Persist all parsed (date, value) pairs and merge with existing history.

import { fetchWithRetry } from '../lib/http.mjs';
import { readHistoryCsv } from '../lib/csv.mjs';
import * as cheerio from 'cheerio';
import path from 'node:path';

export const id = 'scrape:ports';

const PORT_CONFIG = {
  PORT_LA_TEU: {
    url: 'https://www.portoflosangeles.org/business/statistics/container-statistics/historical-teu-statistics',
    label: 'Los Angeles',
  },
  PORT_LB_TEU: {
    url: 'https://polb.com/business/port-statistics/',
    label: 'Long Beach',
  },
  PORT_NYNJ_TEU: {
    url: 'https://www.panynj.gov/port/en/our-port/facts-and-figures.html',
    label: 'NY/NJ',
  },
};

export async function fetch({ entries, dataDir }) {
  const results = {};
  for (const e of entries) {
    const cfg = PORT_CONFIG[e.id];
    const existing = await readHistoryCsv(path.join(dataDir, 'history', `${e.id}.csv`));
    if (!cfg) {
      results[e.id] = existing.length
        ? { ok: false, observations: existing, error: 'unknown port id; kept last-known-good' }
        : { ok: false, error: `unknown port id ${e.id}` };
      continue;
    }

    let html;
    try { html = await fetchWithRetry(cfg.url, { tries: 2, timeout: 30000 }); }
    catch (err) {
      results[e.id] = existing.length
        ? { ok: false, observations: existing, error: `${cfg.label} fetch failed; kept last-known-good: ${err.message}` }
        : { ok: false, error: `${cfg.label}: ${err.message}` };
      continue;
    }

    const parsed = parseAnyTable(html);
    const map = new Map(existing.map(o => [o.date, o.value]));
    for (const p of parsed) map.set(p.date, p.value);
    const obs = [...map.entries()].map(([d, v]) => ({ date: d, value: v })).sort((a, b) => a.date.localeCompare(b.date));
    results[e.id] = obs.length
      ? { ok: parsed.length > 0, observations: obs, error: parsed.length === 0 ? `${cfg.label} parse: no rows; kept last-known-good` : null }
      : { ok: false, error: `${cfg.label}: no values parsed and no history` };
  }
  return { results };
}

// Try to extract month+year+TEU triples from any tables on the page.
function parseAnyTable(html) {
  const $ = cheerio.load(html);
  const out = [];
  const months = { jan:'01', feb:'02', mar:'03', apr:'04', may:'05', jun:'06', jul:'07', aug:'08', sep:'09', oct:'10', nov:'11', dec:'12' };
  $('table tr').each((_, tr) => {
    const cells = $(tr).find('td, th').map((_, td) => $(td).text().trim()).get();
    if (cells.length < 2) return;
    // Look for a month and a number that looks like TEU (>50000)
    let date = null;
    let value = null;
    let yearHint = null;
    for (const c of cells) {
      const ymd = c.match(/^([A-Z][a-z]+)[-\s]+(\d{2,4})$/);
      if (ymd) {
        const mm = months[ymd[1].slice(0, 3).toLowerCase()];
        const yyyy = ymd[2].length === 2 ? `20${ymd[2]}` : ymd[2];
        if (mm) { date = `${yyyy}-${mm}-01`; }
      }
      const yr = c.match(/^(20\d{2})$/);
      if (yr) yearHint = yr[1];
      const num = c.replace(/,/g, '');
      const n = Number(num);
      if (Number.isFinite(n) && n > 50000 && n < 5_000_000) {
        // Possible TEU value
        if (value == null) value = n;
        else if (n > value) value = n;
      }
    }
    if (!date && yearHint && cells.length >= 2) {
      // first cell may be month name only
      const c0 = cells[0].toLowerCase();
      const mm = months[c0.slice(0, 3)];
      if (mm) date = `${yearHint}-${mm}-01`;
    }
    if (date && Number.isFinite(value)) {
      out.push({ date, value });
    }
  });
  return out;
}
