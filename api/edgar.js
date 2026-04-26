// Vercel serverless function: proxies SEC EDGAR companyfacts API.
// Returns { series: [...], errors: [...] } with partial-failure tolerance.
//
// EDGAR XBRL API returns company facts keyed by concept name (e.g., Revenues, PaymentsToAcquirePropertyPlantAndEquipment).
// Concepts map to specific accounting line items. Facts are grouped by unit (e.g., USD) and form type (10-K, 10-Q).
// We filter to consolidated figures (unit='USD') and quarterly/annual reports (10-Q or 10-K).
// Instant facts (period end on a single date) are separate from duration facts (period spanning multiple dates).

const EDGAR_BASE = 'https://data.sec.gov/api/xbrl/companyfacts';
const EDGAR_USER_AGENT = 'Siberforge dashboard contact@siberforge.xyz';

// Company whitelist: CIK padded to 10 digits
const COMPANY_WHITELIST = {
  MSFT: '0000789019',
  GOOGL: '0001652044',
  META: '0001326801',
  AMZN: '0001018724',
  ORCL: '0001341439',
  NVDA: '0001045810',
  AMD: '0000002488',
  AVGO: '0001730168',
};

// Whitelisted XBRL concepts
const CONCEPT_WHITELIST = [
  'PaymentsToAcquirePropertyPlantAndEquipment', // CapEx
  'Revenues',
  'RevenueFromContractWithCustomerExcludingAssessedTax',
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchCompanyFacts(ticker, concepts, index) {
  const cik = COMPANY_WHITELIST[ticker];
  if (!cik) throw new Error(`unknown company ticker ${ticker}`);

  // Add serial delay to avoid rate limiting (100ms between requests)
  if (index > 0) await sleep(100 * index);

  const url = `${EDGAR_BASE}/CIK${cik}.json`;

  const RETRY_DELAYS = [400, 1200];
  let lastErr;
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': EDGAR_USER_AGENT },
      });
      if (res.ok) {
        const json = await res.json();
        const facts = json?.facts?.['us-gaap'] || {};
        const result = [];

        // Validate requested concepts
        for (const concept of concepts) {
          if (!CONCEPT_WHITELIST.includes(concept)) {
            throw new Error(`concept ${concept} not whitelisted`);
          }
          if (!(concept in facts)) continue;

          const conceptData = facts[concept];
          const usdUnits = conceptData?.units?.USD || [];
          const filtered = usdUnits
            .filter(f => (f.form === '10-Q' || f.form === '10-K') && f.end)
            .map(f => ({
              end: f.end,
              val: Number(f.val),
              fy: f.fy || null,
              fp: f.fp || null,
              form: f.form,
            }))
            .filter(o => Number.isFinite(o.val));

          if (filtered.length > 0) {
            result.push({
              company: ticker,
              concept,
              observations: filtered,
            });
          }
        }
        return result;
      }
      const text = await res.text();
      const transient = res.status >= 500 || res.status === 429;
      lastErr = new Error(`EDGAR ${ticker} ${res.status}: ${text.slice(0, 200)}`);
      if (!transient || attempt === RETRY_DELAYS.length) throw lastErr;
      await sleep(RETRY_DELAYS[attempt]);
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (attempt === RETRY_DELAYS.length) throw lastErr;
      await sleep(RETRY_DELAYS[attempt]);
    }
  }
  throw lastErr || new Error(`EDGAR ${ticker} unknown failure`);
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const company = req.query.company?.toUpperCase?.();
    const conceptsStr = req.query.concepts || '';
    const concepts = conceptsStr.split(',').map(c => c.trim()).filter(Boolean);

    if (!company || !concepts.length) {
      return res.status(400).json({ error: 'missing company or concepts' });
    }

    if (!COMPANY_WHITELIST[company]) {
      return res.status(400).json({ error: `unknown company ${company}` });
    }

    for (const c of concepts) {
      if (!CONCEPT_WHITELIST.includes(c)) {
        return res.status(400).json({ error: `concept ${c} not whitelisted` });
      }
    }

    const data = await fetchCompanyFacts(company, concepts, 0);
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=172800');
    return res.status(200).json({ series: data, errors: [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(400).json({ error: msg });
  }
}
