// Thin client for the /api/fred proxy. All econ-dashboard pages fetch through
// here so error handling and URL construction live in one place.
//
// Shape notes:
//   - The server returns { series: [{id, meta, observations}, ...] }.
//   - fetchFred(...) returns a keyed map: { [id]: {meta, observations} }.
//     This is how most callers want to consume it — id-indexed lookup.
//   - fetchFredObs(...) is a convenience for single-series calls that just
//     want the observations array.
//
// Options:
//   start:         YYYY-MM-DD, passed as ?start=
//   realtimeStart: YYYY-MM-DD, passed as ?realtime_start= (vintage queries)
//   realtimeEnd:   YYYY-MM-DD, passed as ?realtime_end=

function buildUrl(idsStr, opts = {}) {
  const url = new URL('/api/fred', window.location.origin);
  url.searchParams.set('series', idsStr);
  if (opts.start)         url.searchParams.set('start',          opts.start);
  if (opts.realtimeStart) url.searchParams.set('realtime_start', opts.realtimeStart);
  if (opts.realtimeEnd)   url.searchParams.set('realtime_end',   opts.realtimeEnd);
  return url.toString();
}

// Batch fetch. `ids` may be a single string "CPIAUCSL" or an array.
// Returns: { [id]: { meta, observations } }.
// Throws on non-ok HTTP; error message includes the response body snippet
// so callers can surface it in their error tiles.
export async function fetchFred(ids, opts = {}) {
  const idsStr = Array.isArray(ids) ? ids.join(',') : String(ids);
  const res = await fetch(buildUrl(idsStr, opts));
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const snippet = text ? `: ${text.slice(0, 200)}` : '';
    throw new Error(`FRED ${idsStr} HTTP ${res.status}${snippet}`);
  }
  const body = await res.json();
  const out = {};
  for (const s of body.series || []) {
    out[s.id] = { meta: s.meta || null, observations: s.observations || [] };
  }
  return out;
}

// Convenience: single series → just the observations array.
// Throws if the id is missing from the response entirely.
export async function fetchFredObs(id, opts = {}) {
  const map = await fetchFred(id, opts);
  const s = map[id];
  if (!s) throw new Error(`FRED ${id}: missing from response`);
  return s.observations;
}
