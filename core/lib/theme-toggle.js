// Light/dark theme toggle. Reads localStorage on load, sets data-theme on
// <html>. Click the button (id="theme-toggle") to flip and persist.
//
// Default: dark (matches the original design). User pref overrides default.

(function () {
  'use strict';
  const STORAGE_KEY = 'siberforge-theme';

  function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === 'light') {
      root.setAttribute('data-theme', 'light');
    } else {
      root.removeAttribute('data-theme');
    }
    // Update the toggle button label/icon if present
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.textContent = theme === 'light' ? '🌙' : '☀';
      btn.title = theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode';
    }
  }

  // Read pref before paint to avoid FOUC.
  const stored = (() => {
    try { return localStorage.getItem(STORAGE_KEY); } catch (_) { return null; }
  })();
  applyTheme(stored === 'light' ? 'light' : 'dark');

  function wire() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    // Re-apply (sets icon now that button exists)
    const cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    applyTheme(cur);
    btn.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      applyTheme(next);
      try { localStorage.setItem(STORAGE_KEY, next); } catch (_) {}
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();
