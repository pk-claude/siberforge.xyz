// Runs every test file in this directory, reports a single verdict.
import { readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const files = readdirSync(HERE).filter(f => f.endsWith('.mjs') && f !== 'run-all.mjs').sort();

let failed = 0;
for (const f of files) {
  console.log(`\n--- ${f} ---`);
  const r = spawnSync(process.execPath, [join(HERE, f)], { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) failed++;
}
console.log(`\n${files.length - failed}/${files.length} test files passed.`);
process.exit(failed ? 1 : 0);
