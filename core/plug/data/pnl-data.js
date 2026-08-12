/* pnl-data.js — Plug Power quarterly P&L, Q1 2024 – Q2 2026.
   All values in US$ thousands as reported.

   Sources:
     Q1/Q2/Q3 2024: 10-Qs (0001558370-24-007592 / -011593 / -015312), 3-month columns
     Q4 2024:       derived = FY2024 10-K minus Q1+Q2+Q3 standalone
     Q1 2025:       Q1'25 10-Q (0001558370-25-007412)
     Q2 2025:       Q2'26 press release comparative column (Aug 10, 2026)
     Q3 2025:       Q3'25 10-Q (0001104659-25-109279)
     Q4 2025:       derived = FY2025 10-K minus 9M'25 YTD (Q3'25 10-Q)
     Q1 2026:       Q1'26 10-Q (0001104659-26-058712)
     Q2 2026:       Q2'26 press release / 10-Q (filed 2026-08-10)

   Schema:
     { q, rev:  {eq, sv, ppa, fuel, other},
          cogs: {eq, sv, svLoss, ppa, fuel, other},
          opex: {rd, sga, restr, impair, cc},
          nlPlug }
   svLoss = "provision for (benefit from) loss contracts related to service".
   cc     = change in fair value of contingent consideration.
   nlPlug = net loss attributable to Plug Power Inc.

   Derived Q4 columns absorb any FY-vs-YTD restatements (YTD-difference
   method) — e.g. the Q4'25 services-revenue spike partly reflects 10-K
   reclassification, and Q4 impairments are the annual kitchen-sink
   charges (Q4'24 $940.9M, Q4'25 $666.3M).
*/
window.PLUG_PNL_DATA = [
  { q: "Q1'24",
    rev:  { eq:  68295, sv: 13023, ppa: 18304, fuel: 18286, other: 2356 },
    cogs: { eq: 135125, sv: 12957, svLoss: 15745, ppa: 55228, fuel: 58573, other: 1711 },
    opex: { rd: 25280, sga:  77959, restr:  6011, impair:    284, cc:  -9200 },
    nlPlug: -295776 },
  { q: "Q2'24",
    rev:  { eq:  76788, sv: 13034, ppa: 19674, fuel: 29887, other: 3967 },
    cogs: { eq: 129911, sv: 13730, svLoss: 16484, ppa: 54312, fuel: 58317, other: 1851 },
    opex: { rd: 18940, sga:  85144, restr:  1629, impair:   3937, cc:   3768 },
    nlPlug: -262333 },
  { q: "Q3'24",
    rev:  { eq: 107141, sv: 14148, ppa: 20459, fuel: 29791, other: 2191 },
    cogs: { eq: 149912, sv:  9086, svLoss:  6036, ppa: 51782, fuel: 55538, other: 1401 },
    opex: { rd: 19712, sga:  91586, restr:   514, impair:   4185, cc:    146 },
    nlPlug: -211168 },
  { q: "Q4'24",
    rev:  { eq: 138111, sv: 11964, ppa: 19405, fuel: 19918, other: 2072 },
    cogs: { eq: 281139, sv: 21993, svLoss: 10274, ppa: 55625, fuel: 56399, other:  572 },
    opex: { rd: 13294, sga: 121421, restr:    -1, impair: 940909, cc: -10561 },
    nlPlug: -1335424 },
  { q: "Q1'25",
    rev:  { eq:  63506, sv: 16874, ppa: 23210, fuel: 29457, other:  627 },
    cogs: { eq:  74556, sv: 14462, svLoss:  8888, ppa: 49932, fuel: 59354, other:  343 },
    opex: { rd: 17357, sga:  80839, restr: 17154, impair:   1064, cc: -11819 },
    nlPlug: -196656 },
  { q: "Q2'25",
    rev:  { eq:  99173, sv: 16367, ppa: 23633, fuel: 34399, other:  398 },
    cogs: { eq: 117280, sv:  9996, svLoss: -10832, ppa: 45272, fuel: 65636, other:   83 },
    opex: { rd: 12193, sga:  87893, restr:  2964, impair:  20599, cc:   -168 },
    nlPlug: -227099 },
  { q: "Q3'25",
    rev:  { eq:  96773, sv: 19742, ppa: 24604, fuel: 35912, other:   24 },
    cogs: { eq: 171501, sv: 20083, svLoss: -4343, ppa: 45573, fuel: 64392, other:   14 },
    opex: { rd: 16118, sga: 110592, restr:  5519, impair:  97524, cc:  -1129 },
    nlPlug: -361869 },
  { q: "Q4'25",
    rev:  { eq: 111629, sv: 41479, ppa: 36125, fuel: 33643, other: 2344 },
    cogs: { eq: 114404, sv: 25812, svLoss: -18320, ppa: 37956, fuel: 58679, other: 1238 },
    opex: { rd: 12292, sga: 100246, restr:   220, impair: 666257, cc: -10370 },
    nlPlug: -845970 },
  { q: "Q1'26",
    rev:  { eq:  79022, sv: 21970, ppa: 26290, fuel: 35795, other:  436 },
    cogs: { eq:  85327, sv: 14421, svLoss: -7814, ppa: 40148, fuel: 52892, other:  146 },
    opex: { rd: 12113, sga:  70208, restr:  1425, impair:   3856, cc:    280 },
    nlPlug: -245304 },
  { q: "Q2'26",
    rev:  { eq:  81898, sv: 29844, ppa: 26932, fuel: 39472, other:  153 },
    cogs: { eq:  80326, sv: 21724, svLoss: -15674, ppa: 35000, fuel: 58495, other:  103 },
    opex: { rd: 13420, sga:  29267, restr:   184, impair:  19365, cc:    197 },
    nlPlug: -188207 },
];
