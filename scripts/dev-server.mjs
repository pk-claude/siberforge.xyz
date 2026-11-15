// dev-server.mjs -- local preview without `vercel dev`.
//
//   node scripts/dev-server.mjs [port]      (default 8790)
//
// Serves the repo as static files (directory URLs resolve to index.html, like
// Vercel) and forwards /api/* to the live site, so pages that need market
// prices or the release calendar work locally. Read-only: nothing is written.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2]) || 8790;
const LIVE = 'https://www.siberforge.xyz';
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8', '.zip': 'application/zip', '.woff2': 'font/woff2',
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    try {
      const r = await fetch(LIVE + url.pathname + url.search, { signal: AbortSignal.timeout(15000) });
      const buf = Buffer.from(await r.arrayBuffer());
      res.writeHead(r.status, { 'Content-Type': r.headers.get('content-type') || 'application/json', 'Cache-Control': 'no-store' });
      res.end(buf);
    } catch (err) {
      res.writeHead(504, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'proxy: ' + String(err.message || err) }));
    }
    return;
  }
  let p = path.normalize(path.join(ROOT, decodeURIComponent(url.pathname)));
  if (!p.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  try {
    if (fs.statSync(p).isDirectory()) {
      if (!url.pathname.endsWith('/')) { res.writeHead(308, { Location: url.pathname + '/' + url.search }); res.end(); return; }
      p = path.join(p, 'index.html');
    }
    const body = fs.readFileSync(p);
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(p).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    let body = 'Not found';
    try { body = fs.readFileSync(path.join(ROOT, '404.html')); } catch { /* plain text fallback */ }
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(body);
  }
}).listen(PORT, () => console.log('siberforge dev server: http://localhost:' + PORT + '  (api -> ' + LIVE + ')'));
