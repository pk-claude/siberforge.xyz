// Per-ticker descriptions for equity-based indicators rendered as individual tiles
// (REIT constituents on the Industrial RE page).
//
// Hovered/clicked from a ticker tile to give a non-finance reader a quick read on
// what each company is and why it matters in the supply chain context.

export const TICKER_INFO = {
  // -------------------- INDUSTRIAL REITs --------------------
  PLD: {
    name: 'Prologis',
    sector: 'Industrial REIT',
    marketCap: '~$130B',
    footprint: '1.2B sqft logistics RE · US, EU, Asia',
    role: 'World\'s largest industrial REIT. Bellwether for global goods-flow demand. Tenants include Amazon, FedEx, UPS, Microsoft, Home Depot. Stock often leads private-market industrial cap rates by 6-12 months.',
  },
  REXR: {
    name: 'Rexford Industrial Realty',
    sector: 'Industrial REIT',
    marketCap: '~$10B',
    footprint: 'Southern California infill industrial',
    role: 'Pure-play SoCal infill. Direct read on LA/IE warehouse rents — the largest US industrial market and the entry point for ~40% of containerized imports. Higher rent growth than national basket due to land scarcity.',
  },
  FR: {
    name: 'First Industrial Realty Trust',
    sector: 'Industrial REIT',
    marketCap: '~$7B',
    footprint: 'Top-15 US logistics markets',
    role: 'Tier-1 industrial focused on bulk distribution buildings. Mid-size operator, well-diversified across markets. Useful as a national-average benchmark vs Prologis (premium global) and STAG (secondary markets).',
  },
  STAG: {
    name: 'STAG Industrial',
    sector: 'Industrial REIT',
    marketCap: '~$7B',
    footprint: 'Secondary/tertiary US markets',
    role: 'Single-tenant industrial in non-gateway markets. Read on inland distribution and secondary-market warehouse demand. Higher cap rates than coastal peers, reflecting market-tier risk.',
  },
  EGP: {
    name: 'EastGroup Properties',
    sector: 'Industrial REIT',
    marketCap: '~$8B',
    footprint: 'Sunbelt US (TX, FL, CA, GA)',
    role: 'Sunbelt-focused industrial. Direct beneficiary of US population migration south and reshoring (TX/AZ semiconductor + auto plants). Multi-tenant business distribution buildings.',
  },
  TRNO: {
    name: 'Terreno Realty',
    sector: 'Industrial REIT',
    marketCap: '~$6B',
    footprint: 'Six coastal markets (NY/NJ, LA, SF, Seattle, Miami, DC)',
    role: 'Coastal-only industrial REIT. Highest land-value-per-foot in the basket. Read on port-proximate logistics rent — most exposed to port volume cycles.',
  },

  // -------------------- COLD STORAGE REITs --------------------
  COLD: {
    name: 'Americold Realty Trust',
    sector: 'Cold Storage REIT',
    marketCap: '~$6B',
    footprint: '~250 cold storage warehouses globally',
    role: 'Largest US cold storage operator (Americold). Cold chain is structurally tighter than dry industrial — limited new construction, higher capex, regulated. Read on food/pharma supply chain capacity.',
  },
  LINE: {
    name: 'Lineage',
    sector: 'Cold Storage REIT',
    marketCap: '~$15B',
    footprint: '~480 facilities globally, ~3B cubic feet',
    role: 'World\'s largest cold-storage operator. IPO\'d July 2024. Massive scale advantage in temperature-controlled logistics. Direct read on perishable goods supply chain.',
  },

  // -------------------- SELF-STORAGE REITs --------------------
  PSA: {
    name: 'Public Storage',
    sector: 'Self-Storage REIT',
    marketCap: '~$50B',
    footprint: '~3,000 US self-storage facilities',
    role: 'Largest self-storage operator in the US. Adjacent to last-mile/consumer warehousing. Demand cycles with home-buying activity (moving boxes) and small-business inventory. Counter-cyclical defensive characteristics.',
  },
  EXR: {
    name: 'Extra Space Storage',
    sector: 'Self-Storage REIT',
    marketCap: '~$32B',
    footprint: '~2,400 facilities, including managed for third parties',
    role: 'Second-largest self-storage. More tech-forward than PSA — heavy use of revenue management algorithms. Read on consumer storage demand and small business inventory.',
  },
  CUBE: {
    name: 'CubeSmart',
    sector: 'Self-Storage REIT',
    marketCap: '~$10B',
    footprint: '~1,400 facilities',
    role: 'Mid-size self-storage operator with concentration in urban markets. Often a take-out target for larger peers in consolidation cycles.',
  },
};
