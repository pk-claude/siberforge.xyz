// Research index cards must show each note's current asOf date.
import { spawnSync } from 'node:child_process';
const r = spawnSync(process.execPath, ['scripts/sync-research-index.mjs', '--check'], { stdio: 'inherit' });
process.exit(r.status);
