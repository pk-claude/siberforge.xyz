// Policy & Rates: where the Fed is, what the 2-year prices, real rate vs
// neutral, the curve's shape and the 10-year's decomposition.
import { el, fmt, sgn, addDays, fred, last, at, pctile, yoy, since, tiles, lineChart, categoryChart, recessionRanges, asOfLine, setStatus, COLORS, dayName, monthName, change } from '/lib/sf-kit.js';

const MATS = [['DGS1MO', '1M'], ['DGS3MO', '3M'], ['DGS6MO', '6M'], ['DGS1', '1Y'], ['DGS2', '2Y'], ['DGS3', '3Y'], ['DGS5', '5Y'], ['DGS7', '7Y'], ['DGS10', '10Y'], ['DGS20', '20Y'], ['DGS30', '30Y']];
const IDS = ['DFF', 'DFEDTARL', 'DFEDTARU', 'PCEPILFE', 'FEDTARMD', 'FEDTARMDLR', 'DFII5', 'DFII10', 'T10YIE', 'THREEFYTP10', 'USREC', ...MATS.map(m => m[0])];

async function main() {
  setStatus('stale', 'Loading…');
  const d = await fred(IDS, '1985-01-01');
  const rec = recessionRanges(d.USREC);

  const ff = last(d.DFF), lo = last(d.DFEDTARL), hi = last(d.DFEDTARU), two = last(d.DGS2);
  const pce = yoy(d.PCEPILFE || []), lp = last(pce);
  const gap2 = ff && two ? (two.value - ff.value) * 100 : null;
  const sepLR = last(d.FEDTARMDLR);
  const thisYear = new Date().getUTCFullYear();
  // SEP medians: the latest vintage publishes one point per projection year.
  const sepPath = (d.FEDTARMD || []).filter(o => +o.date.slice(0, 4) >= thisYear);
  const neutralReal = sepLR ? sepLR.value - 2 : null;
  const realFF = ff && lp ? ff.value - lp.value : null;
  const realSeries = pce.map(o => { const f = at(d.DFF, addDays(o.date, 27)); return f ? { date: o.date, value: f.value - o.value } : null; }).filter(Boolean);

  const dir = gap2 == null ? '' : gap2 < -25 ? `prices cuts: the 2-year sits ${fmt(Math.abs(gap2), 0)}bp below fed funds` : gap2 > 25 ? `prices hikes: the 2-year sits ${fmt(gap2, 0)}bp above fed funds` : `prices little change: the 2-year is within 25bp of fed funds`;
  const stance = realFF == null || neutralReal == null ? '' : realFF - neutralReal > 1 ? 'clearly restrictive' : realFF - neutralReal > 0.25 ? 'modestly restrictive' : realFF - neutralReal > -0.25 ? 'close to neutral' : 'accommodative';
  el('verdict').innerHTML = `Fed funds target <strong>${lo && hi ? fmt(lo.value, 2) + '&ndash;' + fmt(hi.value, 2) + '%' : '—'}</strong> (effective ${fmt(ff?.value, 2)}%). The market ${dir}. ` +
    (realFF != null ? `The real policy rate is ${sgn(realFF, 1)}% against a neutral proxy of ${fmt(neutralReal, 1)}%, so policy is <strong>${stance}</strong>. ` : '') +
    (sepPath.length ? `The latest FOMC projections have the median rate at ${sepPath.map(o => `${fmt(o.value, 2)}% (end-${o.date.slice(0, 4)})`).join(', ')}.` : '');

  // 1. policy vs market
  lineChart('chart-policy', [
    { label: 'Effective fed funds', data: since(d.DFF, '2000-01-01'), color: COLORS.accent, width: 2, stepped: true },
    { label: '2-year Treasury', data: since(d.DGS2, '2000-01-01'), color: COLORS.blue },
    { label: 'Core PCE, % YoY', data: since(pce, '2000-01-01'), color: COLORS.red, dash: [4, 3] },
  ], { recessions: rec, yTitle: '%', dec: 2 });
  tiles('tiles-policy', [
    { label: 'Target range', value: lo && hi ? `${fmt(lo.value, 2)}–${fmt(hi.value, 2)}%` : '—', meta: ff ? `effective ${fmt(ff.value, 2)}%, ${dayName(ff.date)}` : '' },
    { label: '2Y minus fed funds', value: gap2 != null ? `${sgn(gap2, 0)}bp` : '—', meta: gap2 == null ? '' : gap2 < 0 ? 'market expects cuts' : 'market expects hikes or a hold', status: gap2 == null ? '' : Math.abs(gap2) > 75 ? 'caution' : 'ok', threshold: 'Rough gauge: includes a term premium' },
    { label: 'FOMC median, longer run', value: sepLR ? `${fmt(sepLR.value, 2)}%` : '—', meta: sepLR ? `SEP vintage ${monthName(sepLR.date)}` : '' },
  ]);

  // 2. real rate vs neutral
  lineChart('chart-real', [
    { label: 'Real fed funds (FF − core PCE YoY)', data: since(realSeries, '1990-01-01'), color: COLORS.accent, width: 2, fill: true },
  ], { recessions: rec, yTitle: '%', dec: 2, lines: neutralReal != null ? [{ value: neutralReal, label: `neutral proxy ${fmt(neutralReal, 1)}%`, color: COLORS.green }, { value: 0, color: 'rgba(138,148,163,0.4)' }] : [] });
  tiles('tiles-real', [
    { label: 'Real fed funds', value: realFF != null ? `${sgn(realFF, 2)}%` : '—', meta: `${pctile(realSeries, 20, realFF)}th percentile of 20 years`, status: realFF == null ? '' : realFF - neutralReal > 1 ? 'warn' : realFF - neutralReal > 0.25 ? 'caution' : 'ok' },
    { label: 'Neutral proxy (real)', value: neutralReal != null ? `${fmt(neutralReal, 2)}%` : '—', meta: 'FOMC longer-run median minus 2%', threshold: 'Model estimates of r* range roughly 0.5-1.5%' },
    { label: 'Gap to neutral', value: realFF != null && neutralReal != null ? `${sgn(realFF - neutralReal, 2)}pp` : '—', meta: stance },
  ]);

  // 3. curve snapshot
  const ref = last(d.DGS10)?.date;
  const snap = dt => MATS.map(([id]) => { const o = at(d[id], dt); return o ? o.value : null; });
  const today = snap(ref), m3 = snap(addDays(ref, -91)), m12 = snap(addDays(ref, -365));
  categoryChart('chart-curve', MATS.map(m => m[1]), [
    { label: `Today (${dayName(ref)})`, data: today, color: COLORS.accent, width: 3 },
    { label: '3 months ago', data: m3, color: COLORS.blue, dash: [5, 3] },
    { label: '12 months ago', data: m12, color: COLORS.grey, dash: [2, 3] },
  ], { yTitle: 'yield, %' });
  const s = (a, b) => (a != null && b != null ? (a - b) * 100 : null);
  const s210 = s(today[8], today[4]), s310 = s(today[8], today[1]);
  const d2 = change(d.DGS2, 91, 'diff'), d10 = change(d.DGS10, 91, 'diff');
  const slope = d2 == null || d10 == null ? null : (d10 - d2) * 100, lvl = d2 == null ? 0 : (d2 + d10) / 2;
  const shape = slope == null ? '' : Math.abs(slope) < 10 ? `roughly parallel ${lvl < 0 ? 'fall' : 'rise'}` :
    slope > 0 ? (lvl < 0 ? 'bull steepening (front end falling faster)' : 'bear steepening (long end rising faster)')
              : (lvl < 0 ? 'bull flattening (long end falling faster)' : 'bear flattening (front end rising faster)');
  tiles('tiles-curve', [
    { label: '10Y − 2Y', value: s210 != null ? `${sgn(s210, 0)}bp` : '—', meta: `3m ago ${sgn(s(m3[8], m3[4]), 0)}bp`, status: s210 < 0 ? 'warn' : 'ok' },
    { label: '10Y − 3M', value: s310 != null ? `${sgn(s310, 0)}bp` : '—', meta: `3m ago ${sgn(s(m3[8], m3[1]), 0)}bp`, status: s310 < 0 ? 'warn' : 'ok' },
    { label: '3-month change', value: `2Y ${sgn(d2 * 100, 0)}bp · 10Y ${sgn(d10 * 100, 0)}bp`, meta: shape },
  ]);

  // 4. 10y decomposition
  lineChart('chart-10y', [
    { label: '10Y nominal', data: since(d.DGS10, '2005-01-01'), color: COLORS.accent, width: 2 },
    { label: '10Y real (TIPS)', data: since(d.DFII10, '2005-01-01'), color: COLORS.blue },
    { label: '10Y breakeven', data: since(d.T10YIE, '2005-01-01'), color: COLORS.red },
    { label: 'Term premium (Kim-Wright)', data: since(d.THREEFYTP10, '2005-01-01'), color: COLORS.green, dash: [4, 3] },
  ], { recessions: rec, yTitle: '%', dec: 2, lines: [{ value: 0, color: 'rgba(138,148,163,0.4)' }] });
  const tp = last(d.THREEFYTP10);
  tiles('tiles-10y', [
    { label: '10Y real yield', value: `${fmt(last(d.DFII10)?.value, 2)}%`, meta: `${pctile(d.DFII10, 20)}th percentile of 20 years` },
    { label: '10Y breakeven inflation', value: `${fmt(last(d.T10YIE)?.value, 2)}%`, meta: 'market-implied average CPI over 10 years' },
    { label: 'Term premium', value: tp ? `${sgn(tp.value, 2)}%` : '—', meta: tp ? `${pctile(d.THREEFYTP10, 20)}th percentile of 20 years` : '', threshold: 'Negative 2016-2021 under QE; rising premium = investors want paying for duration' },
  ]);

  await asOfLine('asof', { a: d.DFF, b: d.DGS10, c: d.PCEPILFE });
  setStatus('live', 'Snapshot data');
}
main().catch(e => { console.error(e); setStatus('error', 'Error loading data'); el('verdict').textContent = 'Data failed to load: ' + e.message; });
