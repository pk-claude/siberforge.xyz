// Supply Chain Dashboard — client controller (v2).
// Reads snapshot.json, manifest.json, insights.json, calendar.json. Renders:
//   - overview: composite, calendar strip, watch band, environment summary, 4 quadrants
//   - category page: calendar strip, watch band, dense grid
//   - industrial-re: calendar strip, watch band, dense grid (incl. ticker tiles)
//   - data: download zone
//   - metric: drill-down chart
//   - insights: full insights page

import { INDICATORS, INDICATORS_BY_ID, INDICATORS_BY_CATEGORY, CATEGORIES } from './indicators.js';
import { TICKER_INFO } from './ticker-info.js';
import { loadV2, getInsights, getCalendar, renderCalendarStrip, renderWatchBand, renderEnvironmentSummary, renderInsightsPage } from './insights.js';

const NS = 'http://www.w3.org/2000/svg';
function svg(tag, attrs = {}) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

let SNAPSHOT = null;
let MANIFEST = null;

async function loadData() {
  const base = pathPrefix();
  const [s, m] = await Promise.all([
    fetch(`${base}data/snapshot.json`).then(r => r.json()).catch(() => null),
    fetch(`${base}data/manifest.json`).then(r => r.json()).catch(() => null),
  ]);
  SNAPSHOT = s; MANIFEST = m;
}

function pathPrefix() {
  const p = window.location.pathname;
  if (p.includes('/core/supply/dc/'))            return '../';
  if (p.includes('/core/supply/middle-mile/'))   return '../';
  if (p.includes('/core/supply/last-mile/'))     return '../';
  if (p.includes('/core/supply/international/')) return '../';
  if (p.includes('/core/supply/insights/'))      return '../';
  return './';
}

// ============================ Formatters ============================
function fmt(v, decimals = 1, unit = '') {
  if (!Number.isFinite(v)) return '—';
  const abs = Math.abs(v);
  let s;
  if (unit === 'k') {
    s = v.toLocaleString(undefined, { maximumFractionDigits: 1 }) + 'k';
  } else if (unit === '$M' || unit === 'mm_usd' || unit === '$M SAAR') {
    s = '$' + (v / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 }) + 'B';
  } else if (unit === 'TEU') {
    s = (v / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 }) + 'k TEU';
  } else if (unit === '$') {
    s = '$' + v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  } else if (abs >= 1_000_000) {
    s = (v / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 }) + 'M';
  } else {
    s = v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }
  if (unit && !['k', '$M', 'mm_usd', '$M SAAR', 'TEU', '$'].includes(unit)) {
    s = s + ' ' + unit;
  }
  return s.trim();
}

function fmtSigned(v, decimals = 1, suffix = '') {
  if (!Number.isFinite(v)) return '—';
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(decimals)}${suffix}`;
}

// ============================ Sparklines ============================
function renderSpark(el, history, opts = {}) {
  const w = opts.width || 160;
  const h = opts.height || 32;
  const stroke = opts.stroke || '#5a9cff';
  if (!history || history.length < 2) return;
  const ys = history.map(p => p[1]);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const yPad = (yMax - yMin) * 0.08 || 1;
  const sx = i => 4 + i / (ys.length - 1) * (w - 8);
  const sy = v => h - 4 - (v - (yMin - yPad)) / ((yMax + yPad) - (yMin - yPad)) * (h - 8);
  const root = svg('svg', { viewBox: `0 0 ${w} ${h}`, class: 'spark' });
  let d = `M ${sx(0).toFixed(1)} ${sy(ys[0]).toFixed(1)}`;
  for (let i = 1; i < ys.length; i++) d += ` L ${sx(i).toFixed(1)} ${sy(ys[i]).toFixed(1)}`;
  root.appendChild(svg('path', { d, fill: 'none', stroke, 'stroke-width': '1.4', 'stroke-linejoin': 'round' }));
  root.appendChild(svg('circle', { cx: sx(ys.length - 1), cy: sy(ys[ys.length - 1]), r: 2.2, fill: stroke }));
  el.appendChild(root);
}

// ============================ Deltas ============================
function computeDeltas(history, freq, longTermNormYears = 10) {
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

// ============================ Tooltip ============================
let TOOLTIP = null;
function ensureTooltip() {
  if (TOOLTIP) return TOOLTIP;
  TOOLTIP = document.createElement('div');
  TOOLTIP.className = 'tooltip';
  document.body.appendChild(TOOLTIP);
  return TOOLTIP;
}

function showTooltip(target, ind, deltas) {
  const t = ensureTooltip();
  const insightForId = (getInsights()?.all || []).find(f => f.id === ind.id);
  const rightNow = insightForId?.rightNow || '';
  const tickerInfo = TICKER_INFO[ind.id];

  t.innerHTML = `
    <h3>${escape(ind.label)}</h3>
    <div class="latest">${fmtLatest(deltas?.last, ind.decimals, ind.unit)} · ${deltas?.lastDate || '—'}</div>
    <dl class="deltas">
      <dt>Δ vs last month</dt><dd class="${cls(deltas?.vsLastMonth)}">${fmtSigned(deltas?.vsLastMonth, 1, '%')}</dd>
      <dt>Δ vs last year</dt><dd class="${cls(deltas?.vsLastYear)}">${fmtSigned(deltas?.vsLastYear, 1, '%')}</dd>
      <dt>vs ${ind.longTermNormYears || 10}y avg</dt><dd>${fmtVariancePct(deltas?.vsMeanPct)}</dd>
      <dt>Percentile</dt><dd>${deltas?.percentile != null ? deltas.percentile + 'th' : '—'}</dd>
    </dl>
    ${rightNow ? `<h4>▶ Right now</h4><p class="rightnow">${escape(rightNow)}</p>` : ''}
    ${tickerInfo ? `<h4>About ${ind.id}</h4><p>${escape(tickerInfo.name)} · ${escape(tickerInfo.sector)} · ${escape(tickerInfo.marketCap)}<br><br>${escape(tickerInfo.role)}</p>` : ''}
    <h4>Why it matters</h4><p>${escape(ind.whyMatters || '')}</p>
    <h4>How to read</h4><p>${escape(ind.howToRead || '')}</p>
    <div class="source-line">Source: ${escape(ind.source)} · ${escape(ind.release || '')}</div>
  `;
  positionTooltip(t, target);
  t.classList.add('show');
}

function fmtLatest(v, dec, unit) { return Number.isFinite(v) ? fmt(v, dec ?? 1, unit || '') : '—'; }
function fmtZ(z) {
  // Render percentile rank from a z-score (standard normal CDF). Avoids σ language.
  if (z == null || !Number.isFinite(z)) return '—';
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp(-z * z / 2);
  const tail = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const p = (z >= 0 ? 1 - tail : tail) * 100;
  return p.toFixed(0) + '%';
}
function fmtVariancePct(p) { if (p == null || !Number.isFinite(p)) return '—'; return (p >= 0 ? '+' : '') + p.toFixed(1) + '%'; }
function cls(v) { if (!Number.isFinite(v)) return ''; return v > 0 ? 'pos' : v < 0 ? 'neg' : ''; }
function escape(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

function hideTooltip() { if (TOOLTIP) TOOLTIP.classList.remove('show'); }
function positionTooltip(t, target) {
  const r = target.getBoundingClientRect();
  const tw = 380, th = 380;
  let x = r.right + 10, y = r.top;
  if (x + tw > window.innerWidth - 12) x = r.left - tw - 10;
  if (y + th > window.innerHeight - 12) y = window.innerHeight - th - 12;
  if (y < 12) y = 12;
  t.style.left = (x + window.scrollX) + 'px';
  t.style.top = (y + window.scrollY) + 'px';
}

// ============================ Tile renderer ============================
function renderTile(parent, ind) {
  const data = SNAPSHOT?.series?.[ind.id];
  const tile = document.createElement('div');
  tile.className = 'kpi-tile' + (data && data.lastValue != null ? '' : ' dim');
  tile.dataset.id = ind.id;
  tile.dataset.category = ind.category;
  const accent = CATEGORIES[ind.category]?.accent || '#5a9cff';

  if (data && data.lastValue != null) {
    const deltas = computeDeltas(data.history, ind.freq, ind.longTermNormYears);
    const yoyClass = ind.direction === 'lower_better'
      ? (deltas?.vsLastYear < 0 ? 'pos' : deltas?.vsLastYear > 0 ? 'neg' : '')
      : ind.direction === 'higher_better'
      ? (deltas?.vsLastYear > 0 ? 'pos' : deltas?.vsLastYear < 0 ? 'neg' : '')
      : '';
    const insight = (getInsights()?.all || []).find(f => f.id === ind.id);
    const insightDot = insight ? `<span class="kpi-insight-dot kpi-insight-${insight.class}" title="${insight.headline}"></span>` : '';

    tile.innerHTML = `
      ${insightDot}
      <div class="kpi-label">${escape(ind.shortLabel)}</div>
      <div class="kpi-value">${fmtLatest(data.lastValue, ind.decimals, ind.unit)}</div>
      <div class="kpi-delta ${yoyClass}">${(ind.composite && ind.composite.compute === 'yoy') ? 'level' : ('YoY ' + fmtSigned(deltas?.vsLastYear, 1, '%'))}</div>
    `;
    const sparkHolder = document.createElement('div');
    tile.appendChild(sparkHolder);
    renderSpark(sparkHolder, data.history, { stroke: accent });

    const sourceInfo = MANIFEST?.sources?.[ind.source];
    if (sourceInfo?.stale || sourceInfo?.staleDays > 14) {
      const badge = document.createElement('div');
      badge.className = 'stale-badge';
      badge.textContent = `stale ${sourceInfo.staleDays}d`;
      tile.appendChild(badge);
    }

    tile.addEventListener('mouseenter', () => showTooltip(tile, ind, deltas));
    tile.addEventListener('mouseleave', hideTooltip);
    tile.addEventListener('click', () => {
      window.location.href = `${pathPrefix()}metric.html?id=${encodeURIComponent(ind.id)}`;
    });
  } else {
    tile.innerHTML = `
      <div class="kpi-label">${escape(ind.shortLabel)}</div>
      <div class="kpi-value" style="color:var(--muted-2);">—</div>
      <div class="kpi-delta">awaiting data</div>
    `;
  }
  parent.appendChild(tile);
}

// ============================ Page renderers ============================
function renderOverview() {
  const calendarHost = document.getElementById('calendar-strip-host');
  if (calendarHost) renderCalendarStrip(calendarHost);
  const watchHost = document.getElementById('watch-band-host');
  if (watchHost) renderWatchBand(watchHost);
  const envHost = document.getElementById('environment-summary-host');
  if (envHost) renderEnvironmentSummary(envHost);

  // Composite tile fallback (kept for backwards compatibility — replaced by env summary above if both exist)
  const composite = document.getElementById('composite-strip');
  if (composite && !envHost) {
    const ind = INDICATORS_BY_ID['SCP_COMPOSITE'];
    const data = SNAPSHOT?.series?.['SCP_COMPOSITE'];
    if (ind && data && data.lastValue != null) {
      const v = data.lastValue;
      const regime = v < -1 ? 'Loose' : v < 1 ? 'Normal' : v < 2 ? 'Tight' : 'Severe';
      composite.innerHTML = `
        <div><div class="label">SC Pressure</div><div class="value">${fmtZ(v)}</div><div class="regime ${regime.toLowerCase()}">${regime} · ${data.lastDate}</div></div>
        <div id="composite-spark"></div>
        <div class="why">${escape(ind.whyMatters)}</div>`;
      renderSpark(document.getElementById('composite-spark'), data.history, { stroke: '#f7a700', width: 360, height: 80 });
    }
  }

  for (const cat of ['dc', 'middle-mile', 'last-mile', 'international']) {
    const grid = document.getElementById(`grid-${cat}`);
    if (!grid) continue;
    const inds = (INDICATORS_BY_CATEGORY[cat] || []).filter(i => i.featured);
    inds.forEach(ind => renderTile(grid, ind));
  }
}

function renderCategoryPage(cat) {
  const calendarHost = document.getElementById('calendar-strip-host');
  if (calendarHost) renderCalendarStrip(calendarHost, { category: cat });
  const watchHost = document.getElementById('watch-band-host');
  if (watchHost) renderWatchBand(watchHost, { category: cat });
  const grid = document.getElementById('dense-grid');
  if (!grid) return;
  const inds = (INDICATORS_BY_CATEGORY[cat] || []).filter(i => !i.isTicker);
  inds.forEach(ind => renderTile(grid, ind));
}

function renderIndustrialRePage() {
  const calendarHost = document.getElementById('calendar-strip-host');
  if (calendarHost) renderCalendarStrip(calendarHost, { category: 'industrial-re' });
  const watchHost = document.getElementById('watch-band-host');
  if (watchHost) renderWatchBand(watchHost, { category: 'industrial-re' });

  const all = INDICATORS_BY_CATEGORY['industrial-re'] || [];
  const baskets = all.filter(i => !i.isTicker);
  const tickers = all.filter(i => i.isTicker);

  const grid = document.getElementById('dense-grid');
  if (grid) baskets.forEach(ind => renderTile(grid, ind));

  const tickerGrid = document.getElementById('ticker-grid');
  if (tickerGrid) tickers.forEach(ind => renderTile(tickerGrid, ind));
}

function renderDownloadZone() {
  const tbody = document.querySelector('#download-table tbody');
  if (!tbody) return;
  const generated = SNAPSHOT?.generatedAt ? new Date(SNAPSHOT.generatedAt).toUTCString() : 'pending';
  const heroTime = document.getElementById('refresh-time');
  if (heroTime) heroTime.textContent = generated;
  for (const ind of INDICATORS) {
    const data = SNAPSHOT?.series?.[ind.id];
    const ok = data && data.lastValue != null;
    const sourceInfo = MANIFEST?.sources?.[ind.source];
    const stale = sourceInfo?.stale;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escape(ind.id)}</td>
      <td>${escape(ind.label)}</td>
      <td>${escape(CATEGORIES[ind.category]?.label || ind.category)}</td>
      <td>${escape(ind.source)}</td>
      <td>${data?.lastDate || '—'}</td>
      <td>${escape(ind.freq)}</td>
      <td>${ok ? `<a href="./data/history/${ind.id}.csv">CSV</a>` : '<span class="pill">no data yet</span>'} ${stale ? '<span class="pill stale">stale</span>' : (ok ? '<span class="pill fresh">ok</span>' : '')}</td>
    `;
    tbody.appendChild(tr);
  }
}

function renderDrillPage() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const ind = INDICATORS_BY_ID[id];
  const data = SNAPSHOT?.series?.[id];
  const root = document.getElementById('drill-root');
  if (!root) return;
  if (!ind) { root.innerHTML = `<h1>Unknown metric: ${escape(id)}</h1>`; return; }
  const deltas = data ? computeDeltas(data.history, ind.freq, ind.longTermNormYears) : null;
  const insight = (getInsights()?.all || []).find(f => f.id === id);
  const tickerInfo = TICKER_INFO[id];

  root.innerHTML = `
    <div class="drill-header">
      <h1>${escape(ind.label)}</h1>
      <div class="meta">${escape(CATEGORIES[ind.category]?.label || '')} · ${escape(ind.freq)} · source: ${escape(ind.source)}</div>
    </div>
    ${insight ? `
      <div class="drill-insight insight-${insight.class}">
        <div class="ic-head">
          <span class="ic-score">${insight.score}</span>
          <span class="ic-icon">${insight.class === 'risk' ? '⚠' : insight.class === 'opportunity' ? '✓' : '◯'}</span>
          <span class="ic-headline">${escape(insight.headline)}</span>
        </div>
        <div class="ic-rightnow">${escape(insight.rightNow || '')}</div>
      </div>
    ` : ''}
    <div class="chart-frame">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;">
        <div>
          <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.6px;">Latest</div>
          <div style="font-size:28px;font-weight:600;">${fmtLatest(deltas?.last, ind.decimals, ind.unit)}</div>
          <div style="color:var(--muted);font-size:12px;">${deltas?.lastDate || '—'}</div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,auto);gap:18px;font-size:12px;">
          <div><div style="color:var(--muted);">Δ MoM</div><div class="${cls(deltas?.vsLastMonth)}">${fmtSigned(deltas?.vsLastMonth, 1, '%')}</div></div>
          <div><div style="color:var(--muted);">Δ YoY</div><div class="${cls(deltas?.vsLastYear)}">${fmtSigned(deltas?.vsLastYear, 1, '%')}</div></div>
          <div><div style="color:var(--muted);">vs avg</div><div>${fmtVariancePct(deltas?.vsMeanPct)}</div></div>
          <div><div style="color:var(--muted);">pct</div><div>${deltas?.percentile ?? '—'}</div></div>
        </div>
      </div>
      <div id="big-chart"></div>
    </div>
    <div class="methodology">
      ${tickerInfo ? `<h3>About ${id}</h3><p><b>${escape(tickerInfo.name)}</b> · ${escape(tickerInfo.sector)} · ${escape(tickerInfo.marketCap)} · ${escape(tickerInfo.footprint)}<br><br>${escape(tickerInfo.role)}</p>` : ''}
      <h3>Why it matters</h3><p>${escape(ind.whyMatters || '')}</p>
      <h3>How to read the trend</h3><p>${escape(ind.howToRead || '')}</p>
      <h3>Methodology</h3><p>${escape(ind.methodology || '')}</p>
    </div>
  `;
  if (data && data.history.length > 1) renderBigChart(document.getElementById('big-chart'), data.history, ind);
}

function renderBigChart(host, history, ind) {
  const accent = CATEGORIES[ind.category]?.accent || '#5a9cff';
  const w = 1040, h = 360;
  const xs = history.map(p => new Date(p[0]).getTime());
  const ys = history.map(p => p[1]);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const yPad = (yMax - yMin) * 0.06 || 1;
  const sx = x => 60 + (x - xMin) / (xMax - xMin || 1) * (w - 80);
  const sy = y => h - 30 - (y - (yMin - yPad)) / ((yMax + yPad) - (yMin - yPad)) * (h - 60);
  const root = svg('svg', { viewBox: `0 0 ${w} ${h}` });
  for (let i = 0; i <= 4; i++) {
    const y = (yMin - yPad) + ((yMax + yPad) - (yMin - yPad)) * i / 4;
    const yPx = sy(y);
    root.appendChild(svg('line', { x1: 60, x2: w - 20, y1: yPx, y2: yPx, stroke: '#232b35', 'stroke-width': '0.5' }));
    const t = svg('text', { x: 50, y: yPx + 3, fill: '#5a6675', 'font-size': '10', 'text-anchor': 'end' });
    t.textContent = y.toFixed(ind.decimals ?? 1);
    root.appendChild(t);
  }
  let d = `M ${sx(xs[0]).toFixed(1)} ${sy(ys[0]).toFixed(1)}`;
  for (let i = 1; i < xs.length; i++) d += ` L ${sx(xs[i]).toFixed(1)} ${sy(ys[i]).toFixed(1)}`;
  root.appendChild(svg('path', { d, fill: 'none', stroke: accent, 'stroke-width': '1.5' }));
  const li = xs.length - 1;
  const lx = sx(xs[li]), ly = sy(ys[li]);
  root.appendChild(svg('circle', { cx: lx, cy: ly, r: 3, fill: accent }));
  const lt = svg('text', { x: lx - 6, y: ly - 6, fill: accent, 'font-size': '11', 'text-anchor': 'end', 'font-weight': '600' });
  lt.textContent = `${ys[li].toFixed(ind.decimals ?? 1)} (${history[li][0]})`;
  root.appendChild(lt);
  let maxI = 0, minI = 0;
  for (let i = 1; i < ys.length; i++) {
    if (ys[i] > ys[maxI]) maxI = i;
    if (ys[i] < ys[minI]) minI = i;
  }
  for (const i of [maxI, minI]) {
    if (i === li) continue;
    const px = sx(xs[i]), py = sy(ys[i]);
    root.appendChild(svg('circle', { cx: px, cy: py, r: 2.5, fill: '#5a6675' }));
    const t = svg('text', { x: px + 4, y: py - 3, fill: '#8a94a3', 'font-size': '10' });
    t.textContent = `${ys[i].toFixed(ind.decimals ?? 1)} · ${history[i][0]}`;
    root.appendChild(t);
  }
  const xt1 = svg('text', { x: 60, y: h - 12, fill: '#5a6675', 'font-size': '10' });
  xt1.textContent = history[0][0];
  const xt2 = svg('text', { x: w - 20, y: h - 12, fill: '#5a6675', 'font-size': '10', 'text-anchor': 'end' });
  xt2.textContent = history[li][0];
  root.appendChild(xt1); root.appendChild(xt2);
  host.appendChild(root);
}

function renderInsightsPageWrapper() {
  const root = document.getElementById('insights-root');
  if (root) renderInsightsPage(root);
}

// ============================ Boot ============================
function populateLastRefresh() {
  const el = document.getElementById('last-refresh-stamp');
  if (el && SNAPSHOT && SNAPSHOT.generatedAt) {
    const d = new Date(SNAPSHOT.generatedAt);
    el.textContent = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}

async function main() {
  await Promise.all([loadData(), loadV2()]);
  populateLastRefresh();
  const page = document.body.dataset.page;
  if (page === 'overview')          renderOverview();
  else if (page === 'category')     renderCategoryPage(document.body.dataset.category);
  else if (page === 'industrial-re') renderIndustrialRePage();
  else if (page === 'download')     renderDownloadZone();
  else if (page === 'metric')       renderDrillPage();
  else if (page === 'insights')     renderInsightsPageWrapper();
}
main();
