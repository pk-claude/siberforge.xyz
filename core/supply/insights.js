// Renderer for the v2 surfaces:
//   - Calendar Strip (top of every page)
//   - Watch Band     (top of every page, below calendar)
//   - Environment Summary (overview only)
//   - Insights page (dedicated)
//
// Reads ./data/insights.json + ./data/calendar.json and decorates the page.

const NS = 'http://www.w3.org/2000/svg';

function pathPrefix() {
  const p = window.location.pathname;
  if (p.includes('/core/supply/dc/'))            return '../';
  if (p.includes('/core/supply/middle-mile/'))   return '../';
  if (p.includes('/core/supply/last-mile/'))     return '../';
  if (p.includes('/core/supply/international/')) return '../';
  if (p.includes('/core/supply/insights/'))      return '../';
  return './';
}

let INSIGHTS = null;
let CALENDAR = null;

export async function loadV2() {
  const base = pathPrefix();
  try {
    const [i, c] = await Promise.all([
      fetch(`${base}data/insights.json`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${base}data/calendar.json`).then(r => r.ok ? r.json() : null).catch(() => null),
    ]);
    INSIGHTS = i; CALENDAR = c;
  } catch (e) { /* leave null */ }
}

export function getInsights() { return INSIGHTS; }
export function getCalendar() { return CALENDAR; }

// ============================ Calendar Strip ============================

export function renderCalendarStrip(host, opts = {}) {
  if (!CALENDAR || !host) return;
  const list = opts.category
    ? (CALENDAR.windows.byCategory?.[opts.category] || [])
    : (CALENDAR.windows.next14 || []);
  if (list.length === 0) return;

  const wrap = document.createElement('div');
  wrap.className = 'cal-strip';
  const head = document.createElement('div');
  head.className = 'cal-strip-head';
  head.innerHTML = `<span class="cal-strip-title">📅 NEXT 14 DAYS</span><span class="cal-strip-count">${list.length} releases</span>`;
  wrap.appendChild(head);

  const cards = document.createElement('div');
  cards.className = 'cal-strip-cards';
  for (const e of list.slice(0, 12)) {
    const card = document.createElement('div');
    card.className = 'cal-card';
    const wd = new Date(e.date + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
    card.innerHTML = `
      <div class="cal-date">${wd}</div>
      <div class="cal-label">${escape(e.shortLabel || e.label)}</div>
      <div class="cal-cadence">${escape(e.cadence || '')}</div>
      <div class="cal-context">${escape(e.context || '')}</div>
    `;
    card.title = `${e.label}\n${e.cadence || ''}\n${e.context || ''}`;
    card.addEventListener('click', () => {
      window.location.href = `${pathPrefix()}metric.html?id=${encodeURIComponent(e.id)}`;
    });
    cards.appendChild(card);
  }
  wrap.appendChild(cards);
  host.appendChild(wrap);
}

// ============================ Watch Band ============================

export function renderWatchBand(host, opts = {}) {
  if (!INSIGHTS || !host) return;
  const list = opts.category
    ? (INSIGHTS.byCategory?.[opts.category] || [])
    : (INSIGHTS.all || []).slice(0, 8);
  if (list.length === 0) return;

  const wrap = document.createElement('div');
  wrap.className = 'watch-band';
  const head = document.createElement('div');
  head.className = 'watch-band-head';
  head.innerHTML = `<span class="watch-band-title">⚠ TOP MOVES</span>`;
  wrap.appendChild(head);

  const cards = document.createElement('div');
  cards.className = 'watch-band-cards';
  for (const f of list.slice(0, 5)) {
    const card = document.createElement('div');
    card.className = `watch-card watch-${f.class}`;
    const icon = f.class === 'risk' ? '⚠' : f.class === 'opportunity' ? '✓' : '◯';
    card.innerHTML = `
      <div class="watch-score">${f.score}</div>
      <div class="watch-icon">${icon}</div>
      <div class="watch-label">${escape(f.shortLabel || f.label)}</div>
      <div class="watch-z">${formatVariance(f)}</div>
      <div class="watch-headline">${escape(f.headline)}</div>
    `;
    card.title = f.rightNow || '';
    card.addEventListener('click', () => {
      window.location.href = `${pathPrefix()}metric.html?id=${encodeURIComponent(f.id)}`;
    });
    cards.appendChild(card);
  }
  wrap.appendChild(cards);
  host.appendChild(wrap);
}

// ============================ Environment Summary ============================

export function renderEnvironmentSummary(host) {
  if (!INSIGHTS || !host) return;
  const s = INSIGHTS.summary;
  if (!s) return;
  const regime = s.compositeScpRegime || 'unknown';
  const regimeCls = regime.toLowerCase();
  const scpVal = s.compositeScpValue;
  // Empirical percentile within the SCP history; falls back to the normal-CDF
  // approximation if the series isn't available yet.
  const empPct = (s.compositeScpPercentile != null && Number.isFinite(s.compositeScpPercentile))
    ? s.compositeScpPercentile
    : (scpVal != null ? Math.round(normCdf(scpVal) * 100) : null);
  const startYear = s.compositeScpStartYear || '—';
  const regimeUC = regime.toUpperCase();
  const scpStr = (scpVal == null || empPct == null)
    ? 'awaiting first data'
    : (regimeUC.includes('TIGHT')
        ? `Tighter than ${empPct}% of months since ${startYear}`
        : regimeUC.includes('LOOSE')
          ? `Looser than ${100 - empPct}% of months since ${startYear}`
          : `Near long-run average since ${startYear}`);

  // When SCP composite is unavailable, show top-3 movers as fallback signal.
  const fallback = (scpVal == null && Array.isArray(INSIGHTS.all))
    ? INSIGHTS.all.slice(0, 3)
    : null;

  host.innerHTML = `
    <div class="env-head">
      <div class="env-title">ENVIRONMENT · refresh ${(INSIGHTS.generatedAt || '').slice(0, 10)}</div>
      <div class="env-meta">
        <span class="env-pill env-risk">${s.risks} risks</span>
        <span class="env-pill env-oppty">${s.opportunities} opportunities</span>
        <span class="env-pill env-watch">${s.watches} watch</span>
      </div>
    </div>
    ${scpVal != null ? `
    <div class="env-scp env-regime-${regimeCls}">
      <div class="env-scp-label">Composite Supply Chain Pressure</div>
      <div class="env-scp-value">${scpStr}</div>
    </div>
    ` : (fallback && fallback.length ? `
    <div class="env-scp env-regime-normal">
      <div class="env-scp-label">Composite pending; top movers right now</div>
      <div style="display:grid;grid-template-columns:repeat(${fallback.length}, 1fr);gap:14px;margin-top:8px;width:100%;">
        ${fallback.map(f => `
          <div>
            <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;">${escape(f.shortLabel || f.label)}</div>
            <div style="font-size:22px;font-weight:600;color:var(--text);">${formatVariance(f)}</div>
            <div style="font-size:11px;color:var(--muted);">${escape(f.headline)}</div>
          </div>
        `).join('')}
      </div>
    </div>
    ` : `
    <div class="env-scp env-regime-normal">
      <div class="env-scp-label">Composite Supply Chain Pressure</div>
      <div class="env-scp-value" style="color:var(--muted-2);">awaiting first data</div>
    </div>
    `)}
    ${s.topAction ? `
      <div class="env-action env-action-risk">
        <div class="env-action-label">⚠ TOP ACTION</div>
        <div class="env-action-headline">${escape(s.topAction.headline)}</div>
        <div class="env-action-rightnow">${escape(s.topAction.rightNow || '')}</div>
        <a class="env-action-drill" href="${pathPrefix()}metric.html?id=${encodeURIComponent(s.topAction.id)}">drill →</a>
      </div>
    ` : ''}
    ${s.topOpportunity ? `
      <div class="env-action env-action-oppty">
        <div class="env-action-label">✓ TOP OPPORTUNITY</div>
        <div class="env-action-headline">${escape(s.topOpportunity.headline)}</div>
        <div class="env-action-rightnow">${escape(s.topOpportunity.rightNow || '')}</div>
        <a class="env-action-drill" href="${pathPrefix()}metric.html?id=${encodeURIComponent(s.topOpportunity.id)}">drill →</a>
      </div>
    ` : ''}
  `;
}

// ============================ Insights page ============================

export function renderInsightsPage(host) {
  if (!INSIGHTS || !host) {
    if (host) host.innerHTML = '<p style="color:var(--muted);">No insights data yet — first refresh pending.</p>';
    return;
  }

  const risks = INSIGHTS.all.filter(f => f.class === 'risk');
  const oppty = INSIGHTS.all.filter(f => f.class === 'opportunity');
  const watches = INSIGHTS.all.filter(f => f.class === 'watch');

  host.innerHTML = `
    <div class="insights-page">
      <div id="env-summary-host"></div>
      <h2>Top Risks (${risks.length})</h2>
      <div class="insight-grid" id="risks-grid"></div>
      <h2>Top Opportunities (${oppty.length})</h2>
      <div class="insight-grid" id="oppty-grid"></div>
      <h2>On the Inflection (${watches.length})</h2>
      <div class="insight-grid" id="watch-grid"></div>
      <h2>All Active Outliers</h2>
      <table class="insights-table">
        <thead><tr><th>Score</th><th>Class</th><th>Metric</th><th>Category</th><th>Headline</th><th>z</th><th>Right now</th></tr></thead>
        <tbody id="insights-tbody"></tbody>
      </table>
    </div>
  `;

  renderEnvironmentSummary(document.getElementById('env-summary-host'));

  fillGrid('risks-grid', risks);
  fillGrid('oppty-grid', oppty);
  fillGrid('watch-grid', watches);

  const tb = document.getElementById('insights-tbody');
  for (const f of INSIGHTS.all) {
    const tr = document.createElement('tr');
    tr.className = `insight-row insight-${f.class}`;
    tr.innerHTML = `
      <td class="t-score">${f.score}</td>
      <td>${f.class}</td>
      <td><a href="${pathPrefix()}metric.html?id=${encodeURIComponent(f.id)}">${escape(f.label)}</a></td>
      <td>${escape(f.category)}</td>
      <td>${escape(f.headline)}</td>
      <td>${formatVariance(f)}</td>
      <td class="t-rightnow">${escape(f.rightNow || '')}</td>
    `;
    tb.appendChild(tr);
  }
}

function fillGrid(id, list) {
  const host = document.getElementById(id);
  if (!host) return;
  if (!list.length) { host.innerHTML = '<p style="color:var(--muted);font-size:12px;">none</p>'; return; }
  for (const f of list) {
    const card = document.createElement('div');
    card.className = `insight-card insight-${f.class}`;
    const icon = f.class === 'risk' ? '⚠' : f.class === 'opportunity' ? '✓' : '◯';
    card.innerHTML = `
      <div class="ic-head">
        <span class="ic-score">${f.score}</span>
        <span class="ic-icon">${icon}</span>
        <a class="ic-label" href="${pathPrefix()}metric.html?id=${encodeURIComponent(f.id)}">${escape(f.label)}</a>
      </div>
      <div class="ic-headline">${escape(f.headline)}</div>
      <div class="ic-rightnow">${escape(f.rightNow || '')}</div>
    `;
    host.appendChild(card);
  }
}

function formatVariance(f) {
  if (f.vsMeanPct != null && Number.isFinite(f.vsMeanPct)) {
    return (f.vsMeanPct >= 0 ? '+' : '') + f.vsMeanPct.toFixed(1) + '%';
  }
  if (f.z != null && Number.isFinite(f.z)) {
    return pctileFromZ(f.z);
  }
  return '—';
}

function formatZ(z) {
  return pctileFromZ(z);
}

// Convert a z-score to a percentile rank string under a standard-normal
// distribution. Used as a fallback when the empirical percentile from the
// historical SCP series isn't available yet.
function pctileFromZ(z) {
  if (z == null || !Number.isFinite(z)) return '—';
  const p = normCdf(z) * 100;
  return p.toFixed(0) + '%';
}

function normCdf(z) {
  // Abramowitz & Stegun 26.2.17. Accurate to ~7.5e-8 over the full real line.
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp(-z * z / 2);
  const tail = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z >= 0 ? 1 - tail : tail;
}

function escape(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

