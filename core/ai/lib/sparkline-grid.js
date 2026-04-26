// /core/ai/lib/sparkline-grid.js
// Renders a grid of basket tiles with mini Chart.js sparklines.
// Fetches live 2-year weekly-close price history via /api/stocks?mode=history.
// Falls back to synthetic data if fetch fails.

// Session-level cache: { symbol -> closes array }
const priceCache = new Map();

/**
 * Fetch 2-year price history for a symbol.
 * Returns array of { date: 'YYYY-MM-DD', value: number } or empty array on failure.
 * Caches result per session to avoid re-fetching shared symbols.
 */
async function getPriceHistory(symbol) {
  if (priceCache.has(symbol)) {
    return priceCache.get(symbol);
  }

  try {
    const url = `/api/stocks?mode=history&years=2&symbols=${encodeURIComponent(symbol)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status}`);
    const json = await res.json();
    const series = json.series && json.series.length > 0 ? json.series[0] : null;
    const closes = series ? series.closes : [];
    priceCache.set(symbol, closes);
    return closes;
  } catch (err) {
    console.warn(`Failed to fetch price history for ${symbol}:`, err);
    priceCache.set(symbol, []);
    return [];
  }
}

/**
 * Compute YTD % change from price closes.
 * If closes span less than 1 year, compute from oldest available.
 */
function computeYTDPercent(closes) {
  if (!closes || closes.length < 2) return 0;
  
  const first = closes[0].value;
  const last = closes[closes.length - 1].value;
  
  if (!first || first === 0) return 0;
  return ((last / first) - 1) * 100;
}

/**
 * Downsample daily closes to weekly closes.
 * Keeps only the last trading day of each week (Friday or nearest).
 */
function downsampleToWeekly(closes) {
  if (!closes || closes.length === 0) return [];
  
  const weekly = [];
  let currentWeek = null;
  let lastInWeek = null;
  
  for (const obs of closes) {
    const d = new Date(obs.date + 'T12:00:00Z');
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay()); // Sunday of this week
    const week = weekStart.toISOString().slice(0, 10);
    
    if (week !== currentWeek) {
      if (lastInWeek) weekly.push(lastInWeek);
      currentWeek = week;
      lastInWeek = obs;
    } else {
      lastInWeek = obs; // Always keep the latest close in the week
    }
  }
  
  if (lastInWeek) weekly.push(lastInWeek);
  return weekly;
}

/**
 * Renders a sparkline-based tile grid for a basket of tickers.
 * Fetches live 2-year price history and computes live YTD %.
 * @param {Object} opts - Configuration
 * @param {Array} opts.tickers - [{sym, name, ytd, trend}, ...]
 * @param {HTMLElement} opts.targetEl - Target container
 */
export function renderSparklineGrid(opts) {
  const { tickers, targetEl } = opts;
  if (!targetEl) return;

  targetEl.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--muted); font-size: 12px;">Loading price data...</div>';

  // Fetch all symbols in parallel
  const fetchPromises = tickers.map(t => 
    getPriceHistory(t.sym).then(closes => ({
      sym: t.sym,
      closes: downsampleToWeekly(closes)
    }))
  );

  Promise.all(fetchPromises).then(allClosesData => {
    const closesMap = Object.fromEntries(allClosesData.map(d => [d.sym, d.closes]));

    targetEl.innerHTML = '';

    tickers.forEach(ticker => {
      const tile = document.createElement('a');
      tile.href = `/core/macro/ticker.html?sym=${encodeURIComponent(ticker.sym)}`;
      tile.className = 'ai-basket-tile';

      // Use live price history if available; fall back to synthetic
      const closes = closesMap[ticker.sym];
      let sparkData, ytd;
      
      if (closes && closes.length > 0) {
        sparkData = closes.map(o => o.value);
        ytd = computeYTDPercent(closes);
      } else {
        // Fallback: synthetic data
        sparkData = generateSparklineData(ticker.sym, ticker.trend);
        ytd = ticker.ytd; // Use hardcoded fallback
      }

      // YoY label styling
      const ytdClass = ytd >= 0 ? 'pos' : 'neg';

      tile.innerHTML = `
        <div class="ai-basket-tile-head">
          <span class="ai-basket-tile-sym">${ticker.sym}</span>
          <span class="ai-basket-tile-ytd ${ytdClass}">${ytd >= 0 ? '+' : ''}${ytd.toFixed(1)}%</span>
        </div>
        <div class="ai-basket-tile-spark" id="spark-${ticker.sym}"></div>
        <div class="ai-basket-tile-foot">${ticker.name || ticker.sym}</div>
      `;

      targetEl.appendChild(tile);

      // Render mini sparkline chart
      renderMiniChart(
        document.getElementById(`spark-${ticker.sym}`),
        sparkData,
        ytd
      );
    });
  }).catch(err => {
    console.error('Failed to load sparkline data:', err);
    targetEl.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--muted); font-size: 12px;">Error loading price data. Using cached values.</div>';
  });
}

/**
 * Generate deterministic synthetic sparkline data as fallback.
 * Produces 30-point series with slight trend + sin wave + noise.
 */
function generateSparklineData(symbol, trend) {
  const points = 30;
  const base = 100;
  let values = [];

  // Deterministic seed based on symbol
  let seed = symbol.charCodeAt(0) + (symbol.charCodeAt(1) || 0);
  function pseudoRandom() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  }

  for (let i = 0; i < points; i++) {
    const t = i / points;
    const trendComponent = trend === 'up' ? t * 5 : trend === 'down' ? -t * 5 : 0;
    const sinComponent = Math.sin(t * Math.PI * 2) * 2;
    const noise = (pseudoRandom() - 0.5) * 2;
    values.push(base + trendComponent + sinComponent + noise);
  }

  return values;
}

/**
 * Render a mini Chart.js sparkline into a container.
 */
function renderMiniChart(container, data, ytd) {
  if (!container || typeof Chart === 'undefined') return;

  const ctx = document.createElement('canvas');
  container.appendChild(ctx);

  const color = ytd >= 0 ? '#2ecc71' : '#e74c3c';
  const bgColor = ytd >= 0 ? 'rgba(46, 204, 113, 0.1)' : 'rgba(231, 76, 60, 0.1)';

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: Array.from({ length: data.length }, (_, i) => i),
      datasets: [{
        label: 'Price',
        data: data,
        borderColor: color,
        backgroundColor: bgColor,
        borderWidth: 1.5,
        fill: true,
        pointRadius: 0,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false }
      },
      scales: {
        x: { display: false },
        y: { display: false }
      }
    }
  });
}
