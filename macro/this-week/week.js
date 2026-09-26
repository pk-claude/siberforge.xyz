// This Week: surprise-vs-history scan across the key series.
import { el, fmt, sgn, esc, addDays, todayIso, fred, fredInfo, prices, last, at, pctile, yoy, since, change, setStatus, asOfLine, dayName, monthName, daysBetween } from '/lib/sf-kit.js';

// [id, label, transform, decimals, unit, page]
const U = [
  ['PAYEMS', 'Nonfarm payrolls (monthly change, k)', 'diff', 0, 'k', '/macro/labor/'],
  ['UNRATE', 'Unemployment rate', 'level', 1, '%', '/macro/labor/'],
  ['IC4WSA', 'Initial claims, 4-wk avg', 'thousands', 0, 'k', '/macro/labor/'],
  ['CES0500000003', 'Average hourly earnings, YoY', 'yoy', 1, '%', '/macro/labor/'],
  ['JTSJOL', 'Job openings (JOLTS)', 'level', 0, 'k', '/macro/labor/'],
  ['CPILFESL', 'Core CPI, YoY', 'yoy', 2, '%', '/macro/inflation/'],
  ['CPIAUCSL', 'Headline CPI, YoY', 'yoy', 2, '%', '/macro/inflation/'],
  ['PCEPILFE', 'Core PCE, YoY', 'yoy', 2, '%', '/macro/inflation/'],
  ['CORESTICKM159SFRBATL', 'Sticky-price core CPI', 'level', 2, '%', '/macro/inflation/'],
  ['T5YIFR', '5y5y inflation expectations', 'level', 2, '%', '/macro/inflation/'],
  ['MICH', 'UMich 1-yr inflation expectations', 'level', 1, '%', '/macro/inflation/'],
  ['INDPRO', 'Industrial production, YoY', 'yoy', 1, '%', '/macro/indicators/'],
  ['RRSFS', 'Real retail sales, YoY', 'yoy', 1, '%', '/macro/consumer/'],
  ['UMCSENT', 'UMich consumer sentiment', 'level', 1, '', '/macro/consumer/'],
  ['PSAVERT', 'Personal saving rate', 'level', 1, '%', '/macro/consumer/'],
  ['GDPNOW', 'Atlanta Fed GDPNow', 'level', 1, '%', '/macro/indicators/'],
  ['CFNAI', 'Chicago Fed activity index', 'level', 2, '', '/macro/'],
  ['HOUST', 'Housing starts', 'level', 0, 'k', '/macro/housing/'],
  ['PERMIT', 'Building permits', 'level', 0, 'k', '/macro/housing/'],
  ['EXHOSLUSM495S', 'Existing home sales', 'level', 0, '', '/macro/housing/'],
  ['HSN1F', 'New home sales', 'level', 0, 'k', '/macro/housing/'],
  ['CSUSHPISA', 'Case-Shiller home prices, YoY', 'yoy', 1, '%', '/macro/housing/'],
  ['MORTGAGE30US', '30Y mortgage rate', 'level', 2, '%', '/macro/housing/'],
  ['NFCI', 'Chicago Fed NFCI', 'level', 2, '', '/macro/credit/'],
  ['BAA10Y', 'Baa - 10Y spread', 'level', 2, '%', '/macro/credit/'],
  ['DGS2', '2Y Treasury', 'level', 2, '%', '/macro/policy/'],
  ['DGS10', '10Y Treasury', 'level', 2, '%', '/macro/policy/'],
  ['T10Y3M', '10Y - 3M spread', 'level', 2, '%', '/macro/policy/'],
  ['DTWEXBGS', 'Broad dollar index', 'level', 1, '', '/markets/global/'],
  ['DCOILWTICO', 'WTI crude', 'level', 1, '$', '/markets/global/'],
  ['VIXCLS', 'VIX', 'level', 1, '', '/markets/'],
];
const MKT = [['SPY', 'S&P 500'], ['QQQ', 'Nasdaq-100'], ['IWM', 'Russell 2000'], ['RSP', 'S&P 500 equal-weight'], ['EFA', 'Developed ex-US'], ['EEM', 'Emerging markets'], ['TLT', '20+Y Treasuries'], ['HYG', 'High-yield bonds'], ['GLD', 'Gold'], ['USO', 'Crude oil'], ['UUP', 'US dollar']];

const freqStep = { d: 1, w: 7, m: 30, q: 91 };
function transform(a, t) {
  if (t === 'yoy') { // detect frequency by spacing
    const gap = a.length > 2 ? daysBetween(a[a.length - 2].date, a[a.length - 1].date) : 30;
    return yoy(a, gap > 80 ? 4 : 12);
  }
  if (t === 'thousands') return a.map(o => ({ date: o.date, value: o.value / 1000 }));
  if (t === 'diff') return a.slice(1).map((o, i) => ({ date: o.date, value: o.value - a[i].value }));
  return a;
}

async function main() {
  setStatus('stale', 'Loading…');
  const ids = U.map(u => u[0]);
  const [d, px, man] = await Promise.all([fred(ids, '1995-01-01'), prices(MKT.map(m => m[0]), 1), window.SF_FRED ? window.SF_FRED.manifest() : null]);
  const weekAgo = addDays(todayIso(), -8);

  const rows = [];
  for (const [id, label, t, dec, unit, page] of U) {
    let a = d[id] || [];
    const daily = a.length > 2 && daysBetween(a[a.length - 2].date, a[a.length - 1].date) < 5;
    if (daily) a = a.filter((o, i) => i === a.length - 1 || new Date(o.date + 'T00:00:00Z').getUTCDay() === 5); // weekly (Friday) changes for daily series
    const x = transform(a, t);
    if (x.length < 30) continue;
    const l = x[x.length - 1], p = x[x.length - 2];
    const ch = x.slice(1).map((o, i) => o.value - x[i].value);
    const hist = ch.slice(-(daily ? 520 : 120) - 1, -1);
    const mu = hist.reduce((s, v) => s + v, 0) / hist.length;
    const sd = Math.sqrt(hist.reduce((s, v) => s + (v - mu) ** 2, 0) / (hist.length - 1));
    const z = sd > 0 ? (ch[ch.length - 1] - mu) / sd : 0;
    const info = man?.series?.[id];
    const fresh = info && info.changedAt && info.changedAt.slice(0, 10) >= weekAgo && info.changedAt !== man.generatedAt ? true : daysBetween(l.date, todayIso()) <= 10;
    const weekly = !daily && x.length > 2 && daysBetween(x[x.length - 2].date, l.date) < 10;
    rows.push({ id, label, dec, unit, page, l, p, z, pct: pctile(x, 20), fresh, daily, weekly });
  }
  rows.sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
  const v = (r, val) => `${r.unit === '$' ? '$' : ''}${fmt(val, r.dec)}${r.unit && r.unit !== '$' ? r.unit : ''}`;
  el('tbl-moves').innerHTML = `<thead><tr><th>Series</th><th>Period</th><th>Latest</th><th>Prior</th><th>Change</th><th>Surprise z</th><th>20y pct</th></tr></thead><tbody>` +
    rows.slice(0, 15).map(r => `<tr class="${Math.abs(r.z) >= 2 ? 'sf-hl' : ''}"><th><a href="${r.page}">${esc(r.label)}</a>${r.fresh ? ' <span class="muted">&middot; new</span>' : ''}</th>
      <td class="muted">${r.daily ? 'wk to ' + dayName(r.l.date) : r.weekly ? 'wk of ' + dayName(r.l.date) : monthName(r.l.date)}</td><td>${v(r, r.l.value)}</td><td>${v(r, r.p.value)}</td>
      <td class="${r.l.value - r.p.value >= 0 ? 'pos' : 'neg'}">${sgn(r.l.value - r.p.value, r.dec)}</td><td>${sgn(r.z, 1)}</td><td>${r.pct}</td></tr>`).join('') + '</tbody>';

  const ext = rows.filter(r => r.pct >= 95 || r.pct <= 5).sort((a, b) => Math.abs(b.pct - 50) - Math.abs(a.pct - 50));
  el('extremes').innerHTML = ext.map(r => `<li><b><a href="${r.page}" style="color:inherit">${esc(r.label)}</a></b> at ${v(r, r.l.value)}: <span style="color:var(--accent)">${r.pct >= 95 ? 'high: ' : 'low: '}${r.pct}th percentile</span> of 20 years.</li>`).join('') || '<li class="muted">No tracked series is in the top or bottom 5% of its 20-year range.</li>';

  // Calendar
  try {
    const rj = await (await fetch('/api/releases?days=14')).json();
    el('calendar').innerHTML = (rj.releases || []).map(x => `<li><b>${esc(x.short)}</b> <span class="muted">${esc(x.name)}</span><br>${dayName(x.date)} &middot; ${x.days_until === 0 ? 'today' : x.days_until === 1 ? 'tomorrow' : 'in ' + x.days_until + ' days'}</li>`).join('') || '<li class="muted">No tracked releases in the next 14 days.</li>';
  } catch (e) { el('calendar').innerHTML = '<li class="muted">Release calendar unavailable.</li>'; }

  // Markets
  const wk = s => { const a = px[s] || []; if (a.length < 6) return null; return (a[a.length - 1].value / a[a.length - 6].value - 1) * 100; };
  const bp = id => { const a = d[id] || []; const l = last(a); const p = at(a, addDays(l.date, -7)); return l && p ? (l.value - p.value) * 100 : null; };
  el('tbl-mkt').innerHTML = `<thead><tr><th>Market</th><th>Last</th><th>1 week</th></tr></thead><tbody>` +
    MKT.map(([s, l]) => { const a = px[s] || [], w = wk(s); return `<tr><th>${l} <span class="muted">${s}</span></th><td>${a.length ? '$' + fmt(last(a).value, 2) : '—'}</td><td class="${w >= 0 ? 'pos' : 'neg'}">${w == null ? '—' : sgn(w, 1) + '%'}</td></tr>`; }).join('') +
    [['DGS2', '2Y Treasury'], ['DGS10', '10Y Treasury'], ['BAA10Y', 'Baa - 10Y spread']].map(([id, l]) => { const b = bp(id); return `<tr><th>${l}</th><td>${fmt(last(d[id])?.value, 2)}%</td><td>${b == null ? '—' : sgn(b, 0) + 'bp'}</td></tr>`; }).join('') + '</tbody>';

  const big = rows.filter(r => Math.abs(r.z) >= 2);
  const spyW = wk('SPY');
  el('verdict').innerHTML = (big.length
    ? `<strong>${big.length} series</strong> printed a move of two standard deviations or more: ${big.slice(0, 4).map(r => `${esc(r.label)} (${sgn(r.z, 1)} z)`).join(', ')}. `
    : 'No tracked series moved by two standard deviations or more in its latest print. ') +
    (ext.length ? `${ext.length} sit at the edge of their 20-year range, led by ${esc(ext[0].label)} (${ext[0].pct}th percentile). ` : '') +
    (spyW != null ? `The S&P 500 is ${sgn(spyW, 1)}% on the week.` : '');

  await asOfLine('asof', { a: d.IC4WSA, b: d.DGS10 });
  setStatus('live', 'Snapshot data');
}
main().catch(e => { console.error(e); setStatus('error', 'Error loading data'); el('verdict').textContent = 'Data failed to load: ' + e.message; });
