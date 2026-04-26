// /core/ai/hub.js — AI hub page: sankey hero + pillar card metrics

// Hardcoded sankey data (2025E): hyperscalers → capex buckets → end beneficiaries
// Values are approximate capex $ billions. Will be replaced by live data in Phase 2-3.
const SANKEY_DATA = {
  nodes: [
    { name: 'MSFT' }, { name: 'GOOGL' }, { name: 'META' }, { name: 'AMZN' },
    { name: 'Compute & semis' }, { name: 'Power & DC infra' }, { name: 'Networking & other' },
    { name: 'NVDA' }, { name: 'AVGO' }, { name: 'AMD' }, { name: 'TSM' }, { name: 'Custom silicon' },
    { name: 'CEG / VST' }, { name: 'GEV / ETR' }, { name: 'Land / buildings' }
  ],
  links: [
    // MSFT capex breakdown (est. $60B for AI, split across buckets)
    { source: 0, target: 4, value: 55 }, { source: 0, target: 5, value: 25 }, { source: 0, target: 6, value: 15 },
    // GOOGL (est. $50B for AI)
    { source: 1, target: 4, value: 54 }, { source: 1, target: 5, value: 22 }, { source: 1, target: 6, value: 14 },
    // META (est. $37B for AI)
    { source: 2, target: 4, value: 42 }, { source: 2, target: 5, value: 18 }, { source: 2, target: 6, value: 10 },
    // AMZN (est. $70B for AI)
    { source: 3, target: 4, value: 68 }, { source: 3, target: 5, value: 30 }, { source: 3, target: 6, value: 17 },
    // Compute & semis splits: NVDA >> AVGO > AMD > TSM > custom
    { source: 4, target: 7, value: 130 }, { source: 4, target: 8, value: 38 }, { source: 4, target: 9, value: 24 },
    { source: 4, target: 10, value: 18 }, { source: 4, target: 11, value: 9 },
    // Power splits: CEG, GEV, land/buildings roughly equal third each
    { source: 5, target: 12, value: 38 }, { source: 5, target: 13, value: 30 }, { source: 5, target: 14, value: 27 }
  ]
};

// Placeholder: pillar card metrics are rendered but not populated (live data in Phase 2-3)
// This is the static UI that future phases will wire data into.

async function renderSankey() {
  const container = document.getElementById('ai-sankey');
  if (!container) return;

  // Dynamic import: D3 from CDN
  const d3 = await import('https://cdn.jsdelivr.net/npm/d3@7.8.5/+esm').then(m => m.default);
  const { sankey: d3Sankey, sankeyLinkHorizontal } = await import(
    'https://cdn.jsdelivr.net/npm/d3-sankey@0.12.3/+esm'
  ).then(m => ({ sankey: m.sankey, sankeyLinkHorizontal: m.sankeyLinkHorizontal }));

  const width = container.clientWidth || 960;
  const height = 340;
  const margin = { top: 20, right: 160, bottom: 20, left: 160 };

  // Color scale: accent for sources, muted for intermediates, secondary for sinks
  const color = d3.scaleOrdinal()
    .domain(['source', 'intermediate', 'sink'])
    .range([
      getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
      getComputedStyle(document.documentElement).getPropertyValue('--muted').trim(),
      getComputedStyle(document.documentElement).getPropertyValue('--line').trim()
    ]);

  // Categorize nodes
  const nodes = SANKEY_DATA.nodes.map((n, i) => {
    let category = 'intermediate';
    if (i < 4) category = 'source'; // Hyperscalers
    else if (i >= 7) category = 'sink'; // Final beneficiaries
    return { ...n, category };
  });

  const sankey = d3Sankey()
    .nodeWidth(15)
    .nodePadding(40)
    .extent([[margin.left, margin.top], [width - margin.right, height - margin.bottom]]);

  const { nodes: sn, links: sl } = sankey({
    nodes: nodes.map(d => ({ ...d })),
    links: SANKEY_DATA.links.map(d => ({ ...d }))
  });

  // Clear container
  container.innerHTML = '';

  // SVG
  const svg = d3.create('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', [0, 0, width, height])
    .attr('style', 'max-width: 100%; height: auto;');

  // Links (flows)
  svg.append('g')
    .selectAll('path')
    .data(sl)
    .join('path')
    .attr('d', sankeyLinkHorizontal())
    .attr('stroke', d => {
      const sourceCategory = nodes[d.source.index].category;
      const alpha = sourceCategory === 'source' ? 0.4 : 0.3;
      const rgb = color(sourceCategory).match(/\d+/g);
      return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
    })
    .attr('stroke-width', d => Math.max(1, d.width));

  // Nodes (boxes)
  svg.append('g')
    .selectAll('rect')
    .data(sn)
    .join('rect')
    .attr('x', d => d.x0)
    .attr('y', d => d.y0)
    .attr('height', d => d.y1 - d.y0)
    .attr('width', d => d.x1 - d.x0)
    .attr('fill', d => color(d.category))
    .attr('opacity', 0.8);

  // Labels
  svg.append('g')
    .attr('font-family', 'inherit')
    .attr('font-size', 11)
    .attr('color', 'var(--text)')
    .selectAll('text')
    .data(sn)
    .join('text')
    .attr('x', d => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6)
    .attr('y', d => (d.y1 + d.y0) / 2)
    .attr('dy', '0.35em')
    .attr('text-anchor', d => d.x0 < width / 2 ? 'start' : 'end')
    .attr('fill', 'var(--text)')
    .text(d => d.name);

  container.appendChild(svg.node());
}

// On theme change, re-render the sankey
function setupThemeListener() {
  const observer = new MutationObserver(() => {
    renderSankey();
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}


// Wire hardcoded pillar card metrics (v1)
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

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
  renderSankey().catch(err => console.error('Sankey render failed:', err));
  setupThemeListener();
  setMetrics();
});
