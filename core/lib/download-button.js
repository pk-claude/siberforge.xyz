// Universal wire-up for the "Download data" button.
//
// Default behavior: clicking navigates to /core/data/ (where the user can
// browse and download every series). Pages that want a custom export can set
// `window.__downloadPageData` to a function that handles the click — the
// generic handler will defer to it instead of navigating.

(function () {
  'use strict';
  function wire() {
    const btn = document.getElementById('download-data');
    if (!btn) return;
    btn.addEventListener('click', () => {
      if (typeof window.__downloadPageData === 'function') {
        window.__downloadPageData(btn);
        return;
      }
      window.location.href = '/core/data/';
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();
