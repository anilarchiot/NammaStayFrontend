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
