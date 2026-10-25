import { sb, configured, $, esc, inr, say, today, photoUrl } from './common.js';

const msg = $('#msg');
if (!configured) say(msg, 'Not connected yet — set the Supabase keys in assets/js/config.js.', true);

const nights = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);

async function search(e) {
  e?.preventDefault();
  say(msg, '');
  const f = new FormData($('#f'));
  const inD = f.get('in') || null, outD = f.get('out') || null;
  if ((inD && !outD) || (!inD && outD) || (inD && outD <= inD)) return say(msg, 'Pick a check-in and a later check-out date.', true);
  const { data, error } = await sb.rpc('mk_search', { p_city: f.get('city'), p_in: inD, p_out: outD, p_guests: Number(f.get('guests')) || 1 });
  if (error) return say(msg, error.message, true);
  const q = inD ? `&in=${inD}&out=${outD}&guests=${Number(f.get('guests')) || 1}` : '';
  $('#results').innerHTML = data.length ? data.map((l) => `
    <a class="tile" href="?id=${esc(l.id)}${q}" style="text-decoration:none;color:inherit">
      ${photoUrl(l.photo) ? `<img src="${esc(photoUrl(l.photo))}" alt="">` : '<div class="ph"></div>'}
      <div><b>${esc(l.title)}</b><div class="mute">${esc(l.property_type)} · ${esc(l.city)}</div>
      <div class="price">from ${inr(l.from_paise)} <span class="mute">/ night</span></div></div></a>`).join('')
    : '<div class="card">No stays found. Try other dates or a different city.</div>';
}

async function detail(id, params) {
  $('#search').hidden = true; $('#results').hidden = true; $('#detail').hidden = false;
  const { data: l } = await sb.from('mk_listings').select('id,title,description,property_type,city,state,address,amenities,photos').eq('id', id).maybeSingle();
  if (!l) return say(msg, 'Property not found.', true);
  const { data: rooms } = await sb.from('mk_rooms').select('id,name,max_guests,rate_paise').eq('listing_id', id).order('rate_paise');
  const inD = params.get('in') || '', outD = params.get('out') || '', g = params.get('guests') || 2;
  const avail = {};
  if (inD && outD) for (const r of rooms) avail[r.id] = (await sb.rpc('mk_free_units', { p_room: r.id, p_in: inD, p_out: outD })).data;
  $('#detail').innerHTML = `
    <p><a href="find.html">← All stays</a></p>
    <div class="card"><h2>${esc(l.title)}</h2>
      <div class="mute">${esc(l.property_type)} · ${esc([l.address, l.city, l.state].filter(Boolean).join(', '))}</div>
      <div class="gallery">${l.photos.map(photoUrl).filter(Boolean).map((u) => `<img src="${esc(u)}" alt="">`).join('')}</div>
      <p>${esc(l.description)}</p>
      ${l.amenities.length ? `<p class="mute">Amenities: ${l.amenities.map(esc).join(', ')}</p>` : ''}</div>
    <div class="card"><h3>Book</h3>
      <form id="bk"><div class="row">
        <div><label>Check-in</label><input name="in" type="date" min="${today()}" value="${esc(inD)}" required></div>
        <div><label>Check-out</label><input name="out" type="date" min="${today()}" value="${esc(outD)}" required></div>
        <div><label>Guests</label><input name="guests" type="number" min="1" value="${esc(g)}" required></div></div>
      <label>Room</label><select name="room">${rooms.map((r) => `<option value="${esc(r.id)}" ${avail[r.id] === 0 ? 'disabled' : ''}>${esc(r.name)} — ${inr(r.rate_paise)}/night, sleeps ${r.max_guests}${avail[r.id] === 0 ? ' (sold out)' : ''}</option>`).join('')}</select>
      <label>Your name</label><input name="name" required minlength="2">
      <label>Phone</label><input name="phone" type="tel" required>
      <label>Email (optional)</label><input name="email" type="email">
      <p><button>Confirm booking</button></p><div id="bmsg"></div></form></div>`;
  $('#bk').onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target), n = nights(f.get('in'), f.get('out'));
    const { data: ref, error } = await sb.rpc('mk_book', {
      p_room: f.get('room'), p_in: f.get('in'), p_out: f.get('out'), p_guests: Number(f.get('guests')),
      p_name: f.get('name'), p_phone: f.get('phone'), p_email: f.get('email') || null,
    });
    if (error) return say($('#bmsg'), error.message, true);
    e.target.innerHTML = `<div class="msg">Booked! Your reference is <b>${esc(ref)}</b> for ${n} night${n === 1 ? '' : 's'}. The host will contact you on the phone number given.</div>`;
  };
}

if (configured) {
  const params = new URLSearchParams(location.search), id = params.get('id');
  if (id && /^[0-9a-f-]{36}$/i.test(id)) detail(id, params);
  else { $('#f').onsubmit = search; search(); }
}
