/* ========================================================================
   pe.js -- Equity P/E dashboard logic.
   Loads three JSON files (companies, series, last-refresh), renders the
   list and chart, manages tooltip + detail panel.
   ======================================================================== */
(function () {
  'use strict';

  // ---------------------------------------------------------------------
  // Config
  // ---------------------------------------------------------------------
  const BASE = './data';
  const SNAPSHOT_BASE = './snapshots';

  const BUCKETS = [
    { max: 0,    cls: 'c0', lbl: 'N/A'    },
    { max: 12,   cls: 'c1', lbl: '<12'    },
    { max: 18,   cls: 'c2', lbl: '12-18'  },
    { max: 25,   cls: 'c3', lbl: '18-25'  },
    { max: 35,   cls: 'c4', lbl: '25-35'  },
    { max: 50,   cls: 'c5', lbl: '35-50'  },
    { max: 80,   cls: 'c6', lbl: '50-80'  },
    { max: 150,  cls: 'c7', lbl: '80-150' },
    { max: 1e9,  cls: 'c8', lbl: '>150'   }
  ];
  const FILL = { c0:'var(--pe-c0)',c1:'var(--pe-c1)',c2:'var(--pe-c2)',c3:'var(--pe-c3)',
                 c4:'var(--pe-c4)',c5:'var(--pe-c5)',c6:'var(--pe-c6)',c7:'var(--pe-c7)',c8:'var(--pe-c8)' };
  const ROWBG = { c0:'var(--pe-rb0)',c1:'var(--pe-rb1)',c2:'var(--pe-rb2)',c3:'var(--pe-rb3)',
                 c4:'var(--pe-rb4)',c5:'var(--pe-rb5)',c6:'var(--pe-rb6)',c7:'var(--pe-rb7)',c8:'var(--pe-rb8)' };

  function bucket(v) {
    if (v == null || v <= 0 || !isFinite(v)) return BUCKETS[0];
    for (const b of BUCKETS) if (v < b.max) return b;
    return BUCKETS[BUCKETS.length - 1];
  }
  const fillFor = (v) => FILL[bucket(v).cls];
  const rowBgFor = (v) => ROWBG[bucket(v).cls];

  function fmtPE(v) {
    if (v == null || !isFinite(v)) return '—';
    if (v < 0) return 'neg';
    if (v >= 1000) return v.toFixed(0);
    return v.toFixed(1);
  }
  function fmtB(v) {
    if (v == null || !isFinite(v)) return '—';
    const a = Math.abs(v);
    if (a >= 1e12) return '$' + (v / 1e12).toFixed(2) + 'T';
    if (a >= 1e9)  return '$' + (v / 1e9).toFixed(2) + 'B';
    if (a >= 1e6)  return '$' + (v / 1e6).toFixed(0) + 'M';
    return '$' + v.toLocaleString();
  }
  function fmtPct(v) { return v == null ? '—' : (v * 100).toFixed(1) + '%'; }
  function fmt2(v)   { return v == null ? '—' : v.toFixed(2); }
  function truncName(n, L) { if (!n) return ''; return n.length > L ? n.slice(0, L - 1) + '…' : n; }
  function $(id) { return document.getElementById(id); }

  // ---------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------
  const state = {
    metric: 'fpe',
    group:  'sec',
    sort:   'fpe-asc',
    cols:   '4',
    view:   'sp',
    data:   [],
    series: {},
    refresh: null,
  };

  // ---------------------------------------------------------------------
  // Load all data
  // ---------------------------------------------------------------------
  async function loadAll() {
    const [companies, series, refresh] = await Promise.all([
      fetch(`${BASE}/companies.json`).then(r => r.json()),
      fetch(`${BASE}/series.json`).then(r => r.json()),
      fetch(`${BASE}/last-refresh.json`).then(r => r.ok ? r.json() : null).catch(() => null),
    ]);
    state.data = companies;
    state.series = series;
    state.refresh = refresh;

    // Status indicator on header
    const refreshText = $('refresh-text');
    if (refreshText && refresh) {
      refreshText.textContent = `Refreshed ${refresh.refreshed_at_human || refresh.refreshed_at}`;
    }
    renderRefreshBanner();
    renderLegend();
    renderAll();
  }

  // ---------------------------------------------------------------------
  // Refresh banner
  // ---------------------------------------------------------------------
  function renderRefreshBanner() {
    const wrap = $('refresh-banner');
    if (!wrap) return;
    const r = state.refresh || {};
    const sp500 = state.data.filter(d => d.sp).length;
    const ndx = state.data.filter(d => d.ndx).length;
    const fetched = r.refreshed_at_human || r.refreshed_at || 'unknown';
    const next = r.next_refresh_at_human || 'next Sunday 14:00 UTC';
    const snapCount = r.snapshot_count != null ? r.snapshot_count : '?';

    wrap.innerHTML = `
      <div class="rb-row">
        <span class="rb-pill rb-pill--ok">LIVE</span>
        <span class="rb-text">Last refresh: <b>${fetched}</b></span>
      </div>
      <div class="rb-row">
        <span class="rb-pill">WEEKLY</span>
        <span class="rb-text">Next: ${next}</span>
        <span class="rb-meta">(Sundays 14:00 UTC)</span>
      </div>
      <div class="rb-row">
        <span class="rb-pill">DAILY SNAPSHOT</span>
        <span class="rb-text">${snapCount} snapshot${snapCount === 1 ? '' : 's'} on file</span>
        <span class="rb-meta">(weekdays 21:30 UTC)</span>
      </div>
      <div class="rb-row" style="margin-left:auto">
        <span class="rb-meta">${state.data.length} unique &middot; ${sp500} S&amp;P 500 &middot; ${ndx} Nasdaq-100</span>
      </div>`;
  }

  // ---------------------------------------------------------------------
  // Legend
  // ---------------------------------------------------------------------
  function renderLegend() {
    const lg = $('legend');
    if (!lg) return;
    lg.innerHTML =
      `<span class="lg-grp" style="border-right:0;font-weight:600">P/E:</span>` +
      BUCKETS.map(b =>
        `<span class="lg-grp"><span class="lg-sw" style="background:${FILL[b.cls]}"></span>${b.lbl}</span>`
      ).join('');
  }

  // ---------------------------------------------------------------------
  // Sorting
  // ---------------------------------------------------------------------
  function sortRows(rows) {
    const valid = (v) => v != null && isFinite(v) && v > 0;
    const asc = (k) => (a, b) => (valid(a[k]) ? a[k] : Number.POSITIVE_INFINITY) -
                                  (valid(b[k]) ? b[k] : Number.POSITIVE_INFINITY);
    const desc = (k) => (a, b) => (valid(b[k]) ? b[k] : -1) - (valid(a[k]) ? a[k] : -1);
    const out = rows.slice();
    switch (state.sort) {
      case 'tpe-asc':  out.sort(asc('tpe')); break;
      case 'tpe-desc': out.sort(desc('tpe')); break;
      case 'fpe-asc':  out.sort(asc('fpe')); break;
      case 'fpe-desc': out.sort(desc('fpe')); break;
      case 'mc-desc':  out.sort((a, b) => (b.mc || 0) - (a.mc || 0)); break;
      case 'alpha':    out.sort((a, b) => a.t.localeCompare(b.t)); break;
      case 'name':     out.sort((a, b) => (a.n || '').localeCompare(b.n || '')); break;
    }
    return out;
  }

  // ---------------------------------------------------------------------
  // Row + section rendering
  // ---------------------------------------------------------------------
  function rowHTML(r) {
    const v = r[state.metric];
    const tCls = (r.tpe == null || r.tpe <= 0) ? 'r-na' : '';
    const fCls = (r.fpe == null || r.fpe <= 0) ? 'r-na' : '';
    return `<div class="row" data-t="${r.t}" style="background:${rowBgFor(v)}">
      <div class="r-tk">${r.t}</div>
      <div class="r-nm" title="${(r.n || '').replace(/"/g, '&quot;')}">${truncName(r.n, 24)}</div>
      <div class="r-tpe ${tCls}">${fmtPE(r.tpe)}</div>
      <div class="r-fpe ${fCls}">${fmtPE(r.fpe)}</div>
    </div>`;
  }

  function colHdrHTML() {
    return `<div class="col-hdr"><div>Tkr</div><div>Company</div><div>Trail</div><div>Fwd</div></div>`;
  }

  function render(viewKey, rows) {
    const root = $('view-' + viewKey);
    rows = sortRows(rows);
    root.className = 'view view--active cols-wrap c' + state.cols;
    if (viewKey !== state.view) root.classList.remove('view--active');

    if (state.group === 'none') {
      root.classList.add('flat');
      root.innerHTML = colHdrHTML() + rows.map(rowHTML).join('');
    } else {
      root.classList.remove('flat');
      const by = {};
      for (const r of rows) {
        const k = r.sec || 'Unknown';
        (by[k] = by[k] || []).push(r);
      }
      // Sectors ordered by total mkt cap desc
      const ordered = Object.entries(by).sort((a, b) => {
        return b[1].reduce((s, r) => s + (r.mc || 0), 0)
             - a[1].reduce((s, r) => s + (r.mc || 0), 0);
      });
      let html = '';
      for (const [sec, items] of ordered) {
        const peVals = items.map(r => r[state.metric]).filter(v => v != null && v > 0);
        const median = peVals.length
          ? peVals.slice().sort((a, b) => a - b)[Math.floor(peVals.length / 2)]
          : null;
        const totalMc = items.reduce((s, r) => s + (r.mc || 0), 0);
        html += `<div class="sec-block">
          <div class="sec-head">
            <span class="sh-name">${sec} &middot; ${items.length}</span>
            <span class="sh-stat">Med ${state.metric === 'tpe' ? 'trail' : 'fwd'} ${fmtPE(median)} &middot; ${fmtB(totalMc)}</span>
          </div>
          ${items.map(rowHTML).join('')}
        </div>`;
      }
      root.innerHTML = html;
    }
    bindRows(root);
  }

  function bindRows(root) {
    root.querySelectorAll('.row').forEach(el => {
      const r = state.data.find(d => d.t === el.dataset.t);
      if (!r) return;
      el.addEventListener('mousemove', e => showTip(e, r));
      el.addEventListener('mouseleave', hideTip);
      el.addEventListener('click', () => openPanel(r));
    });
  }

  function renderAll() {
    $('view-sp').classList.toggle('view--active', state.view === 'sp');
    $('view-ndx').classList.toggle('view--active', state.view === 'ndx');
    if (state.view === 'sp')  render('sp',  state.data.filter(d => d.sp));
    else                       render('ndx', state.data.filter(d => d.ndx));
    applySearch();
  }

  // ---------------------------------------------------------------------
  // Tooltip
  // ---------------------------------------------------------------------
  const tip = $('tip');
  function showTip(e, r) {
    const peers = (r.peers || []).map(p =>
      `<div class="tp-row"><span class="tp-tk">${p.t}</span><span class="tp-nm">${p.n || ''}</span><span class="tp-pe">T ${fmtPE(p.tpe)} &middot; F ${fmtPE(p.fpe)}</span></div>`
    ).join('');
    const peerHd = r.peer_kind === 'sector'
      ? 'Closest peers (same sector &mdash; no direct industry match)'
      : 'Primary peers (same industry, by mkt cap)';
    tip.innerHTML = `
      <h4>${r.t} <span style="color:var(--muted);font-weight:400">${r.n || ''}</span></h4>
      <div class="tip-meta">${r.sec} &middot; ${r.ind}</div>
      <table>
        <tr><td class="k">Trail P/E</td><td><b>${fmtPE(r.tpe)}</b></td><td class="k">Mkt Cap</td><td>${fmtB(r.mc)}</td></tr>
        <tr><td class="k">Fwd P/E</td><td><b>${fmtPE(r.fpe)}</b></td><td class="k">Price</td><td>${fmt2(r.px)}</td></tr>
        <tr><td class="k">PEG</td><td>${fmt2(r.peg)}</td><td class="k">Rev Gr</td><td>${fmtPct(r.rg)}</td></tr>
      </table>
      <div class="tip-peers">
        <div class="tp-h">${peerHd}</div>
        ${peers || '<div style="color:var(--muted);font-size:10px">No peers in universe.</div>'}
      </div>
      <div style="margin-top:6px;font-size:10px;color:var(--muted)">Click row for full detail.</div>`;
    tip.style.display = 'block';
    const w = tip.offsetWidth || 320, h = tip.offsetHeight || 200;
    const x = (e.clientX + 14 + w > window.innerWidth) ? e.clientX - 14 - w : e.clientX + 14;
    const y = Math.min(e.clientY + 14, window.innerHeight - h - 10);
    tip.style.left = Math.max(8, x) + 'px';
    tip.style.top  = Math.max(8, y) + 'px';
  }
  function hideTip() { tip.style.display = 'none'; }

  // ---------------------------------------------------------------------
  // Chart (SVG)
  // ---------------------------------------------------------------------
  function buildChartSVG(tk) {
    const s = state.series[tk] || [];
    if (!s.length) return `<div class="chart-empty">No historical EPS data available for this ticker.</div>`;
    const W = 440, H = 200, padL = 36, padR = 10, padT = 10, padB = 22;
    const vals = [];
    for (const r of s) {
      if (r[2] != null) vals.push(r[2]);
      if (r[3] != null) vals.push(r[3]);
    }
    if (!vals.length) return `<div class="chart-empty">No P/E history (TTM EPS unavailable).</div>`;
    let yMin = Math.min(...vals), yMax = Math.max(...vals);
    const sorted = vals.slice().sort((a, b) => a - b);
    const p98 = sorted[Math.floor(sorted.length * 0.98)];
    if (yMax > p98 * 1.5) yMax = p98 * 1.2;
    yMin = Math.max(0, yMin * 0.9);
    if (yMax <= yMin) yMax = yMin + 10;
    const xStep = (W - padL - padR) / (s.length - 1 || 1);
    const yScale = v => padT + (H - padT - padB) * (1 - (Math.min(v, yMax) - yMin) / (yMax - yMin));
    const xScale = i => padL + i * xStep;

    function pathFor(idx) {
      let d = '', started = false;
      for (let i = 0; i < s.length; i++) {
        const v = s[i][idx];
        if (v == null) { started = false; continue; }
        const x = xScale(i), y = yScale(v);
        d += (started ? ' L ' : ' M ') + x.toFixed(1) + ' ' + y.toFixed(1);
        started = true;
      }
      return d;
    }

    const yTicks = 4;
    let ticksHTML = '';
    for (let i = 0; i <= yTicks; i++) {
      const v = yMin + (yMax - yMin) * i / yTicks;
      const y = yScale(v);
      ticksHTML += `<line x1="${padL}" x2="${W - padR}" y1="${y}" y2="${y}" stroke="var(--line)" stroke-width="0.5"/>
        <text x="${padL - 4}" y="${y + 3}" font-size="9" fill="var(--muted)" text-anchor="end">${v.toFixed(0)}</text>`;
    }
    let xlabels = '', lastYear = '';
    for (let i = 0; i < s.length; i++) {
      const yr = s[i][0].slice(0, 4);
      if (yr !== lastYear) {
        const x = xScale(i);
        xlabels += `<text x="${x}" y="${H - 6}" font-size="9" fill="var(--muted)" text-anchor="middle">${yr}</text>
          <line x1="${x}" x2="${x}" y1="${padT}" y2="${H - padB}" stroke="var(--line)" stroke-width="0.5" opacity="0.5"/>`;
        lastYear = yr;
      }
    }
    const lastT = [...s].reverse().find(r => r[2] != null);
    const lastF = [...s].reverse().find(r => r[3] != null);
    let markers = '';
    if (lastT) { const i = s.indexOf(lastT); markers += `<circle cx="${xScale(i)}" cy="${yScale(lastT[2])}" r="2.5" fill="var(--blue)"/>`; }
    if (lastF) { const i = s.indexOf(lastF); markers += `<circle cx="${xScale(i)}" cy="${yScale(lastF[3])}" r="2.5" fill="var(--green)"/>`; }

    return `<svg viewBox="0 0 ${W} ${H}" class="chart-svg" preserveAspectRatio="xMidYMid meet">
      ${ticksHTML}${xlabels}
      <path d="${pathFor(2)}" fill="none" stroke="var(--blue)" stroke-width="1.5"/>
      <path d="${pathFor(3)}" fill="none" stroke="var(--green)" stroke-width="1.5" stroke-dasharray="3,2"/>
      ${markers}
    </svg>`;
  }

  function chartBlockHTML(r) {
    const has = state.series[r.t] && state.series[r.t].length > 0;
    const note = has
      ? 'Trailing P/E uses month-end price &divide; TTM EPS (built from quarterly + annual reports). Forward P/E (perfect-foresight) uses month-end price &divide; next-12-month realized EPS, so the line stops ~12 months before today.'
      : 'No historical EPS data was retrievable for this ticker.';
    return `
      <div class="chart-wrap">
        <div class="ch-hd">
          <div class="ch-ttl">Historical P/E (5y monthly)</div>
          <div class="ch-lg">
            <span><span class="ch-dot" style="background:var(--blue)"></span>Trailing</span>
            <span><span class="ch-dot" style="background:var(--green);background-image:repeating-linear-gradient(90deg,var(--green) 0 3px,transparent 3px 5px)"></span>Forward (PF)</span>
          </div>
        </div>
        ${buildChartSVG(r.t)}
        <div class="chart-note">${note}</div>
      </div>`;
  }

  // ---------------------------------------------------------------------
  // Detail panel
  // ---------------------------------------------------------------------
  const panel = $('panel');
  const scrim = $('scrim');
  function openPanel(r) {
    hideTip();
    const peers = (r.peers || []).map(p =>
      `<tr><td class="t">${p.t}</td><td class="n">${p.n || ''}</td><td>${fmtPE(p.tpe)}</td><td>${fmtPE(p.fpe)}</td></tr>`
    ).join('');
    const peerHd = r.peer_kind === 'sector' ? 'Closest peers (same sector)' : 'Peers (same industry, by market cap)';
    panel.innerHTML = `
      <header>
        <div class="pn-hd">
          <div>
            <div class="pn-tk">${r.t}</div>
            <div class="pn-nm">${r.n || ''}</div>
            <div class="pn-tag">
              <span>${r.sec} &middot; ${r.ind}</span>
              ${r.sp ? '<span class="pin pin-sp">S&amp;P 500</span>' : ''}
              ${r.ndx ? '<span class="pin pin-ndx">Nasdaq-100</span>' : ''}
            </div>
          </div>
          <button class="pn-close" aria-label="Close" onclick="window.__closePEPanel()">&times;</button>
        </div>
      </header>
      <div class="pn-body">
        <div class="pe-row">
          <div class="pe-card" style="border-left:4px solid ${fillFor(r.tpe)}">
            <div class="pc-l">Trailing P/E</div>
            <div class="pc-v">${fmtPE(r.tpe)}</div>
            <div class="pc-eps">EPS (TTM): ${fmt2(r.eps_t)}</div>
          </div>
          <div class="pe-card" style="border-left:4px solid ${fillFor(r.fpe)}">
            <div class="pc-l">Forward P/E</div>
            <div class="pc-v">${fmtPE(r.fpe)}</div>
            <div class="pc-eps">EPS (Fwd): ${fmt2(r.eps_f)}</div>
          </div>
        </div>
        ${chartBlockHTML(r)}
        <h3>Valuation</h3>
        <div class="stats">
          <div class="st-row"><span class="st-k">Market Cap</span><span class="st-v">${fmtB(r.mc)}</span></div>
          <div class="st-row"><span class="st-k">Enterprise Value</span><span class="st-v">${fmtB(r.ev)}</span></div>
          <div class="st-row"><span class="st-k">PEG Ratio</span><span class="st-v">${fmt2(r.peg)}</span></div>
          <div class="st-row"><span class="st-k">Price / Book</span><span class="st-v">${fmt2(r.pb)}</span></div>
          <div class="st-row"><span class="st-k">Price</span><span class="st-v">${fmt2(r.px)}</span></div>
          <div class="st-row"><span class="st-k">52W Range</span><span class="st-v">${fmt2(r.l52)} &ndash; ${fmt2(r.h52)}</span></div>
        </div>
        <h3>Earnings &amp; Margins</h3>
        <div class="stats">
          <div class="st-row"><span class="st-k">Revenue (TTM)</span><span class="st-v">${fmtB(r.rev)}</span></div>
          <div class="st-row"><span class="st-k">Net Income (TTM)</span><span class="st-v">${fmtB(r.ni)}</span></div>
          <div class="st-row"><span class="st-k">EBITDA</span><span class="st-v">${fmtB(r.ebitda)}</span></div>
          <div class="st-row"><span class="st-k">Gross Margin</span><span class="st-v">${fmtPct(r.gm)}</span></div>
          <div class="st-row"><span class="st-k">Operating Margin</span><span class="st-v">${fmtPct(r.om)}</span></div>
          <div class="st-row"><span class="st-k">Profit Margin</span><span class="st-v">${fmtPct(r.pm)}</span></div>
          <div class="st-row"><span class="st-k">Return on Equity</span><span class="st-v">${fmtPct(r.roe)}</span></div>
          <div class="st-row"><span class="st-k">Debt / Equity</span><span class="st-v">${fmt2(r.de)}</span></div>
        </div>
        <h3>Growth &amp; Risk</h3>
        <div class="stats">
          <div class="st-row"><span class="st-k">Revenue Growth (YoY)</span><span class="st-v">${fmtPct(r.rg)}</span></div>
          <div class="st-row"><span class="st-k">Earnings Growth (YoY)</span><span class="st-v">${fmtPct(r.eg)}</span></div>
          <div class="st-row"><span class="st-k">Dividend Yield</span><span class="st-v">${r.div == null ? '—' : r.div.toFixed(2) + '%'}</span></div>
          <div class="st-row"><span class="st-k">Beta</span><span class="st-v">${fmt2(r.beta)}</span></div>
        </div>
        <h3>${peerHd}</h3>
        <table class="pn-peers">
          <thead><tr><th>Tkr</th><th>Name</th><th>Trail</th><th>Fwd</th></tr></thead>
          <tbody>${peers || '<tr><td colspan="4" style="color:var(--muted);text-align:center;padding:10px">No peers in universe.</td></tr>'}</tbody>
        </table>
        ${r.desc ? `<h3>Business</h3><div class="desc">${String(r.desc).replace(/</g, '&lt;')}</div>` : ''}
      </div>`;
    panel.classList.add('open');
    scrim.classList.add('open');
  }
  function closePanel() { panel.classList.remove('open'); scrim.classList.remove('open'); }
  window.__closePEPanel = closePanel;
  scrim.addEventListener('click', closePanel);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePanel(); });

  // ---------------------------------------------------------------------
  // Wire controls
  // ---------------------------------------------------------------------
  document.querySelectorAll('.cs-tab').forEach(t => {
    t.addEventListener('click', () => {
      document.querySelectorAll('.cs-tab').forEach(x => x.classList.remove('cs-tab--active'));
      t.classList.add('cs-tab--active');
      state.view = t.dataset.view;
      renderAll();
    });
  });
  $('group').addEventListener('change', e => { state.group = e.target.value; renderAll(); });
  $('sort').addEventListener('change',  e => { state.sort  = e.target.value; renderAll(); });
  $('metric').addEventListener('change',e => { state.metric= e.target.value; renderAll(); });
  $('cols').addEventListener('change',  e => { state.cols  = e.target.value; renderAll(); });

  const search = $('search');
  function applySearch() {
    const q = search.value.trim().toLowerCase();
    document.querySelectorAll('.row').forEach(el => {
      const r = state.data.find(d => d.t === el.dataset.t);
      if (!r) { el.style.display = ''; return; }
      el.style.display = (!q || r.t.toLowerCase().includes(q) || (r.n || '').toLowerCase().includes(q)) ? '' : 'none';
    });
    document.querySelectorAll('.sec-block').forEach(b => {
      const visible = Array.from(b.querySelectorAll('.row')).some(r => r.style.display !== 'none');
      b.style.display = visible ? '' : 'none';
    });
  }
  search.addEventListener('input', applySearch);

  // Boot
  loadAll().catch(err => {
    console.error('Failed to load PE dashboard data', err);
    const view = $('view-sp');
    if (view) view.innerHTML = `<div style="padding:20px;color:var(--red);text-align:center">
      Failed to load data. Try refreshing the page. Error: ${err.message || err}
    </div>`;
  });
})();
