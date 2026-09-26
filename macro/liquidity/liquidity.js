// Liquidity & Fiscal.
import { el, fmt, sgn, addDays, fred, last, at, asof, pctile, since, tiles, lineChart, recessionRanges, asOfLine, setStatus, COLORS, change, dayName, monthName } from '/lib/sf-kit.js';

const IDS = ['WALCL', 'WTREGEN', 'RRPONTSYD', 'WRESBAL', 'SP500', 'MTSDS133FMS', 'GDP', 'A091RC1Q027SBEA', 'FGRECPT', 'GFDEGDQ188S', 'USREC'];

async function main() {
  setStatus('stale', 'Loading…');
  const d = await fred(IDS, '1980-01-01');
  const rec = recessionRanges(d.USREC);

  // Net liquidity, weekly on WALCL dates, $bn.
  const tga = d.WTREGEN || [], rrp = d.RRPONTSYD || [];
  const netliq = (d.WALCL || []).map(o => {
    const t = at(tga, o.date), r = at(rrp, o.date);
    return t ? { date: o.date, value: o.value / 1000 - t.value / 1000 - (r && o.date >= '2013-09-23' ? r.value : 0) } : null;
  }).filter(Boolean);
  const nl = last(netliq), nl13 = change(netliq, 91, 'diff'), nl52 = change(netliq, 365, 'diff');
  const spx = since(d.SP500, '2016-01-01');
  lineChart('chart-netliq', [
    { label: 'Net liquidity ($bn)', data: since(netliq, '2016-01-01'), color: COLORS.accent, width: 2 },
    { label: 'S&P 500 (right)', data: spx, color: COLORS.blue, axis: 'y2' },
  ], { recessions: rec, yTitle: '$bn', y2Title: 'index', dec: 0 });
  tiles('tiles-netliq', [
    { label: 'Net liquidity', value: nl ? `$${fmt(nl.value / 1000, 2)}tn` : '—', meta: nl ? `week of ${dayName(nl.date)}` : '' },
    { label: 'Change, 3 months', value: nl13 != null ? `${sgn(nl13, 0)}bn` : '—', meta: `12 months: ${sgn(nl52, 0)}bn`, status: nl13 == null ? '' : nl13 < -150 ? 'caution' : 'ok' },
    { label: 'Components', value: `Fed $${fmt(last(d.WALCL)?.value / 1e6, 2)}tn`, meta: `TGA $${fmt(last(tga)?.value / 1000, 0)}bn · RRP $${fmt(last(rrp)?.value, 0)}bn`, threshold: 'A TGA rebuild drains liquidity even with the Fed balance sheet flat' },
  ]);

  // Reserves / GDP.
  const gdp = d.GDP || [];
  const resPct = asof(d.WRESBAL || [], gdp, (r, g) => r / 1000 / g * 100);
  const rp = last(resPct);
  lineChart('chart-res', [
    { label: 'Reserves, % of GDP', data: since(resPct, '2009-01-01'), color: COLORS.green, width: 2, fill: true },
  ], { recessions: rec, yTitle: '% of GDP', dec: 1, lines: [{ value: 7, label: 'Sep-2019 repo stress ~7%', color: COLORS.red }] });
  tiles('tiles-res', [
    { label: 'Reserve balances', value: `$${fmt(last(d.WRESBAL)?.value / 1e6, 2)}tn`, meta: rp ? `${fmt(rp.value, 1)}% of GDP` : '' },
    { label: 'Change, 12 months', value: `${sgn(change(d.WRESBAL, 365, 'diff') / 1000, 0)}bn`, meta: 'balance-sheet runoff and TGA swings' },
  ]);

  // Fiscal.
  const mts = d.MTSDS133FMS || [];
  const roll = [];
  for (let i = 11; i < mts.length; i++) {
    const sum = mts.slice(i - 11, i + 1).reduce((a, o) => a + o.value, 0) / 1000; // $bn
    const g = at(gdp, mts[i].date); if (g) roll.push({ date: mts[i].date, value: -sum / g.value * 100 });
  }
  const intShare = asof(d.A091RC1Q027SBEA || [], d.FGRECPT || [], (a, b) => a / b * 100);
  const def = last(roll), is = last(intShare), debt = last(d.GFDEGDQ188S);
  lineChart('chart-fiscal', [
    { label: 'Deficit, 12m rolling, % of GDP', data: since(roll, '1990-01-01'), color: COLORS.red, width: 2 },
    { label: 'Interest payments, % of receipts', data: since(intShare, '1990-01-01'), color: COLORS.accent },
  ], { recessions: rec, yTitle: '%', dec: 1 });
  const unemploymentLike = def && def.value > 5 ? 'large for an economy not in recession' : 'moderate';
  tiles('tiles-fiscal', [
    { label: 'Deficit, last 12 months', value: def ? `${fmt(def.value, 1)}% of GDP` : '—', meta: def ? `through ${monthName(def.date)}` : '', status: def ? (def.value > 5 ? 'caution' : 'ok') : '', threshold: 'Post-1990 average outside recessions: about 3%' },
    { label: 'Interest / receipts', value: is ? `${fmt(is.value, 1)}%` : '—', meta: is ? `${monthName(is.date)} quarter; ${pctile(intShare, 40)}th pct of 40 years` : '', status: is ? (is.value > 18 ? 'warn' : is.value > 14 ? 'caution' : 'ok') : '' },
    { label: 'Federal debt', value: debt ? `${fmt(debt.value, 0)}% of GDP` : '—', meta: debt ? monthName(debt.date) : '' },
  ]);

  el('verdict').innerHTML =
    (nl ? `Net Fed liquidity is <strong>$${fmt(nl.value / 1000, 2)}tn</strong>, ${nl13 >= 0 ? 'up' : 'down'} $${fmt(Math.abs(nl13), 0)}bn over three months. ` : '') +
    (rp ? `Reserves are ${fmt(rp.value, 1)}% of GDP, against roughly 7% when repo markets seized in 2019. ` : '') +
    (def ? `The federal deficit runs at <strong>${fmt(def.value, 1)}% of GDP</strong> over the last 12 months, ${unemploymentLike}, and interest takes ${fmt(is?.value, 1)}% of federal receipts.` : '');

  await asOfLine('asof', { a: d.WALCL, b: mts, c: gdp });
  setStatus('live', 'Snapshot data');
}
main().catch(e => { console.error(e); setStatus('error', 'Error loading data'); el('verdict').textContent = 'Data failed to load: ' + e.message; });
