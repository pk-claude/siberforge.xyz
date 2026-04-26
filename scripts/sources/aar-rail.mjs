// AAR Weekly Rail Traffic — total carloads + intermodal units.
// AAR publishes a weekly press release at https://www.aar.org/news/
// with a structured table; the report is also posted as PDF.
//
// Strategy (best-effort, scraper-grade):
//   1) Pull the AAR press release listing.
//   2) For each weekly report found, parse out the totals.
//   3) Persist a running history.
//
// On any layout change the scraper degrades to "stale" — last good values
// remain on disk. Fixes amount to updating the regex patterns.

import { fetchWithRetry } from '../lib/http.mjs';
import { readHistoryCsv } from '../lib/csv.mjs';
import * as cheerio from 'cheerio';
import path from 'node:path';

export const id = 'scrape:aar';

const LIST_URL = 'https://www.aar.org/news-category/rail-traffic-data/';

export async function fetch({ entries, dataDir }) {
  const results = {};
  let listHtml = null;
  try { listHtml = await fetchWithRetry(LIST_URL, { tries: 3, timeout: 30000 }); }
  catch (err) {
    for (const e of entries) results[e.id] = { ok: false, error: `AAR list fetch: ${err.message}` };
    return { results };
  }

  // Extract the most recent weekly press-release URLs (typically last 8).
  const $ = cheerio.load(listHtml);
  const urls = [];
  $('a').each((_, a) => {
    const href = $(a).attr('href') || '';
    const text = $(a).text().toLowerCase();
    if (href && (text.includes('week') || text.includes('rail traffic')) && href.includes('aar.org')) {
      urls.push(href);
    }
  });
  const uniqueUrls = [...new Set(urls)].slice(0, 12);

  // Pull existing history to merge against.
  const existingCarloads = await readHistoryCsv(path.join(dataDir, 'history', 'AAR_CARLOADS.csv'));
  const existingIntermodal = await readHistoryCsv(path.join(dataDir, 'history', 'AAR_INTERMODAL.csv'));
  const cMap = new Map(existingCarloads.map(o => [o.date, o.value]));
  const iMap = new Map(existingIntermodal.map(o => [o.date, o.value]));

  for (const url of uniqueUrls) {
    try {
      const html = await fetchWithRetry(url, { tries: 2, timeout: 30000 });
      const parsed = parseWeeklyReport(html);
      if (parsed) {
        if (Number.isFinite(parsed.carloads))  cMap.set(parsed.date, parsed.carloads);
        if (Number.isFinite(parsed.intermodal)) iMap.set(parsed.date, parsed.intermodal);
      }
    } catch { /* skip individual failure */ }
  }

  for (const e of entries) {
    if (e.id === 'AAR_CARLOADS') {
      const obs = [...cMap.entries()].map(([d, v]) => ({ date: d, value: v })).sort((a, b) => a.date.localeCompare(b.date));
      results[e.id] = obs.length ? { ok: true, observations: obs } : { ok: false, error: 'no AAR carloads parsed' };
    } else if (e.id === 'AAR_INTERMODAL') {
      const obs = [...iMap.entries()].map(([d, v]) => ({ date: d, value: v })).sort((a, b) => a.date.localeCompare(b.date));
      results[e.id] = obs.length ? { ok: true, observations: obs } : { ok: false, error: 'no AAR intermodal parsed' };
    } else {
      results[e.id] = { ok: false, error: 'unknown AAR id' };
    }
  }
  return { results };
}

// Parse a single weekly press release. AAR templates vary year to year, so
// we look for a "Week ending DATE" string and the totals near "carloads"
// and "intermodal".
function parseWeeklyReport(html) {
  const $ = cheerio.load(html);
  const text = $('body').text().replace(/\s+/g, ' ');
  const dateMatch = text.match(/[Ww]eek\s+(?:ended|ending)\s+([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/);
  if (!dateMatch) return null;
  const date = parseHumanDate(dateMatch[1]);
  if (!date) return null;
  // Look for two large numbers near "carloads" and "intermodal" in the same paragraph.
  const carRe = /([\d,]{4,})\s*(?:U\.S\.\s+)?carloads/i;
  const interRe = /([\d,]{4,})\s*(?:intermodal\s+(?:units|containers))/i;
  const cm = text.match(carRe);
  const im = text.match(interRe);
  return {
    date,
    carloads:    cm ? Number(cm[1].replace(/,/g, '')) / 1000 : NaN,
    intermodal:  im ? Number(im[1].replace(/,/g, '')) / 1000 : NaN,
  };
}

function parseHumanDate(s) {
  const months = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
  const m = s.match(/([A-Z][a-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (!m) return null;
  const mm = months[m[1].slice(0, 3).toLowerCase()];
  if (!mm) return null;
  return `${m[3]}-${mm}-${m[2].padStart(2, '0')}`;
}
