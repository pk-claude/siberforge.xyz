// Cass Information Systems Freight Index — monthly PDF report scraper.
// Cass publishes a monthly press release as PDF at cassinfo.com.
// We scrape the press-release listing page, identify the most recent monthly
// freight-index report, and parse the PDF for the three index values
// (Shipments, Expenditures, Truckload Linehaul).
//
// PDF parsing uses pdfjs-dist's text extraction. The Cass PDF layout has been
// stable since 2019, but layout drift is the chief failure mode. On any
// failure we keep last-known-good.

import { fetchWithRetry } from '../lib/http.mjs';
import { readHistoryCsv } from '../lib/csv.mjs';
import * as cheerio from 'cheerio';
import fs from 'node:fs/promises';
import path from 'node:path';

export const id = 'scrape:cass';

const LIST_URL = 'https://www.cassinfo.com/freight-audit-payment/cass-transportation-indexes/cass-freight-index';

export async function fetch({ entries, dataDir }) {
  const results = {};
  let html;
  try { html = await fetchWithRetry(LIST_URL, { tries: 3, timeout: 30000 }); }
  catch (err) {
    for (const e of entries) {
      const existing = await readHistoryCsv(path.join(dataDir, 'history', `${e.id}.csv`));
      results[e.id] = existing.length
        ? { ok: false, observations: existing, error: `Cass list fetch: ${err.message}` }
        : { ok: false, error: `Cass: ${err.message}` };
    }
    return { results };
  }

  // Find the most recent PDF link.
  const $ = cheerio.load(html);
  const links = [];
  $('a').each((_, a) => {
    const href = $(a).attr('href') || '';
    if (href.toLowerCase().endsWith('.pdf') && (href.includes('cass') || href.includes('freight'))) {
      links.push(href.startsWith('http') ? href : new URL(href, LIST_URL).toString());
    }
  });

  let parsed = null;
  for (const url of links.slice(0, 4)) {
    try {
      const buf = await fetchWithRetry(url, { expectBuffer: true, tries: 2, timeout: 60000 });
      // archive raw
      const rawDir = path.join(dataDir, 'raw', 'cass');
      await fs.mkdir(rawDir, { recursive: true });
      const fname = url.split('/').pop().slice(0, 100);
      await fs.writeFile(path.join(rawDir, fname), buf);
      const text = await pdfToText(buf);
      const p = parseText(text);
      if (p) { parsed = p; break; }
    } catch { /* try next link */ }
  }

  for (const e of entries) {
    const existing = await readHistoryCsv(path.join(dataDir, 'history', `${e.id}.csv`));
    const map = new Map(existing.map(o => [o.date, o.value]));
    const fresh = parsed?.[e.id];
    if (parsed && Number.isFinite(fresh)) map.set(parsed.date, fresh);
    const obs = [...map.entries()].map(([d, v]) => ({ date: d, value: v })).sort((a, b) => a.date.localeCompare(b.date));
    results[e.id] = obs.length
      ? { ok: parsed && Number.isFinite(fresh), observations: obs, error: parsed ? null : 'Cass parse failed; kept last-known-good' }
      : { ok: false, error: 'Cass: no values parsed' };
  }
  return { results };
}

async function pdfToText(buf) {
  // pdfjs-dist legacy build for Node
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(buf);
  const doc = await getDocument({ data, disableFontFace: true, useWorkerFetch: false }).promise;
  let out = '';
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    out += content.items.map(it => it.str).join(' ') + '\n';
  }
  return out;
}

function parseText(t) {
  // Look for a date like "March 2026" near the top.
  const m = t.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})/);
  if (!m) return null;
  const months = { January:'01', February:'02', March:'03', April:'04', May:'05', June:'06', July:'07', August:'08', September:'09', October:'10', November:'11', December:'12' };
  const date = `${m[2]}-${months[m[1]]}-01`;

  // Each index typically appears as e.g. "Shipments Index: 1.187" or "Cass Shipments Index — 1.187"
  const shipMatch = t.match(/Shipments[^\d]{0,40}([\d]\.\d{2,3})/i);
  const expMatch  = t.match(/Expenditures[^\d]{0,40}([\d]\.\d{2,3})/i);
  const lhMatch   = t.match(/(?:Truckload\s+)?Linehaul[^\d]{0,40}([\d]\.\d{2,3})/i);

  return {
    date,
    CASS_SHIPMENTS: shipMatch ? Number(shipMatch[1]) : NaN,
    CASS_EXPENDITURES: expMatch ? Number(expMatch[1]) : NaN,
    CASS_LINEHAUL: lhMatch ? Number(lhMatch[1]) : NaN,
  };
}
