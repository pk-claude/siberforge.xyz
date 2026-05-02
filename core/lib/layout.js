// layout.js -- renders the shared header + two-tier nav from nav-config.js.
//
// Each page declares its identity in <body>:
//   <body data-section="macro" data-page="cycle">
//   <body data-section="equity" data-sub-section="plug" data-page="plug-cashflow">
//   <body data-section="ai" data-page="ai-compute" data-page-sub="Compute Capex">
//
// Recognized data attrs:
//   data-section          Required. Top-level tab id (matches SECTIONS[].id).
//   data-sub-section      Optional. Picks PAGES["section:sub"] entry instead of
//                         PAGES["section"]. Used for deep sub-trees (Plug, regional).
//   data-page             Optional. The active link id within section pages.
//   data-page-sub         Optional. Subtitle shown next to brand mark in header.
//   data-page-status      Optional. "live" | "ready" | "error".
//   data-page-status-text Optional. Override status text default.
//   data-page-download    Optional. "true" to include #download-data button.

(function () {
  'use strict';

  function $(sel, root) { return (root || document).querySelector(sel); }

  function escape(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function brandSvg() {
    return (
      '<svg class="sf-brand-eyes" viewBox="0 0 320 140" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<ellipse cx="100" cy="70" rx="60" ry="34" fill="var(--brand-ice)"/>' +
        '<circle cx="100" cy="70" r="22" fill="#0a0a0a"/>' +
        '<circle cx="108" cy="62" r="6" fill="#ffffff"/>' +
        '<ellipse cx="220" cy="70" rx="60" ry="34" fill="var(--brand-amber)"/>' +
        '<circle cx="220" cy="70" r="22" fill="#0a0a0a"/>' +
        '<circle cx="228" cy="62" r="6" fill="#ffffff"/>' +
      '</svg>'
    );
  }

  function buildHeader(opts) {
    const sub = opts.pageSub ? '<span class="sf-sub">' + escape(opts.pageSub) + '</span>' : '';
    const statusClass = opts.status === 'live' ? 'live' : (opts.status === 'error' ? 'error' : '');
    const statusText = opts.statusText || (opts.status === 'live' ? 'Live' : 'Ready');
    const downloadBtn = opts.download
      ? '<button id="download-data" class="download-data-btn" title="Download data used on this page">Download data</button>'
      : '';

    return (
      '<header class="sf-top top">' +
        '<div class="sf-brand brand">' +
          '<a class="sf-home-link home-link" href="/" title="Siberforge home">&#8962;</a>' +
          '<span class="sf-mark mark">' + brandSvg() +
            '<span class="sf-siber siber">SIBER</span><span class="sf-forge forge">FORGE</span>' +
          '</span>' + sub +
        '</div>' +
        '<div class="sf-status status">' +
          '<span id="refresh-indicator" class="sf-dot dot ' + statusClass + '"></span>' +
          '<span id="refresh-text">' + escape(statusText) + '</span>' +
          downloadBtn +
        '</div>' +
      '</header>'
    );
  }

  function buildNav(activeSection, pagesKey, activePage) {
    const cfg = window.SIBERFORGE_NAV;
    if (!cfg) return '';

    const tabs = cfg.SECTIONS.map(function (s) {
      const active = s.id === activeSection ? ' active' : '';
      return '<a href="' + s.href + '" class="sf-nav-tab' + active + '">' + escape(s.label) + '</a>';
    }).join('');

    const pages = cfg.PAGES[pagesKey];
    let pagesHtml = '';
    if (pages) {
      const labelHtml = pages.label
        ? '<span class="sf-nav-label">' + escape(pages.label) + '</span>'
        : '';

      const groupsHtml = pages.groups.map(function (g, idx) {
        const links = g.links.map(function (l) {
          const linkClass = ['sf-nav-link'];
          if (g.master) {
            if (l.sub) linkClass.push('sf-nav-link--sub');
            else linkClass.push('sf-nav-link--master');
          }
          if (l.id === activePage) linkClass.push('active');
          return '<a href="' + l.href + '" class="' + linkClass.join(' ') + '">' + escape(l.label) + '</a>';
        });

        if (g.master) {
          const masterLink = links[0];
          const subLinks = links.slice(1);
          const subHtml = subLinks.length
            ? '<span class="sf-nav-tree">&rsaquo;</span>' + subLinks.join('')
            : '';
          return '<div class="sf-nav-group sf-nav-group--master">' + masterLink + subHtml + '</div>';
        }

        const sectionLabel = g.label
          ? '<span class="sf-nav-section-label">' + escape(g.label) + '</span>'
          : '';
        const divider = idx > 0 && !g.label ? '<span class="sf-nav-divider"></span>' : '';
        return divider + '<div class="sf-nav-group">' + sectionLabel + links.join('') + '</div>';
      }).join('');

      pagesHtml =
        '<div class="sf-nav-pages">' +
          labelHtml + groupsHtml +
        '</div>';
    }

    return (
      '<nav class="sf-nav">' +
        '<div class="sf-nav-tabs">' + tabs +
          '<button id="theme-toggle" class="theme-toggle" title="Switch theme">&#9728;</button>' +
        '</div>' +
        pagesHtml +
      '</nav>'
    );
  }

  function wireScroll() {
    const top = $('.sf-top');
    if (!top) return;
    const onScroll = function () {
      if (window.scrollY > 4) top.classList.add('scrolled');
      else top.classList.remove('scrolled');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function render() {
    const body = document.body;
    if (!body) return;
    if (body.classList.contains('landing-page')) return;

    const section = body.dataset.section || '';
    const subSection = body.dataset.subSection || '';
    const page = body.dataset.page || '';
    const pageSub = body.dataset.pageSub || '';
    const status = body.dataset.pageStatus || '';
    const statusText = body.dataset.pageStatusText || '';
    const download = body.dataset.pageDownload === 'true';

    const pagesKey = subSection ? section + ':' + subSection : section;

    const headerHtml = buildHeader({
      pageSub: pageSub,
      status: status,
      statusText: statusText,
      download: download
    });
    const navHtml = buildNav(section, pagesKey, page);

    // Remove any legacy or pre-existing injected header/nav.
    document.querySelectorAll('body > header.top, body > header.sf-top').forEach(function (el) {
      el.remove();
    });
    document.querySelectorAll('body > nav.deep-dive-nav, body > nav.sf-nav').forEach(function (el) {
      el.remove();
    });

    // Build a temporary fragment, then insert header first, nav second
    // at the very top of body (before any existing content).
    const tmp = document.createElement('div');
    tmp.innerHTML = headerHtml + navHtml;
    const newHeader = tmp.querySelector('header.sf-top');
    const newNav = tmp.querySelector('nav.sf-nav');

    if (newNav)    body.insertBefore(newNav, body.firstChild);
    if (newHeader) body.insertBefore(newHeader, body.firstChild);

    wireScroll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();
