import { page, rpc, q, sb, content, setSubtitle, headerActions, headerSearch, esc, rupees, fmtDate, fmtDay, avatar, statusPill, titleCase,
  toast, openIdDoc, param, uuidOk, $ } from '../core.js';

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
        ${g.id_doc_path ? '<button type="button" class="ns-btn-ghost" id="view-id" style="width:100%;margin-top:8px">View ID photo</button>' : '<div class="ns-muted" style="margin-top:6px">No ID photo on file.</div>'}
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
        <div style="overflow-x:auto"><table class="ns-table" style="min-width:560px"><thead><tr><th>Booking</th><th>Bed</th><th>Check-in</th><th>Check-out</th><th>Paid</th><th>Status</th></tr></thead>
        <tbody>${d.stays.map((s) => `<tr data-href="booking-detail.html?id=${esc(s.id)}" tabindex="0" style="cursor:pointer"><td style="font-weight:700">${esc(s.code)}</td>
          <td>${esc(s.room)} · ${esc(s.bed)}</td><td>${fmtDate(s.check_in_at)}</td><td>${fmtDate(s.check_out_at)}</td>
          <td style="font-weight:700">${rupees(s.paid_paise)}</td><td>${statusPill(s.status)}</td></tr>`).join('') || '<tr><td colspan="6" class="ns-empty">No stays yet.</td></tr>'}</tbody></table></div></div>
      ${d.current ? `<div class="ns-card-dark" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
          <div><div style="font-weight:700">Currently checked in</div><div style="font-size:12px;color:#AEB6C9">${esc(d.current.room)} · ${esc(d.current.bed)} · until ${fmtDate(d.current.check_out_at)}</div></div>
          <a class="ns-btn" href="booking-detail.html?id=${esc(d.current.id)}">View active booking</a></div>` : ''}
    </div>`, 'padding:24px 32px;display:grid;grid-template-columns:340px 1fr;gap:20px;');

  $('#view-id')?.addEventListener('click', () => openIdDoc(g.id_doc_path).catch((e) => toast(e.message, { error: true })));
  $('#save-notes').onclick = async () => {
    try { await q(sb.from('guests').update({ notes: $('#notes').value.trim() || null }).eq('id', g.id)); toast('Notes saved.'); }
    catch (e) { toast(e.message, { error: true }); }
  };
  document.querySelector('.ns-content').addEventListener('click', (e) => { const tr = e.target.closest('tr[data-href]'); if (tr) location.href = tr.dataset.href; });
});

async function guestList(ctx) {
  document.querySelector('.ns-main a[href="bookings.html"]')?.remove();
  const titleEl = document.querySelector('.ns-main > [style*="height:76px"] [style*="font-size:21px"]');
  if (titleEl) titleEl.textContent = 'Guests';
  setSubtitle(ctx.property_name);
  const head = headerActions();
  head.innerHTML = '<div class="ns-search"><span>Search</span></div>';
  const recent = await q(sb.from('guests').select('id, full_name, phone, nationality, created_at')
    .eq('property_id', ctx.property_id).order('created_at', { ascending: false }).limit(25));
  const render = (rows, title) => content(`<div class="ns-card" style="padding:0;overflow:hidden">
      <div style="padding:18px 20px" class="ns-h3">${esc(title)}</div>
      <table class="ns-table"><thead><tr><th>Guest</th><th>Phone</th><th>Nationality</th></tr></thead><tbody>
      ${rows.map((g) => `<tr data-href="guest-profile.html?id=${esc(g.id)}" tabindex="0" style="cursor:pointer"><td><div style="display:flex;gap:10px;align-items:center">${avatar(g.full_name)}<b>${esc(g.full_name)}</b></div></td>
        <td>${esc(g.phone || '—')}</td><td>${esc(g.nationality || '—')}</td></tr>`).join('') || '<tr><td colspan="3" class="ns-empty">No guests found.</td></tr>'}
      </tbody></table></div>`);
  render(recent, 'Recently added guests');
  headerSearch('Search name or phone…', async (v) => {
    if (v.length < 3) return render(recent, 'Recently added guests');
    render(await rpc('search_guests', { p_property: ctx.property_id, p_q: v }), `Results for “${v}”`);
  });
  document.querySelector('.ns-content').addEventListener('click', (e) => { const tr = e.target.closest('tr[data-href]'); if (tr) location.href = tr.dataset.href; });
}
