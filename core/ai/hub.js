// /core/ai/hub.js — AI hub page: sankey hero + pillar card metrics
import { injectLoadingStyles, setStatus } from './lib/loading.js';

// Hardcoded sankey data (2025E): hyperscalers -> capex buckets -> end beneficiaries.
// Values are approximate capex $ billions.
const SANKEY_DATA = {
  nodes: [
    { name: 'MSFT' }, { name: 'GOOGL' }, { name: 'META' }, { name: 'AMZN' },
    { name: 'Compute & semis' }, { name: 'Power & DC infra' }, { name: 'Networking & other' },
    { name: 'NVDA' }, { name: 'AVGO' }, { name: 'AMD' }, { name: 'TSM' }, { name: 'Custom silicon' },
    { name: 'CEG / VST' }, { name: 'GEV / ETR' }, { name: 'Land / buildings' }
  ],
  links: [
    { source: 0, target: 4, value: 55 }, { source: 0, target: 5, value: 25 }, { source: 0, target: 6, value: 15 },
    { source: 1, target: 4, value: 54 }, { source: 1, target: 5, value: 22 }, { source: 1, target: 6, value: 14 },
    { source: 2, target: 4, value: 42 }, { source: 2, target: 5, value: 18 }, { source: 2, target: 6, value: 10 },
    { source: 3, target: 4, value: 68 }, { source: 3, target: 5, value: 30 }, { source: 3, target: 6, value: 17 },
    { source: 4, target: 7, value: 130 }, { source: 4, target: 8, value: 38 }, { source: 4, target: 9, value: 24 },
    { source: 4, target: 10, value: 18 }, { source: 4, target: 11, value: 9 },
    { source: 5, target: 12, value: 38 }, { source: 5, target: 13, value: 30 }, { source: 5, target: 14, value: 27 }
  ]
};

async function renderSankey() {
  const container = document.getElementById('ai-sankey');
  if (!container) return;

  // Dynamic import: handle both named-export and default-export shapes from
  // jsdelivr's +esm bundle.
  const d3Mod = await import('https://cdn.jsdelivr.net/npm/d3@7.8.5/+esm');
  const d3 = d3Mod.default || d3Mod;
  const sankeyMod = await import('https://cdn.jsdelivr.net/npm/d3-sankey@0.12.3/+esm');
  const d3Sankey = sankeyMod.sankey || (sankeyMod.default && sankeyMod.default.sankey);
  const sankeyLinkHorizontal = sankeyMod.sankeyLinkHorizontal || (sankeyMod.default && sankeyMod.default.sankeyLinkHorizontal);
  if (!d3 || !d3.create || !d3Sankey) {
    throw new Error('d3/d3-sankey CDN bundle missing expected exports');
  }

  const width = container.clientWidth || 960;
  const height = 460;
  const margin = { top: 20, right: 160, bottom: 20, left: 160 };

  // Per-source colors so each hyperscaler's flow is traceable.
  const SOURCE_COLORS = {
    'MSFT': '#5aa6ff',
    'GOOGL': '#3fd17a',
    'META':  '#ef6b6b',
    'AMZN':  '#f7a700'
  };
  const INTERMEDIATE_COLOR = '#9aa0a6';
  const SINK_COLOR = '#7a8290';

  function nodeColor(node) {
    if (SOURCE_COLORS[node.name]) return SOURCE_COLORS[node.name];
    if (node.category === 'intermediate') return INTERMEDIATE_COLOR;
    return SINK_COLOR;
  }
  function linkColor(link, alpha) {
    const baseHex = SOURCE_COLORS[link.source.name] || INTERMEDIATE_COLOR;
    const c = d3.color(baseHex);
    if (c) c.opacity = alpha;
    return c ? c.toString() : baseHex;
  }

  const nodes = SANKEY_DATA.nodes.map((n, i) => {
    let category = 'intermediate';
    if (i < 4) category = 'source';
    else if (i >= 7) category = 'sink';
    return { ...n, category };
  });

  const sankey = d3Sankey()
    .nodeWidth(16)
    .nodePadding(20)
    .extent([[margin.left, margin.top], [width - margin.right, height - margin.bottom]]);

  const layout = sankey({
    nodes: nodes.map(d => ({ ...d })),
    links: SANKEY_DATA.links.map(d => ({ ...d }))
  });
  const sn = layout.nodes;
  const sl = layout.links;

  container.innerHTML = '';

  const svg = d3.create('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', [0, 0, width, height])
    .attr('style', 'max-width: 100%; height: auto;');

  svg.append('g')
    .attr('fill', 'none')
    .selectAll('path')
    .data(sl)
    .join('path')
    .attr('d', sankeyLinkHorizontal())
    .attr('stroke', d => linkColor(d, d.source.category === 'source' ? 0.55 : 0.4))
    .attr('stroke-width', d => Math.max(1.5, d.width));

  svg.append('g')
    .selectAll('rect')
    .data(sn)
    .join('rect')
    .attr('x', d => d.x0)
    .attr('y', d => d.y0)
    .attr('height', d => Math.max(2, d.y1 - d.y0))
    .attr('width', d => d.x1 - d.x0)
    .attr('fill', d => nodeColor(d))
    .attr('opacity', 0.95);

  svg.append('g')
    .attr('font-family', 'inherit')
    .attr('font-size', 13)
    .selectAll('text')
    .data(sn)
    .join('text')
    .attr('x', d => d.x0 < width / 2 ? d.x1 + 8 : d.x0 - 8)
    .attr('y', d => (d.y1 + d.y0) / 2)
    .attr('dy', '0.35em')
    .attr('text-anchor', d => d.x0 < width / 2 ? 'start' : 'end')
    .attr('fill', d => SOURCE_COLORS[d.name] ? d3.color(SOURCE_COLORS[d.name]).brighter(0.3).toString() : 'var(--text)')
    .attr('font-weight', d => SOURCE_COLORS[d.name] ? 600 : 500)
    .text(d => d.name);

  container.appendChild(svg.node());
}

function setupThemeListener() {
  const observer = new MutationObserver(() => {
    renderSankey().catch(err => console.warn('Sankey re-render after theme change failed:', err));
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

function setMetrics() {
  const vals = {
    'hub-compute-val': '+47%',
    'hub-hyperscaler-val': '$99B',
    'hub-power-val': '+0.4%',
    'hub-adopter-val': '+13%'
  };
  for (const [id, value] of Object.entries(vals)) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  injectLoadingStyles();
  setStatus('Loading capex flows...', true);
  setMetrics();
  setupThemeListener();
  try {
    await renderSankey();
    setStatus('Ready', false);
  } catch (err) {
    console.error('Sankey render failed:', err);
    setStatus('Sankey failed to load', false);
    const container = document.getElementById('ai-sankey');
    if (container) {
      const msg = (err && err.message) ? err.message : String(err);
      const safe = msg.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
      container.innerHTML = '<div style="padding:1.5rem;color:#9aa0a6;font-size:13px;">Capex flow chart failed to load: <code style="color:#ef6b6b;">' + safe + '</code></div>';
    }
  }
});
