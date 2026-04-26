// EIA source — uses EIA Open Data API v2 directly with EIA_API_KEY.
import { fetchWithRetry, pMapLimit } from '../lib/http.mjs';

const BASE = 'https://api.eia.gov/v2';

export const id = 'eia';

// Map indicator id -> EIA query config
const QUERIES = {
  DIESEL_RETAIL: {
    path: '/petroleum/pri/gnd/data',
    facets: { duoarea: ['NUS'], product: ['EPD2D'], process: ['PTE'], series: ['EMD_EPD2D_PTE_NUS_DPG'] },
    freq: 'weekly', valueField: 'value',
  },
  GASOLINE_RETAIL: {
    path: '/petroleum/pri/gnd/data',
    facets: { duoarea: ['NUS'], product: ['EPMR'], process: ['PTE'], series: ['EMM_EPMR_PTE_NUS_DPG'] },
    freq: 'weekly', valueField: 'value',
  },
  ELEC_INDUSTRIAL: {
    path: '/electricity/retail-sales/data',
    facets: { sectorid: ['IND'], stateid: ['US'] },
    freq: 'monthly', valueField: 'price',
  },
};

export async function fetch({ entries, env }) {
  const key = env.EIA_API_KEY;
  if (!key) {
    return { results: Object.fromEntries(entries.map(e => [e.id, { ok: false, error: 'EIA_API_KEY missing' }])) };
  }
  const results = {};
  await pMapLimit(entries, 3, async (entry) => {
    const cfg = QUERIES[entry.id];
    if (!cfg) {
      results[entry.id] = { ok: false, error: `No EIA query defined for ${entry.id}` };
      return;
    }
    try {
      const observations = await fetchEia(cfg, key);
      results[entry.id] = { ok: true, observations };
    } catch (err) {
      results[entry.id] = { ok: false, error: String(err.message || err) };
    }
  });
  return { results };
}

async function fetchEia(cfg, key) {
  const url = new URL(BASE + cfg.path);
  url.searchParams.set('api_key', key);
  url.searchParams.set('frequency', cfg.freq);
  url.searchParams.set('data[0]', cfg.valueField);
  url.searchParams.set('sort[0][column]', 'period');
  url.searchParams.set('sort[0][direction]', 'asc');
  url.searchParams.set('length', '5000');
  for (const [name, vs] of Object.entries(cfg.facets || {})) {
    for (const v of vs) url.searchParams.append(`facets[${name}][]`, v);
  }
  const json = await fetchWithRetry(url.toString(), { expectJson: true, tries: 4 });
  const data = json?.response?.data || [];
  return data
    .map(d => ({ date: normalizeDate(d.period, cfg.freq), value: Number(d[cfg.valueField]) }))
    .filter(o => o.date && Number.isFinite(o.value));
}

function normalizeDate(period, freq) {
  if (!period) return null;
  if (freq === 'weekly') return period.slice(0, 10);
  if (freq === 'monthly') return `${period}-01`;
  if (freq === 'annual') return `${period}-01-01`;
  return period;
}
