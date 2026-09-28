// NammaStay — shared front-end core (ES module, no build step).
// Every page script imports from here.
const CFG = window.NAMMASTAY_CONFIG || {};
/** DEMO only when opened on purpose (login.html?demo=1); LIVE = real Supabase; NOT_CONNECTED = keys missing. */
const DEMO_ON = (() => {
  try {
    const q = new URLSearchParams(location.search).get('demo');
    if (q === '1') localStorage.setItem('ns.demo.on', '1');
    if (q === '0') { localStorage.removeItem('ns.demo.on'); localStorage.removeItem('ns.demo.session'); }
    return localStorage.getItem('ns.demo.on') === '1';
  } catch { return false; }
})();
export const DEMO = DEMO_ON;
export const LIVE = !DEMO && !!(CFG.supabaseUrl && CFG.supabaseAnonKey);
export const NOT_CONNECTED = !DEMO && !LIVE;                      // keys missing: nothing works, nobody gets in
export const sb = LIVE
  ? (await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm')).createClient(CFG.supabaseUrl, CFG.supabaseAnonKey)
  : DEMO ? (await import('./demo-backend.js')).createDemoClient() : null;
const HERE = location.href.replace(/[?#].*$/, '').replace(/[^/]*$/, '').replace(/\/$/, '');
export const SITE_URL = LIVE ? (CFG.siteUrl || location.origin).replace(/\/$/, '') : HERE;
export const TZ = 'Asia/Kolkata';
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ---------------------------------------------------------------- text & numbers
export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
export function rupees(paise) {
  const n = Number(paise || 0) / 100;
  return (n < 0 ? '−₹' : '₹') + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: Number.isInteger(n) ? 0 : 2 });
}
export function toPaise(v) {
  const n = parseFloat(String(v ?? '').replace(/[₹,\s]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}
export function initials(name) {
  const p = String(name || '?').replace(/[^\p{L}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}
export const titleCase = (s) => String(s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// ---------------------------------------------------------------- dates (always India time)
const fmt = (o) => new Intl.DateTimeFormat('en-IN', { timeZone: TZ, ...o });
const fDay = fmt({ day: 'numeric', month: 'short' });
const fDate = fmt({ day: 'numeric', month: 'short', year: 'numeric' });
const fTime = fmt({ hour: 'numeric', minute: '2-digit', hour12: true });
const fWeek = fmt({ weekday: 'short' });
const fLong = fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const sep = (x) => x.replace('Sept', 'Sep');
export const fmtDay = (d) => sep(fDay.format(new Date(d)));
export const fmtDate = (d) => sep(fDate.format(new Date(d)));
export const fmtTime = (d) => fTime.format(new Date(d)).replace(/\s?(am|pm)$/i, (m) => ' ' + m.trim().toUpperCase());
export const fmtDayTime = (d) => `${fmtDay(d)}, ${fmtTime(d)}`;
export const fmtLong = (d) => fLong.format(new Date(d));  // full month names
export const fmtWeekday = (ymd) => `${fWeek.format(new Date(ymd + 'T12:00:00+05:30'))} ${Number(ymd.slice(8, 10))}`;

/** 'YYYY-MM-DD' for a moment, in India time */
export function ymd(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(d));
}
export function addDays(ymdStr, n) {
  const d = new Date(ymdStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000);
/** value for <input type="datetime-local"> in India time */
export function toInputDT(d) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(d)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
/** '2026-09-22T14:00' (India time) → ISO string with offset */
export const fromInputDT = (v) => (v ? `${v}:00+05:30` : null);

// ---------------------------------------------------------------- API
function friendly(error) {
  const m = error?.message || String(error || '');
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'No connection. Check your internet and try again.';
  if (/JWT|session|refresh token/i.test(m)) return 'Your session expired. Please sign in again.';
  if (/subscription has ended|account is suspended/i.test(m)) return m;
  return m || 'Something went wrong. Please try again.';
}
export async function rpc(fn, args = {}) {
  const { data, error } = await sb.rpc(fn, args);
  if (error) throw new Error(friendly(error));
  return data;
}
export async function q(promise, { withCount = false } = {}) {
  const { data, error, count } = await promise;
  if (error) throw new Error(friendly(error));
  return withCount ? { data, count } : data;
}

// ---------------------------------------------------------------- page lifecycle
const PAGE_ROLES = {
  dashboard: null, bookings: null, calendar: null, rooms: null, payments: null,
  guests: ['owner', 'manager', 'front_desk'],
  checkin: ['owner', 'manager', 'front_desk'],
  reports: ['owner', 'manager', 'accountant'],
  settings: ['owner', 'manager'],
};
const NAV_KEY = {
  'guest-profile.html': 'guests', 'check-in.html': 'checkin', 'reports.html': 'reports', 'settings.html': 'settings',
};
// Words follow the property type: hostels/PGs sell beds, hotels/homestays sell rooms
const WORDS = {
  hostel: { kind: 'hostel', unit: 'bed', Unit: 'Bed', units: 'beds', Units: 'Beds', setup: 'Rooms & beds', group: 'Room', groups: 'room types',
    perf: 'RevPAB', perfLong: 'Revenue per available bed per night', example: '“6-Bed Mixed Dorm” with 6 beds at ₹700' },
  hotel: { kind: 'hotel', unit: 'room', Unit: 'Room', units: 'rooms', Units: 'Rooms', setup: 'Rooms', group: 'Room type', groups: 'room types',
    perf: 'RevPAR', perfLong: 'Revenue per available room per night', example: '“Deluxe Double” with 4 rooms (101–104) at ₹2,500' },
  homestay: { kind: 'homestay', unit: 'room', Unit: 'Room', units: 'rooms', Units: 'Rooms', setup: 'Rooms', group: 'Room type', groups: 'room types',
    perf: 'RevPAR', perfLong: 'Revenue per available room per night', example: '“Garden Room” at ₹1,800 for 2 guests' },
};
export let W = WORDS.hostel;
export const setKind = (k) => { W = WORDS[k] || WORDS.hostel; return W; };
export const roomsMode = () => W.unit === 'room';
export const guestsText = (adults, children) => `${adults || 1} adult${(adults || 1) > 1 ? 's' : ''}${children ? ` · ${children} child${children > 1 ? 'ren' : ''}` : ''}`;

export const ROLE_LABEL = { owner: 'Owner', manager: 'Manager', front_desk: 'Front desk', accountant: 'Accountant' };

class Stop extends Error {}
export function reveal() { document.documentElement.classList.remove('ns-booting'); }

export function showFatal(message, { signIn = false } = {}) {
  const box = `<div class="ns-card" style="max-width:520px;margin:40px auto;text-align:center;display:flex;flex-direction:column;gap:14px;align-items:center">
      <div class="ns-h3">${esc(message)}</div>
      ${signIn ? '<a class="ns-btn" href="login.html">Go to sign in</a>' : '<button type="button" class="ns-btn-ghost" data-reload>Try again</button>'}
    </div>`;
  const host = $('.ns-content') || $('.ns-dialog') || document.body;
  host.innerHTML = box;
  host.querySelector('[data-reload]')?.addEventListener('click', () => location.reload());
  host.removeAttribute?.('style');
  if (host.classList?.contains('ns-content')) host.style.padding = '24px';
  reveal();
}

/** Run a page: check the login, apply the role, then render. */
export function page(key, fn) {
  if (NOT_CONNECTED) { location.replace('login.html'); return; }
  (async () => {
    try {
      const ctx = await boot(key);
      await fn(ctx);
      reveal();
    } catch (e) {
      if (e instanceof Stop) return;
      console.error(e);
      showFatal(e.message || 'Something went wrong.');
    }
  })();
}

export const TEMP_KEY = 'ns.temp.session';
export function markBrowserSession() { try { document.cookie = 'ns_alive=1; path=/; SameSite=Lax'; } catch { /* ignore */ } }
async function boot(key) {
  // "Keep me signed in" was unticked and the browser has since been closed → sign out
  if (LIVE) {
    let temp = false; try { temp = localStorage.getItem(TEMP_KEY) === '1'; } catch { /* ignore */ }
    if (temp && !/(^|;\s*)ns_alive=1/.test(document.cookie)) {
      await sb.auth.signOut().catch(() => {});
      try { localStorage.removeItem(TEMP_KEY); } catch { /* ignore */ }
    }
  }
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    const here = location.pathname.split('/').pop() + location.search;
    location.replace('login.html?next=' + encodeURIComponent(here));
    throw new Stop();
  }
  // Properties added for this email by NammaStay admin get linked on sign-in
  const claimKey = 'ns.claimed.' + session.user.id;
  if (Date.now() - Number(localStorage.getItem(claimKey) || 0) > 5 * 60e3) {
    await rpc('claim_property_invites').catch(() => 0);
    localStorage.setItem(claimKey, String(Date.now()));
  }
  const mems = await rpc('my_memberships');
  if (!mems?.length) {
    // New owner who signed up but hasn't created a property yet → finish setup.
    // (Invited staff get linked by the owner in Settings → Users & roles.)
    location.replace('signup.html?step=property');
    throw new Stop();
  }
  const saved = localStorage.getItem('ns.property');
  const m = mems.find((x) => x.property_id === saved) || mems[0];
  localStorage.setItem('ns.property', m.property_id);
  const kindRow = await sb.from('properties').select('kind').eq('id', m.property_id).limit(1).then((r) => (r.data && r.data[0]) || {}, () => ({}));
  setKind(kindRow.kind);
  const ctx = {
    kind: W.kind, words: W,
    user: session.user, memberships: mems,
    property_id: m.property_id, property_name: m.property_name, role: m.role,
    name: m.display_name || session.user.email,
    can: (...roles) => roles.includes(m.role),
  };
  ctx.isAdmin = await rpc('is_platform_admin').catch(() => false);   // NammaStay platform admin (leads)
  applyChrome(ctx);
  const allowed = PAGE_ROLES[key];
  if (allowed && !allowed.includes(ctx.role)) {
    showFatal('Your role doesn’t have access to this page.');
    throw new Stop();
  }
  ctx.access = await rpc('property_access', { p_property: ctx.property_id }).catch(() => null);
  accessBanner(ctx);
  rpc('touch_presence', { p_property: ctx.property_id }).catch(() => {});
  sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') location.replace('login.html'); });
  startNotifications(ctx);
  return ctx;
}

function applyChrome(ctx) {
  const nameEl = $('.ns-user-name'); if (nameEl) nameEl.textContent = ctx.name;
  const subEl = $('.ns-user-sub'); if (subEl) subEl.textContent = `${ROLE_LABEL[ctx.role]} · ${ctx.property_name}`;
  const av = $('.ns-avatar'); if (av) av.textContent = initials(ctx.name);
  $$('.ns-nav-link').forEach((a) => {
    const k = NAV_KEY[a.getAttribute('href')];
    if (k && PAGE_ROLES[k] && !PAGE_ROLES[k].includes(ctx.role)) a.style.display = 'none';
  });
  const roomsLink = $('.ns-sidebar .ns-nav-link[href="rooms.html"] span'); if (roomsLink) roomsLink.textContent = W.setup;
  $$('.ns-mobile-nav a[href="rooms.html"], .ns-drawer a[href="rooms.html"]').forEach((a) => { const sp = a.querySelector('span') || a; sp.textContent = W.setup; });
  if (!['owner', 'manager', 'front_desk'].includes(ctx.role)) {
    $$('a[href="check-in.html"]').forEach((a) => { a.style.display = 'none'; });
  }
  if (ctx.isAdmin) addLeadsLink();
  if (DEMO) demoBadge();
  const out = $('.ns-signout');
  if (out) out.addEventListener('click', async (e) => {
    e.preventDefault();
    await sb.auth.signOut();
    localStorage.removeItem('ns.property');
    location.replace('login.html');
  });
  if (ctx.memberships.length > 1 && subEl) {         // switch property
    subEl.style.cursor = 'pointer';
    subEl.title = 'Switch property';
    subEl.addEventListener('click', () => choose('Switch property',
      ctx.memberships.map((m) => ({ label: `${m.property_name} (${ROLE_LABEL[m.role]})`, value: m.property_id })))
      .then((v) => { if (v) { localStorage.setItem('ns.property', v); location.reload(); } }));
  }
}

// Trial / expiry banner at the top of every screen
function accessBanner(ctx) {
  const a = ctx.access;
  const main = $('.ns-main') || $('.ns-dialog');
  if (a?.state === 'suspended' && main) {
    const el = document.createElement('div'); el.className = 'ns-access-banner danger'; el.setAttribute('role', 'alert');
    el.innerHTML = '<b>This account is suspended — new bookings are paused.</b> Your data is safe. Please contact NammaStay support.';
    const mb = $('.ns-mobilebar'); if (mb && mb.parentNode === main) mb.insertAdjacentElement('afterend', el); else main.prepend(el);
    rpc('property_suspension', { p_property: ctx.property_id }).then((x) => { if (x?.reason) el.insertAdjacentHTML('beforeend', ` <span style="font-weight:600">Reason: ${esc(x.reason)}</span>`); }).catch(() => {});
    return;
  }
  if (!a || !main || ['complimentary', 'active'].includes(a.state) && !(a.state === 'active' && a.days_left <= 5)) return;
  const canPay = ctx.can('owner');
  const link = canPay ? ' <a href="settings.html?tab=billing">Choose a plan →</a>' : ' Ask the owner to renew.';
  let cls = 'info'; let text;
  if (a.pending_payment) { text = 'Payment received — waiting for confirmation from NammaStay.'; }
  else if (a.state === 'trial') { text = `Free trial: <b>${a.days_left} day${a.days_left === 1 ? '' : 's'} left</b>.` + link; cls = a.days_left <= 3 ? 'warn' : 'info'; }
  else if (a.state === 'active') { text = `Your plan renews in <b>${a.days_left} day${a.days_left === 1 ? '' : 's'}</b>.` + (canPay ? ' <a href="settings.html?tab=billing">Pay now →</a>' : ''); cls = 'warn'; }
  else if (a.state === 'grace') { text = '<b>Your subscription has ended.</b> New bookings stop in a few days.' + link; cls = 'warn'; }
  else { text = '<b>Subscription ended — new bookings are paused.</b> Your data is safe and still visible.' + link; cls = 'danger'; }
  const el = document.createElement('div');
  el.className = 'ns-access-banner ' + cls; el.setAttribute('role', 'status'); el.innerHTML = text;
  const mobilebar = $('.ns-mobilebar');
  if (mobilebar && mobilebar.parentNode === main) mobilebar.insertAdjacentElement('afterend', el); else main.prepend(el);
}

function addLeadsLink() {
  const reports = $('.ns-sidebar .ns-nav-link[href="reports.html"]');
  if (!reports || $('.ns-sidebar .ns-nav-link[href="leads.html"]')) return;
  const a = document.createElement('a');
  a.href = 'leads.html'; a.className = 'ns-nav-link';
  a.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"></path><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"></path></svg><span>Leads</span>';
  if (/leads\.html$/.test(__PATH())) { a.classList.add('is-active'); a.setAttribute('aria-current', 'page'); }
  const ad = document.createElement('a');
  ad.href = 'admin.html'; ad.className = 'ns-nav-link';
  ad.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"></path><path d="M9 12l2 2 4-4"></path></svg><span>Admin panel</span>';
  if (/admin\.html$/.test(__PATH())) { ad.classList.add('is-active'); ad.setAttribute('aria-current', 'page'); }
  const label = document.createElement('div');
  label.className = 'ns-nav-section'; label.textContent = 'NammaStay admin';
  reports.insertAdjacentElement('afterend', label);
  label.insertAdjacentElement('afterend', ad);
  ad.insertAdjacentElement('afterend', a);
  const b = document.createElement('a');
  b.href = 'subscribers.html'; b.className = 'ns-nav-link';
  b.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"></rect><path d="M2 10h20"></path></svg><span>Subscribers</span>';
  if (/subscribers\.html$/.test(__PATH())) { b.classList.add('is-active'); b.setAttribute('aria-current', 'page'); }
  a.insertAdjacentElement('afterend', b);
}
const __PATH = () => location.pathname;

function demoBadge() {
  const host = $('.ns-sidebar .ns-user') || $('.ns-sidebar');
  if (!host || $('.ns-demo-badge')) return;
  const el = document.createElement('div');
  el.className = 'ns-demo-badge';
  const k = sb.kind?.() || 'hostel';
  el.innerHTML = `<b>Demo mode</b> · sample data saved in this browser. <button type="button" data-reset>Reset</button> · <button type="button" data-exit>Exit demo</button>
    <div style="margin-top:6px">Try as: ${[['hostel', 'Hostel'], ['hotel', 'Hotel'], ['homestay', 'Homestay']].map(([v, l]) =>
      `<button type="button" data-kind="${v}" style="${v === k ? 'color:#E2A03F;text-decoration:none' : ''}">${l}</button>`).join(' · ')}</div>`;
  el.querySelectorAll('[data-kind]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.kind === k) return;
    sb.setKind(b.dataset.kind); location.replace('dashboard.html');
  }));
  el.querySelector('[data-exit]').addEventListener('click', async () => {
    try { localStorage.removeItem('ns.demo.on'); } catch { /* ignore */ }
    location.replace('login.html?demo=0');
  });
  el.querySelector('[data-reset]').addEventListener('click', async () => {
    if (await confirmDialog('Reset demo data', 'Start again with fresh sample bookings? Changes you made in the demo will be cleared.', { confirmLabel: 'Reset' })) {
      sb.reset(); location.reload();
    }
  });
  host.parentNode.insertBefore(el, host);
}

/** Replace a page-header subtitle (the grey line under the page title) */
export function setSubtitle(text) {
  const el = $('.ns-main > [style*="height:76px"] [style*="font-size:13px;color:#6B7280"]');
  if (el) el.textContent = text;
}
/** The right-hand side of the page header (buttons area) */
export function headerActions() {
  const head = $('.ns-main > [style*="height:76px"]');
  if (!head) return null;
  let box = head.children[1];
  if (!box) { box = document.createElement('div'); head.appendChild(box); }
  box.setAttribute('style', 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;');
  return box;
}
/** Turn the design's static search pill in the header into a real input */
export function headerSearch(placeholder, onSearch, initial = '') {
  // the pill itself = the div whose own <span> says "Search…" (not the wrapper that also holds the buttons)
  const pillEl = $$('.ns-main > [style*="height:76px"] div')
    .find((d) => [...d.children].some((c) => c.tagName === 'SPAN' && /Search/.test(c.textContent)));
  if (!pillEl) return null;
  pillEl.className = 'ns-search';
  pillEl.removeAttribute('style');
  const span = pillEl.querySelector('span');
  const input = document.createElement('input');
  input.type = 'search'; input.placeholder = placeholder; input.value = initial;
  input.setAttribute('aria-label', placeholder);
  span.replaceWith(input);
  input.addEventListener('input', debounce(() => onSearch(input.value.trim(), false), 350));
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') onSearch(input.value.trim(), true); });
  return input;
}

/** Swap the static content area for live markup */
export function content(html, style = 'padding:24px 32px;display:flex;flex-direction:column;gap:20px;') {
  const el = $('.ns-content');
  el.setAttribute('style', style);
  el.innerHTML = html;
  return el;
}

// ---------------------------------------------------------------- notifications (in-app badge)
const BELL = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9"></path><path d="M10.3 21a1.94 1.94 0 003.4 0"></path></svg>';
async function startNotifications(ctx) {
  const bells = [];
  for (const host of [$('.ns-sidebar'), $('.ns-mobilebar')]) {
    if (!host) continue;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'ns-bell'; b.setAttribute('aria-label', 'Notifications'); b.innerHTML = BELL;
    b.addEventListener('click', () => openNotifications(ctx, setCount));
    host.appendChild(b); bells.push(b);
  }
  if (!bells.length) return;
  function setCount(n) {
    bells.forEach((b) => {
      b.querySelector('.ns-bell-count')?.remove();
      b.setAttribute('aria-label', n ? `Notifications, ${n} unread` : 'Notifications');
      if (n) b.insertAdjacentHTML('beforeend', `<span class="ns-bell-count">${n > 99 ? '99+' : n}</span>`);
    });
    document.title = document.title.replace(/^\(\d+\+?\)\s/, '');
    if (n) document.title = `(${n > 99 ? '99+' : n}) ${document.title}`;
  }
  let unread = 0;
  try {
    const { count } = await q(sb.from('notifications').select('id', { count: 'exact', head: true })
      .eq('property_id', ctx.property_id).is('read_at', null), { withCount: true });
    unread = count || 0; setCount(unread);
  } catch { /* badge is best-effort */ }
  sb.channel('ns-notifications-' + ctx.property_id)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `property_id=eq.${ctx.property_id}` },
      (p) => { unread += 1; setCount(unread); toast(p.new.title + (p.new.body ? ' · ' + p.new.body : '')); })
    .subscribe();
}
async function openNotifications(ctx, setCount) {
  const rows = await q(sb.from('notifications').select('title, body, booking_id, created_at, read_at')
    .eq('property_id', ctx.property_id).order('created_at', { ascending: false }).limit(20));
  const list = rows.length ? rows.map((n) => `
      <a ${n.booking_id ? `href="booking-detail.html?id=${esc(n.booking_id)}"` : ''} class="ns-list-row" style="color:inherit">
        <div><div style="font-size:13px;font-weight:${n.read_at ? 600 : 800}">${esc(n.title)}</div>
        <div class="ns-muted">${esc(n.body || '')}</div></div>
        <div class="ns-muted" style="white-space:nowrap">${fmtDayTime(n.created_at)}</div>
      </a>`).join('') : '<div class="ns-empty">No notifications yet.</div>';
  modal({ title: 'Notifications', body: `<div>${list}</div>`, actions: [{ label: 'Close' }] });
  rpc('mark_notifications_read', { p_property: ctx.property_id }).then(() => setCount(0)).catch(() => {});
}

// ---------------------------------------------------------------- UI helpers
export function toast(message, { error = false, ms = 3500 } = {}) {
  $('.ns-toast')?.remove();
  const t = document.createElement('div');
  t.className = 'ns-toast' + (error ? ' is-error' : '');
  t.setAttribute('role', error ? 'alert' : 'status');
  t.textContent = message;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

/**
 * Open a dialog. actions: [{ label, kind: 'primary'|'ghost'|'danger', onClick(el) → false to keep open }]
 * Returns { el, close }.
 */
export function modal({ title, body, actions = [], width }) {
  const prevFocus = document.activeElement;
  const ov = document.createElement('div');
  ov.className = 'ns-overlay';
  ov.innerHTML = `<div class="ns-modal" role="dialog" aria-modal="true" aria-label="${esc(title)}" ${width ? `style="width:${width}px"` : ''}>
      <div class="ns-modal-head"><div class="ns-h3" style="font-size:17px">${esc(title)}</div>
        <button type="button" class="ns-x" aria-label="Close"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"></path></svg></button></div>
      <div class="ns-modal-body">${body}<div class="ns-error" data-modal-error hidden></div></div>
      ${actions.length ? '<div class="ns-modal-foot"></div>' : ''}
    </div>`;
  const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); prevFocus?.focus?.(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
  ov.querySelector('.ns-x').addEventListener('click', close);
  const foot = ov.querySelector('.ns-modal-foot');
  const errEl = ov.querySelector('[data-modal-error]');
  actions.forEach((a) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = a.kind === 'primary' ? 'ns-btn' : a.kind === 'danger' ? 'ns-btn-danger' : 'ns-btn-ghost';
    b.textContent = a.label;
    b.addEventListener('click', async () => {
      if (!a.onClick) return close();
      errEl.hidden = true;
      b.disabled = true;
      try {
        const keep = await a.onClick(ov);
        if (keep !== false) close();
      } catch (e) {
        errEl.textContent = e.message; errEl.hidden = false;
      } finally { b.disabled = false; }
    });
    foot.appendChild(b);
  });
  document.body.appendChild(ov);
  (ov.querySelector('input,select,textarea') || ov.querySelector('.ns-x')).focus();
  return { el: ov, close };
}

export function confirmDialog(title, message, { confirmLabel = 'Confirm', danger = false } = {}) {
  return new Promise((resolve) => {
    const m = modal({
      title, body: `<p style="margin:0;font-size:14px;line-height:1.6">${esc(message)}</p>`,
      actions: [{ label: 'Go back', onClick: () => resolve(false) },
                { label: confirmLabel, kind: danger ? 'danger' : 'primary', onClick: () => resolve(true) }],
    });
    m.el.querySelector('.ns-x').addEventListener('click', () => resolve(false));
  });
}

export function choose(title, options) {
  return new Promise((resolve) => {
    const body = options.map((o, i) => `<button type="button" class="ns-btn-ghost" data-i="${i}" style="justify-content:flex-start;width:100%">${esc(o.label)}</button>`).join('');
    const m = modal({ title, body });
    m.el.querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', () => { resolve(options[b.dataset.i].value); m.close(); }));
    m.el.querySelector('.ns-x').addEventListener('click', () => resolve(null));
  });
}

/** Read form values inside an element by [name] */
export function formValues(root) {
  const out = {};
  root.querySelectorAll('[name]').forEach((el) => {
    out[el.name] = el.type === 'checkbox' ? el.checked : el.value.trim();
  });
  return out;
}

export const field = (label, control, help = '') =>
  `<div class="ns-field"><label>${esc(label)}</label>${control}${help ? `<div class="ns-help">${help}</div>` : ''}</div>`;

export function options(list, selected) {
  return list.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(selected) ? 'selected' : ''}>${esc(l)}</option>`).join('');
}

// ---------------------------------------------------------------- WhatsApp booking details to the guest
// Free click-to-chat: opens WhatsApp with the message ready; staff tap Send.
const fWa = fmt({ weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const waDate = (d) => {
  const p = Object.fromEntries(fWa.formatToParts(new Date(d)).map((x) => [x.type, x.value]));
  return `${p.weekday}, ${p.day} ${sep(p.month)} ${p.year}, ${fmtTime(d)}`;          // Mon, 26 Oct 2026, 2:00 PM
};
export function waNumber(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.length === 10) d = '91' + d;                     // Indian mobile saved without country code
  return d.length >= 8 ? d : '';
}
export function bookingMessage({ booking: b, guest: g, bed, property: p, contact = {} }) {
  const first = String(g.full_name || '').trim().split(/\s+/)[0] || 'there';
  const head = b.status === 'checked_in' ? `Welcome to ${p.name}! You’re checked in. 🙌`
    : b.status === 'pending' ? `We’ve received your booking request at ${p.name}. We’ll confirm it shortly.`
    : `Your booking at ${p.name} is confirmed. ✅`;
  const lines = [`Hi ${first}! 🙏`, head, '',
    `*Booking:* ${b.code}`, `*Name:* ${g.full_name}`, `*${W.Unit}:* ${bed.room} · ${bed.label}`,
    ...(roomsMode() ? [`*Guests:* ${guestsText(b.visitors, b.children)}`] : []),
    `*Check-in:* ${waDate(b.check_in_at)}`, `*Check-out:* ${waDate(b.check_out_at)}`,
    `*Nights:* ${b.nights}`,
    `*Total:* ${rupees(b.total_paise)}${b.paid_paise ? ` · Paid: ${rupees(b.paid_paise)}` : ''}${b.balance_paise > 0 ? ` · *Balance due: ${rupees(b.balance_paise)}*` : ''}`];
  if (b.self_checkin_token && ['pending', 'confirmed'].includes(b.status) && !b.self_checkin_at) {
    lines.push('', 'Save time at the desk — check in online:', `${SITE_URL}/self-check-in.html?t=${b.self_checkin_token}`);
  }
  const addr = [contact.address, contact.city].filter(Boolean).join(', ');
  if (addr || contact.phone) lines.push('');
  if (addr) lines.push(`📍 ${addr}`);
  if (contact.phone) lines.push(`📞 ${contact.phone}`);
  lines.push('', b.status === 'checked_in' ? 'Enjoy your stay!' : 'See you soon!');
  return lines.join('\n');
}
// ---- Booking confirmation as a picture card (ticket design) ----
function cardInfo(d, contact) {
  const b = d.booking; const tz = { timeZone: TZ };
  const day = (x) => new Intl.DateTimeFormat('en-IN', { ...tz, weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(x)).replace('Sept', 'Sep');
  const dnum = (x) => new Intl.DateTimeFormat('en-IN', { ...tz, day: 'numeric' }).format(new Date(x));
  const mon = (x) => new Intl.DateTimeFormat('en-IN', { ...tz, month: 'short' }).format(new Date(x)).replace('Sept', 'Sep').toUpperCase();
  const head = b.status === 'checked_in' ? 'Welcome — you’re checked in' : b.status === 'pending' ? 'Booking request received' : 'Booking confirmed';
  return { property: d.property.name, code: b.code, guest: d.guest.full_name, first: String(d.guest.full_name || '').split(/\s+/)[0],
    room: d.bed.room, bed: d.bed.label, nights: b.nights, status: b.status, head,
    inDay: day(b.check_in_at), inTime: fmtTime(b.check_in_at), outDay: day(b.check_out_at), outTime: fmtTime(b.check_out_at),
    inNum: dnum(b.check_in_at), inMon: mon(b.check_in_at), outNum: dnum(b.check_out_at), outMon: mon(b.check_out_at),
    guests: roomsMode() ? guestsText(b.visitors, b.children) : null,
    total: rupees(b.total_paise), paid: b.paid_paise ? rupees(b.paid_paise) : null, balance: b.balance_paise > 0 ? rupees(b.balance_paise) : null,
    address: [contact.address, contact.city].filter(Boolean).join(', '), phone: contact.phone || '' };
}
function rr(x, px, py, w, h, r) { x.beginPath(); x.moveTo(px + r, py); x.arcTo(px + w, py, px + w, py + h, r); x.arcTo(px + w, py + h, px, py + h, r); x.arcTo(px, py + h, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath(); }
function fit(x, text, maxW, size, weight = 800, fam = 'Sora') {
  let s2 = size; x.font = `${weight} ${s2}px ${fam}, Manrope, system-ui, sans-serif`;
  while (x.measureText(text).width > maxW && s2 > 18) { s2 -= 2; x.font = `${weight} ${s2}px ${fam}, Manrope, system-ui, sans-serif`; }
  let t = String(text); while (x.measureText(t).width > maxW && t.length > 3) t = t.slice(0, -2) + '…';
  return t;
}
const F = (w, px, fam = 'Manrope') => `${w} ${px}px ${fam}, system-ui, sans-serif`;
const C = { navy: '#0E1B3D', navy2: '#1D2F63', cream: '#FBF3DE', green: '#1C9A6C', mint: '#7BE0B6', amber: '#E2A03F', muted: '#8B93A8', ink: '#101A3D', line: '#E7DFC7' };

export function drawBookingCard(i) {
  const c = document.createElement('canvas'); const x = c.getContext('2d');
  const label = (t, px, py, col = C.muted) => { x.fillStyle = col; x.font = F(800, 20); x.fillText(t.toUpperCase(), px, py); };
  const val = (t, px, py, size = 34, col = C.ink, maxW = 400) => { x.fillStyle = col; x.font = F(800, size, 'Sora'); x.fillText(fit(x, t, maxW, size), px, py); };
  // Ticket (boarding-pass) design
  const W = 1200; const H = 620; c.width = W; c.height = H;
  x.fillStyle = '#E9E1C8'; x.fillRect(0, 0, W, H);
  rr(x, 30, 30, W - 60, H - 60, 36); x.fillStyle = C.cream; x.fill();
  // left band
  x.save(); rr(x, 30, 30, W - 60, H - 60, 36); x.clip();
  x.fillStyle = C.navy; x.fillRect(30, 30, W - 60, 120);
  x.font = F(800, 22); const stTxt = '● ' + i.head.toUpperCase(); const stW = x.measureText(stTxt).width;
  const propName = fit(x, i.property, 860 - 70 - stW - 30, 34); x.fillStyle = C.cream; x.fillText(propName, 70, 102);
  x.fillStyle = i.status === 'pending' ? C.amber : C.mint; x.font = F(800, 22); x.textAlign = 'right'; x.fillText(stTxt, 860, 100); x.textAlign = 'left';
  // stub
  x.fillStyle = C.green; x.fillRect(900, 30, W - 930, H - 60);
  x.restore();
  // perforation
  x.fillStyle = '#E9E1C8'; x.beginPath(); x.arc(900, 30, 26, 0, Math.PI * 2); x.arc(900, H - 30, 26, 0, Math.PI * 2); x.fill();
  x.strokeStyle = C.cream; x.lineWidth = 4; x.setLineDash([10, 12]); x.beginPath(); x.moveTo(900, 70); x.lineTo(900, H - 70); x.stroke(); x.setLineDash([]);
  label('Guest', 70, 205); val(i.guest, 70, 255, 46, C.ink, 780);
  label('Check-in', 70, 330); val(i.inDay, 70, 372, 32); x.fillStyle = C.muted; x.font = F(700, 24); x.fillText(i.inTime, 70, 406);
  label('Check-out', 360, 330); val(i.outDay, 360, 372, 32); x.fillStyle = C.muted; x.font = F(700, 24); x.fillText(i.outTime, 360, 406);
  label('Nights', 650, 330); val(String(i.nights), 650, 372, 32);
  label('Bed', 70, 470); val(`${i.room} · ${i.bed}`, 70, 512, 30, C.ink, 780);
  x.fillStyle = C.muted; x.font = F(600, 20); x.fillText(fit(x, [i.address, i.phone].filter(Boolean).join('   ·   '), 780, 20, 600, 'Manrope'), 70, 560);
  // stub text
  x.save(); x.translate(1015, H / 2); x.rotate(-Math.PI / 2); x.textAlign = 'center';
  x.fillStyle = 'rgba(255,255,255,.75)'; x.font = F(800, 20); x.fillText('BOOKING', 0, -62);
  x.fillStyle = '#FFFFFF'; x.font = F(800, 52, 'Sora'); x.fillText(i.code, 0, -8);
  x.font = F(800, 22); x.fillStyle = i.balance ? '#FFE8B8' : '#D8FFEC'; x.fillText(i.balance ? `BALANCE ${i.balance}` : i.paid ? 'FULLY PAID ✓' : `TOTAL ${i.total}`, 0, 40);
  x.restore();
  return c;
}

/** Send booking details to the guest: ticket picture card or text. */
export async function sendBookingWhatsApp(bookingId, { justSaved = false } = {}) {
  const d = await rpc('booking_detail', { p_booking: bookingId });
  const contact = await sb.from('properties').select('name, address, city, phone').eq('id', d.property.id).limit(1)
    .then((r) => (r.data && r.data[0]) || {}, () => ({}));
  const text = bookingMessage({ booking: d.booking, guest: d.guest, bed: d.bed, property: d.property, contact });
  const info = cardInfo(d, contact);
  const num = waNumber(d.guest.phone);
  const caption = `${info.head} — ${info.property}\n${info.guest} · ${info.code}\n${info.inDay}, ${info.inTime} → ${info.outDay}, ${info.outTime}`
    + (d.booking.self_checkin_token && ['pending', 'confirmed'].includes(d.booking.status) && !d.booking.self_checkin_at
      ? `\n\nCheck in online: ${SITE_URL}/self-check-in.html?t=${d.booking.self_checkin_token}` : '');
  const canShareFiles = !!(navigator.canShare && navigator.canShare({ files: [new File([new Blob(['x'])], 'x.png', { type: 'image/png' })] }));
  const canCopyImg = !!(window.ClipboardItem && navigator.clipboard?.write);
  let blob = null; let url = null;
  try { await document.fonts?.ready; } catch { /* fonts are optional */ }

  const m = modal({
    title: justSaved ? `Booking ${d.booking.code} saved ✓` : 'Send booking details', width: 620,
    body: `${justSaved ? '<div style="font-size:14px">Send the booking details to the guest on WhatsApp?</div>' : ''}
      ${num ? `<div class="ns-muted" style="font-size:13px">To <b>${esc(d.guest.full_name)}</b> · ${esc(d.guest.phone)}</div>`
        : '<div class="ns-demo-hint">No phone number saved for this guest — WhatsApp will ask you to pick the contact.</div>'}
      <div class="ns-seg light" role="tablist" id="wa-mode"><button type="button" class="is-on" data-mode="card">🖼 Picture card</button><button type="button" data-mode="text">💬 Text message</button></div>
      <div id="wa-card-pane" style="display:flex;flex-direction:column;gap:10px">
        <img id="wa-card" alt="Booking card preview" style="width:100%;border-radius:12px;box-shadow:0 10px 26px rgba(14,27,61,.18);background:#F5F1E3;max-height:52vh;object-fit:contain">
        <div class="ns-help" id="wa-card-help">${canShareFiles ? 'Tap <b>Share card</b> → choose <b>WhatsApp</b> → the guest. The card goes with a short caption.'
          : canCopyImg ? 'Click <b>Copy image</b>, then paste it (Ctrl+V) into the guest’s chat in WhatsApp — <b>Open chat</b> opens it for you.'
          : 'Click <b>Download</b>, then attach the image in the guest’s WhatsApp chat.'}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
          <button type="button" class="ns-btn-ghost" id="wa-dl">Download</button>
          ${canCopyImg ? '<button type="button" class="ns-btn-ghost" id="wa-copy">Copy image</button>' : ''}
          ${canShareFiles ? '<button type="button" class="ns-btn" id="wa-share" style="background:#25D366;border-color:#25D366">Share card</button>'
            : `<a class="ns-btn" id="wa-chat" style="background:#25D366;border-color:#25D366" target="_blank" rel="noopener" href="https://wa.me/${num}?text=${encodeURIComponent(caption)}">Open chat</a>`}
        </div>
      </div>
      <div id="wa-text-pane" hidden style="display:flex;flex-direction:column;gap:10px">
        <textarea class="ns-input" id="wa-text" rows="14" style="font-size:13px;line-height:1.5">${esc(text)}</textarea>
        <div class="ns-help">You can edit the message before sending.</div>
        <div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="ns-btn-ghost" id="wa-copy-text">Copy</button>
          <button type="button" class="ns-btn" id="wa-open" style="background:#25D366;border-color:#25D366">Open WhatsApp</button></div>
      </div>`,
    actions: [{ label: justSaved ? 'Not now' : 'Close' }],
  });
  const $m = (sel) => m.el.querySelector(sel);
  const fileName = () => `${info.code}-booking.png`;
  const render = async () => {
    const canvas = drawBookingCard(info);
    blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(blob); $m('#wa-card').src = url;
  };
  $m('#wa-mode').addEventListener('click', (e) => {
    const b = e.target.closest('[data-mode]'); if (!b) return;
    m.el.querySelectorAll('#wa-mode button').forEach((x) => x.classList.toggle('is-on', x === b));
    $m('#wa-card-pane').hidden = b.dataset.mode !== 'card'; $m('#wa-text-pane').hidden = b.dataset.mode !== 'text';
  });
  $m('#wa-dl').onclick = () => { const a = document.createElement('a'); a.href = url; a.download = fileName(); a.click(); };
  $m('#wa-copy')?.addEventListener('click', async () => {
    try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); toast('Card copied — paste it into the WhatsApp chat.'); }
    catch { toast('Couldn’t copy the image — use Download instead.', { error: true }); }
  });
  $m('#wa-share')?.addEventListener('click', async () => {
    const f = new File([blob], fileName(), { type: 'image/png' });
    try { await navigator.share({ files: [f], text: caption, title: info.head }); } catch { /* cancelled */ }
  });
  $m('#wa-copy-text').onclick = async () => {
    try { await navigator.clipboard.writeText($m('#wa-text').value); toast('Message copied.'); } catch { $m('#wa-text').select(); toast('Select and copy the message.'); }
  };
  $m('#wa-open').onclick = () => window.open(`https://wa.me/${num}?text=${encodeURIComponent($m('#wa-text').value)}`, '_blank', 'noopener');
  await render();
  return m;
}

// ---------------------------------------------------------------- delete a booking entered by mistake
// Used from the booking screen and from the calendar. Removes only this stay.
export function deleteBookingDialog({ ctx, id, guest, room, bed, checkIn, checkOut, status, paidPaise = 0, paymentsCount = null, createdAt = null, onDone }) {
  const nPay = paymentsCount ?? (paidPaise > 0 ? 1 : 0);
  if (ctx.role === 'front_desk' && (nPay > 0 || (createdAt && Date.now() - new Date(createdAt) > 24 * 3600e3))) {
    toast('Front desk can only delete bookings made in the last 24 hours with no payments. Please ask the owner or manager.', { error: true });
    return;
  }
  modal({
    title: `Delete ${guest}’s stay?`,
    body: `<p style="margin:0;font-size:14px;line-height:1.6">This removes only this stay — <b>${esc(room)} · ${esc(bed)}</b>,
        <b>${fmtDayTime(checkIn)} → ${fmtDayTime(checkOut)}</b> — and frees the ${W.unit} for those dates.
        ${esc(guest)}’s profile and other bookings are not affected.</p>
      ${status === 'checked_in' ? '<div class="ns-demo-hint">This guest is <b>checked in right now</b>. Only delete if the booking was entered by mistake — to end a real stay, use <b>Check out</b>.</div>' : ''}
      ${paidPaise > 0 ? `<div class="ns-error" style="font-weight:600">${rupees(paidPaise)} paid on this booking will be deleted too. If you really received this money, record it on the correct booking.</div>` : ''}
      ${field('Reason', `<select class="ns-input" name="reason">${options([['Entered by mistake', 'Entered by mistake'], ['Duplicate booking', 'Duplicate booking'],
        ['Wrong guest', 'Wrong guest'], ['Wrong bed or dates', 'Wrong bed or dates'], ['Test booking', 'Test booking'], ['Other', 'Other']], 'Entered by mistake')}</select>`)}
      <div class="ns-help">A copy is kept in Settings → Notifications → Deleted bookings.</div>`,
    actions: [{ label: 'Keep booking' }, { label: 'Delete booking', kind: 'danger', onClick: async (el) => {
      const r = await rpc('delete_booking', { p_booking: id, p_reason: el.querySelector('[name=reason]').value });
      toast(`${r.code} deleted — bed is free again.`);
      onDone?.(r);
    } }],
  });
}

// ---------------------------------------------------------------- delete a guest completely (owner / manager)
export async function deleteGuestDialog(ctx, guestId, onDone) {
  if (!ctx.can('owner', 'manager')) { toast('Only the owner or manager can delete a guest.', { error: true }); return; }
  const d = await rpc('guest_profile', { p_guest: guestId });
  const g = d.guest; const n = d.stays.length;
  const active = d.stays.filter((x) => ['pending', 'confirmed', 'checked_in'].includes(x.status));
  const inHouse = active.some((x) => x.status === 'checked_in');
  modal({
    title: `Delete ${g.full_name}?`,
    body: `<p style="margin:0;font-size:14px;line-height:1.6">This permanently removes <b>${esc(g.full_name)}</b>’s profile${n ? `, <b>all ${n} booking${n > 1 ? 's' : ''}</b>` : ''}${d.spend_paise ? ` and <b>${rupees(d.spend_paise)}</b> in payments` : ''}${g.id_doc_path || g.id_doc_back_path ? ', and their ID photos' : ''}.</p>
      ${d.spend_paise ? `<div class="ns-error" style="font-weight:600">${rupees(d.spend_paise)} will be removed from your revenue and reports.</div>` : ''}
      ${inHouse ? '<div class="ns-demo-hint">This guest is <b>checked in right now</b> — their ${W.unit} will show as free.</div>'
        : active.length ? `<div class="ns-demo-hint">${active.length} upcoming booking${active.length > 1 ? 's' : ''} will be cancelled and the ${W.units} freed.</div>` : ''}
      ${n ? `<div class="ns-muted" style="font-size:12.5px">To delete just one stay instead, use the 🗑 on that row in Stay history.</div>` : ''}
      ${field('Reason', `<select class="ns-input" name="reason">${options([['Entered by mistake', 'Entered by mistake'], ['Duplicate guest', 'Duplicate guest'],
        ['Guest asked to delete their data', 'Guest asked to delete their data'], ['Test entry', 'Test entry'], ['Other', 'Other']], 'Entered by mistake')}</select>`)}
      <label style="display:flex;gap:8px;align-items:flex-start;font-size:13px;font-weight:600"><input type="checkbox" name="sure" style="margin-top:2px">
        I understand this can’t be undone.</label>
      <div class="ns-help">A copy of each deleted booking is kept in Settings → Notifications → Deleted bookings.</div>`,
    actions: [{ label: 'Keep guest' }, { label: 'Delete guest', kind: 'danger', onClick: async (el) => {
      if (!el.querySelector('[name=sure]').checked) throw new Error('Tick the box to confirm.');
      const r = await rpc('delete_guest', { p_guest: guestId, p_reason: el.querySelector('[name=reason]').value });
      if (r.id_doc_paths?.length) await sb.storage.from('guest-ids').remove(r.id_doc_paths).catch(() => {});
      toast(`${r.guest} deleted${r.bookings_removed ? ` with ${r.bookings_removed} booking${r.bookings_removed > 1 ? 's' : ''}` : ''}.`);
      onDone?.(r);
    } }],
  });
}

// ---------------------------------------------------------------- pills
const STATUS = {
  pending: ['Pending', 'amber'], confirmed: ['Confirmed', 'navy'], checked_in: ['Checked-in', 'green'],
  checked_out: ['Checked-out', 'grey'], cancelled: ['Cancelled', 'red'], no_show: ['No-show', 'red'],
};
export const pill = (text, color) => `<span class="ns-pill ${color}">${esc(text)}</span>`;
export const statusPill = (s) => pill(...(STATUS[s] || [titleCase(s), 'grey']));
export const statusLabel = (s) => (STATUS[s] || [titleCase(s)])[0];
export function payPill(total, paid) {
  if (total > 0 && paid >= total) return pill('Paid', 'green');
  if (paid > 0) return pill('Partial', 'amber');
  return total > 0 ? pill('Unpaid', 'red') : pill('—', 'grey');
}
const METHOD = { upi: ['UPI', 'blue'], cash: ['Cash', 'grey'], card: ['Card', 'purple'], bank: ['Bank', 'blue'] };
export const methodPill = (m) => pill(...(METHOD[m] || [m, 'grey']));
export const METHOD_OPTIONS = [['upi', 'UPI'], ['cash', 'Cash'], ['card', 'Card'], ['bank', 'Bank transfer']];
export const ID_TYPES = [['aadhaar', 'Aadhaar card'], ['passport', 'Passport'], ['driving_licence', 'Driving licence'],
  ['pan', 'PAN card'], ['voter_id', 'Voter ID'], ['other', 'Other']];
export const SOURCES = [['walk_in', 'Walk-in'], ['direct', 'Direct (phone/WhatsApp/website)'], ['ota', 'Hostelworld / OTA'], ['referral', 'Referral']];

export function avatar(name, size = 30) {
  return `<div class="ns-avatar-sm" style="width:${size}px;height:${size}px;${size > 30 ? 'font-size:13px' : ''}">${esc(initials(name))}</div>`;
}

// ---------------------------------------------------------------- UPI (direct to your UPI ID, no gateway)
export function upiLink({ upiId, payee, amountPaise, note }) {
  const p = new URLSearchParams({ pa: upiId, pn: payee, am: (amountPaise / 100).toFixed(2), cu: 'INR', tn: note });
  return 'upi://pay?' + p.toString().replace(/\+/g, '%20');
}
export async function qrDataUrl(text) {
  try {
    const { default: QRCode } = await import('https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm');
    return await QRCode.toDataURL(text, { margin: 1, width: 220, color: { dark: '#0E1B3D', light: '#FFFFFF' } });
  } catch { return null; }                                  // QR is a convenience; the payment still works
}

// ---------------------------------------------------------------- ID photo upload (compressed in the browser)
export async function compressImage(file, maxSide = 1600, quality = 0.72) {
  if (!file) return null;
  if (file.type === 'application/pdf') {
    if (file.size > 5 * 1024 * 1024) throw new Error('PDF must be under 5 MB.');
    return file;
  }
  if (!/^image\//.test(file.type)) throw new Error('Upload a photo (JPG, PNG) or a PDF.');
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', quality));
  return new File([blob], 'id.jpg', { type: 'image/jpeg' });
}
export async function uploadIdDoc(path, file) {
  const { error } = await sb.storage.from('guest-ids').upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw new Error(error.message.includes('row-level security')
    ? 'Upload not allowed. The link may have expired.' : error.message);
  return path;
}
// ---- ID photos: front + back, shown inside the app (new tabs get blocked as pop-ups)
const isPdf = (p) => /\.pdf$/i.test(p || '');
export async function viewIdDocs({ front, back, name }) {
  const sides = [['Front', front], ['Back', back]].filter(([, p]) => p);
  if (!sides.length) { toast('No ID photo on file for this guest.', { error: true }); return; }
  const loaded = await Promise.all(sides.map(async ([label, path]) => {
    const [view, dl] = await Promise.all([
      sb.storage.from('guest-ids').createSignedUrl(path, 300),
      sb.storage.from('guest-ids').createSignedUrl(path, 300, { download: `${String(name || 'guest').replace(/\W+/g, '-')}-id-${label.toLowerCase()}${isPdf(path) ? '.pdf' : '.jpg'}` }),
    ]);
    return { label, path, url: view.data?.signedUrl, dl: dl.data?.signedUrl || view.data?.signedUrl, error: view.error?.message };
  }));
  modal({
    title: `ID · ${name || ''}`, width: sides.length > 1 ? 900 : 560,
    body: `<div style="display:grid;grid-template-columns:repeat(${sides.length},minmax(0,1fr));gap:16px" class="ns-id-grid">
      ${loaded.map((x) => `<figure style="margin:0;display:flex;flex-direction:column;gap:8px;min-width:0">
          <figcaption style="font-size:12px;font-weight:800;color:#6B7280;text-transform:uppercase;letter-spacing:.04em">${x.label} side</figcaption>
          ${x.error || !x.url ? `<div class="ns-empty" style="border:1px dashed #E2DAC4;border-radius:12px">Couldn’t load this file${x.error ? ': ' + esc(x.error) : ''}.<br>It may have been deleted after the retention period.</div>`
            : isPdf(x.path) ? `<div class="ns-empty" style="border:1px dashed #E2DAC4;border-radius:12px">PDF document</div>`
            : `<img src="${esc(x.url)}" alt="${x.label} of ID" style="width:100%;max-height:60vh;object-fit:contain;background:#F5F1E3;border-radius:12px" data-img>`}
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${x.url ? `<a class="ns-btn-ghost" style="height:34px;font-size:12px" href="${esc(x.url)}" target="_blank" rel="noopener">Open full size</a>
              <a class="ns-btn-ghost" style="height:34px;font-size:12px" href="${esc(x.dl)}" download>Download</a>` : ''}
          </div></figure>`).join('')}
      </div>
      <div class="ns-help">Links expire in 5 minutes. ID photos are deleted automatically after the retention period in Settings.</div>`,
    actions: [{ label: 'Close' }],
  }).el.querySelectorAll('[data-img]').forEach((img) => img.addEventListener('error', () => {
    img.outerHTML = '<div class="ns-empty" style="border:1px dashed #E2DAC4;border-radius:12px">Couldn’t load this image. It may have been deleted after the retention period.</div>';
  }));
}
/** Two file inputs (front / back) with a small preview each */
export function idUploadFields({ front = 'ID photo — front', back = 'ID photo — back (not needed for passports)', hasFront = false, hasBack = false } = {}) {
  const one = (name, label, has) => `<div class="ns-field"><label>${esc(label)}</label>
    <label class="ns-id-drop"><input type="file" name="${name}" accept="image/*,application/pdf" capture="environment">
      <img alt="" hidden><span>${has ? 'Replace photo' : 'Take or choose a photo'}</span></label></div>`;
  return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px" class="ns-id-upload">${one('id_file', front, hasFront)}${one('id_file_back', back, hasBack)}</div>`;
}
export function wireIdPreviews(root) {
  root.querySelectorAll('.ns-id-drop input[type=file]').forEach((inp) => inp.addEventListener('change', () => {
    const f = inp.files[0]; const img = inp.parentElement.querySelector('img'); const span = inp.parentElement.querySelector('span');
    if (!f) { img.hidden = true; return; }
    if (/^image\//.test(f.type)) { img.src = URL.createObjectURL(f); img.hidden = false; } else img.hidden = true;
    span.textContent = f.name.length > 28 ? f.name.slice(0, 25) + '…' : f.name;
  }));
}
/** Upload whichever sides were chosen. Returns { id_doc_path?, id_doc_back_path? } */
export async function uploadIdSides(root, folder) {
  const out = {};
  for (const [name, key] of [['id_file', 'id_doc_path'], ['id_file_back', 'id_doc_back_path']]) {
    const f = root.querySelector(`[name=${name}]`)?.files?.[0];
    if (!f) continue;
    const small = await compressImage(f);
    out[key] = await uploadIdDoc(`${folder}/${newId()}.${small.type === 'application/pdf' ? 'pdf' : 'jpg'}`, small);
  }
  return out;
}

export async function openIdDoc(path) {
  const { data, error } = await sb.storage.from('guest-ids').createSignedUrl(path, 120);
  if (error) throw new Error(error.message);
  window.open(data.signedUrl, '_blank', 'noopener');
}

export function debounce(fn, ms = 300) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
export function downloadCsv(filename, rows) {
  const csv = rows.map((r) => r.map((v) => {
    const s = String(v ?? '');
    const risky = /^[=+@]|^-(?!\d)/.test(s);                      // block spreadsheet formulas
    return /[",\n]/.test(s) || risky ? `"${(risky ? "'" : '') + s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export const newId = () => (crypto.randomUUID ? crypto.randomUUID() : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g,
  (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));
export const param = (k) => new URLSearchParams(location.search).get(k);
export const uuidOk = (v) => /^[0-9a-f-]{36}$/i.test(v || '');
