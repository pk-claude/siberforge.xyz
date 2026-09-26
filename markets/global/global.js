// Global, FX & Commodities.
import { el, fmt, sgn, esc, fred, prices, last, at, change, ytd, pctile, since, combine, asof, lineChart, tiles, asOfLine, setStatus, COLORS, dayName, recessionRanges } from '/lib/sf-kit.js';

const FX = [ // [id, label, usdPerForeign]
  ['DEXUSEU', 'EUR', true], ['DEXJPUS', 'JPY', false], ['DEXUSUK', 'GBP', true],
  ['DEXCHUS', 'CNY', false], ['DEXCAUS', 'CAD', false], ['DEXMXUS', 'MXN', false],
];
const EQ = [['SPY', 'US (S&P 500)'], ['EFA', 'Developed ex-US'], ['EEM', 'Emerging'], ['EWJ', 'Japan'], ['EWG', 'Germany'], ['EWU', 'UK'], ['FXI', 'China large-cap'], ['INDA', 'India'], ['EWZ', 'Brazil'], ['EWY', 'Korea']];
const CMD_ETF = [['GLD', 'Gold (GLD)'], ['CPER', 'Copper (CPER)'], ['USO', 'Crude oil (USO)'], ['DBC', 'Broad commodities (DBC)']];
const IDS = ['DTWEXBGS', ...FX.map(f => f[0]), 'ECBDFR', 'DFF', 'DGS10', 'IRLTLT01DEM156N', 'IRLTLT01JPM156N', 'IRLTLT01GBM156N', 'DCOILWTICO', 'DCOILBRENTEU', 'DHHNGSP', 'PCOPPUSDM', 'USREC'];

const cls = v => v == null ? '' : v >= 0 ? 'pos' : 'neg';
const pc = v => v == null || !Number.isFinite(v) ? '—' : `<span class="${cls(v)}">${sgn(v, 1)}%</span>`;

async function main() {
  setStatus('stale', 'Loading…');
  const [d, px] = await Promise.all([fred(IDS, '2000-01-01'), prices([...EQ.map(e => e[0]), ...CMD_ETF.map(c => c[0])], 10)]);
  const rec = recessionRanges(d.USREC);

  // 1. Dollar
  const usd = d.DTWEXBGS || [];
  lineChart('chart-usd', [{ label: 'Broad trade-weighted dollar (Jan 2006 = 100)', data: since(usd, '2006-01-01'), color: COLORS.accent, width: 2 }], { recessions: rec, dec: 1 });
  const usdStrength = (id, inv) => { // % change in the dollar's value
    const a = d[id] || []; return w => { const c = w === 'ytd' ? ytd(a) : change(a, w); return c == null ? null : inv ? (1 / (1 + c / 100) - 1) * 100 : c; };
  };
  const rows = [['Broad dollar', usdStrength('DTWEXBGS', false), last(usd)], ...FX.map(([id, l, inv]) => [`USD/${l}`, usdStrength(id, inv), last(d[id])])];
  el('tbl-fx').innerHTML = `<thead><tr><th>Dollar vs</th><th>Level</th><th>1m</th><th>3m</th><th>YTD</th><th>1y</th></tr></thead><tbody>` +
    rows.map(([l, f, lv]) => `<tr><th>${l}</th><td>${lv ? fmt(lv.value, lv.value > 50 ? 1 : 3) : '—'}</td><td>${pc(f(30))}</td><td>${pc(f(91))}</td><td>${pc(f('ytd'))}</td><td>${pc(f(365))}</td></tr>`).join('') +
    `</tbody><caption class="muted" style="caption-side:bottom;text-align:left;padding-top:6px;font-size:11px">Positive = dollar stronger. Latest ${last(usd) ? dayName(last(usd).date) : '—'}.</caption>`;

  // 2. Equities
  const r = (s, w) => { const a = px[s]; if (!a) return null; return w === 'ytd' ? ytd(a) : change(a, w); };
  const spy1y = r('SPY', 365);
  el('tbl-eq').innerHTML = `<thead><tr><th>Market</th><th>1m</th><th>3m</th><th>YTD</th><th>1y</th><th>1y vs SPY</th></tr></thead><tbody>` +
    EQ.map(([s, l]) => `<tr${s === 'SPY' ? ' class="sf-hl"' : ''}><th>${l} <span class="muted">${s}</span></th><td>${pc(r(s, 30))}</td><td>${pc(r(s, 91))}</td><td>${pc(r(s, 'ytd'))}</td><td>${pc(r(s, 365))}</td><td>${s === 'SPY' ? '—' : pc(r(s, 365) != null && spy1y != null ? r(s, 365) - spy1y : null)}</td></tr>`).join('') + '</tbody>';
  const rebase = s => { const a = since(px[s] || [], new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10)); return a.length ? a.map(o => ({ date: o.date, value: o.value / a[0].value * 100 })) : []; };
  lineChart('chart-eq', [['SPY', COLORS.accent], ['EFA', COLORS.blue], ['EEM', COLORS.green], ['EWJ', COLORS.purple], ['FXI', COLORS.red]].map(([s, c]) => ({ label: s, data: rebase(s), color: c, width: s === 'SPY' ? 2.2 : 1.4 })), { unit: 'month', dec: 1, yTitle: '1 year ago = 100' });

  // 3. Rates abroad
  lineChart('chart-rates', [
    { label: 'US 10Y', data: since(d.DGS10, '2006-01-01'), color: COLORS.accent, width: 2 },
    { label: 'Germany 10Y', data: since(d.IRLTLT01DEM156N, '2006-01-01'), color: COLORS.blue },
    { label: 'UK 10Y', data: since(d.IRLTLT01GBM156N, '2006-01-01'), color: COLORS.purple },
    { label: 'Japan 10Y', data: since(d.IRLTLT01JPM156N, '2006-01-01'), color: COLORS.red },
    { label: 'ECB deposit rate', data: since(d.ECBDFR, '2006-01-01'), color: COLORS.teal, dash: [4, 3], stepped: true },
    { label: 'Fed funds', data: since(d.DFF, '2006-01-01'), color: COLORS.grey, dash: [4, 3] },
  ], { recessions: rec, yTitle: '%', dec: 2 });
  const us10 = last(d.DGS10), de10 = last(d.IRLTLT01DEM156N), jp10 = last(d.IRLTLT01JPM156N), ecb = last(d.ECBDFR), ff = last(d.DFF);
  const usde = us10 && de10 ? (us10.value - de10.value) * 100 : null;
  tiles('tiles-rates', [
    { label: 'Fed funds minus ECB deposit', value: ff && ecb ? `${sgn((ff.value - ecb.value) * 100, 0)}bp` : '—', meta: ecb ? `ECB ${fmt(ecb.value, 2)}% · Fed ${fmt(ff.value, 2)}%` : '' },
    { label: 'US minus German 10Y', value: usde != null ? `${sgn(usde, 0)}bp` : '—', meta: de10 ? `Bund ${fmt(de10.value, 2)}% (monthly, ${dayName(de10.date)})` : '' },
    { label: 'Japan 10Y', value: jp10 ? `${fmt(jp10.value, 2)}%` : '—', meta: jp10 ? `${pctile(d.IRLTLT01JPM156N, 20)}th percentile of 20 years` : '', threshold: 'Higher JGB yields can pull Japanese capital home from US bonds' },
  ]);

  // 4. Commodities
  const cg = combine(px.CPER || [], px.GLD || [], (a, b) => a / b);
  const cgN = cg.length ? cg.map(o => ({ date: o.date, value: o.value / cg[0].value * 100 })) : [];
  lineChart('chart-cg', [
    { label: 'Copper / gold (CPER/GLD, start = 100)', data: cgN, color: COLORS.accent, width: 2 },
    { label: 'US 10Y yield, % (right)', data: since(d.DGS10, cg[0]?.date || '2016-01-01'), color: COLORS.blue, axis: 'y2' },
  ], { dec: 2, y2Title: '%' });
  const fredRow = (id, l, unit) => { const a = d[id] || [], lv = last(a); return `<tr><th>${l}</th><td>${lv ? unit + fmt(lv.value, 2) : '—'}</td><td>${pc(change(a, 30))}</td><td>${pc(change(a, 91))}</td><td>${pc(ytd(a))}</td><td>${pc(change(a, 365))}</td></tr>`; };
  const etfRow = (s, l) => { const a = px[s] || [], lv = last(a); return `<tr><th>${l}</th><td>${lv ? '$' + fmt(lv.value, 2) : '—'}</td><td>${pc(change(a, 30))}</td><td>${pc(change(a, 91))}</td><td>${pc(ytd(a))}</td><td>${pc(change(a, 365))}</td></tr>`; };
  el('tbl-cmd').innerHTML = `<thead><tr><th>Commodity</th><th>Last</th><th>1m</th><th>3m</th><th>YTD</th><th>1y</th></tr></thead><tbody>` +
    fredRow('DCOILWTICO', 'WTI crude ($/bbl)', '$') + fredRow('DCOILBRENTEU', 'Brent crude ($/bbl)', '$') + fredRow('DHHNGSP', 'Henry Hub gas ($/MMBtu)', '$') + fredRow('PCOPPUSDM', 'Copper ($/t, monthly)', '$') +
    CMD_ETF.map(([s, l]) => etfRow(s, l)).join('') + '</tbody>';

  // Verdict
  const u3 = change(usd, 91), uy = ytd(usd);
  const efaRel = r('EFA', 365) != null && spy1y != null ? r('EFA', 365) - spy1y : null;
  const wti = last(d.DCOILWTICO), wtiY = change(d.DCOILWTICO, 365), gold = r('GLD', 365);
  el('verdict').innerHTML =
    (u3 != null ? `The broad dollar is <strong>${u3 >= 0 ? 'up' : 'down'} ${fmt(Math.abs(u3), 1)}%</strong> over three months (${sgn(uy, 1)}% year to date), ${pctile(usd, 20)}th percentile of its 20-year range. ` : '') +
    (efaRel != null ? `Developed markets outside the US have ${efaRel >= 0 ? 'beaten' : 'trailed'} the S&P 500 by ${fmt(Math.abs(efaRel), 1)}pp over the past year in dollar terms. ` : '') +
    (wti ? `WTI is $${fmt(wti.value, 0)} (${sgn(wtiY, 0)}% on the year)` : '') + (gold != null ? `; gold ${sgn(gold, 0)}%.` : '.');

  await asOfLine('asof', { a: usd, b: d.DCOILWTICO, c: px.SPY || [] });
  setStatus('live', 'Snapshot + market data');
}
main().catch(e => { console.error(e); setStatus('error', 'Error loading data'); el('verdict').textContent = 'Data failed to load: ' + e.message; });
