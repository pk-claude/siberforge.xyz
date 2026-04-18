// Release calendar strip — horizontal chip row showing upcoming FRED releases.
//
// Clicks scroll the page to the matching indicator card (the first series_id
// in the release's series_ids list) and pulse-highlight it.

function formatDay(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${days[d.getUTCDay()]} ${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

function countdownLabel(days) {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `${days}d`;
}

/**
 * Fetch + render the release strip into `container`.
 * Tolerates failure — if the endpoint errors, the strip renders empty
 * (a compact "Calendar unavailable" line) and the rest of the page is unaffected.
 *
 * @param {HTMLElement} container target element
 * @param {Object} opts
 *   opts.days   horizon in days (default 21)
 *   opts.limit  max chips to show (default 7)
 */
export async function renderReleaseStrip(container, opts = {}) {
  const { days = 21, limit = 7 } = opts;

  container.innerHTML = '<div class="rs-loading">Loading release calendar…</div>';

  try {
    const res = await fetch(`/api/releases?days=${days}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const releases = (data.releases || []).slice(0, limit);

    if (releases.length === 0) {
      container.innerHTML = `
        <div class="rs-header">Upcoming Releases</div>
        <div class="rs-empty">No scheduled releases in the next ${days} days.</div>
      `;
      return;
    }

    const chips = releases.map(r => {
      const target = r.series_ids && r.series_ids[0];
      const ci = r.days_until === 0 ? 'rs-today' : r.days_until <= 3 ? 'rs-soon' : '';
      return `
        <button class="rs-chip ${ci}" data-target="${target || ''}" title="${escapeAttr(r.name)} — ${formatDay(r.date)}">
          <span class="rs-chip-label">${r.short}</span>
          <span class="rs-chip-sep">·</span>
          <span class="rs-chip-date">${formatDay(r.date)}</span>
          <span class="rs-chip-countdown">${countdownLabel(r.days_until)}</span>
        </button>
      `;
    }).join('');

    container.innerHTML = `
      <div class="rs-header">Upcoming Releases <span class="rs-asof">as of ${data.as_of}</span></div>
      <div class="rs-chips">${chips}</div>
    `;

    // Wire click → scroll + pulse
    container.querySelectorAll('.rs-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.target;
        if (!id) return;
        const card = document.querySelector(`.card[data-id="${id}"]`);
        if (!card) return;
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add('pulse');
        setTimeout(() => card.classList.remove('pulse'), 1500);
      });
    });
  } catch (err) {
    container.innerHTML = `
      <div class="rs-header">Upcoming Releases</div>
      <div class="rs-empty">Calendar unavailable (${escapeHtml(err.message || String(err))})</div>
    `;
  }
}

function escapeAttr(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
  }[c]));
}
function escapeHtml(s) { return escapeAttr(s); }
