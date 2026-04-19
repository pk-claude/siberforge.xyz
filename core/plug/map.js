/* map.js — Plug Power US facility footprint
   Source: Item 2 (Properties) of FY2025 10-K filed 2026-03-02.
   Note: The 10-K does not disclose TPD (tons-per-day) capacity per plant.
         Pins are sized by disclosed square footage as a proxy for relative scale.
*/
(function () {
  "use strict";

  const CSS = getComputedStyle(document.documentElement);
  const C = {
    text:  CSS.getPropertyValue("--text").trim()  || "#0f172a",
    muted: CSS.getPropertyValue("--muted").trim() || "#64748b",
    line:  CSS.getPropertyValue("--line").trim()  || "#e2e6ec",
    panel: CSS.getPropertyValue("--panel").trim() || "#ffffff",
  };

  // Function-group color palette (matches legend in map.html)
  const FN_COLOR = {
    "H2 production":                   "#0891b2", // teal
    "Electrolyzer / fuel-cell mfg":    "#1d4ed8", // blue
    "R&D / corporate":                 "#d97706", // orange
    "Service center":                  "#64748b", // gray
  };

  /* -----------------------------------------------------------
     Site master list
     Data columns:
       city, state, lat, lon, fn (function group), status, sqft,
       ownership, note, hasWnyRing (red ring for divesting site)
     All sqft, ownership values are verbatim from 10-K Item 2.
     Alabama, NY (WNY) is included even though it is no longer
     in the FY25 Properties list, because the Feb 24, 2026
     definitive sale agreement brings it back into reader scope.
  ----------------------------------------------------------- */
  const SITES = [
    // H2 production (operational / JV / divesting)
    {
      city: "Kingsland", state: "GA", lat: 30.8013, lon: -81.6906,
      fn: "H2 production", status: "Operational",
      sqft: 882556, ownership: "Own",
      tpd: 15, tpdSrc: "Plug press release, Jan 2024",
      capex: null, capexLbl: "Not disclosed separately",
      capexNote: "Plant was a component of the $1.66B DOE loan covering six plants; per-plant capex not broken out publicly.",
      note: "Largest US production footprint. Camden County, GA coast. 8 × 5MW PEM electrolyzers (40 MW). Commissioned Jan 2024 — largest electrolytic liquid-H2 plant in US."
    },
    {
      city: "Charleston", state: "TN", lat: 35.2876, lon: -84.7544,
      fn: "H2 production", status: "Operational",
      sqft: 217800, ownership: "Own",
      tpd: 10, tpdSrc: "Plug 2025 year-end blog",
      capex: null, capexLbl: "Not disclosed",
      capexNote: "Existing Plug facility retrofitted with liquefaction capacity; no standalone capex figure in public filings.",
      note: "Bradley County, TN. Liquid-H2 production started Feb 2024 at an existing Plug facility."
    },
    {
      city: "St. Gabriel", state: "LA", lat: 30.2531, lon: -91.0984,
      fn: "H2 production", status: "JV",
      sqft: 371000, ownership: "Joint venture (Hidrogenii — 50/50 w/ Niloco)",
      tpd: 15, tpdSrc: "Hidrogenii JV press release, Apr 2025",
      capex: null, capexLbl: "Not disclosed",
      capexNote: "Hidrogenii JV formed 2022 with Olin (Niloco); project total investment not publicly broken out. Plug contributes liquefaction tech; Olin provides the hydrogen feedstock.",
      note: "Iberville Parish, LA. Hidrogenii JV — 50/50 with Niloco (Olin). Began producing liquid H2 in April 2025. 15 metric-TPD."
    },
    {
      city: "Alabama (Genesee Cty)", state: "NY", lat: 43.0953, lon: -78.3825,
      fn: "H2 production", status: "Divesting",
      sqft: 0, ownership: "Own — pending sale",
      tpd: 45, tpdSrc: "NY State press release, 2021",
      capex: 290, capexLbl: "$290M announced",
      capexNote: "Gov. Cuomo announced $290M investment at groundbreaking (Dec 2021). Local reporting later cited $232M actual capital deployed. Figure includes a 450 MW electric substation at STAMP that transfers to Stream DC under the sale.",
      note: "Feb 24, 2026 definitive agreement to sell to Stream US Data Centers for $132.5M–$142M. Expected close by Jun 30, 2026. Not in FY25 Item 2 Properties — held-for-sale classification. Was billed as largest green-H2 plant in N. America.",
      ring: true
    },

    // Electrolyzer / stack / fuel-cell mfg
    {
      city: "Rochester", state: "NY", lat: 43.1566, lon: -77.6088,
      fn: "Electrolyzer / fuel-cell mfg", status: "Operational",
      sqft: 155979, ownership: "Lease",
      tpd: null, tpdSrc: null,
      capex: 125, capexLbl: "$125M",
      capexNote: "Opened 2021 as the world's first PEM-stack gigafactory. Design capacity 500 MW electrolyzers/yr (expandable to 2.5 GW); target 100 MW/month reached Q2 2023.",
      note: "Electrolyzer gigafactory — stacks, MEA, R&D. Monroe County, NY."
    },
    {
      city: "Slingerlands", state: "NY", lat: 42.6437, lon: -73.8826,
      fn: "Electrolyzer / fuel-cell mfg", status: "Operational",
      sqft: 350000, ownership: "Lease",
      tpd: null, tpdSrc: null,
      capex: 125, capexLbl: "$125M (from $55M groundbreaking)",
      capexNote: "Groundbreaking announced at $55M (Mar 2022); final price at ribbon-cutting (Jan 2023) was $125M. Committed to 1,600 jobs at Vista Technology Campus, Albany County.",
      note: "GenDrive fuel-cell mfg, warehousing, and corporate offices. Largest US mfg footprint. HQ consolidated here from Latham."
    },
    {
      city: "Concord", state: "MA", lat: 42.4604, lon: -71.3489,
      fn: "Electrolyzer / fuel-cell mfg", status: "Operational",
      sqft: 33000, ownership: "Lease",
      tpd: null, tpdSrc: null,
      capex: null, capexLbl: "Not disclosed",
      capexNote: "Legacy Giner ELX / Joule Processes operation acquired by Plug 2020. No standalone capex figure publicly available.",
      note: "Cryogenic equipment and fuel-cell component mfg."
    },
    {
      city: "Houston", state: "TX", lat: 29.7604, lon: -95.3698,
      fn: "Electrolyzer / fuel-cell mfg", status: "Operational",
      sqft: 192446, ownership: "Lease",
      tpd: null, tpdSrc: null,
      capex: null, capexLbl: "Not disclosed",
      capexNote: "Plant acquired with Applied Cryo Technologies (Dec 2022). Purchase price not separately disclosed.",
      note: "Manufacturing and office. Cryogenic trailers and storage equipment."
    },
    {
      city: "Magnolia", state: "TX", lat: 30.2091, lon: -95.7502,
      fn: "Electrolyzer / fuel-cell mfg", status: "Operational",
      sqft: 69550, ownership: "Lease",
      tpd: null, tpdSrc: null,
      capex: null, capexLbl: "Not disclosed",
      capexNote: "Companion site to Houston cryogenic operations.",
      note: "Manufacturing and office."
    },
    {
      city: "LaFayette", state: "IN", lat: 40.4167, lon: -86.8753,
      fn: "Electrolyzer / fuel-cell mfg", status: "Operational",
      sqft: 123000, ownership: "Own",
      tpd: null, tpdSrc: null,
      capex: null, capexLbl: "Not disclosed",
      capexNote: "Only US mfg site Plug owns outright. No standalone capex figure in public filings.",
      note: "Manufacturing and office. Fuel-cell engine assembly."
    },
    {
      city: "Miamisburg", state: "OH", lat: 39.6423, lon: -84.2866,
      fn: "Service center", status: "Operational",
      sqft: 71550, ownership: "Lease",
      tpd: null, tpdSrc: null,
      capex: null, capexLbl: "Not disclosed",
      capexNote: "Acquired via United Hydrogen (2020) / subsequent expansions.",
      note: "Service center supporting Midwest deployed fleet."
    }
  ];

  /* -----------------------------------------------------------
     Map rendering — scattergeo
  ----------------------------------------------------------- */
  // Pin size: scale by sqrt(sqft) so visual area ≈ footprint
  const sizes = SITES.map(s => s.sqft > 0 ? Math.max(10, Math.sqrt(s.sqft) / 12) : 12);
  const colors = SITES.map(s => FN_COLOR[s.fn] || "#64748b");
  const lineColors = SITES.map(s => s.ring ? "#dc2626" : "#ffffff");
  const lineWidths = SITES.map(s => s.ring ? 3 : 1.5);

  const hoverText = SITES.map(s => {
    const sz = s.sqft ? s.sqft.toLocaleString("en-US") + " sq ft" : "—";
    const tpdLine = s.tpd ? `Capacity: <b>${s.tpd} TPD</b> (liquid H2)<br>` : "";
    const capexLine = s.capexLbl ? `Capex: <b>${s.capexLbl}</b><br>` : "";
    return `<b>${s.city}, ${s.state}</b><br>` +
           `<span style="color:${FN_COLOR[s.fn]||'#64748b'}">${s.fn}</span><br>` +
           `Size: ${sz}<br>` +
           tpdLine +
           capexLine +
           `Ownership: ${s.ownership}<br>` +
           `<i>${s.note}</i>`;
  });

  Plotly.newPlot("chart-map", [{
    type: "scattergeo",
    mode: "markers",
    lat: SITES.map(s => s.lat),
    lon: SITES.map(s => s.lon),
    text: hoverText,
    hovertemplate: "%{text}<extra></extra>",
    marker: {
      size: sizes,
      color: colors,
      line: { color: lineColors, width: lineWidths },
      opacity: 0.88,
      sizemode: "diameter"
    }
  }], {
    geo: {
      scope: "usa",
      projection: { type: "albers usa" },
      showland: true,
      landcolor: "#f5f7fa",
      subunitcolor: "#cbd5e1",
      subunitwidth: 0.6,
      countrycolor: "#94a3b8",
      countrywidth: 0.8,
      showlakes: false,
      showframe: false,
      bgcolor: C.panel
    },
    paper_bgcolor: C.panel,
    plot_bgcolor: C.panel,
    font: { family: "Inter, system-ui, sans-serif", size: 12, color: C.text },
    margin: { l: 8, r: 8, t: 8, b: 8 },
    hoverlabel: { bgcolor: "#1e293b", font: { color: "#f8fafc" } }
  }, { displayModeBar: false, responsive: true });

  /* -----------------------------------------------------------
     Site detail table
  ----------------------------------------------------------- */
  const tbody = document.getElementById("site-tbody");
  const fnClass = { "H2 production": "fn-h2", "Electrolyzer / fuel-cell mfg": "fn-mfg", "R&D / corporate": "fn-rd", "Service center": "fn-svc" };
  const stClass = { "Operational": "operational", "JV": "jv", "Divesting": "divesting" };

  // Sort: H2 first, then mfg (largest → smallest sqft), then service
  const sortOrder = { "H2 production": 0, "Electrolyzer / fuel-cell mfg": 1, "R&D / corporate": 2, "Service center": 3 };
  const sorted = SITES.slice().sort((a,b) => {
    const fd = sortOrder[a.fn] - sortOrder[b.fn];
    if (fd !== 0) return fd;
    return b.sqft - a.sqft;
  });

  sorted.forEach(s => {
    const tr = document.createElement("tr");
    const sqftCell = s.sqft ? s.sqft.toLocaleString("en-US") : "—";
    const tpdCell = s.tpd ? `${s.tpd} TPD` : "—";
    const capexCell = s.capexLbl || "—";
    const capexTitle = s.capexNote ? ` title="${s.capexNote.replace(/"/g,'&quot;')}"` : "";
    tr.innerHTML = `
      <td style="text-align:left; font-weight:600">${s.city}</td>
      <td>${s.state}</td>
      <td class="${fnClass[s.fn]||''}">${s.fn}</td>
      <td class="c-size">${sqftCell}</td>
      <td class="c-size">${tpdCell}</td>
      <td class="c-size"${capexTitle}>${capexCell}</td>
      <td>${s.ownership}</td>
      <td><span class="st-pill ${stClass[s.status]||''}">${s.status}</span></td>
      <td style="color: var(--muted); font-size: 12px">${s.note}</td>
    `;
    tbody.appendChild(tr);
  });

})();
