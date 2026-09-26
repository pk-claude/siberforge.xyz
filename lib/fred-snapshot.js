// fred-snapshot.js -- serve /api/fred requests from the static snapshot.
//
// Loaded as the first script on every page. It wraps window.fetch so the
// ~25 existing call sites (fetchFred, per-page fetchJSON('/api/fred?...'))
// get snapshot data without being rewritten one by one.
//
//   1. Read /data/fred/manifest.json once (written by scripts/snapshot-fred.mjs).
//   2. Every requested series that is in the snapshot is served from
//      /data/fred/<ID>.json (+ .hist.json for long daily series), sliced to
//      the request's ?start= (default 2010-01-01, same as the live proxy).
//   3. Only series missing from the snapshot go to the live proxy.
//   4. Vintage queries (realtime_start/end) and ?catalog always go live.
//
// The response has the live proxy's shape plus `source` and `snapshotAt`, and
// each series carries `asOf: {last, fetchedAt, source}`, so pages can show
// honest freshness. window.SF_FRED exposes the same data to new modules.
(function () {
  'use strict';
  if (window.SF_FRED) return;
  const ORIG = window.fetch.bind(window);
  const BASE = '/data/fred/';
  let manifestP = null;
  const cache = Object.create(null);

  function manifest() {
    if (!manifestP) {
      manifestP = ORIG(BASE + 'manifest.json', { cache: 'no-cache' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; });
    }
    return manifestP;
  }

  function loadFull(id, m) {
    if (cache[id]) return cache[id];
    const e = m && m.series && m.series[id];
    if (!e || !e.n) return Promise.resolve(null);
    const v = encodeURIComponent(e.last || '');
    const parts = [ORIG(BASE + id + '.json?v=' + v).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })];
    if (e.split) parts.unshift(ORIG(BASE + id + '.hist.json?v=' + encodeURIComponent(e.first || '')).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }));
    cache[id] = Promise.all(parts).then(function (docs) {
      const d = [], vals = [];
      docs.forEach(function (x) { Array.prototype.push.apply(d, x.d); Array.prototype.push.apply(vals, x.v); });
      return { id: id, meta: docs[docs.length - 1].meta, d: d, v: vals, last: e.last, fetchedAt: m.generatedAt };
    }).catch(function () { delete cache[id]; return null; });
    return cache[id];
  }

  function slice(full, start) {
    const obs = [];
    for (let i = 0; i < full.d.length; i++) {
      if (full.d[i] >= start) obs.push({ date: full.d[i], value: full.v[i] });
    }
    return {
      id: full.id, meta: full.meta, observations: obs,
      asOf: { last: full.last, fetchedAt: full.fetchedAt, source: 'snapshot' },
    };
  }

  async function serve(ids, start) {
    const m = await manifest();
    const got = await Promise.all(ids.map(function (id) { return loadFull(id, m); }));
    const series = [], missing = [], errors = [];
    ids.forEach(function (id, i) { if (got[i]) series.push(slice(got[i], start)); else missing.push(id); });
    if (missing.length) {
      try {
        const r = await ORIG('/api/fred?series=' + missing.map(encodeURIComponent).join(',') + '&start=' + start);
        const body = await r.json().catch(function () { return {}; });
        (body.series || []).forEach(function (s) { s.asOf = { source: 'live' }; series.push(s); });
        (body.errors || []).forEach(function (e) { errors.push(e); });
        if (!r.ok && !(body.errors || []).length) missing.forEach(function (id) { errors.push({ id: id, error: 'live HTTP ' + r.status }); });
      } catch (err) {
        missing.forEach(function (id) { errors.push({ id: id, error: String(err && err.message || err) }); });
      }
    }
    // Keep the caller's requested order.
    series.sort(function (a, b) { return ids.indexOf(a.id) - ids.indexOf(b.id); });
    return { series: series, errors: errors, source: 'snapshot', snapshotAt: m && m.generatedAt };
  }

  window.fetch = function (input, init) {
    let u;
    try { u = new URL(typeof input === 'string' ? input : (input && input.url) || String(input), location.href); }
    catch (e) { return ORIG(input, init); }
    const q = u.searchParams;
    // Release calendar: live first (it is date-sensitive), snapshot on failure.
    if (u.origin === location.origin && u.pathname === '/api/releases') {
      return ORIG(input, init).then(function (r) {
        if (r.ok) return r;
        throw new Error('live ' + r.status);
      }).catch(function () {
        return ORIG(BASE + 'releases.json').then(function (r) {
          if (!r.ok) throw new Error('no snapshot');
          return r.json();
        }).then(function (b) {
          const today = new Date().toISOString().slice(0, 10);
          const days = Number(q.get('days')) || 21;
          const horizon = new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
          b.releases = (b.releases || []).filter(function (x) { return x.date >= today && x.date <= horizon; })
            .map(function (x) { x.days_until = Math.round((new Date(x.date) - new Date(today)) / 864e5); return x; });
          b.source = 'snapshot';
          return new Response(JSON.stringify(b), { status: 200, headers: { 'Content-Type': 'application/json' } });
        });
      });
    }
    if (u.origin !== location.origin || u.pathname !== '/api/fred' || !q.get('series') ||
        q.has('realtime_start') || q.has('realtime_end') || q.has('catalog')) {
      return ORIG(input, init);
    }
    const ids = q.get('series').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    const start = q.get('start') || '2010-01-01';
    return serve(ids, start).then(function (body) {
      const status = body.series.length ? 200 : 502;
      if (!body.series.length) body.error = 'all series failed';
      return new Response(JSON.stringify(body), { status: status, headers: { 'Content-Type': 'application/json' } });
    });
  };

  // Direct API for new modules: SF_FRED.get(['DGS10','DGS2'], '1990-01-01')
  // -> { DGS10: [{date, value}], ... } plus SF_FRED.info(id) -> manifest entry.
  window.SF_FRED = {
    manifest: manifest,
    get: async function (ids, start) {
      const body = await serve([].concat(ids), start || '1900-01-01');
      const out = {};
      body.series.forEach(function (s) { out[s.id] = s.observations; });
      return out;
    },
    info: async function (id) { const m = await manifest(); return m && m.series[id]; },
  };
})();
