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
  console.log(`  ${tickers.length} tickers`);

  const results = await pMapLimit(tickers, 6, async (t) => {
    try {
      const f = await fetchFundamentals(t);
      return { t, fpe: f.fpe, tpe: f.tpe, px: f.px, mc: f.mc, sec: f.sec };
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
