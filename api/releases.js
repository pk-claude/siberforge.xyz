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
// To add a release: find its ID via FRED's /releases endpoint or by viewing
// a series' Release link on fred.stlouisfed.org. The `series_ids` array maps
// back to indicator cards so the UI can scroll to them on click.
const RELEASE_MAP = {
  10:  { short: 'CPI',             name: 'Consumer Price Index',                 series_ids: ['CPILFESL', 'CPIAUCSL'] },
  21:  { short: 'PCE',             name: 'Personal Income & Outlays (PCE)',      series_ids: ['PCEPILFE'] },
  50:  { short: 'Employment',      name: 'Employment Situation',                 series_ids: ['UNRATE', 'PAYEMS', 'CES0500000003'] },
  53:  { short: 'GDP',             name: 'Gross Domestic Product',               series_ids: ['GDPC1'] },
  13:  { short: 'Housing Starts',  name: 'New Residential Construction',         series_ids: ['PERMIT', 'HOUST'] },
  64:  { short: 'Retail Sales',    name: 'Advance Retail Sales',                 series_ids: ['RRSFS'] },
  97:  { short: 'New Home Sales',  name: 'New Residential Sales',                series_ids: ['HSN1F'] },
  175: { short: 'Ind. Production', name: 'Industrial Production',                series_ids: ['INDPRO'] },
  151: { short: 'Case-Shiller',    name: 'S&P/Case-Shiller Home Price Indices',  series_ids: ['CSUSHPISA'] },
  180: { short: 'Jobless Claims',  name: 'Unemployment Insurance Weekly Claims', series_ids: ['IC4WSA'] },
  83:  { short: 'Empire State',    name: 'Empire State Manufacturing Survey',    series_ids: ['GACDISA066MSFRBNY'] },
  // Existing Home Sales (NAR) — FRED release id appears as 101 historically
  101: { short: 'Existing Sales',  name: 'Existing Home Sales',                  series_ids: ['EXHOSLUSM495S'] },
  // Freddie Mac PMMS (mortgage rates)
  114: { short: 'Mortgage Rates',  name: 'Primary Mortgage Market Survey',       series_ids: ['MORTGAGE30US'] },
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
          series_ids: meta.series_ids,
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
