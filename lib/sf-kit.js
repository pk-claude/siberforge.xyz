// sf-kit.js -- small shared toolkit for dashboard pages (ES module).
//
// Data comes through window.SF_FRED (lib/fred-snapshot.js): static snapshot
// first, live proxy only for series the snapshot lacks. Market prices come
// from /api/stocks (Yahoo daily closes, 24h edge cache).

export const el = id => document.getElementById(id);
export const fmt = (n, d = 1) => Number.isFinite(n) ? n.toFixed(d) : '—';
export const sgn = (n, d = 1) => Number.isFinite(n) ? (n > 0 ? '+' : '') + n.toFixed(d) : '—';
export const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const todayIso = () => new Date().toISOString().slice(0, 10);

export function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
export function daysBetween(a, b) {
  return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000);
}
export const monthName = iso => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
export const dayName = iso => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

export function setStatus(kind, txt) {
  const ind = el('refresh-indicator'), tx = el('refresh-text');
  if (ind) ind.className = `sf-dot dot ${kind}`;
  if (tx) tx.textContent = txt;
}

// ---------- data ----------
export async function fred(ids, start = '1990-01-01') {
  if (window.SF_FRED) return window.SF_FRED.get(ids, start);
  const r = await fetch(`/api/fred?series=${ids.join(',')}&start=${start}`);
  const j = await r.json();
  const out = {}; (j.series || []).forEach(s => { out[s.id] = s.observations; }); return out;
}
export async function fredInfo(id) { return window.SF_FRED ? window.SF_FRED.info(id) : null; }
export async function snapshotTime() {
  const m = window.SF_FRED ? await window.SF_FRED.manifest() : null;
  return m ? m.generatedAt : null;
}

export async function prices(symbols, years = 5) {
  const out = {};
  for (let i = 0; i < symbols.length; i += 12) {
    const batch = symbols.slice(i, i + 12);
    try {
      const r = await fetch(`/api/stocks?mode=history&symbols=${batch.map(encodeURIComponent).join(',')}&years=${years}`);
      if (!r.ok) continue;
      const j = await r.json();
      for (const s of j.series || []) if (s && s.symbol) out[s.symbol] = (s.closes || []).filter(o => Number.isFinite(o.value));
    } catch (e) { /* page shows the gap */ }
  }
  return out;
}

// ---------- series math ----------
export const last = a => (a && a.length ? a[a.length - 1] : null);
// Value on or before `date`.
export function at(a, date) {
  if (!a || !a.length) return null;
  let lo = 0, hi = a.length - 1, ans = null;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (a[m].date <= date) { ans = a[m]; lo = m + 1; } else hi = m - 1; }
  return ans;
}
// Change of the latest value vs `days` earlier (calendar), as pct or diff.
export function change(a, days, mode = 'pct') {
  const l = last(a); if (!l) return null;
  const p = at(a, addDays(l.date, -days)); if (!p) return null;
  return mode === 'pct' ? (l.value / p.value - 1) * 100 : l.value - p.value;
}
export function ytd(a, mode = 'pct') {
  const l = last(a); if (!l) return null;
  const p = at(a, `${l.date.slice(0, 4) - 1}-12-31`); if (!p) return null;
  return mode === 'pct' ? (l.value / p.value - 1) * 100 : l.value - p.value;
}
export function yoy(a, lagObs = 12) {
  const out = [];
  for (let i = lagObs; i < a.length; i++) if (a[i - lagObs].value) out.push({ date: a[i].date, value: (a[i].value / a[i - lagObs].value - 1) * 100 });
  return out;
}
// Percentile (0-100) of the latest value within the trailing `years`.
export function pctile(a, years = 20, value = null) {
  const l = last(a); if (!l) return null;
  const from = addDays(l.date, -Math.round(years * 365.25));
  const v = value == null ? l.value : value;
  const h = a.filter(o => o.date >= from).map(o => o.value);
  let below = 0, eq = 0; for (const x of h) { if (x < v) below++; else if (x === v) eq++; }
  return Math.round(100 * (below + 0.5 * eq) / h.length);
}
// Align two series on dates (inner join), combine with fn.
export function combine(a, b, fn) {
  const m = new Map(b.map(o => [o.date, o.value]));
  return a.filter(o => m.has(o.date)).map(o => ({ date: o.date, value: fn(o.value, m.get(o.date)) }));
}
// Forward-fill `b` onto the dates of `a` (e.g. weekly onto daily).
export function asof(a, b, fn) {
  const out = []; let j = -1;
  for (const o of a) { while (j + 1 < b.length && b[j + 1].date <= o.date) j++; if (j >= 0) out.push({ date: o.date, value: fn(o.value, b[j].value) }); }
  return out;
}
export function toMonthly(a) {
  const m = new Map(); for (const o of a || []) m.set(o.date.slice(0, 7) + '-01', o.value);
  return [...m.entries()].sort((x, y) => x[0] < y[0] ? -1 : 1).map(([date, value]) => ({ date, value }));
}
export function since(a, date) { return (a || []).filter(o => o.date >= date); }
export function thin(a, maxPts = 1500) {
  if (!a || a.length <= maxPts) return a || [];
  const step = Math.ceil(a.length / maxPts); return a.filter((o, i) => i % step === 0 || i === a.length - 1);
}

// Recession ranges from USREC for chart shading.
export function recessionRanges(usrec) {
  const out = []; let s = null;
  for (const o of usrec || []) { if (o.value === 1 && !s) s = o.date; if (o.value !== 1 && s) { out.push({ start: s, end: o.date }); s = null; } }
  if (s) out.push({ start: s, end: todayIso() });
  return out;
}

// ---------- rendering ----------
export function tiles(containerId, list) {
  const t = el(containerId); if (!t) return;
  t.innerHTML = list.map(x => `<div class="cycle-tile ${x.status ? 'cycle-tile-' + x.status : ''}"${x.metric ? ` data-tile-metric="${x.metric}"` : ''} title="${esc(x.help || '')}">
      <div class="cycle-tile-label">${x.label}</div>
      <div class="cycle-tile-value">${x.value}</div>
      <div class="cycle-tile-meta">${x.meta || ''}</div>
      ${x.threshold ? `<div class="cycle-tile-threshold">${x.threshold}</div>` : ''}
    </div>`).join('');
}

const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
export const COLORS = {
  accent: '#f7a700', red: '#ef4f5a', green: '#3ecf8e', blue: '#5a9cff', purple: '#b07cff', teal: '#2ec4c4', grey: '#8a94a3', pink: '#ff7eb6',
};

const charts = {};
function shadePlugin(ranges) {
  return {
    id: 'sfShade' + Math.random().toString(36).slice(2),
    beforeDatasetsDraw(chart) {
      if (!ranges || !ranges.length) return;
      const { ctx, chartArea: a, scales: s } = chart; if (!a || !s.x) return;
      ctx.save(); ctx.fillStyle = 'rgba(239,79,90,0.08)';
      for (const r of ranges) {
        const x0 = s.x.getPixelForValue(new Date(r.start)), x1 = s.x.getPixelForValue(new Date(r.end));
        if (x1 < a.left || x0 > a.right) continue;
        ctx.fillRect(Math.max(x0, a.left), a.top, Math.min(x1, a.right) - Math.max(x0, a.left), a.bottom - a.top);
      }
      ctx.restore();
    },
  };
}
function linesPlugin(lines) {
  return {
    id: 'sfLines' + Math.random().toString(36).slice(2),
    afterDatasetsDraw(chart) {
      const { ctx, chartArea: a, scales: s } = chart; if (!a) return;
      ctx.save(); ctx.setLineDash([4, 4]); ctx.lineWidth = 1; ctx.font = '10px Inter, sans-serif';
      for (const t of lines || []) {
        const sc = s[t.axis || 'y']; if (!sc) continue;
        const y = sc.getPixelForValue(t.value); if (y < a.top || y > a.bottom) continue;
        ctx.strokeStyle = t.color || 'rgba(138,148,163,0.6)'; ctx.beginPath(); ctx.moveTo(a.left, y); ctx.lineTo(a.right, y); ctx.stroke();
        ctx.fillStyle = t.color || 'rgba(138,148,163,0.9)'; if (t.label) ctx.fillText(t.label, a.left + 4, y - 3);
      }
      ctx.restore();
    },
  };
}

// Time-series line chart. datasets: [{label, data:[{date,value}], color, axis:'y'|'y2', dash, fill}]
export function lineChart(canvasId, datasets, opts = {}) {
  const c = el(canvasId); if (!c || !window.Chart) return null;
  if (charts[canvasId]) charts[canvasId].destroy();
  const muted = css('--muted') || '#8a94a3';
  const grid = 'rgba(128,128,128,0.10)';
  const hasY2 = datasets.some(d => d.axis === 'y2');
  const scales = {
    x: { type: 'time', time: { unit: opts.unit || 'year' }, grid: { color: grid }, ticks: { color: muted, font: { size: 10 }, maxTicksLimit: 10 } },
    y: { position: 'left', grid: { color: grid }, ticks: { color: muted, font: { size: 10 }, callback: opts.yTicks }, title: { display: !!opts.yTitle, text: opts.yTitle, color: muted, font: { size: 11 } } },
  };
  if (opts.yMin !== undefined) scales.y.min = opts.yMin;
  if (opts.yMax !== undefined) scales.y.max = opts.yMax;
  if (hasY2) scales.y2 = { position: 'right', grid: { display: false }, ticks: { color: muted, font: { size: 10 }, callback: opts.y2Ticks }, title: { display: !!opts.y2Title, text: opts.y2Title, color: muted, font: { size: 11 } } };
  charts[canvasId] = new Chart(c.getContext('2d'), {
    type: 'line',
    data: {
      datasets: datasets.map(d => ({
        label: d.label, data: thin(d.data).map(o => ({ x: o.date, y: o.value })), yAxisID: d.axis || 'y',
        borderColor: d.color || COLORS.accent, backgroundColor: d.fill ? (d.color || COLORS.accent) + '22' : 'transparent',
        borderWidth: d.width || 1.6, borderDash: d.dash || [], fill: !!d.fill, pointRadius: 0, tension: 0.1, spanGaps: true, stepped: d.stepped || false,
      })),
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { labels: { color: muted, font: { size: 11 }, boxWidth: 12 } }, tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${Number(ctx.parsed.y).toFixed(opts.dec ?? 2)}` } } },
      scales,
    },
    plugins: [shadePlugin(opts.recessions), linesPlugin(opts.lines)],
  });
  return charts[canvasId];
}

// Category chart (e.g. yield curve by maturity).
export function categoryChart(canvasId, labels, datasets, opts = {}) {
  const c = el(canvasId); if (!c || !window.Chart) return null;
  if (charts[canvasId]) charts[canvasId].destroy();
  const muted = css('--muted') || '#8a94a3';
  const grid = 'rgba(128,128,128,0.10)';
  charts[canvasId] = new Chart(c.getContext('2d'), {
    type: opts.type || 'line',
    data: { labels, datasets: datasets.map(d => ({ label: d.label, data: d.data, borderColor: d.color, backgroundColor: d.bg || d.color, borderWidth: d.width || 2, borderDash: d.dash || [], pointRadius: opts.type === 'bar' ? 0 : 3, tension: 0.2 })) },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false, indexAxis: opts.horizontal ? 'y' : 'x',
      plugins: { legend: { display: datasets.length > 1, labels: { color: muted, font: { size: 11 }, boxWidth: 12 } } },
      scales: { x: { grid: { color: grid }, ticks: { color: muted, font: { size: 10 } } }, y: { grid: { color: grid }, ticks: { color: muted, font: { size: 10 }, callback: opts.yTicks }, title: { display: !!opts.yTitle, text: opts.yTitle, color: muted } } },
    },
  });
  return charts[canvasId];
}

// Standard "as of" line: newest observation date among ids + snapshot time.
export async function asOfLine(targetId, series) {
  const t = el(targetId); if (!t) return;
  const dates = Object.values(series).map(a => last(a)?.date).filter(Boolean).sort();
  const snap = await snapshotTime();
  t.innerHTML = `Latest observation ${dates.length ? dayName(dates[dates.length - 1]) : '—'}` +
    (snap ? ` &middot; data snapshot ${dayName(snap.slice(0, 10))}` : '') +
    ` &middot; <a href="#method">Methodology &amp; sources</a>`;
}
