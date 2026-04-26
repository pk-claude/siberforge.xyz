// NY Fed Global Supply Chain Pressure Index.
// NY Fed publishes the GSCPI as an Excel file at a stable URL on its research page.
// We try a few canonical URLs; the file format has been a 2-column (date, gscpi) historical series.
//
// Reference: https://www.newyorkfed.org/research/policy/gscpi
//
// Strategy:
//   1) Try the canonical xlsx download URL.
//   2) Parse the sheet — first column is date (YYYY-MM or month-end), second is value.
//   3) Fall back gracefully on failure (will retain last-known-good).

import { fetchWithRetry } from '../lib/http.mjs';

const URLS = [
  'https://www.newyorkfed.org/medialibrary/research/interactives/gscpi/downloads/gscpi_data.xlsx',
];

export const id = 'scrape:nyfed-gscpi';

export async function fetch({ entries }) {
  const results = {};
  let observations = null;
  let lastErr = null;
  for (const url of URLS) {
    try {
      const buf = await fetchWithRetry(url, { expectBuffer: true, tries: 3, timeout: 45000 });
      observations = await parseXlsx(buf);
      if (observations && observations.length > 0) break;
    } catch (err) { lastErr = err; }
  }
  for (const entry of entries) {
    if (entry.id === 'GSCPI') {
      if (observations && observations.length > 0) {
        results[entry.id] = { ok: true, observations };
      } else {
        results[entry.id] = { ok: false, error: String(lastErr?.message || 'GSCPI fetch failed') };
      }
    } else {
      results[entry.id] = { ok: false, error: 'unknown nyfed-gscpi indicator' };
    }
  }
  return { results };
}

// Minimal XLSX parser: NY Fed's file is a small workbook with a single sheet of two columns.
// We use Node's built-in unzip via decompression of zip files. Avoiding heavy xlsx libs.
async function parseXlsx(buf) {
  // XLSX is a zip; we need to extract xl/sharedStrings.xml and xl/worksheets/sheet1.xml.
  // Use minimal in-memory zip reader.
  const zip = await readZip(buf);
  const sharedStrings = zip['xl/sharedStrings.xml'] ? extractSharedStrings(zip['xl/sharedStrings.xml']) : [];
  const sheetXml = zip['xl/worksheets/sheet1.xml'];
  if (!sheetXml) throw new Error('GSCPI xlsx: no sheet1.xml');
  return extractDateValueRows(sheetXml.toString('utf8'), sharedStrings);
}

// Read a zip into a { filename: Buffer } map using Node's zlib for the deflate parts.
import { inflateRawSync } from 'node:zlib';
async function readZip(buf) {
  // Find end-of-central-directory record (EOCD) signature 0x06054b50, scanning back from end.
  const EOCD = 0x06054b50;
  let i = buf.length - 22;
  while (i >= 0 && buf.readUInt32LE(i) !== EOCD) i--;
  if (i < 0) throw new Error('GSCPI xlsx: EOCD not found');
  const cdSize = buf.readUInt32LE(i + 12);
  const cdOff = buf.readUInt32LE(i + 16);
  const out = {};
  let p = cdOff;
  while (p < cdOff + cdSize) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localHdrOff = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8');
    p += 46 + nameLen + extraLen + commentLen;

    // Read local header to find file data offset.
    if (buf.readUInt32LE(localHdrOff) !== 0x04034b50) continue;
    const compression = buf.readUInt16LE(localHdrOff + 8);
    const compSize = buf.readUInt32LE(localHdrOff + 18);
    const uncompSize = buf.readUInt32LE(localHdrOff + 22);
    const lhNameLen = buf.readUInt16LE(localHdrOff + 26);
    const lhExtraLen = buf.readUInt16LE(localHdrOff + 28);
    const dataStart = localHdrOff + 30 + lhNameLen + lhExtraLen;
    const data = buf.subarray(dataStart, dataStart + compSize);
    let inflated;
    if (compression === 0) inflated = data;
    else if (compression === 8) inflated = inflateRawSync(data);
    else continue;
    out[name] = inflated;
  }
  return out;
}

function extractSharedStrings(xmlBuf) {
  const xml = xmlBuf.toString('utf8');
  const out = [];
  const re = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let m;
  while ((m = re.exec(xml))) {
    // Concatenate all <t>...</t> contents inside this <si>.
    const inner = m[1];
    const tre = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
    let tm; let s = '';
    while ((tm = tre.exec(inner))) s += unescape(tm[1]);
    out.push(s);
  }
  return out;
}

function unescape(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

function extractDateValueRows(xml, sharedStrings) {
  // Parse <row>...<c r="A1" t="...">...<v>...</v></c></row>
  const rows = [];
  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let rm;
  while ((rm = rowRe.exec(xml))) {
    const cells = [];
    const cellRe = /<c\s+r="([A-Z]+)\d+"(?:\s+t="([^"]+)")?[^>]*>([\s\S]*?)<\/c>/g;
    let cm;
    while ((cm = cellRe.exec(rm[1]))) {
      const col = cm[1];
      const t = cm[2];
      const inner = cm[3];
      const vMatch = inner.match(/<v>([\s\S]*?)<\/v>/);
      const v = vMatch ? vMatch[1] : null;
      cells.push({ col, t, v });
    }
    if (cells.length >= 2) rows.push(cells);
  }

  // First column = date, second column = value.
  const out = [];
  for (const row of rows) {
    const a = row.find(c => c.col === 'A');
    const b = row.find(c => c.col === 'B');
    if (!a || !b || a.v == null || b.v == null) continue;
    const date = parseDateCell(a, sharedStrings);
    const value = Number(b.v);
    if (date && Number.isFinite(value)) out.push({ date, value });
  }
  // Sort + de-dupe
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

function parseDateCell(cell, sharedStrings) {
  if (cell.t === 's') {
    const idx = Number(cell.v);
    const s = sharedStrings[idx] || '';
    return parseDateString(s);
  }
  // Numeric — Excel serial date.
  const n = Number(cell.v);
  if (!Number.isFinite(n)) return null;
  if (n > 10000 && n < 60000) {
    // Excel epoch 1899-12-30 (the well-known +1 Lotus bug means Excel uses 1899-12-30 as day 0)
    const ms = (n - 25569) * 86400 * 1000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  return null;
}

function parseDateString(s) {
  if (!s) return null;
  // try YYYY-MM or YYYY-MM-DD or MM/DD/YYYY
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) return s;
  const ym = s.match(/^(\d{4})-(\d{2})$/);
  if (ym) return `${ym[1]}-${ym[2]}-01`;
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
  // try parseable
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}
