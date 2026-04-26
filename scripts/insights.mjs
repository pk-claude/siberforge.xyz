// scripts/insights.mjs
// Deterministic insight engine. Reads snapshot.json, scores every metric,
// classifies risk/opportunity/watch, and writes insights.json with
// per-category top movers and an overall summary.

import fs from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(REPO_ROOT, 'core', 'supply', 'data');
const SNAPSHOT_PATH = path.join(DATA_DIR, 'snapshot.json');
const INSIGHTS_PATH = path.join(DATA_DIR, 'insights.json');

export async function buildInsights({ snapshot, indicators, dryRun = false }) {
  const generatedAt = new Date().toISOString();
  const flagged = [];

  for (const ind of indicators) {
    const series = snapshot.series?.[ind.id];
    if (!series || !Array.isArray(series.history) || series.history.length < 6) continue;
    if (ind.category === 'composite') continue;

    const stats = computeStats(series.history, ind.longTermNormYears || 10);
    if (!stats) continue;

    const ruleResult = applyRules(stats, ind);
    if (!ruleResult || ruleResult.cls === 'quiet') continue;

    const score = computeScore(stats);
    flagged.push({
      id: ind.id,
      label: ind.label,
      shortLabel: ind.shortLabel,
      category: ind.category,
      score: Math.round(score),
      class: ruleResult.cls,
      rule: ruleResult.rule,
      headline: ruleResult.headline,
      rightNow: synthesizeRightNow(stats, ind, ruleResult),
      current: stats.last,
      lastDate: stats.lastDate,
      norm: stats.mean,
      z: stats.z,
      vsMeanPct: stats.vsMeanPct,
      vsLastMonth: stats.mom,
      vsLastYear: stats.yoy,
      percentile: stats.percentile,
      persistence: stats.persistence,
      direction: ind.direction,
    });
  }

  // Sort all by score desc.
  flagged.sort((a, b) => b.score - a.score);

  // Per-category top 5.
  const byCategory = {};
  for (const f of flagged) {
    (byCategory[f.category] = byCategory[f.category] || []).push(f);
  }
  for (const k of Object.keys(byCategory)) byCategory[k] = byCategory[k].slice(0, 5);

  // Top action: highest-scoring risk overall.
  const topRisk = flagged.find(f => f.class === 'risk');
  const topOppty = flagged.find(f => f.class === 'opportunity');

  const risks = flagged.filter(f => f.class === 'risk').length;
  const opportunities = flagged.filter(f => f.class === 'opportunity').length;
  const watches = flagged.filter(f => f.class === 'watch').length;

  const scpSeries = snapshot.series?.SCP_COMPOSITE;
  const compositeScpValue = scpSeries?.lastValue ?? null;
  const compositeScpRegime = scpRegime(compositeScpValue);

  // Empirical percentile of the latest reading within the full SCP history,
  // plus the first year of the series — so the UI can say "tighter than X%
  // of months since YYYY" without assuming a normal distribution.
  const scpHistory = (scpSeries?.history || []).filter(r => Array.isArray(r) && Number.isFinite(r[1]));
  let compositeScpPercentile = null;
  let compositeScpStartYear = null;
  if (scpHistory.length > 0 && Number.isFinite(compositeScpValue)) {
    const values = scpHistory.map(r => r[1]).sort((a, b) => a - b);
    // Rank: count of historical values strictly less than current, plus
    // half of those equal to current (mid-rank to avoid bias on ties).
    const lt = values.filter(v => v < compositeScpValue).length;
    const eq = values.filter(v => v === compositeScpValue).length;
    compositeScpPercentile = Math.round(100 * (lt + eq * 0.5) / values.length);
    compositeScpStartYear = String(scpHistory[0][0]).slice(0, 4);
  }

  const summary = {
    compositeScpValue,
    compositeScpRegime,
    compositeScpPercentile,
    compositeScpStartYear,
    risks, opportunities, watches,
    topAction: topRisk ? { id: topRisk.id, label: topRisk.label, headline: topRisk.headline, score: topRisk.score, rightNow: topRisk.rightNow } : null,
    topOpportunity: topOppty ? { id: topOppty.id, label: topOppty.label, headline: topOppty.headline, score: topOppty.score, rightNow: topOppty.rightNow } : null,
  };

  const insights = { schemaVersion: 1, generatedAt, summary, byCategory, all: flagged };

  if (!dryRun) {
    const tmp = INSIGHTS_PATH + '.tmp';
    await fs.writeFile(tmp, JSON.stringify(insights, null, 2), 'utf8');
    await fs.rename(tmp, INSIGHTS_PATH);
  }
  return insights;
}

function scpRegime(v) {
  if (v == null) return 'unknown';
  if (v < -1) return 'Loose';
  if (v < 1) return 'Normal';
  if (v < 2) return 'Tight';
  return 'Severe';
}

function computeStats(history, longTermNormYears) {
  if (history.length < 6) return null;
  const sorted = [...history].sort((a, b) => a[0].localeCompare(b[0]));
  const lastIdx = sorted.length - 1;
  const last = sorted[lastIdx][1];
  const lastDate = sorted[lastIdx][0];

  const cutoff = new Date(lastDate); cutoff.setUTCFullYear(cutoff.getUTCFullYear() - longTermNormYears);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const window = sorted.filter(p => p[0] >= cutoffStr).map(p => p[1]);
  if (window.length < 6) return null;
  const mean = window.reduce((s, v) => s + v, 0) / window.length;
  const variance = window.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, window.length - 1);
  const sd = Math.sqrt(variance);
  const z = sd > 0 ? (last - mean) / sd : 0;

  // Percentile within window
  const sortedWindow = [...window].sort((a, b) => a - b);
  let rank = sortedWindow.findIndex(v => v >= last);
  if (rank < 0) rank = sortedWindow.length - 1;
  const percentile = Math.round((rank / Math.max(1, sortedWindow.length - 1)) * 100);

  // MoM and YoY
  const mom = computeDelta(sorted, lastIdx, 30);
  const yoy = computeDelta(sorted, lastIdx, 365);

  // Persistence: count of consecutive periods same direction (sign of period-over-period change)
  let persistence = 0;
  if (lastIdx >= 1) {
    const lastSign = Math.sign(sorted[lastIdx][1] - sorted[lastIdx - 1][1]);
    if (lastSign !== 0) {
      persistence = 1;
      for (let i = lastIdx - 1; i > 0; i--) {
        const s = Math.sign(sorted[i][1] - sorted[i - 1][1]);
        if (s === lastSign) persistence++; else break;
      }
    }
  }

  // Acceleration: latest period change vs median of trailing 6
  const recentChanges = [];
  for (let i = Math.max(1, lastIdx - 6); i <= lastIdx; i++) {
    const prev = sorted[i - 1][1];
    if (prev !== 0) recentChanges.push((sorted[i][1] - prev) / Math.abs(prev));
  }
  let acceleration = 0;
  if (recentChanges.length >= 3) {
    const latestChange = recentChanges[recentChanges.length - 1];
    const median = [...recentChanges].sort((a, b) => a - b)[Math.floor(recentChanges.length / 2)];
    acceleration = sd > 0 ? (latestChange - median) * 100 / Math.max(1, Math.abs(mean)) : 0;
  }

  // 3-month z change (for opportunity/recovery rules)
  let zChange3mo = 0;
  if (lastIdx >= 3) {
    const v3 = sorted[lastIdx - 3][1];
    if (sd > 0) zChange3mo = (last - v3) / sd;
  }

  const vsMeanPct = (mean != null && mean !== 0) ? ((last - mean) / Math.abs(mean)) * 100 : null;
  return { last, lastDate, mean, sd, z, vsMeanPct, percentile, mom, yoy, persistence, acceleration, zChange3mo };
}

function computeDelta(sorted, lastIdx, daysBack) {
  if (lastIdx < 1) return null;
  const lastDate = new Date(sorted[lastIdx][0]);
  const target = new Date(lastDate); target.setUTCDate(target.getUTCDate() - daysBack);
  const targetStr = target.toISOString().slice(0, 10);
  let prev = null;
  for (let i = lastIdx - 1; i >= 0; i--) {
    if (sorted[i][0] <= targetStr) { prev = sorted[i][1]; break; }
  }
  if (prev == null || prev === 0) return null;
  return ((sorted[lastIdx][1] - prev) / Math.abs(prev)) * 100;
}

function applyRules(stats, ind) {
  const dir = ind.direction || 'neutral';
  const z = stats.z;
  const persistence = stats.persistence;
  const accel = Math.abs(stats.acceleration || 0);
  const pct = stats.percentile;
  const z3 = stats.zChange3mo;

  // Rule order matters — first match wins.
  if (z > 1.5 && persistence >= 2 && dir === 'lower_better') {
    return { cls: 'risk', rule: 'RISK_TIGHTENING', headline: `${ind.shortLabel} pressure intensifying` };
  }
  if (z < -1.5 && persistence >= 2 && dir === 'higher_better') {
    return { cls: 'risk', rule: 'RISK_SOFTENING', headline: `${ind.shortLabel} demand softening` };
  }
  if (z3 < -1.0 && dir === 'lower_better') {
    return { cls: 'opportunity', rule: 'OPPTY_RELIEF', headline: `${ind.shortLabel} cost relief opening` };
  }
  if (z3 > 1.0 && dir === 'higher_better') {
    return { cls: 'opportunity', rule: 'OPPTY_RECOVERY', headline: `${ind.shortLabel} demand recovering` };
  }
  if (pct > 95) {
    return { cls: 'watch', rule: 'WATCH_EXTREME_HIGH', headline: `${ind.shortLabel} at multi-year high` };
  }
  if (pct < 5) {
    return { cls: 'watch', rule: 'WATCH_EXTREME_LOW', headline: `${ind.shortLabel} at multi-year low` };
  }
  if (Math.abs(z) < 1.0 && accel > 0.5) {
    return { cls: 'watch', rule: 'WATCH_INFLECTION', headline: `${ind.shortLabel} direction may be turning` };
  }
  return { cls: 'quiet', rule: 'QUIET', headline: '' };
}

function computeScore(stats) {
  const magnitude = 30 * Math.min(Math.abs(stats.z), 3.0);
  const persist = 5 * Math.min(stats.persistence, 4);
  const accelBonus = Math.abs(stats.acceleration) > 0.5 ? 10 : 0;
  return Math.max(0, Math.min(100, magnitude + persist + accelBonus));
}

function synthesizeRightNow(stats, ind, rule) {
  const pctStr = stats.vsMeanPct != null && Number.isFinite(stats.vsMeanPct) ? ((stats.vsMeanPct >= 0 ? "+" : "") + stats.vsMeanPct.toFixed(1) + "%") : `${stats.z >= 0 ? "+" : ""}${stats.z.toFixed(2)}σ`;
  const moveTxt = stats.persistence >= 2
    ? `${stats.persistence} consecutive ${ind.freq === 'daily' ? 'days' : ind.freq === 'weekly' ? 'weeks' : 'months'} same direction`
    : 'recent direction mixed';
  const pctTxt = `${stats.percentile}th percentile`;

  let interp = '';
  if (rule.cls === 'risk' && ind.howToRead) {
    interp = ind.howToRead.split('.')[0] + '.';
  } else if (rule.cls === 'opportunity') {
    interp = `Falling toward favorable territory; window opening for shipper-side action.`;
  } else if (rule.cls === 'watch') {
    interp = `Direction may be turning; confirm with related metrics before acting.`;
  }
  return `${pctStr} vs 10y avg, ${moveTxt}, ${pctTxt}. ${interp}`.trim();
}

// CLI entry point — used when run directly via `node scripts/insights.mjs`
if (import.meta.url === `file://${process.argv[1]}`) {
  const dryRun = process.argv.includes('--dry-run');
  const snapshotRaw = await fs.readFile(SNAPSHOT_PATH, 'utf8');
  const snapshot = JSON.parse(snapshotRaw);
  const { INDICATORS } = await import(url.pathToFileURL(path.join(REPO_ROOT, 'core/supply/indicators.js')).toString());
  const insights = await buildInsights({ snapshot, indicators: INDICATORS, dryRun });
  console.log(`[insights] generated ${insights.all.length} flagged metrics; ${insights.summary.risks} risks, ${insights.summary.opportunities} opportunities, ${insights.summary.watches} watches`);
}
