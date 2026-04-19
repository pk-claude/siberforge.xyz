/* ui.js — Plug Power pages wrapper. Delegates to /core/lib/ui.js. */
(function () {
  "use strict";
  if (!window.SiberUI) return;
  window.SiberUI.init({
    reveal:
      "main > section.panel, main > .grid, main > .ctrls, main > #chart, main > #detail",
    threshold: 0.08,
  });
})();
