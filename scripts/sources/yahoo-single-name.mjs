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
