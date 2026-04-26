// IMF PortWatch - daily port calls + chokepoint transits, aggregated to monthly.
// Source: ArcGIS Feature Services published by IMF on services9.arcgis.com.
//   Daily_Ports_Data       - daily container/cargo flow for ~1100 ports worldwide
//   Daily_Chokepoints_Data - daily transit counts for 28 maritime chokepoints
//
// LA and Long Beach are combined under a single "Los Angeles-Long Beach" entry
// (portid=port664). To preserve two tiles in the dashboard, we surface two
// complementary views of that complex: container TEU-equivalent imports
// (PORT_LA_TEU) and container ship-call count (PORT_LB_TEU). NY-NJ uses
// portid=port815. Suez=chokepoint1, Panama=chokepoint2.

import { fetchWithRetry } from '../lib/http.mjs';
import { readHistoryCsv } from '../lib/csv.mjs';
import path from 'node:path';

export const id = 'scrape:imf-portwatch';

const PORTS_URL    = 'https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services/Daily_Ports_Data/FeatureServer/0/query';
const CHOKE_URL    = 'https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services/Daily_Chokepoints_Data/FeatureServer/0/query';
const PAGE_LIMIT   = 1000;
const HISTORY_FROM = '2019-01-01';

const SPEC = {
  PORT_LA_TEU:     { kind: 'port',  portid: 'port664', fields: ['import_container'] },
  PORT_LB_TEU:     { kind: 'port',  portid: 'port664', fields: ['portcalls_container'] },
  PORT_NYNJ_TEU:   { kind: 'port',  portid: 'port815', fields: ['import_container'] },
  SUEZ_TRANSITS:   { kind: 'choke', portid: 'chokepoint1', fields: ['n_total'] },
  PANAMA_TRANSITS: { kind: 'choke', portid: 'chokepoint2', fields: ['n_total'] },
};

export async function fetch({ entries, dataDir }) {
  const results = {};
  const fieldsByKey = new Map();
  for (const e of entries) {
    const spec = SPEC[e.id];
    if (!spec) continue;
    const key = spec.kind + ':' + spec.portid;
    const set = fieldsByKey.get(key) || new Set();
    for (const f of spec.fields) set.add(f);
    fieldsByKey.set(key, set);
  }
  const fetched = new Map();
  for (const [key, fieldSet] of fieldsByKey.entries()) {
    const [kind, portid] = key.split(':');
    try {
      const url = kind === 'port' ? PORTS_URL : CHOKE_URL;
      const rows = await fetchAllRows(url, portid, [...fieldSet]);
      fetched.set(key, { rows, error: null });
    } catch (err) {
      fetched.set(key, { rows: null, error: err });
    }
  }

  for (const e of entries) {
    const spec = SPEC[e.id];
    const existing = await readHistoryCsv(path.join(dataDir, 'history', `${e.id}.csv`));
    if (!spec) {
      results[e.id] = { ok: false, error: `PortWatch: unknown id ${e.id}` };
      continue;
    }
    const cached = fetched.get(spec.kind + ':' + spec.portid) || { rows: null, error: new Error('unknown fetch error') };
    if (!cached.rows) {
      results[e.id] = existing.length
        ? { ok: false, observations: existing, error: `PortWatch fetch: ${cached.error?.message || 'failed'}; kept last-known-good` }
        : { ok: false, error: `PortWatch: ${cached.error?.message || 'fetch failed'}` };
      continue;
    }
    const monthly = aggregateMonthly(cached.rows, spec.fields);
    if (monthly.length === 0) {
      results[e.id] = existing.length
        ? { ok: false, observations: existing, error: `PortWatch parse: zero rows for ${e.id}; kept last-known-good` }
        : { ok: false, error: `PortWatch: zero rows for ${e.id}` };
    } else {
      results[e.id] = { ok: true, observations: monthly };
    }
  }
  return { results };
}

async function fetchAllRows(baseUrl, portid, fields) {
  const allRows = [];
  let offset = 0;
  const where = `portid='${portid}' AND date>=DATE '${HISTORY_FROM}'`;
  const outFields = ['date', ...fields].join(',');
  while (true) {
    const params = new URLSearchParams({
      where, outFields,
      returnGeometry: 'false', f: 'json',
      orderByFields: 'date ASC',
      resultOffset: String(offset),
      resultRecordCount: String(PAGE_LIMIT),
    });
    const url = `${baseUrl}?${params}`;
    const json = await fetchWithRetry(url, { tries: 3, timeout: 30000, expectJson: true });
    const feats = (json && json.features) || [];
    for (const f of feats) allRows.push(f.attributes || {});
    if (feats.length < PAGE_LIMIT) break;
    offset += PAGE_LIMIT;
    if (offset > 50000) break;
  }
  return allRows;
}

function aggregateMonthly(rows, fields) {
  const buckets = new Map();
  for (const r of rows) {
    const dateStr = coerceDate(r.date);
    if (!dateStr) continue;
    const monthKey = dateStr.slice(0, 7) + '-01';
    let v = 0;
    for (const f of fields) {
      const x = Number(r[f]);
      if (Number.isFinite(x)) v += x;
    }
    if (!Number.isFinite(v)) continue;
    buckets.set(monthKey, (buckets.get(monthKey) || 0) + v);
  }
  const out = [...buckets.entries()].map(([date, value]) => ({ date, value }));
  out.sort((a,b) => a.date.localeCompare(b.date));
  const now = new Date();
  const curMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,'0')}-01`;
  if (out.length > 0 && out[out.length-1].date === curMonth) out.pop();
  return out;
}

function coerceDate(v) {
  if (v == null) return null;
  if (typeof v === 'number') {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0,10);
    return null;
  }
  if (typeof v === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0,10);
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0,10);
  }
  return null;
}
