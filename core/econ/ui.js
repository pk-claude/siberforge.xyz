/* ui.js — shared Siberforge UI enhancements for Economic Indicators pages.
   Handles: sticky-nav shadow, scroll reveal, reduced-motion gate.
   Dependency-free, idempotent. */

(function () {
  "use strict";

  var prefersReduced =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- sticky nav shadow ---------- */
  var top = document.querySelector(".top");
  if (top) {
    var onScroll = function () {
      if (window.scrollY > 8) top.classList.add("scrolled");
      else top.classList.remove("scrolled");
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---------- scroll reveal ---------- */
  // Econ dashboards have diverse layouts — target common block-level sections.
  var revealTargets = document.querySelectorAll(
    [
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
    ].join(",")
  );

  revealTargets.forEach(function (el) {
    el.classList.add("reveal");
  });

  if (prefersReduced || !("IntersectionObserver" in window)) {
    revealTargets.forEach(function (el) {
      el.classList.add("is-visible");
    });
  } else {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.06, rootMargin: "0px 0px -40px 0px" }
    );
    revealTargets.forEach(function (el) {
      io.observe(el);
    });
  }
})();
