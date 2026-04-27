// Light/dark theme toggle. Reads localStorage on load, sets data-theme on
// <html>. Click any element with class="theme-toggle" to flip and persist.
//
// Why all .theme-toggle (not just id="theme-toggle"): some pages render
// the toggle in two places (header .status row + section-tabs nav) so a
// single id can only attach to one. Querying by class fixes both at once.
//
// Default: dark (matches the original design). User pref overrides default.

(function () {
  'use strict';
  const STORAGE_KEY = 'siberforge-theme';

  function syncButtons(theme) {
    const buttons = document.querySelectorAll('.theme-toggle');
    buttons.forEach((btn) => {
      btn.textContent = theme === 'light' ? '🌙' : '☀';
      btn.title = theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode';
    });
  }

  function applyTheme(theme) {
    const root = document.documentElement;
    // Always set the attribute explicitly so JS that reads
    // getAttribute('data-theme') never returns null in dark mode.
    root.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
    syncButtons(theme);
  }

  // Read pref before paint to avoid FOUC.
  const stored = (() => {
    try { return localStorage.getItem(STORAGE_KEY); } catch (_) { return null; }
  })();
  applyTheme(stored === 'light' ? 'light' : 'dark');

  function wire() {
    const buttons = document.querySelectorAll('.theme-toggle');
    if (!buttons.length) return;
    const cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    syncButtons(cur);
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        applyTheme(next);
        try { localStorage.setItem(STORAGE_KEY, next); } catch (_) {}
      });
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();
