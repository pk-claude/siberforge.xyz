// Vercel serverless function: proxies FRED API with server-side key.
// Call as: /api/fred?series=CPIAUCSL,UNRATE,DFF&start=2015-01-01
// Supports one or many comma-separated series IDs.

const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations';

// Catalog of indicators we expose. Front-end references the `id` keys.
// Meta data (frequency, unit) is used for display and for resampling decisions.
const CATALOG = {
  // Core macro
  CPIAUCSL:  { label: 'CPI (Headline)',          freq: 'monthly',   unit: 'index',   transform: 'yoy_pct' },
  DFF:       { label: 'Fed Funds Rate',          freq: 'daily',     unit: 'percent', transform: 'level' },
  UNRATE:    { label: 'Unemployment Rate',       freq: 'monthly',   unit: 'percent', transform: 'level' },
  GDPC1:     { label: 'Real GDP',                freq: 'quarterly', unit: 'bn_usd',  transform: 'yoy_pct' },
  DGS10:     { label: '10Y Treasury Yield',      freq: 'daily',     unit: 'percent', transform: 'level' },
  // Leading indicators
  INDPRO:    { label: 'Industrial Production',   freq: 'monthly',   unit: 'index',   transform: 'yoy_pct' },
  ICSA:      { label: 'Initial Jobless Claims',  freq: 'weekly',    unit: 'count',   transform: 'level' },
  UMCSENT:   { label: 'Consumer Sentiment',      freq: 'monthly',   unit: 'index',   transform: 'level' },
  PERMIT:    { label: 'Building Permits',        freq: 'monthly',   unit: 'count',   transform: 'yoy_pct' },
  RSAFS:     { label: 'Retail Sales',            freq: 'monthly',   unit: 'usd',     transform: 'yoy_pct' },
  // Liquidity & monetary
  M2SL:      { label: 'M2 Money Supply',         freq: 'monthly',   unit: 'bn_usd',  transform: 'yoy_pct' },
  WALCL:     { label: 'Fed Balance Sheet',       freq: 'weekly',    unit: 'mm_usd',  transform: 'level' },
  RRPONTSYD: { label: 'Reverse Repo (ON)',       freq: 'daily',     unit: 'bn_usd',  transform: 'level' },
  WTREGEN:   { label: 'Treasury General Account',freq: 'weekly',    unit: 'bn_usd',  transform: 'level' },
};

async function fetchSeries(id, key, start) {
  const url = new URL(FRED_BASE);
  url.searchParams.set('series_id', id);
  url.searchParams.set('api_key', key);
  url.searchParams.set('file_type', 'json');
  if (start) url.searchParams.set('observation_start', start);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FRED ${id} ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  // Normalize: keep numeric observations only; FRED uses "." for missing.
  const observations = (json.observations || [])
    .filter(o => o.value !== '.' && o.value !== null && o.value !== undefined)
    .map(o => ({ date: o.date, value: Number(o.value) }))
    .filter(o => Number.isFinite(o.value));
  return { id, meta: CATALOG[id] || null, observations };
}

export default async function handler(req, res) {
  const key = process.env.FRED_API_KEY;
  if (!key) {
    return res.status(500).json({ error: 'FRED_API_KEY not configured on server' });
  }

  // Handle ?catalog=1 to return the full list of available indicators.
  if (req.query.catalog) {
    return res.status(200).json({ catalog: CATALOG });
  }

  const seriesParam = (req.query.series || '').trim();
  if (!seriesParam) {
    return res.status(400).json({ error: 'missing ?series=ID1,ID2,...' });
  }

  const ids = seriesParam.split(',').map(s => s.trim()).filter(Boolean);
  // Reject anything not in catalog — prevents misuse of the proxy.
  const unknown = ids.filter(id => !CATALOG[id]);
  if (unknown.length) {
    return res.status(400).json({ error: `unknown series: ${unknown.join(',')}` });
  }

  const start = req.query.start || '2010-01-01';

  try {
    const results = await Promise.all(ids.map(id => fetchSeries(id, key, start)));
    // Cache hint: FRED releases on a fixed schedule; 6h edge cache is safe.
    res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
    return res.status(200).json({ series: results });
  } catch (err) {
    return res.status(502).json({ error: String(err.message || err) });
  }
}
