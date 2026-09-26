// Daily Influencers — page controller.
// Loads ./data/index.json (the manifest), picks the week to display (URL ?week=
// override, else manifest.current), loads ./data/{weekOf}.json, and renders
// subject, items, watchlist. Macro tiles render immediately from JSON-cached
// values, then attempt to upgrade to live FRED data via /api/fred. If FRED is
// unreachable, cached values stay visible and status drops to "stale".
//
// Backward compat: if data/index.json is missing, falls back to data/this-week.json.

const FRED_START = '2021-01-01';

// ---------- Boot ----------
boot().catch(err => {
  console.error('[influencers] boot failed:', err);
  setStatus('error', 'Page failed to initialize');
});

async function boot() {
  setStatus('loading', 'Loading brief…');

  const manifest = await loadManifest();
  const weekParam = new URLSearchParams(window.location.search).get('week');
  const weekToLoad = pickWeek(manifest, weekParam);

  setupArchivePicker(manifest, weekToLoad);

  // Surface staleness: this is a manually produced weekly brief. If the
  // newest week is more than 14 days old, say so instead of looking current.
  if (manifest?.current) {
    const ageDays = Math.floor((Date.now() - new Date(manifest.current + 'T12:00:00Z')) / 86400000);
    if (ageDays > 14) {
      const hero = document.querySelector('.hero-block');
      if (hero) {
        const note = document.createElement('p');
        note.className = 'stale-note';
        note.textContent = 'Note: the latest brief is the week of ' + manifest.current +
          ' (' + ageDays + ' days ago). No newer edition has been published.';
        hero.appendChild(note);
      }
    }
  }

  const data = await loadBrief(weekToLoad);

  renderSubject(data);
  renderTiles(data.tiles);
  renderItems(data);
  renderWatchlist(data.watchlist);
  setStatus('stale', 'Cached values shown · attempting live data');

  try {
    const live = await fetchFredTiles(data.tiles.map(t => t.id));
    upgradeTiles(data.tiles, live);
    setStatus('live', 'Live · FRED · cached at the edge for 6h');
  } catch (err) {
    console.warn('[influencers] live FRED fetch failed; staying on cached values:', err);
    setStatus('stale', 'Static brief · live data unavailable');
  }
}

async function loadManifest() {
  try {
    const res = await fetch('./data/index.json', { cache: 'no-cache' });
    if (!res.ok) return null;
    return await res.json();
  } catch (_) {
    return null;
  }
}

function pickWeek(manifest, urlWeek) {
  if (manifest && urlWeek && manifest.weeks?.some(w => w.weekOf === urlWeek)) return urlWeek;
  if (manifest?.current) return manifest.current;
  return null;
}

async function loadBrief(weekOf) {
  const url = weekOf ? `./data/${encodeURIComponent(weekOf)}.json` : './data/this-week.json';
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) {
    if (weekOf) {
      const fallback = await fetch('./data/this-week.json', { cache: 'no-cache' }).catch(() => null);
      if (fallback?.ok) return fallback.json();
    }
    throw new Error(`brief fetch ${res.status}`);
  }
  return res.json();
}

function setupArchivePicker(manifest, weekToLoad) {
  const picker = document.getElementById('archive-picker');
  const select = document.getElementById('archive-select');
  if (!picker || !select) return;

  const weeks = manifest?.weeks || [];
  if (weeks.length <= 1) {
    picker.hidden = true;
    return;
  }
  const sorted = [...weeks].sort((a, b) => (a.weekOf < b.weekOf ? 1 : -1));
  select.innerHTML = '';
  for (const w of sorted) {
    const opt = document.createElement('option');
    opt.value = w.weekOf;
    const labelDate = formatLongDate(w.weekOf);
    const ticker = w.subjectTicker ? ` · ${w.subjectTicker}` : '';
    opt.textContent = `${labelDate}${ticker}${w.weekOf === manifest.current ? ' (current)' : ''}`;
    if (w.weekOf === weekToLoad) opt.selected = true;
    select.appendChild(opt);
  }
  picker.hidden = false;
  select.addEventListener('change', (e) => {
    const next = e.target.value;
    const url = new URL(window.location.href);
    if (next === manifest.current) url.searchParams.delete('week');
    else url.searchParams.set('week', next);
    window.location.href = url.toString();
  });
}

// ---------- Subject ----------
function renderSubject(data) {
  document.getElementById('subject-date').textContent = formatLongDate(data.weekOf);
  document.getElementById('subject-title').innerHTML =
    `${escapeHtml(data.subject.name)} <span class="ticker">(${escapeHtml(data.subject.ticker)})</span>`;
  document.getElementById('subject-sector').textContent = data.subject.sector;
  document.getElementById('subject-rationale').textContent = data.subject.rationale;
  document.getElementById('items-subject').textContent = data.subject.ticker;
}

// ---------- Tiles ----------
function renderTiles(tiles) {
  const grid = document.getElementById('tiles-grid');
  grid.innerHTML = '';
  for (const t of tiles) {
    const tile = document.createElement('div');
    tile.className = 'tile is-loading';
    tile.dataset.tileId = t.id;
    tile.innerHTML = `
      <div class="tile-head">
        <span class="tile-label">${escapeHtml(t.label)}</span>
        <span class="tile-delta ${t.fallback.deltaDir || ''}">${escapeHtml(t.fallback.delta || '·')}</span>
      </div>
      <div class="tile-value">${formatTileValue(t.fallback.value, t.unit)}</div>
      <div class="tile-spark" aria-hidden="true"></div>
      <div class="tile-asof">${escapeHtml(t.fallback.asOf || '·')}</div>
    `;
    grid.appendChild(tile);
  }
}

function upgradeTiles(tiles, liveById) {
  for (const t of tiles) {
    const live = liveById[t.id];
    if (!live || !live.observations || live.observations.length === 0) continue;
    const tileEl = document.querySelector(`.tile[data-tile-id="${t.id}"]`);
    if (!tileEl) continue;

    const obs = live.observations;
    const last = obs[obs.length - 1];
    const value = last.value;
    const date = last.date;

    const deltaInfo = computeDelta(obs, t);
    tileEl.classList.remove('is-loading');

    tileEl.querySelector('.tile-value').innerHTML = formatTileValue(value, t.unit);
    const deltaEl = tileEl.querySelector('.tile-delta');
    deltaEl.textContent = deltaInfo.text;
    deltaEl.className = `tile-delta ${deltaInfo.dir}`;
    tileEl.querySelector('.tile-asof').textContent = `${date} · FRED ${t.id}`;

    const sparkEl = tileEl.querySelector('.tile-spark');
    sparkEl.innerHTML = renderSparklineSvg(obs);
  }
}

function computeDelta(obs, tile) {
  if (obs.length < 2) return { text: '·', dir: '' };
  const last = obs[obs.length - 1].value;

  if (tile.id === 'MORTGAGE30US') {
    const prev = obs[obs.length - 2]?.value;
    if (prev == null) return { text: '·', dir: '' };
    const diffBps = (last - prev) * 100;
    const arrow = diffBps > 0 ? '▲' : diffBps < 0 ? '▼' : '·';
    const dir = diffBps > 0 ? 'down' : diffBps < 0 ? 'up' : '';
    return { text: `${arrow} ${Math.abs(diffBps).toFixed(0)} bps w/w`, dir };
  }

  const yearAgo = obs[obs.length - 13];
  if (yearAgo && yearAgo.value !== 0) {
    const pct = ((last - yearAgo.value) / Math.abs(yearAgo.value)) * 100;
    const arrow = pct > 0 ? '▲' : pct < 0 ? '▼' : '·';
    const dir = pct > 0 ? 'up' : pct < 0 ? 'down' : '';
    return { text: `${arrow} ${Math.abs(pct).toFixed(1)}% y/y`, dir };
  }
  const prev = obs[obs.length - 2]?.value;
  if (prev == null) return { text: '·', dir: '' };
  const pct = ((last - prev) / Math.abs(prev || 1)) * 100;
  const arrow = pct > 0 ? '▲' : pct < 0 ? '▼' : '·';
  const dir = pct > 0 ? 'up' : pct < 0 ? 'down' : '';
  return { text: `${arrow} ${Math.abs(pct).toFixed(1)}% m/m`, dir };
}

function formatTileValue(value, unit) {
  if (value == null) return '<span style="font-size:14px;color:#8a8578">—</span>';
  let formatted;
  if (Math.abs(value) >= 1000) formatted = value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  else if (Math.abs(value) >= 100) formatted = value.toFixed(0);
  else if (Math.abs(value) >= 10) formatted = value.toFixed(1);
  else formatted = value.toFixed(2);
  return `${formatted}${unit ? `<span class="tile-unit">${escapeHtml(unit)}</span>` : ''}`;
}

function renderSparklineSvg(obs) {
  if (!obs || obs.length < 2) return '';
  const N = Math.min(obs.length, 60);
  const slice = obs.slice(-N);
  const values = slice.map(o => o.value).filter(v => Number.isFinite(v));
  if (values.length < 2) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const W = 200, H = 36;
  const stepX = W / (values.length - 1);
  const points = values.map((v, i) => {
    const x = (i * stepX).toFixed(1);
    const y = (H - ((v - min) / range) * (H - 4) - 2).toFixed(1);
    return `${x},${y}`;
  }).join(' ');
  const last = values[values.length - 1];
  const lastX = ((values.length - 1) * stepX).toFixed(1);
  const lastY = (H - ((last - min) / range) * (H - 4) - 2).toFixed(1);
  return `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <polyline points="${points}" fill="none" stroke="#166534" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round" />
      <circle cx="${lastX}" cy="${lastY}" r="2" fill="#166534" />
    </svg>`;
}

// ---------- FRED ----------
async function fetchFredTiles(ids) {
  const url = `/api/fred?series=${ids.join(',')}&start=${FRED_START}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`/api/fred ${res.status}${text ? `: ${text.slice(0, 120)}` : ''}`);
  }
  const body = await res.json();
  const out = {};
  for (const s of body.series || []) {
    out[s.id] = { meta: s.meta || null, observations: s.observations || [] };
  }
  return out;
}

// ---------- Items ----------
function renderItems(data) {
  const root = document.getElementById('items-content');
  root.innerHTML = '';

  const themeOrder = [];
  const groups = new Map();
  for (const item of data.items) {
    if (!groups.has(item.theme)) { groups.set(item.theme, []); themeOrder.push(item.theme); }
    groups.get(item.theme).push(item);
  }

  for (const theme of themeOrder) {
    const sec = document.createElement('div');
    sec.className = 'theme-section';
    const label = document.createElement('div');
    label.className = 'theme-label';
    label.textContent = theme;
    sec.appendChild(label);

    for (const item of groups.get(theme)) {
      sec.appendChild(renderItem(item));
    }
    root.appendChild(sec);
  }
}

function renderItem(item) {
  const det = document.createElement('details');
  det.className = 'item';

  const summary = document.createElement('summary');
  const lensChips = (item.lenses || []).map(l => `<span class="chip ${l.toLowerCase()}">${escapeHtml(l)}</span>`).join('');
  summary.innerHTML = `
    <div class="item-head">
      <div class="item-rank">${String(item.rank).padStart(2, '0')}</div>
      <div class="item-main">
        <div class="item-headline">${escapeHtml(item.headline)}</div>
        <div class="item-meta">${escapeHtml(item.source)} · ${escapeHtml(item.date)}</div>
        <div class="item-sowhat">${escapeHtml(item.soWhat)}</div>
        <div class="lens-chips">${lensChips}</div>
        <div class="expand-hint"></div>
      </div>
    </div>`;
  det.appendChild(summary);

  const drill = document.createElement('div');
  drill.className = 'drill';
  drill.innerHTML = `
    <div>${escapeHtml(item.drilldown)}</div>
    <span class="citation">Source: <a href="${escapeAttr(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.source)} — ${escapeHtml(item.date)}</a></span>
  `;
  det.appendChild(drill);

  return det;
}

// ---------- Watchlist ----------
function renderWatchlist(rows) {
  const root = document.getElementById('watchlist-table');
  root.innerHTML = '';
  for (const r of rows) {
    const row = document.createElement('div');
    row.className = 'watch-row';
    row.innerHTML = `
      <div class="watch-date">${escapeHtml(r.date)}</div>
      <div class="watch-event">${escapeHtml(r.event)}</div>
      <div class="watch-why">${escapeHtml(r.why)}</div>`;
    root.appendChild(row);
  }
}

// ---------- Status ----------
function setStatus(state, text) {
  const s = document.getElementById('status');
  s.classList.remove('loading', 'live', 'stale', 'error');
  s.classList.add(state);
  document.getElementById('status-text').textContent = text;
}

// ---------- Helpers ----------
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function escapeAttr(s) { return escapeHtml(s); }

function formatLongDate(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return iso;
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return `${months[m - 1]} ${d}, ${y}`;
}
