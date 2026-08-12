// freshness.js -- one honest answer to "how old is this number?"
//
// Every staleness badge on the site should route through here. The rule that
// matters: age is measured against the WALL CLOCK, never against another
// field in the same file. Measuring a series' age against the manifest that
// shipped it means a dead pipeline reports every series as fresh, which is
// exactly the failure this module exists to prevent.
//
// Usage (classic script, no bundler):
//   const f = SF_FRESH.assess('2026-07-12T17:25:34Z', { fresh: 8, aging: 21 });
//   el.innerHTML = SF_FRESH.badge(f);
//
// Thresholds are per-cadence, in days:
//   daily    { fresh: 3,  aging: 7   }
//   weekly   { fresh: 8,  aging: 21  }
//   monthly  { fresh: 40, aging: 75  }
//   quarterly{ fresh: 110, aging: 200 }

(function () {
  'use strict';

  var CADENCE = {
    daily:     { fresh: 3,   aging: 7   },
    weekly:    { fresh: 8,   aging: 21  },
    monthly:   { fresh: 40,  aging: 75  },
    quarterly: { fresh: 110, aging: 200 }
  };

  var DAY = 86400000;

  function parse(value) {
    if (value == null) return null;
    if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
    var d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  // assess(when, thresholds) -> { ok, days, level, label, title }
  //   level: 'fresh' | 'aging' | 'stale' | 'unknown'
  function assess(when, thresholds) {
    var t = thresholds;
    if (typeof t === 'string') t = CADENCE[t];
    if (!t) t = CADENCE.weekly;

    var d = parse(when);
    if (!d) {
      return { ok: false, days: null, level: 'unknown', at: null,
               label: 'AGE UNKNOWN',
               title: 'No refresh timestamp was published with this data.' };
    }

    var days = Math.floor((Date.now() - d.getTime()) / DAY);
    if (days < 0) days = 0;

    var level = days <= t.fresh ? 'fresh' : (days <= t.aging ? 'aging' : 'stale');
    var label;
    if (level === 'fresh') label = days <= 1 ? 'LIVE' : 'FRESH';
    else if (level === 'aging') label = 'AGING ' + days + 'd';
    else label = 'STALE ' + days + 'd';

    return {
      ok: level === 'fresh',
      days: days,
      level: level,
      at: d,
      label: label,
      title: 'Data last refreshed ' + d.toISOString().slice(0, 10) + ' (' + days +
             (days === 1 ? ' day' : ' days') + ' ago). Expected cadence: every ' +
             t.fresh + ' days.'
    };
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // badge(assessment) -> HTML string for a pill.
  function badge(f) {
    if (!f) return '';
    return '<span class="sf-fresh sf-fresh--' + f.level + '" title="' + esc(f.title) + '">' +
             esc(f.label) +
           '</span>';
  }

  // note(assessment, what) -> a sentence, or '' when the data is fine.
  // Only speaks up when there is something the reader needs to know.
  function note(f, what) {
    if (!f || f.level === 'fresh') return '';
    var subject = what || 'This data';
    if (f.level === 'unknown') {
      return subject + ' carries no refresh timestamp, so its age cannot be verified.';
    }
    return subject + ' has not refreshed in ' + f.days + ' days' +
           (f.level === 'stale' ? ' and is past its expected cadence -- treat the levels as historical, not current.'
                                : '.');
  }

  window.SF_FRESH = {
    CADENCE: CADENCE,
    assess: assess,
    badge: badge,
    note: note
  };
})();
