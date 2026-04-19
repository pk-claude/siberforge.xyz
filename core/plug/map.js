/* map.js — Plug Power US facility footprint
   Source: Item 2 (Properties) of FY2025 10-K filed 2026-03-02.
   Note: The 10-K does not disclose TPD (tons-per-day) capacity per plant.
         Pins are sized by disclosed square footage as a proxy for relative scale.
*/
(function () {
  "use strict";

  /* ---- shared palette (from /core/lib/plotly-theme.js) ---- */
  const C = window.PlotlyTheme.readPalette();

  // Function-group color palette (matches legend in map.html).
  // Pulled from the shared theme so the map stays consistent with the
  // flow-statement charts.
  const FN_COLOR = {
    "H2 production":                   C.cashBasic, // teal
    "Electrolyzer / fuel-cell mfg":    C.cfo,       // blue
    "R&D / corporate":                 C.cashTotal, // orange
    "Service center":                  C.muted,     // gray
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
  // Data loaded from ./data/map-data.js (see <script> tag in map.html).
  const SITES = window.PLUG_MAP_SITES;

  /* -----------------------------------------------------------
     Map rendering — scattergeo
  ----------------------------------------------------------- */
  // Pin size: scale by sqrt(sqft) so visual area ≈ footprint
  const sizes = SITES.map(s => s.sqft > 0 ? Math.max(10, Math.sqrt(s.sqft) / 12) : 12);
  const colors = SITES.map(s => FN_COLOR[s.fn] || C.muted);
  const lineColors = SITES.map(s => s.ring ? C.red : C.panel);
  const lineWidths = SITES.map(s => s.ring ? 3 : 1.5);

  const hoverText = SITES.map(s => {
    const sz = s.sqft ? s.sqft.toLocaleString("en-US") + " sq ft" : "—";
    const tpdLine = s.tpd ? `Capacity: <b>${s.tpd} TPD</b> (liquid H2)<br>` : "";
    const capexLine = s.capexLbl ? `Capex: <b>${s.capexLbl}</b><br>` : "";
    return `<b>${s.city}, ${s.state}</b><br>` +
           `<span style="color:${FN_COLOR[s.fn] || C.muted}">${s.fn}</span><br>` +
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
    ...window.PlotlyTheme.baseLayout(C),
    geo: {
      scope: "usa",
      projection: { type: "albers usa" },
      showland: true,
      landcolor: C.panel2,
      subunitcolor: "#cbd5e1",
      subunitwidth: 0.6,
      countrycolor: C.muted2,
      countrywidth: 0.8,
      showlakes: false,
      showframe: false,
      bgcolor: C.panel
    },
    margin: { l: 8, r: 8, t: 8, b: 8 },
  }, window.PlotlyTheme.plotCfg);

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
