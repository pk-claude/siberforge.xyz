/* ui.js — shared Siberforge UI enhancements.
   Handles: sticky-nav shadow, scroll-reveal, reduced-motion gate.
   Dependency-free, idempotent.

   Usage (from a per-section wrapper script):
     window.SiberUI.init({
       reveal: 'main > section.panel, main > .grid',
       threshold: 0.08
     });
*/

(function (root) {
  "use strict";

  if (root.SiberUI && root.SiberUI.__inited) return;

  var prefersReduced =
    root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function stickyNav() {
    var top = document.querySelector(".top");
    if (!top) return;
    var onScroll = function () {
      if (window.scrollY > 8) top.classList.add("scrolled");
      else top.classList.remove("scrolled");
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  function reveal(selector, threshold) {
    if (!selector) return;
    var targets = document.querySelectorAll(selector);
    if (!targets.length) return;

    targets.forEach(function (el) {
      el.classList.add("reveal");
    });

    if (prefersReduced || !("IntersectionObserver" in root)) {
      targets.forEach(function (el) {
        el.classList.add("is-visible");
      });
      return;
    }

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: threshold || 0.08, rootMargin: "0px 0px -40px 0px" }
    );
    targets.forEach(function (el) {
      io.observe(el);
    });
  }

  var SiberUI = {
    __inited: false,
    init: function (config) {
      config = config || {};
      stickyNav();
      reveal(config.reveal, config.threshold);
      SiberUI.__inited = true;
    },
    // Exposed for one-off callers.
    stickyNav: stickyNav,
    reveal: reveal,
    prefersReduced: prefersReduced,
  };

  root.SiberUI = SiberUI;
})(window);
