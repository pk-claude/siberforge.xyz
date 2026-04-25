// Consolidated data browser. Lists every FRED series in the catalog +
// snapshot data + per-page bundle exports.

import { downloadCSV, downloadJSON, seriesToCSV, tableToCSV } from '/core/lib/csv-export.js';

const state = {
  catalog: {},     // FRED catalog from /api/fred?catalog=1
  filtered: [],
  search: '',
  category: '',
};

function el(id) { return document.getElementById(id); }
function setStatus(kind, text) {
  el('refresh-indicator').className = `dot ${kind}`;
  el('refresh-text').textContent = text;
}
async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

// Group catalog entries to a friendly "category" string
function categoryFor(meta) {
  if (meta.group === 'cycle')        return 'Cycle';
  if (meta.group === 'inflation')    return 'Inflation';
  if (meta.group === 'real-economy') return 'Consumer / Real Economy';
  if (meta.group === 'housing')      return 'Housing';
  if (meta.group === 'econ')         return 'Indicator Library';
  if (meta.group === 'recession')    return 'Recession Composite';
  return 'Core Macro';
}

async function loadCatalog() {
  setStatus('stale', 'Loading catalog…');
  const j = await fetchJSON('/api/fred?catalog=1');
  state.catalog = j.catalog || {};
  setStatus('live', `${Object.keys(state.catalog).length} series available`);
}

function renderCategorySelect() {
  const cats = new Set();
  for (const meta of Object.values(state.catalog)) cats.add(categoryFor(meta));
  const sel = el('data-category');
  for (const c of [...cats].sort()) {
    const opt = document.createElement('option');
    opt.value = c; opt.textContent = c;
    sel.appendChild(opt);
  }
  sel.addEventListener('change', () => { state.category = sel.value; renderTable(); });
}

function renderSearch() {
  el('data-search').addEventListener('input', (e) => {
    state.search = e.target.value.toLowerCase();
    renderTable();
  });
}

function renderTable() {
  const search = state.search.trim();
  const cat = state.category;
  const rows = Object.entries(state.catalog).filter(([id, meta]) => {
    if (cat && categoryFor(meta) !== cat) return false;
    if (!search) return true;
    return id.toLowerCase().includes(search) ||
           (meta.label || '').toLowerCase().includes(search) ||
           categoryFor(meta).toLowerCase().includes(search);
  });
  state.filtered = rows;
  el('data-counter').textContent = `${rows.length} of ${Object.keys(state.catalog).length} series`;

  rows.sort((a, b) => categoryFor(a[1]).localeCompare(categoryFor(b[1])) || a[0].localeCompare(b[0]));
  const html = `
    <table class="data-series-table">
      <thead>
        <tr>
          <th>Series ID</th>
          <th>Label</th>
          <th>Category</th>
          <th>Frequency</th>
          <th>Unit</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(([id, meta]) => `
          <tr>
            <td class="dst-id">${id}</td>
            <td>${meta.label || ''}</td>
            <td><span class="dst-cat">${categoryFor(meta)}</span></td>
            <td>${meta.freq || '—'}</td>
            <td>${meta.unit || '—'}</td>
            <td><button class="dst-dl" data-id="${id}" data-label="${(meta.label || id).replace(/"/g, '&quot;')}">Download CSV</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  el('data-table').innerHTML = html;
  el('data-table').querySelectorAll('.dst-dl').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = 'Loading…';
      try {
        const id = btn.dataset.id;
        const label = btn.dataset.label;
        const j = await fetchJSON(`/api/fred?series=${id}&start=1990-01-01`);
        const obs = j.series[0]?.observations || [];
        seriesToCSV(`${id}.csv`, [{ id, label, observations: obs }]);
        btn.textContent = 'Downloaded ✓';
        setTimeout(() => { btn.textContent = 'Download CSV'; btn.disabled = false; }, 2000);
      } catch (err) {
        btn.textContent = 'Error';
        console.error(err);
        setTimeout(() => { btn.textContent = 'Download CSV'; btn.disabled = false; }, 2000);
      }
    });
  });
}

async function downloadAllFred() {
  const btn = el('dl-all-fred');
  btn.disabled = true;
  const originalLabel = btn.querySelector('.dbl-title').textContent;
  btn.querySelector('.dbl-title').textContent = 'Loading 0 / ' + Object.keys(state.catalog).length + '…';

  const ids = Object.keys(state.catalog);
  const allSeries = [];
  // Batch ~10 at a time to avoid huge URLs / timeouts
  for (let i = 0; i < ids.length; i += 10) {
    const batch = ids.slice(i, i + 10);
    try {
      const j = await fetchJSON(`/api/fred?series=${batch.join(',')}&start=1990-01-01`);
      for (const s of j.series) {
        allSeries.push({ id: s.id, label: state.catalog[s.id]?.label || s.id, observations: s.observations });
      }
    } catch (err) {
      console.warn(`batch ${batch.join(',')} failed:`, err);
    }
    btn.querySelector('.dbl-title').textContent = `Loading ${Math.min(i + 10, ids.length)} / ${ids.length}…`;
  }
  seriesToCSV('siberforge-all-fred-series.csv', allSeries);
  btn.querySelector('.dbl-title').textContent = `Downloaded ✓ (${allSeries.length} series)`;
  setTimeout(() => { btn.querySelector('.dbl-title').textContent = originalLabel; btn.disabled = false; }, 4000);
}

function downloadCatalog() {
  const rows = [['ID', 'Label', 'Category', 'Frequency', 'Unit', 'Transform', 'Group']];
  for (const [id, meta] of Object.entries(state.catalog).sort()) {
    rows.push([id, meta.label || '', categoryFor(meta), meta.freq || '', meta.unit || '', meta.transform || '', meta.group || '']);
  }
  downloadCSV('siberforge-series-catalog.csv', rows);
}

async function downloadSnapshotBundle() {
  const btn = el('dl-snapshot');
  btn.disabled = true;
  const t = btn.querySelector('.dbl-title');
  t.textContent = 'Bundling…';

  // Pull all snapshot data from the JS modules at runtime via dynamic imports.
  const bundle = {};
  try {
    const migration = await import('/core/macro/regional/migration/migration.js?bundleOnly=1');
    // The module's data is in module-scope consts, only accessible via re-fetch.
    // Cleaner alternative: each snapshot module also exports its data; for v1
    // we just inline a manifest pointing at sources.
  } catch (e) { /* dynamic import side effects okay to ignore */ }

  bundle._note = 'Snapshot data bundles require module-side exports of the data constants. ' +
                 'For v1 this bundle includes the catalog and a manifest of snapshot sources; ' +
                 'individual snapshot tables can be downloaded from their respective dashboards.';
  bundle.catalog = state.catalog;
  bundle.snapshotSources = [
    { page: '/core/macro/regional/migration/',     source: 'IRS Statistics of Income · annual',          file: 'migration.js — MIGRATION_DATA + COUNTY_DATA' },
    { page: '/core/macro/regional/demographics/',  source: 'Census ACS 5-yr · annual',                   file: 'demographics.js — DEMO' },
    { page: '/core/macro/regional/affordability/', source: 'Zillow ZHVI + Census ACS · annual',          file: 'affordability.js — METROS + METRO_DETAIL' },
    { page: '/core/macro/regional/climate-risk/',  source: 'FEMA National Risk Index 2023',              file: 'climate-risk.js — FEMA_NRI' },
    { page: '/core/macro/holdings.js',             source: 'State Street SPDR fact sheets · quarterly',  file: 'holdings.js — ETF_HOLDINGS' },
    { page: '/core/macro/sector-profiles.js',      source: 'Curated sector + regime narratives',         file: 'sector-profiles.js — SECTOR_PROFILES' },
  ];

  downloadJSON('siberforge-snapshot-bundle.json', bundle);
  t.textContent = 'Downloaded ✓';
  setTimeout(() => { t.textContent = 'Download all snapshot data'; btn.disabled = false; }, 3000);
}

async function main() {
  try {
    await loadCatalog();
    renderCategorySelect();
    renderSearch();
    renderTable();
    el('dl-all-fred').addEventListener('click', downloadAllFred);
    el('dl-snapshot').addEventListener('click', downloadSnapshotBundle);
    el('dl-catalog').addEventListener('click', downloadCatalog);
    el('last-updated').textContent = `Updated ${new Date().toLocaleString()}`;
  } catch (err) {
    console.error(err);
    setStatus('error', `Error: ${err.message}`);
  }
}
main();
