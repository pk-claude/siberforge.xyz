// scripts/sources/yahoo-equity-pe.mjs
// Yahoo Finance fetchers for the Equity P/E dashboard.
// - quoteSummary: forward/trailing P/E, sector, industry, financials
//   (requires cookie + crumb since ~June 2026; see bootstrapSession)
// - fundamentals-timeseries: quarterly + annual diluted EPS for chart
// - chart endpoint: monthly closes
//
// Public endpoints; no API key required. Uses the same lib/http.mjs helpers
// as the existing supply-chain refresh.

import { fetchWithRetry, pMapLimit } from '../lib/http.mjs';

const QS = 'https://query2.finance.yahoo.com/v10/finance/quoteSummary';
const CH = 'https://query1.finance.yahoo.com/v8/finance/chart';
const TS = 'https://query2.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries';

// Yahoo started enforcing a session cookie + crumb on quoteSummary
// (401 "Invalid Crumb" without one). Chart + timeseries endpoints don't
// need it. The cookie must be fetched with the same User-Agent used for
// the API calls.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

let _sessionPromise = null;

async function bootstrapSession() {
  // fc.yahoo.com returns 404 but sets the session cookie.
  const res = await fetch('https://fc.yahoo.com', {
    headers: { 'User-Agent': UA },
    redirect: 'manual',
  }).catch(() => null);
  const setCookies = res?.headers?.getSetCookie?.() || [];
  const cookie = setCookies.map(c => c.split(';')[0]).join('; ');
  if (!cookie) throw new Error('Yahoo: no session cookie from fc.yahoo.com');
  const cr = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
    headers: { 'User-Agent': UA, Cookie: cookie },
  });
  const crumb = (await cr.text()).trim();
  if (!cr.ok || !crumb || crumb.includes('<')) {
    throw new Error(`Yahoo: crumb fetch failed (HTTP ${cr.status})`);
  }
  return { cookie, crumb };
}

function getSession(force = false) {
  if (force || !_sessionPromise) _sessionPromise = bootstrapSession();
  return _sessionPromise;
}

const FIELDS = [
  'trailingPE','forwardPE','marketCap','sector','industry','longName','shortName',
  'totalRevenue','netIncomeToCommon','trailingEps','forwardEps',
  'profitMargins','operatingMargins','grossMargins','returnOnEquity','debtToEquity',
  'revenueGrowth','earningsGrowth','dividendYield','beta',
  'fiftyTwoWeekHigh','fiftyTwoWeekLow','currentPrice','regularMarketPrice',
  'pegRatio','priceToBook','enterpriseValue','ebitda','longBusinessSummary',
];
const MODULES = 'summaryDetail,defaultKeyStatistics,assetProfile,financialData,price';

// --- Single-ticker fundamentals fetch -------------------------------------
export async function fetchFundamentals(ticker) {
  let json = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const s = await getSession(attempt > 0);
    const url = `${QS}/${encodeURIComponent(ticker)}?modules=${MODULES}&crumb=${encodeURIComponent(s.crumb)}`;
    try {
      json = await fetchWithRetry(url, {
        expectJson: true,
        tries: 4,
        headers: { 'User-Agent': UA, Cookie: s.cookie },
      });
      break;
    } catch (e) {
      // Stale/invalid crumb -> refresh session once, then retry.
      if (attempt === 0 && /401|Unauthorized|Invalid Crumb/i.test(String(e.message))) continue;
      throw e;
    }
  }
  const r = json?.quoteSummary?.result?.[0];
  if (!r) throw new Error(`Yahoo: no quoteSummary for ${ticker}`);

  const sd  = r.summaryDetail        || {};
  const dks = r.defaultKeyStatistics || {};
  const ap  = r.assetProfile         || {};
  const fd  = r.financialData        || {};
  const pr  = r.price                || {};

  const num = (x) => (x == null ? null : (typeof x === 'object' ? (x.raw ?? null) : Number(x)));

  return {
    t: ticker,
    n: pr.longName || pr.shortName || ticker,
    sec: ap.sector || null,
    ind: ap.industry || null,
    tpe:    num(sd.trailingPE),
    fpe:    num(sd.forwardPE) ?? num(dks.forwardPE),
    mc:     num(pr.marketCap) ?? num(sd.marketCap),
    px:     num(fd.currentPrice) ?? num(pr.regularMarketPrice),
    rev:    num(fd.totalRevenue),
    ni:     num(dks.netIncomeToCommon),
    eps_t:  num(dks.trailingEps),
    eps_f:  num(dks.forwardEps),
    pm:     num(fd.profitMargins),
    om:     num(fd.operatingMargins),
    gm:     num(fd.grossMargins),
    roe:    num(fd.returnOnEquity),
    de:     num(fd.debtToEquity),
    rg:     num(fd.revenueGrowth),
    eg:     num(fd.earningsGrowth),
    div:    num(sd.dividendYield),
    beta:   num(sd.beta) ?? num(dks.beta),
    h52:    num(sd.fiftyTwoWeekHigh) ?? num(pr.regularMarketDayHigh),
    l52:    num(sd.fiftyTwoWeekLow)  ?? num(pr.regularMarketDayLow),
    peg:    num(dks.pegRatio),
    pb:     num(dks.priceToBook),
    ev:     num(dks.enterpriseValue),
    ebitda: num(fd.ebitda),
    desc:   (ap.longBusinessSummary || '').slice(0, 500),
  };
}

// --- Monthly close history (6y) -------------------------------------------
export async function fetchMonthlyHistory(ticker, years = 6) {
  const url = new URL(`${CH}/${encodeURIComponent(ticker)}`);
  url.searchParams.set('range', `${years}y`);
  url.searchParams.set('interval', '1mo');
  const json = await fetchWithRetry(url.toString(), {
    expectJson: true,
    tries: 4,
    headers: { 'User-Agent': UA },
  });
  const r = json?.chart?.result?.[0];
  if (!r) return [];
  const ts = r.timestamp || [];
  const close = r.indicators?.adjclose?.[0]?.adjclose || r.indicators?.quote?.[0]?.close || [];
  const out = [];
  for (let i = 0; i < ts.length; i++) {
    const v = close[i];
    if (Number.isFinite(v)) {
      const d = new Date(ts[i] * 1000);
      const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      out.push([ym, Math.round(v * 100) / 100]);
    }
  }
  return out;
}

// --- Quarterly + annual EPS (for TTM/forward-PF reconstruction) -----------
// Uses the fundamentals-timeseries endpoint (no crumb needed). The old
// incomeStatementHistory quoteSummary modules stopped returning dilutedEPS.
export async function fetchEpsHistory(ticker) {
  const p2 = Math.floor(Date.now() / 1000);
  const p1 = p2 - 6 * 365 * 86400;
  const url = `${TS}/${encodeURIComponent(ticker)}?type=quarterlyDilutedEPS,annualDilutedEPS&period1=${p1}&period2=${p2}`;
  let json;
  try {
    json = await fetchWithRetry(url, {
      expectJson: true,
      tries: 3,
      headers: { 'User-Agent': UA },
    });
  } catch { return { qe: [], ae: [] }; }

  const out = { qe: [], ae: [] };
  for (const block of json?.timeseries?.result || []) {
    const key = block.quarterlyDilutedEPS ? 'quarterlyDilutedEPS'
              : block.annualDilutedEPS    ? 'annualDilutedEPS'
              : null;
    if (!key) continue;
    const rows = (block[key] || [])
      .filter(Boolean)
      .map(r => {
        const eps = r.reportedValue?.raw;
        const date = r.asOfDate; // 'YYYY-MM-DD' period end
        return (eps != null && date) ? [date, Math.round(eps * 10000) / 10000] : null;
      })
      .filter(Boolean)
      .sort((a, b) => b[0].localeCompare(a[0])); // most recent first
    if (key === 'quarterlyDilutedEPS') out.qe = rows;
    else out.ae = rows;
  }
  return out;
}

// --- Bulk: fundamentals for all tickers (concurrency-limited) -------------
export async function fetchAllFundamentals(tickers, concurrency = 6) {
  return await pMapLimit(tickers, concurrency, async (t) => {
    try { return await fetchFundamentals(t); }
    catch (e) { return { t, err: String(e.message || e).slice(0, 120) }; }
  });
}

export async function fetchAllHistory(tickers, concurrency = 6) {
  return await pMapLimit(tickers, concurrency, async (t) => {
    try {
      const [prices, eps] = await Promise.all([fetchMonthlyHistory(t), fetchEpsHistory(t)]);
      return { t, prices, ...eps };
    } catch (e) {
      return { t, err: String(e.message || e).slice(0, 120) };
    }
  });
}
