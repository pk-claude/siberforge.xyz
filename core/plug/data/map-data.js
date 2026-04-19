/* map-data.js — Plug Power US facility footprint (from FY2025 10-K Item 2 Properties).

   Schema:
     { city, state, lat, lon,
       fn (function group), status,
       sqft, ownership,
       tpd (tons-per-day; null if not published), tpdSrc,
       capex (USD millions or null), capexLbl, capexNote,
       note,
       ring (optional bool — red divesting-marker ring) }

   Alabama, NY (WNY) is included even though it is no longer in the FY25
   Properties list, because the Feb 24, 2026 definitive sale agreement
   brings it back into reader scope.
*/
window.PLUG_MAP_SITES = [
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
