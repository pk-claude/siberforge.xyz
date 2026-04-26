// HTTP helpers for refresh scripts: retry, timeout, sane UA.

const DEFAULT_UA = 'siberforge-supply-refresh/1.0 (+https://siberforge.xyz)';

export function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * fetchWithRetry(url, opts?)
 *   opts.tries:    number of attempts (default 4)
 *   opts.delays:   ms between attempts (default [400, 1500, 4000])
 *   opts.timeout:  per-attempt timeout in ms (default 30000)
 *   opts.headers:  extra headers
 *   opts.method:   default 'GET'
 *   opts.body:     request body
 *   opts.expectJson: if true, parses and returns JSON; otherwise returns Response text
 */
export async function fetchWithRetry(url, opts = {}) {
  const tries = opts.tries ?? 4;
  const delays = opts.delays ?? [400, 1500, 4000];
  const timeout = opts.timeout ?? 30000;
  const headers = { 'User-Agent': DEFAULT_UA, 'Accept': '*/*', ...(opts.headers || {}) };

  let lastErr = null;
  for (let attempt = 0; attempt < tries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(url, {
        method: opts.method || 'GET',
        headers,
        body: opts.body,
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        if (opts.expectJson) return await res.json();
        if (opts.expectBuffer) return Buffer.from(await res.arrayBuffer());
        return await res.text();
      }
      const text = await res.text().catch(() => '');
      const transient = res.status >= 500 || res.status === 429 || res.status === 408;
      lastErr = new Error(`${url} ${res.status}: ${text.slice(0, 200)}`);
      if (!transient || attempt === tries - 1) throw lastErr;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (attempt === tries - 1) throw lastErr;
    }
    await sleep(delays[attempt] ?? 4000);
  }
  throw lastErr || new Error(`${url} unknown failure`);
}

/**
 * Concurrency limiter — runs fn over items with at most `limit` in flight.
 */
export async function pMapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}
