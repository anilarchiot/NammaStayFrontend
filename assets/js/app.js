// NammaStay — small shared behaviours (no framework needed)
(function () {
  var sidebar = document.getElementById('ns-sidebar');
  var scrim = document.querySelector('.ns-scrim');
  var openBtn = document.querySelector('[data-nav-open]');

  // Language picker: works even before core.js has finished loading (e.g. a picker restored with the
  // cached menu), so a language change is never silently ignored.
  document.addEventListener('change', function (e) {
    var sel = e.target;
    if (e.nsLangHandled || !sel || !sel.classList || !sel.classList.contains('ns-lang')) return;
    var langs = ['en', 'ta', 'kn', 'te', 'ml'];
    var l = langs.indexOf(sel.value) >= 0 ? sel.value : 'en';
    try {
      localStorage.setItem('ns.lang', l);
      localStorage.removeItem('ns.shell'); localStorage.removeItem('ns.shell.admin');
    } catch (err) { /* ignore */ }
    location.reload();
  });

  // Eye button on every password box (including ones pages build later) to show / hide what's typed.
  var EYE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
  var EYE_OFF = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0112 19c-7 0-11-7-11-7a18.45 18.45 0 015.06-5.94"></path><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 7 11 7a18.5 18.5 0 01-2.16 3.19"></path><path d="M14.12 14.12a3 3 0 11-4.24-4.24"></path><path d="M1 1l22 22"></path></svg>';
  function addEyes(root) {
    if (!root.querySelectorAll) return;
    var list = root.matches && root.matches('input[type="password"]') ? [root] : root.querySelectorAll('input[type="password"]');
    Array.prototype.forEach.call(list, function (input) {
      if (input.dataset.nsEye) return;
      input.dataset.nsEye = '1';
      var wrap = document.createElement('span');
      wrap.className = 'ns-pw-wrap';
      input.parentNode.insertBefore(wrap, input);
      wrap.appendChild(input);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ns-pw-eye';
      btn.setAttribute('aria-label', 'Show password');
      btn.setAttribute('aria-pressed', 'false');
      btn.innerHTML = EYE;
      btn.addEventListener('mousedown', function (e) { e.preventDefault(); });   // keep the cursor in the box
      btn.addEventListener('click', function () {
        var show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.innerHTML = show ? EYE_OFF : EYE;
        btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
        btn.setAttribute('aria-pressed', String(show));
      });
      wrap.appendChild(btn);
    });
  }
  addEyes(document);
  new MutationObserver(function (muts) {
    muts.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, function (n) { if (n.nodeType === 1) addEyes(n); }); });
  }).observe(document.body, { childList: true, subtree: true });

  function setNav(open) {
    if (!sidebar) return;
    sidebar.classList.toggle('is-open', open);
    if (scrim) scrim.classList.toggle('is-open', open);
    if (openBtn) openBtn.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  }
  if (openBtn) openBtn.addEventListener('click', function () { setNav(true); });
  document.querySelectorAll('[data-nav-close]').forEach(function (el) {
    el.addEventListener('click', function () { setNav(false); });
  });
  document.addEventListener('click', function (e) {
    var link = e.target.closest && e.target.closest('#ns-sidebar .ns-nav-link');
    if (!link || link.classList.contains('ns-signout')) return;
    if (window.matchMedia('(max-width: 900px)').matches) setNav(false);
    var target = new URL(link.href, location.href);
    if (target.href === location.href) e.preventDefault();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      setNav(false);
      // Esc also closes the booking-detail dialog
      // (but not when Esc is closing a pop-up on top of it)
      if (document.body.classList.contains('page-booking-detail') && !document.querySelector('.ns-overlay')) location.href = 'bookings.html';
    }
  });

  // Table rows that open a detail page
  document.querySelectorAll('tr[data-href]').forEach(function (row) {
    function go() { location.href = row.getAttribute('data-href'); }
    row.addEventListener('click', go);
    row.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
  });

  // Resizable table columns: drag the edge of any column header; double-click an edge to reset the table.
  // Pages re-render their tables, so widths are remembered per page, table and column title.
  var RS_MIN = 48;
  function rsKey(table, index) {
    var all = Array.prototype.slice.call(document.querySelectorAll('table'));
    return 'ns.colw.' + location.pathname + '.' + all.indexOf(table) + '.' + index + '.' + table.rows[0].cells[index].textContent.trim().toLowerCase();
  }
  function rsSave(table, heads) {
    try { heads.forEach(function (th, i) { localStorage.setItem(rsKey(table, i), String(Math.round(th.getBoundingClientRect().width))); }); } catch (err) { /* ignore */ }
  }
  function rsFreeze(table, heads) {
    var widths = heads.map(function (th) { return th.getBoundingClientRect().width; });
    table.classList.add('ns-rs-fixed');
    table.style.tableLayout = 'fixed';
    table.style.minWidth = '0';
    heads.forEach(function (th, i) { th.style.width = widths[i] + 'px'; });
    table.style.width = widths.reduce(function (a, b) { return a + b; }, 0) + 'px';
  }
  function rsReset(table, heads) {
    table.classList.remove('ns-rs-fixed');
    table.style.tableLayout = table.style.minWidth = table.style.width = '';
    heads.forEach(function (th, i) {
      th.style.width = '';
      try { localStorage.removeItem(rsKey(table, i)); } catch (err) { /* ignore */ }
    });
  }
  function makeResizable(table) {
    if (table.dataset.nsRs || table.closest('.ns-sidebar') || !table.rows.length) return;
    var heads = Array.prototype.slice.call(table.rows[0].cells).filter(function (c) { return c.tagName === 'TH'; });
    if (heads.length < 2 || heads.length !== table.rows[0].cells.length || heads.some(function (th) { return th.colSpan > 1; })) return;
    table.dataset.nsRs = '1';
    var saved = [];
    try { saved = heads.map(function (th, i) { return Number(localStorage.getItem(rsKey(table, i))) || 0; }); } catch (err) { /* ignore */ }
    if (saved.some(Boolean) && table.offsetWidth) {
      rsFreeze(table, heads);
      var total = 0;
      heads.forEach(function (th, i) {
        if (saved[i]) th.style.width = Math.max(RS_MIN, saved[i]) + 'px';
        total += parseFloat(th.style.width);
      });
      table.style.width = total + 'px';
    }
    heads.forEach(function (th, i) {
      if (th.classList.contains('ns-sticky-end') || i === heads.length - 1 && th.textContent.trim() === '') return;
      th.classList.add('ns-rs-th');
      var grip = document.createElement('span');
      grip.className = 'ns-rs-grip';
      grip.setAttribute('aria-hidden', 'true');
      th.appendChild(grip);
      grip.addEventListener('click', function (e) { e.stopPropagation(); });
      grip.addEventListener('dblclick', function (e) { e.stopPropagation(); rsReset(table, heads); });
      grip.addEventListener('pointerdown', function (e) {
        e.preventDefault(); e.stopPropagation();
        if (!table.classList.contains('ns-rs-fixed')) rsFreeze(table, heads);
        var startX = e.clientX, startW = th.getBoundingClientRect().width, startT = parseFloat(table.style.width);
        grip.setPointerCapture(e.pointerId);
        grip.classList.add('is-active');
        document.body.classList.add('ns-rs-dragging');
        function move(ev) {
          var w = Math.max(RS_MIN, startW + ev.clientX - startX);
          th.style.width = w + 'px';
          table.style.width = (startT - startW + w) + 'px';
        }
        function up() {
          grip.removeEventListener('pointermove', move);
          grip.removeEventListener('pointerup', up);
          grip.removeEventListener('pointercancel', up);
          grip.classList.remove('is-active');
          document.body.classList.remove('ns-rs-dragging');
          rsSave(table, heads);
        }
        grip.addEventListener('pointermove', move);
        grip.addEventListener('pointerup', up);
        grip.addEventListener('pointercancel', up);
      });
    });
  }
  function scanTables(root) {
    if (!root.querySelectorAll) return;
    if (root.tagName === 'TABLE') makeResizable(root);
    Array.prototype.forEach.call(root.querySelectorAll('table'), makeResizable);
  }
  scanTables(document);
  if ('MutationObserver' in window) {
    new MutationObserver(function (muts) {
      muts.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, function (n) { if (n.nodeType === 1) scanTables(n); }); });
    }).observe(document.body, { childList: true, subtree: true });
  }

  // Prototype: forms don't submit anywhere yet
  document.querySelectorAll('form').forEach(function (f) {
    f.addEventListener('submit', function (e) { e.preventDefault(); });
  });
})();
