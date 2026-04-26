// Cass Transportation Indexes — pulls the official XLSX historical-data file.
// Reference: https://www.cassinfo.com/freight-audit-payment/cass-transportation-indexes/cass-freight-index
// File:      https://www.cassinfo.com/hubfs/Cass%20Indexes%20Historical%20Data.xlsx
//
// Workbook structure (verified Apr 2026):
//   Sheet "Freight Index-Shipments"   — col B = "MMM-YY", col C = index value (base 1.0 / Jan 1990)
//   Sheet "Freight Index-Expenditures" — same layout, base 1.0 / Jan 1990
//   Sheet "TL LH Index"                — col B = "MMM-YY", col C = index value (base 100 / Jan 2005)

import { fetchWithRetry } from '../lib/http.mjs';
import { readHistoryCsv } from '../lib/csv.mjs';
import path from 'node:path';
import * as XLSX from 'xlsx';

export const id = 'scrape:cass';

const URL = 'https://www.cassinfo.com/hubfs/Cass%20Indexes%20Historical%20Data.xlsx';

const SHEET_MAP = {
  CASS_SHIPMENTS:    'Freight Index-Shipments',
  CASS_EXPENDITURES: 'Freight Index-Expenditures',
  CASS_LINEHAUL:     'TL LH Index',
};

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
};

export async function fetch({ entries, dataDir }) {
  const results = {};
  let wb = null;
  let fetchErr = null;
  try {
    const buf = await fetchWithRetry(URL, { expectBuffer: true, tries: 3, timeout: 45000, headers: HEADERS });
    wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
  } catch (err) {
    fetchErr = err;
  }

  for (const e of entries) {
    const sheetName = SHEET_MAP[e.id];
    const existing = await readHistoryCsv(path.join(dataDir, 'history', `${e.id}.csv`));
    if (!sheetName) {
      results[e.id] = { ok: false, error: `Cass: unknown id ${e.id}` };
      continue;
    }
    if (!wb) {
      results[e.id] = existing.length
        ? { ok: false, observations: existing, error: `Cass fetch: ${fetchErr?.message || 'no workbook'}; kept last-known-good` }
        : { ok: false, error: `Cass: ${fetchErr?.message || 'fetch failed'}` };
      continue;
    }
    const sheet = wb.Sheets[sheetName];
    if (!sheet) {
      results[e.id] = existing.length
        ? { ok: false, observations: existing, error: `Cass: sheet '${sheetName}' missing; kept last-known-good` }
        : { ok: false, error: `Cass: sheet '${sheetName}' missing` };
      continue;
    }
    const obs = parseSheet(sheet);
    if (obs.length > 0) {
      results[e.id] = { ok: true, observations: obs };
    } else {
      results[e.id] = existing.length
        ? { ok: false, observations: existing, error: `Cass parse failed for ${e.id}; kept last-known-good` }
        : { ok: false, error: `Cass: parse failed for ${e.id}` };
    }
  }
  return { results };
}

function parseSheet(sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' });
  const out = [];
  for (const row of rows) {
    if (!row || row.length < 3) continue;
    const monthRaw = row[1];
    const valueRaw = row[2];
    if (!monthRaw || valueRaw == null) continue;
    const date = parseMonthYY(String(monthRaw).trim());
    if (!date) continue;
    const value = Number(String(valueRaw).replace(/,/g, '').trim());
    if (!Number.isFinite(value)) continue;
    out.push({ date, value });
  }
  const map = new Map();
  for (const o of out) map.set(o.date, o.value);
  return [...map.entries()]
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

const MONTHS = { Jan:'01', Feb:'02', Mar:'03', Apr:'04', May:'05', Jun:'06',
                 Jul:'07', Aug:'08', Sep:'09', Oct:'10', Nov:'11', Dec:'12' };

function parseMonthYY(s) {
  const m = s.match(/^([A-Za-z]{3})-(\d{2})$/);
  if (!m) return null;
  const key = m[1].slice(0,1).toUpperCase() + m[1].slice(1).toLowerCase();
  const mm = MONTHS[key];
  if (!mm) return null;
  const yy = parseInt(m[2], 10);
  const yyyy = yy <= 69 ? 2000 + yy : 1900 + yy;
  return `${yyyy}-${mm}-01`;
}
