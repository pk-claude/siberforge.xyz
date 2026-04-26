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

/**
 * Write snapshot.json atomically.
 */
export async function writeSnapshot(filePath, snapshot) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmp = filePath + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(snapshot, null, 2), 'utf8');
  await fs.rename(tmp, filePath);
}
