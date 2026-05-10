#!/usr/bin/env node
// scripts/snapshot-equity-pe.mjs
// Daily forward-P/E snapshot. Reads the universe from companies.json (the
// latest weekly refresh), fetches just the "live" fields needed (forward
// P/E, trailing P/E, price, market cap), and writes one JSON to
// core/equity/pe/snapshots/YYYY-MM-DD.json.
//
// Skips weekends (no new data). The daily history accumulates so that 3
// months from now you can compare today's forward P/E vs. realized.
//
// Run: node scripts/snapshot-equity-pe.mjs
// Force run on weekend: node scripts/snapshot-equity-pe.mjs --force

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchFundamentals } from './sources/yahoo-equity-pe.mjs';
import { pMapLimit } from './lib/http.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA = path.join(ROOT, 'core', 'equity', 'pe', 'data');
const SNAP = path.join(ROOT, 'core', 'equity', 'pe', 'snapshots');
const FORCE = process.argv.includes('--force');

function todayUTC() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

async function main() {
  const t0 = Date.now();
  const day = todayUTC();
  const dow = new Date().getUTCDay(); // 0=Sun, 6=Sat
  if (!FORCE && (dow === 0 || dow === 6)) {
    console.log(`[snapshot-equity-pe] skipping ${day} (weekend; pass --force to override)`);
    return;
  }

  console.log(`[snapshot-equity-pe] start ${day}`);

  // Read universe from latest companies.json
  let universe;
  try {
    universe = JSON.parse(await fs.readFile(path.join(DATA, 'companies.json'), 'utf-8'));
  } catch (e) {
    console.error(`No companies.json found at ${DATA}. Run refresh-equity-pe first.`);
    process.exit(1);
  }

  const tickers = universe.map(u => u.t);
  // Build a lookup of normalized-P/E inputs from the latest weekly refresh.
  // npe is derived from 5y EPS history; only price changes day-to-day, so
  // we re-derive npe by scaling: npe = px / eps_avg5y. cycle/eps_pctile
  // are recomputed against the existing distribution.
  const meta = new Map(universe.map(u => [u.t, {
    eps_avg5y:  u.eps_avg5y,
    eps_min5y:  u.eps_min5y,
    eps_max5y:  u.eps_max5y,
    eps_t_prev: u.eps_t,        // last reported EPS — used as proxy for current
    sec:        u.sec,
  }]));
  console.log(`  ${tickers.length} tickers`);

  function cycleTag(p) {
    if (p == null) return null;
    if (p >= 85) return 'Peak';
    if (p >= 65) return 'Above-trend';
    if (p >= 35) return 'Mid-cycle';
    if (p >= 15) return 'Below-trend';
    return 'Trough';
  }

  const results = await pMapLimit(tickers, 6, async (t) => {
    try {
      const f = await fetchFundamentals(t);
      const m = meta.get(t) || {};
      const px = f.px;
      const npe = (px && m.eps_avg5y && m.eps_avg5y > 0)
        ? Math.round((px / m.eps_avg5y) * 100) / 100
        : null;
      // Use today's reported eps_t for percentile if available, otherwise carry forward
      const curEps = (f.eps_t != null && f.eps_t > 0) ? f.eps_t : m.eps_t_prev;
      let pctile = null, cycle = null;
      if (curEps != null && m.eps_min5y != null && m.eps_max5y != null) {
        // Approximate percentile: linearly interpolate within [min,max]; bounded 0..100
        const range = m.eps_max5y - m.eps_min5y;
        if (range > 0) {
          pctile = Math.round(1000 * Math.max(0, Math.min(1, (curEps - m.eps_min5y) / range))) / 10;
        }
        cycle = cycleTag(pctile);
      }
      return { t, fpe: f.fpe, tpe: f.tpe, npe, px, mc: f.mc, sec: m.sec, eps_t: f.eps_t, eps_pctile: pctile, cycle };
    } catch (e) {
      return { t, err: String(e.message || e).slice(0, 80) };
    }
  });

  const ok = results.filter(r => !r.err);
  const err = results.filter(r => r.err);
  console.log(`  ok=${ok.length} err=${err.length}`);

  const snapshot = {
    date: day,
    captured_at: new Date().toISOString(),
    n: ok.length,
    rows: ok,
  };

  await fs.mkdir(SNAP, { recursive: true });
  const out = path.join(SNAP, `${day}.json`);
  await fs.writeFile(out, JSON.stringify(snapshot));
  console.log(`  wrote ${out} (${(JSON.stringify(snapshot).length / 1024).toFixed(0)} KB)`);

  // Update last-refresh.json snapshot_count
  try {
    const lrPath = path.join(DATA, 'last-refresh.json');
    const lr = JSON.parse(await fs.readFile(lrPath, 'utf-8'));
    const files = (await fs.readdir(SNAP)).filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f));
    lr.snapshot_count = files.length;
    lr.latest_snapshot = day;
    await fs.writeFile(lrPath, JSON.stringify(lr, null, 2));
  } catch (e) {
    console.warn('  could not update last-refresh.json:', e.message);
  }

  console.log(`[snapshot-equity-pe] done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main().catch(e => { console.error(e); process.exit(1); });
