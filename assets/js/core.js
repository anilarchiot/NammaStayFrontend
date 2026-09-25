// NammaStay — shared front-end core (ES module, no build step).
// Every page script imports from here.
const CFG = window.NAMMASTAY_CONFIG || {};
/** LIVE = connected to Supabase. Otherwise the in-browser demo backend runs with sample data. */
export const LIVE = !!(CFG.supabaseUrl && CFG.supabaseAnonKey);
export const DEMO = !LIVE;
export const sb = LIVE
  ? (await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm')).createClient(CFG.supabaseUrl, CFG.supabaseAnonKey)
  : (await import('./demo-backend.js')).createDemoClient();
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

async function boot(key) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    const here = location.pathname.split('/').pop() + location.search;
    location.replace('login.html?next=' + encodeURIComponent(here));
    throw new Stop();
  }
  const mems = await rpc('my_memberships');
  if (!mems?.length) {
    showFatal('Your login isn’t linked to a property yet. Ask the owner to add you in Settings → Users & roles.', { signIn: true });
    await sb.auth.signOut();
    throw new Stop();
  }
  const saved = localStorage.getItem('ns.property');
  const m = mems.find((x) => x.property_id === saved) || mems[0];
  localStorage.setItem('ns.property', m.property_id);
  const ctx = {
    user: session.user, memberships: mems,
    property_id: m.property_id, property_name: m.property_name, role: m.role,
    name: m.display_name || session.user.email,
    can: (...roles) => roles.includes(m.role),
  };
  applyChrome(ctx);
  const allowed = PAGE_ROLES[key];
  if (allowed && !allowed.includes(ctx.role)) {
    showFatal('Your role doesn’t have access to this page.');
    throw new Stop();
  }
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
  if (!['owner', 'manager', 'front_desk'].includes(ctx.role)) {
    $$('a[href="check-in.html"]').forEach((a) => { a.style.display = 'none'; });
  }
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

function demoBadge() {
  const host = $('.ns-sidebar .ns-user') || $('.ns-sidebar');
  if (!host || $('.ns-demo-badge')) return;
  const el = document.createElement('div');
  el.className = 'ns-demo-badge';
  el.innerHTML = '<b>Demo mode</b> · sample data saved in this browser. <button type="button">Reset</button>';
  el.querySelector('button').addEventListener('click', async () => {
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
