// Vercel serverless function: proxies BLS Public Data API v2.
// Used by /core/supply/ for series not on FRED (or with richer detail than FRED's mirror).
//
// Returns { series: [...], errors: [...] } shape mirroring /api/fred.

const BLS_BASE = 'https://api.bls.gov/publicAPI/v2/timeseries/data/';

// Whitelist of permitted BLS series IDs.
// Anything not in this list returns 400 — keeps the proxy from being an open BLS gateway.
const ALLOWED = new Set([
  // (placeholder for future BLS-only series; FRED mirrors most BLS series, so we mostly use FRED)
  'CES4349300008',  // also on FRED but we keep BLS as backup
  'JTS440000000000000JOL',
  'JTS440000000000000QUR',
  'JTS440000000000000LDR',
]);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchSeries(ids, key, startYear, endYear) {
  const body = {
    seriesid: ids,
    startyear: String(startYear),
    endyear: String(endYear),
    catalog: false,
    calculations: false,
    annualaverage: false,
  };
  if (key) body.registrationkey = key;

  const RETRY_DELAYS = [400, 1500, 3000];
  let lastErr;
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const res = await fetch(BLS_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.status !== 'REQUEST_SUCCEEDED') {
          throw new Error(`BLS status=${json.status} msg=${(json.message || []).join('; ')}`);
        }
        return (json.Results?.series || []).map(s => ({
          id: s.seriesID,
          observations: (s.data || [])
            .map(d => ({
              date: blsDate(d.year, d.period, d.periodName),
              value: Number(d.value),
            }))
            .filter(o => o.date && Number.isFinite(o.value))
            .sort((a, b) => a.date.localeCompare(b.date)),
        }));
      }
      const text = await res.text();
      const transient = res.status >= 500 || res.status === 429;
      lastErr = new Error(`BLS ${res.status}: ${text.slice(0, 200)}`);
      if (!transient || attempt === RETRY_DELAYS.length) throw lastErr;
      await sleep(RETRY_DELAYS[attempt]);
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (attempt === RETRY_DELAYS.length) throw lastErr;
      await sleep(RETRY_DELAYS[attempt]);
    }
  }
  throw lastErr || new Error('BLS unknown failure');
}

// BLS period codes:
//   M01..M12 → month (use first of month)
//   M13      → annual avg (skip)
//   Q01..Q04 → quarter start month
function blsDate(year, period, _periodName) {
  if (!year || !period) return null;
  if (period === 'M13') return null; // annual average
  if (period.startsWith('M')) {
    const m = period.slice(1);
    return `${year}-${m}-01`;
  }
  if (period.startsWith('Q')) {
    const q = Number(period.slice(1));
    const month = String(((q - 1) * 3) + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  }
  return null;
}

export default async function handler(req, res) {
  const key = process.env.BLS_API_KEY; // optional; without key, BLS limits to 25 req/day per IP

  const seriesParam = (req.query.series || '').trim();
  if (!seriesParam) return res.status(400).json({ error: 'missing ?series=ID1,ID2,...' });

  const ids = seriesParam.split(',').map(s => s.trim()).filter(Boolean);
  const unknown = ids.filter(id => !ALLOWED.has(id));
  if (unknown.length) return res.status(400).json({ error: `unknown BLS series: ${unknown.join(',')}` });

  const now = new Date();
  const endYear = now.getUTCFullYear();
  const startYear = endYear - (Number(req.query.years) || 15);

  try {
    const out = await fetchSeries(ids, key, startYear, endYear);
    res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
    return res.status(200).json({ series: out, errors: [] });
  } catch (err) {
    return res.status(502).json({ error: String(err.message || err) });
  }
}
