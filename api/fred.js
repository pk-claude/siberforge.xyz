// Vercel serverless function: proxies FRED API with server-side key.
// Returns { series: [...], errors: [...] } with allSettled partial-failure tolerance.

const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations';

const CATALOG = {
  // ====================== MACRO DASHBOARD (/core/macro/) ======================
  CPIAUCSL:  { label: 'CPI (Headline)',          freq: 'monthly',   unit: 'index',   transform: 'yoy_pct' },
  DFF:       { label: 'Fed Funds Rate',          freq: 'daily',     unit: 'percent', transform: 'level' },
  UNRATE:    { label: 'Unemployment Rate',       freq: 'monthly',   unit: 'percent', transform: 'level' },
  GDPC1:     { label: 'Real GDP',                freq: 'quarterly', unit: 'bn_usd',  transform: 'yoy_pct' },
  DGS10:     { label: '10Y Treasury Yield',      freq: 'daily',     unit: 'percent', transform: 'level' },
  INDPRO:    { label: 'Industrial Production',   freq: 'monthly',   unit: 'index',   transform: 'yoy_pct' },
  ICSA:      { label: 'Initial Jobless Claims',  freq: 'weekly',    unit: 'count',   transform: 'level' },
  UMCSENT:   { label: 'Consumer Sentiment',      freq: 'monthly',   unit: 'index',   transform: 'level' },
  PERMIT:    { label: 'Building Permits',        freq: 'monthly',   unit: 'count',   transform: 'yoy_pct' },
  RSAFS:     { label: 'Retail Sales',            freq: 'monthly',   unit: 'usd',     transform: 'yoy_pct' },
  M2SL:      { label: 'M2 Money Supply',         freq: 'monthly',   unit: 'bn_usd',  transform: 'yoy_pct' },
  WALCL:     { label: 'Fed Balance Sheet',       freq: 'weekly',    unit: 'mm_usd',  transform: 'level' },
  RRPONTSYD: { label: 'Reverse Repo (ON)',       freq: 'daily',     unit: 'bn_usd',  transform: 'level' },
  WTREGEN:   { label: 'Treasury General Account',freq: 'weekly',    unit: 'bn_usd',  transform: 'level' },
  USREC:     { label: 'NBER Recession Indicator',freq: 'monthly',   unit: 'binary',  transform: 'level' },

  // ================= CYCLE DASHBOARD (/core/macro/cycle/) =================
  NFCI:          { label: 'Chicago Fed NFCI',              freq: 'weekly',  unit: 'index',   transform: 'level', group: 'cycle' },
  ANFCI:         { label: 'Adjusted NFCI',                 freq: 'weekly',  unit: 'index',   transform: 'level', group: 'cycle' },
  BAMLC0A0CM:    { label: 'IG Credit Spread (OAS)',        freq: 'daily',   unit: 'percent', transform: 'level', group: 'cycle' },
  DFII2:         { label: '2Y TIPS Real Yield',            freq: 'daily',   unit: 'percent', transform: 'level', group: 'cycle' },
  DFII10:        { label: '10Y TIPS Real Yield',           freq: 'daily',   unit: 'percent', transform: 'level', group: 'cycle' },
  RECPROUSM156N: { label: 'Smoothed Recession Probability',freq: 'monthly', unit: 'percent', transform: 'level', group: 'cycle' },

  // ================= INFLATION DASHBOARD (/core/macro/inflation/) =================
  T5YIE:                   { label: '5Y Breakeven Inflation',          freq: 'daily',   unit: 'percent', transform: 'level',   group: 'inflation' },
  T10YIE:                  { label: '10Y Breakeven Inflation',         freq: 'daily',   unit: 'percent', transform: 'level',   group: 'inflation' },
  COREFLEXCPIM159SFRBATL:  { label: 'Atlanta Flex-Price Core CPI',     freq: 'monthly', unit: 'percent', transform: 'level',   group: 'inflation' },
  CPIHOSSL:                { label: 'CPI Shelter',                     freq: 'monthly', unit: 'index',   transform: 'yoy_pct', group: 'inflation' },
  MICH:                    { label: 'UMich 1Y Inflation Expectations', freq: 'monthly', unit: 'percent', transform: 'level',   group: 'inflation' },

  // ================= REAL ECONOMY (/core/macro/real-economy/) =================
  PCE:           { label: 'Personal Consumption Expenditures',          freq: 'monthly',   unit: 'bn_usd',  transform: 'yoy_pct', group: 'real-economy' },
  DSPI:          { label: 'Disposable Personal Income',                 freq: 'monthly',   unit: 'bn_usd',  transform: 'yoy_pct', group: 'real-economy' },
  PSAVERT:       { label: 'Personal Saving Rate',                       freq: 'monthly',   unit: 'percent', transform: 'level',   group: 'real-economy' },
  TDSP:          { label: 'Household Debt Service Ratio',               freq: 'quarterly', unit: 'percent', transform: 'level',   group: 'real-economy' },
  MSACSR:        { label: 'Monthly Supply of New Houses',               freq: 'monthly',   unit: 'months',  transform: 'level',   group: 'real-economy' },
  WPU081:        { label: 'PPI: Lumber & Wood Products',                freq: 'monthly',   unit: 'index',   transform: 'yoy_pct', group: 'real-economy' },

  // ================= HOUSING DASHBOARD (/core/macro/housing/) =================
  HOUST1F:       { label: 'Housing Starts: Single-Family',  freq: 'monthly',   unit: 'count',   transform: 'yoy_pct', group: 'housing' },
  HOUST5F:       { label: 'Housing Starts: 5+ Units (MF)',  freq: 'monthly',   unit: 'count',   transform: 'yoy_pct', group: 'housing' },
  COMPUTSA:      { label: 'Housing Completions',            freq: 'monthly',   unit: 'count',   transform: 'yoy_pct', group: 'housing' },
  MSPUS:         { label: 'Median Sales Price of Houses',   freq: 'quarterly', unit: 'usd',     transform: 'level',   group: 'housing' },
  DRSFRMACBS:    { label: 'SF Mortgage Delinquency Rate',   freq: 'quarterly', unit: 'percent', transform: 'level',   group: 'housing' },
  CUUR0000SEHA:  { label: 'CPI: Rent of Primary Residence', freq: 'monthly',   unit: 'index',   transform: 'yoy_pct', group: 'housing' },
  MEHOINUSA672N: { label: 'Real Median Family Income',      freq: 'annual',    unit: 'usd',     transform: 'level',   group: 'housing' },
  MORTGAGE15US:  { label: '15Y Fixed Mortgage Rate',        freq: 'weekly',    unit: 'percent', transform: 'level',   group: 'housing' },
  PRRESCONS:     { label: 'Private Residential Construction Spending', freq: 'monthly', unit: 'mm_usd', transform: 'yoy_pct', group: 'housing' },
  CES2000000001: { label: 'Construction Employment',        freq: 'monthly',   unit: 'count',   transform: 'yoy_pct', group: 'housing' },
  RHVRUSQ156N:   { label: 'Rental Vacancy Rate',            freq: 'quarterly', unit: 'percent', transform: 'level',   group: 'housing' },
  MSPNHSUS:      { label: 'Median Sales Price of New Houses', freq: 'quarterly', unit: 'usd',     transform: 'level',   group: 'housing' },
  ASPNHSUS:      { label: 'Avg Sales Price of New Houses',   freq: 'quarterly', unit: 'usd',     transform: 'level',   group: 'housing' },
  CUSR0000SEHE:  { label: "CPI: Tenants' & Household Insurance", freq: 'monthly', unit: 'index', transform: 'yoy_pct', group: 'housing' },

  // ===================== ECON DASHBOARD (/core/econ/) =====================
  T10Y3M:                { label: '10Y-3M Treasury Spread',  freq: 'daily',     unit: 'percent', transform: 'level',   group: 'econ' },
  GACDISA066MSFRBNY:     { label: 'Empire State Mfg Index',  freq: 'monthly',   unit: 'index',   transform: 'level',   group: 'econ' },
  GDPNOW:                { label: 'Atlanta Fed GDPNow',      freq: 'daily',     unit: 'percent', transform: 'level',   group: 'econ' },
  DGS2:                  { label: '2Y Treasury Yield',       freq: 'daily',     unit: 'percent', transform: 'level',   group: 'econ' },
  DGS5:                  { label: '5Y Treasury Yield',       freq: 'daily',     unit: 'percent', transform: 'level',   group: 'econ' },
  T10Y2Y:                { label: '10Y-2Y Spread (2s10s)',   freq: 'daily',     unit: 'percent', transform: 'level',   group: 'econ' },
  PCEPILFE:              { label: 'Core PCE Price Index',    freq: 'monthly',   unit: 'index',   transform: 'yoy_pct', group: 'econ' },
  CPILFESL:              { label: 'Core CPI',                freq: 'monthly',   unit: 'index',   transform: 'yoy_pct', group: 'econ' },
  CORESTICKM159SFRBATL:  { label: 'Sticky-Price Core CPI',   freq: 'monthly',   unit: 'percent', transform: 'level',   group: 'econ' },
  T5YIFR:                { label: '5Y5Y Forward Inflation',  freq: 'daily',     unit: 'percent', transform: 'level',   group: 'econ' },
  PAYEMS:                { label: 'Nonfarm Payrolls',        freq: 'monthly',   unit: 'count',   transform: 'level',   group: 'econ' },
  CES0500000003:         { label: 'Avg Hourly Earnings',     freq: 'monthly',   unit: 'usd',     transform: 'yoy_pct', group: 'econ' },
  RRSFS:                 { label: 'Real Retail Sales',       freq: 'monthly',   unit: 'mm_usd',  transform: 'yoy_pct', group: 'econ' },
  IC4WSA:                { label: 'Jobless Claims (4wk MA)', freq: 'weekly',    unit: 'count',   transform: 'level',   group: 'econ' },
  DRCCLACBS:             { label: 'Credit Card Delinquency', freq: 'quarterly', unit: 'percent', transform: 'level',   group: 'econ' },
  HOUST:                 { label: 'Housing Starts',          freq: 'monthly',   unit: 'count',   transform: 'yoy_pct', group: 'econ' },
  EXHOSLUSM495S:         { label: 'Existing Home Sales',     freq: 'monthly',   unit: 'count',   transform: 'yoy_pct', group: 'econ' },
  HSN1F:                 { label: 'New Home Sales',          freq: 'monthly',   unit: 'count',   transform: 'yoy_pct', group: 'econ' },
  MORTGAGE30US:          { label: '30Y Fixed Mortgage Rate', freq: 'weekly',    unit: 'percent', transform: 'level',   group: 'econ' },
  CSUSHPISA:             { label: 'Case-Shiller Home Prices',freq: 'monthly',   unit: 'index',   transform: 'yoy_pct', group: 'econ' },

  // ===================== RECESSION DASHBOARD (/core/econ/recession.html) =====
  SAHMCURRENT:           { label: 'Sahm Rule Recession Indicator',  freq: 'monthly', unit: 'percent', transform: 'level', group: 'recession' },
  BAMLH0A0HYM2:          { label: 'High-Yield OAS',                 freq: 'daily',   unit: 'percent', transform: 'level', group: 'recession' },

  // ============== TRANSMISSION NETWORK (/core/macro/network.html) =============
  PPIACO:                { label: 'PPI: All Commodities',           freq: 'monthly', unit: 'index',   transform: 'yoy_pct', group: 'network' },
  CUMFNS:                { label: 'Capacity Utilization (Mfg)',     freq: 'monthly', unit: 'percent', transform: 'level',   group: 'network' },
  JTSJOL:                { label: 'JOLTS Job Openings',             freq: 'monthly', unit: 'count',   transform: 'yoy_pct', group: 'network' },
  CIVPART:               { label: 'Labor Force Participation Rate', freq: 'monthly', unit: 'percent', transform: 'level',   group: 'network' },
  SP500:                 { label: 'S&P 500 Index',                  freq: 'daily',   unit: 'index',   transform: 'yoy_pct', group: 'network' },
  DTWEXBGS:              { label: 'USD Trade-Weighted Broad Index', freq: 'daily',   unit: 'index',   transform: 'yoy_pct', group: 'network' },
  DCOILWTICO:            { label: 'WTI Crude Oil Spot Price',       freq: 'daily',   unit: 'usd',     transform: 'yoy_pct', group: 'network' },
  VIXCLS:                { label: 'CBOE VIX',                       freq: 'daily',   unit: 'index',   transform: 'level',   group: 'network' },

  // ===================== SUPPLY CHAIN DASHBOARD (/core/supply/) =====================
  // Distribution Center
  CES4300000008:    { label: 'TTU Avg Hourly Earnings',           freq: 'monthly', unit: 'usd',     transform: 'level',   group: 'supply' },
  CES4349300001:    { label: 'Warehousing & Storage Employment',  freq: 'monthly', unit: 'count',   transform: 'level',   group: 'supply' },
  JTU480099JOL:     { label: 'JOLTS: TWU Job Openings',           freq: 'monthly', unit: 'count',   transform: 'level',   group: 'supply' },
  JTU480099QUR:     { label: 'JOLTS: TWU Quits Rate',             freq: 'monthly', unit: 'percent', transform: 'level',   group: 'supply' },
  JTU480099LDR:     { label: 'JOLTS: TWU Layoffs Rate',           freq: 'monthly', unit: 'percent', transform: 'level',   group: 'supply' },
  WPU091503:        { label: 'PPI: Corrugated Paperboard',        freq: 'monthly', unit: 'index',   transform: 'level',   group: 'supply' },
  WPU0841:          { label: 'PPI: Wood Pallets',                 freq: 'monthly', unit: 'index',   transform: 'level',   group: 'supply' },
  WPU114:           { label: 'PPI: Material Handling Equipment',  freq: 'monthly', unit: 'index',   transform: 'level',   group: 'supply' },
  PCU493493:        { label: 'PPI: Warehousing & Storage Svcs',   freq: 'monthly', unit: 'index',   transform: 'level',   group: 'supply' },
  ISRATIO:          { label: 'Inventories-to-Sales Ratio',        freq: 'monthly', unit: 'ratio',   transform: 'level',   group: 'supply' },
  MNFCTRIMSA:       { label: 'Manufacturing Inventories',         freq: 'monthly', unit: 'mm_usd',  transform: 'level',   group: 'supply' },
  RETAILIMSA:       { label: 'Retail Inventories',                freq: 'monthly', unit: 'mm_usd',  transform: 'level',   group: 'supply' },
  WHLSLRIMSA:       { label: 'Wholesale Inventories',             freq: 'monthly', unit: 'mm_usd',  transform: 'level',   group: 'supply' },

  // Industrial Real Estate
  TLPRVCONS:        { label: 'Total Private Construction Spending', freq: 'monthly', unit: 'mm_usd', transform: 'level',  group: 'supply' },
  TLMFGCONS:        { label: 'Manufacturing Construction Spending', freq: 'monthly', unit: 'mm_usd', transform: 'level',  group: 'supply' },
  DRCRELEXFACBS:    { label: 'CRE Loan Delinquency Rate (ex Farmland)', freq: 'quarterly', unit: 'percent', transform: 'level', group: 'supply' },
  COMREPUSQ159N:    { label: 'Commercial Real Estate Prices',     freq: 'quarterly', unit: 'index',   transform: 'level',   group: 'supply' },
  MCUMFN:           { label: 'Capacity Utilization: Mfg (NAICS)', freq: 'monthly', unit: 'percent', transform: 'level',   group: 'supply' },

  // Middle Mile
  TRUCKD11:         { label: 'ATA Truck Tonnage Index',           freq: 'monthly', unit: 'index',   transform: 'level',   group: 'supply' },
  CES4348400001:    { label: 'Truck Transportation Employment',   freq: 'monthly', unit: 'count',   transform: 'level',   group: 'supply' },
  TSIFRGHT:         { label: 'Transportation Services: Freight',  freq: 'monthly', unit: 'index',   transform: 'level',   group: 'supply' },
  HTRUCKSSAAR:      { label: 'Heavy Truck Sales SAAR',            freq: 'monthly', unit: 'count',   transform: 'level',   group: 'supply' },
  PCU484121484121:  { label: 'PPI: Long-Distance General Freight TL', freq: 'monthly', unit: 'index', transform: 'level', group: 'supply' },
  RAILFRTINTERMODAL:{ label: 'Rail Freight Intermodal Traffic',   freq: 'monthly', unit: 'index',   transform: 'level',   group: 'supply' },
  RAILFRTCARLOADS:  { label: 'Rail Freight Carloads',             freq: 'monthly', unit: 'index',   transform: 'level',   group: 'supply' },

  // Last Mile
  CES4349200001:    { label: 'Couriers & Messengers Employment',  freq: 'monthly', unit: 'count',   transform: 'level',   group: 'supply' },
  CES4348800001:    { label: 'Support Activities for Transp Emp', freq: 'monthly', unit: 'count',   transform: 'level',   group: 'supply' },
  ECOMPCTSA:        { label: 'E-commerce % of Retail Sales',      freq: 'quarterly', unit: 'percent', transform: 'level', group: 'supply' },
  ECOMSA:           { label: 'E-commerce Retail Sales',           freq: 'quarterly', unit: 'mm_usd',  transform: 'level', group: 'supply' },
  CEU4200000001:    { label: 'Retail Trade Employment',           freq: 'monthly', unit: 'count',   transform: 'level',   group: 'supply' },
  LTRUCKSA:         { label: 'Light Trucks SAAR',                 freq: 'monthly', unit: 'count',   transform: 'level',   group: 'supply' },
  GASREGW:          { label: 'Retail Gasoline Price',             freq: 'weekly',  unit: 'usd',     transform: 'level',   group: 'supply' },
  PCU492492:        { label: 'PPI: Couriers & Messengers',        freq: 'monthly', unit: 'index',   transform: 'level',   group: 'supply' },
  PCU484110484110:  { label: 'PPI: General Freight Trucking, Local', freq: 'monthly', unit: 'index', transform: 'level',  group: 'supply' },

  // International / Sourcing
  BOPGIMP:          { label: 'US Imports of Goods (BoP)',         freq: 'monthly', unit: 'mm_usd',  transform: 'level',   group: 'supply' },
  BOPGEXP:          { label: 'US Exports of Goods (BoP)',         freq: 'monthly', unit: 'mm_usd',  transform: 'level',   group: 'supply' },
  CES4348100001:    { label: 'Air Transportation Employment',     freq: 'monthly', unit: 'count',   transform: 'level',   group: 'supply' },
};

// Sleep helper for retry backoff.
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Fetch one FRED series with retry on transient 5xx upstream errors.
// FRED occasionally returns 500 Internal Server Error for live requests; a
// quick retry usually succeeds. We retry on 5xx + 429 only — never on 4xx
// (bad series id, etc.).
async function fetchSeries(id, key, start, opts = {}) {
  const url = new URL(FRED_BASE);
  url.searchParams.set('series_id', id);
  url.searchParams.set('api_key', key);
  url.searchParams.set('file_type', 'json');
  if (start) url.searchParams.set('observation_start', start);
  if (opts.realtimeStart) url.searchParams.set('realtime_start', opts.realtimeStart);
  if (opts.realtimeEnd)   url.searchParams.set('realtime_end',   opts.realtimeEnd);

  const RETRY_DELAYS = [250, 750, 1500]; // 3 retries before giving up
  let lastErr = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const res = await fetch(url.toString());
      if (res.ok) {
        const json = await res.json();
        const observations = (json.observations || [])
          .filter(o => o.value !== '.' && o.value !== null && o.value !== undefined)
          .map(o => ({ date: o.date, value: Number(o.value) }))
          .filter(o => Number.isFinite(o.value));
        return { id, meta: CATALOG[id] || null, observations };
      }
      // Non-OK response. Read body for debug; decide if we should retry.
      const text = await res.text();
      const transient = res.status >= 500 || res.status === 429;
      lastErr = new Error(`FRED ${id} ${res.status}: ${text.slice(0, 200)}`);
      if (!transient || attempt === RETRY_DELAYS.length) throw lastErr;
      await sleep(RETRY_DELAYS[attempt]);
    } catch (err) {
      // Network/connection error — also transient; retry until we exhaust.
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (attempt === RETRY_DELAYS.length) throw lastErr;
      await sleep(RETRY_DELAYS[attempt]);
    }
  }
  // Should be unreachable but guard anyway.
  throw lastErr || new Error(`FRED ${id} unknown failure`);
}

function validDate(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }

// State-level + MSA-level allowlist patterns. Allowing these by regex avoids
// dumping ~250 explicit catalog entries per state * ~6 metrics each.
const STATE_RE = /^([A-Z]{2})(UR|STHPI|POP|NA|NQGSP|UPOP|CONS|MFG|RETL|TRAD|GOVT)$/;
const MSA_RE   = /^(ATNHPIUS\d{5}Q|LAUMT\d+|LAUMT.*A|MSACSR.*)$/;
const CPI_RE   = /^CUU[RS]A?\d{3,4}SA[A-Z0-9]+$/;

export default async function handler(req, res) {
  const key = process.env.FRED_API_KEY;
  if (!key) return res.status(500).json({ error: 'FRED_API_KEY not configured on server' });

  if (req.query.catalog) return res.status(200).json({ catalog: CATALOG });

  const seriesParam = (req.query.series || '').trim();
  if (!seriesParam) return res.status(400).json({ error: 'missing ?series=ID1,ID2,...' });

  const ids = seriesParam.split(',').map(s => s.trim()).filter(Boolean);
  const unknown = ids.filter(id => !CATALOG[id] && !STATE_RE.test(id) && !MSA_RE.test(id) && !CPI_RE.test(id));
  if (unknown.length) return res.status(400).json({ error: `unknown series: ${unknown.join(',')}` });

  const start = req.query.start || '2010-01-01';
  const opts = {};
  if (req.query.realtime_start) {
    if (!validDate(req.query.realtime_start)) return res.status(400).json({ error: 'realtime_start must be YYYY-MM-DD' });
    opts.realtimeStart = req.query.realtime_start;
  }
  if (req.query.realtime_end) {
    if (!validDate(req.query.realtime_end)) return res.status(400).json({ error: 'realtime_end must be YYYY-MM-DD' });
    opts.realtimeEnd = req.query.realtime_end;
  }

  try {
    const settled = await Promise.allSettled(ids.map(id => fetchSeries(id, key, start, opts)));
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
