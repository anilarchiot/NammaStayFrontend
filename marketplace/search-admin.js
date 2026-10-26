import { sb, configured, esc, inr, photoUrl } from './common.js';

const app = document.getElementById('app');
const note = (t, err) => `<div class="msg${err ? ' err' : ''}">${esc(t)}</div>`;
const fmtD = (s) => new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const ago = (iso) => { if (!iso) return ''; const h = Math.round((Date.now() - new Date(iso)) / 36e5); return h < 1 ? 'just now' : h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`; };
const ITEMS = [['phone', 'Phone verified by code'], ['address', 'Address matches the map pin'], ['proof', 'Proof name matches the owner'], ['video', 'Video call: the place matches the photos'], ['prices', 'Prices look real for the area']];
const month0 = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1, 12).toISOString().slice(0, 10); };

let view = 'check', queue = [], selId = null, billMonth = month0();

const head = (title) => `<div class="row2" style="flex-wrap:wrap;margin-bottom:14px"><div><div class="kick">NammaStay admin · Search</div><h1 style="font-size:28px">${title}</h1></div>
  <div style="display:flex;gap:8px">${[['check', `To check · ${queue.filter((l) => ['pending', 'changes'].includes(l.review_status)).length}`], ['bills', 'Bills'], ['all', 'All listings']].map(([k, n]) => `<button class="btn ${view === k ? '' : 'ghost'}" style="${view === k ? 'background:var(--navy);border-color:var(--navy)' : ''}" data-v="${k}">${n}</button>`).join('')}
  <button class="btn ghost" id="so">Sign out</button></div></div>`;
const wire = () => {
  app.querySelectorAll('[data-v]').forEach((b) => b.onclick = () => { view = b.dataset.v; draw(); });
  app.querySelector('#so').onclick = async () => { await sb.auth.signOut(); boot(); };
};

async function boot() {
  if (!configured) return (app.innerHTML = note('Not connected yet — set the Supabase keys in config.js.', true));
  const { data } = await sb.auth.getSession();
  if (!data.session) return login();
  const r = await sb.rpc('mk2_admin_queue');
  if (r.error) return (app.innerHTML = `${note(/Admins only/.test(r.error.message) ? 'This account is not a NammaStay Search admin.' : r.error.message, true)}<button class="btn ghost" id="so">Sign out</button>`, app.querySelector('#so').onclick = async () => { await sb.auth.signOut(); boot(); });
  queue = r.data;
  const first = queue.find((l) => ['pending', 'changes'].includes(l.review_status));
  if (!queue.some((l) => l.id === selId)) selId = first?.id || queue[0]?.id;
  draw();
}

function login() {
  app.innerHTML = `<div style="max-width:380px;margin:60px auto"><h1>Search admin</h1><form class="card" id="f"><label>Email</label><input name="email" type="email" required><label>Password</label><input name="password" type="password" required><div id="m"></div><button class="btn block" style="margin-top:12px">Sign in</button></form></div>`;
  app.querySelector('#f').onsubmit = async (e) => {
    e.preventDefault(); const f = new FormData(e.target);
    const { error } = await sb.auth.signInWithPassword({ email: f.get('email'), password: f.get('password') });
    if (error) app.querySelector('#m').innerHTML = note(error.message, true); else boot();
  };
}

function draw() { ({ check, bills, all }[view])(); }

function check() {
  const list = queue.filter((l) => ['pending', 'changes'].includes(l.review_status));
  const l = queue.find((x) => x.id === selId);
  app.innerHTML = head('Free listings to check') + `<div class="split"><div>${list.map((x) => `<div class="card ${x.id === selId ? 'sel' : ''}" data-s="${esc(x.id)}" style="cursor:pointer;padding:12px"><div class="row2"><b>${esc(x.title)}</b><span class="mute">${ago(x.submitted_at)}</span></div>
      <div class="mute">${x.kind === 'pg' ? 'PG' : 'Hostel'} · ${esc([x.area, x.city].filter(Boolean).join(', '))}</div>
      <b style="font-size:13px;color:${x.review_status === 'changes' ? '#B42318' : '#8A5A00'}">${x.review_status === 'changes' ? 'Changes asked · waiting for owner' : x.call_at ? 'Video call · ' + esc(x.call_at) : 'No call booked yet'}</b></div>`).join('') || '<div class="card mute">Nothing to check. 🎉</div>'}</div>
    <div>${l ? detail(l) : ''}</div></div>`;
  wire();
  app.querySelectorAll('[data-s]').forEach((c) => c.onclick = () => { selId = c.dataset.s; check(); });
  if (!l) return;
  const form = app.querySelector('#d'), btn = app.querySelector('#ap'), m = app.querySelector('#m');
  const cl = () => Object.fromEntries(ITEMS.map(([k]) => [k, form[k].checked]));
  const sync = () => (btn.disabled = !Object.values(cl()).every(Boolean));
  form.querySelectorAll('input[type=checkbox]').forEach((c) => c.onchange = sync); sync();
  const decide = (action) => async () => {
    const { error } = await sb.rpc('mk2_admin_decide', { p_listing: l.id, p_action: action, p_note: form.note.value || null, p_checklist: cl(), p_call_at: form.call.value });
    if (error) m.innerHTML = note(error.message, true); else boot();
  };
  btn.onclick = decide('approve'); app.querySelector('#ch').onclick = decide('changes'); app.querySelector('#rj').onclick = decide('reject');
}

function detail(l) {
  return `<div class="card"><div class="row2"><div><h2 style="margin:0">${esc(l.title)}</h2><div class="mute">Owner: ${esc(l.owner_name || '—')} · ${esc(l.owner_phone || '')} · ${esc(l.address || '')}</div></div>
    ${l.lat != null ? `<a class="btn ghost" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${l.lat},${l.lng}">Open on map</a>` : ''}</div>
    <div class="thumb-l" style="margin:12px 0">${l.photos.map(photoUrl).filter(Boolean).map((p) => `<a href="${esc(p)}" target="_blank" rel="noopener" class="it" style="width:130px;height:90px;background-image:url('${esc(p)}')"></a>`).join('')}</div>
    <div class="two"><div class="card" style="background:#FBF6E8"><b>Rooms and prices</b>${l.rooms.map((r) => `<div>${esc(r.name)} · ${r.beds} beds · ${inr(r.rate_paise)}${r.women_only ? ' · women only' : ''}</div>`).join('')}<div class="mute">${l.ical_url ? 'Free beds: calendar link ' + esc(l.ical_url) : 'No calendar link'}</div></div>
      <div class="card" style="background:#FBF6E8"><b>Proof</b><div>${esc(l.proof || '—')}</div><div class="mute">Similar names already on Search: ${l.similar || 'none'}</div></div></div>
    <form id="d"><fieldset style="border:1px solid var(--line);border-radius:12px"><legend><b>Checklist</b></legend>${ITEMS.map(([k, n]) => `<label class="check"><input type="checkbox" name="${k}" ${l.checklist?.[k] ? 'checked' : ''}> ${n}</label>`).join('')}</fieldset>
      <label>Video call (when)</label><input name="call" value="${esc(l.call_at || '')}" placeholder="e.g. tomorrow 11 AM">
      <label>Note to the owner (needed to ask for changes or reject)</label><textarea name="note" placeholder="e.g. Please add a photo of the bathroom.">${esc(l.admin_note || '')}</textarea><div id="m"></div>
      <div class="row2" style="justify-content:flex-end;margin-top:10px"><button type="button" class="btn danger" id="rj">Reject</button><button type="button" class="btn ghost" id="ch">Ask for changes</button><button type="button" class="btn" id="ap" disabled>Approve · goes live with Verified badge</button></div>
      <div class="mute" style="text-align:right">Approve unlocks when every box is ticked.</div></form></div>`;
}

async function bills() {
  app.innerHTML = head('Bills for free listings') + '<div class="msg">Loading…</div>';
  wire();
  const { data, error } = await sb.rpc('mk2_admin_bills', { p_month: billMonth });
  if (error) return (app.innerHTML = head('Bills for free listings') + note(error.message, true), wire());
  const s = data.settings, months = [0, -1, -2, -3].map((o) => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + o, 1, 12).toISOString().slice(0, 10); });
  app.innerHTML = head('Bills for free listings') + `<div class="card"><div class="row2" style="flex-wrap:wrap"><span><b>Launch offer:</b> 0% for everyone until <b>${fmtD(s.launch_until)}</b></span><span><b>Free listings:</b> ${s.fee_pct}% of stays NammaStay brought</span><span><b>PG:</b> ${s.fee_pct}% of the first month's rent, once</span><span><b>Subscribers:</b> 0%, always</span><button class="btn ghost" id="chg">Change</button></div></div>
    <div class="row2" style="margin-bottom:10px"><label style="margin:0">Month <select id="mo" style="width:auto;margin-left:8px">${months.map((m) => `<option value="${m}" ${m === data.month ? 'selected' : ''}>${new Date(m + 'T12:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</option>`).join('')}</select></label>
      <span class="mute">Bills go out on the 1st. Due on the 7th. Unpaid after ${s.pause_days} days: listing pauses by itself.</span></div>
    <div class="card" style="padding:0;overflow:auto"><table class="tbl"><tr><th>Property</th><th>Guests stayed</th><th class="r">Stay value</th><th class="r">Fee ${s.fee_pct}%</th><th>Status</th><th></th></tr>
      ${data.rows.map((r) => { const b = r.bill; const st = { paid: ['green', 'Paid'], waived: ['green', b.subscriber ? 'Subscriber · 0%' : 'Launch offer · 0%'], utr: ['amber', 'UTR to confirm'], open: ['amber', 'Due ' + fmtD(b.due)], overdue: ['red', b.paused ? 'Overdue · paused' : 'Overdue'] }[b.status];
        return `<tr><td><b>${esc(r.title)}</b><div class="mute">${r.kind === 'pg' ? 'PG' : 'Hostel'} · ${esc(r.city)}</div></td><td>${b.count}${b.no_shows ? ` (${b.no_shows} no-show)` : ''}</td><td class="r">${inr(b.value_paise)}</td><td class="r"><b>${inr(b.fee_paise)}</b></td>
          <td><span class="pill ${st[0]}">${st[1]}</span>${b.utr ? `<div class="mute">UTR ${esc(b.utr)}</div>` : ''}</td><td class="r">${b.status === 'utr' ? `<button class="btn sm" data-p="${esc(r.listing_id)}">Confirm paid</button>` : b.status === 'overdue' && r.phone ? `<a class="btn ghost sm" target="_blank" rel="noopener" href="https://wa.me/${String(r.phone).replace(/\D/g, '').replace(/^(\d{10})$/, '91$1')}?text=${encodeURIComponent(`Hi, your NammaStay fee for ${new Date(data.month + 'T12:00:00').toLocaleDateString('en-IN', { month: 'long' })} (${inr(b.fee_paise)}) is due. Please pay by UPI and send us the UTR.`)}">Remind on WhatsApp</a>` : ''}</td></tr>`; }).join('') || '<tr><td colspan="6" class="mute">No approved listings yet.</td></tr>'}</table></div>`;
  wire();
  app.querySelector('#mo').onchange = (e) => { billMonth = e.target.value; bills(); };
  app.querySelectorAll('[data-p]').forEach((b) => b.onclick = async () => {
    const { error: e } = await sb.rpc('mk2_admin_confirm_paid', { p_listing: b.dataset.p, p_month: data.month });
    if (e) alert(e.message); else bills();
  });
  app.querySelector('#chg').onclick = () => {
    const m = document.createElement('div'); m.className = 'modal';
    m.innerHTML = `<form class="card"><h3>Commission settings</h3><label>0% launch offer until</label><input type="date" name="u" value="${esc(s.launch_until)}" required><label>Fee % after the offer</label><input type="number" name="p" step="0.5" min="0" max="50" value="${esc(s.fee_pct)}" required>
      <label>Owner reply window (hours)</label><input type="number" name="h" min="1" max="72" value="${esc(s.reply_hours)}" required><label>Pause unpaid listings after (days)</label><input type="number" name="d" min="1" max="60" value="${esc(s.pause_days)}" required><div id="sm"></div>
      <div class="row2" style="margin-top:12px"><button type="button" class="btn ghost" id="x">Cancel</button><button class="btn">Save</button></div></form>`;
    document.body.append(m); m.querySelector('#x').onclick = () => m.remove();
    m.querySelector('form').onsubmit = async (e) => {
      e.preventDefault(); const f = new FormData(e.target);
      const { error: er } = await sb.rpc('mk2_admin_set_settings', { p_launch_until: f.get('u'), p_fee_pct: Number(f.get('p')), p_reply_hours: Number(f.get('h')), p_pause_days: Number(f.get('d')) });
      if (er) m.querySelector('#sm').innerHTML = note(er.message, true); else { m.remove(); bills(); }
    };
  };
}

function all() {
  app.innerHTML = head('All listings') + `<div class="card" style="padding:0;overflow:auto"><table class="tbl"><tr><th>Property</th><th>Status</th><th>Owner</th><th></th></tr>${queue.map((l) => `<tr><td><b>${esc(l.title)}</b><div class="mute">${l.kind === 'pg' ? 'PG' : 'Hostel'} · ${esc(l.city)}</div></td>
    <td><span class="pill ${l.review_status === 'approved' ? 'green' : l.review_status === 'rejected' ? 'red' : 'amber'}">${esc(l.review_status)}</span>${l.verified ? '<span class="pill blue">Verified</span>' : ''}${l.subscriber ? '<span class="pill green">Subscriber</span>' : ''}</td>
    <td>${esc(l.owner_name || '')}<div class="mute">${esc(l.owner_phone || '')}</div></td><td class="r">${l.review_status === 'approved' ? `<button class="btn ghost sm" data-sub="${esc(l.id)}" data-on="${l.subscriber ? 0 : 1}">${l.subscriber ? 'Remove subscriber' : 'Mark subscriber'}</button>` : `<button class="btn ghost sm" data-r="${esc(l.id)}">Review</button>`}</td></tr>`).join('') || '<tr><td colspan="4" class="mute">No listings yet.</td></tr>'}</table></div>`;
  wire();
  app.querySelectorAll('[data-r]').forEach((b) => b.onclick = () => { selId = b.dataset.r; view = 'check'; draw(); });
  app.querySelectorAll('[data-sub]').forEach((b) => b.onclick = async () => {
    const { error } = await sb.rpc('mk2_admin_decide', { p_listing: b.dataset.sub, p_action: b.dataset.on === '1' ? 'subscriber' : 'unsubscriber' });
    if (error) alert(error.message); else boot();
  });
}

boot();
