// api/_guard.js: origin policy + rate limiting.
import { guard, hit, applyOrigin } from '../../api/_guard.js';
const errors = [];
const t = (l, f) => { try { f(); console.log('  PASS', l); } catch (e) { console.log('  FAIL', l, '--', e.message); errors.push(l); } };

function mkRes() {
  const h = {}; let code = 200; let body = null; let ended = false;
  return { headers: h, get code() { return code; }, get body() { return body; }, get ended() { return ended; },
    setHeader: (k, v) => { h[k] = v; },
    status(c) { code = c; return this; },
    json(o) { body = o; ended = true; return this; },
    end() { ended = true; return this; } };
}
const mkReq = (ip, origin, method = 'GET') => ({ method, headers: { 'x-forwarded-for': ip, origin }, query: {} });

t('same-origin request is allowed through', () => {
  const res = mkRes();
  const stop = guard(mkReq('1.1.1.1', 'https://www.siberforge.xyz'), res);
  if (stop) throw new Error('blocked a legitimate request');
  if (res.headers['Access-Control-Allow-Origin'] !== 'https://www.siberforge.xyz') throw new Error(JSON.stringify(res.headers));
});
t('unknown origin gets NO allow-origin header', () => {
  const res = mkRes();
  guard(mkReq('1.1.1.2', 'https://scraper.example'), res);
  if (res.headers['Access-Control-Allow-Origin']) throw new Error('leaked: ' + res.headers['Access-Control-Allow-Origin']);
});
t('no wildcard anywhere by default', () => {
  const res = mkRes();
  applyOrigin(mkReq('1.1.1.3', undefined), res, {});
  if (res.headers['Access-Control-Allow-Origin'] === '*') throw new Error('wildcard');
});
t('OPTIONS preflight short-circuits with 200', () => {
  const res = mkRes();
  const stop = guard(mkReq('1.1.1.4', 'https://siberforge.xyz', 'OPTIONS'), res);
  if (!stop) throw new Error('did not short-circuit');
  if (res.code !== 200) throw new Error('code=' + res.code);
});
t('429 after the limit, with Retry-After', () => {
  const ip = '9.9.9.9';
  let blockedAt = null;
  for (let i = 1; i <= 12; i++) {
    const res = mkRes();
    const stop = guard(mkReq(ip, 'https://siberforge.xyz'), res, { limit: 10 });
    if (stop && blockedAt === null) {
      blockedAt = i;
      if (res.code !== 429) throw new Error('code=' + res.code);
      if (!res.headers['Retry-After']) throw new Error('no Retry-After');
      if (!/rate limited/.test(res.body.error)) throw new Error(JSON.stringify(res.body));
    }
  }
  if (blockedAt !== 11) throw new Error('blocked at request ' + blockedAt + ', expected 11');
});
t('limit is per-IP, not global', () => {
  const res = mkRes();
  const stop = guard(mkReq('8.8.8.8', 'https://siberforge.xyz'), res, { limit: 10 });
  if (stop) throw new Error('a different IP was caught by another IP\'s bucket');
});
t('x-forwarded-for chain uses the client, not the proxy', () => {
  const a = hit({ headers: { 'x-forwarded-for': '5.5.5.5, 10.0.0.1' } }, 100);
  const b = hit({ headers: { 'x-forwarded-for': '5.5.5.5, 10.0.0.2' } }, 100);
  if (b.remaining !== a.remaining - 1) throw new Error('not keyed on the first hop');
});

console.log(errors.length ? `\n${errors.length} FAILURES` : '\napi guard: all passed.');
process.exit(errors.length ? 1 : 0);
