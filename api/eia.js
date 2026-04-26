// Vercel serverless function: proxies EIA API v2 with server-side key.
// Used by /core/supply/ for diesel, gasoline, electricity series.
//
// Returns { series: [...], errors: [...] } shape mirroring /api/fred.

const EIA_BASE = 'https://api.eia.gov/v2';

// Whitelisted EIA queries. Each entry maps a stable internal id to:
//   path:    EIA v2 path
//   facets:  { facetName: ['value', ...] } applied as facets[name][]=value
//   freq:    'weekly' | 'monthly' | 'annual'
//   value:   field name in `data` array to take as the numeric value
const CATALOG = {
  // Diesel retail price, US average, all types — weekly
  DIESEL_RETAIL: {
    path: '/petroleum/pri/gnd/data',
    facets: { duoarea: ['NUS'], product: ['EPD2D'], process: ['PTE'], series: ['EMD_EPD2D_PTE_NUS_DPG'] },
    freq: 'weekly',
    value: 'value',
  },
  // Gasoline retail price, US regular all-formulations — weekly
  GASOLINE_RETAIL: {
    path: '/petroleum/pri/gnd/data',
    facets: { duoarea: ['NUS'], product: ['EPMR'], process: ['PTE'], series: ['EMM_EPMR_PTE_NUS_DPG'] },
    freq: 'weekly',
    value: 'value',
  },
  // Industrial-sector electricity rate, US average — monthly
  ELEC_INDUSTRIAL: {
    path: '/electricity/retail-sales/data',
    facets: { sectorid: ['IND'], stateid: ['US'] },
    freq: 'monthly',
    value: 'price',
  },
  // Residential electricity price, US average — monthly
  ELEC_RESIDENTIAL: {
    path: '/electricity/retail-sales/data',
    facets: { sectorid: ['RES'], stateid: ['US'] },
    freq: 'monthly',
    value: 'price',
  },
  // Nuclear generation, US total — monthly
  NUCLEAR_GEN_US: {
    path: '/electricity/electric-power-operational-data/data',
    facets: { sectorid: ['99'], stateid: ['US'], fueltypeid: ['NUC'] },
    freq: 'monthly',
    value: 'generation',
  },
  // Renewable generation, US total — monthly
  RENEWABLE_GEN_US: {
    path: '/electricity/electric-power-operational-data/data',
    facets: { sectorid: ['99'], stateid: ['US'], fueltypeid: ['REN'] },
    freq: 'monthly',
    value: 'generation',
  },
  // Natural gas generation, US total — monthly
  GAS_GEN_US: {
    path: '/electricity/electric-power-operational-data/data',
    facets: { sectorid: ['99'], stateid: ['US'], fueltypeid: ['NG'] },
    freq: 'monthly',
    value: 'generation',
  },
  // Coal generation, US total — monthly
  COAL_GEN_US: {
    path: '/electricity/electric-power-operational-data/data',
    facets: { sectorid: ['99'], stateid: ['US'], fueltypeid: ['COW'] },
    freq: 'monthly',
    value: 'generation',
  },
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchSeries(id, key) {
  const cfg = CATALOG[id];
  if (!cfg) throw new Error(`unknown EIA series ${id}`);

  const url = new URL(EIA_BASE + cfg.path);
  url.searchParams.set('api_key', key);
  url.searchParams.set('frequency', cfg.freq);
  url.searchParams.set('data[0]', cfg.value);
  url.searchParams.set('sort[0][column]', 'period');
  url.searchParams.set('sort[0][direction]', 'asc');
  url.searchParams.set('length', '5000');
  for (const [name, values] of Object.entries(cfg.facets || {})) {
    for (const v of values) url.searchParams.append(`facets[${name}][]`, v);
  }

  const RETRY_DELAYS = [400, 1200, 2500];
  let lastErr;
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const res = await fetch(url.toString());
      if (res.ok) {
        const json = await res.json();
        const data = json?.response?.data || [];
        const observations = data
          .map(d => ({ date: normalizeDate(d.period, cfg.freq), value: Number(d[cfg.value]) }))
          .filter(o => o.date && Number.isFinite(o.value));
        return { id, observations };
      }
      const text = await res.text();
      const transient = res.status >= 500 || res.status === 429;
      lastErr = new Error(`EIA ${id} ${res.status}: ${text.slice(0, 200)}`);
      if (!transient || attempt === RETRY_DELAYS.length) throw lastErr;
      await sleep(RETRY_DELAYS[attempt]);
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (attempt === RETRY_DELAYS.length) throw lastErr;
      await sleep(RETRY_DELAYS[attempt]);
    }
  }
  throw lastErr || new Error(`EIA ${id} unknown failure`);
}

// EIA period strings come as "YYYY-MM-DD" (weekly), "YYYY-MM" (monthly), "YYYY" (annual).
// Normalize to YYYY-MM-DD using first-of-period.
function normalizeDate(period, freq) {
  if (!period) return null;
  if (freq === 'weekly') return period.slice(0, 10);
  if (freq === 'monthly') return `${period}-01`;
  if (freq === 'annual')  return `${period}-01-01`;
  return period;
}

export default async function handler(req, res) {
  const key = process.env.EIA_API_KEY;
  if (!key) return res.status(500).json({ error: 'EIA_API_KEY not configured on server' });

  if (req.query.catalog) {
    return res.status(200).json({ catalog: Object.fromEntries(Object.entries(CATALOG).map(([k, v]) => [k, { freq: v.freq }])) });
  }

  const seriesParam = (req.query.series || '').trim();
  if (!seriesParam) return res.status(400).json({ error: 'missing ?series=ID1,ID2,...' });

  const ids = seriesParam.split(',').map(s => s.trim()).filter(Boolean);
  const unknown = ids.filter(id => !CATALOG[id]);
  if (unknown.length) return res.status(400).json({ error: `unknown EIA series: ${unknown.join(',')}` });

  try {
    const settled = await Promise.allSettled(ids.map(id => fetchSeries(id, key)));
    const series = [];
    const errors = [];
    settled.forEach((r, i) => {
      if (r.status === 'fulfilled') series.push(r.value);
      else errors.push({ id: ids[i], error: String(r.reason?.message || r.reason) });
    });
    if (series.length === 0 && errors.length > 0) {
      return res.status(502).json({ error: 'all series failed', errors });
    }
    res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
    return res.status(200).json({ series, errors });
  } catch (err) {
    return res.status(502).json({ error: String(err.message || err) });
  }
}
