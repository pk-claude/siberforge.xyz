// Markets overview: sector scoreboard, breadth and volatility.
import { el, fmt, sgn, fred, prices, last, at, change, ytd, pctile, since, combine, lineChart, tiles, COLORS, addDays } from '/lib/sf-kit.js';

const SECT = [['XLK', 'Technology'], ['XLC', 'Communication'], ['XLY', 'Discretionary'], ['XLF', 'Financials'], ['XLI', 'Industrials'], ['XLV', 'Health Care'], ['XLP', 'Staples'], ['XLE', 'Energy'], ['XLU', 'Utilities'], ['XLB', 'Materials'], ['XLRE', 'Real Estate']];
const pc = v => v == null || !Number.isFinite(v) ? '—' : `<span class="${v >= 0 ? 'pos' : 'neg'}">${sgn(v, 1)}%</span>`;
const sma = (a, n) => a.length >= n ? a.slice(-n).reduce((s, o) => s + o.value, 0) / n : null;

async function main() {
  const [px, d] = await Promise.all([prices(['SPY', 'RSP', 'IWM', ...SECT.map(s => s[0])], 5), fred(['VIXCLS'], '2006-01-01')]);
  const spy = px.SPY || [];
  const rows = SECT.map(([s, name]) => {
    const a = px[s] || [];
    const m200 = sma(a, 200), l = last(a);
    return { s, name, m1: change(a, 30), m3: change(a, 91), ytd: ytd(a), y1: change(a, 365), above: l && m200 ? l.value > m200 : null, dist: l && m200 ? (l.value / m200 - 1) * 100 : null };
  }).sort((a, b) => (b.m3 ?? -99) - (a.m3 ?? -99));
  const spyRow = { m1: change(spy, 30), m3: change(spy, 91), ytd: ytd(spy), y1: change(spy, 365) };
  el('mk-sectors').innerHTML = `<thead><tr><th>Sector (sorted by 3m)</th><th>1m</th><th>3m</th><th>YTD</th><th>1y</th><th>vs 200d</th></tr></thead><tbody>` +
    `<tr class="sf-hl"><th>S&amp;P 500 <span class="muted">SPY</span></th><td>${pc(spyRow.m1)}</td><td>${pc(spyRow.m3)}</td><td>${pc(spyRow.ytd)}</td><td>${pc(spyRow.y1)}</td><td>${pc(sma(spy, 200) ? (last(spy).value / sma(spy, 200) - 1) * 100 : null)}</td></tr>` +
    rows.map(r => `<tr><th><a href="#${r.s}" style="color:inherit">${r.name}</a> <span class="muted">${r.s}</span></th><td>${pc(r.m1)}</td><td>${pc(r.m3)}</td><td>${pc(r.ytd)}</td><td>${pc(r.y1)}</td><td>${pc(r.dist)}</td></tr>`).join('') + '</tbody>';

  const above = rows.filter(r => r.above).length, total = rows.filter(r => r.above != null).length;
  const rel = (a, b, days) => { const x = change(px[a] || [], days), y = change(px[b] || [], days); return x != null && y != null ? x - y : null; };
  const ew3 = rel('RSP', 'SPY', 91), sc3 = rel('IWM', 'SPY', 91);
  const vix = last(d.VIXCLS || []), vixP = pctile(d.VIXCLS || [], 20);
  tiles('mk-breadth', [
    { label: 'Sectors above 200-day average', value: `${above} of ${total}`, meta: 'trend breadth across the 11 SPDRs', status: above >= 8 ? 'ok' : above >= 5 ? 'caution' : 'warn' },
    { label: 'Equal-weight vs cap-weight, 3m', value: ew3 != null ? `${sgn(ew3, 1)}pp` : '—', meta: 'RSP minus SPY: negative = narrow, mega-cap-led market', status: ew3 == null ? '' : ew3 < -3 ? 'caution' : 'ok' },
    { label: 'Small caps vs S&P 500, 3m', value: sc3 != null ? `${sgn(sc3, 1)}pp` : '—', meta: 'IWM minus SPY: small caps are more sensitive to credit and growth' },
    { label: 'VIX', value: vix ? fmt(vix.value, 1) : '—', meta: vix ? `${vixP}th percentile of 20 years` : '', status: vix ? (vix.value > 30 ? 'warn' : vix.value > 20 ? 'caution' : 'ok') : '', threshold: 'Below ~15 = calm; above 30 = stress' },
  ]);

  const from = addDays(last(spy)?.date || '2025-01-01', -365);
  const reb = s => { const r = combine(since(px[s] || [], from), since(spy, from), (a, b) => a / b); return r.length ? r.map(o => ({ date: o.date, value: o.value / r[0].value * 100 })) : []; };
  const top = rows.slice(0, 2).map(r => r.s), bot = rows.slice(-2).map(r => r.s);
  lineChart('mk-rel', [...top.map((s, i) => ({ label: `${s} / SPY`, data: reb(s), color: [COLORS.green, COLORS.teal][i] })), ...bot.map((s, i) => ({ label: `${s} / SPY`, data: reb(s), color: [COLORS.red, COLORS.pink][i] })), { label: 'RSP / SPY (breadth)', data: reb('RSP'), color: COLORS.accent, dash: [4, 3] }], { unit: 'month', dec: 1, yTitle: 'relative, 1y ago = 100', lines: [{ value: 100, color: 'rgba(138,148,163,0.5)' }] });

  const l = last(spy), m200 = sma(spy, 200);
  el('mk-verdict').innerHTML = l ? `The S&P 500 is ${sgn(spyRow.ytd, 1)}% year to date and ${m200 ? (l.value > m200 ? 'above' : 'below') + ' its 200-day average' : ''}; <strong>${above} of ${total} sectors</strong> are in uptrends. ` +
    `Leadership over three months: ${rows.slice(0, 2).map(r => r.name).join(' and ')}; laggards: ${rows.slice(-2).map(r => r.name).join(' and ')}. ` +
    (ew3 != null ? `The equal-weight index has ${ew3 >= 0 ? 'beaten' : 'trailed'} the cap-weighted one by ${fmt(Math.abs(ew3), 1)}pp, so the advance is ${ew3 < -2 ? 'narrow' : ew3 > 2 ? 'broad' : 'neither especially broad nor narrow'}. ` : '') +
    (vix ? `VIX ${fmt(vix.value, 1)} (${vixP}th percentile).` : '') : 'Market data unavailable.';
}
main().catch(e => { console.error(e); el('mk-verdict').textContent = 'Market data failed to load.'; });
