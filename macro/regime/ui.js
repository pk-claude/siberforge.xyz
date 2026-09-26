/* ui.js — Macro dashboard wrapper. Delegates to /lib/ui.js. */
(function () {
  "use strict";
  if (!window.SiberUI) return;
  window.SiberUI.init({
    reveal: ".chart-wrap, .regime-section, #regime-table, .regime-current",
    threshold: 0.06,
  });
})();
