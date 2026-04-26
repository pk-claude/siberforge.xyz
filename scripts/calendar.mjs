// scripts/calendar.mjs
// 14-day forward publications calendar.
// Reads core/supply/cadence.js + snapshot.json, produces calendar.json
// with entries for each upcoming release per metric in the next 14 days.

import fs from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(REPO_ROOT, 'core', 'supply', 'data');
const SNAPSHOT_PATH = path.join(DATA_DIR, 'snapshot.json');
const CALENDAR_PATH = path.join(DATA_DIR, 'calendar.json');

const DAY_MS = 24 * 60 * 60 * 1000;

export async function buildCalendar({ snapshot, indicators, cadenceMap, windowDays = 14, dryRun = false }) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const horizon = new Date(today.getTime() + windowDays * DAY_MS);

  const entries = [];
  for (const ind of indicators) {
    const cadence = cadenceMap[ind.id];
    if (!cadence || cadence.kind === 'daily') continue;
    const dates = nextOccurrences(cadence.kind, today, horizon);
    for (const d of dates) {
      const series = snapshot.series?.[ind.id];
      const lastValue = series?.lastValue ?? null;
      const lastDate = series?.lastDate ?? null;
      const context = buildContext(series, ind);
      entries.push({
        date: d.toISOString().slice(0, 10),
        id: ind.id,
        label: ind.label,
        shortLabel: ind.shortLabel,
        category: ind.category,
        cadence: cadence.hint || cadence.kind,
        lastValue,
        lastDate,
        unit: ind.unit,
        decimals: ind.decimals ?? 1,
        context,
      });
    }
  }

  entries.sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label));

  const byCategory = {};
  for (const e of entries) {
    (byCategory[e.category] = byCategory[e.category] || []).push(e);
  }

  const calendar = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    windowDays,
    windows: { next14: entries, byCategory },
  };

  if (!dryRun) {
    const tmp = CALENDAR_PATH + '.tmp';
    await fs.writeFile(tmp, JSON.stringify(calendar, null, 2), 'utf8');
    await fs.rename(tmp, CALENDAR_PATH);
  }
  return calendar;
}

// Returns array of Date objects for upcoming occurrences within [today, horizon).
function nextOccurrences(kind, today, horizon) {
  const out = [];
  switch (kind) {
    case 'monthly_first_friday': {
      // First Friday of current month if not yet passed, plus first Friday of next month if within window
      out.push(...firstWeekday(today, 5));
      break;
    }
    case 'monthly_first_business': {
      out.push(...firstBusinessDay(today));
      break;
    }
    case 'monthly_mid': {
      out.push(...nthOfMonth(today, 14));
      out.push(...nthOfMonth(today, 15));
      break;
    }
    case 'monthly_around_12': {
      out.push(...nthOfMonth(today, 12));
      break;
    }
    case 'monthly_around_15': {
      out.push(...nthOfMonth(today, 15));
      break;
    }
    case 'monthly_around_20': {
      out.push(...nthOfMonth(today, 20));
      break;
    }
    case 'monthly_around_25': {
      out.push(...nthOfMonth(today, 25));
      break;
    }
    case 'weekly_monday_4pm': {
      out.push(...weeklyDow(today, 1));
      break;
    }
    case 'weekly_wednesday': {
      out.push(...weeklyDow(today, 3));
      break;
    }
    case 'weekly_thursday': {
      out.push(...weeklyDow(today, 4));
      break;
    }
    case 'weekly_friday': {
      out.push(...weeklyDow(today, 5));
      break;
    }
    case 'quarterly_45d': {
      out.push(...quarterlyOffset(today, 45));
      break;
    }
    case 'quarterly_75d': {
      out.push(...quarterlyOffset(today, 75));
      break;
    }
    case 'annual_q1': {
      out.push(...annualQ1(today));
      break;
    }
    default:
      break;
  }
  return out.filter(d => d >= today && d < horizon);
}

function firstWeekday(today, dow) {
  // Returns first occurrence of weekday `dow` (0=Sun..6=Sat) in current and next month
  const candidates = [];
  for (let monthOffset = 0; monthOffset <= 1; monthOffset++) {
    const y = today.getUTCFullYear();
    const m = today.getUTCMonth() + monthOffset;
    const first = new Date(Date.UTC(y, m, 1));
    const offset = (dow - first.getUTCDay() + 7) % 7;
    const target = new Date(Date.UTC(y, m, 1 + offset));
    candidates.push(target);
  }
  return candidates;
}

function firstBusinessDay(today) {
  const out = [];
  for (let monthOffset = 0; monthOffset <= 1; monthOffset++) {
    const y = today.getUTCFullYear();
    const m = today.getUTCMonth() + monthOffset;
    let day = 1;
    while (true) {
      const t = new Date(Date.UTC(y, m, day));
      const dow = t.getUTCDay();
      if (dow !== 0 && dow !== 6) { out.push(t); break; }
      day++;
      if (day > 7) break;
    }
  }
  return out;
}

function nthOfMonth(today, dayOfMonth) {
  const out = [];
  for (let monthOffset = 0; monthOffset <= 1; monthOffset++) {
    const y = today.getUTCFullYear();
    const m = today.getUTCMonth() + monthOffset;
    out.push(new Date(Date.UTC(y, m, dayOfMonth)));
  }
  return out;
}

function weeklyDow(today, dow) {
  // Every occurrence of weekday `dow` in next 14 days
  const out = [];
  for (let i = 0; i < 14; i++) {
    const t = new Date(today.getTime() + i * DAY_MS);
    if (t.getUTCDay() === dow) out.push(t);
  }
  return out;
}

function quarterlyOffset(today, daysAfterQtrEnd) {
  // Last quarter end was Q1=Mar31, Q2=Jun30, Q3=Sep30, Q4=Dec31
  const out = [];
  const y = today.getUTCFullYear();
  const qEnds = [
    new Date(Date.UTC(y, 2, 31)),   // Q1
    new Date(Date.UTC(y, 5, 30)),   // Q2
    new Date(Date.UTC(y, 8, 30)),   // Q3
    new Date(Date.UTC(y, 11, 31)),  // Q4
    new Date(Date.UTC(y - 1, 11, 31)), // prior year Q4
    new Date(Date.UTC(y + 1, 2, 31)),  // next year Q1
  ];
  for (const qEnd of qEnds) {
    const release = new Date(qEnd.getTime() + daysAfterQtrEnd * DAY_MS);
    out.push(release);
  }
  return out;
}

function annualQ1(today) {
  const y = today.getUTCFullYear();
  return [new Date(Date.UTC(y, 1, 15))];
}

function buildContext(series, ind) {
  if (!series || series.lastValue == null) return 'no prior data on file';
  const v = series.lastValue;
  const d = series.lastDate;
  return `Last: ${formatValue(v, ind.decimals ?? 1, ind.unit)} on ${d}`;
}

function formatValue(v, decimals, unit) {
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dryRun = process.argv.includes('--dry-run');
  const snapshotRaw = await fs.readFile(SNAPSHOT_PATH, 'utf8');
  const snapshot = JSON.parse(snapshotRaw);
  const { INDICATORS } = await import(url.pathToFileURL(path.join(REPO_ROOT, 'core/supply/indicators.js')).toString());
  const { RELEASE_CADENCE } = await import(url.pathToFileURL(path.join(REPO_ROOT, 'core/supply/cadence.js')).toString());
  const cal = await buildCalendar({ snapshot, indicators: INDICATORS, cadenceMap: RELEASE_CADENCE, dryRun });
  console.log(`[calendar] generated ${cal.windows.next14.length} entries in next ${cal.windowDays} days`);
}
