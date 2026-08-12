// layout.js -- renders the shared header + two-tier nav + breadcrumbs + global
// search from nav-config.js.
//
// Each page declares its identity in <body>:
//   <body data-section="macro" data-page="cycle">
//   <body data-section="equity" data-sub-section="plug" data-page="plug-cashflow">
//   <body data-section="ai" data-page="ai-compute" data-page-sub="Compute Capex">
//
// Recognized data attrs:
//   data-section          Required. Top-level tab id (matches SECTIONS[].id).
//   data-sub-section      Optional. Picks PAGES["section:sub"] entry instead of
//                         PAGES["section"]. Used for deep sub-trees (Plug).
//   data-page             Optional. The active link id within section pages.
//                         MUST match a link id in PAGES or nothing highlights.
//   data-page-parent      Optional. For drill-down pages that are not nav
//                         entries themselves (indicator.html, metric.html):
//                         the link id to highlight and crumb back to.
//   data-page-sub         Optional. Subtitle shown next to brand mark in header
//                         and used as the final breadcrumb on drill-downs.
//   data-page-status      Optional. "live" | "ready" | "error".
//   data-page-status-text Optional. Override status text default.
//   data-page-download    Optional. "true" to include #download-data button.
//   data-page-hub         Optional. "true" to append an auto-generated list of
//                         every view in this section at the end of <main>.

(function () {
  'use strict';

  function $(sel, root) { return (root || document).querySelector(sel); }

  function escape(s) {
    return String(s == null ? '' : s)
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

  // --------------------------------------------------------------------
  // Header
  // --------------------------------------------------------------------
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
          '<button id="sf-search-open" class="sf-search-btn" title="Search all dashboards (press /)" aria-label="Search all dashboards">' +
            '<span class="sf-search-icon">&#9906;</span><span class="sf-search-text">Search</span><kbd>/</kbd>' +
          '</button>' +
          '<span id="refresh-indicator" class="sf-dot dot ' + statusClass + '"></span>' +
          '<span id="refresh-text">' + escape(statusText) + '</span>' +
          downloadBtn +
        '</div>' +
      '</header>'
    );
  }

  // --------------------------------------------------------------------
  // Tab dropdown menu -- lets you see any section's contents without
  // leaving the page you are on.
  // --------------------------------------------------------------------
  function buildTabMenu(sectionId) {
    const cfg = window.SIBERFORGE_NAV;
    const entry = cfg.PAGES[sectionId];
    if (!entry) return '';

    const groups = entry.groups.map(function (g) {
      const heading = g.label
        ? '<div class="sf-menu-heading">' + escape(g.label) + '</div>'
        : '';
      const links = g.links.map(function (l) {
        return '<a class="sf-menu-link" href="' + escape(l.href) + '">' +
          '<span class="sf-menu-name">' + escape(l.label) + '</span>' +
          (l.meta ? '<span class="sf-menu-meta">' + escape(l.meta) + '</span>' : '') +
        '</a>';
      }).join('');
      return '<div class="sf-menu-group">' + heading + links + '</div>';
    }).join('');

    return '<div class="sf-tab-menu" role="menu">' + groups + '</div>';
  }

  // --------------------------------------------------------------------
  // Two-tier nav
  // --------------------------------------------------------------------
  function buildNav(activeSection, pagesKey, activePage) {
    const cfg = window.SIBERFORGE_NAV;
    if (!cfg) return '';

    const tabs = cfg.SECTIONS.map(function (s) {
      const active = s.id === activeSection ? ' active' : '';
      return '<span class="sf-tab-wrap">' +
        '<a href="' + s.href + '" class="sf-nav-tab' + active + '">' + escape(s.label) + '</a>' +
        buildTabMenu(s.id) +
      '</span>';
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
        '<div class="sf-nav-pages" id="sf-nav-pages">' +
          labelHtml + groupsHtml +
        '</div>';
    }

    // Below 800px the second tier is collapsed behind this button instead of
    // wrapping into a permanent multi-row band that eats the fold.
    const moreBtn = pagesHtml
      ? '<button type="button" id="sf-nav-more" class="sf-nav-more" aria-expanded="false" aria-controls="sf-nav-pages">' +
          '<span class="sf-nav-more-caret">&rsaquo;</span> ' +
          escape(pages && pages.label ? pages.label : 'Section pages') +
        '</button>'
      : '';

    return (
      '<nav class="sf-nav">' +
        '<div class="sf-nav-tabs">' + tabs +
          '<button id="theme-toggle" class="theme-toggle" title="Switch theme">&#9728;</button>' +
        '</div>' +
        moreBtn +
        pagesHtml +
      '</nav>'
    );
  }

  // --------------------------------------------------------------------
  // Breadcrumbs -- Home > Section > [sub-tree] > Page
  // --------------------------------------------------------------------
  function findLink(pagesKey, pageId) {
    const cfg = window.SIBERFORGE_NAV;
    const entry = cfg.PAGES[pagesKey];
    if (!entry || !pageId) return null;
    for (let i = 0; i < entry.groups.length; i++) {
      const links = entry.groups[i].links;
      for (let j = 0; j < links.length; j++) {
        if (links[j].id === pageId) return links[j];
      }
    }
    return null;
  }

  function buildCrumbs(opts) {
    const cfg = window.SIBERFORGE_NAV;
    if (!cfg) return '';

    const section = cfg.SECTIONS.filter(function (s) { return s.id === opts.section; })[0];
    if (!section) return '';

    const crumbs = [{ label: 'Home', href: '/' }, { label: section.label, href: section.href }];

    // Sub-tree crumb (e.g. Markets > Plug Power - PLUG)
    let subLandingHref = null;
    if (opts.subSection) {
      const sub = cfg.PAGES[opts.section + ':' + opts.subSection];
      if (sub && sub.label) {
        const subFirst = sub.groups[0] && sub.groups[0].links[0];
        subLandingHref = subFirst ? subFirst.href : null;
        crumbs.push({ label: sub.label, href: subLandingHref });
      }
    }

    // The page itself, or its parent + a leaf crumb for drill-downs.
    // A link that IS the section landing is skipped: "Macro > Regime" when
    // Regime is /core/macro/ just repeats the crumb before it.
    // The same applies one level down: on /core/plug/ the sub-tree crumb and
    // the page crumb both resolve to /core/plug/, which produced
    // "Markets > Plug Power - PLUG > Section overview" with the last two
    // pointing at the identical URL.
    const isSectionLanding = function (link) {
      if (!link) return false;
      return link.href === section.href || link.href === subLandingHref;
    };
    const parent = opts.pageParent ? findLink(opts.pagesKey, opts.pageParent) : null;
    if (parent) {
      if (!isSectionLanding(parent)) crumbs.push({ label: parent.label, href: parent.href });
      if (opts.pageSub) crumbs.push({ label: opts.pageSub, href: null });
    } else {
      const link = findLink(opts.pagesKey, opts.page);
      if (link && !isSectionLanding(link)) crumbs.push({ label: link.label, href: null });
      else if (!link && opts.pageSub) crumbs.push({ label: opts.pageSub, href: null });
    }

    // A single "Home > Section" trail on a section landing adds nothing.
    if (crumbs.length < 3) return '';

    const html = crumbs.map(function (c, i) {
      const last = i === crumbs.length - 1;
      const sep = i > 0 ? '<span class="sf-crumb-sep">&rsaquo;</span>' : '';
      const body = (c.href && !last)
        ? '<a class="sf-crumb" href="' + escape(c.href) + '">' + escape(c.label) + '</a>'
        : '<span class="sf-crumb sf-crumb--current"' + (last ? ' aria-current="page"' : '') + '>' + escape(c.label) + '</span>';
      return sep + body;
    }).join('');

    return '<nav class="sf-crumbs" aria-label="Breadcrumb">' + html + '</nav>';
  }

  // --------------------------------------------------------------------
  // Global search overlay -- every view on the site, from any page.
  // --------------------------------------------------------------------
  function buildSearch() {
    return (
      '<div class="sf-search-overlay" id="sf-search-overlay" hidden>' +
        '<div class="sf-search-panel" role="dialog" aria-modal="true" aria-label="Search dashboards">' +
          '<input class="sf-search-input" id="sf-search-input" type="text" autocomplete="off" ' +
            'placeholder="Search every view..." aria-label="Search every view" />' +
          '<div class="sf-search-results" id="sf-search-results"></div>' +
          '<div class="sf-search-foot">' +
            '<span><kbd>&uarr;</kbd><kbd>&darr;</kbd> move</span>' +
            '<span><kbd>Enter</kbd> open</span>' +
            '<span><kbd>Esc</kbd> close</span>' +
            '<a href="/core/">Full A-Z index</a>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function wireSearch() {
    const cfg = window.SIBERFORGE_NAV;
    const overlay = document.getElementById('sf-search-overlay');
    const input = document.getElementById('sf-search-input');
    const results = document.getElementById('sf-search-results');
    const openBtn = document.getElementById('sf-search-open');
    if (!cfg || !overlay || !input || !results) return;

    const items = cfg.index();
    let active = 0;

    // Search had to be told the answer in its own words: "Labor", not
    // "unemployment". keywords[] carries the metric names a reader actually
    // types. Matching a keyword ranks above matching prose in meta.
    function score(item, q) {
      const label = item.label.toLowerCase();
      const keywords = (item.keywords || []).join(' ').toLowerCase();
      const meta = (item.meta + ' ' + item.section + ' ' + item.group).toLowerCase();
      if (label === q) return 0;
      if (label.indexOf(q) === 0) return 1;
      if (label.indexOf(q) !== -1) return 2;
      if (keywords.indexOf(q) !== -1) return 3;
      if (meta.indexOf(q) !== -1) return 4;
      return -1;
    }

    function render(q) {
      let list;
      if (!q) {
        list = items.slice(0, 12);
      } else {
        list = items
          .map(function (it) { return { it: it, s: score(it, q) }; })
          .filter(function (r) { return r.s >= 0; })
          .sort(function (a, b) { return a.s - b.s; })
          .slice(0, 40)
          .map(function (r) { return r.it; });
      }
      active = 0;
      if (!list.length) {
        results.innerHTML = '<div class="sf-search-empty">No view matches "' + escape(q) + '".</div>';
        return;
      }
      results.innerHTML = list.map(function (it, i) {
        return '<a class="sf-search-hit' + (i === 0 ? ' active' : '') + '" href="' + escape(it.href) + '">' +
          '<span class="sf-hit-section">' + escape(it.section) + '</span>' +
          '<span class="sf-hit-label">' + escape(it.label) + '</span>' +
          '<span class="sf-hit-meta">' + escape(it.meta) + '</span>' +
        '</a>';
      }).join('');
    }

    function move(delta) {
      const hits = results.querySelectorAll('.sf-search-hit');
      if (!hits.length) return;
      hits[active].classList.remove('active');
      active = (active + delta + hits.length) % hits.length;
      hits[active].classList.add('active');
      hits[active].scrollIntoView({ block: 'nearest' });
    }

    let lastFocus = null;

    function open() {
      lastFocus = document.activeElement;
      overlay.hidden = false;
      document.body.classList.add('sf-search-open');
      input.value = '';
      render('');
      input.focus();
    }
    function close() {
      overlay.hidden = true;
      document.body.classList.remove('sf-search-open');
      // Put the keyboard user back where they were, not at the top of the
      // document.
      if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
      lastFocus = null;
    }

    // Keep Tab inside the dialog while it is open -- it is aria-modal, so
    // letting focus walk into the page behind it is a lie to the AT.
    function trapTab(e) {
      const panel = overlay.querySelector('.sf-search-panel');
      if (!panel) return;
      const focusables = panel.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables.length) { e.preventDefault(); return; }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    if (openBtn) openBtn.addEventListener('click', open);
    input.addEventListener('input', function () { render(input.value.toLowerCase().trim()); });

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });

    document.addEventListener('keydown', function (e) {
      const tag = (e.target.tagName || '').toLowerCase();
      const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
      if (overlay.hidden) {
        if (e.key === '/' && !typing) { e.preventDefault(); open(); }
        if (e.key === 'k' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); open(); }
        return;
      }
      if (e.key === 'Tab') { trapTab(e); return; }
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); return; }
      if (e.key === 'Enter') {
        const hit = results.querySelector('.sf-search-hit.active');
        if (hit) { e.preventDefault(); window.location.href = hit.getAttribute('href'); }
      }
    });
  }

  // --------------------------------------------------------------------
  // Hub child list -- section landings enumerate their own children so the
  // path down does not depend on the nav row alone.
  // --------------------------------------------------------------------
  function renderHubChildren(pagesKey, activePage) {
    const cfg = window.SIBERFORGE_NAV;
    const entry = cfg && cfg.PAGES[pagesKey];
    if (!entry) return;
    const host = document.querySelector('main') || document.body;

    const groups = entry.groups.map(function (g) {
      const heading = g.label
        ? '<h3 class="sf-hub-heading">' + escape(g.label) + '</h3>'
        : '';
      const cards = g.links.filter(function (l) {
        return l.id !== activePage;
      }).map(function (l) {
        return '<a class="sf-hub-card" href="' + escape(l.href) + '">' +
          '<span class="sf-hub-name">' + escape(l.label) + ' &rarr;</span>' +
          (l.meta ? '<span class="sf-hub-meta">' + escape(l.meta) + '</span>' : '') +
        '</a>';
      }).join('');
      if (!cards) return '';
      return '<div class="sf-hub-group">' + heading + '<div class="sf-hub-grid">' + cards + '</div></div>';
    }).join('');

    if (!groups) return;

    const wrap = document.createElement('section');
    wrap.className = 'sf-hub-children';
    wrap.innerHTML = '<h2 class="sf-hub-title">Everything in ' + escape(entry.label) + '</h2>' + groups;
    host.appendChild(wrap);
  }

  // --------------------------------------------------------------------
  // "See also" -- curated cross-section links. The nav can only ever move a
  // reader within the section they are already in; these are the jumps the
  // nav structurally cannot make (Inflation -> regional CPI dispersion).
  // --------------------------------------------------------------------
  function renderSeeAlso(pagesKey, activePage) {
    const cfg = window.SIBERFORGE_NAV;
    if (!cfg || !activePage) return;
    const related = (cfg.RELATED && cfg.RELATED[activePage]) || [];
    if (!related.length) return;

    const index = cfg.index();
    const byId = Object.create(null);
    index.forEach(function (it) { byId[it.id] = it; });

    const cards = related.map(function (id) {
      const it = byId[id];
      if (!it) return '';
      return '<a class="sf-seealso-card" href="' + escape(it.href) + '">' +
        '<span class="sf-seealso-where">' + escape(it.section) + '</span>' +
        '<span class="sf-seealso-name">' + escape(it.label) + ' &rarr;</span>' +
        (it.meta ? '<span class="sf-seealso-meta">' + escape(it.meta) + '</span>' : '') +
      '</a>';
    }).join('');
    if (!cards) return;

    const host = document.querySelector('main') || document.body;
    const wrap = document.createElement('section');
    wrap.className = 'sf-seealso';
    wrap.innerHTML = '<h2 class="sf-seealso-title">See also</h2>' +
                     '<div class="sf-seealso-grid">' + cards + '</div>';
    host.appendChild(wrap);
  }

  // --------------------------------------------------------------------
  // Accessibility scaffolding applied at runtime so it lands on all ~55
  // pages without editing 55 files (and cannot drift back out of sync).
  //   - a main landmark, resolved from <main> or the first content block
  //   - a skip link as the first tab stop
  //   - an accessible name on every chart canvas, taken from its heading
  //   - scope="col" on header cells that never got one
  // --------------------------------------------------------------------
  function resolveMain() {
    let main = document.querySelector('main');
    if (!main) {
      // First element after the injected chrome that is a plausible content
      // container. Deliberately conservative: only <section>/<div>.
      const kids = Array.prototype.slice.call(document.body.children);
      for (let i = 0; i < kids.length; i++) {
        const el = kids[i];
        const tag = el.tagName.toLowerCase();
        if (tag !== 'section' && tag !== 'div') continue;
        if (el.classList.contains('sf-search-overlay')) continue;
        if (el.closest('header, nav')) continue;
        main = el;
        break;
      }
    }
    if (!main) return null;
    if (main.tagName.toLowerCase() !== 'main') main.setAttribute('role', 'main');
    if (!main.id) main.id = 'sf-main';
    if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
    return main;
  }

  function addSkipLink(mainId) {
    if (document.querySelector('.sf-skip')) return;
    const a = document.createElement('a');
    a.className = 'sf-skip';
    a.href = '#' + mainId;
    a.textContent = 'Skip to content';
    document.body.insertBefore(a, document.body.firstChild);
  }

  function labelCharts() {
    const canvases = document.querySelectorAll('canvas:not([aria-label]):not([role="presentation"])');
    Array.prototype.forEach.call(canvases, function (c) {
      // Nearest preceding heading, walking up through wrappers.
      let name = '';
      let node = c;
      while (node && node !== document.body && !name) {
        let sib = node.previousElementSibling;
        while (sib && !name) {
          if (/^h[1-6]$/i.test(sib.tagName)) name = sib.textContent.trim();
          else {
            const h = sib.querySelector && sib.querySelector('h1,h2,h3,h4,h5,h6');
            if (h && sib.contains(c) === false) name = h.textContent.trim();
          }
          sib = sib.previousElementSibling;
        }
        node = node.parentElement;
      }
      if (!name) name = c.id ? c.id.replace(/[-_]+/g, ' ') : 'Chart';
      c.setAttribute('role', 'img');
      c.setAttribute('aria-label', name.replace(/\s+/g, ' ').slice(0, 140) + ' (chart)');
    });
  }

  function scopeTableHeaders() {
    const ths = document.querySelectorAll('th:not([scope])');
    Array.prototype.forEach.call(ths, function (th) {
      const inHead = !!th.closest('thead');
      th.setAttribute('scope', inHead ? 'col' : (th.parentElement && th.parentElement.firstElementChild === th ? 'row' : 'col'));
    });
  }

  function applyA11y() {
    const main = resolveMain();
    if (main) addSkipLink(main.id);
    labelCharts();
    scopeTableHeaders();
    // Charts and tables are usually painted after fetch; re-run once the
    // page has had a chance to render them.
    window.setTimeout(function () { labelCharts(); scopeTableHeaders(); }, 2500);
  }

  // --------------------------------------------------------------------
  function wireNavToggle() {
    const btn = document.getElementById('sf-nav-more');
    const nav = document.querySelector('nav.sf-nav');
    if (!btn || !nav) return;
    btn.addEventListener('click', function () {
      const open = nav.getAttribute('data-pages-open') === 'true';
      nav.setAttribute('data-pages-open', open ? 'false' : 'true');
      btn.setAttribute('aria-expanded', open ? 'false' : 'true');
      const caret = btn.querySelector('.sf-nav-more-caret');
      if (caret) caret.innerHTML = open ? '&rsaquo;' : '&#8964;';
    });
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
    // The landing page renders its own editorial chrome (see landing-hub.js)
    // and carries its own full-tree search, so it opts out entirely.
    if (body.classList.contains('landing-page')) return;

    const section = body.dataset.section || '';
    const subSection = body.dataset.subSection || '';
    const page = body.dataset.page || '';
    const pageParent = body.dataset.pageParent || '';
    const pageSub = body.dataset.pageSub || '';
    const status = body.dataset.pageStatus || '';
    const statusText = body.dataset.pageStatusText || '';
    const download = body.dataset.pageDownload === 'true';
    const isHub = body.dataset.pageHub === 'true';

    const pagesKey = subSection ? section + ':' + subSection : section;
    const activePage = page || pageParent;

    const headerHtml = buildHeader({
      pageSub: pageSub,
      status: status,
      statusText: statusText,
      download: download
    });
    const navHtml = buildNav(section, pagesKey, activePage);
    const crumbHtml = buildCrumbs({
      section: section,
      subSection: subSection,
      pagesKey: pagesKey,
      page: page,
      pageParent: pageParent,
      pageSub: pageSub
    });

    // Remove any legacy or pre-existing injected header/nav.
    document.querySelectorAll('body > header.top, body > header.sf-top').forEach(function (el) {
      el.remove();
    });
    document.querySelectorAll('body > nav.deep-dive-nav, body > nav.sf-nav, body > nav.sf-crumbs').forEach(function (el) {
      el.remove();
    });

    // Build a temporary fragment, then insert header, nav, crumbs in order
    // at the very top of body (before any existing content).
    const tmp = document.createElement('div');
    tmp.innerHTML = headerHtml + navHtml + crumbHtml + buildSearch();
    const newHeader = tmp.querySelector('header.sf-top');
    const newNav = tmp.querySelector('nav.sf-nav');
    const newCrumbs = tmp.querySelector('nav.sf-crumbs');
    const newSearch = tmp.querySelector('.sf-search-overlay');

    if (newCrumbs) body.insertBefore(newCrumbs, body.firstChild);
    if (newNav)    body.insertBefore(newNav, body.firstChild);
    if (newHeader) body.insertBefore(newHeader, body.firstChild);
    if (newSearch) body.appendChild(newSearch);

    if (isHub) renderHubChildren(pagesKey, activePage);
    renderSeeAlso(pagesKey, activePage);

    wireScroll();
    wireSearch();
    wireNavToggle();
    applyA11y();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();
