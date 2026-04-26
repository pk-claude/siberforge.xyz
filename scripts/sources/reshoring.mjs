// Reshoring Initiative - Annual "Jobs Announced" series.
// The Reshoring Initiative publishes once per year as a PDF Data Report
// (https://reshorenow.org/reshoring-initiative-data/). There is no
// machine-readable feed, so we maintain the historical values inline
// and the annual update lands as a code change once per year.
//
// Source: Reshoring Initiative Annual Data Reports (2014-2024) and
// press coverage. 2024 figure from April 2025 release.
// Data is "Reshoring + FDI Jobs Announced" combined (total jobs/year).

import { readHistoryCsv } from '../lib/csv.mjs';
import path from 'node:path';

export const id = 'scrape:reshoring';

// Append a new {year, value} when a fresh annual report drops.
const ANNUAL = [
  { year: 2010, value: 12000  },
  { year: 2011, value: 35000  },
  { year: 2012, value: 51000  },
  { year: 2013, value: 47000  },
  { year: 2014, value: 60000  },
  { year: 2015, value: 67000  },
  { year: 2016, value: 77000  },
  { year: 2017, value: 116000 },
  { year: 2018, value: 153000 },
  { year: 2019, value: 117000 },
  { year: 2020, value: 161000 },
  { year: 2021, value: 264000 },
  { year: 2022, value: 365000 },
  { year: 2023, value: 287000 },
  { year: 2024, value: 244000 },  // 2024 Data Report (Apr 2025); approximate
];

export async function fetch({ entries, dataDir }) {
  const results = {};
  const observations = ANNUAL
    .map(r => ({ date: `${r.year}-12-31`, value: r.value }))
    .sort((a,b) => a.date.localeCompare(b.date));

  for (const e of entries) {
    if (e.id !== 'RESHORING_COUNT') {
      results[e.id] = { ok: false, error: `Reshoring: unknown id ${e.id}` };
      continue;
    }
    const existing = await readHistoryCsv(path.join(dataDir, 'history', `${e.id}.csv`));
    if (observations.length > 0) {
      const map = new Map(existing.map(o => [o.date, o.value]));
      for (const o of observations) map.set(o.date, o.value);
      const obs = [...map.entries()].map(([date, value]) => ({ date, value }))
                    .sort((a,b)=>a.date.localeCompare(b.date));
      results[e.id] = { ok: true, observations: obs };
    } else {
      results[e.id] = existing.length
        ? { ok: false, observations: existing, error: 'Reshoring static table empty; kept last-known-good' }
        : { ok: false, error: 'Reshoring: no static data' };
    }
  }
  return { results };
}
