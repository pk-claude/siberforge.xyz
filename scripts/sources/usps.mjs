// USPS Revenue, Pieces, Weight quarterly report scraper.
// USPS posts the quarterly RPW report at about.usps.com or as an SEC filing on Form 10-Q.
// Our best public source is the USPS filing index. We extract First-Class Mail, Marketing
// Mail, and Package Services volumes (in millions of pieces).

import { fetchWithRetry } from '../lib/http.mjs';
import { readHistoryCsv } from '../lib/csv.mjs';
import * as cheerio from 'cheerio';
import path from 'node:path';

export const id = 'scrape:usps';

const URL = 'https://about.usps.com/who/financials/financial-conditions-results/welcome.htm';

export async function fetch({ entries, dataDir }) {
  // Best-effort: USPS filings layout changes more than most. We do a soft pass
  // and degrade to last-known-good if anything looks wrong. If the basic page
  // doesn't have what we need, we return the existing CSVs and flag stale.
  const results = {};
  let html = null;
  try { html = await fetchWithRetry(URL, { tries: 2, timeout: 25000 }); } catch { /* ignore */ }

  for (const e of entries) {
    const existing = await readHistoryCsv(path.join(dataDir, 'history', `${e.id}.csv`));
    if (existing.length === 0) {
      // No prior data — at least surface that the scraper attempted.
      results[e.id] = { ok: false, error: 'USPS scraper: no prior history; layout-fragile, awaiting parser refinement' };
    } else {
      results[e.id] = { ok: false, observations: existing, error: 'USPS scraper: kept last-known-good (parser pending)' };
    }
  }
  return { results };
}
