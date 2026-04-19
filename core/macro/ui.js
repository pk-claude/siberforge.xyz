/* ui.js — Macro dashboard wrapper. Delegates to /core/lib/ui.js. */
(function () {
  "use strict";
  if (!window.SiberUI) return;
  window.SiberUI.init({
    reveal: ".chart-wrap, .heatmap-section, #heatmap",
    threshold: 0.06,
  });
})();
