// NammaStay admin panel — every property using NammaStay, what needs attention,
// and one screen per property with owner contact, usage, subscription and actions.
import { adminPage, openPlatformInvoice, page, rpc, content, setSubtitle, headerActions, headerSearch, esc, rupees, fmtDate, fmtDayTime, pill, modal, confirmDialog,
  toast, field, options, showFatal, param, uuidOk, waNumber, ROLE_LABEL, SITE_URL, $, $$ } from '../core.js';

const STATE = { trial: ['Trial', 'blue'], active: ['Paying', 'green'], grace: ['Payment due', 'amber'], expired: ['Ended', 'red'],
  complimentary: ['Complimentary', 'grey'], suspended: ['Suspended', 'red'] };
const statePill = (s) => pill(...(STATE[s] || [s, 'grey']));
const ago = (iso) => {
  if (!iso) return 'Never';
  const d = Math.floor((Date.now() - new Date(iso)) / 864e5);
  return d <= 0 ? 'Today' : d === 1 ? 'Yesterday' : d < 30 ? `${d} days ago` : fmtDate(iso);
};

adminPage(async (ctx) => {
  if (!ctx.isAdmin) { showFatal('This screen is only for NammaStay admins.'); return; }
  const id = param('id');
  if (uuidOk(id)) return propertyView(id);
  return overview();
});

// ------------------------------------------------------------ overview
async function overview() {
  let filter = ''; let q = '';
  headerActions().innerHTML = '<div class="ns-search"><span>Search</span></div><a class="ns-btn-ghost" href="subscribers.html">Payments & prices</a><button type="button" class="ns-btn" id="add-prop">+ Add property</button>';
  $('#add-prop').onclick = addPropertyDialog;
  headerSearch('Search property, city, owner…', (v) => { q = v.toLowerCase(); drawTable(); });
  const d = await rpc('admin_overview');
  const drawReminders = async () => {
    const host = document.getElementById('rem-card'); if (!host) return;
    const list = await rpc('admin_reminders', { p_all: false }).catch(() => null);
    if (list === null) { host.remove(); return; }                                    // database not updated yet (023)
    const KIND = { trial_3d: ['Trial ends in 3 days', 'amber'], trial_1d: ['Trial ends tomorrow', 'amber'], trial_ended: ['Trial ended', 'red'],
      renew_7d: ['Renews in 7 days', 'blue'], renew_1d: ['Plan ends tomorrow', 'amber'], expired: ['Plan ended', 'red'] };
    const wa = (r) => {
      const first = String(r.owner || '').split(/[\s@]/)[0] || 'there';
      const msg = `Hello ${first}, this is NammaStay. ${r.text.title} for ${r.property}. ${/ended/.test(r.text.title) ? 'Choose a plan in Settings → Billing to keep using NammaStay' : 'You can choose a plan any time in Settings → Billing'} — reply here if you need help. Thank you!`;
      return `https://wa.me/${String(r.phone || '').replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
    };
    host.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
        <div class="ns-h3">Reminders to follow up <span class="ns-muted" style="font-weight:600">(${list.length})</span></div>
        <button type="button" class="ns-btn-ghost" id="rem-run" style="height:32px;font-size:12px">Check now</button></div>
      <div class="ns-muted" style="font-size:12.5px">Owners also get these in the app${'' /* email via billing-reminders */} and by email (when email is set up). Tap WhatsApp to send a friendly nudge, then Done.</div>
      ${list.length ? list.map((r) => `<div class="pl-row" style="gap:10px;flex-wrap:wrap">
          <span style="min-width:0;flex:1"><b>${esc(r.property)}</b> <span class="ns-pill ${KIND[r.kind][1]}">${KIND[r.kind][0]}</span><br>
            <span class="ns-muted" style="font-size:12px">${esc(r.owner || '')}${r.phone ? ' · ' + esc(r.phone) : ''} · ends ${fmtDate(r.ends_at)}${r.emailed_at ? ' · ✉ emailed' : ''}</span></span>
          <span style="display:flex;gap:6px">${r.phone ? `<a class="ns-btn" style="height:32px;font-size:12px;background:#25D366;border-color:#25D366" target="_blank" rel="noopener" href="${esc(wa(r))}">WhatsApp</a>` : ''}
            <button type="button" class="ns-btn-ghost" style="height:32px;font-size:12px" data-rem-done="${esc(r.id)}">Done</button></span></div>`).join('')
        : '<div class="ns-empty" style="padding:12px">Nothing to follow up. 🎉</div>'}`;
    host.querySelectorAll('[data-rem-done]').forEach((b) => b.onclick = async () => { await rpc('admin_mark_reminder', { p_id: b.dataset.remDone, p_done: true }); drawReminders(); });
    host.querySelector('#rem-run').onclick = async (e) => { e.target.disabled = true; const n = await rpc('run_billing_reminders').catch((err) => { toast(err.message, { error: true }); return null; });
      if (n !== null) toast(n ? `${n} new reminder${n > 1 ? 's' : ''} sent in the app.` : 'No new reminders today.'); drawReminders(); };
  };
  setTimeout(drawReminders, 0);
  const c = d.counts;
  setSubtitle(`${d.total} properties on NammaStay`);
  const stat = (l, v, sub = '', dark = false) => `<div class="ns-stat${dark ? ' is-dark' : ''}"><div class="ns-stat-label">${l}</div><div class="ns-stat-value">${v}</div>${sub ? `<div class="ns-stat-sub">${sub}</div>` : ''}</div>`;
  const maxW = Math.max(1, ...d.weekly_signups.map((w) => w.n));
  const att = (title, rows, render, empty) => `<div class="ns-card" style="display:flex;flex-direction:column;gap:6px">
      <div class="ns-h3">${title} <span class="ns-muted" style="font-weight:600">(${rows.length})</span></div>
      ${rows.length ? rows.slice(0, 6).map((r) => `<a class="ns-list-row" href="admin.html?id=${esc(r.id)}" style="color:inherit">
          <div style="min-width:0"><div style="font-weight:700;font-size:13px">${esc(r.name)}</div><div class="ns-muted" style="font-size:11.5px">${esc([r.city, r.owner_email].filter(Boolean).join(' · '))}</div></div>
          <div class="ns-muted" style="white-space:nowrap;font-size:12px">${render(r)}</div></a>`).join('') : `<div class="ns-muted" style="padding:8px 0">${empty}</div>`}
    </div>`;

  content(`
    <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px">
      ${stat('Paying', c.active || 0, `≈ ${rupees(Math.round(d.mrr_paise / 100) * 100)} / month`, true)}
      ${stat('In free trial', c.trial || 0, `${d.signups_30d} new in 30 days`)}
      ${stat('Payment due / ended', (c.grace || 0) + ' / ' + (c.expired || 0), c.suspended ? `${c.suspended} suspended` : '')}
      ${stat('Bookings made', d.bookings_30d.toLocaleString('en-IN'), `last 30 days · ${rupees(d.guest_payments_30d_paise)} taken`)}
    </div>
    ${d.pending_payments ? `<a class="ns-card" href="subscribers.html" style="display:flex;justify-content:space-between;align-items:center;gap:10px;background:#FCF0DC;border-color:#F0DDB6;color:#966016;font-weight:800">
        <span>${d.pending_payments} subscription payment${d.pending_payments > 1 ? 's' : ''} waiting for your confirmation</span><span>Review →</span></a>` : ''}
    <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:20px">
      <div class="ns-card" style="display:flex;flex-direction:column;gap:14px">
        <div style="display:flex;justify-content:space-between;align-items:center"><div class="ns-h3">New sign-ups per week</div><div class="ns-muted">last 12 weeks</div></div>
        <div style="overflow-x:auto"><div class="ns-bars" style="height:170px;gap:8px;min-width:480px">${d.weekly_signups.map((w, i) => `<div class="${i === d.weekly_signups.length - 1 ? 'is-today' : ''}" title="Week of ${fmtDate(w.week + 'T12:00:00+05:30')}: ${w.n}">
            <div style="font-size:11px;font-weight:800">${w.n || ''}</div>
            <div class="bar-fill" style="height:${(w.n / maxW) * 100}%"></div>
            <div class="ns-muted" style="font-size:10px;white-space:nowrap">${fmtDate(w.week + 'T12:00:00+05:30').slice(0, 6)}</div></div>`).join('')}</div></div>
      </div>
      <div style="display:flex;flex-direction:column;gap:16px">
        ${att('Trials ending soon', d.trial_ending, (r) => `ends ${ago(r.ends_at).replace(' ago', '') === 'Today' ? 'today' : fmtDate(r.ends_at)}`, 'None in the next 3 days.')}
        ${att('Payment due', d.payment_due, (r) => `ended ${fmtDate(r.ended_at)}`, 'Nobody is overdue. 🎉')}
      </div>
    </div>
    <div class="ns-card" id="rem-card" style="display:flex;flex-direction:column;gap:8px"></div>
    ${att('Not using NammaStay lately', d.inactive, (r) => `last active ${ago(r.last_seen_at || r.last_booking_at).toLowerCase()}`, 'Everyone has been active in the last 2 weeks.')}
    <div class="ns-card" style="padding:0;overflow:hidden">
      <div style="padding:18px 20px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
        <div class="ns-h3">All properties</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap" id="chips">
          ${[['', `All (${d.total})`], ...Object.entries(STATE).filter(([k]) => c[k]).map(([k, [l]]) => [k, `${l} (${c[k]})`])]
            .map(([v, l]) => `<button type="button" class="ns-chip${v === filter ? ' is-on' : ''}" data-f="${v}">${l}</button>`).join('')}
        </div>
      </div>
      <div style="overflow-x:auto"><table class="ns-table" style="min-width:880px"><thead><tr><th>Property</th><th>Owner</th><th>Status</th><th>Beds / rooms</th><th>Bookings (30d)</th><th>Last active</th><th>Joined</th></tr></thead>
        <tbody id="rows"></tbody></table></div>
    </div>`);

  function drawTable() {
    const rows = d.properties.filter((p) => (!filter || p.state === filter)
      && (!q || [p.name, p.city, p.owner_email].some((x) => (x || '').toLowerCase().includes(q))));
    $('#rows').innerHTML = rows.map((p) => `<tr data-href="admin.html?id=${esc(p.id)}" tabindex="0" style="cursor:pointer">
        <td style="font-weight:700">${esc(p.name)}<div class="ns-muted" style="font-weight:500">${esc(p.city || '')}</div></td>
        <td>${esc(p.owner_email || '—')}</td><td>${statePill(p.state)}</td><td>${p.beds}</td><td>${p.bookings_30d}</td>
        <td class="ns-muted">${ago(p.last_seen_at)}</td><td class="ns-muted">${fmtDate(p.created_at)}</td></tr>`).join('')
      || '<tr><td colspan="7" class="ns-empty">No properties match.</td></tr>';
  }
  drawTable();
  $('#chips').addEventListener('click', (e) => { const b = e.target.closest('[data-f]'); if (!b) return; filter = b.dataset.f;
    $$('#chips [data-f]').forEach((x) => x.classList.toggle('is-on', x === b)); drawTable(); });
  $('#rows').addEventListener('click', (e) => { const tr = e.target.closest('tr[data-href]'); if (tr) location.href = tr.dataset.href; });
}

// ------------------------------------------------------------ one property
async function propertyView(id) {
  const d = await rpc('admin_property', { p_property: id });
  const invs = await rpc('admin_platform_invoices', { p_property: id }).catch(() => []);
  const invBy = Object.fromEntries((invs || []).map((x) => [x.payment_id, x]));
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-pinv]'); if (b && invBy[b.dataset.pinv]) openPlatformInvoice(invBy[b.dataset.pinv].doc); });
  const p = d.property; const s = d.subscription; const u = d.usage;
  const owner = d.members.find((m) => m.role === 'owner');
  document.title = `${p.name} · Admin · NammaStay`;
  setSubtitle(`${[p.city, p.kind].filter(Boolean).join(' · ')} · joined ${fmtDate(p.created_at)}`);
  const title = $('.ns-main > [style*="height:76px"] [style*="font-size:21px"]'); if (title) title.textContent = p.name;
  const wa = waNumber(p.phone);
  headerActions().innerHTML = `<a class="ns-btn-ghost" href="admin.html">← All properties</a>
    ${wa ? `<a class="ns-btn" style="background:#25D366;border-color:#25D366" href="https://wa.me/${wa}" target="_blank" rel="noopener">WhatsApp owner</a>` : ''}
    ${owner?.email ? `<a class="ns-btn-ghost" href="mailto:${esc(owner.email)}">Email owner</a>` : ''}`;
  const until = s.state === 'trial' ? `Trial until ${fmtDate(s.trial_ends_at)}` : s.paid_until ? `Paid until ${fmtDate(s.paid_until)}` : `Trial ended ${fmtDate(s.trial_ends_at)}`;
  const row = (l, v) => `<div style="display:flex;justify-content:space-between;gap:12px;font-size:13px;padding:6px 0;border-bottom:1px solid #F3EFE1"><span class="ns-muted" style="font-size:13px">${l}</span><b style="text-align:right">${v}</b></div>`;
  const HIST = { pending: ['Waiting', 'amber'], approved: ['Approved', 'green'], rejected: ['Rejected', 'red'] };

  content(`
    ${s.state === 'suspended' ? `<div class="ns-card" style="background:#FCE9E9;border-color:#F0C9C9;color:#B23A3A;font-weight:700">Suspended since ${fmtDate(s.suspended_at)} — ${esc(s.suspended_reason || '')}</div>` : ''}
    <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px">
      <div class="ns-stat"><div class="ns-stat-label">Status</div><div style="margin-top:8px">${statePill(s.state)}</div><div class="ns-stat-sub">${esc(until)}</div></div>
      <div class="ns-stat"><div class="ns-stat-label">Beds</div><div class="ns-stat-value">${u.beds}</div><div class="ns-stat-sub">${u.rooms} room types</div></div>
      <div class="ns-stat"><div class="ns-stat-label">Bookings</div><div class="ns-stat-value">${u.bookings_30d}</div><div class="ns-stat-sub">last 30 days · ${u.bookings_total} total</div></div>
      <div class="ns-stat"><div class="ns-stat-label">Last active</div><div class="ns-stat-value" style="font-size:20px">${ago(u.last_seen_at)}</div><div class="ns-stat-sub">last booking ${ago(u.last_booking_at).toLowerCase()}</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div class="ns-card" style="display:flex;flex-direction:column;gap:4px">
        <div class="ns-h3" style="margin-bottom:6px">Property & owner</div>
        ${row('Owner', esc(owner?.name || '—'))}${row('Owner email', esc(owner?.email || '—'))}
        ${row('Phone', esc(p.phone || '—'))}${row('Address', esc([p.address, p.city].filter(Boolean).join(', ') || '—'))}
        ${row('Guests recorded', u.guests)}${row('Guest payments (30d)', rupees(u.guest_payments_30d_paise))}
        ${row('UPI ID set', p.upi_id ? 'Yes' : '<span style="color:#966016">Not yet</span>')}
      </div>
      <div class="ns-card" style="display:flex;flex-direction:column;gap:10px">
        <div class="ns-h3">Actions</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button type="button" class="ns-btn-ghost" data-extend="30">+30 days</button>
          <button type="button" class="ns-btn-ghost" data-extend="365">+1 year</button>
          <button type="button" class="ns-btn-ghost" id="extend-custom">Extend…</button>
          <button type="button" class="ns-btn-ghost" id="comp">${s.is_complimentary ? 'Remove free access' : 'Make free (complimentary)'}</button>
          ${s.state === 'suspended' ? '<button type="button" class="ns-btn" id="unsuspend">Reactivate account</button>'
            : '<button type="button" class="ns-btn-danger" id="suspend">Suspend account</button>'}
        </div>
        ${field('Private notes (only admins see these)', `<textarea class="ns-input" id="note" maxlength="4000" placeholder="Calls, promises, special pricing…" style="min-height:110px">${esc(s.admin_note || '')}</textarea>`)}
        <button type="button" class="ns-btn-ghost" id="save-note" style="align-self:flex-start">Save notes</button>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1.3fr;gap:20px">
      <div class="ns-card" style="padding:0;overflow:hidden"><div class="ns-h3" style="padding:18px 20px">Team (${d.members.length})</div>
        <div style="overflow-x:auto"><table class="ns-table"><thead><tr><th>Name</th><th>Role</th><th>Last active</th></tr></thead><tbody>
        ${d.members.map((m) => `<tr><td style="font-weight:700">${esc(m.name || m.email)}<div class="ns-muted" style="font-weight:500">${esc(m.email || '')}</div></td>
          <td>${esc(ROLE_LABEL[m.role] || m.role)}</td><td class="ns-muted">${ago(m.last_seen_at)}</td></tr>`).join('')}</tbody></table></div></div>
      <div class="ns-card" style="padding:0;overflow:hidden"><div class="ns-h3" style="padding:18px 20px">Subscription payments</div>
        <div style="overflow-x:auto"><table class="ns-table" style="min-width:520px"><thead><tr><th>Submitted</th><th>Amount</th><th>UTR</th><th>Status</th><th>Covers</th><th>Invoice</th></tr></thead><tbody>
        ${d.payments.map((x) => `<tr><td>${fmtDayTime(x.submitted_at)}</td><td style="font-weight:700">${rupees(x.amount_paise)}</td><td class="ns-muted">${esc(x.utr)}</td>
          <td>${pill(...HIST[x.status])}</td><td class="ns-muted">${x.period_end ? `${fmtDate(x.period_start)} – ${fmtDate(x.period_end)}` : '—'}</td>
          <td>${invBy[x.id] ? `<button type="button" class="ns-btn-ghost" style="height:30px;font-size:12px" data-pinv="${esc(x.id)}">${esc(invBy[x.id].number)}</button>` : '<span class="ns-muted">—</span>'}</td></tr>`).join('')
          || '<tr><td colspan="6" class="ns-empty">No payments yet.</td></tr>'}
        </tbody></table></div>
        ${d.payments.some((x) => x.status === 'pending') ? '<div style="padding:12px 20px;border-top:1px solid #F3EFE1"><a href="subscribers.html" style="font-weight:800">Approve pending payments →</a></div>' : ''}
      </div>
    </div>`);

  const invites = await rpc('admin_property_invites', { p_property: id }).catch(() => []);
  const waiting = invites.filter((x) => !x.claimed_at);
  if (waiting.length) {
    $('.ns-content').insertAdjacentHTML('afterbegin', `<div class="ns-card" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;background:#EAF1FB;border-color:#C9DAF2">
      <div style="font-size:13.5px;color:#2D5FA6"><b>Waiting for the owner to sign up:</b> ${waiting.map((x) => esc(x.email)).join(', ')}<br>
        <span class="ns-muted">They’re linked automatically when they create a login with that email.</span></div>
      <button type="button" class="ns-btn-ghost" id="resend">Send sign-up link</button></div>`);
    $('#resend').onclick = () => inviteMessage({ name: p.name, email: waiting[0].email, owner: waiting[0].name, phone: p.phone, linked: false });
  }
  const act = async (patch, msg) => { try { await rpc('admin_set_property', { p_property: id, p: patch }); toast(msg); propertyView(id); } catch (e) { toast(e.message, { error: true }); } };
  $$('[data-extend]').forEach((b) => b.onclick = () => act({ extend_days: +b.dataset.extend }, `Extended by ${b.dataset.extend} days.`));
  $('#extend-custom').onclick = () => modal({ title: 'Extend access', body: field('Days to add (negative to shorten)', '<input class="ns-input" name="days" type="number" value="15">'),
    actions: [{ label: 'Cancel' }, { label: 'Extend', kind: 'primary', onClick: async (el) => { await act({ extend_days: +el.querySelector('[name=days]').value }, 'Access updated.'); } }] });
  $('#comp').onclick = async () => {
    const on = !s.is_complimentary;
    if (await confirmDialog(on ? 'Make free' : 'Remove free access', on ? `${p.name} will never need to pay.` : `${p.name} will need an active plan again.`, { confirmLabel: on ? 'Make free' : 'Remove' })) act({ complimentary: on }, 'Saved.');
  };
  $('#suspend')?.addEventListener('click', () => modal({
    title: `Suspend ${p.name}?`,
    body: `<p style="margin:0;font-size:14px;line-height:1.6">They can still sign in and see their data, but can’t add bookings, rooms, beds or staff until you reactivate them.</p>
      ${field('Reason (the owner sees this)', '<input class="ns-input" name="why" maxlength="300" placeholder="e.g. Payment disputed — please contact us">')}`,
    actions: [{ label: 'Cancel' }, { label: 'Suspend', kind: 'danger', onClick: async (el) => {
      const why = el.querySelector('[name=why]').value.trim(); if (!why) throw new Error('Add a short reason.');
      await act({ suspend: true, suspend_reason: why }, 'Account suspended.');
    } }] }));
  $('#unsuspend')?.addEventListener('click', () => act({ suspend: false }, 'Account reactivated.'));
  $('#save-note').onclick = () => act({ admin_note: $('#note').value }, 'Notes saved.');
}

// ------------------------------------------------------------ add a property for a customer
function addPropertyDialog() {
  modal({
    title: 'Add a property', width: 620,
    body: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div style="grid-column:1/-1">${field('Property name *', '<input class="ns-input" name="name" maxlength="120" placeholder="e.g. Blue Door Hostel">')}</div>
        ${field('Type', `<select class="ns-input" name="kind">${options([['hostel', 'Hostel'], ['homestay', 'Homestay'], ['hotel', 'Hotel / guest house']], 'hostel')}</select>`)}
        ${field('City', '<input class="ns-input" name="city" maxlength="80">')}
        <div style="grid-column:1/-1">${field('Address', '<input class="ns-input" name="address" maxlength="300">')}</div>
        ${field('Owner’s name', '<input class="ns-input" name="owner_name" maxlength="80">')}
        ${field('Owner’s phone / WhatsApp', '<input class="ns-input" name="phone" type="tel" maxlength="20" placeholder="+91 98400 12233">')}
        <div style="grid-column:1/-1">${field('Owner’s email *', '<input class="ns-input" name="owner_email" type="email">', 'They sign in with this email. If they already use NammaStay, the property is added to their account right away.')}</div>
        ${field('Access', `<select class="ns-input" name="access">${options([['trial', 'Free trial'], ['comp', 'Complimentary (free forever)']], 'trial')}</select>`)}
        <div id="trial-days">${field('Trial days', '<input class="ns-input" name="trial_days" type="number" min="0" max="365" value="15">')}</div>
        <label style="grid-column:1/-1;display:flex;gap:8px;align-items:flex-start;font-size:13px;font-weight:600">
          <input type="checkbox" name="add_me" checked style="margin-top:2px"> Add me as manager, so I can set up their rooms, beds and rates</label>
        <div style="grid-column:1/-1">${field('Private note (optional)', '<input class="ns-input" name="admin_note" maxlength="300" placeholder="e.g. Met at travel expo; agreed ₹27,999/year">')}</div>
      </div>`,
    actions: [{ label: 'Cancel' }, { label: 'Add property', kind: 'primary', onClick: async (el) => {
      const v = (n) => el.querySelector(`[name=${n}]`);
      const r = await rpc('admin_create_property', { p: {
        name: v('name').value, kind: v('kind').value, city: v('city').value, address: v('address').value, phone: v('phone').value,
        owner_name: v('owner_name').value, owner_email: v('owner_email').value, complimentary: v('access').value === 'comp',
        trial_days: v('access').value === 'trial' ? v('trial_days').value : null, add_me: v('add_me').checked, admin_note: v('admin_note').value } });
      toast(`${v('name').value} added.`);
      inviteMessage({ name: v('name').value.trim(), email: v('owner_email').value.trim(), owner: v('owner_name').value.trim(), phone: v('phone').value,
        linked: r.owner_linked, propertyId: r.property_id, addedMe: v('add_me').checked });
    } }],
  });
  const acc = document.querySelector('.ns-modal [name=access]');
  acc.addEventListener('change', () => { document.getElementById('trial-days').hidden = acc.value !== 'trial'; });
}

function inviteMessage({ name, email, owner, phone, linked, propertyId, addedMe }) {
  const first = (owner || '').split(/\s+/)[0] || 'there';
  const link = `${SITE_URL}/${linked ? 'login.html' : 'signup.html?email=' + encodeURIComponent(email)}`;
  const text = `Hi ${first}! 🙏\n\nYour NammaStay account for *${name}* is ready.\n\n`
    + (linked ? `Sign in with ${email} and you’ll find ${name} in your account:\n${link}`
      : `Create your login with this email (${email}) — ${name} will be waiting for you:\n${link}`)
    + `\n\nAny questions, just reply here.\n— NammaStay`;
  const wa = waNumber(phone);
  const m = modal({
    title: linked ? 'Property added to their account ✓' : 'Send the owner their sign-up link', width: 560,
    body: `${linked ? `<div class="ns-demo-hint" style="background:#E9F5EE;color:#157A56">${esc(email)} already has a NammaStay login — ${esc(name)} is in their account now.</div>` : ''}
      ${addedMe && propertyId ? '<div class="ns-help" style="font-size:13px">You’re a manager on this property: tap the property name under your name (bottom of the menu) to switch to it and set up its rooms, beds and rates.</div>' : ''}
      <textarea class="ns-input" id="inv-text" rows="9" style="font-size:13px;line-height:1.5">${esc(text)}</textarea>`,
    actions: [{ label: 'Done', onClick: () => { if (propertyId) location.href = 'admin.html?id=' + propertyId; } },
      { label: 'Copy', onClick: async (el) => { try { await navigator.clipboard.writeText(el.querySelector('#inv-text').value); toast('Copied.'); } catch { toast('Select and copy the text.'); } return false; } },
      { label: 'Email', onClick: (el) => { location.href = `mailto:${email}?subject=${encodeURIComponent('Your NammaStay account for ' + name)}&body=${encodeURIComponent(el.querySelector('#inv-text').value)}`; return false; } },
      { label: wa ? 'WhatsApp' : 'WhatsApp (pick contact)', kind: 'primary', onClick: (el) => {
        window.open(`https://wa.me/${wa}?text=${encodeURIComponent(el.querySelector('#inv-text').value)}`, '_blank', 'noopener'); return false; } }],
  });
  return m;
}
