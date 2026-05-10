// scripts/sources/yahoo-equity-pe.mjs
// Yahoo Finance fetchers for the Equity P/E dashboard.
// - quoteSummary: forward/trailing P/E, sector, industry, financials
// - earnings_dates / quarterly + annual income stmt: historical EPS for chart
// - chart endpoint: monthly closes
//
// Public endpoints; no API key required. Uses the same lib/http.mjs helpers
// as the existing supply-chain refresh.

import { fetchWithRetry, pMapLimit } from '../lib/http.mjs';

const QS = 'https://query2.finance.yahoo.com/v10/finance/quoteSummary';
const CH = 'https://query1.finance.yahoo.com/v8/finance/chart';

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
  const url = `${QS}/${encodeURIComponent(ticker)}?modules=${MODULES}`;
  const json = await fetchWithRetry(url, { expectJson: true, tries: 4 });
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
  const json = await fetchWithRetry(url.toString(), { expectJson: true, tries: 4 });
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
export async function fetchEpsHistory(ticker) {
  const url = `${QS}/${encodeURIComponent(ticker)}?modules=incomeStatementHistory,incomeStatementHistoryQuarterly`;
  let json;
  try { json = await fetchWithRetry(url, { expectJson: true, tries: 3 }); }
  catch { return { qe: [], ae: [] }; }
  const r = json?.quoteSummary?.result?.[0];
  if (!r) return { qe: [], ae: [] };

  const num = (x) => (x == null ? null : (typeof x === 'object' ? (x.raw ?? null) : Number(x)));
  const toEps = (rows) => rows
    .map(s => {
      // dilutedEPS not always present; fall back to NetIncome / SharesOutstanding via dilutedAverageShares
      const eps =
        num(s.dilutedEPS) ?? num(s.basicEPS);
      const date = (s.endDate?.fmt || '').slice(0, 10);
      return (eps != null && date) ? [date, Math.round(eps * 10000) / 10000] : null;
    })
    .filter(Boolean)
    .sort((a, b) => b[0].localeCompare(a[0])); // most recent first

  return {
    qe: toEps(r.incomeStatementHistoryQuarterly?.incomeStatementHistory || []),
    ae: toEps(r.incomeStatementHistory?.incomeStatementHistory || []),
  };
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
