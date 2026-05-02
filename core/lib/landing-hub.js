// landing-hub.js -- renders the landing-page "Every view." cat-grid from
// SIBERFORGE_NAV.LANDING_HUB. Single source of truth shared with the top
// nav so adding a page anywhere shows up here automatically.
//
// Insertion target: <div class="cat-grid" id="hub-cat-grid"></div>
// Search input id:   hub-search
// Expand/collapse ids: hub-expand, hub-collapse

(function () {
  'use strict';

  function escape(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function leafHtml(link, isSub) {
    const meta = link.meta
      ? '<span class="leaf-meta">' + escape(link.meta) + '</span>'
      : '';
    const cls = 'leaf' + (isSub ? ' sub' : '');
    return '<a href="' + escape(link.href) + '" class="' + cls + '">'
      + '<span class="leaf-name">' + escape(link.label) + '</span>'
      + meta
      + '</a>';
  }

  // Render a PAGES entry as a list of leaves + branches (group with label
  // becomes a collapsible branch; master groups become a Regime branch).
  function renderPagesEntry(pages, options) {
    if (!pages) return { html: '', count: 0 };
    options = options || {};
    const exclude = options.exclude || [];
    let html = '';
    let count = 0;

    pages.groups.forEach(function (g, idx) {
      if (exclude.indexOf(idx) !== -1) return;

      // Master group -> render as a branch named after the master link
      if (g.master) {
        const masterLink = g.links[0];
        const subLinks = g.links.slice(1);
        const branchMeta = '<span class="leaf-meta">'
          + escape(masterLink.meta || (subLinks.length + ' sub-views'))
          + '</span>';
        let branchBody = leafHtml(masterLink, true);
        subLinks.forEach(function (l) { branchBody += leafHtml(l, true); });
        html +=
          '<div class="branch">' +
            '<button class="branch-head" type="button">' +
              '<span class="branch-arrow">&#9654;</span>' +
              '<span class="leaf-name">' + escape(masterLink.label) + ' overview</span>' +
              branchMeta +
            '</button>' +
            '<div class="branch-body">' + branchBody + '</div>' +
          '</div>';
        count += 1 + subLinks.length;
        return;
      }

      // Group with label -> branch
      if (g.label) {
        let branchBody = '';
        g.links.forEach(function (l) { branchBody += leafHtml(l, true); });
        html +=
          '<div class="branch">' +
            '<button class="branch-head" type="button">' +
              '<span class="branch-arrow">&#9654;</span>' +
              '<span class="leaf-name">' + escape(g.label) + '</span>' +
              '<span class="leaf-meta">' + g.links.length + ' views</span>' +
            '</button>' +
            '<div class="branch-body">' + branchBody + '</div>' +
          '</div>';
        count += g.links.length;
        return;
      }

      // Plain group -> flat leaves
      g.links.forEach(function (l) {
        html += leafHtml(l, !!l.sub);
        count += 1;
      });
    });

    return { html: html, count: count };
  }

  function renderCard(cfg, PAGES) {
    const main = renderPagesEntry(PAGES[cfg.pages], { exclude: cfg.exclude || [] });
    let bodyHtml = main.html;
    let totalCount = main.count;

    if (cfg.include) {
      cfg.include.forEach(function (key) {
        const extra = renderPagesEntry(PAGES[key]);
        bodyHtml += extra.html;
        totalCount += extra.count;
      });
    }

    const pillHtml = cfg.pill
      ? '<span class="cat-tag">' + escape(cfg.pill) + '</span>'
      : '';
    const collapsedClass = cfg.open ? '' : ' collapsed';

    return (
      '<div class="cat' + collapsedClass + '" data-cat="' + escape(cfg.id) + '">' +
        '<div class="cat-head">' +
          '<span class="cat-arrow">&#9660;</span>' +
          '<h2>' + escape(cfg.title) + '</h2>' +
          '<span class="cat-count">' + totalCount + ' views</span>' +
          pillHtml +
        '</div>' +
        '<div class="cat-body">' + bodyHtml + '</div>' +
      '</div>'
    );
  }

  function totalDashboards(PAGES, LANDING_HUB) {
    // Count unique hrefs across all landing cards
    const seen = {};
    LANDING_HUB.forEach(function (cfg) {
      const keys = [cfg.pages].concat(cfg.include || []);
      keys.forEach(function (k) {
        const p = PAGES[k];
        if (!p) return;
        p.groups.forEach(function (g, idx) {
          if ((cfg.exclude || []).indexOf(idx) !== -1) return;
          g.links.forEach(function (l) { seen[l.href] = true; });
        });
      });
    });
    return Object.keys(seen).length;
  }

  function wireSearchAndToggle() {
    const cats = document.querySelectorAll('.cat');

    document.querySelectorAll('.cat-head').forEach(function (head) {
      head.addEventListener('click', function (e) {
        if (e.target.closest('a')) return;
        head.parentElement.classList.toggle('collapsed');
      });
    });
    document.querySelectorAll('.branch-head').forEach(function (head) {
      head.addEventListener('click', function () {
        head.parentElement.classList.toggle('expanded');
      });
    });

    const expand = document.getElementById('hub-expand');
    const collapse = document.getElementById('hub-collapse');
    if (expand)   expand.addEventListener('click',   function () { cats.forEach(function (c) { c.classList.remove('collapsed'); }); });
    if (collapse) collapse.addEventListener('click', function () { cats.forEach(function (c) { c.classList.add('collapsed'); }); });

    const search = document.getElementById('hub-search');
    if (search) {
      search.addEventListener('input', function () {
        const q = search.value.toLowerCase().trim();
        document.querySelectorAll('.leaf, .branch').forEach(function (el) {
          const txt = el.textContent.toLowerCase();
          el.style.display = (!q || txt.indexOf(q) !== -1) ? '' : 'none';
        });
        if (q) {
          cats.forEach(function (c) { c.classList.remove('collapsed'); });
          document.querySelectorAll('.branch').forEach(function (b) { b.classList.add('expanded'); });
        }
      });
    }
  }

  function render() {
    const target = document.getElementById('hub-cat-grid');
    if (!target) return;
    const cfg = window.SIBERFORGE_NAV;
    if (!cfg || !cfg.LANDING_HUB) return;

    target.innerHTML = cfg.LANDING_HUB.map(function (c) {
      return renderCard(c, cfg.PAGES);
    }).join('');

    // Update the search placeholder count
    const search = document.getElementById('hub-search');
    if (search) {
      const total = totalDashboards(cfg.PAGES, cfg.LANDING_HUB);
      search.placeholder = 'Search ' + total + '+ dashboards...';
    }

    wireSearchAndToggle();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();
