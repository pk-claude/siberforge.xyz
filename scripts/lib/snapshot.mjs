// snapshot.mjs — builds snapshot.json + manifest.json from per-series history files.

import fs from 'node:fs/promises';
import path from 'node:path';
import { readHistoryCsv } from './csv.mjs';

/**
 * Build snapshot.json containing latest values, recent history, and per-series metadata.
 * Recent history = last 10 years for monthly+ frequency, last 5 years for daily/weekly.
 */
export async function buildSnapshot({ dataDir, indicators, manifest }) {
  const series = {};
  const generatedAt = new Date().toISOString();

  for (const ind of indicators) {
    const file = path.join(dataDir, 'history', `${ind.id}.csv`);
    const history = await readHistoryCsv(file);
    const okFromManifest = manifest.series?.[ind.id]?.ok ?? false;
    const lastFetchAt = manifest.series?.[ind.id]?.lastFetchAt ?? null;

    if (!history.length) {
      series[ind.id] = {
        lastValue: null,
        lastDate: null,
        history: [],
        source: ind.source,
        ok: okFromManifest,
        lastFetchAt,
        error: manifest.series?.[ind.id]?.error || null,
      };
      continue;
    }

    history.sort((a, b) => a.date.localeCompare(b.date));
    const last = history[history.length - 1];

    // Trim history to a sensible visible window.
    const isHighFreq = ind.freq === 'daily' || ind.freq === 'weekly';
    const yearsToKeep = isHighFreq ? 5 : 15;
    const cutoff = new Date(); cutoff.setUTCFullYear(cutoff.getUTCFullYear() - yearsToKeep);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const trimmed = history.filter(o => o.date >= cutoffStr);

    series[ind.id] = {
      lastValue: last.value,
      lastDate: last.date,
      history: trimmed.map(o => [o.date, o.value]),
      source: ind.source,
      ok: okFromManifest,
      lastFetchAt,
      error: manifest.series?.[ind.id]?.error || null,
    };
  }

  return {
    schemaVersion: 1,
    generatedAt,
    series,
  };
}

// Per-series stats for tile rendering. Mirrors the client-side computeDeltas
// in core/supply/dashboard.js -- keep the two in sync. Computing at build
// time lets snapshot.json ship without full history (see splitSnapshot).
export function computeDeltas(history, freq, longTermNormYears = 10) {
  if (!history || history.length < 2) return null;
  const lastIdx = history.length - 1;
  const last = history[lastIdx][1];
  const lastDate = new Date(history[lastIdx][0]);
  const findClosest = (targetDate) => {
    const targetStr = targetDate.toISOString().slice(0, 10);
    for (let i = lastIdx - 1; i >= 0; i--) if (history[i][0] <= targetStr) return history[i][1];
    return null;
  };
  const m = new Date(lastDate); m.setUTCMonth(m.getUTCMonth() - 1);
  const y = new Date(lastDate); y.setUTCFullYear(y.getUTCFullYear() - 1);
  const lastMo = findClosest(m), lastYr = findClosest(y);
  const cutoff = new Date(lastDate); cutoff.setUTCFullYear(cutoff.getUTCFullYear() - longTermNormYears);
  const window = history.filter(h => new Date(h[0]) >= cutoff).map(h => h[1]);
  const mean = window.length ? window.reduce((s, v) => s + v, 0) / window.length : null;
  const variance = window.length > 1 ? window.reduce((s, v) => s + (v - mean) ** 2, 0) / (window.length - 1) : null;
  const sd = variance != null ? Math.sqrt(variance) : null;
  const z = sd ? (last - mean) / sd : null;
  const sorted = [...window].sort((a, b) => a - b);
  let rank = sorted.findIndex(v => v >= last);
  if (rank < 0) rank = sorted.length - 1;
  const pct = Math.round((rank / Math.max(1, sorted.length - 1)) * 100);
  return {
    last, lastDate: history[lastIdx][0],
    vsLastMonth: (lastMo != null && lastMo !== 0) ? ((last - lastMo) / Math.abs(lastMo)) * 100 : null,
    vsLastYear:  (lastYr != null && lastYr !== 0) ? ((last - lastYr) / Math.abs(lastYr)) * 100 : null,
    vsLongTermMean: z, vsMeanPct: (mean != null && mean !== 0) ? ((last - mean) / Math.abs(mean)) * 100 : null, percentile: pct,
  };
}

/**
 * Split a full snapshot into:
 *   lean    -- snapshot.json payload: latest values, precomputed deltas, and a
 *              short spark window. ~95% smaller than shipping full history.
 *   history -- history.json payload: { seriesId: fullHistory } for the
 *              drill-down page only.
 */
export function splitSnapshot(snapshot, indicators, sparkPoints = 60) {
  const byId = new Map((indicators || []).map(i => [i.id, i]));
  const lean = { schemaVersion: 2, generatedAt: snapshot.generatedAt, series: {} };
  const history = {};
  for (const [id, s] of Object.entries(snapshot.series || {})) {
    const ind = byId.get(id) || {};
    history[id] = s.history || [];
    lean.series[id] = {
      lastValue: s.lastValue,
      lastDate: s.lastDate,
      deltas: computeDeltas(s.history, ind.freq, ind.longTermNormYears || 10),
      spark: (s.history || []).slice(-sparkPoints),
      source: s.source,
      ok: s.ok,
      lastFetchAt: s.lastFetchAt,
      error: s.error,
    };
  }
  return { lean, history };
}

/**
 * Write a JSON file atomically (compact -- no pretty-printing).
 */
async function writeJsonAtomic(filePath, obj) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmp = filePath + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(obj), 'utf8');
  await fs.rename(tmp, filePath);
}

/**
 * Write snapshot.json (lean) + history.json next to it.
 * `snapshot` is the FULL in-memory snapshot (still used by insights/calendar).
 */
export async function writeSnapshot(filePath, snapshot, indicators) {
  const { lean, history } = splitSnapshot(snapshot, indicators);
  await writeJsonAtomic(filePath, lean);
  await writeJsonAtomic(path.join(path.dirname(filePath), 'history.json'), history);
}
