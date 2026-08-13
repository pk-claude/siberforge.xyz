/* ========================================================================
   sn.js -- single-name research page engine, v2.
   Top-5 deep-dive visual language: KPI cards with peer bars, bull/bear
   columns with embedded mini-charts, annual trends grid with scenario
   projections to 2031E (Chart.js), valuation lab, peer comps.
   Data: /core/single-name/data/<T>.json (+ <T>.research.json).
   ======================================================================== */
(function () {
  'use strict';

  const T = document.body.getAttribute('data-ticker');
  const BASE = '/core/single-name/data';
  const PROJ_END = 2031;

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
  const fmtPct = (v, d) => v == null ? '—' : (v * 100).toFixed(d == null ? 1 : d) + '%';
  const fmtX   = (v) => (v == null || !isFinite(v) || v <= 0) ? '—' : v.toFixed(1) + 'x';
  const fmtPx  = (v) => v == null ? '—' : '$' + v.toFixed(2);
  const esc    = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const pctFmt = (v) => (v * 100).toFixed(1) + '%';
  const yrFmt  = (v) => v + 'y';
  const xFmt   = (v) => v.toFixed(0) + 'x';

  function themeC() {
    const g = (n, fb) => (getComputedStyle(document.documentElement).getPropertyValue(n).trim()) || fb;
    return {
      accent: g('--accent', '#f7a700'), good: g('--green', '#3ecf8e'), bad: g('--red', '#ef4f5a'),
      warn: g('--brand-amber', '#f0b35d'), ink: g('--text', '#e5e9ee'), ink2: g('--muted', '#8a94a3'),
      line: g('--line', '#222a37'), panel2: g('--panel-2', '#1a2028'), bg: g('--bg', '#0b0d10'),
    };
  }
  function hexa(hex, a) {
    let h = (hex || '').trim().replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const r = parseInt(h.slice(0, 2), 16) || 0, g = parseInt(h.slice(2, 4), 16) || 0, b = parseInt(h.slice(4, 6), 16) || 0;
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }
  function fmtVal(v, fmt) {
    if (v == null || !isFinite(v)) return '—';
    if (fmt === '%') return v.toFixed(1) + '%';
    if (fmt === '$') {
      const a = Math.abs(v);
      return (v < 0 ? '-$' : '$') + (a >= 100 ? a.toFixed(0) : a.toFixed(1)) + 'B';
    }
    if (fmt === 'px') return '$' + v.toFixed(2);
    return String(Math.round(v * 100) / 100);
  }
  function cagr(v0, v1, n) {
    if (v0 == null || v1 == null || v0 <= 0 || v1 <= 0 || n <= 0) return null;
    return Math.pow(v1 / v0, 1 / n) - 1;
  }

  // ---------------- DCF math (unchanged from v1) ----------------
  function pvConstant(f0, g, r, gT, N) {
    let pv = 0, f = f0;
    for (let t = 1; t <= N; t++) { f *= (1 + g); pv += f / Math.pow(1 + r, t); }
    if (r > gT) pv += (f * (1 + gT)) / (r - gT) / Math.pow(1 + r, N);
    return pv;
  }
  function pvFade(f0, g, r, gT, N) {
    let pv = 0, f = f0;
    for (let t = 1; t <= N; t++) {
      const gt = N === 1 ? g : g + (gT - g) * (t - 1) / (N - 1);
      f *= (1 + gt); pv += f / Math.pow(1 + r, t);
    }
    if (r > gT) pv += (f * (1 + gT)) / (r - gT) / Math.pow(1 + r, N);
    return pv;
  }
  function solveImpliedG(target, f0, r, gT, N) {
    let lo = -0.9, hi = 3.0;
    if (pvConstant(f0, hi, r, gT, N) < target) return null;
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      (pvConstant(f0, mid, r, gT, N) < target) ? lo = mid : hi = mid;
    }
    return (lo + hi) / 2;
  }
  function solveImpliedRevCagr(target, rev0, m, r, gT, N) {
    let lo = -0.5, hi = 3.0;
    const evAt = (c) => {
      const fcfN = rev0 * Math.pow(1 + c, N) * m;
      return r > gT ? (fcfN * (1 + gT)) / (r - gT) / Math.pow(1 + r, N) : 0;
    };
    if (evAt(hi) < target) return null;
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      (evAt(mid) < target) ? lo = mid : hi = mid;
    }
    return (lo + hi) / 2;
  }

  // ---------------- chart registry ----------------
  let charts = [];
  function destroyCharts() { charts.forEach(c => { try { c.destroy(); } catch (e) {} }); charts = []; }

  function stdTooltip(C) {
    return {
      backgroundColor: C.panel2, titleColor: C.ink, bodyColor: C.ink2,
      borderColor: C.line, borderWidth: 1, padding: 9, cornerRadius: 4, displayColors: false,
    };
  }

  // Trends-grid chart: actual solid / projected faded+dashed.
  function trendChart(canvas, metric, actualIdx, labels) {
    if (!window.Chart) return;
    const C = themeC();
    const isLine = metric.type === 'line';
    const barColors = metric.vals.map((v, i) =>
      i <= actualIdx ? (v >= 0 ? hexa(C.accent, 0.85) : hexa(C.bad, 0.85))
                     : (v >= 0 ? hexa(C.accent, 0.35) : hexa(C.bad, 0.35)));
    const cfg = {
      type: metric.type,
      data: { labels, datasets: [{
        data: metric.vals,
        backgroundColor: isLine ? hexa(C.accent, 0.10) : barColors,
        borderColor: isLine ? C.accent : metric.vals.map((v, i) => i <= actualIdx ? (v >= 0 ? C.accent : C.bad) : hexa(C.accent, 0.55)),
        borderWidth: isLine ? 2 : 1,
        fill: isLine, tension: isLine ? 0.32 : 0,
        pointBackgroundColor: isLine ? metric.vals.map((v, i) => i <= actualIdx ? C.accent : C.ink2) : undefined,
        pointBorderColor: isLine ? C.bg : undefined,
        pointRadius: isLine ? 3 : 0, pointHoverRadius: isLine ? 5 : 0,
        ...(isLine ? { segment: {
          borderDash: c => c.p1DataIndex > actualIdx ? [5, 4] : undefined,
          borderColor: c => c.p1DataIndex > actualIdx ? hexa(C.accent, 0.7) : C.accent,
        }} : {}),
      }]},
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: {
          legend: { display: false },
          tooltip: { ...stdTooltip(C), callbacks: {
            title: (items) => {
              const i = items[0].dataIndex;
              return labels[i] + (i <= actualIdx ? '  (actual)' : '  (projected)');
            },
            label: (item) => {
              const i = item.dataIndex, v = metric.vals[i];
              const main = fmtVal(v, metric.fmt);
              if (i === 0) return main;
              const prev = metric.vals[i - 1];
              if (prev == null) return main;
              if (metric.fmt === '%') {
                const d = v - prev;
                return main + '   ·   ' + (d >= 0 ? '+' : '') + d.toFixed(1) + 'pts YoY';
              }
              const d = (v - prev) / Math.abs(prev) * 100;
              return main + '   ·   ' + (d >= 0 ? '+' : '') + d.toFixed(1) + '% YoY';
            },
          }},
        },
        scales: {
          x: { ticks: { color: C.ink2, font: { size: 9 }, autoSkip: false, maxRotation: 0 }, grid: { display: false } },
          y: { ticks: { color: C.ink2, font: { size: 9 },
                callback: v => metric.fmt === '%' ? v + '%' : metric.fmt === 'px' ? '$' + v : '$' + v + 'B' },
               grid: { color: hexa(C.line, 0.6) } },
        },
      },
    };
    charts.push(new Chart(canvas.getContext('2d'), cfg));
  }

  // Mini bullet chart (quiet slate, inside bull/bear items).
  function bulletChart(canvas, spec) {
    if (!window.Chart) return;
    const C = themeC();
    const slate = '#64748b';
    const isLine = spec.ct === 'line';
    charts.push(new Chart(canvas.getContext('2d'), {
      type: spec.ct,
      data: { labels: spec.lab, datasets: [{
        data: spec.data,
        backgroundColor: hexa(slate, isLine ? 0.16 : 0.78),
        borderColor: slate, borderWidth: isLine ? 1.8 : 1,
        fill: isLine, tension: isLine ? 0.32 : 0,
        pointRadius: isLine ? 2 : 0, pointHoverRadius: isLine ? 4 : 0,
        pointBackgroundColor: slate, pointBorderColor: C.panel2,
      }]},
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        interaction: { mode: 'nearest', intersect: false, axis: 'x' },
        plugins: { legend: { display: false },
          tooltip: { ...stdTooltip(C), callbacks: {
            label: (item) => fmtVal(spec.data[item.dataIndex], spec.fmt) } } },
        scales: {
          x: { ticks: { color: C.ink2, font: { size: 8 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 6 }, grid: { display: false } },
          y: { ticks: { color: C.ink2, font: { size: 8 },
                callback: v => spec.fmt === '%' ? v + '%' : (spec.fmt === '$' ? '$' + v + 'B' : v) },
               grid: { color: hexa(C.line, 0.4) } },
        },
      },
    }));
  }

  // ---------------- data shaping ----------------
  function shapeAnnual(D) {
    const rows = (D.annual || []).filter(r => r.revenue != null).map(r => ({ ...r }));
    // Append a synthetic TTM point when the trailing twelve months have moved
    // materially past the last filed fiscal year (mid-cycle names like MU).
    const q = (D.quarterly || []).filter(r => r.revenue != null);
    if (rows.length && q.length >= 4) {
      const last4 = q.slice(-4);
      const sum = (k) => last4.every(r => r[k] != null) ? last4.reduce((a, r) => a + r[k], 0) : null;
      const ttmRev = sum('revenue');
      const lastFy = rows[rows.length - 1];
      if (ttmRev && Math.abs(ttmRev - lastFy.revenue) / lastFy.revenue > 0.08) {
        rows.push({
          end: 'TTM', ttm: true,
          revenue: ttmRev, grossProfit: sum('grossProfit'), opIncome: sum('opIncome'),
          netIncome: sum('netIncome'), cfo: sum('cfo'), capex: sum('capex'),
          fcf: sum('fcf') != null ? sum('fcf') : (sum('cfo') != null && sum('capex') != null ? sum('cfo') - sum('capex') : null),
        });
      }
    }
    for (const r of rows) {
      r.year = r.ttm ? null : parseInt(r.end.slice(0, 4), 10);
      r.gm = (r.grossProfit != null && r.revenue) ? r.grossProfit / r.revenue : null;
      r.om = (r.opIncome != null && r.revenue) ? r.opIncome / r.revenue : null;
      r.nm = (r.netIncome != null && r.revenue) ? r.netIncome / r.revenue : null;
      r.fm = (r.fcf != null && r.revenue) ? r.fcf / r.revenue : null;
      r.cm = (r.capex != null && r.revenue) ? r.capex / r.revenue : null;
    }
    for (let i = 1; i < rows.length; i++) {
      rows[i].revYoy = rows[i - 1].revenue ? (rows[i].revenue / rows[i - 1].revenue - 1) : null;
    }
    return rows;
  }

  function scenarioParams(VP, scen) {
    const p = (VP && VP[scen]) || {};
    const g0 = (p.g != null) ? p.g : (p.revCagr != null ? p.revCagr : 0.10);
    return { g0, gT: (VP && VP.gT) || 0.03, fcfM: p.fcfMargin || null };
  }

  function project(rows, VP, scen) {
    if (!rows.length) return { labels: [], vals: {}, actualIdx: rows.length - 1 };
    const last = rows[rows.length - 1];
    const lastFyYear = last.ttm ? rows[rows.length - 2].year : last.year;
    const nProj = Math.max(0, PROJ_END - lastFyYear);
    const { g0, gT, fcfM } = scenarioParams(VP, scen);
    const out = [];
    let rev = last.revenue;
    const fm0 = last.fm != null ? last.fm : 0;
    for (let t = 1; t <= nProj; t++) {
      const gt = nProj === 1 ? g0 : g0 + (gT - g0) * (t - 1) / (nProj - 1);
      rev = rev * (1 + gt);
      // margins held at last actual; FCF margin ramps toward target for
      // pre-FCF names (fcfM set in revenue-mode presets)
      const fmT = (fcfM != null && fm0 < fcfM) ? fm0 + (fcfM - fm0) * (t / nProj) : fm0;
      out.push({
        end: (lastFyYear + t) + 'E', proj: true, revenue: rev, revYoy: gt,
        gm: last.gm, om: last.om, nm: last.nm, cm: last.cm,
        grossProfit: last.gm != null ? rev * last.gm : null,
        opIncome: last.om != null ? rev * last.om : null,
        netIncome: last.nm != null ? rev * last.nm : null,
        fcf: rev * fmT, fm: fmT,
        capex: last.cm != null ? rev * last.cm : null,
      });
    }
    return out;
  }

  // ---------------- bullet-chart metric resolvers ----------------
  function metricSpec(key, D, ann) {
    const A = ann.filter(r => !r.proj);
    const q = (D.quarterly || []).filter(r => r.revenue != null).slice(-8);
    const yl = (rows) => rows.map(r => r.ttm ? 'TTM' : String(r.end).slice(0, 4));
    const ql = (rows) => rows.map(r => r.end);
    const b9 = (v) => v == null ? null : v / 1e9;
    const peers = (D.peers || []).filter(p => !p.err);
    switch (key) {
      case 'revA':  return { cap: 'Annual revenue ($B)', ct: 'bar', lab: yl(A.slice(-8)), data: A.slice(-8).map(r => b9(r.revenue)), fmt: '$' };
      case 'niA':   return { cap: 'Annual net income ($B)', ct: 'bar', lab: yl(A.slice(-8)), data: A.slice(-8).map(r => b9(r.netIncome)), fmt: '$' };
      case 'fcfA':  return { cap: 'Annual free cash flow ($B)', ct: 'bar', lab: yl(A.slice(-8)), data: A.slice(-8).map(r => b9(r.fcf)), fmt: '$' };
      case 'capexA':return { cap: 'Annual capex ($B)', ct: 'bar', lab: yl(A.slice(-8)), data: A.slice(-8).map(r => b9(r.capex)), fmt: '$' };
      case 'revQ':  return { cap: 'Quarterly revenue ($B)', ct: 'bar', lab: ql(q), data: q.map(r => b9(r.revenue)), fmt: '$' };
      case 'niQ':   return { cap: 'Quarterly net income ($B)', ct: 'bar', lab: ql(q), data: q.map(r => b9(r.netIncome)), fmt: '$' };
      case 'fcfQ':  return { cap: 'Quarterly FCF ($B)', ct: 'bar', lab: ql(q), data: q.map(r => r.fcf != null ? b9(r.fcf) : (r.cfo != null && r.capex != null ? b9(r.cfo - r.capex) : null)), fmt: '$' };
      case 'gmA':   return { cap: 'Gross margin (%)', ct: 'line', lab: yl(A.slice(-8)), data: A.slice(-8).map(r => r.gm != null ? r.gm * 100 : null), fmt: '%' };
      case 'omA':   return { cap: 'Operating margin (%)', ct: 'line', lab: yl(A.slice(-8)), data: A.slice(-8).map(r => r.om != null ? r.om * 100 : null), fmt: '%' };
      case 'revYoyA': return { cap: 'Revenue YoY growth (%)', ct: 'line', lab: yl(A.slice(-8)), data: A.slice(-8).map(r => r.revYoy != null ? r.revYoy * 100 : null), fmt: '%' };
      case 'capexPctA': return { cap: 'Capex % of revenue', ct: 'line', lab: yl(A.slice(-8)), data: A.slice(-8).map(r => r.cm != null ? r.cm * 100 : null), fmt: '%' };
      case 'priceH': return { cap: 'Share price, 6y', ct: 'line', lab: (D.prices || []).map(p => p[0]), data: (D.prices || []).map(p => p[1]), fmt: 'x' };
      case 'peerFpe': return { cap: 'Forward P/E vs peers', ct: 'bar', lab: peers.map(p => p.t), data: peers.map(p => p.fpe), fmt: 'x' };
      case 'peerEvS': return { cap: 'EV / Sales vs peers', ct: 'bar', lab: peers.map(p => p.t), data: peers.map(p => p.evs), fmt: 'x' };
      case 'peerGm':  return { cap: 'Gross margin vs peers (%)', ct: 'bar', lab: peers.map(p => p.t), data: peers.map(p => p.gm != null ? p.gm * 100 : null), fmt: '%' };
      case 'peerRg':  return { cap: 'Revenue growth vs peers (%)', ct: 'bar', lab: peers.map(p => p.t), data: peers.map(p => p.rg != null ? p.rg * 100 : null), fmt: '%' };
      default: return null;
    }
  }

  // ---------------- HTML builders ----------------
  function kpiCompare(cap, rows, fmt) {
    if (!rows.length) return '';
    const max = Math.max(...rows.map(r => r.v || 0));
    if (!(max > 0)) return '';
    let h = '<div class="kpi-compare"><div class="kpi-compare-cap">' + esc(cap) + '</div>';
    for (const r of rows) {
      const self = r.t === T ? ' self' : '';
      h += '<div class="kpi-compare-row"><span class="kpi-compare-tk' + self + '">' + esc(r.t) + '</span>'
        + '<span class="kpi-compare-bar"><span class="kpi-compare-fill' + self + '" style="width:' + Math.max(3, r.v / max * 100).toFixed(0) + '%"></span></span>'
        + '<span class="kpi-compare-val' + self + '">' + fmt(r.v) + '</span></div>';
    }
    return h + '</div>';
  }

  function thesisItems(items, chartMap, side) {
    let h = '';
    (items || []).forEach((txt, i) => {
      const dot = txt.indexOf('.');
      const head = dot > 0 && dot < 90 ? txt.slice(0, dot + 1) : '';
      const rest = head ? txt.slice(dot + 1).trim() : txt;
      h += '<li><strong>' + esc(head || '') + '</strong> ' + esc(rest);
      const mets = (chartMap || {})[String(i)] || [];
      if (mets.length) {
        h += '<div class="bullet-charts">';
        mets.forEach((m, j) => {
          h += '<div class="bc-block"><div class="bc-title" id="bct-' + side + '-' + i + '-' + j + '"></div>'
            + '<div class="bc-wrap"><canvas data-bc="' + m + '" id="bc-' + side + '-' + i + '-' + j + '"></canvas></div></div>';
        });
        h += '</div>';
      }
      h += '</li>';
    });
    return h;
  }

  // ---------------- main ----------------
  let D = null, R = null, ANN = [], scen = 'base';

  function buildTrends() {
    const grid = $('trends-grid');
    if (!grid) return;
    // drop chart instances belonging to the grid
    charts = charts.filter(c => {
      const el = c.canvas;
      if (el && el.getAttribute('data-trend')) { try { c.destroy(); } catch (e) {} return false; }
      return true;
    });
    const proj = project(ANN, R.valPresets, scen);
    const all = [...ANN, ...proj];
    const labels = all.map(r => r.ttm ? 'TTM' : (r.proj ? r.end : String(r.end).slice(0, 4)));
    const actualIdx = ANN.length - 1;
    const b9 = (v) => v == null ? null : Math.round(v / 1e8) / 10;
    const METRICS = [
      { key: 'revenue', title: 'Total revenue ($B)', type: 'bar', fmt: '$', vals: all.map(r => b9(r.revenue)) },
      { key: 'revYoy', title: 'Revenue YoY growth (%)', type: 'line', fmt: '%', vals: all.map(r => r.revYoy != null ? r.revYoy * 100 : null) },
      { key: 'gm', title: 'Gross margin (%)', type: 'line', fmt: '%', vals: all.map(r => r.gm != null ? r.gm * 100 : null) },
      { key: 'om', title: 'Operating margin (%)', type: 'line', fmt: '%', vals: all.map(r => r.om != null ? r.om * 100 : null) },
      { key: 'opIncome', title: 'Operating income ($B)', type: 'bar', fmt: '$', vals: all.map(r => b9(r.opIncome)) },
      { key: 'netIncome', title: 'Net income ($B)', type: 'bar', fmt: '$', vals: all.map(r => b9(r.netIncome)) },
      { key: 'fcf', title: 'Free cash flow ($B)', type: 'bar', fmt: '$', vals: all.map(r => b9(r.fcf)) },
      { key: 'capex', title: 'Capex ($B)', type: 'bar', fmt: '$', vals: all.map(r => b9(r.capex)) },
      { key: 'cm', title: 'Capex % of revenue', type: 'line', fmt: '%', vals: all.map(r => r.cm != null ? r.cm * 100 : null) },
    ].filter(m => m.vals.slice(0, actualIdx + 1).some(v => v != null));

    let h = '';
    METRICS.forEach((m, i) => {
      // footer stats
      const firstIdx = m.vals.findIndex(v => v != null);
      const first = m.vals[firstIdx], lastAct = m.vals[actualIdx], lastProj = m.vals[m.vals.length - 1];
      const y0 = labels[firstIdx], yA = labels[actualIdx];
      let foot = '<div><span class="lbl">' + esc(y0) + ':</span> <span class="val">' + fmtVal(first, m.fmt) + '</span></div>'
               + '<div><span class="lbl">' + esc(yA) + ':</span> <span class="val">' + fmtVal(lastAct, m.fmt) + '</span></div>';
      if (m.fmt === '$') {
        const c1 = cagr(first, lastAct, actualIdx - firstIdx);
        const c2 = cagr(lastAct, lastProj, m.vals.length - 1 - actualIdx);
        foot += '<div><span class="lbl">CAGR ' + esc(y0) + '&rarr;' + esc(yA) + ':</span> <span class="val ' + (c1 >= 0 ? 'pos-v' : 'neg-v') + '">' + (c1 == null ? '—' : (c1 >= 0 ? '+' : '') + (c1 * 100).toFixed(1) + '%') + '</span></div>';
        foot += '<div><span class="lbl">CAGR ' + esc(yA) + '&rarr;' + PROJ_END + 'E:</span> <span class="val ' + (c2 >= 0 ? 'pos-v' : 'neg-v') + '">' + (c2 == null ? '—' : (c2 >= 0 ? '+' : '') + (c2 * 100).toFixed(1) + '%') + '</span></div>';
      } else {
        const d = (lastProj != null && lastAct != null) ? lastProj - lastAct : null;
        foot += '<div><span class="lbl">' + PROJ_END + 'E:</span> <span class="val">' + fmtVal(lastProj, m.fmt) + '</span></div>';
        foot += '<div><span class="lbl">&Delta; act&rarr;proj:</span> <span class="val ' + (d >= 0 ? 'pos-v' : 'neg-v') + '">' + (d == null ? '—' : (d >= 0 ? '+' : '') + d.toFixed(1) + 'pts') + '</span></div>';
      }
      h += '<div class="chart-block"><div class="chart-title">' + esc(m.title) + '</div>'
        + '<div class="chart-canvas-wrap"><canvas data-trend="1" id="tr-' + i + '"></canvas></div>'
        + '<div class="yoy-foot">' + foot + '</div></div>';
    });
    grid.innerHTML = h;
    METRICS.forEach((m, i) => { const c = $('tr-' + i); if (c) trendChart(c, m, actualIdx, labels); });
  }

  function setScenario(s, syncLab) {
    scen = s;
    document.querySelectorAll('.period-btn[data-scen]').forEach(b =>
      b.classList.toggle('active', b.getAttribute('data-scen') === s));
    buildTrends();
    if (syncLab !== false) {
      const VP = R.valPresets || {};
      const p = VP[s] || {};
      if ($('fd-g') && p.g != null) { $('fd-g').value = p.g; $('fd-g').dispatchEvent(new Event('input')); }
      if ($('sv-c') && p.revCagr != null) {
        $('sv-c').value = p.revCagr;
        if (p.fcfMargin != null) $('sv-m').value = p.fcfMargin;
        if (p.exit != null && $('sv-x')) $('sv-x').value = p.exit;
        $('sv-c').dispatchEvent(new Event('input'));
      }
    }
    try {
      const u = new URL(location.href); u.searchParams.set('scenario', s);
      history.replaceState(null, '', u);
    } catch (e) {}
  }

  // ---------------- ETF variant ----------------
  function renderEtf(root, D, R) {
    const S = D.snapshot || {};
    const prices = D.prices || [];
    const last = prices.length ? prices[prices.length - 1][1] : null;
    const back = (m) => prices.length > m ? prices[prices.length - 1 - m][1] : null;
    const cagrN = (m, yrs) => {
      const b = back(m);
      return (b && last) ? Math.pow(last / b, 1 / yrs) - 1 : null;
    };
    const r1 = (back(12) && last) ? last / back(12) - 1 : null;

    let h = '<section class="sn-sec">'
      + '<div class="tk-header"><span class="tk">' + esc(D.ticker) + '</span>'
      + '<span class="nm">' + esc(D.name) + ' &middot; ETF</span>'
      + '<span class="price" id="q-px">' + fmtPx(S.px) + '</span>'
      + '<span class="change">52w ' + fmtPx(S.l52) + ' - ' + fmtPx(S.h52) + '</span></div>';
    if (R.oneLiner) h += '<p class="sn-lede">' + esc(R.oneLiner) + '</p>';

    h += '<div class="kpi-grid">'
      + '<div class="kpi"><div class="lbl">Net assets</div><div class="val">' + fmtB(S.netAssets) + '</div></div>'
      + '<div class="kpi"><div class="lbl">Expense ratio</div><div class="val">' + (S.expenseRatio != null ? (S.expenseRatio * 100).toFixed(2) + '%' : '—') + '</div></div>'
      + '<div class="kpi"><div class="lbl">Yield</div><div class="val">' + fmtPct(S.yield) + '</div></div>'
      + '<div class="kpi"><div class="lbl">1y return</div><div class="val ' + (r1 >= 0 ? '' : 'warn') + '">' + fmtPct(r1, 0) + '</div></div>'
      + '<div class="kpi"><div class="lbl">3y CAGR</div><div class="val">' + fmtPct(cagrN(36, 3), 0) + '</div></div>'
      + '<div class="kpi"><div class="lbl">5y CAGR</div><div class="val">' + fmtPct(cagrN(60, 5), 0) + '</div></div>'
      + '<div class="kpi"><div class="lbl">Holdings P/E</div><div class="val">' + fmtX(S.pe) + '</div></div>'
      + '</div>';
    if (R.profile && R.profile.topHoldingsNote) h += '<p class="sn-note">' + esc(R.profile.topHoldingsNote) + '</p>';
    h += '</section>';

    // holdings + sectors
    h += '<section class="sn-sec"><h2>Composition</h2><div class="col-2"><div>'
      + '<h3>Top holdings</h3><div class="kpi-compare" style="border-top:none;padding-top:0">';
    const maxH = Math.max(...(S.holdings || []).map(x => x.pct || 0), 0.001);
    for (const hd of S.holdings || []) {
      h += '<div class="kpi-compare-row" style="grid-template-columns:64px 1fr 56px">'
        + '<span class="kpi-compare-tk">' + esc(hd.t || '') + '</span>'
        + '<span class="kpi-compare-bar" style="height:8px"><span class="kpi-compare-fill" style="width:' + Math.max(2, (hd.pct || 0) / maxH * 100).toFixed(0) + '%"></span></span>'
        + '<span class="kpi-compare-val">' + ((hd.pct || 0) * 100).toFixed(1) + '%</span></div>';
    }
    h += '</div></div><div><h3>Sector weights</h3><div class="kpi-compare" style="border-top:none;padding-top:0">';
    const secs = (S.sectors || []).filter(x => x.pct > 0.001).sort((a, b) => b.pct - a.pct);
    const maxS = Math.max(...secs.map(x => x.pct), 0.001);
    for (const sw of secs) {
      const nm = sw.name.replace(/_/g, ' ');
      h += '<div class="kpi-compare-row" style="grid-template-columns:130px 1fr 56px">'
        + '<span class="kpi-compare-tk">' + esc(nm) + '</span>'
        + '<span class="kpi-compare-bar" style="height:8px"><span class="kpi-compare-fill" style="width:' + Math.max(2, sw.pct / maxS * 100).toFixed(0) + '%"></span></span>'
        + '<span class="kpi-compare-val">' + (sw.pct * 100).toFixed(1) + '%</span></div>';
    }
    h += '</div></div></div>';
    if (R.holdingsContext && R.holdingsContext.length) {
      h += '<h3>What drives the basket</h3><ul class="sn-ul" style="list-style:disc;padding-left:1.2em">'
        + R.holdingsContext.map(x => '<li style="margin-bottom:8px">' + esc(x) + '</li>').join('') + '</ul>';
    }
    h += '</section>';

    // price chart
    if (prices.length > 12) {
      h += '<section class="sn-sec"><h2>Price, 6 years</h2>'
        + '<div class="chart-block"><div class="chart-canvas-wrap" style="height:240px"><canvas id="etf-px"></canvas></div></div></section>';
    }

    // research
    h += '<section class="sn-sec"><h2>Research notes</h2>'
      + '<p class="sn-asof">Written ' + esc(R.asOf || D.asOf) + '. Ask for a refresh after major moves.</p>'
      + '<div class="col-2">';
    if (R.thesis) h += '<div class="thesis-box bull"><h4>Why own it</h4><ul>' + R.thesis.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul></div>';
    if (R.risks) h += '<div class="thesis-box bear"><h4>Risks</h4><ul>' + R.risks.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul></div>';
    h += '</div>';
    if (R.catalysts && R.catalysts.length) h += '<div class="thesis-box cat"><h4>Catalysts</h4><ul>' + R.catalysts.map(c => '<li>' + esc(c) + '</li>').join('') + '</ul></div>';
    if (R.pricedIn) h += '<p><strong>What is priced in:</strong> ' + esc(R.pricedIn) + '</p>';
    if (R.scenarios) {
      h += '<h3>Scenario narratives</h3>'
        + '<div class="thesis-box bear"><h4>Bear</h4><p>' + esc(R.scenarios.bear) + '</p></div>'
        + '<div class="thesis-box"><h4>Base</h4><p>' + esc(R.scenarios.base) + '</p></div>'
        + '<div class="thesis-box bull"><h4>Bull</h4><p>' + esc(R.scenarios.bull) + '</p></div>';
    }
    if (R.sources && R.sources.length) {
      h += '<h3>Key sources</h3><ul class="sn-sources">' + R.sources.map(x =>
        '<li><a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.label) + '</a></li>').join('') + '</ul>';
    }
    h += '</section>';
    root.innerHTML = h;

    const pc = $('etf-px');
    if (pc && window.Chart && prices.length > 12) {
      trendChart(pc, { type: 'line', fmt: 'px', title: 'Price',
        vals: prices.map(x => x[1]) }, prices.length - 1, prices.map(x => x[0]));
    }
    // live quote
    fetch('/api/stocks?mode=quote&symbols=' + D.ticker).then(r => r.ok ? r.json() : null).then(qj => {
      const row = qj && qj.quotes && qj.quotes[0];
      if (row && row.price) $('q-px').textContent = fmtPx(row.price);
    }).catch(() => {});
  }

  async function boot() {
    const root = $('sn-root');
    try {
      [D, R] = await Promise.all([
        fetch(BASE + '/' + T + '.json').then(r => r.json()),
        fetch(BASE + '/' + T + '.research.json').then(r => r.ok ? r.json() : null),
      ]);
    } catch (e) {
      root.innerHTML = '<p class="sn-note">Failed to load data for ' + esc(T) + '.</p>';
      return;
    }
    R = R || {};
    if (D.etf) { renderEtf(root, D, R); return; }
    ANN = shapeAnnual(D);
    const S = D.snapshot || {};
    const px = S.px, mc = S.mc, ev = S.ev || mc;
    const netDebt = (ev != null && mc != null) ? ev - mc : 0;
    const shares = (mc && px) ? mc / px : null;
    const q = (D.quarterly || []).filter(r => r.revenue != null);
    const lastQ = q[q.length - 1];
    const yoyQ = (q.length >= 5 && q[q.length - 5].revenue) ? lastQ.revenue / q[q.length - 5].revenue - 1 : null;
    const qoq = (q.length >= 2 && q[q.length - 2].revenue) ? lastQ.revenue / q[q.length - 2].revenue - 1 : null;
    const fcfTtm = D.ttm && D.ttm.fcf;
    const revTtm = (D.ttm && D.ttm.revenue) || S.rev;
    const peers = (D.peers || []).filter(p => !p.err);
    const VP = R.valPresets || { mode: (fcfTtm > 0 ? 'fcf' : 'revenue'), r: 0.10, gT: 0.03, years: 10 };
    const basis = VP.basis || 'fcf';
    const useEps = basis === 'fwdEps' && S.fpe > 0 && mc;
    const flow0 = useEps ? mc / S.fpe : fcfTtm;
    const target = useEps ? mc : ev;
    const flowName = useEps ? 'forward earnings' : 'TTM FCF';
    const debtAdj = useEps ? 0 : netDebt;

    // ---- section 1: header + KPIs + narrative ----
    let h = '<section class="sn-sec">'
      + '<div class="tk-header"><span class="tk">' + esc(T) + '</span>'
      + '<span class="nm">' + esc(D.name) + ' &middot; ' + esc(D.sector || '') + '</span>'
      + '<span class="price" id="q-px">' + fmtPx(px) + '</span>'
      + '<span class="change" id="q-chg">P/E (TTM) ' + fmtX(S.tpe).replace('x', '') + ' &middot; Fwd P/E ' + fmtX(S.fpe).replace('x', '') + '</span></div>';
    if (R.oneLiner) h += '<p class="sn-lede">' + esc(R.oneLiner) + '</p>';

    // KPI cards
    const mcRows = peers.filter(p => p.mc).sort((a, b) => b.mc - a.mc).slice(0, 4)
      .map(p => ({ t: p.t, v: p.mc }));
    const fpeRows = peers.filter(p => p.fpe > 0).sort((a, b) => a.fpe - b.fpe).slice(0, 4)
      .map(p => ({ t: p.t, v: p.fpe }));
    const omRows = peers.filter(p => p.om != null).sort((a, b) => b.om - a.om).slice(0, 4)
      .map(p => ({ t: p.t, v: p.om * 100 }));
    const fcfM = (fcfTtm != null && revTtm) ? fcfTtm / revTtm : null;
    h += '<div class="kpi-grid">';
    h += '<div class="kpi"><div class="lbl">Market cap</div><div class="val">' + fmtB(mc) + '</div>'
      + kpiCompare('vs peers', mcRows, v => fmtB(v)) + '</div>';
    if (lastQ) {
      const g = yoyQ != null ? yoyQ : qoq;
      const gl = yoyQ != null ? '% YoY' : '% QoQ';
      h += '<div class="kpi"><div class="lbl">Latest Q revenue (' + esc(lastQ.end) + ')</div><div class="val">' + fmtB(lastQ.revenue) + '</div>'
        + (g != null ? '<div class="sub-val ' + (g >= 0 ? 'pos' : 'neg') + '">' + (g >= 0 ? '+' : '') + (g * 100).toFixed(0) + gl + '</div>' : '') + '</div>';
    }
    h += '<div class="kpi"><div class="lbl">TTM free cash flow</div><div class="val' + (fcfTtm < 0 ? ' warn' : '') + '">' + fmtB(fcfTtm) + '</div>'
      + (fcfM != null ? '<div class="sub-val' + (fcfM < 0 ? ' neg' : '') + '">' + fmtPct(fcfM, 0) + ' of revenue</div>' : '') + '</div>';
    h += '<div class="kpi"><div class="lbl">Forward P/E</div><div class="val">' + fmtX(S.fpe) + '</div>'
      + kpiCompare('vs peers', fpeRows, v => v.toFixed(1) + 'x') + '</div>';
    if (R.guide) {
      h += '<div class="kpi"><div class="lbl">' + esc(R.guide.label) + '</div><div class="val' + (R.guide.tone === 'warn' ? ' warn' : '') + '">' + esc(R.guide.val) + '</div>'
        + '<div class="sub-val' + (R.guide.tone === 'warn' ? ' warn' : '') + '">' + esc(R.guide.sub) + '</div></div>';
    }
    h += '<div class="kpi"><div class="lbl">Operating margin</div><div class="val">' + fmtPct(S.om, 0) + '</div>'
      + kpiCompare('vs peers', omRows, v => v.toFixed(0) + '%') + '</div>';
    h += '</div>';

    if (R.latestProse) h += '<h3>Latest financials (most recent reported)</h3><p>' + esc(R.latestProse) + '</p>';
    if (R.guidanceProse) h += '<h3>Guidance — the headline</h3><p>' + esc(R.guidanceProse) + '</p>';
    if (D.fxNote) h += '<p class="footnote">' + esc(D.fxNote) + '.</p>';
    h += '</section>';

    // ---- section 2: bull / bear + catalysts ----
    h += '<section class="sn-sec"><h2>Bull / Bear</h2><div class="col-2">';
    h += '<div class="thesis-box bull"><h4>Bull case</h4><ul>' + thesisItems(R.thesis, R.bullCharts, 'b') + '</ul></div>';
    h += '<div class="thesis-box bear"><h4>Bear case</h4><ul>' + thesisItems(R.risks, R.bearCharts, 'r') + '</ul></div>';
    h += '</div>';
    if (R.catalysts && R.catalysts.length) {
      h += '<div class="thesis-box cat"><h4>Key catalysts &amp; watch items</h4><ul>'
        + R.catalysts.map(c => '<li>' + esc(c) + '</li>').join('') + '</ul></div>';
    }
    if (R.pricedIn) h += '<p><strong>What is priced in:</strong> ' + esc(R.pricedIn) + '</p>';
    h += '</section>';

    // ---- section 3: annual trends w/ scenario projections ----
    const firstY = ANN.length ? String(ANN[0].end).slice(0, 4) : '';
    h += '<section class="sn-sec"><h2>Annual financial trends — ' + esc(firstY) + '-' + PROJ_END + 'E</h2>'
      + '<p class="sn-note">Solid = actuals from EDGAR/Yahoo (TTM appended when the trailing twelve months have moved past the last filed year). Faded/dashed = projections under the selected scenario: revenue follows the scenario growth path fading to terminal, margins held at last-actual levels' + (VP.mode === 'revenue' ? ', FCF margin ramps to the scenario target' : '') + '. Hover any point for value and YoY.</p>'
      + '<div class="period-toggle">'
      + '<button class="period-btn b-bear" data-scen="bear">Bear</button>'
      + '<button class="period-btn" data-scen="base">Base</button>'
      + '<button class="period-btn b-bull" data-scen="bull">Bull</button></div>'
      + '<div class="charts-grid" id="trends-grid"></div>'
      + '<p class="footnote">Projections are mechanical scenario paths tied to the valuation-lab presets, not forecasts.</p></section>';

    // ---- section 4: valuation lab ----
    h += '<section class="sn-sec"><h2>Valuation lab</h2>'
      + '<p class="sn-note">Presets mirror the bear/base/bull scenarios; drag anything. Inputs: EV ' + fmtB(ev) + ', net debt ' + fmtB(netDebt) + ', ' + (VP.mode === 'revenue' ? 'TTM revenue ' + fmtB(revTtm) : flowName + ' ' + fmtB(flow0)) + '. Not investment advice.</p>';
    if (VP.note) h += '<p class="sn-note">' + esc(VP.note) + '</p>';
    h += '<div class="sn-lab">';
    const labRow = (id, label, min, max, step, val, fmt) =>
      '<div class="lab-row"><label for="' + id + '">' + label + '</label>'
      + '<input type="range" id="' + id + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '">'
      + '<span class="lab-val" id="' + id + '-v">' + fmt(val) + '</span></div>';

    if (VP.mode === 'fcf' && flow0 > 0) {
      h += '<div class="lab-panel"><h3>Reverse DCF — what is priced in?</h3>'
        + '<p class="lab-sub">Solves the constant ' + flowName + ' growth rate that makes discounted cash flows equal today\'s ' + (useEps ? 'market cap' : 'enterprise value') + '.</p>'
        + labRow('rd-r', 'Discount rate', 0.06, 0.16, 0.0025, VP.r, pctFmt)
        + labRow('rd-gt', 'Terminal growth', 0, 0.05, 0.0025, VP.gT, pctFmt)
        + labRow('rd-n', 'Horizon (years)', 5, 15, 1, VP.years, yrFmt)
        + '<div class="lab-out"><span class="big" id="rd-out">—</span><div class="ctx" id="rd-ctx"></div></div></div>';
      h += '<div class="lab-panel"><h3>DCF — your assumptions</h3>'
        + '<p class="lab-sub">Growth fades linearly from your starting rate to the terminal rate over the horizon.</p>'
        + '<div class="lab-presets">'
        + '<button class="lab-preset bear" data-g="' + (VP.bear ? VP.bear.g : 0.05) + '">Bear</button>'
        + '<button class="lab-preset" data-g="' + (VP.base ? VP.base.g : 0.12) + '">Base</button>'
        + '<button class="lab-preset bull" data-g="' + (VP.bull ? VP.bull.g : 0.2) + '">Bull</button></div>'
        + labRow('fd-g', 'Growth (yr 1)', -0.2, 0.8, 0.005, VP.base ? VP.base.g : 0.12, pctFmt)
        + labRow('fd-r', 'Discount rate', 0.06, 0.16, 0.0025, VP.r, pctFmt)
        + labRow('fd-gt', 'Terminal growth', 0, 0.05, 0.0025, VP.gT, pctFmt)
        + labRow('fd-n', 'Horizon (years)', 5, 15, 1, VP.years, yrFmt)
        + '<div class="lab-out"><span class="big" id="fd-out">—</span><div class="ctx" id="fd-ctx"></div></div></div>';
    } else {
      const p = VP.base || { revCagr: 0.4, fcfMargin: 0.15 };
      h += '<div class="lab-panel"><h3>Revenue path — what is priced in?</h3>'
        + '<p class="lab-sub">FCF is negative or immature. Solves the revenue CAGR needed so the terminal business (at your steady-state FCF margin) discounts back to today\'s enterprise value.</p>'
        + labRow('rv-m', 'Steady-state FCF margin', 0.02, 0.4, 0.005, p.fcfMargin, pctFmt)
        + labRow('rv-r', 'Discount rate', 0.08, 0.18, 0.0025, VP.r, pctFmt)
        + labRow('rv-gt', 'Terminal growth', 0, 0.05, 0.0025, VP.gT, pctFmt)
        + labRow('rv-n', 'Horizon (years)', 4, 10, 1, VP.years, yrFmt)
        + '<div class="lab-out"><span class="big" id="rv-out">—</span><div class="ctx" id="rv-ctx"></div></div></div>';
      h += '<div class="lab-panel"><h3>Scenario value — your assumptions</h3>'
        + '<p class="lab-sub">Revenue CAGR, margin at horizon, and an exit multiple. Interim burn ignored — generous to the bull case.</p>'
        + '<div class="lab-presets">'
        + '<button class="lab-preset bear" data-c="' + (VP.bear ? VP.bear.revCagr : 0.2) + '" data-m="' + (VP.bear ? VP.bear.fcfMargin : 0.08) + '" data-x="' + (VP.bear && VP.bear.exit ? VP.bear.exit : 14) + '">Bear</button>'
        + '<button class="lab-preset" data-c="' + p.revCagr + '" data-m="' + p.fcfMargin + '" data-x="' + (p.exit || 20) + '">Base</button>'
        + '<button class="lab-preset bull" data-c="' + (VP.bull ? VP.bull.revCagr : 0.6) + '" data-m="' + (VP.bull ? VP.bull.fcfMargin : 0.22) + '" data-x="' + (VP.bull && VP.bull.exit ? VP.bull.exit : 28) + '">Bull</button></div>'
        + labRow('sv-c', 'Revenue CAGR', 0, 1.2, 0.01, p.revCagr, pctFmt)
        + labRow('sv-m', 'FCF margin at horizon', 0.02, 0.4, 0.005, p.fcfMargin, pctFmt)
        + labRow('sv-x', 'Exit EV/FCF multiple', 8, 40, 1, p.exit || 20, xFmt)
        + labRow('sv-r', 'Discount rate', 0.08, 0.18, 0.0025, VP.r, pctFmt)
        + labRow('sv-n', 'Horizon (years)', 4, 10, 1, VP.years, yrFmt)
        + '<div class="lab-out"><span class="big" id="sv-out">—</span><div class="ctx" id="sv-ctx"></div></div></div>';
    }
    h += '</div></section>';

    // ---- section 5: peers ----
    if (peers.length > 1) {
      h += '<section class="sn-sec"><h2>Peer comparison</h2>'
        + '<p class="sn-note">Live multiples from the same refresh, caps USD-normalized. Click a column to sort.</p>'
        + '<div class="sn-table-wrap"><table class="sn-peers" id="peer-tbl"><thead><tr>'
        + '<th data-k="t">Ticker</th><th data-k="n">Name</th><th data-k="mc">Mkt cap</th>'
        + '<th data-k="fpe">Fwd P/E</th><th data-k="tpe">Trail P/E</th><th data-k="evs">EV/S</th>'
        + '<th data-k="evEbitda">EV/EBITDA</th><th data-k="gm">Gross m.</th><th data-k="om">Op m.</th>'
        + '<th data-k="rg">Rev gr.</th><th data-k="beta">Beta</th>'
        + '</tr></thead><tbody id="peer-body"></tbody></table></div></section>';
    }

    // ---- section 6: research notes ----
    h += '<section class="sn-sec"><h2>Research notes</h2>'
      + '<p class="sn-asof">Written ' + esc(R.asOf || D.asOf) + '. Ask for a refresh after major news or earnings.</p>';
    if (R.moat) h += '<h3>Moat</h3><p>' + esc(R.moat) + '</p>';
    if (R.segments && R.segments.length) h += '<h3>Business &amp; segments</h3><ul>' + R.segments.map(s => '<li>' + esc(s) + '</li>').join('') + '</ul>';
    if (R.competitive && R.competitive.length) h += '<h3>Competitive landscape</h3><ul>' + R.competitive.map(s => '<li>' + esc(s) + '</li>').join('') + '</ul>';
    if (R.scenarios) {
      h += '<h3>Scenario narratives</h3>'
        + '<div class="thesis-box bear"><h4>Bear</h4><p>' + esc(R.scenarios.bear) + '</p></div>'
        + '<div class="thesis-box"><h4>Base</h4><p>' + esc(R.scenarios.base) + '</p></div>'
        + '<div class="thesis-box bull"><h4>Bull</h4><p>' + esc(R.scenarios.bull) + '</p></div>';
    }
    if (R.notes) h += '<p class="footnote">' + esc(R.notes) + '</p>';
    if (R.sources && R.sources.length) {
      h += '<h3>Key sources</h3><ul class="sn-sources">' + R.sources.map(s =>
        '<li><a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.label) + '</a></li>').join('') + '</ul>';
    }
    h += '</section>';

    root.innerHTML = h;

    // ---- bullet charts ----
    document.querySelectorAll('canvas[data-bc]').forEach(c => {
      const spec = metricSpec(c.getAttribute('data-bc'), D, ANN);
      if (!spec) return;
      const t = $('bct-' + c.id.slice(3));
      if (t) t.textContent = spec.cap;
      const clean = { ...spec, lab: spec.lab.filter((_, i) => spec.data[i] != null), data: spec.data.filter(v => v != null) };
      if (clean.data.length) bulletChart(c, clean);
    });

    // ---- scenario toggle + trends ----
    document.querySelectorAll('.period-btn[data-scen]').forEach(b =>
      b.addEventListener('click', () => setScenario(b.getAttribute('data-scen'))));
    let s0 = 'base';
    try {
      const u = new URL(location.href);
      if (['bear', 'base', 'bull'].includes(u.searchParams.get('scenario'))) s0 = u.searchParams.get('scenario');
    } catch (e) {}
    setScenario(s0, false);

    // ---- peer table ----
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
        body.innerHTML = rows.map(p => '<tr class="' + (p.t === T ? 'self' : '') + '">'
          + '<td>' + esc(p.t) + '</td><td>' + esc(p.n || '') + '</td><td>' + fmtB(p.mc) + '</td>'
          + '<td>' + fmtX(p.fpe) + '</td><td>' + fmtX(p.tpe) + '</td><td>' + fmtX(p.evs) + '</td>'
          + '<td>' + fmtX(p.evEbitda) + '</td><td>' + fmtPct(p.gm) + '</td><td>' + fmtPct(p.om) + '</td>'
          + '<td>' + fmtPct(p.rg) + '</td><td>' + (p.beta == null ? '—' : p.beta.toFixed(2)) + '</td></tr>').join('');
      };
      document.querySelectorAll('#peer-tbl th').forEach(th => th.addEventListener('click', () => {
        const k = th.getAttribute('data-k');
        sortDir = (sortK === k) ? -sortDir : -1; sortK = k;
        document.querySelectorAll('#peer-tbl th').forEach(x => x.classList.toggle('sorted', x === th));
        render();
      }));
      render();
    }

    // ---- valuation lab behaviour ----
    const bind = (ids, fn) => {
      const run = () => {
        ids.forEach(id => {
          const el = $(id);
          if (el) $(id + '-v').textContent = (id.endsWith('-n') ? yrFmt : id.endsWith('-x') ? xFmt : pctFmt)(parseFloat(el.value));
        });
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
          'The market needs ' + pctFmt(g) + ' ' + flowName + ' growth every year for ' + N + ' years (then ' + pctFmt(gT) + ' forever), discounted at ' + pctFmt(r) + ', to justify ' + (useEps ? 'market cap' : 'EV') + ' of ' + fmtB(target) + ' on ' + flowName + ' of ' + fmtB(flow0) + '.';
      });
      bind(['fd-g', 'fd-r', 'fd-gt', 'fd-n'], () => {
        const g = +$('fd-g').value, r = +$('fd-r').value, gT = +$('fd-gt').value, N = +$('fd-n').value;
        const pv = pvFade(flow0, g, r, gT, N);
        const eq = pv - debtAdj, ps = shares ? eq / shares : null;
        const up = (ps != null && px) ? ps / px - 1 : null;
        $('fd-out').innerHTML = ps == null ? fmtB(eq) :
          fmtPx(ps) + ' <span class="' + (up >= 0 ? 'up' : 'down') + '">(' + (up >= 0 ? '+' : '') + (up * 100).toFixed(0) + '%)</span>';
        $('fd-ctx').textContent = 'Fair value per share vs ' + fmtPx(px) + ' today. ' + flowName + ' starts at ' + fmtB(flow0) + ', growth fades ' + pctFmt(g) + ' -> ' + pctFmt(gT) + ' over ' + N + ' years, ' + pctFmt(r) + ' discount rate.';
      });
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
          'Revenue must compound at ' + pctFmt(c) + ' for ' + N + ' years off ' + fmtB(revTtm) + ' TTM, reaching a ' + pctFmt(m) + ' FCF margin, to justify EV of ' + fmtB(ev) + ' at a ' + pctFmt(r) + ' discount rate.';
      });
      bind(['sv-c', 'sv-m', 'sv-x', 'sv-r', 'sv-n'], () => {
        const c = +$('sv-c').value, m = +$('sv-m').value, x = +$('sv-x').value,
              r = +$('sv-r').value, N = +$('sv-n').value;
        const revN = revTtm * Math.pow(1 + c, N);
        const fcfN = revN * m;
        const evN = fcfN * x;
        const pv = evN / Math.pow(1 + r, N);
        const eq = pv - netDebt, ps = shares ? eq / shares : null;
        const up = (ps != null && px) ? ps / px - 1 : null;
        $('sv-out').innerHTML = ps == null ? fmtB(eq) :
          fmtPx(ps) + ' <span class="' + (up >= 0 ? 'up' : 'down') + '">(' + (up >= 0 ? '+' : '') + (up * 100).toFixed(0) + '%)</span>';
        $('sv-ctx').textContent = 'Implied value per share vs ' + fmtPx(px) + ' today. Revenue ' + fmtB(revTtm) + ' -> ' + fmtB(revN) + ' over ' + N + ' years (' + pctFmt(c) + '/yr); FCF ' + fmtB(fcfN) + ' at a ' + x.toFixed(0) + 'x exit = EV ' + fmtB(evN) + ', discounted at ' + pctFmt(r) + ', less net debt ' + fmtB(netDebt) + '.';
      });
      document.querySelectorAll('.lab-preset[data-c]').forEach(b => b.addEventListener('click', () => {
        $('sv-c').value = b.getAttribute('data-c');
        $('sv-m').value = b.getAttribute('data-m');
        $('sv-x').value = b.getAttribute('data-x');
        $('sv-c').dispatchEvent(new Event('input'));
      }));
    }

    // ---- theme change: re-render all charts ----
    window.addEventListener('themechange', () => {
      destroyCharts();
      document.querySelectorAll('canvas[data-bc]').forEach(c => {
        const spec = metricSpec(c.getAttribute('data-bc'), D, ANN);
        if (!spec) return;
        const clean = { ...spec, lab: spec.lab.filter((_, i) => spec.data[i] != null), data: spec.data.filter(v => v != null) };
        if (clean.data.length) bulletChart(c, clean);
      });
      buildTrends();
    });

    // ---- live quote (best effort) ----
    try {
      const qj = await fetch('/api/stocks?mode=quote&symbols=' + T).then(r => r.ok ? r.json() : null);
      const row = qj && qj.quotes && qj.quotes[0];
      if (row && row.price) {
        $('q-px').textContent = fmtPx(row.price);
        if (row.changePct < 0) $('q-px').classList.add('down');
        $('q-chg').textContent = (row.changePct >= 0 ? '+' : '') + (row.changePct || 0).toFixed(2) + '% today · P/E (TTM) '
          + fmtX(S.tpe).replace('x', '') + ' · Fwd ' + fmtX(S.fpe).replace('x', '');
      }
    } catch (e) { /* static fallback */ }
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
