// manifest.mjs — read/update per-source health manifest.

import fs from 'node:fs/promises';
import path from 'node:path';

export async function readManifest(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return { schemaVersion: 1, sources: {}, series: {}, generatedAt: null };
    throw err;
  }
}

export async function writeManifest(filePath, manifest) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  manifest.generatedAt = new Date().toISOString();
  // compute staleness per source
  for (const [src, info] of Object.entries(manifest.sources || {})) {
    if (info.lastSuccess) {
      const days = Math.floor((Date.now() - new Date(info.lastSuccess).getTime()) / (1000 * 60 * 60 * 24));
      info.staleDays = days;
      info.stale = days > 14;
    }
  }
  const tmp = filePath + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(manifest, null, 2), 'utf8');
  await fs.rename(tmp, filePath);
}

export function recordSeriesResult(manifest, id, result) {
  manifest.series = manifest.series || {};
  const existing = manifest.series[id] || {};
  manifest.series[id] = {
    ...existing,
    ok: result.ok,
    lastFetchAt: new Date().toISOString(),
    error: result.ok ? null : (result.error || 'unknown error'),
    ...(result.ok ? { lastSuccess: new Date().toISOString() } : {}),
  };
}

export function recordSourceResult(manifest, source, { successCount, errorCount }) {
  manifest.sources = manifest.sources || {};
  const existing = manifest.sources[source] || {};
  manifest.sources[source] = {
    ...existing,
    seriesCount: successCount + errorCount,
    successCount,
    errorCount,
    ...(successCount > 0 ? { lastSuccess: new Date().toISOString() } : {}),
  };
}
