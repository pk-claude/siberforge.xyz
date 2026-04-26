// CSV helpers — read/write per-series history files.

import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Write a series of {date, value} observations as CSV.
 * Replaces the file atomically (write tmp, rename).
 */
export async function writeHistoryCsv(filePath, observations, { label, source } = {}) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const header = `# ${label || ''}  source=${source || ''}  generated=${new Date().toISOString()}\ndate,value\n`;
  const body = observations.map(o => `${o.date},${formatValue(o.value)}`).join('\n') + '\n';
  const tmp = filePath + '.tmp';
  await fs.writeFile(tmp, header + body, 'utf8');
  await fs.rename(tmp, filePath);
}

function formatValue(v) {
  if (v === null || v === undefined) return '';
  if (!Number.isFinite(v)) return '';
  // Preserve precision; trim trailing zeros while keeping integers integer.
  if (Number.isInteger(v)) return String(v);
  return String(v);
}

/**
 * Read a previously-written CSV back into an observations array.
 * Returns [] if file missing.
 */
export async function readHistoryCsv(filePath) {
  let raw;
  try { raw = await fs.readFile(filePath, 'utf8'); }
  catch (err) { if (err.code === 'ENOENT') return []; throw err; }
  const out = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith('#') || line.startsWith('date,')) continue;
    const [date, value] = line.split(',');
    const v = Number(value);
    if (date && Number.isFinite(v)) out.push({ date, value: v });
  }
  return out;
}
