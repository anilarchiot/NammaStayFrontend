import { W, openInvoice, countryOptions, downloadCsv, ymd, deleteGuestDialog, deleteBookingDialog, modal, field, options, ID_TYPES, compressImage, uploadIdDoc, newId, page, rpc, q, sb, confirmDialog, content, setSubtitle, headerActions, headerSearch, esc, rupees, fmtDate, fmtDay, avatar, statusPill, titleCase,
  toast, viewIdDocs, idUploadFields, wireIdPreviews, uploadIdSides, param, uuidOk, $ } from '../core.js';

page('guests', async (ctx) => {
  const id = param('id');
  if (!uuidOk(id)) return guestList(ctx);

  const back = document.querySelector('.ns-main a[href="bookings.html"]');
  if (back) back.setAttribute('href', 'guest-profile.html');
  const d = await rpc('guest_profile', { p_guest: id });
  const g = d.guest;
  document.title = `${g.full_name} · NammaStay`;
  const head = headerActions();
  const wa = g.phone ? `https://wa.me/${g.phone.replace(/\D/g, '')}` : null;
  head.innerHTML = `${wa ? `<a class="ns-btn-ghost" href="${esc(wa)}" target="_blank" rel="noopener">Message guest</a>` : ''}
    <a class="ns-btn" href="check-in.html?guest=${esc(g.id)}">+ New booking</a>`;
  if (ctx.can('owner', 'manager', 'front_desk')) {
    head.insertAdjacentHTML('afterbegin', '<button type="button" class="ns-btn-ghost" id="edit-guest">✎ Edit profile</button>');
    if (ctx.can('owner', 'manager') && ctx.allow('delete_guests')) head.insertAdjacentHTML('afterbegin', '<button type="button" class="ns-btn-danger" id="delete-guest">Delete guest</button>');
  }

  const canDelete = ctx.can('owner', 'manager', 'front_desk') && ctx.allow('delete_bookings');
  const row = (l, v) => `<div style="display:flex;justify-content:space-between;gap:10px;font-size:12.5px;padding:5px 0"><span class="ns-muted" style="font-size:12.5px">${l}</span><b style="font-weight:700;text-align:right">${v}</b></div>`;
  content(`
    <div style="display:flex;flex-direction:column;gap:16px;min-width:0">
      <div class="ns-card" style="display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center">
        ${avatar(g.full_name, 64)}
        <div class="ns-h3" style="font-size:18px">${esc(g.full_name)}</div>
        <div class="ns-muted">${esc([g.phone, g.email].filter(Boolean).join(' · '))}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center">
          ${d.visits > 1 ? '<span class="ns-pill green">Repeat guest</span>' : ''}${g.nationality ? `<span class="ns-pill amber">${esc(g.nationality)}</span>` : ''}</div>
      </div>
      <div class="ns-card"><div class="ns-h3" style="margin-bottom:8px">Identity</div>
        ${row('Date of birth', g.dob ? fmtDate(g.dob + 'T12:00:00+05:30') : '—')}
        ${row('ID type', g.id_type ? esc(titleCase(g.id_type)) : '—')}
        ${row('ID number', esc(g.id_number || '—'))}
        ${g.id_doc_path || g.id_doc_back_path ? `<button type="button" class="ns-btn-ghost" id="view-id" style="width:100%;margin-top:8px">View ID${g.id_doc_path && g.id_doc_back_path ? ' (front & back)' : ''}</button>` : '<div class="ns-muted" style="margin-top:6px">No ID photo on file.</div>'}
      </div>
      <div class="ns-card"><div class="ns-h3" style="margin-bottom:8px">Lifetime</div>
        ${row('Total stays', d.visits)}${row('Total paid', rupees(d.spend_paise))}
        ${row('Last stay', d.last_stay ? `${fmtDay(d.last_stay.check_in_at)} – ${fmtDate(d.last_stay.check_out_at)}` : '—')}</div>
      <div class="ns-card" style="display:flex;flex-direction:column;gap:10px"><div class="ns-h3">Notes</div>
        <textarea class="ns-input" id="notes" maxlength="2000" placeholder="Preferences, requests…">${esc(g.notes || '')}</textarea>
        <button type="button" class="ns-btn-ghost" id="save-notes">Save notes</button></div>
    </div>
    <div style="display:flex;flex-direction:column;gap:16px;min-width:0">
      <div class="ns-card" style="padding:0;overflow:hidden"><div style="padding:18px 20px" class="ns-h3">Stay history</div>
        <div style="overflow-x:auto"><table class="ns-table" style="min-width:560px"><thead><tr><th>Booking</th><th>${W.Unit}</th><th>Check-in</th><th>Check-out</th><th>Paid</th><th>Status</th><th class="ns-sticky-end"><span class="sr-only">Actions</span></th></tr></thead>
        <tbody>${d.stays.map((s) => `<tr data-href="booking-detail.html?id=${esc(s.id)}" tabindex="0" style="cursor:pointer"><td style="font-weight:700">${esc(s.code)}</td>
          <td style="white-space:normal;min-width:130px">${esc(s.room)} · ${esc(s.bed)}</td><td>${fmtDate(s.check_in_at)}</td><td>${fmtDate(s.check_out_at)}</td>
          <td style="font-weight:700">${rupees(s.paid_paise)}</td><td>${statusPill(s.status)}</td>
          <td class="ns-sticky-end" style="width:${canDelete ? 84 : 44}px;text-align:right;white-space:nowrap"><button type="button" class="ns-icon-edit" data-inv="${esc(s.id)}"
            aria-label="Invoice for ${esc(s.code)}" title="Invoice / bill" style="background:none;cursor:pointer"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2h9l5 5v15H6z"></path><path d="M14 2v6h6"></path><path d="M9 13h6M9 17h6"></path></svg></button>${canDelete ? `<button type="button" class="ns-icon-del" data-del="${esc(s.id)}"
            aria-label="Delete ${esc(s.code)} (${esc(fmtDate(s.check_in_at))} – ${esc(fmtDate(s.check_out_at))})" title="Delete this stay"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"></path><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"></path><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"></path><path d="M10 11v6M14 11v6"></path></svg></button>` : ''}</td></tr>`).join('')
          || '<tr><td colspan="7" class="ns-empty">No stays yet.</td></tr>'}</tbody></table></div></div>
      ${d.current ? `<div class="ns-card-dark" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
          <div><div style="font-weight:700">Currently checked in</div><div style="font-size:12px;color:#AEB6C9">${esc(d.current.room)} · ${esc(d.current.bed)} · until ${fmtDate(d.current.check_out_at)}</div></div>
          <a class="ns-btn" href="booking-detail.html?id=${esc(d.current.id)}">View active booking</a></div>` : ''}
    </div>`, 'padding:24px 32px;display:grid;grid-template-columns:340px 1fr;gap:20px;');

  $('#edit-guest')?.addEventListener('click', () => editGuest(ctx, g));
  $('#delete-guest')?.addEventListener('click', () => deleteGuestDialog(ctx, g.id, () => setTimeout(() => { location.href = 'guest-profile.html'; }, 600))
    .catch((e) => toast(e.message, { error: true })));
  if (param('edit') && $('#edit-guest')) { history.replaceState(null, '', 'guest-profile.html?id=' + g.id); editGuest(ctx, g); }
  $('#view-id')?.addEventListener('click', () => viewIdDocs({ front: g.id_doc_path, back: g.id_doc_back_path, name: g.full_name }).catch((e) => toast(e.message, { error: true })));
  $('#save-notes').onclick = async () => {
    try { await q(sb.from('guests').update({ notes: $('#notes').value.trim() || null }).eq('id', g.id)); toast('Notes saved.'); }
    catch (e) { toast(e.message, { error: true }); }
  };
  document.querySelector('.ns-content').addEventListener('click', (e) => {
    const inv = e.target.closest('[data-inv]');
    if (inv) { e.stopPropagation(); openInvoice(inv.dataset.inv).catch((err) => toast(err.message, { error: true })); return; }
    const del = e.target.closest('[data-del]');
    if (del) {
      e.stopPropagation();
      const st = d.stays.find((x) => x.id === del.dataset.del);
      deleteBookingDialog({ ctx, id: st.id, guest: g.full_name, room: st.room, bed: st.bed, checkIn: st.check_in_at, checkOut: st.check_out_at,
        status: st.status, paidPaise: st.paid_paise, onDone: () => setTimeout(() => location.reload(), 500) });
      return;
    }
    const tr = e.target.closest('tr[data-href]'); if (tr) location.href = tr.dataset.href;
  });
});

async function guestList(ctx) {
  document.querySelector('.ns-main a[href="bookings.html"]')?.remove();
  const titleEl = document.querySelector('.ns-main > [style*="height:76px"] [style*="font-size:21px"]');
  if (titleEl) titleEl.textContent = 'Guests';
  setSubtitle(ctx.property_name);
  const head = headerActions();
  const canDel = ctx.can('owner', 'manager') && ctx.allow('delete_guests');
  head.innerHTML = '<div class="ns-search"><span>Search</span></div>' + (ctx.allow('export_data') ? '<button type="button" class="ns-btn-ghost" id="export-guests">Export CSV</button>' : '');
  document.getElementById('export-guests')?.addEventListener('click', (e) => exportGuests(ctx, e.target));
  const recent = await q(sb.from('guests').select('id, full_name, phone, nationality, created_at')
    .eq('property_id', ctx.property_id).order('created_at', { ascending: false }).limit(25));
  const render = (rows, title) => content(`<div class="ns-card" style="padding:0;overflow:hidden">
      <div style="padding:18px 20px" class="ns-h3">${esc(title)}</div>
      <div style="overflow-x:auto"><table class="ns-table" style="min-width:520px"><thead><tr><th>Guest</th><th>Phone</th><th>Nationality</th><th class="ns-sticky-end"><span class="sr-only">Actions</span></th></tr></thead><tbody>
      ${rows.map((g) => `<tr data-href="guest-profile.html?id=${esc(g.id)}" tabindex="0" style="cursor:pointer"><td><div style="display:flex;gap:10px;align-items:center">${avatar(g.full_name)}<b>${esc(g.full_name)}</b></div></td>
        <td>${esc(g.phone || '—')}</td><td>${esc(g.nationality || '—')}</td>
        <td class="ns-sticky-end" style="white-space:nowrap;text-align:right">
          <a class="ns-icon-edit" href="guest-profile.html?id=${esc(g.id)}&edit=1" aria-label="Edit ${esc(g.full_name)}" title="Edit profile"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"></path></svg></a>
          ${canDel ? `<button type="button" class="ns-icon-del" data-del-guest="${esc(g.id)}" aria-label="Delete ${esc(g.full_name)}" title="Delete guest"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"></path><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"></path><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"></path><path d="M10 11v6M14 11v6"></path></svg></button>` : ''}</td></tr>`).join('')
        || '<tr><td colspan="4" class="ns-empty">No guests found.</td></tr>'}
      </tbody></table></div></div>`);
  render(recent, 'Recently added guests');
  headerSearch('Search name or phone…', async (v) => {
    if (v.length < 3) return render(recent, 'Recently added guests');
    render(await rpc('search_guests', { p_property: ctx.property_id, p_q: v }), `Results for “${v}”`);
  });
  document.querySelector('.ns-content').addEventListener('click', (e) => {
    const del = e.target.closest('[data-del-guest]');
    if (del) { e.stopPropagation(); deleteGuestDialog(ctx, del.dataset.delGuest, () => setTimeout(() => location.reload(), 500)).catch((err) => toast(err.message, { error: true })); return; }
    if (e.target.closest('.ns-icon-edit')) return;                    // the link handles it
    const tr = e.target.closest('tr[data-href]'); if (tr) location.href = tr.dataset.href;
  });
}

function editGuest(ctx, g) {
  modal({
    title: 'Edit guest profile', width: 600,
    body: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <div style="grid-column:1/-1">${field('Full name *', `<input class="ns-input" name="full_name" maxlength="120" value="${esc(g.full_name)}">`)}</div>
        ${field('Phone', `<input class="ns-input" name="phone" type="tel" value="${esc(g.phone || '')}" placeholder="+91 98400 12233">`)}
        ${field('Email', `<input class="ns-input" name="email" type="email" value="${esc(g.email || '')}">`)}
        ${field('Date of birth', `<input class="ns-input" name="dob" type="date" value="${esc(g.dob || '')}">`)}
        ${field('Nationality', `<select class="ns-input" name="nationality">${countryOptions(g.nationality || '')}</select>`)}
        ${field('Proof of identity', `<select class="ns-input" name="id_type"><option value="">None</option>${options(ID_TYPES, g.id_type || '')}</select>`)}
        ${field('ID number', `<input class="ns-input" name="id_number" autocomplete="off" value="${esc(g.id_number || '')}">`, 'Aadhaar: only the last 4 digits are kept.')}
        <div style="grid-column:1/-1">${idUploadFields({ front: g.id_doc_path ? 'ID front — replace (optional)' : 'ID front (optional)',
          back: g.id_doc_back_path ? 'ID back — replace (optional)' : 'ID back (optional)', hasFront: !!g.id_doc_path, hasBack: !!g.id_doc_back_path })}
          <div class="ns-help" style="margin-top:6px">${g.id_doc_path || g.id_doc_back_path ? 'An old photo is deleted when you replace it.' : 'Compressed before upload.'}</div></div>
        <div style="grid-column:1/-1">${field('Notes', `<textarea class="ns-input" name="notes" maxlength="2000" placeholder="Preferences, requests…">${esc(g.notes || '')}</textarea>`)}</div>
      </div>`,
    actions: [{ label: 'Cancel' }, { label: 'Save changes', kind: 'primary', onClick: async (el) => {
      const v = (n) => el.querySelector(`[name=${n}]`).value.trim();
      if (v('full_name').length < 2) throw new Error('Please enter the guest’s full name.');
      const p = { full_name: v('full_name'), phone: v('phone'), email: v('email'), dob: v('dob'), nationality: v('nationality'),
        id_type: v('id_type'), id_number: v('id_number'), notes: v('notes') };
      Object.assign(p, await uploadIdSides(el, `${ctx.property_id}/staff`));
      const r = await rpc('update_guest', { p_guest: g.id, p });
      const old = [r.old_id_doc_path, r.old_id_doc_back_path].filter(Boolean);
      if (old.length) await sb.storage.from('guest-ids').remove(old).catch(() => {});
      toast('Guest profile saved.');
      setTimeout(() => location.reload(), 400);
    } }],
  });
  wireIdPreviews(document.querySelector('.ns-modal'));
}

// ------------------------------------------------------------ export all guests (owner / manager)
async function fetchAll(build) {                     // pages of 1,000 rows
  const out = [];
  for (let from = 0; ; from += 1000) {
    const rows = await q(build().range(from, from + 999));
    out.push(...rows); if (rows.length < 1000) return out;
  }
}
async function exportGuests(ctx, btn) {
  if (!await confirmDialog('Export guests', 'The file contains guests’ personal details (names, phones, emails, ID numbers). Keep it private and delete it when you’re done.', { confirmLabel: 'Download CSV' })) return;
  btn.disabled = true; const label = btn.textContent; btn.textContent = 'Preparing…';
  try {
    const [guests, bookings] = await Promise.all([
      fetchAll(() => sb.from('guests').select('id, full_name, phone, email, nationality, dob, id_type, id_number, notes, created_at').eq('property_id', ctx.property_id).order('created_at')),
      fetchAll(() => sb.from('bookings').select('guest_id, status, nights, paid_paise, check_in_at').eq('property_id', ctx.property_id).order('check_in_at')),
    ]);
    const st = {};
    for (const b of bookings) {
      const x = st[b.guest_id] || (st[b.guest_id] = { stays: 0, nights: 0, paid: 0, last: null, upcoming: 0 });
      x.paid += b.paid_paise || 0;
      if (['checked_in', 'checked_out'].includes(b.status)) { x.stays += 1; x.nights += b.nights || 0; if (!x.last || b.check_in_at > x.last) x.last = b.check_in_at; }
      if (['pending', 'confirmed'].includes(b.status)) x.upcoming += 1;
    }
    const d = (iso) => (iso ? ymd(iso) : '');
    const ID = { aadhaar: 'Aadhaar', passport: 'Passport', driving_licence: 'Driving licence', voter_id: 'Voter ID', other: 'Other' };
    const rows = [['Name', 'Phone', 'Email', 'Nationality', 'Date of birth', 'ID type', 'ID number', 'Stays', 'Nights', 'Upcoming bookings', 'Total paid (₹)', 'Last stay', 'Added on', 'Notes'],
      ...guests.map((g) => { const x = st[g.id] || { stays: 0, nights: 0, paid: 0, last: null, upcoming: 0 };
        return [g.full_name, g.phone, g.email, g.nationality, g.dob, ID[g.id_type] || g.id_type || '', g.id_number, x.stays, x.nights, x.upcoming,
          (x.paid / 100).toFixed(2), d(x.last), d(g.created_at), g.notes]; })];
    downloadCsv(`guests_${ctx.property_name.replace(/\W+/g, '-').toLowerCase()}_${ymd()}.csv`, rows);
    toast(`${guests.length} guest${guests.length === 1 ? '' : 's'} exported.`);
  } catch (err) { toast(err.message, { error: true }); } finally { btn.disabled = false; btn.textContent = label; }
}
