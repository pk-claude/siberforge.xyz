#!/usr/bin/env node
// scripts/refresh-equity-pe.mjs
// Weekly full refresh: pulls S&P 500 + Nasdaq-100 constituents, fetches
// fundamentals + monthly history + quarterly/annual EPS for each, computes
// peer groups and historical P/E series, writes all outputs to
// core/equity/pe/data/.
//
// Run: node scripts/refresh-equity-pe.mjs
// Dry: node scripts/refresh-equity-pe.mjs --dry-run

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchWithRetry } from './lib/http.mjs';
import * as cheerio from 'cheerio';
import {
  fetchAllFundamentals,
  fetchAllHistory,
} from './sources/yahoo-equity-pe.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT  = path.join(ROOT, 'core', 'equity', 'pe', 'data');
const DRY  = process.argv.includes('--dry-run');

// -------------------------------------------------------------------------
// 1) Constituent lists from Wikipedia
// -------------------------------------------------------------------------
async function fetchSP500() {
  const html = await fetchWithRetry('https://en.wikipedia.org/wiki/List_of_S%26P_500_companies',
    { headers: { 'User-Agent': 'siberforge-bot' } });
  const $ = cheerio.load(html);
  const tbl = $('#constituents').first();
  const rows = [];
  tbl.find('tbody tr').each((i, tr) => {
    if (i === 0) return;
    const tds = $(tr).find('td');
    if (tds.length < 4) return;
    const sym = $(tds[0]).text().trim().replace(/\./g, '-');
    const name = $(tds[1]).text().trim();
    const sec = $(tds[2]).text().trim();
    const ind = $(tds[3]).text().trim();
    if (sym) rows.push({ ticker: sym, name, gics_sector: sec, gics_industry: ind });
  });
  return rows;
}

async function fetchNDX() {
  const html = await fetchWithRetry('https://en.wikipedia.org/wiki/Nasdaq-100',
    { headers: { 'User-Agent': 'siberforge-bot' } });
  const $ = cheerio.load(html);
  // Find the table whose header includes "Ticker" or "Symbol"
  let result = [];
  $('table.wikitable').each((_, t) => {
    const $t = $(t);
    const headers = $t.find('thead tr th, tr:first-child th').map((_, h) => $(h).text().trim().toLowerCase()).get();
    if (!headers.some(h => h.includes('ticker') || h.includes('symbol'))) return;
    const rows = [];
    $t.find('tbody tr').each((i, tr) => {
      if (i === 0 && $(tr).find('th').length) return;
      const tds = $(tr).find('td');
      if (!tds.length) return;
      // Try to find ticker column (heuristic: first cell is short, uppercase)
      let sym = null, name = null;
      tds.each((idx, td) => {
        const txt = $(td).text().trim();
        if (!sym && /^[A-Z][A-Z0-9.\-]{0,5}$/.test(txt)) sym = txt;
        else if (!name && txt.length > 2) name = txt;
      });
      if (sym) rows.push({ ticker: sym.replace(/\./g, '-'), name: name || sym });
    });
    if (rows.length > 80 && rows.length < 130 && result.length === 0) result = rows;
  });
  return result;
}

// -------------------------------------------------------------------------
// 2) Build universe (dedupe + flag SP/NDX membership)
// -------------------------------------------------------------------------
function buildUniverse(sp, ndx) {
  const m = new Map();
  for (const r of sp)  m.set(r.ticker, { ...r, in_sp500: true,  in_ndx: false });
  for (const r of ndx) {
    const x = m.get(r.ticker);
    if (x) x.in_ndx = true;
    else   m.set(r.ticker, { ticker: r.ticker, name: r.name, in_sp500: false, in_ndx: true });
  }
  return [...m.values()];
}

// -------------------------------------------------------------------------
// 3) Compute peers (top 5 by mkt cap in same industry; fallback to sector)
// -------------------------------------------------------------------------
function computePeers(records) {
  const byInd = new Map();
  const bySec = new Map();
  for (const r of records) {
    if (r.ind) (byInd.get(r.ind) || byInd.set(r.ind, []).get(r.ind)).push(r);
    if (r.sec) (bySec.get(r.sec) || bySec.set(r.sec, []).get(r.sec)).push(r);
  }
  for (const [, arr] of byInd) arr.sort((a, b) => (b.mc || 0) - (a.mc || 0));
  for (const [, arr] of bySec) arr.sort((a, b) => (b.mc || 0) - (a.mc || 0));

  for (const r of records) {
    let kind = 'industry';
    let pool = (byInd.get(r.ind) || []).filter(x => x.t !== r.t).slice(0, 5);
    if (!pool.length) {
      kind = 'sector';
      pool = (bySec.get(r.sec) || []).filter(x => x.t !== r.t).slice(0, 5);
    }
    r.peers = pool.map(p => ({ t: p.t, n: p.n, tpe: p.tpe, fpe: p.fpe }));
    r.peer_kind = kind;
  }
}

// -------------------------------------------------------------------------
// 3b) Compute Normalized P/E (Shiller-style) + cycle stats per ticker
//     Uses the historical TTM EPS series (price / trailing-PE at each month)
//     EXCLUDING the trailing 6 months — which are biased low for tickers
//     whose latest fiscal year hasn't yet closed (annual data hasn't rolled).
//     Yahoo's reported eps_t is used as the authoritative "current EPS" for
//     percentile calculation.
// -------------------------------------------------------------------------
function cycleTag(p) {
  if (p == null) return null;
  if (p >= 85) return 'Peak';
  if (p >= 65) return 'Above-trend';
  if (p >= 35) return 'Mid-cycle';
  if (p >= 15) return 'Below-trend';
  return 'Trough';
}

function computeNormalized(records, series) {
  for (const r of records) {
    const s = series[r.t] || [];
    const px = r.px;
    if (!s.length || px == null || px <= 0) { r.npe = null; r.cycle = null; continue; }
    // Trim last 6 months — same fix as in our seed script
    const cut = Math.max(0, s.length - 6);
    const epsHist = [];
    for (let i = 0; i < cut; i++) {
      const [, mpx, tpe] = s[i];
      if (tpe != null && tpe > 0 && mpx) epsHist.push(mpx / tpe);
    }
    if (epsHist.length < 24) { r.npe = null; r.cycle = null; continue; }
    const avg = epsHist.reduce((a, b) => a + b, 0) / epsHist.length;
    if (avg <= 0) { r.npe = null; r.cycle = null; continue; }

    // Authoritative current EPS: Yahoo's reported eps_t; fallback to series tail
    let curEps = (r.eps_t != null && r.eps_t > 0) ? r.eps_t : null;
    if (curEps == null) {
      for (let i = s.length - 1; i >= 0; i--) {
        const [, mpx, tpe] = s[i];
        if (tpe != null && tpe > 0 && mpx) { curEps = mpx / tpe; break; }
      }
    }
    if (curEps == null) { r.npe = null; r.cycle = null; continue; }

    const sorted = epsHist.slice().sort((a, b) => a - b);
    const rank = sorted.filter(e => e <= curEps).length;
    const pctile = Math.round(1000 * rank / sorted.length) / 10;

    r.npe        = Math.round((px / avg) * 100) / 100;
    r.eps_avg5y  = Math.round(avg * 10000) / 10000;
    r.eps_min5y  = Math.round(Math.min(...epsHist) * 10000) / 10000;
    r.eps_max5y  = Math.round(Math.max(...epsHist) * 10000) / 10000;
    r.eps_cur    = Math.round(curEps * 10000) / 10000;
    r.eps_pctile = pctile;
    r.cycle      = cycleTag(pctile);
    r.n_months   = epsHist.length;
  }
}

// -------------------------------------------------------------------------
// 4) Compute monthly TTM and forward-PF P/E series per ticker
// -------------------------------------------------------------------------
function computeSeries(history) {
  const series = {};
  for (const h of history) {
    if (h.err || !h.prices?.length) continue;
    const prices = h.prices; // [['YYYY-MM', close], ...]
    const qe = h.qe || [];
    const ae = h.ae || [];
    if (!qe.length && !ae.length) continue;

    // monthly index
    const monthIdx = prices.map(p => p[0]);
    const monthMap = new Map(monthIdx.map((m, i) => [m, i]));
    const eps = new Array(monthIdx.length).fill(null);
    const hasQ = new Array(monthIdx.length).fill(false);

    // Quarterly contributions: each quarter ending at q_date covers 3 months
    for (const [qstr, q_eps] of qe) {
      const [y, m] = qstr.slice(0, 7).split('-').map(Number);
      for (let off = 0; off < 3; off++) {
        const dy = y, dm = m - off;
        const adj = dm <= 0 ? { y: dy - 1, m: dm + 12 } : { y: dy, m: dm };
        const ym = `${adj.y}-${String(adj.m).padStart(2, '0')}`;
        const idx = monthMap.get(ym);
        if (idx != null) { eps[idx] = q_eps / 3; hasQ[idx] = true; }
      }
    }
    // Annual fallback: 12 months back from year-end
    const annual = new Array(monthIdx.length).fill(null);
    for (const [astr, a_eps] of ae) {
      const [y, m] = astr.slice(0, 7).split('-').map(Number);
      for (let off = 0; off < 12; off++) {
        const dy = y, dm = m - off;
        const adj = dm <= 0 ? { y: dy - 1, m: dm + 12 } : { y: dy, m: dm };
        const ym = `${adj.y}-${String(adj.m).padStart(2, '0')}`;
        const idx = monthMap.get(ym);
        if (idx != null) annual[idx] = a_eps / 12;
      }
    }
    for (let i = 0; i < eps.length; i++) {
      if (!hasQ[i]) eps[i] = annual[i];
    }

    // Compute TTM and forward-PF
    const out = [];
    for (let i = 0; i < monthIdx.length; i++) {
      if (i < 11) continue;
      const ttmWin = eps.slice(i - 11, i + 1);
      const ttm = ttmWin.filter(v => v != null).length >= 6 ? ttmWin.reduce((s, v) => s + (v || 0), 0) : null;
      let fwd = null;
      if (i + 12 < monthIdx.length) {
        const fwdWin = eps.slice(i + 1, i + 13);
        if (fwdWin.filter(v => v != null).length >= 6) {
          fwd = fwdWin.reduce((s, v) => s + (v || 0), 0);
        }
      }
      const px = prices[i][1];
      const tpe = (ttm && ttm > 0) ? Math.round((px / ttm) * 100) / 100 : null;
      const fpe = (fwd && fwd > 0) ? Math.round((px / fwd) * 100) / 100 : null;
      out.push([monthIdx[i], px, tpe, fpe]);
    }
    if (out.length) series[h.t] = out.slice(-60); // last 60 months
  }
  return series;
}

// -------------------------------------------------------------------------
// Main
// -------------------------------------------------------------------------
async function main() {
  const t0 = Date.now();
  console.log(`[refresh-equity-pe] start (dry=${DRY})`);

  console.log('  fetching constituent lists...');
  const [sp, ndx] = await Promise.all([fetchSP500(), fetchNDX()]);
  console.log(`    sp500=${sp.length}  ndx=${ndx.length}`);
  const universe = buildUniverse(sp, ndx);
  console.log(`    universe (deduped) = ${universe.length}`);

  console.log('  fetching fundamentals...');
  const fundsArr = await fetchAllFundamentals(universe.map(u => u.ticker), 6);
  const fundsMap = new Map(fundsArr.map(f => [f.t, f]));

  // Merge universe metadata with fundamentals
  const records = universe.map(u => {
    const f = fundsMap.get(u.ticker) || { t: u.ticker, n: u.name };
    return {
      ...f,
      n: f.n || u.name,
      sec: f.sec || u.gics_sector || null,
      ind: f.ind || u.gics_industry || null,
      sp: !!u.in_sp500,
      ndx: !!u.in_ndx,
    };
  });

  computePeers(records);

  console.log('  fetching monthly history + EPS...');
  const histArr = await fetchAllHistory(universe.map(u => u.ticker), 6);
  const series = computeSeries(histArr);
  console.log(`    series tickers = ${Object.keys(series).length}`);

  console.log('  computing Normalized P/E + cycle stats...');
  computeNormalized(records, series);
  const npeCount = records.filter(r => r.npe != null).length;
  console.log(`    normalized P/E for ${npeCount}/${records.length} tickers`);

  const errs = histArr.filter(h => h.err);
  if (errs.length) console.log(`    history errors: ${errs.length} (e.g. ${errs[0].t}: ${errs[0].err})`);

  // --- Sanity guards: never overwrite good data with a broken run. -------
  // June 2026: Yahoo flipped on crumb enforcement and this script silently
  // wrote 516 err records and an empty series.json. Fail loudly instead.
  const fundErrs = records.filter(r => r.err).length;
  const seriesCount = Object.keys(series).length;
  if (fundErrs > records.length * 0.3) {
    console.error(`[refresh-equity-pe] ABORT: ${fundErrs}/${records.length} fundamentals failed; not writing output.`);
    console.error(`  first error: ${records.find(r => r.err)?.err}`);
    process.exit(1);
  }
  if (seriesCount < records.length * 0.5) {
    console.error(`[refresh-equity-pe] ABORT: only ${seriesCount} P/E series for ${records.length} tickers; not writing output.`);
    process.exit(1);
  }

  // Compute next-Sunday 14:00 UTC (skipping today if today is Sunday)
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 14, 0, 0));
  while (next.getUTCDay() !== 0 || next <= now) next.setUTCDate(next.getUTCDate() + 1);

  const meta = {
    refreshed_at: now.toISOString(),
    refreshed_at_human: now.toUTCString(),
    next_refresh_at: next.toISOString(),
    next_refresh_at_human: next.toUTCString(),
    universe: records.length,
    sp500: records.filter(r => r.sp).length,
    nasdaq100: records.filter(r => r.ndx).length,
    series_count: Object.keys(series).length,
    snapshot_count: 0, // updated by snapshot script
  };

  if (DRY) {
    console.log('  [DRY] would write:', { OUT, records: records.length, series: Object.keys(series).length });
    return;
  }

  await fs.mkdir(OUT, { recursive: true });
  await fs.writeFile(path.join(OUT, 'companies.json'), JSON.stringify(records));
  await fs.writeFile(path.join(OUT, 'series.json'),    JSON.stringify(series));

  // Preserve snapshot count if last-refresh.json already exists
  try {
    const prev = JSON.parse(await fs.readFile(path.join(OUT, 'last-refresh.json'), 'utf-8'));
    if (typeof prev.snapshot_count === 'number') meta.snapshot_count = prev.snapshot_count;
  } catch {}
  await fs.writeFile(path.join(OUT, 'last-refresh.json'), JSON.stringify(meta, null, 2));

  console.log(`[refresh-equity-pe] done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main().catch(e => { console.error(e); process.exit(1); });
