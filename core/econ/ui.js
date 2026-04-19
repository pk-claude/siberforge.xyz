/* ui.js — Economic Indicators pages wrapper. Delegates to /core/lib/ui.js. */
(function () {
  "use strict";
  if (!window.SiberUI) return;
  var selector = [
    "main > .release-strip",
    "main > .category",
    "main > .gauge-section",
    "main > .signal-grid",
    "main > .timeline-section",
    "main > .methodology-section",
    ".drill-main > .drill-header",
    ".drill-main > .chart-section",
    ".drill-main > .drill-info",
    ".drill-main > .vintage-section",
    ".compare-main > .compare-picker",
    ".compare-main > .compare-chart-section",
    ".compare-main > .corr-section",
    ".compare-main > .compare-meta",
    ".recession-main > .recession-header",
    ".recession-main > .gauge-section",
    ".recession-main > .signal-grid",
    ".recession-main > .timeline-section",
    ".recession-main > .methodology-section",
  ].join(",");
  window.SiberUI.init({ reveal: selector, threshold: 0.06 });
})();
