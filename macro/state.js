// State of the Cycle -- the Macro front door. One screen: verdict, eight dials,
// what changed, what would change the call. Every number is computed here
// from the FRED snapshot; no prose is hand-written about current values.

import { el as $el, fmt, sgn, esc, addDays, todayIso, fred, last, at, pctile, yoy, tiles, lineChart, recessionRanges, asOfLine, setStatus, since, COLORS, monthName } from '/lib/sf-kit.js';
import { SPECS, seriesFor, computeComposite, phaseFor, termSpreadProbit } from '/lib/composite-scores.js';
import { buildRegimeMap, smoothCurrentRegime, regimeConviction, REGIMES, sixMonthAnnualized, toMonthlyMap } from '/macro/regime/regimes.js';

// Tolerant element lookup: the landing page embeds this module with only the
// verdict and dials containers present.
const el = id => $el(id) || { set innerHTML(v) {}, set textContent(v) {} };

const KINDS = ['cycle', 'labor', 'inflation', 'credit', 'housing', 'consumer'];
const LABELS = { cycle: 'Recession risk', labor: 'Labor market', inflation: 'Inflation persistence', credit: 'Credit & liquidity', housing: 'Housing', consumer: 'Consumer stress' };
const PAGES = { cycle: '/macro/cycle/', labor: '/macro/labor/', inflation: '/macro/inflation/', credit: '/macro/credit/', housing: '/macro/housing/', consumer: '/macro/consumer/' };
const EXTRA = ['CPILFESL', 'INDPRO', 'PAYEMS', 'RRSFS', 'DFF', 'PCEPILFE', 'NFCI', 'UNRATE', 'SAHMREALTIME', 'CFNAIMA3', 'T10Y3M', 'USREC', 'BAA10Y'];

const median = a => { const s = [...a].sort((x, y) => x - y), h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };

function monthsAgo(n) { const d = new Date(); d.setUTCMonth(d.getUTCMonth() - n); return d.toISOString().slice(0, 10); }

async function main() {
  setStatus('stale', 'Loading…');
  const ids = [...new Set([...KINDS.flatMap(seriesFor), ...EXTRA])];
  const data = await fred(ids, '1960-01-01');

  // ---------- composites ----------
  const now = {}, m1 = {}, m3 = {}, m12 = {};
  for (const k of KINDS) {
    now[k] = computeComposite(k, data);
    m1[k]  = computeComposite(k, data, monthsAgo(1));
    m3[k]  = computeComposite(k, data, monthsAgo(3));
    m12[k] = computeComposite(k, data, monthsAgo(12));
  }

  // ---------- regime ----------
  const regimeMap = buildRegimeMap({ cpi: data.CPILFESL || [], indpro: data.INDPRO || [], payems: data.PAYEMS || [], rrsfs: data.RRSFS || [] });
  const months = [...regimeMap.keys()].sort();
  const latestYm = months[months.length - 1];
  const latest = regimeMap.get(latestYm);
  const smoothed = smoothCurrentRegime(regimeMap, 3);
  const conv = regimeConviction(latest, smoothed);
  const R = smoothed ? REGIMES[smoothed.regime] : null;

  // ---------- policy ----------
  const corePce = yoy(data.PCEPILFE || []);
  const dff = data.DFF || [];
  const lDff = last(dff), lPce = last(corePce);
  const realFF = lDff && lPce ? lDff.value - lPce.value : null;
  const realHist = corePce.map(o => { const f = at(dff, addDays(o.date, 27)); return f ? { date: o.date, value: f.value - o.value } : null; }).filter(Boolean);
  const realPct = realHist.length ? pctile(realHist, 20, realFF) : null;
  const stance = realFF == null ? 'unknown' : realFF > 1.5 ? 'restrictive' : realFF > 0.5 ? 'mildly restrictive' : realFF > -0.5 ? 'near neutral' : 'accommodative';

  // ---------- recession odds ----------
  const probit = termSpreadProbit(data.T10Y3M || []);
  const lProb = last(probit), lSahm = last(data.SAHMREALTIME || []);

  // ---------- verdict ----------
  const cyc = now.cycle, cycPh = cyc ? phaseFor('cycle', cyc.score) : null;
  const gTxt = latest ? (latest.growthZ >= 0 ? 'growth above its 10-year norm' : 'growth below its 10-year norm') : '';
  const iTxt = latest ? (latest.inflationZ >= 0 ? 'core inflation running above its 10-year norm' : 'core inflation running below its 10-year norm') : '';
  const infPh = now.inflation ? phaseFor('inflation', now.inflation.score).label.toLowerCase() : '';
  el('verdict').innerHTML =
    (R ? `<strong>${R.label}</strong> (${conv ? conv.label.toLowerCase() : '—'} conviction): ${gTxt}, ${iTxt}. ` : '') +
    (cyc ? `Recession risk reads <strong>${cycPh.label.toLowerCase()}</strong> at ${fmt(cyc.score, 0)}/100; the yield-curve model puts 12-month odds at ${fmt(lProb?.value, 0)}% and the Sahm rule is at ${fmt(lSahm?.value, 2)}pp (trigger 0.50). ` : '') +
    (now.inflation ? `Inflation persistence is ${infPh} (${fmt(now.inflation.score, 0)}/100). ` : '') +
    (realFF != null ? `Policy is ${stance}: real fed funds ${sgn(realFF, 1)}%, ${realPct}th percentile of 20 years.` : '');

  // ---------- dials ----------
  const cfnai = last(data.CFNAIMA3 || []);
  const nfci = last(data.NFCI || []);
  const nfciPct = pctile(data.NFCI || [], 20);
  const dialFor = (k) => {
    const s = now[k]; if (!s) return null;
    const ph = phaseFor(k, s.score);
    const d3 = m3[k] ? s.score - m3[k].score : null;
    const top = [...s.signals].sort((a, b) => b.score * b.weight - a.score * a.weight)[0];
    return { name: LABELS[k], href: PAGES[k], val: fmt(s.score, 0), unit: '/100', label: ph.label, color: ph.color, pos: s.score, chg: d3, chgUnit: 'pt',
      read: `Highest-risk input: ${top.name} (${top.raw}, ${fmt(top.score, 0)}th pct).` };
  };
  const growthColor = latest ? (latest.growthZ >= 0.25 ? COLORS.green : latest.growthZ <= -0.25 ? COLORS.red : COLORS.accent) : COLORS.grey;
  const dials = [
    { name: 'Growth', href: '/macro/regime/', val: latest ? sgn(latest.growthZ, 2) : '—', unit: 'z', label: latest ? (latest.growthZ >= 0 ? 'Above trend' : 'Below trend') : '—', color: growthColor,
      pos: latest ? Math.max(0, Math.min(100, 50 - latest.growthZ * 25)) : null, chg: null,
      read: `CFNAI 3-mo avg ${cfnai ? sgn(cfnai.value, 2) : '—'} (0 = trend growth; below -0.7 has marked recessions). ${latest ? 'Regime data through ' + monthName(latestYm + '-01') + '.' : ''}` },
    dialFor('labor'),
    dialFor('inflation'),
    { name: 'Policy stance', href: '/macro/policy/', val: realFF != null ? sgn(realFF, 1) : '—', unit: '% real', label: stance.charAt(0).toUpperCase() + stance.slice(1),
      color: realFF == null ? COLORS.grey : realFF > 1.5 ? COLORS.red : realFF > 0.5 ? COLORS.accent : COLORS.green, pos: realPct, chg: null,
      read: `Fed funds ${fmt(lDff?.value, 2)}% less core PCE ${fmt(lPce?.value, 1)}% YoY. ${realPct != null ? realPct + 'th percentile of the last 20 years.' : ''}` },
    { name: 'Financial conditions', href: '/macro/credit/', val: nfci ? sgn(nfci.value, 2) : '—', unit: 'NFCI', label: nfci ? (nfci.value < -0.3 ? 'Loose' : nfci.value > 0.3 ? 'Tight' : 'Average') : '—',
      color: nfci ? (nfci.value < -0.3 ? COLORS.green : nfci.value > 0.3 ? COLORS.red : COLORS.accent) : COLORS.grey, pos: nfciPct, chg: null,
      read: `Chicago Fed index, week of ${nfci ? nfci.date : '—'}; ${nfciPct}th percentile of 20 years (higher = tighter).` },
    dialFor('credit'),
    dialFor('housing'),
    dialFor('consumer'),
  ].filter(Boolean);
  el('dials').innerHTML = dials.map(d => `<a class="sf-dial" href="${d.href}" style="--dial:${d.color}">
      <div class="sf-dial-top"><span class="sf-dial-name">${d.name}</span>${d.chg != null ? `<span class="sf-dial-chg ${d.chg > 1 ? 'up' : d.chg < -1 ? 'down' : ''}">${sgn(d.chg, 0)}${d.chgUnit} 3m</span>` : ''}</div>
      <div class="sf-dial-val">${d.val}<small>${d.unit}</small></div>
      <div class="sf-dial-label">${d.label}</div>
      ${d.pos != null ? `<div class="sf-bar" aria-hidden="true"><i style="left:${Math.max(0, Math.min(100, d.pos))}%"></i></div>` : ''}
      <div class="sf-dial-read">${d.read}</div>
    </a>`).join('');

  // ---------- what changed ----------
  const moves = KINDS.filter(k => now[k] && m3[k]).map(k => {
    const d = now[k].score - m3[k].score;
    const prev = new Map(m3[k].signals.map(s => [s.name, s]));
    const driver = now[k].signals.map(s => ({ s, d: s.score - (prev.get(s.name)?.score ?? s.score) })).sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0];
    return { k, d, driver };
  }).sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
  const regime3 = regimeMap.get(months[months.length - 4]);
  const items = [];
  if (regime3 && latest && regime3.regime !== latest.regime) items.push(`<b>Regime</b> moved from ${REGIMES[regime3.regime].label} to ${REGIMES[latest.regime].label} on the monthly read.`);
  for (const m of moves.slice(0, 4)) {
    const phNow = phaseFor(m.k, now[m.k].score).label, phThen = phaseFor(m.k, m3[m.k].score).label;
    items.push(`<b>${LABELS[m.k]}</b> ${m.d >= 0 ? 'rose' : 'fell'} ${fmt(Math.abs(m.d), 0)} pts to ${fmt(now[m.k].score, 0)}${phNow !== phThen ? ` (${phThen} &rarr; ${phNow})` : ''}. ` +
      (m.driver && Math.abs(m.driver.d) >= 3 ? `<span class="muted">Largest move: ${m.driver.s.name}, now ${m.driver.s.raw}.</span>` : '<span class="muted">No single input moved much.</span>'));
  }
  el('changed').innerHTML = items.map(x => `<li>${x}</li>`).join('') || '<li class="muted">Little has moved.</li>';

  // ---------- what would change the call ----------
  const flips = [];
  const core6 = sixMonthAnnualized(toMonthlyMap(data.CPILFESL || []));
  if (core6.length > 120 && latest) {
    const med = median(core6.slice(-120).map(o => o.value)), cur = core6[core6.length - 1].value;
    flips.push(`<b>Inflation axis.</b> Core CPI 6-month annualized is ${fmt(cur, 1)}%; the 10-year median is ${fmt(med, 1)}%. ${cur < med ? `Readings above ${fmt(med, 1)}% would move the regime toward ${latest.growthZ >= 0 ? 'Reflation' : 'Stagflation'}.` : `Readings below ${fmt(med, 1)}% would move it toward ${latest.growthZ >= 0 ? 'Goldilocks' : 'Disinflation'}.`}`);
  }
  const comp = [['PAYEMS', 'Payroll growth'], ['INDPRO', 'Industrial production'], ['RRSFS', 'Real retail sales']].map(([id, name]) => {
    const r = sixMonthAnnualized(toMonthlyMap(data[id] || [])); if (r.length < 120) return null;
    return `${name} ${fmt(r[r.length - 1].value, 1)}% (median ${fmt(median(r.slice(-120).map(o => o.value)), 1)}%)`;
  }).filter(Boolean);
  if (latest && comp.length) flips.push(`<b>Growth axis</b> sits ${fmt(Math.abs(latest.growthZ), 2)} z ${latest.growthZ >= 0 ? 'above' : 'below'} zero. It averages three 6-month annualized rates against their 10-year medians: ${comp.join('; ')}.`);
  const un = data.UNRATE || [];
  if (un.length > 15) {
    const ma3 = un.map((o, i) => i >= 2 ? (un[i].value + un[i - 1].value + un[i - 2].value) / 3 : null);
    const n = un.length - 1, prior = ma3.slice(n - 12, n).filter(v => v != null);
    const trig = Math.min(...prior) + 0.5;
    flips.push(`<b>Sahm trigger.</b> The 3-month average jobless rate is ${fmt(ma3[n], 2)}%; it triggers at about ${fmt(trig, 2)}%, i.e. a ${fmt(trig - ma3[n], 2)}pp rise.`);
  }
  const t3 = last(data.T10Y3M || []);
  if (t3) flips.push(`<b>Curve model above 30%</b> needs the 10Y&minus;3M spread (now ${fmt(t3.value * 100, 0)}bp) to average below about 0bp for a month.`);
  if (conv) flips.push(`<b>Conviction</b> is ${conv.label.toLowerCase()}: ${esc(conv.desc)}`);
  el('flip').innerHTML = flips.map(x => `<li>${x}</li>`).join('');

  // ---------- scorecard ----------
  const cell = (s, k) => s ? `<td style="color:${phaseFor(k, s.score).color}">${fmt(s.score, 0)}</td>` : '<td>—</td>';
  el('scorecard').innerHTML = `<thead><tr><th>Composite</th><th>Now</th><th>Phase</th><th>1m ago</th><th>3m ago</th><th>12m ago</th><th>Stale inputs</th></tr></thead><tbody>` +
    KINDS.map(k => `<tr><th><a href="${PAGES[k]}">${LABELS[k]}</a></th>${cell(now[k], k)}<td>${now[k] ? phaseFor(k, now[k].score).label : '—'}</td>${cell(m1[k], k)}${cell(m3[k], k)}${cell(m12[k], k)}<td class="muted">${now[k]?.stale.join(', ') || '—'}</td></tr>`).join('') + '</tbody>';

  // ---------- recession odds chart ----------
  const rec = recessionRanges(data.USREC || []);
  const cycHist = [];
  if ($el('chart-odds')) for (let y = 1995; y <= new Date().getUTCFullYear(); y++) for (const mm of ['03', '06', '09', '12']) {
    const d = `${y}-${mm}-28`; if (d > todayIso()) break;
    const s = computeComposite('cycle', data, d); if (s) cycHist.push({ date: d, value: s.score });
  }
  if ($el('chart-odds')) lineChart('chart-odds', [
    { label: 'Curve model: P(recession in 12m), %', data: since(probit, '1995-01-01'), color: COLORS.red },
    { label: 'Cycle composite (0-100)', data: cycHist, color: COLORS.accent, width: 2 },
    { label: 'Sahm rule x 100, capped (trigger = 50)', data: since(data.SAHMREALTIME || [], '1995-01-01').map(o => ({ date: o.date, value: Math.min(100, Math.max(0, o.value * 100)) })), color: COLORS.blue, dash: [4, 3] },
  ], { recessions: rec, yMin: 0, yMax: 100, dec: 0, lines: [{ value: 50, label: '50', color: 'rgba(138,148,163,0.6)' }] });
  tiles('tiles-odds', [
    { label: 'Curve model (12m ahead)', value: `${fmt(lProb?.value, 0)}%`, meta: lProb ? `${monthName(lProb.date)} average spread` : '', status: lProb ? (lProb.value > 30 ? 'warn' : lProb.value > 20 ? 'caution' : 'ok') : '', threshold: 'Above 30% preceded every recession since 1968; also read 60%+ in 2023 with none' },
    { label: 'Sahm rule (real-time)', value: `${fmt(lSahm?.value, 2)}pp`, meta: lSahm ? monthName(lSahm.date) : '', status: lSahm ? (lSahm.value >= 0.5 ? 'warn' : lSahm.value >= 0.3 ? 'caution' : 'ok') : '', threshold: '0.50pp confirms a recession under way; triggered Jul-2024 without one' },
    { label: 'Cycle composite', value: cyc ? `${fmt(cyc.score, 0)}/100` : '—', meta: cycPh ? cycPh.label : '', status: cyc ? (cyc.score >= 65 ? 'warn' : cyc.score >= 45 ? 'caution' : 'ok') : '', threshold: 'Percentile blend of 5 signals; read above 65 before 2001 and 2008' },
  ]);

  await asOfLine('asof', { a: data.PAYEMS, b: data.CPILFESL, c: data.NFCI, d: data.T10Y3M });
  el('last-updated').textContent = '';
  setStatus('live', 'Snapshot data');
}

main().catch(err => { console.error(err); setStatus('error', 'Error loading data'); el('verdict').textContent = 'Data failed to load: ' + err.message; });
