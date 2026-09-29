import { W, roomsMode, page, param, rpc, q, sb, content, setSubtitle, headerActions, esc, rupees, toPaise, modal, toast, field, options, fromInputDT, ymd, addDays, $$ } from '../core.js';

const STATE = {
  occupied: ['Occupied', '#FCE9E9', '#B23A3A'], reserved: ['Reserved', '#FCF0DC', '#966016'],
  available: ['Available', '#E9F5EE', '#157A56'], maintenance: ['Maintenance', '#F3EFE1', '#7A7154'], off: ['Not in use', '#F3EFE1', '#6B7280'],
};

// "101" → 101, 102, 103… ; "A1" → A1, A2… ; "Garden" → Garden 1, Garden 2…
function roomNumbers(start, n) {
  const m = String(start).match(/^(.*?)(\d+)$/);
  if (!m) return n === 1 ? [String(start)] : Array.from({ length: n }, (_, i) => `${start} ${i + 1}`);
  const [, pre, num] = m; const w = num.length;
  return Array.from({ length: n }, (_, i) => pre + String(Number(num) + i).padStart(w, '0'));
}

page('rooms', async (ctx) => {
  const manage = ctx.can('owner', 'manager') && ctx.allow('manage_rooms');
  const head = headerActions();
  head.innerHTML = manage ? '<button type="button" class="ns-btn" id="add-room">+ Add room type</button>' : '';
  const R = roomsMode();
  const title = document.querySelector('.ns-main > [style*="height:76px"] [style*="font-size:21px"]'); if (title) title.textContent = W.setup;

  async function draw() {
    const rooms = await rpc('bed_board', { p_property: ctx.property_id });
    const welcome = param('welcome') && !rooms.length;
    const beds = rooms.flatMap((r) => r.beds);
    setSubtitle(`${ctx.property_name} · ${rooms.length} room type${rooms.length === 1 ? '' : 's'} · ${beds.filter((b) => b.is_active).length} ${W.units}`);
    const state = (b) => (!b.is_active ? 'off' : b.block ? 'maintenance' : b.booking ? (b.booking.status === 'checked_in' ? 'occupied' : 'reserved') : 'available');
    content(`
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:20px">
        ${rooms.map((r) => {
          const rates = [...new Set(r.beds.map((b) => b.rate_paise))].sort((a, b) => b - a);
          return `<div class="ns-card" style="display:flex;flex-direction:column;gap:14px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
              <div><div class="ns-h3">${esc(r.name)}</div><div class="ns-muted">${r.beds.length} ${r.beds.length === 1 ? W.unit : W.units}${r.description ? ' · ' + esc(r.description) : ''}</div></div>
              ${manage ? `<button type="button" class="ns-btn-ghost" style="height:32px" data-edit="${esc(r.id)}">Edit</button>` : ''}</div>
            <div class="ns-muted">From ${rates.map(rupees).join(' / ')} per night</div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
              ${r.beds.map((b) => { const [l, bg, fg] = STATE[state(b)];
                const who = b.block ? esc(b.block) : b.booking ? esc(b.booking.guest) : '—';
                const tag = b.booking ? 'a' : 'button';
                return `<${tag} ${b.booking ? `href="booking-detail.html?id=${esc(b.booking.id)}"` : `type="button" data-bed="${esc(b.id)}"`}
                  style="text-align:left;background:${bg};border:1px solid ${bg};border-radius:10px;padding:10px;color:inherit;cursor:pointer;font-family:inherit">
                  <div style="font-size:12.5px;font-weight:800">${esc(b.label)}${R && b.max_guests > 1 ? ` <span style="font-weight:600;color:#6B7280">· ${b.max_guests}👤</span>` : ''}</div>
                  <div style="font-size:11px;font-weight:700;color:${fg}">${l}</div>
                  <div style="font-size:11px;color:#6B7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${who}</div></${tag}>`; }).join('')}
            </div></div>`; }).join('') || (welcome
          ? `<div class="ns-card" style="display:flex;flex-direction:column;gap:10px;grid-column:1/-1">
              <div class="ns-h3" style="font-size:18px">Welcome to NammaStay 👋 Your free trial has started.</div>
              <div class="ns-muted" style="font-size:14px;line-height:1.6">Step 1: add your first room type — e.g. ${W.example}.<br>
              Step 2: add your UPI ID in Settings. Step 3: create your first booking from Check-in.</div>
              ${manage ? '<button type="button" class="ns-btn" style="align-self:flex-start" id="first-room">+ Add your first room type</button>' : ''}</div>`
          : '<div class="ns-card ns-empty">No rooms yet. Add your first room type.</div>')}
      </div>
      <div class="ns-muted">Tap a free ${W.unit} to block it for maintenance. Tap an occupied ${W.unit} to open its booking.</div>`);

    document.getElementById('first-room')?.addEventListener('click', () => document.getElementById('add-room').click());
    $$('[data-edit]').forEach((btn) => btn.onclick = () => editRoom(rooms.find((r) => r.id === btn.dataset.edit)));
    $$('[data-bed]').forEach((btn) => btn.onclick = () => {
      const b = beds.find((x) => x.id === btn.dataset.bed);
      if (state(b) === 'maintenance') blockList(b); else blockBed(b);
    });
  }

  async function editRoom(r) {
    // fresh rows so we also get capacity & extra-guest settings
    const units = await q(sb.from('beds').select('*').eq('room_id', r.id).order('sort')).catch(() => r.beds);
    const f0 = units[0] || {};
    modal({
      title: `Edit ${r.name}`, width: R ? 680 : 560,
      body: `${field(R ? 'Room type name' : 'Room name', `<input class="ns-input" name="name" value="${esc(r.name)}">`)}
        ${field('Description', `<input class="ns-input" name="description" value="${esc(r.description || '')}" placeholder="${R ? 'King bed · AC · Balcony · Breakfast included' : 'AC · Shared bath'}">`)}
        ${R ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            ${field('Guests included in the rate', `<input class="ns-input" name="base" type="number" min="1" max="20" value="${f0.base_guests || 2}">`)}
            ${field('Extra adult ₹ / night', `<input class="ns-input" name="extra" inputmode="decimal" value="${(f0.extra_guest_paise || 0) / 100}">`, 'Children stay free.')}</div>` : ''}
        <div style="display:grid;grid-template-columns:${R ? '1fr 100px 90px 90px' : '1fr 110px 100px'};gap:8px;font-size:11px;font-weight:800;color:#6B7280;text-transform:uppercase">
          <span>${W.Unit}</span><span>₹ / night</span>${R ? '<span>Max guests</span>' : ''}<span>In use</span></div>
        <div style="display:flex;flex-direction:column;gap:8px">
        ${units.map((b) => `<div style="display:grid;grid-template-columns:${R ? '1fr 100px 90px 90px' : '1fr 110px 100px'};gap:8px;align-items:center" data-row="${esc(b.id)}">
            <input class="ns-input" name="label" value="${esc(b.label)}" aria-label="${W.Unit} name">
            <input class="ns-input" name="rate" inputmode="decimal" value="${b.rate_paise / 100}" aria-label="Rate per night (₹)">
            ${R ? `<input class="ns-input" name="max" type="number" min="1" max="20" value="${b.max_guests || 2}" aria-label="Max guests">` : ''}
            <label style="font-size:12px;display:flex;gap:6px;align-items:center"><input type="checkbox" name="active" ${b.is_active ? 'checked' : ''}> In use</label></div>`).join('')}
        </div><div class="ns-help">Rate changes apply to new bookings only.</div>`,
      actions: [{ label: 'Cancel' }, { label: 'Save', kind: 'primary', onClick: async (el) => {
        const base = R ? parseInt(el.querySelector('[name=base]').value, 10) : 1;
        const extra = R ? toPaise(el.querySelector('[name=extra]').value || '0') : 0;
        if (R && (!(base >= 1) || !(extra >= 0))) throw new Error('Check guests included and the extra-adult charge.');
        await q(sb.from('rooms').update({ name: el.querySelector('[name=name]').value.trim(), description: el.querySelector('[name=description]').value.trim() || null }).eq('id', r.id));
        for (const row of el.querySelectorAll('[data-row]')) {
          const rate = toPaise(row.querySelector('[name=rate]').value);
          if (!(rate >= 0)) throw new Error('Check the rates.');
          const upd = { label: row.querySelector('[name=label]').value.trim(), rate_paise: rate, is_active: row.querySelector('[name=active]').checked };
          if (R) {
            const max = parseInt(row.querySelector('[name=max]').value, 10);
            if (!(max >= 1)) throw new Error('Max guests must be at least 1.');
            Object.assign(upd, { max_guests: max, base_guests: Math.min(base, max), extra_guest_paise: extra });
          }
          await q(sb.from('beds').update(upd).eq('id', row.dataset.row));
        }
        toast('Saved.'); draw();
      } }],
    });
  }

  async function blockList(b) {
    if (!ctx.can('owner', 'manager', 'front_desk')) return;
    const list = await q(sb.from('bed_blocks').select('*').eq('bed_id', b.id).gte('ends_at', new Date().toISOString()).order('starts_at'));
    modal({
      title: `Maintenance · ${b.label}`, width: 480,
      body: list.length ? `<div style="display:flex;flex-direction:column;gap:10px">${list.map((k) => `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 12px;border:1px solid #F0EBDB;border-radius:10px">
          <div><b>🔧 ${esc(k.reason || 'Maintenance')}</b><div class="ns-muted" style="font-size:12.5px">${fmtDayTime(k.starts_at)} → ${fmtDayTime(k.ends_at)}</div></div>
          <button type="button" class="ns-btn-danger" style="height:32px;font-size:12px" data-unblock="${esc(k.id)}">Remove</button></div>`).join('')}</div>`
        : '<div class="ns-muted">No current or upcoming maintenance.</div>',
      actions: [{ label: 'Close' }, { label: '+ Add another block', kind: 'primary', onClick: () => { setTimeout(() => blockBed(b), 50); } }],
    }).el.querySelectorAll('[data-unblock]').forEach((btn) => btn.addEventListener('click', async () => {
      await q(sb.from('bed_blocks').delete().eq('id', btn.dataset.unblock));
      toast(`${b.label} is available again.`); document.querySelector('.ns-modal .ns-x')?.click(); draw();
    }));
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

  document.getElementById('add-room')?.addEventListener('click', () => {
    const m = modal({
      title: 'Add room type', width: 600,
      body: R ? `${field('Room type name', '<input class="ns-input" name="name" placeholder="Deluxe Double">')}
          ${field('Description', '<input class="ns-input" name="description" placeholder="King bed · AC · Balcony · Breakfast included">')}
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
            ${field('How many rooms', '<input class="ns-input" name="count" type="number" min="1" max="200" value="4">')}
            ${field('First room number', '<input class="ns-input" name="start" value="101">', 'Next ones count up: 101, 102…')}
            ${field('Rate / night (₹)', '<input class="ns-input" name="rate" inputmode="decimal" value="2500">')}
            ${field('Max guests', '<input class="ns-input" name="max" type="number" min="1" max="20" value="3">')}
            ${field('Guests included', '<input class="ns-input" name="base" type="number" min="1" max="20" value="2">')}
            ${field('Extra adult ₹ / night', '<input class="ns-input" name="extra" inputmode="decimal" value="500">', 'Children stay free.')}</div>
          <div class="ns-help" id="room-preview"></div>`
        : `${field('Room name', '<input class="ns-input" name="name" placeholder="4-Bed Female Dorm">')}
          ${field('Description', '<input class="ns-input" name="description" placeholder="AC · Shared bath">')}
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
            ${field('Beds', '<input class="ns-input" name="count" type="number" min="1" max="40" value="4">')}
            ${field('Type', `<select class="ns-input" name="position">${options([['lower', 'Lower'], ['upper', 'Upper'], ['single', 'Single']], 'lower')}</select>`)}
            ${field('Rate/night (₹)', '<input class="ns-input" name="rate" inputmode="decimal" value="700">')}</div>
          ${field('Bed name prefix', '<input class="ns-input" name="prefix" value="Bed ">', 'Beds are named prefix + number, e.g. “Bed 1”. Rename them later.')}`,
      actions: [{ label: 'Cancel' }, { label: 'Add', kind: 'primary', onClick: async (el) => {
        const v = (n) => el.querySelector(`[name=${n}]`)?.value ?? '';
        const n = parseInt(v('count'), 10); const rate = toPaise(v('rate'));
        if (!v('name').trim() || !(n >= 1 && n <= (R ? 200 : 40)) || !(rate >= 0)) throw new Error(`Fill in the name, number of ${W.units} and the rate.`);
        const room = await q(sb.from('rooms').insert({ property_id: ctx.property_id, name: v('name').trim(), description: v('description').trim() || null, sort: 99 }).select('id').single());
        const labels = R ? roomNumbers(v('start').trim() || '1', n) : Array.from({ length: n }, (_, i) => `${v('prefix')}${i + 1}`.trim());
        const max = R ? Math.max(1, parseInt(v('max'), 10) || 2) : 1;
        await q(sb.from('beds').insert(labels.map((label, i) => ({ property_id: ctx.property_id, room_id: room.id, label, rate_paise: rate, sort: i + 1,
          position: R ? 'single' : v('position'),
          ...(R ? { max_guests: max, base_guests: Math.min(max, Math.max(1, parseInt(v('base'), 10) || 1)), extra_guest_paise: toPaise(v('extra') || '0') || 0 } : {}) }))));
        toast(`${v('name').trim()} added with ${n} ${n === 1 ? W.unit : W.units}.`); draw();
      } }],
    });
    if (R) {
      const prev = () => { const n = Math.min(200, parseInt(m.el.querySelector('[name=count]').value, 10) || 0); const l = roomNumbers(m.el.querySelector('[name=start]').value.trim() || '1', n);
        m.el.querySelector('#room-preview').textContent = n ? `Rooms: ${l.slice(0, 6).join(', ')}${n > 6 ? ` … ${l[n - 1]}` : ''}` : ''; };
      m.el.querySelectorAll('[name=count],[name=start]').forEach((x) => x.addEventListener('input', prev)); prev();
    }
  });

  await draw();
});
