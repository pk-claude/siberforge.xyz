// scripts/refresh-supply.mjs
// Weekly refresh orchestrator for the Supply Chain Dashboard.
//
// Run locally:        node scripts/refresh-supply.mjs
// Run dry (no write): node scripts/refresh-supply.mjs --dry-run
//
// Requires env: FRED_API_KEY, EIA_API_KEY (optional: BLS_API_KEY, CENSUS_API_KEY)

import fs from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';
import { fileURLToPath } from 'node:url';

import { writeHistoryCsv } from './lib/csv.mjs';
import { buildSnapshot, writeSnapshot } from './lib/snapshot.mjs';
import { readManifest, writeManifest, recordSeriesResult, recordSourceResult } from './lib/manifest.mjs';

import * as fredSrc from './sources/fred.mjs';
import * as eiaSrc from './sources/eia.mjs';
import * as yahooSrc from './sources/yahoo.mjs';
import * as gscpiSrc from './sources/nyfed-gscpi.mjs';
import * as aarSrc from './sources/aar-rail.mjs';
import * as cassSrc from './sources/cass.mjs';
import * as drewrySrc from './sources/drewry.mjs';
import * as scfiSrc from './sources/scfi.mjs';
import * as fbxSrc from './sources/freightos.mjs';
import * as bdiSrc from './sources/bdi.mjs';
import * as bunkerSrc from './sources/shipbunker.mjs';
import * as datSrc from './sources/dat.mjs';
import * as actFtrSrc from './sources/act-ftr.mjs';
import * as uspsSrc from './sources/usps.mjs';
import * as portsSrc from './sources/ports.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(REPO_ROOT, 'core', 'supply', 'data');
const HISTORY_DIR = path.join(DATA_DIR, 'history');
const SNAPSHOT_PATH = path.join(DATA_DIR, 'snapshot.json');
const MANIFEST_PATH = path.join(DATA_DIR, 'manifest.json');

const SOURCE_MODULES = {
  'fred': fredSrc,
  'eia': eiaSrc,
  'yahoo': yahooSrc,
  'scrape:nyfed-gscpi': gscpiSrc,
  'scrape:aar': aarSrc,
  'scrape:cass': cassSrc,
  'scrape:drewry': drewrySrc,
  'scrape:scfi': scfiSrc,
  'scrape:freightos': fbxSrc,
  'scrape:bdi': bdiSrc,
  'scrape:shipbunker': bunkerSrc,
  'scrape:dat': datSrc,
  'scrape:act-ftr': actFtrSrc,
  'scrape:usps': uspsSrc,
  'scrape:ports': portsSrc,
};

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) console.log('[refresh-supply] DRY RUN — will not write files');

  const { INDICATORS, INDICATORS_BY_SOURCE } = await import(url.pathToFileURL(path.join(REPO_ROOT, 'core/supply/indicators.js')).toString());
  await fs.mkdir(HISTORY_DIR, { recursive: true });
  await fs.mkdir(path.join(DATA_DIR, 'raw'), { recursive: true });

  const manifest = await readManifest(MANIFEST_PATH);
  manifest.sources = manifest.sources || {};
  manifest.series = manifest.series || {};

  // Group by source.
  const bySource = INDICATORS_BY_SOURCE;

  for (const [source, entries] of Object.entries(bySource)) {
    if (source === 'derived') continue; // handled after primary fetches
    const mod = SOURCE_MODULES[source];
    if (!mod || !mod.fetch) {
      console.warn(`[refresh-supply] no module for source=${source} — skipping ${entries.length} entries`);
      for (const e of entries) recordSeriesResult(manifest, e.id, { ok: false, error: `no module for ${source}` });
      recordSourceResult(manifest, source, { successCount: 0, errorCount: entries.length });
      continue;
    }
    console.log(`[refresh-supply] source=${source} entries=${entries.length}`);
    let res;
    try {
      res = await mod.fetch({ entries, env: process.env, dataDir: DATA_DIR });
    } catch (err) {
      console.error(`[refresh-supply] source=${source} threw:`, err.message);
      for (const e of entries) recordSeriesResult(manifest, e.id, { ok: false, error: `module ${source} threw: ${err.message}` });
      recordSourceResult(manifest, source, { successCount: 0, errorCount: entries.length });
      continue;
    }
    let succ = 0, errs = 0;
    for (const e of entries) {
      const r = res?.results?.[e.id];
      if (!r) {
        recordSeriesResult(manifest, e.id, { ok: false, error: `${source}: no result returned for ${e.id}` });
        errs++; continue;
      }
      if (r.observations && r.observations.length > 0) {
        if (!dryRun) {
          await writeHistoryCsv(path.join(HISTORY_DIR, `${e.id}.csv`), r.observations, { label: e.label, source });
        }
      }
      recordSeriesResult(manifest, e.id, { ok: !!r.ok, error: r.error });
      if (r.ok) succ++; else errs++;
    }
    recordSourceResult(manifest, source, { successCount: succ, errorCount: errs });
    console.log(`[refresh-supply]   → ok=${succ} err=${errs}`);
  }

  // Compute derived series from histories already written.
  await computeDerivedSeries(INDICATORS, manifest, dryRun);

  // Build snapshot from on-disk histories.
  const snapshot = await buildSnapshot({ dataDir: DATA_DIR, indicators: INDICATORS, manifest });
  if (!dryRun) await writeSnapshot(SNAPSHOT_PATH, snapshot);
  if (!dryRun) await writeManifest(MANIFEST_PATH, manifest);

  // Build bundle.zip
  if (!dryRun) await writeBundle();

  // Report
  const summary = Object.entries(manifest.sources)
    .map(([k, v]) => `${k}: ok=${v.successCount || 0} err=${v.errorCount || 0}`)
    .join('  |  ');
  console.log(`[refresh-supply] done. ${summary}`);
}

async function computeDerivedSeries(indicators, manifest, dryRun) {
  const { readHistoryCsv } = await import('./lib/csv.mjs');
  for (const ind of indicators) {
    if (ind.source !== 'derived' || !ind.composite) continue;
    try {
      const deps = {};
      for (const dep of ind.composite.dependsOn) {
        deps[dep] = await readHistoryCsv(path.join(HISTORY_DIR, `${dep}.csv`));
      }
      let observations = [];
      switch (ind.composite.compute) {
        case 'yoy':           observations = deriveYoy(deps[ind.composite.dependsOn[0]]); break;
        case 'spread_bps':    observations = deriveSpreadBps(deps[ind.composite.dependsOn[0]], deps[ind.composite.dependsOn[1]]); break;
        case 'scp_zscore_blend': observations = deriveScpComposite(deps); break;
        default:              throw new Error(`unknown compute ${ind.composite.compute}`);
      }
      if (observations.length > 0 && !dryRun) {
        await writeHistoryCsv(path.join(HISTORY_DIR, `${ind.id}.csv`), observations, { label: ind.label, source: 'derived' });
      }
      recordSeriesResult(manifest, ind.id, { ok: observations.length > 0, error: observations.length === 0 ? 'no rows' : null });
    } catch (err) {
      recordSeriesResult(manifest, ind.id, { ok: false, error: `derive: ${err.message}` });
    }
  }
}

function deriveYoy(obs) {
  if (!obs || obs.length < 13) return [];
  const out = [];
  for (let i = 0; i < obs.length; i++) {
    const d = obs[i].date;
    const target = new Date(d); target.setUTCFullYear(target.getUTCFullYear() - 1);
    const cutoff = target.toISOString().slice(0, 10);
    // Find closest earlier/equal observation to cutoff.
    let prev = null;
    for (let j = i - 1; j >= 0; j--) {
      if (obs[j].date <= cutoff) { prev = obs[j]; break; }
    }
    if (prev && prev.value !== 0) {
      out.push({ date: d, value: ((obs[i].value - prev.value) / prev.value) * 100 });
    }
  }
  return out;
}

function deriveSpreadBps(seriesA, seriesB) {
  if (!seriesA?.length || !seriesB?.length) return [];
  const bMap = new Map(seriesB.map(o => [o.date, o.value]));
  const out = [];
  for (const o of seriesA) {
    if (bMap.has(o.date)) {
      out.push({ date: o.date, value: (o.value - bMap.get(o.date)) * 100 });
    }
  }
  return out;
}

function deriveScpComposite(deps) {
  // Equal-weighted blend of:
  //   z(GSCPI, 10y), -z(CASS_SHIPMENTS, 10y), z(DIESEL deviation, 10y),
  //   z(WCI, 5y), z(BUNKER_VLSFO_SIN, 5y).
  // Aligned to month-end of GSCPI series.
  const gscpi = deps['GSCPI'] || [];
  if (gscpi.length === 0) return [];
  const cass  = deps['CASS_SHIPMENTS'] || [];
  const diesel = deps['DIESEL_RETAIL'] || [];
  const wci   = deps['WCI_COMPOSITE'] || [];
  const bunker = deps['BUNKER_VLSFO_SIN'] || [];

  const out = [];
  for (const g of gscpi) {
    const date = g.date;
    const components = [];
    components.push(zscoreAsOf(gscpi, g, 10 * 12));
    const cassZ = zscoreNearest(cass, date, 10 * 12); if (cassZ != null) components.push(-cassZ);
    const dieselZ = zscoreNearest(diesel, date, 10 * 52); if (dieselZ != null) components.push(dieselZ);
    const wciZ = zscoreNearest(wci, date, 5 * 52); if (wciZ != null) components.push(wciZ);
    const bunkerZ = zscoreNearest(bunker, date, 5 * 365); if (bunkerZ != null) components.push(bunkerZ);
    const valid = components.filter(v => Number.isFinite(v));
    if (valid.length >= 2) {
      const avg = valid.reduce((s, v) => s + v, 0) / valid.length;
      out.push({ date, value: round(avg, 3) });
    }
  }
  return out;
}

function zscoreAsOf(series, current, lookbackPoints) {
  const idx = series.indexOf(current);
  if (idx < 0) return null;
  const start = Math.max(0, idx - lookbackPoints);
  const window = series.slice(start, idx + 1).map(o => o.value);
  return zscore(current.value, window);
}

function zscoreNearest(series, date, lookbackPoints) {
  if (!series || !series.length) return null;
  // find observation with date <= target date
  let cur = null, idx = -1;
  for (let i = 0; i < series.length; i++) {
    if (series[i].date <= date) { cur = series[i]; idx = i; }
    else break;
  }
  if (!cur) return null;
  const start = Math.max(0, idx - lookbackPoints);
  const window = series.slice(start, idx + 1).map(o => o.value);
  return zscore(cur.value, window);
}

function zscore(v, window) {
  if (!window.length) return null;
  const mean = window.reduce((s, x) => s + x, 0) / window.length;
  const variance = window.reduce((s, x) => s + (x - mean) ** 2, 0) / Math.max(1, window.length - 1);
  const sd = Math.sqrt(variance);
  if (sd === 0) return 0;
  return (v - mean) / sd;
}

function round(v, d) { const m = 10 ** d; return Math.round(v * m) / m; }

async function writeBundle() {
  // Use the archiver dependency.
  const { default: archiver } = await import('archiver');
  const { createWriteStream } = await import('node:fs');
  const out = createWriteStream(path.join(DATA_DIR, 'bundle.zip'));
  const archive = archiver('zip', { zlib: { level: 9 } });
  await new Promise((resolve, reject) => {
    archive.pipe(out);
    archive.on('error', reject);
    out.on('close', resolve);
    out.on('error', reject);
    archive.directory(HISTORY_DIR, 'history');
    archive.file(SNAPSHOT_PATH, { name: 'snapshot.json' });
    archive.file(MANIFEST_PATH, { name: 'manifest.json' });
    archive.finalize();
  });
}

main().catch(err => { console.error(err); process.exit(1); });
