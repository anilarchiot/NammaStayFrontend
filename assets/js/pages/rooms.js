import { page, rpc, q, sb, content, setSubtitle, headerActions, esc, rupees, toPaise, modal, toast, field, options, fromInputDT, ymd, addDays, $$ } from '../core.js';

const STATE = {
  occupied: ['Occupied', '#FCE9E9', '#B23A3A'], reserved: ['Reserved', '#FCF0DC', '#966016'],
  available: ['Available', '#E9F5EE', '#157A56'], maintenance: ['Maintenance', '#F3EFE1', '#7A7154'], off: ['Not in use', '#F3EFE1', '#6B7280'],
};

page('rooms', async (ctx) => {
  const manage = ctx.can('owner', 'manager');
  const head = headerActions();
  head.innerHTML = manage ? '<button type="button" class="ns-btn" id="add-room">+ Add room type</button>' : '';

  async function draw() {
    const rooms = await rpc('bed_board', { p_property: ctx.property_id });
    const beds = rooms.flatMap((r) => r.beds);
    setSubtitle(`${ctx.property_name} · ${rooms.length} room types · ${beds.filter((b) => b.is_active).length} beds`);
    const state = (b) => (!b.is_active ? 'off' : b.block ? 'maintenance' : b.booking ? (b.booking.status === 'checked_in' ? 'occupied' : 'reserved') : 'available');
    content(`
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:20px">
        ${rooms.map((r) => {
          const rates = [...new Set(r.beds.map((b) => b.rate_paise))].sort((a, b) => b - a);
          return `<div class="ns-card" style="display:flex;flex-direction:column;gap:14px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
              <div><div class="ns-h3">${esc(r.name)}</div><div class="ns-muted">${r.beds.length} beds${r.description ? ' · ' + esc(r.description) : ''}</div></div>
              ${manage ? `<button type="button" class="ns-btn-ghost" style="height:32px" data-edit="${esc(r.id)}">Edit</button>` : ''}</div>
            <div class="ns-muted">From ${rates.map(rupees).join(' / ')} per night</div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
              ${r.beds.map((b) => { const [l, bg, fg] = STATE[state(b)];
                const who = b.block ? esc(b.block) : b.booking ? esc(b.booking.guest) : '—';
                const tag = b.booking ? 'a' : 'button';
                return `<${tag} ${b.booking ? `href="booking-detail.html?id=${esc(b.booking.id)}"` : `type="button" data-bed="${esc(b.id)}"`}
                  style="text-align:left;background:${bg};border:1px solid ${bg};border-radius:10px;padding:10px;color:inherit;cursor:pointer;font-family:inherit">
                  <div style="font-size:12.5px;font-weight:800">${esc(b.label)}</div>
                  <div style="font-size:11px;font-weight:700;color:${fg}">${l}</div>
                  <div style="font-size:11px;color:#6B7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${who}</div></${tag}>`; }).join('')}
            </div></div>`; }).join('') || '<div class="ns-card ns-empty">No rooms yet. Add your first room type.</div>'}
      </div>
      <div class="ns-muted">Tap a free bed to block it for maintenance. Tap an occupied bed to open its booking.</div>`);

    $$('[data-edit]').forEach((btn) => btn.onclick = () => editRoom(rooms.find((r) => r.id === btn.dataset.edit)));
    $$('[data-bed]').forEach((btn) => btn.onclick = () => blockBed(beds.find((b) => b.id === btn.dataset.bed)));
  }

  function editRoom(r) {
    modal({
      title: `Edit ${r.name}`, width: 560,
      body: `${field('Room name', `<input class="ns-input" name="name" value="${esc(r.name)}">`)}
        ${field('Description', `<input class="ns-input" name="description" value="${esc(r.description || '')}" placeholder="AC · Shared bath">`)}
        <div style="display:flex;flex-direction:column;gap:8px">
        ${r.beds.map((b) => `<div style="display:grid;grid-template-columns:1fr 110px 100px;gap:8px;align-items:center" data-row="${esc(b.id)}">
            <input class="ns-input" name="label" value="${esc(b.label)}" aria-label="Bed name">
            <input class="ns-input" name="rate" inputmode="decimal" value="${b.rate_paise / 100}" aria-label="Rate per night (₹)">
            <label style="font-size:12px;display:flex;gap:6px;align-items:center"><input type="checkbox" name="active" ${b.is_active ? 'checked' : ''}> In use</label></div>`).join('')}
        </div><div class="ns-help">Rate changes apply to new bookings only.</div>`,
      actions: [{ label: 'Cancel' }, { label: 'Save', kind: 'primary', onClick: async (el) => {
        await q(sb.from('rooms').update({ name: el.querySelector('[name=name]').value.trim(), description: el.querySelector('[name=description]').value.trim() || null }).eq('id', r.id));
        for (const row of el.querySelectorAll('[data-row]')) {
          const rate = toPaise(row.querySelector('[name=rate]').value);
          if (!(rate >= 0)) throw new Error('Check the rates.');
          await q(sb.from('beds').update({ label: row.querySelector('[name=label]').value.trim(), rate_paise: rate, is_active: row.querySelector('[name=active]').checked }).eq('id', row.dataset.row));
        }
        toast('Saved.'); draw();
      } }],
    });
  }

  function blockBed(b) {
    if (!ctx.can('owner', 'manager', 'front_desk')) return;
    const t = ymd();
    modal({
      title: `Block ${b.label} for maintenance`,
      body: `${field('From', `<input class="ns-input" type="datetime-local" name="from" value="${t}T12:00">`)}
        ${field('To', `<input class="ns-input" type="datetime-local" name="to" value="${addDays(t, 1)}T12:00">`)}
        ${field('Reason', '<input class="ns-input" name="reason" placeholder="Fan repair">')}`,
      actions: [{ label: 'Cancel' }, { label: 'Block bed', kind: 'primary', onClick: async (el) => {
        await rpc('set_bed_block', { p_bed: b.id, p_from: fromInputDT(el.querySelector('[name=from]').value),
          p_to: fromInputDT(el.querySelector('[name=to]').value), p_reason: el.querySelector('[name=reason]').value.trim() });
        toast('Bed blocked.'); draw();
      } }],
    });
  }

  document.getElementById('add-room')?.addEventListener('click', () => modal({
    title: 'Add room type',
    body: `${field('Room name', '<input class="ns-input" name="name" placeholder="4-Bed Female Dorm">')}
      ${field('Description', '<input class="ns-input" name="description" placeholder="AC · Shared bath">')}
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
        ${field('Beds', '<input class="ns-input" name="count" type="number" min="1" max="40" value="4">')}
        ${field('Type', `<select class="ns-input" name="position">${options([['lower', 'Lower'], ['upper', 'Upper'], ['single', 'Single']], 'lower')}</select>`)}
        ${field('Rate/night (₹)', '<input class="ns-input" name="rate" inputmode="decimal" value="700">')}</div>
      ${field('Bed name prefix', '<input class="ns-input" name="prefix" value="Bed ">', 'Beds are named prefix + number, e.g. “Bed 1”. Rename them later.')}`,
    actions: [{ label: 'Cancel' }, { label: 'Add', kind: 'primary', onClick: async (el) => {
      const v = (n) => el.querySelector(`[name=${n}]`).value;
      const n = parseInt(v('count'), 10); const rate = toPaise(v('rate'));
      if (!v('name').trim() || !(n >= 1 && n <= 40) || !(rate >= 0)) throw new Error('Fill in name, beds (1–40) and rate.');
      const room = await q(sb.from('rooms').insert({ property_id: ctx.property_id, name: v('name').trim(), description: v('description').trim() || null, sort: 99 }).select('id').single());
      await q(sb.from('beds').insert(Array.from({ length: n }, (_, i) => ({ property_id: ctx.property_id, room_id: room.id,
        label: `${v('prefix')}${i + 1}`.trim(), position: v('position'), rate_paise: rate, sort: i + 1 }))));
      toast('Room added.'); draw();
    } }],
  }));

  await draw();
});
