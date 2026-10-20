// Tenant profile for PG / co-living accounts (no nightly stays, no per-night prices, no invoices).
// Used by guest-profile.js only when ctx.isPg — hostels / hotels / homestays never load this.
import { rpc, q, sb, content, headerActions, setSubtitle, esc, rupees, fmtDate, avatar, titleCase, toast, viewIdDocs,
  deleteGuestDialog, confirmDialog, downloadCsv, ymd, param, $ } from '../core.js';

const day = (d) => (d ? fmtDate(String(d).slice(0, 10) + 'T12:00:00+05:30') : '—');
const STATUS = { active: ['Living here', 'green'], notice: ['On notice', 'amber'], moved_out: ['Moved out', 'grey'] };

async function tenanciesOf(ctx, guestId) {
  try { const r = await rpc('pg_tenants', { p_property: ctx.property_id }); return (r.tenants || []).filter((t) => t.guest?.id === guestId); }
  catch { return []; }
}

export async function pgGuestProfile(ctx, id, editGuest) {
  const back = document.querySelector('.ns-main a[href="bookings.html"]');
  if (back) { back.setAttribute('href', 'guest-profile.html'); back.lastChild.textContent = back.lastChild.textContent.replace(/guests/i, 'tenant profiles'); }
  const titleEl = document.querySelector('.ns-main > [style*="height:76px"] [style*="font-size:21px"]');
  if (titleEl) titleEl.textContent = 'Tenant profile';
  const [d, ts] = await Promise.all([rpc('guest_profile', { p_guest: id }), tenanciesOf(ctx, id)]);
  const g = d.guest;
  document.title = `${g.full_name} · NammaStay`;
  setSubtitle(`Tenant profile · ${ctx.property_name}`);
  const now = ts.find((t) => t.status !== 'moved_out');
  const head = headerActions();
  const wa = g.phone ? `https://wa.me/${g.phone.replace(/\D/g, '')}` : null;
  head.innerHTML = `${wa ? `<a class="ns-btn-ghost" href="${esc(wa)}" target="_blank" rel="noopener">Message tenant</a>` : ''}
    ${now ? `<a class="ns-btn" href="tenants.html?id=${esc(now.id)}">Open tenant</a>`
      : ctx.can('owner', 'manager', 'front_desk') ? '<a class="ns-btn" href="tenants.html?movein=1">+ Move in</a>' : ''}`;
  if (ctx.can('owner', 'manager', 'front_desk')) {
    head.insertAdjacentHTML('afterbegin', '<button type="button" class="ns-btn-ghost" id="edit-guest">✎ Edit profile</button>');
    if (ctx.can('owner', 'manager') && ctx.allow('delete_guests') && !now) head.insertAdjacentHTML('afterbegin', '<button type="button" class="ns-btn-danger" id="delete-guest">Delete</button>');
  }
  const row = (l, v) => `<div style="display:flex;justify-content:space-between;gap:10px;font-size:12.5px;padding:5px 0"><span class="ns-muted" style="font-size:12.5px">${l}</span><b style="font-weight:700;text-align:right">${v}</b></div>`;
  const today = new Date().toISOString().slice(0, 10);
  const stOf = (t) => (t.status === 'active' && String(t.start_date) > today ? 'moving_in' : t.status);
  STATUS.moving_in = ['Moving in', 'blue'];
  const pill = (s) => { const [t, c] = STATUS[s] || [s, 'grey']; return `<span class="ns-pill ${c}">${t}</span>`; };

  content(`
    <div style="display:flex;flex-direction:column;gap:16px;min-width:0">
      <div class="ns-card" style="display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center">
        ${avatar(g.full_name, 64)}
        <div class="ns-h3" style="font-size:18px">${esc(g.full_name)}</div>
        <div class="ns-muted">${esc([g.phone, g.email].filter(Boolean).join(' · '))}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center">${now ? pill(stOf(now)) : ts.length ? pill('moved_out') : '<span class="ns-pill grey">Not a tenant yet</span>'}
          ${g.nationality ? `<span class="ns-pill amber">${esc(g.nationality)}</span>` : ''}</div>
      </div>
      <div class="ns-card"><div class="ns-h3" style="margin-bottom:8px">Identity</div>
        ${row('Date of birth', g.dob ? fmtDate(g.dob + 'T12:00:00+05:30') : '—')}
        ${row('ID type', g.id_type ? esc(titleCase(g.id_type)) : '—')}
        ${row('ID number', esc(g.id_number || '—'))}
        ${g.id_doc_path || g.id_doc_back_path ? `<button type="button" class="ns-btn-ghost" id="view-id" style="width:100%;margin-top:8px">View ID${g.id_doc_path && g.id_doc_back_path ? ' (front & back)' : ''}</button>` : '<div class="ns-muted" style="margin-top:6px">No ID photo on file.</div>'}
      </div>
      <div class="ns-card" style="display:flex;flex-direction:column;gap:10px"><div class="ns-h3">Notes</div>
        <textarea class="ns-input" id="notes" maxlength="2000" placeholder="Food preference, emergency contact, work / college…">${esc(g.notes || '')}</textarea>
        <button type="button" class="ns-btn-ghost" id="save-notes">Save notes</button></div>
    </div>
    <div style="display:flex;flex-direction:column;gap:16px;min-width:0">
      ${now ? `<div class="ns-card-dark" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
          <div><div style="font-weight:700">${now.status === 'notice' ? `Leaving on ${day(now.move_out_on)}` : stOf(now) === 'moving_in' ? `Moving in on ${day(now.start_date)}` : 'Living here'}</div>
            <div style="font-size:12px;color:#AEB6C9">${esc(now.bed.room)} · ${esc(now.bed.label)}${stOf(now) === 'moving_in' ? '' : ` · since ${day(now.start_date)}`}</div></div>
          <a class="ns-btn" href="tenants.html?id=${esc(now.id)}">Open tenant</a></div>` : ''}
      ${now ? `<div class="ns-card"><div class="ns-h3" style="margin-bottom:8px">Rent</div>
          ${row('Rent / month', rupees(now.rent_paise))}${now.food_paise ? row('Food / month', rupees(now.food_paise)) : ''}
          ${row('Deposit held', rupees(now.deposit_held_paise))}
          ${row('Due now', now.due_paise ? `<span style="color:${now.overdue_paise ? '#B23A3A' : 'inherit'}">${rupees(now.due_paise)}</span>` : 'Nothing due')}
          ${row('Next rent day', day(now.next_due_on))}${row('Last paid', now.last_paid_at ? day(now.last_paid_at) : '—')}</div>` : ''}
      <div class="ns-card" style="padding:0;overflow:hidden"><div style="padding:18px 20px" class="ns-h3">Tenancy history</div>
        <div style="overflow-x:auto"><table class="ns-table" style="min-width:520px"><thead><tr><th>Bed</th><th>Moved in</th><th>Moved out</th><th>Rent / month</th><th>Status</th></tr></thead>
        <tbody>${ts.map((t) => `<tr data-href="tenants.html?id=${esc(t.id)}" tabindex="0" style="cursor:pointer">
          <td style="font-weight:700;white-space:normal">${esc(t.bed.room)} · ${esc(t.bed.label)}</td><td>${day(t.start_date)}</td>
          <td>${t.move_out_on ? day(t.move_out_on) : '—'}</td><td>${rupees(t.rent_paise + t.food_paise)}</td><td>${pill(stOf(t))}</td></tr>`).join('')
          || '<tr><td colspan="5" class="ns-empty">Not moved in yet.</td></tr>'}</tbody></table></div></div>
    </div>`, 'padding:24px 32px;display:grid;grid-template-columns:340px 1fr;gap:20px;');

  $('#edit-guest')?.addEventListener('click', () => editGuest(ctx, g));
  if (param('edit') && $('#edit-guest')) { history.replaceState(null, '', 'guest-profile.html?id=' + g.id); editGuest(ctx, g); }
  $('#delete-guest')?.addEventListener('click', () => deleteGuestDialog(ctx, g.id, () => setTimeout(() => { location.href = 'guest-profile.html'; }, 600))
    .catch((e) => toast(e.message, { error: true })));
  $('#view-id')?.addEventListener('click', () => viewIdDocs({ front: g.id_doc_path, back: g.id_doc_back_path, name: g.full_name }).catch((e) => toast(e.message, { error: true })));
  $('#save-notes').onclick = async () => {
    try { await q(sb.from('guests').update({ notes: $('#notes').value.trim() || null }).eq('id', g.id)); toast('Notes saved.'); }
    catch (e) { toast(e.message, { error: true }); }
  };
  document.querySelector('.ns-content').addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-href]'); if (tr) location.href = tr.dataset.href;
  });
}

// CSV of tenant profiles: bed, status, dates, monthly rent — no stays / nights.
export async function exportTenantProfiles(ctx, btn) {
  if (!await confirmDialog('Export tenant profiles', 'The file contains personal details (names, phones, emails, ID numbers). Keep it private and delete it when you’re done.', { confirmLabel: 'Download CSV' })) return;
  btn.disabled = true; const label = btn.textContent; btn.textContent = 'Preparing…';
  try {
    const out = [];
    for (let from = 0; ; from += 1000) {
      const rows = await q(sb.from('guests').select('id, full_name, phone, email, nationality, dob, id_type, id_number, notes, created_at')
        .eq('property_id', ctx.property_id).order('created_at').range(from, from + 999));
      out.push(...rows); if (rows.length < 1000) break;
    }
    const ts = (await rpc('pg_tenants', { p_property: ctx.property_id }).catch(() => ({}))).tenants || [];
    const byGuest = {};
    for (const t of ts) if (!byGuest[t.guest.id] || t.status !== 'moved_out') byGuest[t.guest.id] = t;   // current tenancy wins
    const ID = { aadhaar: 'Aadhaar', passport: 'Passport', driving_licence: 'Driving licence', voter_id: 'Voter ID', other: 'Other' };
    const S = { active: 'Living here', notice: 'On notice', moved_out: 'Moved out' };
    const rows = [['Name', 'Phone', 'Email', 'Nationality', 'Date of birth', 'ID type', 'ID number', 'Bed', 'Status', 'Moved in', 'Moving out', 'Rent + food / month (₹)', 'Due now (₹)', 'Added on', 'Notes'],
      ...out.map((g) => { const t = byGuest[g.id];
        return [g.full_name, g.phone, g.email, g.nationality, g.dob, ID[g.id_type] || g.id_type || '', g.id_number,
          t ? `${t.bed.room} · ${t.bed.label}` : '', t ? S[t.status] : 'Not a tenant', t?.start_date || '', t?.move_out_on || '',
          t ? ((t.rent_paise + t.food_paise) / 100).toFixed(2) : '', t ? (t.due_paise / 100).toFixed(2) : '', g.created_at ? ymd(g.created_at) : '', g.notes]; })];
    downloadCsv(`tenants_${ctx.property_name.replace(/\W+/g, '-').toLowerCase()}_${ymd()}.csv`, rows);
    toast(`${out.length} profile${out.length === 1 ? '' : 's'} exported.`);
  } catch (err) { toast(err.message, { error: true }); } finally { btn.disabled = false; btn.textContent = label; }
}
