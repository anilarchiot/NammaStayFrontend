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

  // Prototype: forms don't submit anywhere yet
  document.querySelectorAll('form').forEach(function (f) {
    f.addEventListener('submit', function (e) { e.preventDefault(); });
  });
})();
