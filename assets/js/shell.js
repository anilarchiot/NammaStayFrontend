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
    var paintAdminDefault = function () {
      if (area !== 'admin') return;
      var items = [['admin.html', 'Overview', '<path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"></path><path d="M9 12l2 2 4-4"></path>'],
        ['subscribers.html', 'Subscribers', '<rect x="2" y="5" width="20" height="14" rx="2"></rect><path d="M2 10h20"></path>'],
        ['revenue.html', 'Revenue & coupons', '<path d="M3 3v18h18"></path><path d="M7 15l4-4 3 3 6-6"></path>'],
        ['leads.html', 'Leads', '<path d="M22 12h-6l-2 3h-4l-2-3H2"></path><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"></path>'],
        ['activity.html', 'Activity log', '<path d="M12 8v4l3 2"></path><circle cx="12" cy="12" r="9"></circle>'],
        ];
      nav.innerHTML = items.map(function (i) {
        return '<a href="' + i[0] + '" class="ns-nav-link"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + i[2] + '</svg><span>' + i[1] + '</span></a>';
      }).join('');
      var settings = sidebar.querySelector('.ns-sidebar-foot a[href="settings.html"]'); if (settings) settings.remove();
      var brand = sidebar.querySelector('.ns-brand');
      if (brand) { brand.setAttribute('href', 'admin.html'); if (!brand.querySelector('.ns-admin-tag')) brand.insertAdjacentHTML('beforeend', '<span class="ns-admin-tag">Admin</span>'); }
      var sub = sidebar.querySelector('.ns-user-sub'); if (sub) sub.textContent = 'NammaStay admin';
      document.body.classList.add('ns-admin-area');
      document.documentElement.classList.add('ns-chrome-ready');
    };
    try { saved = JSON.parse(localStorage.getItem(area === 'admin' ? 'ns.shell.admin' : 'ns.shell') || 'null'); } catch (e) { saved = null; }
    if (!saved || saved.area !== area || !saved.nav) { paintAdminDefault(); return; }
    var lang = 'en'; try { lang = localStorage.getItem('ns.lang') || 'en'; } catch (e) { /* ignore */ }
    if ((saved.lang || 'en') !== lang) { paintAdminDefault(); return; }   // menu was saved in another language
    var prop = ''; try { prop = localStorage.getItem('ns.property') || ''; } catch (e) { /* ignore */ }
    if (area === 'app' && saved.property !== prop) return;

    var brand = sidebar.querySelector('.ns-brand');
    var foot = sidebar.querySelector('.ns-sidebar-foot');
    nav.innerHTML = saved.nav;
    nav.querySelectorAll('a[href="ota.html"], a[href="connections.html"]').forEach(function (a) { a.remove(); });
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
