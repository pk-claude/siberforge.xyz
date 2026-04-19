// Shared uPlot helpers. Deliberately small — each chart has its own config,
// we only extract things that were genuinely being copy-pasted.

// --- date conversion --------------------------------------------------------
// uPlot's time axis expects epoch seconds. Our observations have YYYY-MM-DD
// strings. Treat dates as UTC midnight to avoid timezone drift that would
// push a point into the wrong day on non-UTC browsers.

export function dateToTs(iso) {
  return Math.floor(new Date(iso + 'T00:00:00Z').getTime() / 1000);
}

// Convenience: extract x array from an observations array.
export function obsToXs(obs) {
  return obs.map(o => dateToTs(o.date));
}

// Extract ys — trivial but keeps symmetry with obsToXs.
export function obsToYs(obs) {
  return obs.map(o => o.value);
}

// Extract both — used by single-series charts.
export function obsToUplotArrays(obs) {
  return [obsToXs(obs), obsToYs(obs)];
}

// --- dark-theme axis/grid constants -----------------------------------------
// All charts use this palette. Spread DARK_AXIS_BASE as a starting point and
// override splits/values per axis.

export const DARK_AXIS_STROKE = '#94a3b8';
export const DARK_GRID_COLOR  = 'rgba(148, 163, 184, 0.08)';
export const DARK_TICKS_COLOR = 'rgba(148, 163, 184, 0.15)';

export const DARK_AXIS_BASE = Object.freeze({
  stroke: DARK_AXIS_STROKE,
  grid:  { stroke: DARK_GRID_COLOR },
  ticks: { stroke: DARK_TICKS_COLOR },
});
