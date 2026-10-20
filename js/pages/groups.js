// Groups & events — resorts (034_resort.sql): many room bookings under one group (wedding, corporate…),
// one group bill, one payment split over the rooms (normal payments + receipts), print / WhatsApp.
import { page, rpc, content, setSubtitle, headerActions, esc, rupees, toPaise, fmtDay, fmtDate, toast, modal, field, options, METHOD_OPTIONS, waNumber, param, statusPill, $ } from '../core.js';
import { GROUP_KINDS } from './resort.js';

const KIND = Object.fromEntries(GROUP_KINDS);

page('groups', async (ctx) => {
  const staff = ctx.can('owner', 'manager', 'front_desk');
  const id = param('id');
  if (id) return groupView(ctx, id, staff);
  setSubtitle(ctx.property_name);
  const head = headerActions();
  head.innerHTML = staff ? '<a class="ns-btn" href="check-in.html?new=1&whole=1">+ New group booking</a>' : '';
  const list = await rpc('groups_list', { p_property: ctx.property_id });
  content(`<div class="ns-card" style="padding:0;overflow:hidden">
      <div style="padding:18px 20px"><div class="ns-h3">Groups & events</div><div class="ns-muted">Weddings, corporate offsites, family functions — all their rooms on one bill. Make one from New booking → “Group / event booking”.</div></div>
      <div style="overflow-x:auto"><table class="ns-table" style="min-width:680px"><thead><tr><th>Group</th><th>Dates</th><th>Rooms</th><th>Guests</th><th style="text-align:right">Total</th><th style="text-align:right">Due</th></tr></thead><tbody>
      ${list.map((g) => `<tr data-href="groups.html?id=${esc(g.id)}" tabindex="0" style="cursor:pointer"><td><b>${esc(g.name)}</b><div class="ns-muted" style="font-size:11.5px">${esc(KIND[g.kind] || g.kind)}${g.contact_name ? ` · ${esc(g.contact_name)}` : ''}</div></td>
          <td>${g.check_in_at ? `${fmtDay(g.check_in_at)} – ${fmtDate(g.check_out_at)}` : '—'}</td><td>${g.rooms}</td><td>${g.guests}</td>
          <td style="text-align:right">${rupees(g.total_paise)}</td><td style="text-align:right;font-weight:700;${g.balance_paise > 0 ? 'color:#B23A3A' : 'color:#157A56'}">${g.balance_paise > 0 ? rupees(g.balance_paise) : 'Paid'}</td></tr>`).join('')
        || '<tr><td colspan="6" class="ns-empty">No groups yet.</td></tr>'}</tbody></table></div></div>`);
  document.querySelector('.ns-content').addEventListener('click', (e) => { const tr = e.target.closest('tr[data-href]'); if (tr) location.href = tr.dataset.href; });
});

async function groupView(ctx, id, staff) {
  const back = document.querySelector('.ns-main > [style*="height:76px"] [style*="font-size:21px"]');
  const g = await rpc('group_get', { p_group: id });
  if (back) back.innerHTML = `<a href="groups.html" style="color:inherit">Groups</a> › ${esc(g.name)}`;
  document.title = `${g.name} · NammaStay`;
  setSubtitle(`${esc(KIND[g.kind] || g.kind)}${g.check_in_at ? ` · ${fmtDay(g.check_in_at)} – ${fmtDate(g.check_out_at)}` : ''} · ${g.rooms} room${g.rooms === 1 ? '' : 's'} · ${g.guests} guests`);
  const head = headerActions();
  const canPay = ctx.allow('record_payments');
  head.innerHTML = `<button type="button" class="ns-btn-ghost" id="g-print">Print group bill</button>
    ${waNumber(g.contact_phone) ? '<button type="button" class="ns-btn-ghost" id="g-wa">WhatsApp bill</button>' : ''}
    ${staff ? '<button type="button" class="ns-btn-ghost" id="g-edit">Edit</button>' : ''}
    ${canPay && g.balance_paise > 0 ? '<button type="button" class="ns-btn" id="g-pay">Collect group payment</button>' : ''}`;
  content(`
    <div class="rs-kpis">
      <div class="ns-card pf-kpi"><div class="pf-lbl">Group total</div><div class="pf-num">${rupees(g.total_paise)}</div><div class="pf-sub">${g.rooms} rooms · rooms + extras</div></div>
      <div class="ns-card pf-kpi"><div class="pf-lbl">Paid</div><div class="pf-num">${rupees(g.paid_paise)}</div><div class="pf-sub">all rooms together</div></div>
      <div class="ns-card pf-kpi"><div class="pf-lbl">Balance due</div><div class="pf-num" style="${g.balance_paise > 0 ? 'color:#B23A3A' : ''}">${rupees(g.balance_paise)}</div><div class="pf-sub">${g.balance_paise > 0 ? 'one payment is split over the rooms' : 'fully paid'}</div></div>
    </div>
    ${g.contact_name || g.contact_phone || g.event_date || g.note ? `<div class="ns-card" style="display:flex;gap:24px;flex-wrap:wrap;font-size:13.5px">
      ${g.contact_name || g.contact_phone ? `<div><div class="pf-lbl">Contact</div>${esc(g.contact_name || '')} ${g.contact_phone ? `<a href="tel:${esc(g.contact_phone)}">${esc(g.contact_phone)}</a>` : ''}</div>` : ''}
      ${g.event_date ? `<div><div class="pf-lbl">Event day</div>${fmtDay(g.event_date + 'T12:00:00+05:30')}</div>` : ''}
      ${g.note ? `<div style="flex:1;min-width:200px"><div class="pf-lbl">Notes</div>${esc(g.note)}</div>` : ''}</div>` : ''}
    <div class="ns-card" style="padding:0;overflow:hidden">
      <div style="padding:18px 20px;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><div class="ns-h3">Rooms in this group</div>
        ${staff ? '<span class="ns-muted" style="font-size:12.5px">To add a room: open its booking → Group → “Add to group”.</span>' : ''}</div>
      <div style="overflow-x:auto"><table class="ns-table" style="min-width:760px"><thead><tr><th>Booking</th><th>Room</th><th>Guest</th><th>Stay</th><th style="text-align:right">Total</th><th style="text-align:right">Paid</th><th style="text-align:right">Due</th><th>Status</th><th class="ns-sticky-end"><span class="sr-only">Actions</span></th></tr></thead><tbody>
      ${g.bookings.map((b) => `<tr data-href="booking-detail.html?id=${esc(b.id)}" tabindex="0" style="cursor:pointer"><td><b>${esc(b.code)}</b></td><td>${esc(b.room)} · ${esc(b.unit)}</td>
          <td>${esc(b.guest)}<div class="ns-muted" style="font-size:11.5px">${b.adults} adult${b.adults > 1 ? 's' : ''}${b.children ? ` + ${b.children}` : ''}</div></td>
          <td>${fmtDay(b.check_in_at)} – ${fmtDate(b.check_out_at)}</td><td style="text-align:right">${rupees(b.total_paise)}</td><td style="text-align:right">${rupees(b.paid_paise)}</td>
          <td style="text-align:right;font-weight:700;${b.balance_paise > 0 ? 'color:#B23A3A' : ''}">${rupees(b.balance_paise)}</td><td>${statusPill(b.status)}</td>
          <td class="ns-sticky-end">${staff ? `<button type="button" class="ns-btn-ghost" data-rm="${esc(b.id)}" style="height:28px;font-size:12px" title="Take this room out of the group (the booking stays)">Remove</button>` : ''}</td></tr>`).join('')
        || '<tr><td colspan="9" class="ns-empty">No rooms in this group.</td></tr>'}</tbody></table></div></div>`);

  document.querySelector('.ns-content').addEventListener('click', async (e) => {
    const rm = e.target.closest('[data-rm]');
    if (rm) { e.stopPropagation(); rm.disabled = true;
      try { await rpc('group_remove_booking', { p_booking: rm.dataset.rm }); toast('Room taken out of the group.'); location.reload(); } catch (err) { toast(err.message, { error: true }); rm.disabled = false; } return; }
    const tr = e.target.closest('tr[data-href]'); if (tr) location.href = tr.dataset.href;
  });

  $('#g-pay')?.addEventListener('click', () => modal({ title: `Group payment · ${g.name}`, width: 480,
    body: `<div class="ns-muted" style="margin-bottom:10px">Due ${rupees(g.balance_paise)} across ${g.bookings.filter((b) => b.balance_paise > 0).length} rooms. The payment is split over the rooms, earliest check-in first; each room gets its own receipt.</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      ${field('Amount (₹)', `<input class="ns-input" name="amt" inputmode="decimal" value="${g.balance_paise / 100}">`)}
      ${field('Method', `<select class="ns-input" name="method">${options(METHOD_OPTIONS, 'upi')}</select>`)}
      <div style="grid-column:1/-1">${field('UPI transaction ID (UTR) / reference', '<input class="ns-input" name="ref" autocomplete="off">')}</div></div>`,
    actions: [{ label: 'Cancel' }, { label: 'Record payment', kind: 'primary', onClick: async (el) => {
      const v = (n) => el.querySelector(`[name=${n}]`).value.trim(); const a = toPaise(v('amt'));
      if (!(a > 0)) throw new Error('Enter the amount received.');
      const r = await rpc('group_pay', { p_group: g.id, p: { amount_paise: a, method: v('method'), reference: v('ref') } });
      toast(`${rupees(a)} recorded on ${r.rooms} room${r.rooms > 1 ? 's' : ''} (${r.receipts.join(', ')}).`); setTimeout(() => location.reload(), 600);
    } }] }));

  $('#g-edit')?.addEventListener('click', () => modal({ title: 'Edit group', width: 520,
    body: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div style="grid-column:1/-1">${field('Group name', `<input class="ns-input" name="name" maxlength="80" value="${esc(g.name)}">`)}</div>
      ${field('Type', `<select class="ns-input" name="kind">${options(GROUP_KINDS, g.kind)}</select>`)}
      ${field('Event day', `<input class="ns-input" name="ev" type="date" value="${esc(g.event_date || '')}">`)}
      ${field('Contact person', `<input class="ns-input" name="cn" maxlength="120" value="${esc(g.contact_name || '')}">`)}
      ${field('Contact phone', `<input class="ns-input" name="cp" type="tel" value="${esc(g.contact_phone || '')}">`)}
      <div style="grid-column:1/-1">${field('Notes', `<textarea class="ns-input" name="note" maxlength="1000" placeholder="e.g. Mehendi on the lawn, 60 guests, decorator">${esc(g.note || '')}</textarea>`)}</div></div>`,
    actions: [
      ...(ctx.can('owner', 'manager') ? [{ label: 'Delete group', kind: 'danger', onClick: async () => { await rpc('group_delete', { p_group: g.id }); toast('Group deleted — the bookings stay.'); setTimeout(() => { location.href = 'groups.html'; }, 500); } }] : []),
      { label: 'Cancel' }, { label: 'Save', kind: 'primary', onClick: async (el) => {
        const v = (n) => el.querySelector(`[name=${n}]`).value.trim();
        await rpc('group_save', { p_property: ctx.property_id, p: { id: g.id, name: v('name'), kind: v('kind'), event_date: v('ev') || null, contact_name: v('cn'), contact_phone: v('cp'), note: v('note') } });
        toast('Group saved.'); setTimeout(() => location.reload(), 400);
      } }] }));

  const billText = () => [`${g.property.name} — group bill`, `${g.name}${g.check_in_at ? ` · ${fmtDay(g.check_in_at)} – ${fmtDate(g.check_out_at)}` : ''}`, '',
    ...g.bookings.filter((b) => !['cancelled', 'no_show'].includes(b.status)).map((b) => `${b.code} · ${b.room} ${b.unit} · ${b.guest}: ${rupees(b.total_paise)}${b.balance_paise > 0 ? ` (due ${rupees(b.balance_paise)})` : ''}`),
    '', `Total ${rupees(g.total_paise)} · Paid ${rupees(g.paid_paise)} · Due ${rupees(g.balance_paise)}`, g.property.upi_id && g.balance_paise > 0 ? `Pay by UPI: ${g.property.upi_id}` : ''].filter((x) => x !== null).join('\n');
  $('#g-wa')?.addEventListener('click', () => window.open(`https://wa.me/${waNumber(g.contact_phone)}?text=${encodeURIComponent(billText())}`, '_blank', 'noopener'));
  $('#g-print').addEventListener('click', () => {
    const rows = g.bookings.filter((b) => !['cancelled', 'no_show'].includes(b.status));
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(g.name)} — group bill</title><style>
      body{font:14px/1.5 system-ui,sans-serif;color:#111;margin:32px}h1{font-size:20px;margin:0}table{width:100%;border-collapse:collapse;margin:18px 0}
      th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left}td.r,th.r{text-align:right}.tot td{font-weight:700;border-top:2px solid #111}.m{color:#555}</style></head><body>
      <h1>${esc(g.property.name)}</h1><div class="m">${esc([g.property.address, g.property.city].filter(Boolean).join(', '))}${g.property.phone ? ` · ${esc(g.property.phone)}` : ''}</div>
      <h2 style="font-size:16px;margin:20px 0 0">Group bill — ${esc(g.name)}</h2><div class="m">${esc(KIND[g.kind] || '')}${g.contact_name ? ` · ${esc(g.contact_name)}` : ''}${g.check_in_at ? ` · ${fmtDay(g.check_in_at)} – ${fmtDate(g.check_out_at)}` : ''}</div>
      <table><thead><tr><th>Booking</th><th>Room</th><th>Guest</th><th>Nights</th><th class="r">Total</th><th class="r">Paid</th><th class="r">Due</th></tr></thead><tbody>
      ${rows.map((b) => `<tr><td>${esc(b.code)}</td><td>${esc(b.room)} · ${esc(b.unit)}</td><td>${esc(b.guest)}</td><td>${b.nights}</td><td class="r">${rupees(b.total_paise)}</td><td class="r">${rupees(b.paid_paise)}</td><td class="r">${rupees(b.balance_paise)}</td></tr>`).join('')}
      <tr class="tot"><td colspan="4">Total for ${rows.length} rooms</td><td class="r">${rupees(g.total_paise)}</td><td class="r">${rupees(g.paid_paise)}</td><td class="r">${rupees(g.balance_paise)}</td></tr></tbody></table>
      ${g.property.upi_id && g.balance_paise > 0 ? `<p>Pay by UPI to <b>${esc(g.property.upi_id)}</b></p>` : ''}<p class="m">Each room's itemised bill (room, meals, activities, extras) is on its own invoice.</p>
      </body></html>`;
    const w = window.open('', '_blank');
    if (!w) { toast('Allow pop-ups to print the bill.', { error: true }); return; }
    w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
  });
}
