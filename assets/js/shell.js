// NammaStay — paints the sidebar before the page is first drawn, so moving between pages never
// looks like the menu reloads. Loaded (without defer) right after the sidebar on every app page.
(function () {
  var sidebar = document.getElementById('ns-sidebar');
  var nav = sidebar && sidebar.querySelector('.ns-nav');
  if (!nav) return;
  var file = location.pathname.split('/').pop() || 'index.html';

  // Green highlight on the link for this page, wherever it sits (menu or footer, e.g. Settings).
  function markActive() {
    sidebar.querySelectorAll('.ns-nav-link').forEach(function (a) {
      var on = !a.classList.contains('ns-signout') && (a.getAttribute('href') || '').split(/[?#]/)[0] === file;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }
  window.nsMarkActiveNav = markActive;

  // Show the finished menu from the previous page straight away (core.js saves it once the login is
  // checked), so the sidebar doesn't jump from this page's placeholder menu to the real one.
  (function restoreChrome() {
    var area = ['admin.html', 'subscribers.html', 'revenue.html', 'leads.html', 'activity.html'].indexOf(file) >= 0 ? 'admin' : 'app';
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem(area === 'admin' ? 'ns.shell.admin' : 'ns.shell') || 'null'); } catch (e) { saved = null; }
    if (!saved || saved.area !== area || !saved.nav) return;
    var lang = 'en'; try { lang = localStorage.getItem('ns.lang') || 'en'; } catch (e) { /* ignore */ }
    if ((saved.lang || 'en') !== lang) return;   // menu was saved in another language
    var prop = ''; try { prop = localStorage.getItem('ns.property') || ''; } catch (e) { /* ignore */ }
    if (area === 'app' && saved.property !== prop) return;

    var brand = sidebar.querySelector('.ns-brand');
    var foot = sidebar.querySelector('.ns-sidebar-foot');
    nav.innerHTML = saved.nav;
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
  markActive();

  // Keep the menu's scroll position from page to page.
  try { var y = +sessionStorage.getItem('ns.navScroll') || 0; if (y) sidebar.scrollTop = y; } catch (e) { /* ignore */ }
  window.addEventListener('pagehide', function () {
    try { sessionStorage.setItem('ns.navScroll', String(sidebar.scrollTop)); } catch (e) { /* ignore */ }
  });
})();
