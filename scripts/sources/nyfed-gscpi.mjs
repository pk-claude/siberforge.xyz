// NY Fed Global Supply Chain Pressure Index — fixed parser using xlsx package.
// Reference: https://www.newyorkfed.org/research/policy/gscpi
// Workbook layout has data on a sheet (often "GSCPI") with columns:
//   Column A: Date (e.g. "Sep 1997" or month-end date)
//   Column B: GSCPI z-score value
// We auto-detect the right sheet/columns instead of hard-coding sheet1.

import { fetchWithRetry } from '../lib/http.mjs';
import { readHistoryCsv } from '../lib/csv.mjs';
import path from 'node:path';
import * as XLSX from 'xlsx';

const URLS = [
  'https://www.newyorkfed.org/medialibrary/research/interactives/gscpi/downloads/gscpi_data.xlsx',
];

export const id = 'scrape:nyfed-gscpi';

export async function fetch({ entries, dataDir }) {
  const results = {};
  let observations = null;
  let lastErr = null;

  for (const url of URLS) {
    try {
      const buf = await fetchWithRetry(url, { expectBuffer: true, tries: 3, timeout: 45000 });
      observations = parseWorkbook(buf);
      if (observations && observations.length > 0) break;
    } catch (err) { lastErr = err; }
  }

  for (const entry of entries) {
    if (entry.id !== 'GSCPI') {
      results[entry.id] = { ok: false, error: 'unknown nyfed-gscpi indicator' };
      continue;
    }
    if (observations && observations.length > 0) {
      results[entry.id] = { ok: true, observations };
    } else {
      // Keep last-known-good if we have any
      const existing = await readHistoryCsv(path.join(dataDir, 'history', `${entry.id}.csv`));
      results[entry.id] = existing.length
        ? { ok: false, observations: existing, error: `GSCPI parse failed (${lastErr?.message || 'unknown'}); kept last-known-good` }
        : { ok: false, error: `GSCPI: ${lastErr?.message || 'parse failed'}` };
    }
  }
  return { results };
}

function parseWorkbook(buf) {
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
  // Try every sheet in priority order. NY Fed file usually has 'GSCPI' or a single data sheet.
  const sheetCandidates = [...wb.SheetNames];
  // Prefer sheets whose name contains 'gscpi' or 'data'
  sheetCandidates.sort((a, b) => {
    const aMatch = /gscpi|data|index/i.test(a) ? 1 : 0;
    const bMatch = /gscpi|data|index/i.test(b) ? 1 : 0;
    return bMatch - aMatch;
  });

  for (const sheetName of sheetCandidates) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    // Convert to array of row objects (no header) — header: 1 means each row is array
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' });
    if (!rows.length) continue;

    // Scan for the date+value pair. Accept any 2-column layout.
    const out = [];
    for (const row of rows) {
      if (!row || row.length < 2) continue;
      const dateRaw = row[0];
      const valRaw = row[1];
      const date = parseDate(dateRaw);
      const value = Number(valRaw);
      if (date && Number.isFinite(value)) {
        out.push({ date, value });
      }
    }
    if (out.length > 50) {  // GSCPI has 25+ years of monthly data — sanity threshold
      out.sort((a, b) => a.date.localeCompare(b.date));
      return out;
    }
  }
  return null;
}

function parseDate(v) {
  if (!v && v !== 0) return null;
  if (v instanceof Date && !isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === 'number') {
    // Excel serial date
    if (v > 10000 && v < 100000) {
      const ms = (v - 25569) * 86400 * 1000;
      const d = new Date(ms);
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
    return null;
  }
  if (typeof v === 'string') {
    const s = v.trim();
    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    // YYYY-MM
    if (/^\d{4}-\d{2}$/.test(s)) return `${s}-01`;
    // M/D/YYYY or MM/DD/YYYY
    const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (us) return `${us[3]}-${us[1].padStart(2,'0')}-${us[2].padStart(2,'0')}`;
    // "Sep 1997" or "September 1997"
    const months = { jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12' };
    const my = s.match(/^([A-Za-z]+)\s+(\d{4})$/);
    if (my) {
      const m = months[my[1].slice(0,3).toLowerCase()];
      if (m) return `${my[2]}-${m}-01`;
    }
    // Try Date.parse fallback
    const t = Date.parse(s);
    if (!isNaN(t)) return new Date(t).toISOString().slice(0, 10);
  }
  return null;
}
