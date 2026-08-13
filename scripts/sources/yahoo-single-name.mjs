// scripts/sources/yahoo-single-name.mjs
// Yahoo fundamentals-timeseries pulls for the single-name pages:
// annual + quarterly statement line items (Yahoo caps these at ~4 annual
// periods / ~5 quarters, which is why EDGAR provides the deep history),
// plus spot FX for non-USD filers.

import { fetchWithRetry } from '../lib/http.mjs';

const TS = 'https://query2.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries';
const CH = 'https://query1.finance.yahoo.com/v8/finance/chart';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const ITEMS = [
  'TotalRevenue', 'GrossProfit', 'OperatingIncome', 'NetIncome', 'DilutedEPS',
  'FreeCashFlow', 'OperatingCashFlow', 'CapitalExpenditure', 'ResearchAndDevelopment',
  'TotalDebt', 'CashAndCashEquivalents', 'CashCashEquivalentsAndShortTermInvestments',
  'DilutedAverageShares', 'StockholdersEquity', 'EBITDA',
];

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

// Returns { annual: {Item: [[end,val],...]}, quarterly: {...}, currency }
export async function fetchStatements(ticker) {
  const p2 = Math.floor(Date.now() / 1000);
  const p1 = p2 - 8 * 365 * 86400;
  const types = [];
  for (const it of ITEMS) { types.push('annual' + it, 'quarterly' + it); }

  const annual = {}, quarterly = {};
  let currency = null;

  for (const batch of chunk(types, 12)) {
    const url = `${TS}/${encodeURIComponent(ticker)}?type=${batch.join(',')}&period1=${p1}&period2=${p2}`;
    let json;
    try {
      json = await fetchWithRetry(url, { expectJson: true, tries: 3, headers: { 'User-Agent': UA } });
    } catch { continue; }
    for (const block of json?.timeseries?.result || []) {
      const key = Object.keys(block).find(k => k !== 'meta' && k !== 'timestamp');
      if (!key) continue;
      const isAnnual = key.startsWith('annual');
      const item = key.replace(/^annual|^quarterly/, '');
      const rows = (block[key] || []).filter(Boolean).map(r => {
        if (!currency && r.currencyCode) currency = r.currencyCode;
        return (r.reportedValue?.raw != null && r.asOfDate) ? [r.asOfDate, r.reportedValue.raw] : null;
      }).filter(Boolean).sort((a, b) => a[0].localeCompare(b[0]));
      if (!rows.length) continue;
      (isAnnual ? annual : quarterly)[item] = rows;
    }
  }
  return { annual, quarterly, currency: currency || 'USD' };
}

// Spot FX: units of `code` per 1 USD (e.g., TWD=X ~ 31).
export async function fetchFxPerUsd(code) {
  const url = `${CH}/${encodeURIComponent(code + '=X')}?range=5d&interval=1d`;
  const json = await fetchWithRetry(url, { expectJson: true, tries: 3, headers: { 'User-Agent': UA } });
  const r = json?.chart?.result?.[0];
  const closes = (r?.indicators?.quote?.[0]?.close || []).filter(Number.isFinite);
  return closes.length ? closes[closes.length - 1] : null;
}

// ---- ETF profile: holdings, sector weights, expenses (needs cookie+crumb) ----
let _sess = null;
async function etfSession(force) {
  if (_sess && !force) return _sess;
  const res = await fetch('https://fc.yahoo.com', { headers: { 'User-Agent': UA }, redirect: 'manual' }).catch(() => null);
  const cookie = (res?.headers?.getSetCookie?.() || []).map(c => c.split(';')[0]).join('; ');
  if (!cookie) throw new Error('Yahoo: no session cookie');
  const cr = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', { headers: { 'User-Agent': UA, Cookie: cookie } });
  const crumb = (await cr.text()).trim();
  if (!cr.ok || !crumb || crumb.includes('<')) throw new Error('Yahoo: crumb failed');
  _sess = { cookie, crumb };
  return _sess;
}

export async function fetchEtfProfile(ticker) {
  const MODS = 'topHoldings,fundProfile,summaryDetail,defaultKeyStatistics,price';
  let json = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const s = await etfSession(attempt > 0);
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=${MODS}&crumb=${encodeURIComponent(s.crumb)}`;
    try {
      json = await fetchWithRetry(url, { expectJson: true, tries: 3, headers: { 'User-Agent': UA, Cookie: s.cookie } });
      break;
    } catch (e) {
      if (attempt === 0 && /401|Invalid Crumb/i.test(String(e.message))) continue;
      throw e;
    }
  }
  const r = json?.quoteSummary?.result?.[0];
  if (!r) throw new Error(`no quoteSummary for ${ticker}`);
  const th = r.topHoldings || {}, fp = r.fundProfile || {}, sd = r.summaryDetail || {},
        ks = r.defaultKeyStatistics || {}, pr = r.price || {};
  const num = (x) => (x == null ? null : (typeof x === 'object' ? (x.raw ?? null) : Number(x)));
  return {
    name: pr.longName || pr.shortName || ticker,
    px: num(pr.regularMarketPrice),
    netAssets: num(sd.totalAssets) ?? num(ks.totalAssets),
    expenseRatio: num(fp.feesExpensesInvestment?.annualReportExpenseRatio),
    yield: num(sd.yield),
    ytd: num(ks.ytdReturn) ?? num(th.equityHoldings?.ytdReturn),
    h52: num(sd.fiftyTwoWeekHigh), l52: num(sd.fiftyTwoWeekLow),
    holdings: (th.holdings || []).map(h => ({
      t: h.symbol, n: h.holdingName, pct: num(h.holdingPercent),
    })),
    sectors: (th.sectorWeightings || []).map(sw => {
      const k = Object.keys(sw)[0];
      return { name: k, pct: num(sw[k]) };
    }).filter(x => x.pct != null),
    pe: num(th.equityHoldings?.priceToEarnings),
    pb: num(th.equityHoldings?.priceToBook),
  };
}
