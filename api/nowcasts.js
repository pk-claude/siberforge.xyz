// Vercel serverless function: Cleveland Fed inflation nowcast.
//
// The Cleveland Fed publishes a daily-updated inflation nowcast for the next
// CPI and PCE prints. They don't expose an official API; the chart on
// https://www.clevelandfed.org/indicators-and-data/inflation-nowcasting is
// powered by a JSON endpoint.
//
// STATE OF THIS FILE: The exact JSON URL isn't verified from the sandbox.
// Provide it via the CLEVELAND_NOWCAST_URL env var in Vercel. To find it:
//   1. Open the Cleveland Fed page in Chrome
//   2. DevTools → Network tab → filter "Fetch/XHR" → Reload
//   3. Copy the JSON request URL (look for a response containing CPI/PCE values)
//   4. Set CLEVELAND_NOWCAST_URL to that URL in Vercel env vars
//
// Until that env var is set, the endpoint returns a clean "unavailable" state
// and the dashboard keeps Cleveland as a placeholder card. No crash, no noise.
//
// Edge-cached 1h — the Cleveland Fed updates once per business day (~10am ET).

const DEFAULT_FALLBACK_URL = process.env.CLEVELAND_NOWCAST_URL || '';

// A defensive parser: the Cleveland JSON shape isn't fixed and has changed in
// the past. We try several plausible shapes and return a normalized payload.
// If nothing matches, we return the raw body for debugging.
function normalize(raw) {
  // Case A: { cpi: { nowcast, target_month }, pce: { ... } }
  if (raw && typeof raw === 'object' && raw.cpi && raw.pce) {
    return {
      cpi: {
        nowcast: Number(raw.cpi.nowcast ?? raw.cpi.value),
        target_month: raw.cpi.target_month ?? raw.cpi.month ?? null,
      },
      pce: {
        nowcast: Number(raw.pce.nowcast ?? raw.pce.value),
        target_month: raw.pce.target_month ?? raw.pce.month ?? null,
      },
    };
  }

  // Case B: array of {series, value, date} rows
  if (Array.isArray(raw)) {
    const rows = raw;
    const findLatest = (needle) => {
      const matches = rows.filter(r => (r.series || r.name || '').toLowerCase().includes(needle));
      if (!matches.length) return null;
      matches.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      const last = matches[matches.length - 1];
      return {
        nowcast: Number(last.value ?? last.nowcast),
        target_month: last.date || last.month || null,
      };
    };
    return {
      cpi: findLatest('cpi'),
      pce: findLatest('pce'),
    };
  }

  // Unknown shape → pass through and let the client display an error.
  return null;
}

export default async function handler(req, res) {
  const url = DEFAULT_FALLBACK_URL;

  if (!url) {
    // Endpoint not configured. Respond cleanly so the UI can skip.
    return res.status(200).json({
      available: false,
      reason: 'CLEVELAND_NOWCAST_URL env var not set',
    });
  }

  try {
    const upstream = await fetch(url, {
      headers: { 'Accept': 'application/json, text/plain, */*' },
    });

    if (!upstream.ok) {
      return res.status(502).json({
        available: false,
        reason: `upstream ${upstream.status}`,
      });
    }

    const contentType = upstream.headers.get('content-type') || '';
    let raw;
    if (contentType.includes('application/json')) {
      raw = await upstream.json();
    } else {
      // Some Fed endpoints return JSON with a text/plain content-type.
      const text = await upstream.text();
      try {
        raw = JSON.parse(text);
      } catch {
        return res.status(502).json({
          available: false,
          reason: 'upstream returned non-JSON',
        });
      }
    }

    const normalized = normalize(raw);

    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');

    if (!normalized || (!normalized.cpi && !normalized.pce)) {
      // Couldn't parse the shape. Include the raw body so the UI/logs can
      // debug — but still return 200 so client-side error handling is simple.
      return res.status(200).json({
        available: false,
        reason: 'unrecognized payload shape',
        raw_preview: typeof raw === 'object' ? Object.keys(raw).slice(0, 8) : 'non-object',
      });
    }

    return res.status(200).json({
      available: true,
      source: 'Cleveland Fed',
      cpi: normalized.cpi,
      pce: normalized.pce,
    });
  } catch (err) {
    return res.status(502).json({
      available: false,
      reason: String(err.message || err),
    });
  }
}
