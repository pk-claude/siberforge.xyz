// Vercel serverless function: upcoming FRED release calendar.
//
// Query FRED's /fred/releases/dates endpoint, filter to releases the Economic
// Dashboard cares about, and return the next 21 days of scheduled releases.
//
// Edge-cached 6h. FRED publishes release dates 4–6 weeks ahead; polling more
// often buys nothing.

const FRED_RELEASES_URL = 'https://api.stlouisfed.org/fred/releases/dates';

// Release IDs we surface on the dashboard → display metadata.
//
// All IDs below verified via FRED /fred/series/release?series_id=... lookups.
// To add a release: hit /series/release for the series you care about and
// paste the returned release_id + name.
//
// `indicator_ids` maps back to dashboard indicator IDs (from core/econ/indicators.js
// INDICATORS[].id) — the client uses these to locate the card via
// document.querySelector('.card[data-id=<indicator_id>]') for scroll-to on click.
// These are NOT raw FRED series IDs; some indicators have friendlier IDs
// (e.g. indicator 'AHE' wraps FRED series 'CES0500000003').
const RELEASE_MAP = {
  10:  { short: 'CPI',              name: 'Consumer Price Index',                 indicator_ids: ['CPILFESL'] },
  13:  { short: 'Ind. Production',  name: 'Industrial Production & Cap Util',     indicator_ids: ['INDPRO'] },
  27:  { short: 'Housing Starts',   name: 'New Residential Construction',         indicator_ids: ['PERMIT', 'HOUST'] },
  50:  { short: 'Employment',       name: 'Employment Situation',                 indicator_ids: ['UNRATE', 'PAYEMS', 'AHE'] },
  53:  { short: 'GDP',              name: 'Gross Domestic Product',               indicator_ids: ['GDPC1'] },
  54:  { short: 'PCE',              name: 'Personal Income & Outlays',            indicator_ids: ['PCEPILFE'] },
  92:  { short: 'Retail Sales',     name: 'Selected Real Retail Sales',           indicator_ids: ['RRSFS'] },
  97:  { short: 'New Home Sales',   name: 'New Residential Sales',                indicator_ids: ['HSN1F'] },
  180: { short: 'Jobless Claims',   name: 'Unemployment Insurance Weekly Claims', indicator_ids: ['IC4WSA'] },
  190: { short: 'Mortgage Rates',   name: 'Primary Mortgage Market Survey',       indicator_ids: ['MORTGAGE30US'] },
  199: { short: 'Case-Shiller',     name: 'S&P Cotality Case-Shiller HPI',        indicator_ids: ['CSUSHPISA'] },
  231: { short: 'CC Delinquency',   name: 'Charge-Off & Delinquency Rates',       indicator_ids: ['DRCCLACBS'] },
  291: { short: 'Existing Sales',   name: 'Existing Home Sales',                  indicator_ids: ['EXHOSLUS'] },
  313: { short: 'Sticky CPI',       name: 'Sticky Price CPI',                     indicator_ids: ['STICKY'] },
  321: { short: 'Empire State',     name: 'Empire State Manufacturing Survey',    indicator_ids: ['EMPIRE'] },
};

function todayUTC() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function daysBetween(from, to) {
  const a = Date.parse(from + 'T00:00:00Z');
  const b = Date.parse(to + 'T00:00:00Z');
  return Math.round((b - a) / 86400000);
}

export default async function handler(req, res) {
  const key = process.env.FRED_API_KEY;
  if (!key) {
    return res.status(500).json({ error: 'FRED_API_KEY not configured on server' });
  }

  const today = todayUTC();
  const horizonDays = Math.min(60, Math.max(7, Number(req.query.days) || 21));

  const url = new URL(FRED_RELEASES_URL);
  url.searchParams.set('api_key', key);
  url.searchParams.set('file_type', 'json');
  url.searchParams.set('sort_order', 'asc');
  url.searchParams.set('include_release_dates_with_no_data', 'true');
  url.searchParams.set('realtime_start', today);
  // FRED caps realtime windows; use a broad end date.
  const end = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
  url.searchParams.set('realtime_end', end);
  url.searchParams.set('limit', '1000');

  try {
    const upstream = await fetch(url.toString());
    if (!upstream.ok) {
      const text = await upstream.text();
      throw new Error(`FRED ${upstream.status}: ${text.slice(0, 200)}`);
    }
    const json = await upstream.json();

    const now = Date.parse(today + 'T00:00:00Z');
    const cutoff = now + horizonDays * 86400000;

    const items = (json.release_dates || [])
      .filter(r => RELEASE_MAP[r.release_id])
      .filter(r => {
        const t = Date.parse(r.date + 'T00:00:00Z');
        return t >= now && t <= cutoff;
      })
      .map(r => {
        const meta = RELEASE_MAP[r.release_id];
        return {
          release_id: r.release_id,
          date: r.date,
          days_until: daysBetween(today, r.date),
          short: meta.short,
          name: meta.name,
          indicator_ids: meta.indicator_ids,
        };
      });

    // Deduplicate: a single release can appear multiple times if FRED lists it
    // per-series. Keep the earliest date per release_id.
    const byId = new Map();
    for (const it of items) {
      if (!byId.has(it.release_id) || it.date < byId.get(it.release_id).date) {
        byId.set(it.release_id, it);
      }
    }
    const releases = [...byId.values()].sort((a, b) => a.date.localeCompare(b.date));

    res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
    return res.status(200).json({
      as_of: today,
      horizon_days: horizonDays,
      releases,
    });
  } catch (err) {
    return res.status(502).json({ error: String(err.message || err) });
  }
}
