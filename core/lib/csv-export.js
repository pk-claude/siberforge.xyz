// Universal CSV / JSON export utility.
// Used by every dashboard's "Download data" button + the consolidated
// /core/data/ page. No external deps.
//
// API:
//   downloadCSV(filename, rows)     — rows = array of arrays (first row = header)
//   downloadJSON(filename, data)    — data = any serializable
//   seriesToCSV(filename, series)   — series = [{ id|label, observations: [{date, value}] }, ...]
//                                     produces a wide-format CSV with one date col + one col per series.
//   tableToCSV(filename, table)     — table = { headers: [...], rows: [[...], ...] }
//
// CSV escaping: strings containing commas/quotes/newlines are wrapped in quotes;
// internal quotes are doubled. Numbers are passed through unchanged.

function escapeCell(v) {
  if (v == null || v === undefined) return '';
  if (typeof v === 'number') return String(v);
  const s = String(v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function rowsToCsvText(rows) {
  return rows.map(r => r.map(escapeCell).join(',')).join('\n');
}

function trigger(filename, content, mime) {
  const blob = new Blob([content], { type: mime + ';charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadCSV(filename, rows) {
  trigger(filename, rowsToCsvText(rows), 'text/csv');
}

export function downloadJSON(filename, data) {
  trigger(filename, JSON.stringify(data, null, 2), 'application/json');
}

// Convert FRED-shape series array to wide-format CSV.
// Input: [{ id: 'CPILFESL', label: 'Core CPI', observations: [{date, value}] }, ...]
// Output rows: header = ['date', label1, label2, ...], rows aligned by union of dates.
export function seriesToCSV(filename, series) {
  if (!series || !series.length) {
    downloadCSV(filename, [['no data']]);
    return;
  }
  // Union of all dates, sorted ascending
  const allDates = new Set();
  for (const s of series) {
    for (const o of (s.observations || [])) allDates.add(o.date);
  }
  const sortedDates = [...allDates].sort();
  // Index each series by date
  const indexed = series.map(s => {
    const m = new Map();
    for (const o of (s.observations || [])) m.set(o.date, o.value);
    return m;
  });
  const headers = ['date', ...series.map(s => s.label || s.id || 'value')];
  const rows = [headers];
  for (const d of sortedDates) {
    const row = [d];
    for (const idx of indexed) {
      const v = idx.get(d);
      row.push(v == null ? '' : v);
    }
    rows.push(row);
  }
  downloadCSV(filename, rows);
}

// Convert a generic table to CSV.
// Input: { headers: ['col1', 'col2', ...], rows: [[v, v, ...], ...] }
export function tableToCSV(filename, table) {
  const allRows = [table.headers, ...(table.rows || [])];
  downloadCSV(filename, allRows);
}

// Convenience: pull download links for an array of series via the FRED proxy.
// Returns [{label, href}] usable in the consolidated data page.
export function fredSeriesDownloadHref(seriesId, label) {
  // Direct CSV from FRED via the proxy with a CSV transformer would be ideal,
  // but our /api/fred returns JSON. Caller fetches JSON then calls seriesToCSV().
  return { id: seriesId, label, source: 'FRED via /api/fred' };
}
