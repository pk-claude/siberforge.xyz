// fred-local.mjs -- read the FRED snapshot from disk exactly as pages read it.
//
// lib/fred-snapshot.js is a browser script (it also fills the October 2025
// hole). Running that same file in a vm with a disk-backed fetch means Node
// scripts and tests see byte-identical series to the site, with no second
// implementation to drift.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const fileFetch = async (input) => {
  const u = new URL(String(input), 'http://local/');
  const p = path.join(ROOT, decodeURIComponent(u.pathname));
  if (!fs.existsSync(p)) return new Response('{}', { status: 404 });
  return new Response(fs.readFileSync(p), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
const win = { fetch: fileFetch };
const ctx = vm.createContext({ window: win, location: { href: 'http://local/', origin: 'http://local' }, URL, Response, Promise, console, Date, JSON, Number, String, Object, Array, Math, isFinite, encodeURIComponent });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'lib', 'fred-snapshot.js'), 'utf8'), ctx);

// { ID: [{date, value, interpolated?}] } for the requested ids.
export const fredLocal = (ids, start = '1900-01-01') => win.SF_FRED.get(ids, start);
export const manifest = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'fred', 'manifest.json'), 'utf8'));
