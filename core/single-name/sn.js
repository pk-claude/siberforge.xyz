/* ========================================================================
   sn.js -- single-name research page engine.
   Reads /core/single-name/data/<T>.json (pipeline: EDGAR XBRL + Yahoo)
   and <T>.research.json (analyst layer), renders fundamentals charts,
   the valuation lab (reverse DCF / adjustable DCF / revenue-path mode),
   peer comps, and the written research sections.
   ======================================================================== */
(function () {
  'use strict';

  const T = document.body.getAttribute('data-ticker');
  const BASE = '/core/single-name/data';

  // ---------------- formatters ----------------
  const $ = (id) => document.getElementById(id);
  function fmtB(v) {
    if (v == null || !isFinite(v)) return '—';
    const a = Math.abs(v), s = v < 0 ? '-' : '';
    if (a >= 1e12) return s + '$' + (a / 1e12).toFixed(2) + 'T';
    if (a >= 1e9)  return s + '$' + (a / 1e9).toFixed(1) + 'B';
    if (a >= 1e6)  return s + '$' + (a / 1e6).toFixed(0) + 'M';
    return s + '$' + a.toFixed(0);
  }
  const fmtPct  = (v, d) => v == null ? '—' : (v * 100).toFixed(d == null ? 1 : d) + '%';
  const fmtX    = (v) => (v == null || !isFinite(v) || v <= 0) ? '—' : v.toFixed(1) + 'x';
  const fmtPx   = (v) => v == null ? '—' : '$' + v.toFixed(2);
  const esc     = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const cssVar  = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888';

  // ---------------- svg chart helpers ----------------
  // Grouped bar chart with optional right-axis percent line.
  function barChart(rows, opts) {
    const W = 960, H = 300, padL = 56, padR = opts.line ? 52 : 14, padT = 14, padB = 34;
    const iw = W - padL - padR, ih = H - padT - padB;
    const series = opts.series; // [{key,name,color}]
    let vmax = 0, vmin = 0;
    rows.forEach(r => series.forEach(s => {
      const v = r[s.key]; if (v == null) return;
      vmax = Math.max(vmax, v); vmin = Math.min(vmin, v);
    }));
    if (vmax === 0 && vmin === 0) return '';
    const span = (vmax - vmin) || 1;
    const y = (v) => padT + ih - ((v - vmin) / span) * ih;
    const y0 = y(0);
    const gw = iw / rows.length;
    const bw = Math.min(26, (gw * 0.72) / series.length);
    const lineCol = cssVar('--line'), mutedCol = cssVar('--muted');

    let g = '';
    // gridlines: 4 ticks
    for (let i = 0; i <= 4; i++) {
      const v = vmin + span * i / 4, yy = y(v);
      g += `<line x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}" stroke="${lineCol}" stroke-width="1" opacity="0.5"/>`;
      g += `<text x="${padL - 6}" y="${yy + 4}" text-anchor="end" font-size="11" fill="${mutedCol}">${fmtB(v)}</text>`;
    }
    // bars
    rows.forEach((r, i) => {
      const cx = padL + gw * i + gw / 2;
      series.forEach((s, j) => {
        const v = r[s.key]; if (v == null) return;
        const x = cx - (series.length * bw) / 2 + j * bw;
        const yy = y(Math.max(0, v)), hh = Math.abs(y(v) - y0);
        g += `<rect x="${x.toFixed(1)}" y="${(v >= 0 ? yy : y0).toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${Math.max(hh, 0.5).toFixed(1)}" fill="${s.color}" rx="1.5"><title>${esc(r.end)} ${esc(s.name)}: ${fmtB(v)}</title></rect>`;
      });
      // x labels (thin out)
      const step = Math.ceil(rows.length / 12);
      if (i % step === 0) {
        g += `<text x="${cx}" y="${H - 12}" text-anchor="middle" font-size="11" fill="${mutedCol}">${esc(opts.short ? r.end.slice(2) : r.end)}</text>`;
      }
    });
    // percent line on right axis
    if (opts.line) {
      const lv = rows.map(r => r[opts.line.key]);
      const lmax = Math.max(...lv.filter(v => v != null), 0.01);
      const lmin = Math.min(...lv.filter(v => v != null), 0);
      const lspan = (lmax - lmin) || 1;
      const ly = (v) => padT + ih - ((v - lmin) / lspan) * ih;
      let d = '', started = false;
      rows.forEach((r, i) => {
        const v = r[opts.line.key]; if (v == null) return;
        const cx = padL + gw * i + gw / 2;
        d += (started ? 'L' : 'M') + cx.toFixed(1) + ',' + ly(v).toFixed(1);
        started = true;
      });
      g += `<path d="${d}" fill="none" stroke="${opts.line.color}" stroke-width="2"/>`;
      for (let i = 0; i <= 2; i++) {
        const v = lmin + lspan * i / 2;
        g += `<text x="${W - padR + 6}" y="${ly(v) + 4}" font-size="11" fill="${opts.line.color}">${fmtPct(v, 0)}</text>`;
      }
    }
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${g}</svg>`;
  }

  // Simple time-series line chart (P/E band).
  function lineChart(pts, opts) {
    const W = 960, H = 240, padL = 46, padR = 14, padT = 12, padB = 28;
    const iw = W - padL - padR, ih = H - padT - padB;
    const vals = pts.map(p => p.v);
    const vmax = Math.max(...vals) * 1.05, vmin = Math.min(0, Math.min(...vals));
    const span = (vmax - vmin) || 1;
    const x = (i) => padL + (i / (pts.length - 1)) * iw;
    const y = (v) => padT + ih - ((v - vmin) / span) * ih;
    const lineCol = cssVar('--line'), mutedCol = cssVar('--muted');
    let g = '';
    for (let i = 0; i <= 4; i++) {
      const v = vmin + span * i / 4, yy = y(v);
      g += `<line x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}" stroke="${lineCol}" opacity="0.5"/>`;
      g += `<text x="${padL - 6}" y="${yy + 4}" text-anchor="end" font-size="11" fill="${mutedCol}">${v.toFixed(0)}x</text>`;
    }
    // median dashed
    const sorted = [...vals].sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)];
    g += `<line x1="${padL}" y1="${y(med)}" x2="${W - padR}" y2="${y(med)}" stroke="${mutedCol}" stroke-dasharray="4 4"/>`;
    g += `<text x="${W - padR - 4}" y="${y(med) - 5}" text-anchor="end" font-size="11" fill="${mutedCol}">median ${med.toFixed(0)}x</text>`;
    let d = '';
    pts.forEach((p, i) => { d += (i ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(p.v).toFixed(1); });
    g += `<path d="${d}" fill="none" stroke="${opts.color}" stroke-width="2"/>`;
    const lp = pts[pts.length - 1];
    g += `<circle cx="${x(pts.length - 1)}" cy="${y(lp.v)}" r="4" fill="${opts.color}"/>`;
    g += `<text x="${x(pts.length - 1) - 8}" y="${y(lp.v) - 8}" text-anchor="end" font-size="12" font-weight="600" fill="${opts.color}">${lp.v.toFixed(1)}x</text>`;
    const step = Math.ceil(pts.length / 8);
    pts.forEach((p, i) => {
      if (i % step === 0) g += `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="${mutedCol}">${esc(p.t)}</text>`;
    });
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${g}</svg>`;
  }

  // ---------------- DCF math ----------------
  // PV of FCF stream: constant growth g for N years, terminal g gT, discount r.
  function pvConstant(fcf0, g, r, gT, N) {
    let pv = 0, f = fcf0;
    for (let t = 1; t <= N; t++) { f *= (1 + g); pv += f / Math.pow(1 + r, t); }
    if (r > gT) pv += (f * (1 + gT)) / (r - gT) / Math.pow(1 + r, N);
    return pv;
  }
  // PV with growth fading linearly from g to gT over N years.
  function pvFade(fcf0, g, r, gT, N) {
    let pv = 0, f = fcf0;
    for (let t = 1; t <= N; t++) {
      const gt = N === 1 ? g : g + (gT - g) * (t - 1) / (N - 1);
      f *= (1 + gt); pv += f / Math.pow(1 + r, t);
    }
    if (r > gT) pv += (f * (1 + gT)) / (r - gT) / Math.pow(1 + r, N);
    return pv;
  }
  function solveImpliedG(targetEV, fcf0, r, gT, N) {
    let lo = -0.9, hi = 3.0;
    if (pvConstant(fcf0, hi, r, gT, N) < targetEV) return null;
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      (pvConstant(fcf0, mid, r, gT, N) < targetEV) ? lo = mid : hi = mid;
    }
    return (lo + hi) / 2;
  }
  function solveImpliedRevCagr(targetEV, rev0, margin, r, gT, N) {
    let lo = -0.5, hi = 3.0;
    const ev = (c) => {
      const revN = rev0 * Math.pow(1 + c, N);
      const fcfN = revN * margin;
      return r > gT ? (fcfN * (1 + gT)) / (r - gT) / Math.pow(1 + r, N) : 0;
    };
    if (ev(hi) < targetEV) return null;
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      (ev(mid) < targetEV) ? lo = mid : hi = mid;
    }
    return (lo + hi) / 2;
  }

  // ---------------- render helpers ----------------
  function ul(items) { return '<ul class="sn-ul">' + (items || []).map(i => '<li>' + esc(i) + '</li>').join('') + '</ul>'; }
  function labRow(id, label, min, max, step, val, fmt) {
    return `<div class="lab-row"><label for="${id}">${label}</label>
      <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}">
      <span class="lab-val" id="${id}-v">${fmt(val)}</span></div>`;
  }
  const pctFmt = (v) => (v * 100).toFixed(1) + '%';
  const yrFmt = (v) => v + 'y';
  const xFmt = (v) => v.toFixed(0) + 'x';

  // ---------------- main ----------------
  async function boot() {
    const root = $('sn-root');
    let D, R;
    try {
      [D, R] = await Promise.all([
        fetch(`${BASE}/${T}.json`).then(r => r.json()),
        fetch(`${BASE}/${T}.research.json`).then(r => r.ok ? r.json() : null),
      ]);
    } catch (e) {
      root.innerHTML = '<p class="sn-note">Failed to load data for ' + esc(T) + '.</p>';
      return;
    }
    R = R || {};
    const S = D.snapshot || {};
    const px = S.px, mc = S.mc, ev = S.ev || mc;
    const netDebt = (ev != null && mc != null) ? ev - mc : 0;
    const shares = (mc && px) ? mc / px : null;
    const fcfTtm = D.ttm && D.ttm.fcf;
    const revTtm = (D.ttm && D.ttm.revenue) || S.rev;
    const evs = (ev && revTtm) ? ev / revTtm : null;
    const evE = (ev && S.ebitda > 0) ? ev / S.ebitda : null;
    const fcfYield = (fcfTtm != null && mc) ? fcfTtm / mc : null;
    const accent = cssVar('--accent'), green = cssVar('--green'),
          red = cssVar('--red'), blue = cssVar('--blue') || accent;

    // ---- hero + quote ----
    let html = `
    <section class="sn-hero">
      <h1>${esc(D.name)}</h1><span class="sn-tk">${esc(D.ticker)}</span>
      <span class="sn-tags"><span class="sn-tag">${esc(D.sector || '')}</span><span class="sn-tag">${esc(D.industry || '')}</span></span>
    </section>
    <div class="sn-quote">
      <span class="sn-px" id="q-px">${fmtPx(px)}</span>
      <span class="sn-chg" id="q-chg"></span>
      <span class="q-meta">Mkt cap ${fmtB(mc)}</span>
      <span class="q-meta">EV ${fmtB(ev)}</span>
      <span class="q-meta">52w ${fmtPx(S.l52)} – ${fmtPx(S.h52)}</span>
      <span class="q-meta sn-asof" id="q-asof">data as of ${esc(D.asOf)}</span>
    </div>`;
    if (R.oneLiner) html += `<p class="sn-lede">${esc(R.oneLiner)}</p>`;

    // ---- stat chips ----
    const chips = [
      ['Fwd P/E', fmtX(S.fpe)], ['Trailing P/E', fmtX(S.tpe)],
      ['EV / Sales', fmtX(evs)], ['EV / EBITDA', fmtX(evE)],
      ['FCF yield', fcfYield == null ? '—' : fmtPct(fcfYield)],
      ['Gross margin', fmtPct(S.gm)], ['Op margin', fmtPct(S.om)],
      ['Rev growth', fmtPct(S.rg)], ['P/B', fmtX(S.pb)], ['Beta', S.beta == null ? '—' : S.beta.toFixed(2)],
    ];
    html += '<div class="sn-stats">' + chips.map(c =>
      `<div class="sn-stat"><span class="k">${c[0]}</span><span class="v">${c[1]}</span></div>`).join('') + '</div>';

    // ---- scenarios ----
    if (R.scenarios) {
      html += `<section class="sn-sec"><h2>Bear / Base / Bull</h2><div class="sn-scenarios">
        <div class="sn-scen bear"><h4>Bear</h4><p>${esc(R.scenarios.bear)}</p></div>
        <div class="sn-scen base"><h4>Base</h4><p>${esc(R.scenarios.base)}</p></div>
        <div class="sn-scen bull"><h4>Bull</h4><p>${esc(R.scenarios.bull)}</p></div>
      </div></section>`;
    }

    // ---- thesis + latest quarter ----
    if (R.thesis || R.latestQuarter) {
      html += '<section class="sn-sec"><div class="sn-cols2">';
      if (R.thesis) html += `<div><h2>Thesis</h2>${ul(R.thesis)}</div>`;
      if (R.latestQuarter) html += `<div><h2>Latest quarter</h2><div class="sn-card"><h4>${esc(R.latestQuarter.label)}</h4>${ul(R.latestQuarter.points)}</div></div>`;
      html += '</div></section>';
    }

    // ---- fundamentals charts ----
    html += '<section class="sn-sec"><h2>Fundamentals</h2>';
    if (D.fxNote) html += `<p class="sn-note">${esc(D.fxNote)}.</p>`;
    const annRows = (D.annual || []).filter(r => r.revenue != null).map(r => ({
      ...r, nm: (r.netIncome != null && r.revenue) ? r.netIncome / r.revenue : null,
    }));
    if (annRows.length > 1) {
      html += `<div class="sn-chart"><h3>Annual revenue &amp; free cash flow</h3>
        <div class="c-sub">${annRows[0].end} – ${annRows[annRows.length - 1].end} · fiscal years, from EDGAR 10-K filings where available</div>
        ${barChart(annRows, { series: [
          { key: 'revenue', name: 'Revenue', color: accent },
          { key: 'fcf', name: 'FCF', color: green }],
          line: { key: 'nm', color: blue }, short: true })}
        <div class="sn-legend"><span><span class="sw" style="background:${accent}"></span>Revenue</span>
          <span><span class="sw" style="background:${green}"></span>Free cash flow</span>
          <span><span class="sw" style="background:${blue}"></span>Net margin (right)</span></div></div>`;
    }
    const qRows = (D.quarterly || []).filter(r => r.revenue != null).map(r => ({
      ...r, nm: (r.netIncome != null && r.revenue) ? r.netIncome / r.revenue : null,
    }));
    if (qRows.length > 1) {
      html += `<div class="sn-chart"><h3>Quarterly revenue &amp; net income</h3>
        <div class="c-sub">standalone quarters rebuilt by YTD differencing of 10-Q filings where available</div>
        ${barChart(qRows, { series: [
          { key: 'revenue', name: 'Revenue', color: accent },
          { key: 'netIncome', name: 'Net income', color: green }], short: true })}
        <div class="sn-legend"><span><span class="sw" style="background:${accent}"></span>Revenue</span>
          <span><span class="sw" style="background:${green}"></span>Net income</span></div></div>`;
    }
    // P/E band: monthly price / TTM EPS
    const qe = (D.eps && D.eps.qe) || [];
    if (qe.length >= 4 && (D.prices || []).length > 12) {
      const epsAsc = [...qe].sort((a, b) => a[0].localeCompare(b[0]));
      const ttmAt = (ym) => {
        const done = epsAsc.filter(e => e[0].slice(0, 7) <= ym);
        if (done.length < 4) return null;
        return done.slice(-4).reduce((a, e) => a + e[1], 0);
      };
      const pts = [];
      for (const [ym, close] of D.prices) {
        const e = ttmAt(ym);
        if (e && e > 0) pts.push({ t: ym, v: close / e });
      }
      if (pts.length > 12) {
        html += `<div class="sn-chart"><h3>Trailing P/E, 6 years</h3>
          <div class="c-sub">monthly close divided by trailing-4Q diluted EPS</div>
          ${lineChart(pts, { color: accent })}</div>`;
      }
    }
    html += '</section>';

    // ---- valuation lab ----
    const VP = R.valPresets || { mode: (fcfTtm > 0 ? 'fcf' : 'revenue'), r: 0.10, gT: 0.03, years: 10 };
    // Basis: 'fcf' discounts TTM free cash flow against EV. 'fwdEps' discounts
    // forward earnings (mc / forward P/E) against market cap -- the right tool
    // when FCF is structurally depressed by a capex program (TSM, GOOGL).
    const basis = VP.basis || 'fcf';
    const useEps = basis === 'fwdEps' && S.fpe > 0 && mc;
    const flow0 = useEps ? mc / S.fpe : fcfTtm;
    const target = useEps ? mc : ev;
    const flowName = useEps ? 'forward earnings' : 'TTM FCF';
    const debtAdj = useEps ? 0 : netDebt;
    html += `<section class="sn-sec"><h2>Valuation lab</h2>
      <p class="sn-note">Interactive, assumption-driven. Presets come from the scenario work above; drag anything. All figures use EV ${fmtB(ev)}, net debt ${fmtB(netDebt)}, ${VP.mode === 'revenue' ? 'TTM revenue ' + fmtB(revTtm) : flowName + ' ' + fmtB(flow0)}. Not investment advice.</p>`;
    if (VP.note) html += `<p class="sn-note">${esc(VP.note)}</p>`;
    html += '<div class="sn-lab">';

    if (VP.mode === 'fcf' && flow0 > 0) {
      html += `<div class="lab-panel"><h3>Reverse DCF — what is priced in?</h3>
        <p class="lab-sub">Solves the constant ${flowName} growth rate over the horizon that makes discounted cash flows equal today's ${useEps ? 'market cap' : 'enterprise value'}.</p>
        ${labRow('rd-r', 'Discount rate', 0.06, 0.16, 0.0025, VP.r, pctFmt)}
        ${labRow('rd-gt', 'Terminal growth', 0, 0.05, 0.0025, VP.gT, pctFmt)}
        ${labRow('rd-n', 'Horizon (years)', 5, 15, 1, VP.years, yrFmt)}
        <div class="lab-out"><span class="big" id="rd-out">—</span>
        <div class="ctx" id="rd-ctx"></div></div></div>`;
      html += `<div class="lab-panel"><h3>DCF — your assumptions</h3>
        <p class="lab-sub">Growth fades linearly from your starting rate to the terminal rate over the horizon.</p>
        <div class="lab-presets">
          <button class="lab-preset bear" data-g="${VP.bear ? VP.bear.g : 0.05}">Bear</button>
          <button class="lab-preset" data-g="${VP.base ? VP.base.g : 0.12}">Base</button>
          <button class="lab-preset bull" data-g="${VP.bull ? VP.bull.g : 0.2}">Bull</button></div>
        ${labRow('fd-g', 'Growth (yr 1)', -0.2, 0.8, 0.005, VP.base ? VP.base.g : 0.12, pctFmt)}
        ${labRow('fd-r', 'Discount rate', 0.06, 0.16, 0.0025, VP.r, pctFmt)}
        ${labRow('fd-gt', 'Terminal growth', 0, 0.05, 0.0025, VP.gT, pctFmt)}
        ${labRow('fd-n', 'Horizon (years)', 5, 15, 1, VP.years, yrFmt)}
        <div class="lab-out"><span class="big" id="fd-out">—</span>
        <div class="ctx" id="fd-ctx"></div></div></div>`;
    } else {
      const p = VP.base || { revCagr: 0.4, fcfMargin: 0.15 };
      html += `<div class="lab-panel"><h3>Revenue path — what is priced in?</h3>
        <p class="lab-sub">FCF is negative or immature, so a cash-flow DCF is meaningless. This solves the revenue CAGR needed so that the terminal business (at your steady-state FCF margin) discounts back to today's enterprise value.</p>
        ${labRow('rv-m', 'Steady-state FCF margin', 0.02, 0.4, 0.005, p.fcfMargin, pctFmt)}
        ${labRow('rv-r', 'Discount rate', 0.08, 0.18, 0.0025, VP.r, pctFmt)}
        ${labRow('rv-gt', 'Terminal growth', 0, 0.05, 0.0025, VP.gT, pctFmt)}
        ${labRow('rv-n', 'Horizon (years)', 4, 10, 1, VP.years, yrFmt)}
        <div class="lab-out"><span class="big" id="rv-out">—</span>
        <div class="ctx" id="rv-ctx"></div></div></div>`;
      html += `<div class="lab-panel"><h3>Scenario value — your assumptions</h3>
        <p class="lab-sub">Pick a revenue CAGR, a margin at the horizon, and an exit multiple (what a still-growing business fetches then). Interim cash burn is ignored, so this is generous to the bull case.</p>
        <div class="lab-presets">
          <button class="lab-preset bear" data-c="${VP.bear ? VP.bear.revCagr : 0.2}" data-m="${VP.bear ? VP.bear.fcfMargin : 0.08}" data-x="${VP.bear && VP.bear.exit ? VP.bear.exit : 14}">Bear</button>
          <button class="lab-preset" data-c="${p.revCagr}" data-m="${p.fcfMargin}" data-x="${p.exit || 20}">Base</button>
          <button class="lab-preset bull" data-c="${VP.bull ? VP.bull.revCagr : 0.6}" data-m="${VP.bull ? VP.bull.fcfMargin : 0.22}" data-x="${VP.bull && VP.bull.exit ? VP.bull.exit : 28}">Bull</button></div>
        ${labRow('sv-c', 'Revenue CAGR', 0, 1.2, 0.01, p.revCagr, pctFmt)}
        ${labRow('sv-m', 'FCF margin at horizon', 0.02, 0.4, 0.005, p.fcfMargin, pctFmt)}
        ${labRow('sv-x', 'Exit EV/FCF multiple', 8, 40, 1, p.exit || 20, xFmt)}
        ${labRow('sv-r', 'Discount rate', 0.08, 0.18, 0.0025, VP.r, pctFmt)}
        ${labRow('sv-n', 'Horizon (years)', 4, 10, 1, VP.years, yrFmt)}
        <div class="lab-out"><span class="big" id="sv-out">—</span>
        <div class="ctx" id="sv-ctx"></div></div></div>`;
    }
    html += '</div></section>';

    // ---- peer comps ----
    const peers = (D.peers || []).filter(p => !p.err);
    if (peers.length > 1) {
      html += `<section class="sn-sec"><h2>Peer comparison</h2>
        <p class="sn-note">Live multiples from the same refresh. Caps in USD. Click a column to sort.</p>
        <div class="sn-table-wrap"><table class="sn-peers" id="peer-tbl"><thead><tr>
        <th data-k="t">Ticker</th><th data-k="n">Name</th><th data-k="mc">Mkt cap</th>
        <th data-k="fpe">Fwd P/E</th><th data-k="tpe">Trail P/E</th><th data-k="evs">EV/S</th>
        <th data-k="evEbitda">EV/EBITDA</th><th data-k="gm">Gross m.</th><th data-k="om">Op m.</th>
        <th data-k="rg">Rev gr.</th><th data-k="beta">Beta</th>
        </tr></thead><tbody id="peer-body"></tbody></table></div></section>`;
    }

    // ---- research sections ----
    const secs = [
      ['Business & segments', R.segments], ['Competitive landscape', R.competitive],
      ['Key risks', R.risks], ['Catalysts', R.catalysts],
    ];
    html += '<section class="sn-sec"><h2>Research notes</h2>';
    html += `<p class="sn-asof">Written ${esc(R.asOf || D.asOf)}. Ask for a refresh after major news or earnings.</p>`;
    if (R.moat) html += `<h3>Moat</h3><p class="sn-note" style="color:var(--text)">${esc(R.moat)}</p>`;
    for (const [title, items] of secs) {
      if (items && items.length) html += `<h3>${title}</h3>${ul(items)}`;
    }
    if (R.pricedIn) html += `<h3>What's priced in</h3><p class="sn-note" style="color:var(--text)">${esc(R.pricedIn)}</p>`;
    if (R.notes) html += `<p class="sn-note">${esc(R.notes)}</p>`;
    if (R.sources && R.sources.length) {
      html += '<h3>Key sources</h3><ul class="sn-ul sn-sources">' + R.sources.map(s =>
        `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a></li>`).join('') + '</ul>';
    }
    html += '</section>';

    root.innerHTML = html;

    // ---- peer table behaviour ----
    if (peers.length > 1) {
      const body = $('peer-body');
      let sortK = 'mc', sortDir = -1;
      const render = () => {
        const rows = [...peers].sort((a, b) => {
          const av = a[sortK], bv = b[sortK];
          if (typeof av === 'string') return String(av).localeCompare(String(bv)) * -sortDir;
          if (av == null) return 1; if (bv == null) return -1;
          return (av - bv) * sortDir;
        });
        body.innerHTML = rows.map(p => `<tr class="${p.t === T ? 'self' : ''}">
          <td>${esc(p.t)}</td><td>${esc(p.n || '')}</td><td>${fmtB(p.mc)}</td>
          <td>${fmtX(p.fpe)}</td><td>${fmtX(p.tpe)}</td><td>${fmtX(p.evs)}</td>
          <td>${fmtX(p.evEbitda)}</td><td>${fmtPct(p.gm)}</td><td>${fmtPct(p.om)}</td>
          <td>${fmtPct(p.rg)}</td><td>${p.beta == null ? '—' : p.beta.toFixed(2)}</td></tr>`).join('');
      };
      document.querySelectorAll('#peer-tbl th').forEach(th => th.addEventListener('click', () => {
        const k = th.getAttribute('data-k');
        sortDir = (sortK === k) ? -sortDir : -1; sortK = k;
        document.querySelectorAll('#peer-tbl th').forEach(h => h.classList.toggle('sorted', h === th));
        render();
      }));
      render();
    }

    // ---- valuation lab behaviour ----
    const bind = (ids, fn) => {
      const run = () => {
        ids.forEach(id => { const el = $(id); if (el) $(id + '-v').textContent = (id.endsWith('-n') ? yrFmt : id.endsWith('-x') ? xFmt : pctFmt)(parseFloat(el.value)); });
        fn();
      };
      ids.forEach(id => { const el = $(id); if (el) el.addEventListener('input', run); });
      run();
    };
    if (VP.mode === 'fcf' && flow0 > 0) {
      bind(['rd-r', 'rd-gt', 'rd-n'], () => {
        const r = +$('rd-r').value, gT = +$('rd-gt').value, N = +$('rd-n').value;
        const g = solveImpliedG(target, flow0, r, gT, N);
        $('rd-out').textContent = g == null ? 'n/a' : 'implied ' + flowName + ' growth: ' + pctFmt(g) + ' / yr';
        $('rd-ctx').textContent = g == null ? 'No constant growth rate below 300%/yr justifies the current price at these inputs.' :
          `The market needs ${pctFmt(g)} ${flowName} growth every year for ${N} years (then ${pctFmt(gT)} forever), discounted at ${pctFmt(r)}, to justify ${useEps ? 'market cap' : 'EV'} of ${fmtB(target)} on ${flowName} of ${fmtB(flow0)}.`;
      });
      const runFd = () => {
        const g = +$('fd-g').value, r = +$('fd-r').value, gT = +$('fd-gt').value, N = +$('fd-n').value;
        const pv = pvFade(flow0, g, r, gT, N);
        const eq = pv - debtAdj, ps = shares ? eq / shares : null;
        const up = (ps != null && px) ? ps / px - 1 : null;
        $('fd-out').innerHTML = ps == null ? fmtB(eq) :
          fmtPx(ps) + ' <span class="' + (up >= 0 ? 'up' : 'down') + '">(' + (up >= 0 ? '+' : '') + (up * 100).toFixed(0) + '%)</span>';
        $('fd-ctx').textContent = `Fair value per share vs ${fmtPx(px)} today. ${flowName} starts at ${fmtB(flow0)}, growth fades ${pctFmt(g)} → ${pctFmt(gT)} over ${N} years, ${pctFmt(r)} discount rate.`;
      };
      bind(['fd-g', 'fd-r', 'fd-gt', 'fd-n'], runFd);
      document.querySelectorAll('.lab-preset[data-g]').forEach(b => b.addEventListener('click', () => {
        $('fd-g').value = b.getAttribute('data-g');
        $('fd-g').dispatchEvent(new Event('input'));
      }));
    } else {
      bind(['rv-m', 'rv-r', 'rv-gt', 'rv-n'], () => {
        const m = +$('rv-m').value, r = +$('rv-r').value, gT = +$('rv-gt').value, N = +$('rv-n').value;
        const c = solveImpliedRevCagr(ev, revTtm, m, r, gT, N);
        $('rv-out').textContent = c == null ? 'n/a' : 'implied revenue CAGR: ' + pctFmt(c);
        $('rv-ctx').textContent = c == null ? 'No revenue CAGR below 300% justifies the current EV at these inputs.' :
          `Revenue must compound at ${pctFmt(c)} for ${N} years off ${fmtB(revTtm)} TTM, reaching a ${pctFmt(m)} FCF margin, to justify EV of ${fmtB(ev)} at a ${pctFmt(r)} discount rate.`;
      });
      const runSv = () => {
        const c = +$('sv-c').value, m = +$('sv-m').value, x = +$('sv-x').value,
              r = +$('sv-r').value, N = +$('sv-n').value;
        const revN = revTtm * Math.pow(1 + c, N);
        const fcfN = revN * m;
        const evN = fcfN * x;                      // exit EV at horizon
        const pv = evN / Math.pow(1 + r, N);
        const eq = pv - netDebt, ps = shares ? eq / shares : null;
        const up = (ps != null && px) ? ps / px - 1 : null;
        $('sv-out').innerHTML = ps == null ? fmtB(eq) :
          fmtPx(ps) + ' <span class="' + (up >= 0 ? 'up' : 'down') + '">(' + (up >= 0 ? '+' : '') + (up * 100).toFixed(0) + '%)</span>';
        $('sv-ctx').textContent = `Implied value per share vs ${fmtPx(px)} today. Revenue ${fmtB(revTtm)} → ${fmtB(revN)} over ${N} years (${pctFmt(c)}/yr); FCF ${fmtB(fcfN)} at a ${x.toFixed(0)}x exit = EV ${fmtB(evN)}, discounted at ${pctFmt(r)}, less net debt ${fmtB(netDebt)}.`;
      };
      bind(['sv-c', 'sv-m', 'sv-x', 'sv-r', 'sv-n'], runSv);
      document.querySelectorAll('.lab-preset[data-c]').forEach(b => b.addEventListener('click', () => {
        $('sv-c').value = b.getAttribute('data-c');
        $('sv-m').value = b.getAttribute('data-m');
        $('sv-x').value = b.getAttribute('data-x');
        $('sv-c').dispatchEvent(new Event('input'));
      }));
    }

    // ---- live quote (best effort; static snapshot price is the fallback) ----
    try {
      const q = await fetch(`/api/stocks?mode=quote&symbols=${T}`).then(r => r.ok ? r.json() : null);
      const row = q && (q.quotes ? q.quotes[0] : (Array.isArray(q) ? q[0] : null));
      if (row && row.price) {
        $('q-px').textContent = fmtPx(row.price);
        const el = $('q-chg');
        el.textContent = (row.changePct >= 0 ? '+' : '') + (row.changePct || 0).toFixed(2) + '%';
        el.classList.add(row.changePct >= 0 ? 'up' : 'down');
        $('q-asof').textContent = 'live quote · fundamentals as of ' + D.asOf;
      }
    } catch (e) { /* offline / file:// -- keep snapshot */ }
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
