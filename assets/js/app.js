// NammaStay — small shared behaviours (no framework needed)
(function () {
  var sidebar = document.getElementById('ns-sidebar');
  var scrim = document.querySelector('.ns-scrim');
  var openBtn = document.querySelector('[data-nav-open]');

  // Show the finished menu from the previous page straight away (core.js saves it once the login is
  // checked), so the sidebar doesn't jump from this page's placeholder menu to the real one.
  (function restoreChrome() {
    var nav = sidebar && sidebar.querySelector('.ns-nav');
    if (!nav) return;
    var file = location.pathname.split('/').pop() || 'index.html';
    var area = ['admin.html', 'subscribers.html', 'revenue.html', 'leads.html', 'activity.html'].indexOf(file) >= 0 ? 'admin' : 'app';
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem(area === 'admin' ? 'ns.shell.admin' : 'ns.shell') || 'null'); } catch (e) { saved = null; }
    if (!saved || saved.area !== area || !saved.nav) return;
    var prop = ''; try { prop = localStorage.getItem('ns.property') || ''; } catch (e) { /* ignore */ }
    if (area === 'app' && saved.property !== prop) return;

    var brand = sidebar.querySelector('.ns-brand');
    var foot = sidebar.querySelector('.ns-sidebar-foot');
    var active = nav.querySelector('.ns-nav-link.is-active');
    var activeHref = active ? active.getAttribute('href') : file;

    nav.innerHTML = saved.nav;
    nav.querySelectorAll('.ns-nav-link').forEach(function (a) {
      if (a.getAttribute('href') === activeHref) { a.classList.add('is-active'); a.setAttribute('aria-current', 'page'); }
    });
    if (foot && saved.foot) {
      var holder = document.createElement('div');
      holder.innerHTML = saved.foot;
      var restoredFoot = holder.firstElementChild;
      if (restoredFoot) foot.replaceWith(restoredFoot);
    }
    if (area === 'admin') {
      document.body.classList.add('ns-admin-area');
      if (brand && saved.brand) brand.replaceWith(new DOMParser().parseFromString(saved.brand, 'text/html').body.firstElementChild);
    }
    document.documentElement.classList.add('ns-chrome-ready');
  })();

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
