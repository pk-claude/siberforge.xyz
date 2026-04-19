/* revenue-data.js — Plug Power revenue & COGS by product line, FY2015-FY2025.
   All values in US$ thousands as reported in 10-K filings.

   Sources (by year range):
     FY2015-FY2016: FY2016 10-K filed 2017-03-10 (pre-restatement)
     FY2017:        FY2018 10-K filed 2019-03-13 (pre-restatement)
     FY2018-FY2020: FY2020 10-K (restated) filed 2021-05-14
     FY2021-FY2022: FY2022 10-K filed 2023-03-01
     FY2023-FY2025: FY2025 10-K filed 2026-03-02

   Schema:
     { year, rev: {eq, sv, ppa, fuel, other},
             cogs:{eq, sv, svLoss, ppa, fuel, other} }
   svLoss = separately disclosed "provision for loss contracts related to
   service" which revenue.js combines with the main services COGS line.
*/
window.PLUG_REVENUE_DATA = [
  { year: 2015,
    rev:  { eq:  78002, sv: 14012, ppa:  5718, fuel:  5075, other:  481 },
    cogs: { eq:  67703, sv: 22937, svLoss: 10050, ppa:  5253, fuel:  6695, other:  540 } },
  { year: 2016,
    rev:  { eq:  39985, sv: 17347, ppa: 13687, fuel: 10916, other:  884 },
    cogs: { eq:  29543, sv: 19071, svLoss: -1071, ppa: 16601, fuel: 13864, other:  865 } },
  { year: 2017,
    rev:  { eq:  62631, sv: 16202, ppa: 12869, fuel:  8167, other:  284 },
    cogs: { eq:  54815, sv: 19814, svLoss:     0, ppa: 31292, fuel: 22013, other:  308 } },
  { year: 2018,
    rev:  { eq: 107175, sv: 22002, ppa: 22569, fuel: 22469, other:    0 },
    cogs: { eq:  85205, sv: 32271, svLoss:  5345, ppa: 41361, fuel: 36037, other:    0 } },
  { year: 2019,
    rev:  { eq: 149920, sv: 25217, ppa: 25553, fuel: 29099, other:  186 },
    cogs: { eq:  97915, sv: 34582, svLoss:  -394, ppa: 41777, fuel: 45247, other:  200 } },
  { year: 2020,
    rev:  { eq: -94295, sv: -9801, ppa: 26620, fuel:-16072, other:  311 },
    cogs: { eq: 171404, sv: 42524, svLoss: 35473, ppa: 64640, fuel: 61815, other:  323 } },
  { year: 2021,
    rev:  { eq: 392777, sv: 26706, ppa: 35153, fuel: 46917, other:  789 },
    cogs: { eq: 307157, sv: 63729, svLoss: 71988, ppa:102417, fuel:127196, other: 1165 } },
  { year: 2022,
    rev:  { eq: 558932, sv: 35280, ppa: 47183, fuel: 57196, other: 2849 },
    cogs: { eq: 468057, sv: 59365, svLoss: 26801, ppa:144696, fuel:194255, other: 2622 } },
  { year: 2023,
    rev:  { eq: 711433, sv: 39093, ppa: 63731, fuel: 66246, other:10837 },
    cogs: { eq: 765575, sv: 75412, svLoss: 86346, ppa:218936, fuel:246318, other: 6544 } },
  { year: 2024,
    rev:  { eq: 390335, sv: 52169, ppa: 77842, fuel: 97882, other:10586 },
    cogs: { eq: 696087, sv: 57766, svLoss: 48539, ppa:216947, fuel:228827, other: 5535 } },
  { year: 2025,
    rev:  { eq: 371081, sv: 94462, ppa:107572, fuel:133411, other: 3393 },
    cogs: { eq: 477741, sv: 70353, svLoss:-24607, ppa:178733, fuel:248061, other: 1678 } },
];
