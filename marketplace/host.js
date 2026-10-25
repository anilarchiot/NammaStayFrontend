import { sb, configured, $, esc, inr, say, photoUrl } from './common.js';

const msg = $('#msg');
let registering = false, user = null;

if (!configured) say(msg, 'Not connected yet — set the Supabase keys in assets/js/config.js.', true);

function roomRow() {
  const d = document.createElement('div');
  d.className = 'row room';
  d.innerHTML = `<input class="rn" placeholder="Room name" required><input class="rg" type="number" min="1" value="2" title="Max guests" style="width:90px">
    <input class="ru" type="number" min="1" value="1" title="Units" style="width:90px"><input class="rr" type="number" min="1" placeholder="₹ / night" required style="width:120px">`;
  return d;
}

function show(signedIn) {
  $('#auth').hidden = signedIn; $('#app').hidden = !signedIn; $('#out').hidden = !signedIn;
  if (signedIn) { $('#roomRows').replaceChildren(roomRow()); loadListings(); }
}

async function init() {
  const { data } = await sb.auth.getSession();
  user = data.session?.user ?? null;
  show(!!user);
}

$('#toggle').onclick = () => {
  registering = !registering;
  $('#nameRow').hidden = !registering;
  $('#login button:not(.ghost)').textContent = registering ? 'Register' : 'Sign in';
  $('#toggle').textContent = registering ? 'Have an account? Sign in' : 'New host? Register';
};

$('#login').onsubmit = async (e) => {
  e.preventDefault();
  const f = new FormData(e.target), email = f.get('email'), password = f.get('password');
  const res = registering
    ? await sb.auth.signUp({ email, password, options: { data: { name: f.get('name'), phone: f.get('phone') } } })
    : await sb.auth.signInWithPassword({ email, password });
  if (res.error) return say(msg, res.error.message, true);
  if (!res.data.session) return say(msg, 'Check your email to confirm your account, then sign in.');
  user = res.data.session.user;
  await sb.from('mk_hosts').upsert({ user_id: user.id, name: user.user_metadata?.name || email, phone: user.user_metadata?.phone || null });
  say(msg, '');
  show(true);
};

$('#out').onclick = async (e) => { e.preventDefault(); await sb.auth.signOut(); user = null; show(false); };
$('#addRoom').onclick = () => $('#roomRows').append(roomRow());

$('#add').onsubmit = async (e) => {
  e.preventDefault();
  const form = e.target, f = new FormData(form);
  const rooms = [...document.querySelectorAll('.room')].map((r) => ({
    name: r.querySelector('.rn').value.trim(), max_guests: Number(r.querySelector('.rg').value) || 1,
    units: Number(r.querySelector('.ru').value) || 1, rate_paise: Math.round(Number(r.querySelector('.rr').value) * 100),
  })).filter((r) => r.name && r.rate_paise > 0);
  if (!rooms.length) return say(msg, 'Add at least one room with a price.', true);

  const photos = [];
  for (const file of form.photos.files) {
    if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) return say(msg, 'Photos must be images under 5 MB.', true);
    const path = `${user.id}/${crypto.randomUUID()}.${(file.name.split('.').pop() || 'jpg').replace(/[^a-z0-9]/gi, '').slice(0, 5)}`;
    const up = await sb.storage.from('mk-photos').upload(path, file, { contentType: file.type });
    if (up.error) return say(msg, up.error.message, true);
    photos.push(sb.storage.from('mk-photos').getPublicUrl(path).data.publicUrl);
  }

  const { data: l, error } = await sb.from('mk_listings').insert({
    host_id: user.id, title: f.get('title'), property_type: f.get('type'), city: f.get('city'), state: f.get('state') || null,
    address: f.get('address') || null, description: f.get('description') || null, photos,
    amenities: String(f.get('amenities') || '').split(',').map((s) => s.trim()).filter(Boolean),
  }).select('id').single();
  if (error) return say(msg, error.message, true);
  const r = await sb.from('mk_rooms').insert(rooms.map((x) => ({ ...x, listing_id: l.id })));
  if (r.error) return say(msg, r.error.message, true);
  form.reset(); $('#roomRows').replaceChildren(roomRow());
  say(msg, 'Property published!');
  loadListings();
};

async function loadListings() {
  const { data: ls } = await sb.from('mk_listings').select('id,code,title,city,status,photos').eq('host_id', user.id).order('created_at', { ascending: false });
  const out = [];
  for (const l of ls ?? []) {
    const { data: bs } = await sb.from('mk_bookings').select('id,ref,guest_name,guest_phone,check_in,check_out,amount_paise,status').eq('listing_id', l.id).order('check_in', { ascending: false }).limit(50);
    out.push(`<div class="card"><h3>${esc(l.title)} <span class="mute">${esc(l.city)} · ${esc(l.status)}</span></h3>
      <p class="mute">NammaStay app sync — listing code: <span class="code">${esc(l.code)}</span>. In the NammaStay app open Connect → nammaBookings and enter this code.</p>
      ${bs.length ? `<table><tr><th>Ref</th><th>Guest</th><th>Dates</th><th>Amount</th><th></th></tr>${bs.map((b) => `
        <tr><td>${esc(b.ref)}</td><td>${esc(b.guest_name)}<br><span class="mute">${esc(b.guest_phone)}</span></td><td>${esc(b.check_in)} → ${esc(b.check_out)}</td>
        <td>${inr(b.amount_paise)}</td><td>${b.status === 'cancelled' ? 'Cancelled' : `<button class="danger" data-cancel="${esc(b.id)}">Cancel</button>`}</td></tr>`).join('')}</table>`
        : '<p class="mute">No bookings yet.</p>'}</div>`);
  }
  $('#listings').innerHTML = out.join('') || '<div class="card mute">No properties yet.</div>';
  $('#listings').querySelectorAll('[data-cancel]').forEach((b) => b.onclick = async () => {
    if (!confirm('Cancel this booking?')) return;
    const { error } = await sb.rpc('mk_cancel', { p_booking: b.dataset.cancel });
    if (error) say(msg, error.message, true); else loadListings();
  });
}

if (configured) init();
