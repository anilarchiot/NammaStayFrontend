import { sb as realSb, configured as realConfigured, esc, inr, photoUrl } from './common.js';
import { demoSb } from './owner-demo.js';

const demo = new URLSearchParams(location.search).get('demo') === '1';
const sb = demo ? demoSb : realSb;
const configured = demo || realConfigured;

const app = document.getElementById('app');
const CFG = window.NAMMASTAY_CONFIG || {};
const note = (t, err) => `<div class="msg${err ? ' err' : ''}">${esc(t)}</div>`;
const brand = (right = '') => `<div class="brand"><a class="brand-link" href="owner.html"><img class="brand-logo" src="logo.png" alt=""><span class="brand-word">Namma<b>Bookings</b></span></a>${right}</div>`;
const svg = (d, w = 2) => `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;
const ICON = {
  eye: svg('<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  eyeOff: svg('<path d="M3 3l18 18M10.6 5.6A10 10 0 0 1 12 5.5C18.4 5.5 22 12 22 12a17 17 0 0 1-3.2 4M6.5 6.9A17 17 0 0 0 2 12s3.6 6.5 10 6.5c1.5 0 2.8-.3 4-.8"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 2.6),
  shield: svg('<path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>'),
  upi: svg('<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 15h4"/>'),
  list: svg('<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>'),
  receipt: svg('<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  upload: svg('<path d="M12 16V5M7.5 9.5L12 5l4.5 4.5M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2"/>'),
  back: svg('<path d="M15 5l-7 7 7 7"/>'),
  bed: svg('<path d="M3 18V7M3 13h18v5M21 13v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="10.5" r="1.5"/>')
};
if (window.Capacitor?.isNativePlatform?.()) document.body.classList.add('is-native');
const fmtD = (s) => new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtM = (s) => new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
const left = (iso) => { const m = Math.max(0, Math.round((new Date(iso) - Date.now()) / 6e4)); return `${Math.floor(m / 60)} h ${m % 60} m`; };
const monthStart = (off = 0) => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + off, 1, 12).toISOString().slice(0, 10); };
const safeFile = (f) => f.type.startsWith('image/') && f.size <= 8 * 1024 * 1024;

let user = null, listings = [], cur = null, tab = 'requests', publicSettings = null, map = null, pin = null;

async function uploadAll(files) {
  const out = [];
  for (const file of files) {
    if (!safeFile(file)) throw new Error('Photos must be images under 8 MB.');
    const path = `${user.id}/${crypto.randomUUID()}.${(file.name.split('.').pop() || 'jpg').replace(/[^a-z0-9]/gi, '').slice(0, 5)}`;
    const up = await sb.storage.from('mk-photos').upload(path, file, { contentType: file.type });
    if (up.error) throw up.error;
    out.push(sb.storage.from('mk-photos').getPublicUrl(path).data.publicUrl);
  }
  return out;
}

async function init() {
  if (!configured) { app.innerHTML = brand() + note('Not connected yet — set the Supabase keys in config.js.', true); return; }
  try {
    const { data } = await sb.auth.getSession();
    user = data.session?.user ?? null;
    publicSettings = await sb.rpc('mk2_public_settings').then((r) => r.data, () => null);
  } catch { user = null; }
  if (!user) return signIn();
  await load();
}

async function load() {
  app.classList.remove('wide');
  const { data, error } = await sb.rpc('mk2_my_listings');
  if (error) { app.innerHTML = brand() + note(error.message, true); return; }
  listings = data;
  cur = listings.find((l) => l.id === cur?.id) || listings[0] || null;
  if (!cur) return form();
  if (cur.review_status !== 'approved') return pending();
  render();
}

const offerCards = () => {
  const s = publicSettings || { fee_pct: 9, launch_until: '2027-03-31' };
  return `<div class="offers" role="list">
    <div class="card dark offer" role="listitem"><div class="kick">Launch offer</div><b>0%</b><div class="mute">commission until ${fmtD(s.launch_until)}</div></div>
    <div class="card offer" role="listitem"><div class="kick">After that</div><b>${s.fee_pct}%</b><div class="mute">only for guests NammaStay brings who stay. PG: of the first month's rent, once.</div></div>
    <div class="card mint offer" role="listitem"><div class="kick">Subscribers</div><b>0%</b><div class="mute">always, plus live beds and the full app</div></div></div>`;
};

// ------------------------------------------------------------------ sign in
function signIn() {
  let reg = false, email = '';
  app.classList.add('wide');
  const draw = () => {
    app.innerHTML = `${brand('<a class="small" href="stays.html">Find a stay</a>')}
      <div class="auth-shell">
        <section class="auth-intro">
          <span class="auth-eyebrow"><i></i> Free for hostels and PGs</span>
          <h1 class="big">List your hostel or PG free</h1>
          <p class="auth-sub">Get bookings from guests on NammaStay Search. Guests pay you at the property.</p>
          ${offerCards()}
          <ul class="auth-points">
            <li><span>${ICON.bed}</span><div><b>Free beds, live</b><small>Keep your calendar in step and take requests any time.</small></div></li>
            <li><span>${ICON.upi}</span><div><b>One bill a month</b><small>Pay by UPI. No advance, no card fees.</small></div></li>
            <li><span>${ICON.shield}</span><div><b>Verified badge</b><small>We check your photos, address and phone on a short video call.</small></div></li>
          </ul>
        </section>
        <form class="card auth-card" id="f">
          <div class="seg" id="mode" role="group" aria-label="Sign in or create an account"><button type="button" data-m="in" class="${reg ? '' : 'on'}">Sign in</button><button type="button" data-m="up" class="${reg ? 'on' : ''}">Create account</button></div>
          <h2 class="auth-title">${reg ? 'Create your owner account' : 'Welcome back'}</h2>
          <p class="auth-lead">${reg ? 'It takes a minute. You add your property next.' : 'Sign in to manage your listing, requests and bills.'}</p>
          ${reg ? `<div class="two"><div><label for="nm">Your name</label><input id="nm" name="name" required minlength="2" autocomplete="name" placeholder="Full name"></div>
            <div><label for="ph">Phone (guests' WhatsApp)</label><input id="ph" name="phone" type="tel" inputmode="tel" required pattern="[0-9+ -]{8,16}" autocomplete="tel" placeholder="+91 98400 12345"></div></div>` : ''}
          <label for="em">Email</label><input id="em" name="email" type="email" inputmode="email" required autocomplete="email" autocapitalize="none" spellcheck="false" placeholder="you@example.com" value="${esc(email)}">
          <label for="pw">Password</label>
          <div class="pw-field"><input id="pw" name="password" type="password" required minlength="8" autocomplete="${reg ? 'new-password' : 'current-password'}" placeholder="${reg ? 'At least 8 characters' : 'Your password'}"><button type="button" class="pw-toggle" aria-label="Show password" aria-pressed="false">${ICON.eye}</button></div>
          <div id="m" role="status" aria-live="polite"></div>
          <div class="auth-actions"><button class="btn block" id="go">${reg ? 'Create account' : 'Sign in'}</button></div>
          <a class="auth-demo" href="owner.html?demo=1">Try the demo, no sign-in needed</a>
          <p class="auth-foot">${reg ? 'Have an account?' : 'New owner?'} <a href="#" id="t">${reg ? 'Sign in' : 'Create an account'}</a></p>
        </form>
      </div>`;
    const swap = (to) => { email = app.querySelector('#em').value; reg = to; draw(); };
    app.querySelectorAll('#mode button').forEach((b) => b.onclick = () => { if ((b.dataset.m === 'up') !== reg) swap(b.dataset.m === 'up'); });
    app.querySelector('#t').onclick = (e) => { e.preventDefault(); swap(!reg); };
    const pw = app.querySelector('#pw'), tg = app.querySelector('.pw-toggle');
    tg.onclick = () => {
      const show = pw.type === 'password';
      pw.type = show ? 'text' : 'password';
      tg.innerHTML = show ? ICON.eyeOff : ICON.eye;
      tg.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      tg.setAttribute('aria-pressed', String(show));
    };
    app.querySelector('#f').onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target), m = app.querySelector('#m'), go = app.querySelector('#go');
      if (reg) { go.hidden = true; go.parentElement.hidden = true; } else { go.disabled = true; go.textContent = 'Signing in…'; }
      m.innerHTML = '';
      let res;
      try {
        res = reg
          ? await sb.auth.signUp({ email: f.get('email'), password: f.get('password'), options: { data: { name: f.get('name'), phone: f.get('phone') } } })
          : await sb.auth.signInWithPassword({ email: f.get('email'), password: f.get('password') });
      } catch (err) { res = { error: err }; }
      if (reg) {
        if (res.error || !res.data?.user) return (m.innerHTML = note('Account not created. Please contact NammaStay support.', true));
        if (!res.data.session) {
          m.innerHTML = note('Account created. We sent a confirmation link to ' + esc(String(f.get('email'))) + '. Open it, then sign in. Check spam if you do not see it.') + '<button type="button" class="auth-resend" id="rs">Resend confirmation email</button>';
          app.querySelector('#rs').onclick = async (ev) => {
            const b = ev.currentTarget; b.disabled = true; b.textContent = 'Sending…';
            const r = await sb.auth.resend({ type: 'signup', email: String(f.get('email')) }).catch((x) => ({ error: x }));
            b.disabled = false; b.textContent = 'Resend confirmation email';
            m.querySelector('.auth-resend-msg')?.remove();
            b.insertAdjacentHTML('beforebegin', '<div class="auth-resend-msg">' + (r.error ? note('Email could not be sent. Please contact NammaStay support.', true) : note('Confirmation email sent again.')) + '</div>');
          };
          return;
        }
      } else {
        go.disabled = false; go.textContent = 'Sign in';
        if (res.error) return (m.innerHTML = note(res.error.message, true));
      }
      user = res.data.session.user;
      await load();
    };
  };
  draw();
}

const signOut = async () => { if (demo) { location.href = 'owner.html'; return; } await sb.auth.signOut(); user = null; listings = []; cur = null; signIn(); };

// ------------------------------------------------------------------ list a property
function roomRow(r = {}) {
  const d = document.createElement('div');
  d.className = 'three room'; d.style.marginBottom = '8px';
  d.innerHTML = `<input class="rn" placeholder="e.g. 8-Bed Dorm" value="${esc(r.name || '')}" required aria-label="Room name"><input class="rb" type="number" min="1" max="200" placeholder="beds" value="${esc(r.beds || '')}" required aria-label="Beds">
    <input class="rp" type="number" min="1" placeholder="₹ price" value="${esc(r.price || '')}" required aria-label="Price in rupees"><label class="check" style="grid-column:1/-1;margin:0;font-weight:500"><input type="checkbox" class="rw"> Women-only room</label>`;
  return d;
}

function form() {
  app.classList.add('wide');
  const back = cur ? '<a class="small" href="#" id="bk">Back to dashboard</a>' : '';
  app.innerHTML = `${demo ? '<div class="demo-banner"><b>Demo mode</b> · sample form, nothing is saved. <a href="owner.html">Exit demo</a></div>' : ''}${brand(`${back}<a class="small" href="#" id="so">Sign out</a>`)}
    <div class="list-shell">
      <section class="list-main">
        <span class="auth-eyebrow"><i></i> Free listing</span>
        <h1 class="big">List your hostel or PG free</h1>
        <p class="auth-sub">Five short steps. The NammaStay team checks it on a short video call, then you go live with a Verified badge.</p>
        <form class="card list-card" id="f">
          <div class="seg" id="kind" role="group" aria-label="Property type"><button type="button" data-k="hostel" class="on">Backpacker hostel · per night</button><button type="button" data-k="pg">PG · per month</button></div>
          <section class="step"><h3><span class="n">1</span> Property</h3>
            <label for="t">Property name</label><input id="t" name="title" required minlength="3" placeholder="e.g. Blue Door Hostel">
            <div class="two"><div><label for="o">Your name</label><input id="o" name="owner" required value="${esc(user.user_metadata?.name || '')}"></div><div><label for="p">Phone (guests' WhatsApp)</label><input id="p" name="phone" type="tel" required pattern="[0-9+ -]{8,16}" value="${esc(user.user_metadata?.phone || '')}"></div></div>
            <div class="two"><div><label for="c">City</label><input id="c" name="city" required placeholder="Chennai"></div><div><label for="a">Area</label><input id="a" name="area" placeholder="Mylapore"></div></div>
            <label for="ad">Address</label><input id="ad" name="address" required minlength="8" placeholder="Street, area, city, PIN">
            <label>Drop a pin on the map <span class="mute">(tap the map, or <a href="#" id="loc">use my location</a>)</span></label><div id="pin" class="pin"></div></section>
          <section class="step"><h3><span class="n">2</span> Photos <span class="mute">at least 5 real photos</span></h3>
            <label class="drop" for="ph"><span class="drop-ico">${ICON.upload}</span><b>Add photos</b><small id="pc">JPG or PNG, up to 8 MB each</small></label>
            <input id="ph" class="sr-only" type="file" name="photos" accept="image/*" multiple ${demo ? '' : 'required'}></section>
          <section class="step"><h3><span class="n">3</span> Rooms and prices</h3><div id="rooms"></div><a href="#" id="add" class="add-room">${ICON.plus} Add another room type</a></section>
          <section class="step"><h3><span class="n">4</span> Keep your free beds up to date</h3>
            <input name="ical" type="url" aria-label="Calendar link" placeholder="Paste your calendar link (iCal) from Booking.com, Airbnb or your software">
            <div class="mute">Want live beds and instant booking? Use the NammaStay app.</div></section>
          <section class="step"><h3><span class="n">5</span> Proof it's yours</h3>
            <input name="proof" aria-label="Proof" required minlength="5" placeholder="GST number, or the owner's ID number">
            <label for="ab">About <span class="mute">(optional)</span></label><textarea id="ab" name="about" maxlength="600" placeholder="The vibe, what's nearby, house rules"></textarea></section>
          <div id="m"></div>
          <div class="auth-actions"><button class="btn block">Submit for checking</button></div>
        </form>
      </section>
      <aside class="list-side">${offerCards()}
        <ul class="auth-points">
          <li><span>${ICON.bed}</span><div><b>Free beds, live</b><small>Keep your calendar in step and take requests any time.</small></div></li>
          <li><span>${ICON.upi}</span><div><b>One bill a month</b><small>Pay by UPI. No advance, no card fees.</small></div></li>
          <li><span>${ICON.shield}</span><div><b>Verified badge</b><small>We check your photos, address and phone on a short video call.</small></div></li>
        </ul>
      </aside>
    </div>`;
  app.querySelector('#bk')?.addEventListener('click', (e) => { e.preventDefault(); load(); });
  app.querySelector('#so').onclick = (e) => { e.preventDefault(); signOut(); };
  const rooms = app.querySelector('#rooms'); rooms.append(roomRow());
  app.querySelector('#add').onclick = (e) => { e.preventDefault(); rooms.append(roomRow()); };
  let kind = 'hostel';
  app.querySelectorAll('#kind button').forEach((b) => b.onclick = () => { kind = b.dataset.k; app.querySelectorAll('#kind button').forEach((x) => x.classList.toggle('on', x === b)); app.querySelectorAll('.rp').forEach((i) => (i.placeholder = kind === 'pg' ? '₹ per month' : '₹ per night')); });
  app.querySelector('[name=photos]').onchange = (e) => (app.querySelector('#pc').textContent = e.target.files.length ? `${e.target.files.length} photo(s) chosen` : 'JPG or PNG, up to 8 MB each');
  pin = null;
  map = L.map('pin').setView([13.0827, 80.2707], 11);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(map);
  const place = (ll) => { pin = ll; if (map._m) map._m.setLatLng(ll); else map._m = L.marker(ll).addTo(map); };
  map.on('click', (e) => place(e.latlng));
  app.querySelector('#loc').onclick = (e) => { e.preventDefault(); navigator.geolocation?.getCurrentPosition((p) => { const ll = L.latLng(p.coords.latitude, p.coords.longitude); place(ll); map.setView(ll, 15); }, () => (app.querySelector('#m').innerHTML = note('Could not get your location — tap the map instead.', true))); };
  app.querySelector('#f').onsubmit = async (e) => {
    e.preventDefault();
    const fm = e.target, f = new FormData(fm), m = app.querySelector('#m'), btn = fm.querySelector('button.btn.block');
    const rs = [...fm.querySelectorAll('.room')].map((r) => ({ name: r.querySelector('.rn').value.trim(), beds: Number(r.querySelector('.rb').value), rate_paise: Math.round(Number(r.querySelector('.rp').value) * 100), women_only: r.querySelector('.rw').checked }));
    if (!demo && fm.photos.files.length < 5) return (m.innerHTML = note('Add at least 5 real photos.', true));
    if (!pin && !demo) return (m.innerHTML = note('Tap the map to drop a pin on your property.', true));
    if (demo) { cur = { id: 'demo-new', kind, title: f.get('title'), city: f.get('city'), review_status: 'pending' }; map.remove(); map = null; return pending(); }
    btn.disabled = true; btn.textContent = 'Uploading photos…';
    try {
      const photos = await uploadAll(fm.photos.files);
      const { error } = await sb.rpc('mk2_create_listing', { p: { kind, title: f.get('title'), city: f.get('city'), area: f.get('area'), address: f.get('address'), lat: pin.lat, lng: pin.lng,
        owner_name: f.get('owner'), owner_phone: f.get('phone'), photos, proof: f.get('proof'), ical_url: f.get('ical'), description: f.get('about'), rooms: rs } });
      if (error) throw error;
      map.remove(); map = null; await load();
    } catch (err) { m.innerHTML = note(err.message, true); btn.disabled = false; btn.textContent = 'Submit for checking'; }
  };
}

function pending() {
  const l = cur, changes = l.review_status === 'changes', rej = l.review_status === 'rejected';
  app.classList.add('wide');
  app.innerHTML = `${demo ? '<div class="demo-banner"><b>Demo mode</b> · this is what an owner sees after submitting. <a href="owner.html">Exit demo</a></div>' : ''}${brand('<a class="small" href="#" id="so">Sign out</a>')}
    <div class="pending-shell"><div class="card ${changes ? 'amber' : rej ? '' : 'mint'}"><div class="kick">${esc(l.kind === 'pg' ? 'PG' : 'Hostel')} · ${esc(l.city)}</div><h2>${esc(l.title)}</h2>
      <h3>${changes ? 'Changes asked' : rej ? 'Not approved' : 'Your listing is being checked'}</h3>
      <p>${changes ? 'The NammaStay team asked for a change. Update it and we will look again.' : rej ? 'Sorry, we could not approve this listing.' : 'We check your photos, address and phone on a short video call. This usually takes a day.'}</p>
      ${l.admin_note ? `<div class="card" style="background:#fff"><b>Note from NammaStay:</b><br>${esc(l.admin_note)}</div>` : ''}
      ${l.call_at ? `<p><b>Video call:</b> ${esc(l.call_at)}</p>` : ''}</div>
    <button class="btn line block" id="ref">${demo ? 'Back to the demo dashboard' : 'Refresh'}</button>
    ${changes || rej ? '<button class="btn block" id="new" style="margin-top:10px">List it again with the changes</button>' : ''}</div>`;
  app.querySelector('#so').onclick = (e) => { e.preventDefault(); signOut(); };
  app.querySelector('#ref').onclick = load;
  app.querySelector('#new')?.addEventListener('click', form);
}

// ------------------------------------------------------------------ dashboard
function shell(body) {
  app.classList.add('wide');
  const tabs = [['requests', ICON.list, 'Requests'], ['listing', ICON.bed, 'Free beds'], ['bill', ICON.receipt, 'Bill']];
  app.innerHTML = `${demo ? '<div class="demo-banner"><b>Demo mode</b> · sample data, nothing is saved. <a href="owner.html">Exit demo</a></div>' : ''}
    ${brand('<a class="small" href="#" id="so">Sign out</a>')}
    <div class="dash-head"><div><h1 class="dash-title">${esc(cur.title)}</h1><div class="mute"><span class="live-dot"></span> On NammaStay Search · ${cur.verified ? 'Verified' : 'Live'}${cur.subscriber ? ' · Subscriber' : ''}</div></div>
      <div class="dash-actions">${listings.length > 1 ? `<select id="sw" aria-label="Property">${listings.map((l) => `<option value="${esc(l.id)}" ${l.id === cur.id ? 'selected' : ''}>${esc(l.title)}</option>`).join('')}</select>` : ''}<button class="btn line" id="lp">${ICON.plus} List a property</button></div></div>
    <div class="bar tabs"><div class="in" style="gap:0">${tabs.map(([k, i, n]) => `<button class="${tab === k ? 'on' : ''}" data-t="${k}"><span class="tab-ico">${i}</span>${n}</button>`).join('')}</div></div>
    <div id="body" class="dash-body">${body}</div>`;
  app.querySelector('#lp').onclick = () => form();
  app.querySelector('#so').onclick = (e) => { e.preventDefault(); signOut(); };
  app.querySelector('#sw')?.addEventListener('change', (e) => { cur = listings.find((l) => l.id === e.target.value); render(); });
  app.querySelectorAll('[data-t]').forEach((b) => b.onclick = () => { tab = b.dataset.t; render(); });
}

function render() { if (map) { map.remove(); map = null; } ({ requests, listing, bill }[tab])(); }

async function requests() {
  shell('<div class="msg">Loading…</div>');
  const s = publicSettings;
  const { data, error } = await sb.rpc('mk2_owner_requests', { p_listing: cur.id });
  const b = app.querySelector('#body');
  if (error) return (b.innerHTML = note(error.message, true));
  const today = new Date().toISOString().slice(0, 10);
  const fresh = data.filter((r) => r.status === 'new'), rest = data.filter((r) => r.status !== 'new');
  const ask = data.filter((r) => r.status === 'accepted' && r.type === 'stay' && r.stay_status === 'pending' && r.check_in <= today);
  const label = (r) => r.type === 'visit' ? `PG visit · ${new Date(r.visit_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}` : `${fmtD(r.check_in)} → ${fmtD(r.check_out)} · ${esc(r.room)}`;
  b.innerHTML = `<div class="card dark" style="padding:12px;font-weight:700"><span style="color:#F5C84C">Launch offer:</span> 0% commission until ${fmtD(s.launch_until)}.</div>
    <h3>Booking requests</h3>${fresh.length ? fresh.map((r) => `<div class="card new"><div class="row2"><b style="font-size:17px">${esc(r.guest_name)} · ${r.beds} bed${r.beds > 1 ? 's' : ''}</b><span class="pill amber">Reply in ${left(r.reply_by)}</span></div>
      <div class="mute">${label(r)}${r.type === 'stay' ? ` · ${inr(r.amount_paise)} at the ${cur.kind === 'pg' ? 'PG' : 'hostel'}` : ''}</div>${r.women_only ? '<span class="pill pink">Women only</span>' : ''}
      <div class="row2" style="margin-top:10px"><button class="btn" style="flex:1" data-a="${esc(r.id)}">Accept</button><button class="btn ghost" style="flex:1" data-d="${esc(r.id)}">Can't take it</button>
        <a class="btn ghost" target="_blank" rel="noopener" aria-label="WhatsApp ${esc(r.guest_name)}" href="https://wa.me/${String(r.guest_phone).replace(/\D/g, '').replace(/^(\d{10})$/, '91$1')}">💬</a></div></div>`).join('') : '<div class="card mute">No new requests.</div>'}
    ${ask.length ? `<h3>Did they stay?</h3>${ask.map((r) => `<div class="card"><div class="row2"><b>${esc(r.guest_name)}</b><span class="mute">${fmtD(r.check_in)} → ${fmtD(r.check_out)}</span></div><div class="mute">${r.beds} bed · ${inr(r.amount_paise)}</div>
      <div class="two" style="margin-top:8px"><button class="btn line" data-s="${esc(r.id)}">Yes, stayed</button><button class="btn ghost" data-n="${esc(r.id)}">No-show</button></div>
      <div class="mute">No-shows and cancellations are never billed. No answer 2 days after check-out counts as stayed.</div></div>`).join('')}` : ''}
    ${rest.length ? `<h3>Earlier</h3>${rest.map((r) => `<div class="card" style="${['ended', 'cancelled', 'declined'].includes(r.status) ? 'background:#F5EEDB' : ''}"><div class="row2"><b>${esc(r.guest_name)} · ${r.beds} bed${r.beds > 1 ? 's' : ''}</b>
      <span class="pill ${r.status === 'accepted' ? 'green' : ''}">${{ accepted: r.stay_status === 'stayed' ? 'Stayed' : r.stay_status === 'no_show' ? 'No-show' : 'Accepted', ended: 'Ended', declined: 'Declined', cancelled: 'Cancelled' }[r.status]}</span></div><div class="mute">${label(r)}</div></div>`).join('')}` : ''}`;
  const act = (sel, fn) => b.querySelectorAll(sel).forEach((el) => el.onclick = async () => {
    el.disabled = true;
    const { error: e } = await fn(el);
    if (e) { alert(e.message); el.disabled = false; } else requests();
  });
  act('[data-a]', (el) => sb.rpc('mk2_respond', { p_request: el.dataset.a, p_accept: true }));
  act('[data-d]', (el) => sb.rpc('mk2_respond', { p_request: el.dataset.d, p_accept: false }));
  act('[data-s]', (el) => sb.rpc('mk2_mark_stay', { p_request: el.dataset.s, p_stayed: true }));
  act('[data-n]', (el) => sb.rpc('mk2_mark_stay', { p_request: el.dataset.n, p_stayed: false }));
}

async function listing() {
  shell('<div class="msg">Loading…</div>');
  const { data: rv } = await sb.rpc('mk2_owner_reviews', { p_listing: cur.id });
  const b = app.querySelector('#body');
  let tours = [...(cur.tour_photos || [])];
  const draw = () => {
    b.innerHTML = `<form id="f"><div class="card"><h3>Rooms</h3>${cur.rooms.map((r) => `<div class="row2" style="margin:10px 0"><div><b>${esc(r.name)}</b><div class="mute">${r.beds} beds · ${inr(r.rate_paise)}</div></div>
        <label class="row2" style="margin:0;gap:8px">Women only <input type="checkbox" class="tog" data-w="${esc(r.id)}" ${r.women_only ? 'checked' : ''}></label></div>`).join('')}
        <div class="mute">Women-only dorms get a badge and show in the women-only filter. Guests confirm all of them are women; you check ID at check-in.</div></div>
      <div class="card"><h3>360° view inside</h3><p class="mute">Guests drag to look around each room. Up to 6 photos.</p><div class="thumb-l">${tours.map((t, i) => `<div class="it" style="background-image:url('${esc(photoUrl(t))}')"><button type="button" data-x="${i}" aria-label="Remove">×</button></div>`).join('')}</div>
        <label>Add 360° photos</label><input type="file" id="tp" accept="image/*" multiple><label>Google Maps 360° tour link</label><input name="tour" type="url" placeholder="https://maps.app.goo.gl/…" value="${esc(cur.tour_url || '')}"></div>
      <div class="card"><h3>Your traveller community</h3><p class="mute">Guests see these after you accept their request.</p>
        <label>WhatsApp community or group link</label><input name="wa" type="url" placeholder="https://chat.whatsapp.com/…" value="${esc(cur.whatsapp_url || '')}"><label>Instagram</label><input name="ig" placeholder="@yourhostel" maxlength="60" value="${esc(cur.instagram || '')}"></div>
      <div id="m"></div><button class="btn block">Save</button></form>
      <div class="card" style="margin-top:14px"><div class="row2"><h3>Reviews</h3><b>${cur.rating?.avg ? '★ ' + cur.rating.avg + ' · ' : ''}${cur.rating?.count || 0}</b></div>
        ${(rv || []).length ? rv.map((r) => `<div class="rv"><div class="row2"><b>${esc(r.name)}${r.city ? ', ' + esc(r.city) : ''} · <span class="stars">${'★'.repeat(r.stars)}</span></b><span class="mute">${new Date(r.at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</span></div>
          ${r.body ? `<div>${esc(r.body)}</div>` : ''}<div class="row2" style="margin-top:6px"><input data-rp="${esc(r.id)}" placeholder="Reply to this review" value="${esc(r.reply || '')}" maxlength="1000"><button type="button" class="btn ghost sm" data-rb="${esc(r.id)}">Reply</button></div></div>`).join('') : '<p class="mute">No reviews yet.</p>'}
        <div class="mute">Only guests who stayed can review. Stars show on Search after ${3} reviews. You can reply to any review; the NammaStay team removes abusive ones.</div></div>`;
    b.querySelectorAll('[data-x]').forEach((x) => x.onclick = () => { tours.splice(Number(x.dataset.x), 1); draw(); });
    b.querySelectorAll('[data-rb]').forEach((x) => x.onclick = async () => {
      const { error } = await sb.rpc('mk2_owner_reply_review', { p_review: x.dataset.rb, p_reply: b.querySelector(`[data-rp="${x.dataset.rb}"]`).value });
      x.textContent = error ? 'Failed' : 'Saved ✓'; if (error) alert(error.message);
    });
    b.querySelector('#f').onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target), m = b.querySelector('#m'), btn = e.target.querySelector('.btn.block'); btn.disabled = true;
      try {
        const files = b.querySelector('#tp').files;
        if (tours.length + files.length > 6) throw new Error('Up to 6 360° photos.');
        tours = [...tours, ...(files.length ? await uploadAll(files) : [])];
        const women = {}; b.querySelectorAll('[data-w]').forEach((c) => (women[c.dataset.w] = c.checked));
        const { error } = await sb.rpc('mk2_owner_save', { p_listing: cur.id, p_women: women, p_tour_photos: tours, p_tour_url: f.get('tour'), p_whatsapp: f.get('wa'), p_instagram: f.get('ig') });
        if (error) throw error;
        await load(); tab = 'listing'; render();
      } catch (err) { m.innerHTML = note(err.message, true); btn.disabled = false; }
    };
  };
  draw();
}

async function bill() {
  shell('<div class="msg">Loading…</div>');
  const b = app.querySelector('#body');
  const months = [monthStart(0), monthStart(-1), monthStart(-2)];
  let sel = months[0];
  const draw = async () => {
    const { data: x, error } = await sb.rpc('mk2_owner_bill', { p_listing: cur.id, p_month: sel });
    if (error) return (b.innerHTML = note(error.message, true));
    const yearly = x.yearly_plan_paise / 100, perMonth = Math.round(yearly / 12);
    const breakEven = Math.round(perMonth / (x.fee_pct / 100));
    const would = x.would_be_fee_paise;
    b.innerHTML = `<div class="chips">${months.map((m) => `<button class="chip ${m === sel ? 'on' : ''}" data-m="${m}">${fmtM(m)}</button>`).join('')}</div>
      <div class="card dark"><div class="kick" style="color:#F5C84C">${fmtM(x.month)}</div><div style="font:800 34px Sora">${x.waived ? '₹0' : inr(x.fee_paise)} to pay</div>
        <div class="mute">NammaStay Search brought ${x.count} stay${x.count === 1 ? '' : 's'} worth ${inr(x.value_paise)}.${x.waived ? ` ${x.subscriber ? 'Subscriber: 0% always.' : `Launch offer: 0% until ${fmtD(x.launch_until)}.`}` : ''}</div></div>
      ${x.waived && would > 0 && !x.subscriber ? `<div class="card"><b>The launch offer saved you ${inr(would)} this month</b><div class="mute">From ${fmtD(addDay(x.launch_until))}, free listings pay ${x.fee_pct}% of stays from NammaStay Search. Subscribers pay 0%.</div></div>` : ''}
      <div class="card"><b>When is the yearly plan cheaper?</b><div class="mute">The yearly plan (${inr(x.yearly_plan_paise)} a year, about ₹${perMonth.toLocaleString('en-IN')} a month) costs less than ${x.fee_pct}% once NammaStay Search brings you about ₹${breakEven.toLocaleString('en-IN')} a month.</div>
        <div style="height:10px;background:#EFE6CB;border-radius:6px;margin:10px 0 4px"><div style="height:100%;width:${Math.min(100, Math.round((x.value_paise / 100 / breakEven) * 100))}%;background:#B9761A;border-radius:6px"></div></div>
        <div class="row2 mute"><span>This month ${inr(x.value_paise)}</span><span>₹${breakEven.toLocaleString('en-IN')}</span></div></div>
      <div class="card"><div class="row2"><h3>${fmtM(x.month)}</h3><span class="pill ${{ paid: 'green', waived: 'green', utr: 'amber', open: 'amber', overdue: 'red' }[x.status]}">${{ paid: 'Paid', waived: 'Nothing to pay', utr: 'UTR sent · confirming', open: 'Due ' + fmtD(x.due), overdue: 'Overdue' }[x.status]}</span></div>
        <div class="mute">Guests from NammaStay Search who stayed</div>
        <table class="tbl">${x.stays.map((s) => `<tr><td>${esc(s.name)} · ${s.nights} night${s.nights > 1 ? 's' : ''}</td><td class="r">${inr(s.amount_paise)}</td></tr>`).join('') || '<tr><td class="mute">No stays this month.</td></tr>'}
          ${x.no_shows ? `<tr><td class="mute">${x.no_shows} no-show (never billed)</td><td class="r">₹0</td></tr>` : ''}
          <tr><td><b>Stays from NammaStay</b></td><td class="r"><b>${inr(x.value_paise)}</b></td></tr><tr><td><b>NammaStay fee · ${x.fee_pct}%</b></td><td class="r"><b>${inr(x.fee_paise)}</b></td></tr></table>
        ${['open', 'overdue'].includes(x.status) ? `<p>${CFG.upiId ? `<a class="btn block" href="upi://pay?pa=${encodeURIComponent(CFG.upiId)}&pn=NammaStay&am=${(x.fee_paise / 100).toFixed(2)}&cu=INR&tn=${encodeURIComponent('NammaStay fee ' + x.month.slice(0, 7))}">Pay ${inr(x.fee_paise)} by UPI</a>` : `<span class="mute">Pay ${inr(x.fee_paise)} by UPI to NammaStay.</span>`}</p>
          <form id="utr"><label>UPI transaction id (UTR)</label><input name="utr" required pattern="[0-9A-Za-z]{8,30}" placeholder="412345678901"><div id="um"></div><button class="btn line block" style="margin-top:8px">Send UTR</button></form>
          <div class="mute">NammaStay confirms the UTR. Unpaid ${10} days after the due date, the listing pauses until paid.</div>` : ''}
        ${x.status === 'utr' ? `<p class="mute">UTR ${esc(x.utr)} sent. NammaStay will confirm it.</p>` : ''}${x.status === 'paid' ? `<p class="mute">Paid ${new Date(x.paid_at).toLocaleDateString('en-IN')}. UTR ${esc(x.utr)}.</p>` : ''}</div>
      <div class="card"><b>How the bill works</b><ul class="mute" style="padding-left:18px"><li>${x.fee_pct}% only on guests NammaStay Search brought you, and only if they stayed.</li><li>PG: ${x.fee_pct}% of the first month's rent, once, after the tenant moves in.</li><li>Bill on the 1st, pay by the 7th.</li></ul></div>
      ${x.subscriber ? '' : '<div class="card mint"><b>Subscribe to NammaStay and pay 0%, always</b><div class="mute">Live beds, instant booking and the full hostel app.</div></div>'}`;
    b.querySelectorAll('[data-m]').forEach((c) => c.onclick = () => { sel = c.dataset.m; draw(); });
    b.querySelector('#utr')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const { error: er } = await sb.rpc('mk2_pay_utr', { p_listing: cur.id, p_month: x.month, p_utr: new FormData(e.target).get('utr') });
      if (er) b.querySelector('#um').innerHTML = note(er.message, true); else draw();
    });
  };
  draw();
}
const addDay = (s) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };

init();
