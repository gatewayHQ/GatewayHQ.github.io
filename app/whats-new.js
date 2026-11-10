// app/whats-new.js
// Landing-page freshness signals, driven by ONE file: data/whats-new.json.
//  - Each tool card shows "Updated <Mon YYYY>" while its last update is within
//    the last 4 months, otherwise no tag (no blanket "NEW").
//  - A "New this month" row lists the latest month's items; clicking one opens
//    that tool (and, for Graphics, that template). Adding a template = 1 line.
//  - "seasonal" items (optional from/to dates) show only inside their window.
(function () {
  'use strict';
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var FRESH_MONTHS = 4;

  function parseMonth(ym) {               // '2026-11' -> {y:2026, m:10}
    var m = /^(\d{4})-(\d{2})/.exec(String(ym || ''));
    return m ? { y: +m[1], m: +m[2] - 1 } : null;
  }
  function label(p) { return MONTHS[p.m] + ' ' + p.y; }
  function monthsAgo(p, now) { return (now.getFullYear() - p.y) * 12 + (now.getMonth() - p.m); }

  function openItem(it) {
    if (!it.tool || typeof window.navigateTo !== 'function') return;
    window.navigateTo(it.tool);
    if (it.tool === 'graphics' && it.template && typeof window.gwGraphicsPick === 'function') {
      window.gwGraphicsPick(it.template);
    }
  }

  function render(data) {
    var now = new Date();
    // 1) per-tool "Updated" tags
    var updated = data.updated || {};
    document.querySelectorAll('.tool-card[data-tool]').forEach(function (card) {
      var tag = card.querySelector('.tool-tag.updated');
      var p = parseMonth(updated[card.getAttribute('data-tool')]);
      if (!tag) return;
      if (p && monthsAgo(p, now) >= 0 && monthsAgo(p, now) < FRESH_MONTHS) {
        tag.textContent = 'Updated ' + label(p);
        tag.hidden = false;
      } else tag.hidden = true;
    });

    // 2) "New this month" row: newest month's items (if recent) + in-window seasonal items
    var items = (data.items || []).filter(function (it) { return parseMonth(it.month); });
    var newest = items.reduce(function (best, it) {
      var p = parseMonth(it.month);
      return !best || p.y * 12 + p.m > best.y * 12 + best.m ? p : best;
    }, null);
    var show = [];
    if (newest && monthsAgo(newest, now) >= 0 && monthsAgo(newest, now) < 2) {
      show = items.filter(function (it) { var p = parseMonth(it.month); return p.y === newest.y && p.m === newest.m; });
    }
    var today = now.toISOString().slice(0, 10);
    (data.seasonal || []).forEach(function (it) {
      if ((!it.from || it.from <= today) && (!it.to || today <= it.to)) show.unshift(it);
    });
    var wrap = document.getElementById('landing-new');
    var list = document.getElementById('landing-new-list');
    var title = document.getElementById('landing-new-title');
    if (!wrap || !list) return;
    if (!show.length) { wrap.hidden = true; return; }
    title.textContent = newest && monthsAgo(newest, now) === 0 ? 'New this month' : 'New in ' + label(newest);
    list.innerHTML = '';
    show.forEach(function (it) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'landing-new-chip';
      var t = document.createElement('span'); t.className = 'landing-new-chip-title'; t.textContent = it.title || '';
      b.appendChild(t);
      if (it.detail) { var d = document.createElement('span'); d.className = 'landing-new-chip-detail'; d.textContent = it.detail; b.appendChild(d); }
      b.addEventListener('click', function () { openItem(it); });
      list.appendChild(b);
    });
    wrap.hidden = false;
  }

  function load() {
    fetch('data/whats-new.json', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (d) render(d); })
      .catch(function () { /* no file / offline: cards simply show no tag */ });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load);
  else load();
})();
