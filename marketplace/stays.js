import { sb, configured, esc, inr, photoUrl } from './common.js';

const app = document.getElementById('app');
const KEY = 'ns-requests';
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const todayS = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const fmt = (s) => new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const nightsOf = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
const saved = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
const remember = (r) => localStorage.setItem(KEY, JSON.stringify([r, ...saved().filter((x) => x.ref !== r.ref)].slice(0, 10)));
const note = (t, err) => `<div class="msg${err ? ' err' : ''}">${esc(t)}</div>`;
const brand = (right = '<a class="small" href="owner.html">For owners</a>') => `<div class="brand"><a class="brand-link" href="#/"><img class="brand-logo" src="logo.png" alt=""><span class="brand-word">Namma<b>Bookings</b></span></a>${right}</div>`;
// Place suggestions: cities, areas and property names from published listings, plus common cities.
const FALLBACK_PLACES = ['Chennai', 'Bengaluru', 'Pondicherry', 'Kochi', 'Hyderabad', 'Coimbatore', 'Madurai', 'Mysuru', 'Goa', 'Munnar', 'Ooty'].map((t) => ({ t, k: 'City' }));
let placesPromise = null;
const loadPlaces = () => placesPromise || (placesPromise = (async () => {
  const seen = new Map(FALLBACK_PLACES.map((p) => [p.t.toLowerCase(), p]));
  if (configured) {
    try {
      const { data } = await sb.rpc('mk2_search', { p_city: null, p_in: null, p_out: null, p_beds: 1, p_kind: null, p_women: false });
      (data || []).forEach((l) => {
        [[l.city, 'City'], [l.area ? `${l.area}${l.city ? ', ' + l.city : ''}` : '', 'Area'], [l.title, l.kind === 'pg' ? 'PG' : 'Hostel']].forEach(([t, k]) => {
          if (t && !seen.has(t.toLowerCase())) seen.set(t.toLowerCase(), { t, k });
        });
      });
    } catch { /* suggestions are optional */ }
  }
  return [...seen.values()];
})());

function setupSuggest(f) {
  const input = f.querySelector('#city'), list = f.querySelector('#city-list'), clear = f.querySelector('#clear-city');
  let items = [], active = -1;
  const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); active = -1; };
  const choose = (t) => { input.value = t; clear.hidden = false; close(); input.focus(); };
  const paint = () => list.querySelectorAll('li').forEach((li, i) => li.classList.toggle('on', i === active));
  const render = async () => {
    const q = input.value.trim().toLowerCase();
    clear.hidden = !input.value;
    const all = await loadPlaces();
    const starts = all.filter((p) => p.t.toLowerCase().startsWith(q));
    const rest = all.filter((p) => !p.t.toLowerCase().startsWith(q) && p.t.toLowerCase().includes(q));
    items = (q ? [...starts, ...rest] : all.filter((p) => p.k === 'City')).slice(0, 8);
    if (!items.length) return close();
    const hit = (t) => { const i = t.toLowerCase().indexOf(q); return q && i >= 0 ? `${esc(t.slice(0, i))}<mark>${esc(t.slice(i, i + q.length))}</mark>${esc(t.slice(i + q.length))}` : esc(t); };
    list.innerHTML = items.map((p, i) => `<li role="option" data-i="${i}"><span class="s-pin" aria-hidden="true">${ICON.pin}</span><span class="s-t">${hit(p.t)}</span><span class="s-k">${esc(p.k)}</span></li>`).join('');
    list.hidden = false; input.setAttribute('aria-expanded', 'true'); active = -1;
  };
  input.addEventListener('input', render);
  input.addEventListener('focus', render);
  input.addEventListener('keydown', (e) => {
    if (list.hidden) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % items.length; paint(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + items.length) % items.length; paint(); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); choose(items[active].t); }
    else if (e.key === 'Escape') close();
  });
  list.addEventListener('mousedown', (e) => {
    const li = e.target.closest('li');
    if (li) { e.preventDefault(); choose(items[Number(li.dataset.i)].t); }
  });
  clear.addEventListener('click', () => { input.value = ''; clear.hidden = true; close(); input.focus(); });
  document.addEventListener('click', (e) => { if (!f.contains(e.target)) close(); });
  loadPlaces();
}

const hasKids = (k) => k === 'hotel' || k === 'homestay';
const svg = (d, w = 2) => `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;
const ICON = {
  pin: svg('<path d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', 2.4),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>', 2.4),
  bed: svg('<path d="M3 18V7M3 13h18v5M21 13v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="10.5" r="1.5"/>'),
  rupee: svg('<path d="M7 5h10M7 9h10M7 5c5 0 7 2 7 4s-2 4-7 4l7 6"/>'),
  home: svg('<path d="M4 11l8-7 8 7M6 10v10h12V10"/><path d="M10 20v-5h4v5"/>')
};
const safeUrl = (u) => (/^https:\/\//i.test(u || '') ? u : '');
const waLink = (phone, text) => `https://wa.me/${String(phone || '').replace(/\D/g, '').replace(/^(\d{10})$/, '91$1')}?text=${encodeURIComponent(text)}`;

function parse() {
  const h = location.hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = h.split('?');
  return { path, q: new URLSearchParams(qs) };
}
const go = (path, q = {}) => {
  const p = new URLSearchParams(Object.entries(q).filter(([, v]) => v !== '' && v != null && v !== false));
  location.hash = '#' + path + (p.toString() ? '?' + p : '');
};

let map = null;
function route() {
  if (map) { map.remove(); map = null; }
  window.scrollTo(0, 0);
  if (!configured) { app.innerHTML = brand() + note('Not connected yet — set the Supabase keys in config.js.', true); return; }
  const { path, q } = parse();
  if (path.startsWith('/l/')) return listing(path.slice(3), q);
  if (path === '/results') return results(q);
  if (path === '/track') return track(q);
  return home(q);
}

// ------------------------------------------------------------------ search
async function home(q) {
  const kind = ['pg', 'hotel', 'homestay'].includes(q.get('kind')) ? q.get('kind') : 'hostel';
  const city = q.get('city') ?? 'Chennai';
  const inD = q.get('in') || addDays(todayS(), 1), outD = q.get('out') || addDays(todayS(), 3), beds = q.get('beds') || 1;
  const mine = saved();
  app.innerHTML = `${brand()}
    <h1 class="big">Backpacker hostels and PGs, booked direct.</h1>
    <p class="home-intro">Across South India. No booking fee. Pay at the property.</p>
    <form class="card search-card" id="f">
      <div class="seg" id="kind"><button type="button" data-k="hostel" class="${kind === 'hostel' ? 'on' : ''}">Hostel · per night</button><button type="button" data-k="pg" class="${kind === 'pg' ? 'on' : ''}">PG / hostel · monthly</button><button type="button" data-k="hotel" class="${kind === 'hotel' ? 'on' : ''}">Hotels</button><button type="button" data-k="homestay" class="${kind === 'homestay' ? 'on' : ''}">Homestays</button></div>
      <label class="search-label" for="city">Where</label>
      <div class="location-field"><span class="loc-ico" aria-hidden="true">${ICON.pin}</span><input id="city" name="city" value="${esc(city)}" placeholder="City, area or property" required autocomplete="off" role="combobox" aria-expanded="false" aria-controls="city-list" aria-autocomplete="list"><button type="button" class="clear-city" id="clear-city" aria-label="Clear location" ${city ? '' : 'hidden'}>${ICON.close}</button><ul class="suggest" id="city-list" role="listbox" hidden></ul></div>
      <div class="two search-meta">
        <div class="search-summary">
          <label id="l1" for="check-in">${kind === 'pg' ? 'Move-in' : 'Dates'}</label>
          <div class="date-pair"><input id="check-in" type="date" name="in" min="${todayS()}" value="${esc(inD)}" required>
            <span aria-hidden="true">→</span><span id="outw" ${kind === 'pg' ? 'hidden' : ''}><input type="date" name="out" min="${todayS()}" value="${esc(outD)}" aria-label="Check-out"></span></div>
          <div class="summary-note" id="night-count"></div>
        </div>
        <div class="search-summary">
          <label for="beds">${kind === 'pg' ? 'Beds' : 'Guests'}</label>
          <div class="guest-count"><input id="beds" type="number" name="beds" min="1" max="10" value="${esc(beds)}" aria-label="${hasKids(kind) ? 'Adults' : kind === 'pg' ? 'Beds' : 'Guests'}"><span id="bl">${hasKids(kind) ? 'adults' : kind === 'pg' ? 'beds' : 'guest'}</span></div>
          <div class="guest-count kids" id="kidw" ${hasKids(kind) ? '' : 'hidden'}><input id="kids" type="number" name="kids" min="0" max="10" value="${esc(q.get('kids') || 0)}" aria-label="Children"><span>children</span></div>
          <div class="summary-note" id="bed-count"></div>
        </div>
      </div>
      <div id="msg"></div>
      <button class="btn block search-submit"><span class="search-ico" aria-hidden="true">${ICON.search}</span> Search stays</button>
    </form>
    <div class="benefits">
      <div class="benefit"><span class="benefit-icon live-icon" aria-hidden="true">${ICON.bed}</span><div><b>Live beds and rooms</b><div class="mute">Straight from the property's own NammaStay calendar, so what you see is free.</div></div></div>
      <div class="benefit"><span class="benefit-icon fee-icon" aria-hidden="true">${ICON.rupee}</span><div><b>No booking fee</b><div class="mute">You pay the property's own price. Nothing added.</div></div></div>
      <div class="benefit"><span class="benefit-icon home-icon" aria-hidden="true">${ICON.home}</span><div><b>Pay at the property</b><div class="mute">No advance, unless the property asks for one.</div></div></div>
    </div>
    <div class="kick">Popular</div><div class="chips">${['Chennai', 'Pondicherry', 'Bengaluru', 'Kochi'].map((c) => `<button class="chip" data-c="${c}">${c}</button>`).join('')}</div>
    ${mine.length ? `<div class="kick" style="margin-top:12px">Your requests</div>${mine.map((r) => `<a class="card" style="display:block" href="#/track?ref=${esc(r.ref)}&phone=${encodeURIComponent(r.phone)}"><b>${esc(r.title)}</b><div class="mute">${esc(r.ref)}</div></a>`).join('')}` : ''}
    <p class="mute" style="text-align:center;margin-top:18px"><a href="#/track">Find a request</a> · <a href="owner.html">List your hostel or PG free</a></p>`;
  const f = app.querySelector('#f');
  let k = kind;
  const updateSummary = () => {
    const checkIn = f.querySelector('[name="in"]').value;
    const checkOut = f.querySelector('[name="out"]').value;
    const nights = checkIn && checkOut ? nightsOf(checkIn, checkOut) : 0;
    app.querySelector('#night-count').textContent = k === 'pg' ? 'Monthly stay' : nights > 0 ? `${nights} night${nights === 1 ? '' : 's'}` : '';
    const count = Number(f.querySelector('[name="beds"]').value) || 1;
    const kids = hasKids(k) ? Number(f.querySelector('[name="kids"]').value) || 0 : 0;
    app.querySelector('#bed-count').textContent = k === 'pg' || k === 'hostel' ? `${count} bed${count === 1 ? '' : 's'}` : `${count + kids} guest${count + kids === 1 ? '' : 's'}`;
  };
  updateSummary();
  f.querySelector('[name="in"]').addEventListener('change', updateSummary);
  f.querySelector('[name="out"]').addEventListener('change', updateSummary);
  f.querySelector('[name="beds"]').addEventListener('input', updateSummary);
  f.querySelector('[name="kids"]').addEventListener('input', updateSummary);
  app.querySelectorAll('#kind button').forEach((b) => b.onclick = () => {
    k = b.dataset.k; app.querySelectorAll('#kind button').forEach((x) => x.classList.toggle('on', x === b));
    app.querySelector('#outw').hidden = k === 'pg'; app.querySelector('#l1').textContent = k === 'pg' ? 'Move-in' : 'Dates';
    app.querySelector('label[for="beds"]').textContent = k === 'pg' ? 'Beds' : 'Guests';
    app.querySelector('#bl').textContent = hasKids(k) ? 'adults' : k === 'pg' ? 'beds' : 'guest'; app.querySelector('#kidw').hidden = !hasKids(k);
    updateSummary();
  });
  setupSuggest(f);
  app.querySelectorAll('[data-c]').forEach((b) => b.onclick = () => { f.city.value = b.dataset.c; f.requestSubmit(); });
  f.onsubmit = (e) => {
    e.preventDefault();
    const d = new FormData(f), i = d.get('in'), o = k === 'pg' ? addDays(i, 30) : d.get('out');
    if (!i || !o || o <= i) return app.querySelector('#msg').innerHTML = note('Pick a check-in and a later check-out date.', true);
    const adults = Math.max(1, Number(d.get('beds')) || 1), kids = hasKids(k) ? Math.max(0, Number(d.get('kids')) || 0) : 0, total = adults + kids;
    if (k === 'hotel' || k === 'homestay') {
      location.href = 'find.html?' + new URLSearchParams({ type: k, city: d.get('city') || '', in: i, out: o, guests: total, adults, kids });
      return;
    }
    go('/results', { city: d.get('city'), in: i, out: o, beds: total, kids, kind: k });
  };
}

// ------------------------------------------------------------------ results
async function results(q) {
  const city = q.get('city') || '', inD = q.get('in'), outD = q.get('out'), beds = Number(q.get('beds')) || 1, kids = Math.min(Number(q.get('kids')) || 0, beds - 1), kind = q.get('kind') || 'hostel';
  let women = q.get('women') === '1', liveOnly = q.get('live') === '1', asMap = q.get('map') === '1';
  app.innerHTML = `<div class="row2" style="margin-bottom:10px"><a class="btn ghost" href="#/?${new URLSearchParams({ city, in: inD || '', out: outD || '', beds: beds - kids, kids, kind })}" aria-label="Back">←</a>
      <div class="card" style="flex:1;margin:0;padding:10px 14px"><b style="font-size:18px">${esc(city || 'All cities')}</b><div class="mute">${inD ? `${fmt(inD)} → ${fmt(outD)} · ` : ''}${beds} bed${beds > 1 ? 's' : ''} · ${kind === 'pg' ? 'PG' : 'Hostel'}</div></div></div>
    <div class="chips"><button class="chip ${liveOnly ? 'on' : ''}" id="cl">Live beds</button><button class="chip ${women ? 'on' : ''}" id="cw">Women-only beds</button></div>
    <div id="out"><div class="msg">Searching…</div></div>`;
  const reload = (patch) => go('/results', { city, in: inD, out: outD, beds, kids, kind, women: women ? 1 : '', live: liveOnly ? 1 : '', map: asMap ? 1 : '', ...patch });
  app.querySelector('#cl').onclick = () => reload({ live: liveOnly ? '' : 1 });
  app.querySelector('#cw').onclick = () => reload({ women: women ? '' : 1 });
  const { data, error } = await sb.rpc('mk2_search', { p_city: city || null, p_in: inD || null, p_out: outD || null, p_beds: beds, p_kind: kind, p_women: women });
  const out = app.querySelector('#out');
  if (error) return out.innerHTML = note(error.message, true);
  const rows = liveOnly ? data.filter((l) => l.live) : data;
  const lq = new URLSearchParams({ in: inD || '', out: outD || '', beds });
  const head = `<div class="row2"><h2 style="font-size:20px">${rows.length} stay${rows.length === 1 ? '' : 's'} free on your dates</h2><button class="btn ghost sm" id="mt">${asMap ? 'List' : 'Map'}</button></div>`;
  const foot = `<p class="mute" style="text-align:center"><b>Live beds</b>: runs on NammaStay, book instantly. <b>Owner confirms</b>: the owner replies to your request.</p>`;
  if (!rows.length) { out.innerHTML = head + '<div class="card">No stays found. Try other dates, another city or remove a filter.</div>'; }
  else if (asMap) {
    out.innerHTML = head + '<div id="map" class="map"></div>' + foot;
    const pts = rows.filter((l) => l.lat != null && l.lng != null);
    map = L.map('map').setView(pts.length ? [pts[0].lat, pts[0].lng] : [13.08, 80.27], 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(map);
    pts.forEach((l) => L.marker([l.lat, l.lng]).addTo(map).bindPopup(`<b>${esc(l.title)}</b><br>from ${inr(l.from_paise)}<br><a href="#/l/${esc(l.id)}?${lq}">Open</a>`));
    if (pts.length > 1) map.fitBounds(pts.map((l) => [l.lat, l.lng]), { padding: [30, 30] });
    if (rows.length > pts.length) out.insertAdjacentHTML('beforeend', `<p class="mute">${rows.length - pts.length} stay(s) have no map pin — see the list.</p>`);
  } else {
    out.innerHTML = head + rows.map((l) => `
      <a class="stay" href="#/l/${esc(l.id)}?${lq}">
        <div class="img" style="${photoUrl(l.photo) ? `background-image:url('${esc(photoUrl(l.photo))}')` : ''}"><span class="pill ${l.live ? 'green' : 'amber'}">${l.live ? '● Live beds' : '◷ Owner confirms'}</span></div>
        <div class="body"><h3>${esc(l.title)} ${l.verified ? '<span class="pill blue">Verified</span>' : ''}</h3>
          <div class="mute">${l.kind === 'pg' ? 'PG' : 'Hostel'} · ${esc([l.area, l.city].filter(Boolean).join(', '))}${l.rating?.avg ? ` · ★ ${l.rating.avg} (${l.rating.count})` : ''}</div>
          <div>${l.women_only ? '<span class="pill pink">Women-only beds</span>' : ''}${l.has_tour ? '<span class="pill">360° view</span>' : ''}</div>
          <div class="row2" style="margin-top:6px"><b style="color:${l.live ? '#0F6B4A' : '#8A5A00'}">${l.free_beds} bed${l.free_beds === 1 ? '' : 's'} free · ${l.live ? 'Pay at property' : 'Request to book'}</b>
            <span>from <span class="price">${inr(l.from_paise)}</span><span class="mute"> /${l.kind === 'pg' ? 'month' : 'bed/night'}</span></span></div></div></a>`).join('') + foot;
  }
  app.querySelector('#mt').onclick = () => { asMap = !asMap; reload({ map: asMap ? 1 : '' }); };
}

// ------------------------------------------------------------------ listing page
async function listing(id, q) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return (app.innerHTML = brand() + note('Property not found.', true));
  const inD = q.get('in') || addDays(todayS(), 1);
  let outD = q.get('out') || addDays(inD, 2);
  const { data: l, error } = await sb.rpc('mk2_listing', { p_id: id, p_in: inD, p_out: outD });
  if (error || !l) return (app.innerHTML = brand() + note(error?.message || 'Property not found.', true));
  const isPg = l.kind === 'pg', nights = isPg ? 1 : Math.max(1, nightsOf(inD, outD));
  const photos = l.photos.map(photoUrl).filter(Boolean), tours = (l.tour_photos || []).map(photoUrl).filter(Boolean);
  const sel = { room: null, beds: Number(q.get('beds')) || 1 };
  const r0 = l.rooms.find((r) => r.free > 0 && (r.free ?? 1) >= sel.beds); if (r0) sel.room = r0.id;
  let cur = 0;
  const reviewCount = l.rating.count;

  const draw = () => {
    const room = l.rooms.find((r) => r.id === sel.room);
    const total = room ? room.rate_paise * sel.beds * (isPg ? 1 : nights) : 0;
    app.innerHTML = `<div class="hero-img" style="${photos[cur] ? `background-image:url('${esc(photos[cur])}')` : ''}"><a class="image-back" href="#/results?${new URLSearchParams({ city: l.city || '', in: inD, out: outD, beds: sel.beds, kind: l.kind })}" aria-label="Back to stays">←</a>${photos.length ? '' : '<div class="mute" style="padding:90px 0;text-align:center">No photos yet</div>'}
        ${tours.length || safeUrl(l.tour_url) ? '<button class="tour" id="tour">⟲ 360° view inside</button>' : ''}<span class="corner">${photos.length ? `${cur + 1} / ${photos.length} photos` : ''}</span></div>
      ${photos.length > 1 ? `<div class="thumbs">${photos.map((p, i) => `<img src="${esc(p)}" alt="" data-i="${i}" class="${i === cur ? 'on' : ''}">`).join('')}</div>` : ''}
      <div class="listing-heading"><span class="pill green"><span aria-hidden="true">●</span> ${l.live ? "Live from the host's own calendar" : 'Owner confirms your request'}</span><h1>${esc(l.title)} ${l.verified ? '<span class="pill blue">Verified</span>' : ''}</h1>
      ${l.rating.avg ? `<div><b>★ ${l.rating.avg}</b> · ${reviewCount} verified stays</div>` : reviewCount ? `<div class="mute">${reviewCount} review${reviewCount > 1 ? 's' : ''} so far</div>` : ''}
      <div class="mute">${isPg ? 'PG' : 'Hostel'} · ${esc([l.area, l.city, l.state].filter(Boolean).join(', '))}</div>
      <div class="amenities">${(l.amenities || []).map((a) => `<span class="pill">${esc(a)}</span>`).join('')}</div></div>
      <div class="card bed-picker"><div class="row2"><b>${isPg ? 'Choose a room' : 'Pick your bed'}</b><span class="mute">${isPg ? `Move-in ${fmt(inD)}` : `${fmt(inD)} → ${fmt(outD)}`}</span></div>
        <div style="margin-top:10px">${l.rooms.map((r) => `<div class="bed ${r.id === sel.room ? 'sel' : ''} ${r.free === 0 ? 'off' : ''}" data-r="${esc(r.id)}">
          <div><b>${esc(r.name)}</b> ${r.women_only ? '<span class="pill pink">Women only</span>' : ''}<div class="mute">${r.free === 0 ? 'Full on these dates' : r.free === 1 ? '<span style="color:#B42318">Last bed</span>' : `${r.free} free`}${r.features ? ' · ' + esc(r.features) : ''}</div>
            ${r.women_only ? '<div class="mute">Only women can book these beds. The hostel checks ID at check-in.</div>' : ''}</div>
          <div class="qty"><b>${inr(r.rate_paise)}</b>${r.id === sel.room ? `<button data-q="-1" aria-label="Fewer">−</button><b>${sel.beds}</b><button data-q="1" aria-label="More">+</button>` : r.free === 0 ? '' : '<span class="btn line sm">Select</span>'}</div></div>`).join('')}</div>
        <div class="mute">${isPg ? 'Monthly rent per bed.' : 'Price per bed, per night.'}</div></div>
      ${l.description ? `<h3>About</h3><p>${esc(l.description)}</p>` : ''}
      <h3>Good to know</h3><ul class="guest-info"><li><b>Bring your ID.</b> Aadhaar, passport or driving licence.</li><li><b>Travelling from abroad?</b> Bring your passport and visa. The hostel files your Form C.</li><li><b>Pay at the ${isPg ? 'PG' : 'hostel'}.</b> Cash or UPI when you arrive. No advance.</li>
        <li><b>Cancellation:</b> ${esc(l.cancellation || "the owner's own policy")}</li></ul>
      ${isPg ? '<button class="btn line block" id="visit">Schedule a visit first</button>' : ''}
      <h3>Reviews ${l.rating.avg ? `<span class="mute">★ ${l.rating.avg} · ${reviewCount} verified stays</span>` : ''}</h3>
      ${l.reviews.length ? l.reviews.map((v) => `<div class="rv"><div class="row2"><b>${esc(v.name)}${v.city ? ', ' + esc(v.city) : ''}</b><span class="pill green">Verified stay</span></div><div class="stars">${stars(v.stars)}</div>
        ${v.body ? `<div>${esc(v.body)}</div>` : ''}${(v.tags || []).map((t) => `<span class="pill">${esc(t)}</span>`).join('')}${v.reply ? `<div class="reply"><b>Reply from the ${isPg ? 'PG' : 'hostel'}:</b> ${esc(v.reply)}</div>` : ''}</div>`).join('') : '<p class="mute">No reviews yet. Only guests who stayed can review.</p>'}
      ${l.lat != null ? `<h3>Where it is</h3><div id="pin" class="pin"></div><p><a target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${l.lat},${l.lng}">Open in Google Maps</a> <span class="mute">· exact address shared once confirmed</span></p>` : ''}
      <div class="bar"><div class="in"><div><div class="price">${total ? inr(total) : '—'}</div><div class="mute">${sel.beds} bed${sel.beds > 1 ? 's' : ''}${isPg ? ' · first month' : ` · ${nights} night${nights > 1 ? 's' : ''}`} · pay at ${isPg ? 'PG' : 'hostel'}</div></div>
        <button class="btn" id="go" ${room ? '' : 'disabled'}>${l.live ? 'Reserve' : 'Request to book'}</button></div></div>`;
    app.querySelectorAll('[data-i]').forEach((i) => i.onclick = () => { cur = Number(i.dataset.i); draw(); });
    app.querySelectorAll('[data-r]').forEach((el) => el.onclick = (e) => {
      const r = l.rooms.find((x) => x.id === el.dataset.r), qb = e.target.closest('[data-q]');
      if (qb) { sel.beds = Math.min(Math.max(1, sel.beds + Number(qb.dataset.q)), r.free || 1); draw(); }
      else if (r.free > 0 && sel.room !== r.id) { sel.room = r.id; sel.beds = Math.min(sel.beds, r.free); draw(); }
    });
    app.querySelector('#tour')?.addEventListener('click', () => tourModal(l, tours));
    app.querySelector('#go').onclick = () => requestModal(l, room, sel.beds, inD, outD, 'stay');
    app.querySelector('#visit')?.addEventListener('click', () => requestModal(l, room || l.rooms[0], 1, inD, outD, 'visit'));
    if (l.lat != null) {
      map = L.map('pin', { scrollWheelZoom: false }).setView([l.lat, l.lng], 15);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(map);
      L.circle([l.lat, l.lng], { radius: 250, color: '#1C7A57' }).addTo(map);
    }
  };
  draw();
}

function tourModal(l, tours) {
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div class="card"><div class="row2"><h3>360° view inside</h3><button class="btn ghost sm" id="x">Close</button></div>
    <p class="mute">Drag left and right to look around.</p>${tours.map((t) => `<div class="pano" style="background-image:url('${esc(t)}')" role="img" aria-label="360° photo"></div>`).join('<div style="height:10px"></div>')}
    ${safeUrl(l.tour_url) ? `<p><a class="btn line block" target="_blank" rel="noopener" href="${esc(safeUrl(l.tour_url))}">Open the Google Maps 360° tour</a></p>` : ''}</div>`;
  document.body.append(m);
  m.querySelector('#x').onclick = () => m.remove(); m.onclick = (e) => { if (e.target === m) m.remove(); };
  m.querySelectorAll('.pano').forEach((p) => {
    let x = 0, pos = 0, down = false;
    const move = (cx) => { pos += cx - x; x = cx; p.style.backgroundPositionX = pos + 'px'; };
    p.onpointerdown = (e) => { down = true; x = e.clientX; p.setPointerCapture(e.pointerId); };
    p.onpointermove = (e) => down && move(e.clientX); p.onpointerup = () => (down = false);
  });
}

function requestModal(l, room, beds, inD, outD, type) {
  const isPg = l.kind === 'pg', visit = type === 'visit';
  const last = saved()[0];
  const m = document.createElement('div'); m.className = 'modal booking-modal';
  const minVisit = new Date(Date.now() + 36e5).toISOString().slice(0, 16);
  const nights = isPg ? 1 : Math.max(1, nightsOf(inD, outD));
  const total = room.rate_paise * beds * nights;
  m.innerHTML = `<form class="card booking-form"><div class="confirm-title"><button type="button" class="btn ghost back-button" id="x" aria-label="Back">←</button><h1>${visit ? 'Schedule a visit' : 'Confirm your bed'}</h1></div>
    ${visit ? `<p class="mute">${esc(l.title)} · ${esc(room.name)}</p>` : `<section class="card booking-summary"><h2>${esc(l.title)}</h2><p class="mute">${esc(room.name)} · ${beds} bed${beds === 1 ? '' : 's'}${isPg ? '' : ` · ${fmt(inD)} → ${fmt(outD)} · ${nights} night${nights === 1 ? '' : 's'}`}</p>
      <div class="row2"><span>${inr(room.rate_paise)} × ${beds}${isPg ? ' month' : ` × ${nights} nights`}</span><span>${inr(total)}</span></div><div class="row2"><span>Booking fee</span><b class="no-fee">₹0</b></div><div class="row2 summary-total"><b>Total</b><b>${inr(total)}</b></div></section>`}
    <label>Full name (as on your ID)</label><input name="name" required minlength="2" placeholder="e.g. Priya Kumar" value="${esc(last?.name || '')}" autocomplete="name">
    <label>Phone (WhatsApp)</label><div class="phone-field"><span>+91</span><input name="phone" type="tel" required pattern="[0-9+ -]{8,16}" placeholder="98400 12345" value="${esc(last?.phone || '')}" autocomplete="tel"></div>
    ${visit ? `<label>Visit time</label><input name="at" type="datetime-local" required min="${minVisit}">` : ''}
    ${room.women_only ? '<label class="check"><input type="checkbox" name="women" required> I confirm all guests are women</label>' : ''}
    <div id="m"></div><div class="confirm-submit"><button class="btn block">${visit ? 'Book the visit' : l.live ? `Confirm booking · ${inr(total)} at the ${isPg ? 'PG' : 'hostel'}` : 'Send request'}</button><p class="mute">Your booking goes straight into the property's calendar. No advance is charged now.</p></div></form>`;
  document.body.append(m);
  m.querySelector('#x').onclick = () => m.remove();
  m.querySelector('form').onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target), btn = e.target.querySelector('.btn.block'); btn.disabled = true;
    const { data, error } = await sb.rpc('mk2_request', {
      p_room: room.id, p_in: visit ? null : inD, p_out: visit || isPg ? null : outD, p_beds: beds, p_name: f.get('name'), p_phone: f.get('phone'),
      p_city: null, p_women_ok: !!f.get('women'), p_type: type, p_visit_at: visit ? new Date(f.get('at')).toISOString() : null });
    if (error) { btn.disabled = false; return (m.querySelector('#m').innerHTML = note(error.message, true)); }
    remember({ ref: data.ref, phone: f.get('phone'), name: f.get('name'), title: l.title });
    m.remove(); go('/track', { ref: data.ref, phone: f.get('phone') });
  };
}

// ------------------------------------------------------------------ track / confirm
async function track(q) {
  const ref = q.get('ref'), phone = q.get('phone');
  if (!ref || !phone) {
    app.innerHTML = `${brand()}<h2>Find your request</h2><form class="card" id="f"><label>Reference</label><input name="ref" placeholder="REQ-2041" required>
      <label>Phone you used</label><input name="phone" type="tel" required><button class="btn block" style="margin-top:12px">Show my request</button></form>`;
    app.querySelector('#f').onsubmit = (e) => { e.preventDefault(); const f = new FormData(e.target); go('/track', { ref: f.get('ref'), phone: f.get('phone') }); };
    return;
  }
  const { data: t, error } = await sb.rpc('mk2_track', { p_ref: ref, p_phone: phone });
  if (error) return (app.innerHTML = brand() + note(error.message, true) + '<a class="btn ghost" href="#/track">Try again</a>');
  const total = inr(t.amount_paise), isPg = t.kind === 'pg', visit = t.type === 'visit';
  const when = visit ? new Date(t.visit_at).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : `${fmt(t.check_in)} → ${fmt(t.check_out)}`;
  const wa = waLink(t.whatsapp_phone, `Hi, this is about request ${t.ref} on NammaStay (${when}).`);
  const ok = t.status === 'accepted';
  let html = brand('<a class="small" href="#/">New search</a>');
  if (ok) {
    const nextCity = (name) => `#/results?${new URLSearchParams({ city: name, in: t.check_in, out: t.check_out, beds: t.beds, kind: t.kind })}`;
    html += `<section class="success-view"><div class="success-icon" aria-hidden="true">✓</div><h1>${visit ? 'Your visit is booked!' : "You're booked!"}</h1>
      <p class="success-intro">${visit ? `See you on ${when}. The ${isPg ? 'PG' : 'hostel'} has your visit.` : `See you on ${fmt(t.check_in)}. The ${isPg ? 'PG' : 'hostel'} already has your booking.`}</p>
      <div class="card booking-summary confirmed-summary"><div class="row2"><h2>${esc(t.title)}</h2><b class="reference">${esc(t.ref)}</b></div>
        <p class="mute">${esc(t.room)}</p><p class="mute">${when}${visit ? '' : ` · ${nightsOf(t.check_in, t.check_out)} night${nightsOf(t.check_in, t.check_out) === 1 ? '' : 's'}`}</p>
        ${visit ? '' : `<div class="row2 summary-total"><b>Pay at the ${isPg ? 'PG' : 'hostel'}</b><b>${total}</b></div>`}</div>
      <div class="kick success-kick">Before you go</div>
      <div class="pretrip-note"><span aria-hidden="true">▣</span><div><b>Bring your ID</b><p class="mute">Aadhaar, passport or driving licence. Travelling from abroad? Bring your passport and visa.</p></div></div>
      <a class="action-card" target="_blank" rel="noopener" href="${esc(wa)}"><span aria-hidden="true">◌</span><div><b>Message the ${isPg ? 'PG' : 'hostel'}</b><p class="mute">On WhatsApp, about arrival or questions.</p></div></a>
      ${t.lat != null ? `<a class="action-card" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${t.lat},${t.lng}"><span aria-hidden="true">⌖</span><div><b>Get directions</b><p class="mute">${esc([t.area, t.city].filter(Boolean).join(', '))}</p></div></a>` : `<div class="action-card"><span aria-hidden="true">⌖</span><div><b>Address</b><p class="mute">${esc(t.address || 'Ask the host for directions on WhatsApp.')}</p></div></div>`}
      ${safeUrl(t.community_url) || t.instagram ? `<div class="card"><h3>Meet other travellers before you arrive</h3><p class="mute">${esc(t.title)} runs a group for its guests: plans, meetups and tips.</p>
        ${safeUrl(t.community_url) ? `<a class="btn block" target="_blank" rel="noopener" href="${esc(t.community_url)}">Join the WhatsApp community</a>` : ''}
        ${t.instagram ? `<a class="btn line block" style="margin-top:8px" target="_blank" rel="noopener" href="https://instagram.com/${encodeURIComponent(String(t.instagram).replace(/^@/, ''))}">Follow on Instagram</a>` : ''}
        <p class="mute">The group is run by the ${isPg ? 'PG' : 'hostel'}. NammaStay doesn't see your chats. Your phone number shows to group members.</p></div>` : ''}
      <div class="next-stop"><h2>Next stop?</h2><p>Book your next hostel the same way: no booking fee, pay when you arrive.</p><div class="chips"><a class="chip" href="${nextCity('Pondicherry')}">Pondicherry</a><a class="chip" href="${nextCity('Bengaluru')}">Bengaluru</a><a class="chip on" href="#/">Search</a></div></div>
      <div class="success-links"><a href="#/">New search</a><a href="#" id="cancel-booking">Change or cancel</a></div></section>`;
    if (t.can_review) html += `<div class="card"><h3>How was your stay?</h3><form id="rv"><div class="chips" id="st">${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="chip" data-s="${n}">${n} ★</button>`).join('')}</div>
      <textarea name="body" maxlength="1000" placeholder="Tell other travellers about it"></textarea><div class="chips">${['Clean', 'Felt safe', 'Great location', 'Friendly staff', 'Noisy'].map((x) => `<label class="chip" style="margin:0"><input type="checkbox" name="tag" value="${x}" style="display:none"> ${x}</label>`).join('')}</div>
      <div id="rm"></div><button class="btn block">Post review</button></form></div>`;
    else if (t.reviewed) html += '<div class="card mint">Thanks for your review!</div>';
  } else if (t.status === 'new') {
    html += `<div class="card amber"><div style="font-size:30px">◷</div><h2 style="font-size:24px">${visit ? 'Visit request' : 'Request'} sent to ${esc(t.title)}</h2>
      <p>The owner replies by <b>${new Date(t.reply_by).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</b>. We'll WhatsApp you on ${esc(phone)} as soon as they confirm.</p><b style="color:#8A5A00">${esc(t.ref)} · sent ${new Date(t.sent_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</b></div>
      <div class="card"><div class="row2"><b>${when}</b>${t.verified ? '<span class="pill blue">Verified</span>' : ''}</div><div class="mute">${esc(t.room)}${visit ? '' : ` · ${t.beds} bed${t.beds > 1 ? 's' : ''}`}</div><hr style="border:0;border-top:1px solid var(--line)">
        ${visit ? '' : `<div class="row2"><span>Rate × ${t.beds}</span><b>${total}</b></div><div class="row2"><span>NammaStay fee</span><b style="color:#0F6B4A">₹0</b></div><div class="row2"><b>Pay at the ${isPg ? 'PG' : 'hostel'}</b><b>${total}</b></div><div class="mute">No advance. Nothing is charged now.</div>`}</div>
      <ol class="card steps" style="padding:8px 16px"><li class="done"><span class="dot">✓</span><div><b>Request sent</b><div class="mute">${new Date(t.sent_at).toLocaleString('en-IN')}</div></div></li>
        <li><span class="dot">2</span><div><b>Owner confirms</b><div class="mute">Waiting · by ${new Date(t.reply_by).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })} at the latest</div></div></li>
        <li><span class="dot">3</span><div><b>Stay and pay at the ${isPg ? 'PG' : 'hostel'}</b></div></li></ol>
      <p class="mute" style="text-align:center">No reply in time? The request ends by itself, and we show you hostels with <b style="color:#0F6B4A">live beds</b> you can book instantly.</p>
      <a class="btn block" target="_blank" rel="noopener" href="${esc(wa)}">WhatsApp the ${isPg ? 'PG' : 'hostel'}</a>`;
  } else {
    const word = { declined: 'could not take your request', ended: 'did not reply in time', cancelled: 'request was cancelled' }[t.status];
    html += `<div class="card"><h2 style="font-size:22px">${esc(t.title)} ${word}</h2><p class="mute">${esc(t.ref)} · ${when}. Nothing was charged.</p>
      <a class="btn block" href="#/results?${new URLSearchParams({ city: t.city, in: t.check_in, out: t.check_out, beds: t.beds, kind: t.kind, live: 1 })}">Show hostels with live beds</a></div>`;
  }
  if (t.status === 'new') html += `<button class="btn danger block" id="cx" style="margin-top:10px">Cancel ${visit ? 'visit' : 'request'}</button>`;
  html += `<p class="mute" style="text-align:center">Verified by NammaStay: photos, address and owner checked on a video call.</p><div id="m"></div>`;
  app.classList.toggle('success-page', ok);
  app.innerHTML = html;
  app.querySelector('#cancel-booking')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (!confirm('Cancel this booking?')) return;
    sb.rpc('mk2_cancel_request', { p_ref: ref, p_phone: phone }).then(({ error: cancelError }) => {
      if (cancelError) app.querySelector('#m').innerHTML = note(cancelError.message, true);
      else track(q);
    });
  });
  app.querySelector('#cx')?.addEventListener('click', async () => {
    if (!confirm('Cancel this request?')) return;
    const { error: e } = await sb.rpc('mk2_cancel_request', { p_ref: ref, p_phone: phone });
    if (e) app.querySelector('#m').innerHTML = note(e.message, true); else track(q);
  });
  const rv = app.querySelector('#rv');
  if (rv) {
    let s = 0;
    rv.querySelectorAll('[data-s]').forEach((b) => b.onclick = () => { s = Number(b.dataset.s); rv.querySelectorAll('[data-s]').forEach((x) => x.classList.toggle('on', Number(x.dataset.s) <= s)); });
    rv.onsubmit = async (e) => {
      e.preventDefault();
      if (!s) return (rv.querySelector('#rm').innerHTML = note('Choose 1 to 5 stars.', true));
      const f = new FormData(rv);
      const { error: er } = await sb.rpc('mk2_review', { p_ref: ref, p_phone: phone, p_stars: s, p_body: f.get('body'), p_tags: f.getAll('tag') });
      if (er) rv.querySelector('#rm').innerHTML = note(er.message, true); else track(q);
    };
  }
}

addEventListener('hashchange', route);
route();
