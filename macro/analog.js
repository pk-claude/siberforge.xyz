// analog.js -- "When did it last look like this?" on the State of the Cycle page.
//
// Compares today's dials with the same dials at every past month-end
// (data/macro/state-history.json, written by scripts/build-state.mjs from the
// same code the page runs) and reports the closest matches and what followed.
// A description of history, never a forecast: the wording here is deliberate.
import { el, fmt, sgn, esc, addDays, at, last, prices, lineChart, tiles, recessionRanges, COLORS, monthName } from '/lib/sf-kit.js';
import { phaseFor } from '/lib/composite-scores.js';
import { KINDS, LABELS, dialDistance } from '/macro/state-core.js';
import { REGIMES } from '/macro/regime/regimes.js';

// A past month qualifies as a match only if every score had at least this much
// of its inputs (by weight). Several inputs start in the 2000s, so earlier
// scores rest on fewer series; those cells are marked.
const MIN_COVERAGE = 60;
const FIXED = [['2007-12-31', 'Dec 2007', 'eve of the financial crisis'], ['2020-02-29', 'Feb 2020', 'month before Covid'], ['2022-06-30', 'Jun 2022', 'inflation peak']];

const asVec = r => ({ scores: Object.fromEntries(KINDS.map((k, i) => [k, r.s[i]])), growthZ: r.g, inflationZ: r.i });

export async function renderAnalog({ S, data }) {
  const host = el('analog');
  if (!host) return;
  let hist;
  try {
    const res = await fetch('/data/macro/state-history.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    hist = await res.json();
  } catch (e) { host.hidden = true; return; }

  const todayVec = { scores: Object.fromEntries(KINDS.map(k => [k, S.scores[k] ? S.scores[k].score : null])), growthZ: S.latest ? S.latest.growthZ : null, inflationZ: S.latest ? S.latest.inflationZ : null };
  const todayIso = new Date().toISOString().slice(0, 10);
  // Matches must be at least two years old: the months just behind us resemble
  // today trivially and their aftermath is still unfolding.
  const cutoff = addDays(todayIso, -730);

  const rows = hist.rows.map(r => ({ ...r, dist: dialDistance(todayVec, asVec(r)), full: r.c.every(c => c >= MIN_COVERAGE) }));
  const eligible = rows.filter(r => r.dist != null && r.full && r.d <= cutoff);
  if (!eligible.length) { host.hidden = true; return; }

  // Closest months, at least 18 months apart so one episode is counted once.
  const picks = [];
  for (const r of [...eligible].sort((a, b) => a.dist - b.dist)) {
    if (picks.every(p => Math.abs(new Date(p.d) - new Date(r.d)) > 548 * 864e5)) picks.push(r);
    if (picks.length === 3) break;
  }
  const best = picks[0];
  const fixed = FIXED.map(([d, label, why]) => ({ row: rows.find(r => r.d === d), label, why })).filter(x => x.row);

  // ---- comparison table ----
  const cols = [{ label: `Closest match<br><span class="muted">${monthName(best.d)}</span>`, row: best }]
    .concat(fixed.map(f => ({ label: `${f.label}<br><span class="muted">${esc(f.why)}</span>`, row: f.row })));
  const scoreCell = (k, v, partial) => v == null ? '<td>—</td>' : `<td style="color:${phaseFor(k, v).color}">${fmt(v, 0)}${partial ? '<sup title="Fewer inputs had data then">*</sup>' : ''}</td>`;
  const line = (name, todayHtml, fn) => `<tr><th>${name}</th>${todayHtml}${cols.map(c => fn(c.row)).join('')}</tr>`;
  const anyPartial = cols.some(c => c.row.c.some(x => x < 100));
  const body = [
    line('Growth vs 10-year norm (z)', `<td>${sgn(todayVec.growthZ, 2)}</td>`, r => `<td>${sgn(r.g, 2)}</td>`),
    line('Core inflation vs norm (z)', `<td>${sgn(todayVec.inflationZ, 2)}</td>`, r => `<td>${sgn(r.i, 2)}</td>`),
    ...KINDS.map((k, i) => line(`<a href="/macro/${k === 'credit' ? 'credit' : k === 'cycle' ? 'cycle' : k}/">${LABELS[k]}</a>`,
      scoreCell(k, todayVec.scores[k], false), r => scoreCell(k, r.s[i], r.c[i] < 100))),
    line('Real fed funds', `<td>${S.realFF != null ? sgn(S.realFF, 1) + '%' : '—'}</td>`, r => `<td>${r.ff != null ? sgn(r.ff, 1) + '%' : '—'}</td>`),
    line('Financial conditions (NFCI)', `<td>${S.nfci ? sgn(S.nfci.value, 2) : '—'}</td>`, r => `<td>${r.n != null ? sgn(r.n, 2) : '—'}</td>`),
    line('Regime, single month', `<td>${S.latest ? REGIMES[S.latest.regime].label : '—'}</td>`, r => `<td>${r.r ? REGIMES[r.r].label : '—'}</td>`),
    `<tr class="sf-analog-gap"><th>Gap to today (points)</th><td class="muted">—</td>${cols.map(c => `<td>${c.row.dist != null ? fmt(c.row.dist, 0) : '—'}</td>`).join('')}</tr>`,
    `<tr class="sf-analog-after"><th>Recession began within 12 months?</th><td class="muted">not yet known</td>${cols.map(c => `<td>${c.row.rec === 'none within 12 months' ? 'no' : c.row.rec === 'began within 12 months' ? '<b>yes</b>' : c.row.rec === 'already in one' ? 'already under way' : '—'}</td>`).join('')}</tr>`,
    `<tr class="sf-analog-after"><th>Unemployment, next 12 months</th><td class="muted">not yet known</td>${cols.map(c => `<td>${c.row.u12 != null ? sgn(c.row.u12, 1) + 'pt' : '—'}</td>`).join('')}</tr>`,
    `<tr class="sf-analog-after" id="analog-spx"><th>S&amp;P 500, next 12 months</th><td class="muted">not yet known</td>${cols.map(() => '<td class="muted">…</td>').join('')}</tr>`,
  ].join('');
  el('analog-table').innerHTML = `<thead><tr><th></th><th>Today</th>${cols.map(c => `<th>${c.label}</th>`).join('')}</tr></thead><tbody>${body}</tbody>`;

  // ---- lede ----
  const after = r => [r.rec ? `a recession ${r.rec === 'none within 12 months' ? 'did not begin' : r.rec === 'already in one' ? 'was already under way' : 'began'} within 12 months` : null,
    r.u12 != null ? `unemployment ${Math.abs(r.u12) < 0.05 ? 'was unchanged' : (r.u12 > 0 ? 'rose ' : 'fell ') + fmt(Math.abs(r.u12), 1) + ' points'}` : null].filter(Boolean).join(' and ');
  el('analog-lede').innerHTML =
    `Of the ${eligible.length} month-ends from ${eligible[0].d.slice(0, 4)} to two years ago with enough data, the one whose dials sat closest to today's was <strong>${monthName(best.d)}</strong> ` +
    `(an average gap of ${fmt(best.dist, 0)} points across the six scores and the two regime axes). After it, ${after(best)}. ` +
    `Next closest: ${picks.slice(1).map(p => `${monthName(p.d)} (${fmt(p.dist, 0)})`).join(' and ')}. ` +
    `This describes resemblance, not cause: a close match in eight numbers is not a forecast.`;

  // ---- distance through time ----
  const series = rows.filter(r => r.dist != null && r.full).map(r => ({ date: r.d, value: r.dist }));
  lineChart('chart-analog', [{ label: 'Gap between that month and today (points; lower = more alike)', data: series, color: COLORS.accent, width: 1.8, fill: true }],
    { recessions: recessionRanges(data.USREC || []), yMin: 0, dec: 0, yTitle: 'points' });
  tiles('tiles-analog', picks.map((p, i) => ({
    label: i === 0 ? 'Closest match' : i === 1 ? 'Second' : 'Third',
    value: monthName(p.d), meta: `gap ${fmt(p.dist, 0)} points · ${p.r ? REGIMES[p.r].label : ''}`,
    threshold: after(p) ? 'Then ' + after(p) + '.' : '',
  })));
  el('analog-note').innerHTML =
    `Each past month is scored as it would have read then: publication lags are applied, on today's revised data. ` +
    `The gap is the root-mean-square difference over the six composite scores and the two regime axes, with one z counted as 20 points. ` +
    `Months count as a match only when every score had at least ${MIN_COVERAGE}% of its inputs by weight` +
    (anyPartial ? `; an asterisk marks a score built from fewer inputs than today's.` : '.') +
    ` Matches are drawn from months at least two years back.`;

  // ---- S&P 500 afterwards (market prices are optional: the row stays blank without them) ----
  try {
    const px = (await prices(['SPY'], 35)).SPY || [];
    const fwd = d => { const a = at(px, d), b = at(px, addDays(d, 365)); const l = last(px); return a && b && l && l.date >= addDays(d, 358) && a.date >= addDays(d, -10) ? (b.value / a.value - 1) * 100 : null; };
    const tr = document.getElementById('analog-spx');
    if (tr && px.length) tr.innerHTML = `<th>S&amp;P 500, next 12 months <span class="muted">(SPY total return)</span></th><td class="muted">not yet known</td>` +
      cols.map(c => { const v = fwd(c.row.d); return v == null ? '<td class="muted">—</td>' : `<td class="${v >= 0 ? 'pos' : 'neg'}">${sgn(v, 0)}%</td>`; }).join('');
    else if (tr) tr.remove();
  } catch (e) { const tr = document.getElementById('analog-spx'); if (tr) tr.remove(); }
}
