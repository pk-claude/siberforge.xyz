// _guard.js -- shared origin policy + best-effort rate limiting for the
// serverless proxies in this directory.
//
// SCOPE, STATED HONESTLY: Vercel runs these functions across many isolated
// instances, so an in-memory counter is per-instance, not global. This is a
// speed bump against a single client hammering one endpoint, NOT a real
// distributed rate limit. It costs nothing and needs no external service. If
// abuse ever becomes real, replace `hit()` with a Vercel KV / Upstash counter
// keyed the same way -- the call sites do not change.
//
// The upstream keys behind these endpoints are quota-limited (FRED, EIA) or
// governed by fair-use policy (SEC EDGAR, which blocks by IP). A bot crawl
// that exhausts them takes the live dashboards down for everyone.

const ALLOWED_ORIGINS = [
  'https://www.siberforge.xyz',
  'https://siberforge.xyz',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

// key -> { count, windowStart }
const buckets = new Map();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60;
const MAX_BUCKETS = 5000; // bound memory on a long-lived instance

function clientKey(req) {
  const fwd = req.headers['x-forwarded-for'];
  const ip = (Array.isArray(fwd) ? fwd[0] : fwd || '').split(',')[0].trim();
  return ip || req.headers['x-real-ip'] || 'unknown';
}

// Returns { ok, remaining, retryAfter }.
export function hit(req, limit = MAX_PER_WINDOW) {
  const key = clientKey(req);
  const now = Date.now();

  if (buckets.size > MAX_BUCKETS) buckets.clear();

  let b = buckets.get(key);
  if (!b || now - b.windowStart >= WINDOW_MS) {
    b = { count: 0, windowStart: now };
    buckets.set(key, b);
  }
  b.count += 1;

  const remaining = Math.max(0, limit - b.count);
  const retryAfter = Math.ceil((b.windowStart + WINDOW_MS - now) / 1000);
  return { ok: b.count <= limit, remaining, retryAfter };
}

// Same-origin by default. Pass allowCrossOrigin only where a third party is
// genuinely meant to read the endpoint -- which, today, is nowhere.
export function applyOrigin(req, res, { allowCrossOrigin = false } = {}) {
  const origin = req.headers.origin;
  if (allowCrossOrigin) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// One call at the top of a handler. Returns true if the request was already
// answered (preflight or 429) and the handler should return immediately.
export function guard(req, res, opts = {}) {
  applyOrigin(req, res, opts);
  if (req.method === 'OPTIONS') { res.status(200).end(); return true; }

  const r = hit(req, opts.limit);
  res.setHeader('X-RateLimit-Limit', String(opts.limit || MAX_PER_WINDOW));
  res.setHeader('X-RateLimit-Remaining', String(r.remaining));
  if (!r.ok) {
    res.setHeader('Retry-After', String(r.retryAfter));
    res.status(429).json({
      error: 'rate limited',
      detail: `More than ${opts.limit || MAX_PER_WINDOW} requests in 60s from this address.`,
      retryAfterSeconds: r.retryAfter,
    });
    return true;
  }
  return false;
}
