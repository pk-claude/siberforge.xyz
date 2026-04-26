// Yahoo Finance v8 chart endpoint — daily history for industrial REIT basket.
// Used by REIT_INDUSTRIAL_BASKET, REIT_AVG_DIV_YIELD, etc.
//
// Important: each entry that uses source==='yahoo' may carry an Array sourceId
// (a basket of tickers). The composite (equal-weight index, mean div yield)
// is computed here in the source module before being returned.

import { fetchWithRetry, pMapLimit } from '../lib/http.mjs';

const BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';

export const id = 'yahoo';

export async function fetch({ entries }) {
  const results = {};

  for (const entry of entries) {
    try {
      if (entry.id === 'REIT_INDUSTRIAL_BASKET') {
        results[entry.id] = { ok: true, observations: await basketIndex(entry.sourceId) };
      } else if (entry.id === 'REIT_AVG_DIV_YIELD') {
        results[entry.id] = { ok: true, observations: await basketDivYield(entry.sourceId) };
      } else if (Array.isArray(entry.sourceId)) {
        // generic: equal-weight price index
        results[entry.id] = { ok: true, observations: await basketIndex(entry.sourceId) };
      } else {
        results[entry.id] = { ok: true, observations: await singleHistory(entry.sourceId) };
      }
    } catch (err) {
      results[entry.id] = { ok: false, error: String(err.message || err) };
    }
  }
  return { results };
}

async function singleHistory(ticker) {
  const url = new URL(`${BASE}/${encodeURIComponent(ticker)}`);
  url.searchParams.set('range', '10y');
  url.searchParams.set('interval', '1d');
  url.searchParams.set('events', 'div');
  const json = await fetchWithRetry(url.toString(), { expectJson: true, tries: 4 });
  const r = json?.chart?.result?.[0];
  if (!r) throw new Error(`Yahoo: no result for ${ticker}`);
  const ts = r.timestamp || [];
  const close = r.indicators?.adjclose?.[0]?.adjclose || r.indicators?.quote?.[0]?.close || [];
  const out = [];
  for (let i = 0; i < ts.length; i++) {
    const v = close[i];
    if (Number.isFinite(v)) {
      out.push({ date: tsToDate(ts[i]), value: v });
    }
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

async function basketIndex(tickers) {
  // Pull each ticker, equal-weight rebase to 100 at first common date.
  const series = await pMapLimit(tickers, 3, t => singleHistory(t));
  // Build map per ticker of date->value, then for dates present in ALL, compute equal-weight return.
  const byTicker = series.map(s => new Map(s.map(o => [o.date, o.value])));
  const allDates = new Set();
  for (const m of byTicker) for (const d of m.keys()) allDates.add(d);
  const sortedDates = [...allDates].sort();
  // Find first date that all tickers have
  let firstCommon = null;
  for (const d of sortedDates) {
    if (byTicker.every(m => m.has(d))) { firstCommon = d; break; }
  }
  if (!firstCommon) return [];
  const baseValues = byTicker.map(m => m.get(firstCommon));
  const out = [];
  let lastIndex = 100;
  for (const d of sortedDates) {
    if (d < firstCommon) continue;
    const ratios = byTicker.map((m, i) => {
      const v = m.get(d);
      return Number.isFinite(v) ? v / baseValues[i] : null;
    });
    const valid = ratios.filter(r => r !== null);
    if (valid.length < tickers.length) continue; // require all present
    const avg = valid.reduce((s, r) => s + r, 0) / valid.length;
    lastIndex = avg * 100;
    out.push({ date: d, value: round(lastIndex, 4) });
  }
  return out;
}

async function basketDivYield(tickers) {
  // Approximate trailing-12-month div yield: sum dividends in last 365d / current price.
  // Yahoo chart with events=div returns dividend events on the timestamp grid via `events.dividends`.
  const yields = [];
  for (const t of tickers) {
    const url = new URL(`${BASE}/${encodeURIComponent(t)}`);
    url.searchParams.set('range', '5y');
    url.searchParams.set('interval', '1d');
    url.searchParams.set('events', 'div');
    let json;
    try { json = await fetchWithRetry(url.toString(), { expectJson: true, tries: 4 }); }
    catch { continue; }
    const r = json?.chart?.result?.[0];
    if (!r) continue;
    const ts = r.timestamp || [];
    const close = r.indicators?.quote?.[0]?.close || [];
    const divs = r.events?.dividends || {};
    const divList = Object.values(divs)
      .map(d => ({ date: tsToDate(d.date), amount: Number(d.amount) }))
      .filter(d => d.date && Number.isFinite(d.amount));

    // Build daily yield series.
    for (let i = 0; i < ts.length; i++) {
      const date = tsToDate(ts[i]);
      const price = close[i];
      if (!Number.isFinite(price) || price <= 0) continue;
      const cutoff = new Date(date); cutoff.setUTCDate(cutoff.getUTCDate() - 365);
      const cutoffStr = cutoff.toISOString().slice(0, 10);
      const annualDiv = divList.filter(d => d.date <= date && d.date > cutoffStr).reduce((s, d) => s + d.amount, 0);
      if (annualDiv > 0) {
        const y = (annualDiv / price) * 100;
        yields.push({ ticker: t, date, value: y });
      }
    }
  }
  // Average across tickers per date (only dates where all six have data).
  const byDate = new Map();
  for (const r of yields) {
    if (!byDate.has(r.date)) byDate.set(r.date, []);
    byDate.get(r.date).push(r.value);
  }
  const out = [];
  for (const [date, list] of [...byDate.entries()].sort()) {
    if (list.length >= Math.max(2, Math.floor(tickers.length * 0.7))) {
      const avg = list.reduce((s, v) => s + v, 0) / list.length;
      out.push({ date, value: round(avg, 3) });
    }
  }
  return out;
}

function tsToDate(ts) { return new Date(ts * 1000).toISOString().slice(0, 10); }
function round(v, d) { const m = 10 ** d; return Math.round(v * m) / m; }
