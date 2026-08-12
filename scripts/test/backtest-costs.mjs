// The net-of-cost arithmetic, extracted and checked against hand calcs.
const errors = [];
const t = (l, f) => { try { f(); console.log('  PASS', l); } catch (e) { console.log('  FAIL', l, '--', e.message); errors.push(l); } };
const COST_ONE_WAY = 0.0005;

function sim(monthlyGross, oneWayTurnover, months) {
  let g = 100, n = 100;
  for (let i = 0; i < months; i++) {
    g *= (1 + monthlyGross);
    n *= (1 + monthlyGross - 2 * oneWayTurnover * COST_ONE_WAY);
  }
  const cagr = v => Math.pow(v / 100, 12 / months) - 1;
  return { gross: cagr(g), net: cagr(n) };
}

t('zero turnover costs nothing', () => {
  const r = sim(0.008, 0, 120);
  if (Math.abs(r.gross - r.net) > 1e-12) throw new Error('gross != net with no trading');
});
t('full monthly rotation costs ~12bp/yr at 5bp one-way', () => {
  // 100% one-way turnover every month = 2 x 1.0 x 5bp = 10bp/mo = ~120bp/yr
  const r = sim(0.008, 1.0, 120);
  const drag = (r.gross - r.net) * 10000;
  if (drag < 100 || drag > 135) throw new Error('drag=' + drag.toFixed(0) + 'bp/yr');
  console.log('       drag at 100% monthly turnover:', drag.toFixed(0), 'bp/yr');
});
t('realistic 3-of-11 rotation (~35%/mo) drags 40-45bp/yr', () => {
  const r = sim(0.008, 0.35, 120);
  const drag = (r.gross - r.net) * 10000;
  if (drag < 35 || drag > 50) throw new Error('drag=' + drag.toFixed(0));
  console.log('       drag at 35% monthly turnover:', drag.toFixed(0), 'bp/yr');
});
t('net is always <= gross', () => {
  for (const to of [0, 0.1, 0.5, 1.0]) {
    const r = sim(0.006, to, 240);
    if (r.net > r.gross + 1e-12) throw new Error('net > gross at turnover ' + to);
  }
});
t('a thin gross edge can be erased by costs', () => {
  // Strategy +30bp/yr gross over SPY, turning over 60% a month.
  const spyMonthly = 0.0070;
  const stratMonthly = spyMonthly + 0.00025;
  const r = sim(stratMonthly, 0.60, 240);
  const spy = Math.pow(Math.pow(1 + spyMonthly, 240) , 12 / 240) - 1;
  if (!(r.gross > spy)) throw new Error('setup wrong: no gross edge');
  if (!(r.net < spy)) throw new Error('costs failed to erase a 30bp edge at 60% turnover');
  console.log('       gross edge', ((r.gross - spy) * 10000).toFixed(0) + 'bp ->',
              'net edge', ((r.net - spy) * 10000).toFixed(0) + 'bp');
});

console.log(errors.length ? `\n${errors.length} FAILURES` : '\nbacktest costs: all passed.');
process.exit(errors.length ? 1 : 0);
