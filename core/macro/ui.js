/* ui.js — shared Siberforge UI enhancements for Macro dashboard.
   Handles: sticky-nav shadow, scroll reveal (for tab panels & chart wraps).
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
  var revealTargets = document.querySelectorAll(
    ".chart-wrap, .heatmap-section, #heatmap"
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
