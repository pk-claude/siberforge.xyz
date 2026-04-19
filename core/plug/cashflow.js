/* Plug Power quarterly cash-flow chart.
   Loads ./data/cashflow.json and renders an interactive Plotly chart
   with toggleable series, click-to-expand driver detail, and a cash-position overlay.

   Light theme. Colors pulled from CSS custom properties so they stay
   in sync with the stylesheet. */

const COLORS = (() => {
  const s = getComputedStyle(document.documentElement);
  const g = name => s.getPropertyValue(name).trim();
  return {
    cfo: g('--cat-cfo'),
    cfi: g('--cat-cfi'),
    cff: g('--cat-cff'),
    fcf: g('--cat-fcf'),
    capex: g('--cat-capex'),
    net: g('--cat-net'),
    cash_total: g('--cat-cash-total'),
    cash_basic: g('--cat-cash-basic'),
    text: g('--text'),
    muted: g('--muted'),
    panel: g('--panel'),
    line: g('--line'),
  };
})();

// ------ helpers ------
const m = v => (v === null || v === undefined) ? null : Math.round(v / 1e6 * 100) / 100;

function fmt(v) {
  if (v === null || v === undefined) return '—';
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1000) return sign + '$' + (abs / 1000).toFixed(2) + 'B';
  return sign + '$' + abs.toFixed(1) + 'M';
}

function driverText(drivers, maxN) {
  if (!drivers || drivers.length === 0) return '';
  return drivers.slice(0, maxN).map(d => {
    const sign = d.val >= 0 ? '+' : '';
    return d.name + ' ' + sign + fmt(d.val);
  }).join('<br>');
}

// ------ main ------
async function init() {
  // Prefer inlined data (works via file:// and http://). Fall back to fetch for API consumers.
  let raw;
  if (typeof window.PLUG_CASHFLOW_DATA !== 'undefined') {
    raw = window.PLUG_CASHFLOW_DATA;
  } else {
    raw = await fetch('./data/cashflow.json').then(r => r.json());
  }

  // Normalize data to $M
  const DATA = raw.map(r => ({
    period: r.period, months: r.months, qend: r.qend,
    cfo: m(r.cfo), cfi: m(r.cfi), cff: m(r.cff),
    capex: m(r.capex), fcf: m(r.fcf), net: m(r.net),
    cash_basic: m(r.cash_basic), cash_total: m(r.cash_total),
    cfo_drivers: (r.cfo_drivers_all || []).map(d => ({ name: d.name, val: m(d.val) })),
    cfi_drivers: (r.cfi_drivers_all || []).map(d => ({ name: d.name, val: m(d.val) })),
    cff_drivers: (r.cff_drivers_all || []).map(d => ({ name: d.name, val: m(d.val) })),
  }));

  const periods = DATA.map(r => r.period);

  // Default chart view starts at 2020-Q1 (user can pan/zoom out to see earlier history).
  const DEFAULT_START_PERIOD = '2020-Q1';
  const defaultStartIdx = Math.max(0, periods.indexOf(DEFAULT_START_PERIOD));
  const defaultXRange = [defaultStartIdx - 0.5, periods.length - 0.5];

  const SERIES_BAR = {
    cfo:   { name: 'CFO',        color: COLORS.cfo,   get data() { return DATA.map(r => r.cfo); } },
    cfi:   { name: 'CFI',        color: COLORS.cfi,   get data() { return DATA.map(r => r.cfi); } },
    cff:   { name: 'CFF',        color: COLORS.cff,   get data() { return DATA.map(r => r.cff); } },
    fcf:   { name: 'FCF',        color: COLORS.fcf,   get data() { return DATA.map(r => r.fcf); } },
    capex: { name: 'CapEx',      color: COLORS.capex, get data() { return DATA.map(r => r.capex); } },
    net:   { name: 'Net Δ cash', color: COLORS.net,   get data() { return DATA.map(r => r.net); } },
  };
  const SERIES_LINE = {
    cash_total: { name: 'Cash + restricted',          color: COLORS.cash_total, get data() { return DATA.map(r => r.cash_total); } },
    cash_basic: { name: 'Cash & equiv (unrestricted)', color: COLORS.cash_basic, get data() { return DATA.map(r => r.cash_basic); } },
  };

  const cfOrder = ['cfo', 'cfi', 'cff', 'fcf', 'capex', 'net'];
  const cashOrder = ['cash_total', 'cash_basic'];
  const enabled = { cfo: true, cfi: true, cff: true, fcf: false, capex: false, net: false, cash_total: true, cash_basic: false };
  let mode = 'group';

  // pre-build hover text
  const HOVER = {};
  cfOrder.forEach(k => HOVER[k] = []);
  for (const r of DATA) {
    const hdr = '<b>' + r.period + '</b> · ' + r.months + '<br>Cash end: ' + fmt(r.cash_total);
    const cfoDrv = driverText(r.cfo_drivers, 4);
    const cfiDrv = driverText(r.cfi_drivers, 4);
    const cffDrv = driverText(r.cff_drivers, 4);
    HOVER.cfo.push(hdr + '<br><b>CFO: ' + fmt(r.cfo) + '</b>' + (cfoDrv ? '<br><br>Top drivers:<br>' + cfoDrv : ''));
    HOVER.cfi.push(hdr + '<br><b>CFI: ' + fmt(r.cfi) + '</b>' + (cfiDrv ? '<br><br>Top drivers:<br>' + cfiDrv : ''));
    HOVER.cff.push(hdr + '<br><b>CFF: ' + fmt(r.cff) + '</b>' + (cffDrv ? '<br><br>Top drivers:<br>' + cffDrv : ''));
    HOVER.fcf.push(hdr + '<br><b>FCF: ' + fmt(r.fcf) + '</b>');
    HOVER.capex.push(hdr + '<br><b>CapEx: ' + fmt(r.capex) + '</b>');
    HOVER.net.push(hdr + '<br><b>Net Δ cash: ' + fmt(r.net) + '</b>');
  }

  function render() {
    const traces = [];
    cfOrder.forEach(k => {
      if (!enabled[k]) return;
      const s = SERIES_BAR[k];
      if (mode === 'line') {
        traces.push({
          type: 'scatter', mode: 'lines+markers',
          name: s.name, x: periods, y: s.data,
          line: { color: s.color, width: 2 },
          marker: { size: 6, color: s.color },
          hovertemplate: '%{text}<extra></extra>',
          text: HOVER[k] || periods.map(() => ''),
        });
      } else {
        traces.push({
          type: 'bar', name: s.name, x: periods, y: s.data,
          marker: { color: s.color },
          hovertemplate: '%{text}<extra></extra>',
          text: HOVER[k] || periods.map(() => ''),
        });
      }
    });
    cashOrder.forEach(k => {
      if (!enabled[k]) return;
      const s = SERIES_LINE[k];
      traces.push({
        type: 'scatter', mode: 'lines+markers', name: s.name,
        x: periods, y: s.data, yaxis: 'y2',
        line: { color: s.color, width: 2.5 },
        marker: { size: 6, color: s.color },
        hovertemplate: '<b>%{x}</b><br>' + s.name + ': %{y:.1f}M<extra></extra>',
      });
    });

    const layout = {
      paper_bgcolor: COLORS.panel,
      plot_bgcolor: COLORS.panel,
      font: { color: COLORS.text, size: 13, family: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
      margin: { l: 75, r: 75, t: 30, b: 100 },
      barmode: mode === 'stack' ? 'stack' : 'group',
      xaxis: {
        gridcolor: COLORS.line,
        tickangle: -45,
        automargin: true,
        tickfont: { size: 12 },
        type: 'category',
        range: defaultXRange.slice(),
      },
      yaxis: {
        title: { text: 'Cash flow ($M)', font: { size: 13 } },
        gridcolor: COLORS.line,
        zerolinecolor: COLORS.muted,
        zerolinewidth: 1,
        tickfont: { size: 12 },
      },
      yaxis2: {
        title: { text: 'Cash position ($M)', font: { size: 13 } },
        overlaying: 'y',
        side: 'right',
        showgrid: false,
        zeroline: false,
        rangemode: 'tozero',
        tickfont: { size: 12 },
      },
      legend: {
        orientation: 'h',
        y: -0.25,
        x: 0.5,
        xanchor: 'center',
        bgcolor: 'rgba(0,0,0,0)',
        font: { size: 13 },
      },
      hovermode: 'closest',
      hoverlabel: {
        bgcolor: '#1e293b',
        bordercolor: '#c47f00',
        font: { size: 12.5, color: '#f8fafc', family: "Inter, sans-serif" },
        align: 'left',
      },
    };

    Plotly.newPlot('chart', traces, layout, { responsive: true, displaylogo: false });
    bindClick();
  }

  function bindClick() {
    const el = document.getElementById('chart');
    if (el && el.removeAllListeners) el.removeAllListeners('plotly_click');
    el.on('plotly_click', ev => {
      if (ev && ev.points && ev.points.length) {
        openDetail(ev.points[0].pointIndex);
      }
    });
  }

  function openDetail(idx) {
    const r = DATA[idx];
    document.getElementById('detail').style.display = 'block';
    document.getElementById('detail-title').textContent = r.period + ' — ' + r.months;
    const mhtml = [
      ['CFO', r.cfo], ['CFI', r.cfi], ['CFF', r.cff], ['CapEx', r.capex],
      ['FCF', r.fcf], ['Net Δ cash', r.net],
      ['Cash (unrestricted)', r.cash_basic], ['Cash (incl. restricted)', r.cash_total],
    ].map(([l, v]) =>
      `<div class="metric"><div class="metric-lbl">${l}</div><div class="metric-val">${fmt(v)}</div></div>`
    ).join('');
    document.getElementById('detail-metrics').innerHTML = mhtml;

    const cards = [
      { title: 'Operating (CFO)', drv: r.cfo_drivers, total: r.cfo },
      { title: 'Investing (CFI)', drv: r.cfi_drivers, total: r.cfi },
      { title: 'Financing (CFF)', drv: r.cff_drivers, total: r.cff },
    ];
    const chtml = cards.map(c => {
      const rows = (c.drv || []).map(d => {
        const cls = d.val > 0 ? 'pos' : (d.val < 0 ? 'neg' : 'zer');
        const sign = d.val > 0 ? '+' : '';
        return `<div class="drow"><span class="dname">${d.name}</span><span class="dval ${cls}">${sign}${fmt(d.val)}</span></div>`;
      }).join('');
      return `<div class="d-card"><h3>${c.title} <span class="hdrmeasure">= ${fmt(c.total)}</span></h3>${rows || '<div class="drow"><span class="dname zer">(no drivers tagged)</span></div>'}</div>`;
    }).join('');
    document.getElementById('detail-cards').innerHTML = chtml;

    document.querySelectorAll('#tbody tr').forEach(tr => tr.classList.remove('sel'));
    const tr = document.querySelector('#tbody tr[data-idx="' + idx + '"]');
    if (tr) tr.classList.add('sel');

    document.getElementById('detail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  document.getElementById('detail-close').onclick = () => {
    document.getElementById('detail').style.display = 'none';
  };

  // Data table — most-recent quarter first.
  const tbody = document.getElementById('tbody');
  const tableOrder = DATA.map((_, i) => i).reverse();
  tableOrder.forEach(i => {
    const r = DATA[i];
    const tr = document.createElement('tr');
    tr.dataset.idx = i;
    const cells = [r.period, r.months, r.cfo, r.cfi, r.cff, r.capex, r.fcf, r.net, r.cash_basic, r.cash_total];
    cells.forEach((v, ci) => {
      const td = document.createElement('td');
      if (ci < 2) {
        td.textContent = v;
      } else {
        if (v === null || v === undefined) {
          td.textContent = '—';
        } else {
          td.textContent = (v < 0 ? '-' : '') + '$' + Math.abs(v).toFixed(1);
          td.classList.add(v >= 0 ? 'pos' : 'neg');
        }
      }
      tr.appendChild(td);
    });
    tr.addEventListener('click', () => openDetail(i));
    tbody.appendChild(tr);
  });

  document.querySelectorAll('#cf-toggles input, #cash-toggles input').forEach(cb => {
    cb.addEventListener('change', () => {
      enabled[cb.dataset.s] = cb.checked;
      render();
    });
  });

  document.querySelectorAll('.mbtn').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.mbtn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      mode = b.dataset.mode;
      render();
    });
  });

  render();
}

init().catch(err => {
  document.getElementById('chart').innerHTML =
    '<div style="padding:40px;text-align:center;color:#dc2626">' +
    'Failed to load cash-flow data: ' + (err && err.message ? err.message : String(err)) + '</div>';
  console.error(err);
});
