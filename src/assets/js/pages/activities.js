// Activities & spa — resorts (034_resort.sql): day schedule by activity and time slot, booking for
// in-house guests (added to their bill) or day visitors, and the list of activities.
import { page, rpc, content, setSubtitle, headerActions, esc, rupees, toPaise, fmtDay, ymd, addDays, toast, modal, field, options, param, $ } from '../core.js';
import { ACT_CATS } from './resort.js';

const CAT = Object.fromEntries(ACT_CATS);
const ST = { booked: ['Booked', 'blue'], done: ['Done', 'green'], cancelled: ['Cancelled', 'grey'], no_show: ['No-show', 'red'] };

page('activities', async (ctx) => {
  const staff = ctx.can('owner', 'manager', 'front_desk');
  const boss = ctx.can('owner', 'manager');
  let today = ymd(); let d = param('day') && /^\d{4}-\d{2}-\d{2}$/.test(param('day')) ? param('day') : today;
  const forBooking = param('booking');
  const head = headerActions();
  head.innerHTML = `<button type="button" class="ns-btn-ghost" id="a-prev" aria-label="Previous day">‹</button>
    <input class="ns-input" type="date" id="a-day" value="${d}" style="height:40px;width:auto">
    <button type="button" class="ns-btn-ghost" id="a-next" aria-label="Next day">›</button>
    ${staff ? '<button type="button" class="ns-btn" id="a-book">+ Book activity</button>' : ''}`;
  const setDay = (x) => { d = x; $('#a-day').value = d; load(); };
  $('#a-prev').onclick = () => setDay(addDays(d, -1));
  $('#a-next').onclick = () => setDay(addDays(d, 1));
  $('#a-day').onchange = (e) => e.target.value && setDay(e.target.value);
  $('#a-book')?.addEventListener('click', () => book({}));

  let data = null; let list = [];
  async function load() {
    [data, list] = await Promise.all([rpc('activity_schedule', { p_property: ctx.property_id, p_day: d }), rpc('activities_list', { p_property: ctx.property_id })]);
    draw();
  }
  function draw() {
    const t = data.totals;
    setSubtitle(`${fmtDay(d + 'T12:00:00+05:30')}${d === today ? ' · today' : ''} · ${t.bookings} booking${t.bookings === 1 ? '' : 's'} · ${t.people} ${t.people === 1 ? 'person' : 'people'}`);
    const slotHtml = (a, s) => {
      const left = a.capacity ? a.capacity - s.taken : null;
      return `<div class="rs-slot">
        <div class="rs-slot-head"><b>${esc(s.slot)}</b><span class="ns-pill ${left === null ? 'grey' : left <= 0 ? 'red' : left <= 2 ? 'amber' : 'green'}">${left === null ? `${s.taken} booked` : left <= 0 ? 'Full' : `${left} left`}</span>
          ${staff && (left === null || left > 0) ? `<button type="button" class="ns-btn-ghost" data-book="${esc(a.id)}|${esc(s.slot)}" style="height:28px;font-size:12px;margin-left:auto">+ Book</button>` : ''}</div>
        ${s.bookings.map((b) => { const [sl, sc] = ST[b.status]; return `<div class="rs-bk${b.status === 'cancelled' ? ' is-off' : ''}">
            <div style="min-width:0"><b>${esc(b.guest)}</b> <span class="ns-muted">· ${b.persons + b.children} ${b.persons + b.children === 1 ? 'person' : 'people'}${b.where ? ` · ${esc(b.where)}` : ''}</span>
              <div class="ns-muted" style="font-size:11.5px">${b.included ? 'Included in package' : rupees(b.amount_paise)}${b.note ? ` · ${esc(b.note)}` : ''}</div></div>
            <span style="display:flex;gap:6px;align-items:center;flex-shrink:0"><span class="ns-pill ${sc}">${sl}</span>
              ${staff && b.status === 'booked' ? `<button type="button" class="ns-btn-ghost" data-st="${esc(b.id)}|done" style="height:28px;font-size:12px">Done</button>
                <button type="button" class="ns-btn-ghost" data-st="${esc(b.id)}|cancelled" style="height:28px;font-size:12px;color:#B23A3A">Cancel</button>` : ''}</span></div>`; }).join('')}
      </div>`;
    };
    content(`
      <div class="rs-kpis">
        <div class="ns-card pf-kpi"><div class="pf-lbl">Bookings</div><div class="pf-num">${data.totals.bookings}</div><div class="pf-sub">on ${fmtDay(d + 'T12:00:00+05:30')}</div></div>
        <div class="ns-card pf-kpi"><div class="pf-lbl">People</div><div class="pf-num">${data.totals.people}</div><div class="pf-sub">guests + day visitors</div></div>
        <div class="ns-card pf-kpi"><div class="pf-lbl">Activity sales</div><div class="pf-num">${rupees(data.totals.amount_paise)}</div><div class="pf-sub">added to bills</div></div>
      </div>
      ${data.activities.length ? data.activities.map((a) => `<div class="ns-card" style="display:flex;flex-direction:column;gap:10px">
          <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><div><div class="ns-h3">${esc(a.name)}${a.is_active ? '' : ' <span class="ns-pill grey">Hidden</span>'}</div>
            <div class="ns-muted" style="font-size:12.5px">${esc(CAT[a.category] || a.category)} · ${a.duration_min} min · ${rupees(a.price_paise)}/adult${a.child_paise ? ` · ${rupees(a.child_paise)}/child` : ''}${a.capacity ? ` · ${a.capacity} per slot` : ''}</div></div></div>
          <div class="rs-slots">${a.slots.map((s) => slotHtml(a, s)).join('')}</div></div>`).join('')
        : `<div class="ns-card ns-empty">No activities yet.${boss ? ' Add your spa, safari, treks and more below.' : ''}</div>`}
      <div class="ns-card" style="padding:0;overflow:hidden" id="a-list">
        <div style="padding:18px 20px;display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
          <div><div class="ns-h3">Your activities</div><div class="ns-muted">Start times, price per person and how many fit in one slot. Booked for a room guest, the price goes on their bill.</div></div>
          ${boss ? `<span style="display:flex;gap:8px">${list.length ? '' : '<button type="button" class="ns-btn-ghost" id="a-suggest">Add examples</button>'}<button type="button" class="ns-btn" id="a-add">+ Add activity</button></span>` : ''}</div>
        <div style="overflow-x:auto"><table class="ns-table" style="min-width:640px"><thead><tr><th>Activity</th><th>Start times</th><th style="text-align:right">Adult</th><th style="text-align:right">Child</th><th>Per slot</th><th>Offered</th><th class="ns-sticky-end"><span class="sr-only">Actions</span></th></tr></thead><tbody>
        ${list.map((a) => `<tr data-act="${esc(a.id)}"><td><b>${esc(a.name)}</b><div class="ns-muted" style="font-size:11.5px">${esc(CAT[a.category] || a.category)} · ${a.duration_min} min</div></td>
            <td>${esc(a.slots.join(', '))}</td><td style="text-align:right">${rupees(a.price_paise)}</td><td style="text-align:right">${rupees(a.child_paise)}</td>
            <td>${a.capacity || 'No limit'}</td><td>${a.is_active ? '<span class="ns-pill green">Yes</span>' : '<span class="ns-pill grey">Hidden</span>'}</td>
            <td class="ns-sticky-end" style="text-align:right;white-space:nowrap">${boss ? '<button type="button" class="ns-btn-ghost" data-edit style="height:30px;font-size:12px">Edit</button> <button type="button" class="ns-btn-ghost" data-del style="height:30px;font-size:12px;color:#B23A3A">Remove</button>' : ''}</td></tr>`).join('')
          || '<tr><td colspan="7" class="ns-empty">No activities yet.</td></tr>'}</tbody></table></div></div>`);
  }

  // ---- book an activity
  async function book(pre) {
    const g = await rpc('activity_guests', { p_property: ctx.property_id, p_day: d });
    const acts = list.filter((a) => a.is_active);
    if (!acts.length) { toast('Add an activity first (Your activities, below).', { error: true }); return; }
    const who = [...g.stays.map((s) => [`b:${s.booking_id}`, `${s.guest} · ${s.room} · ${s.unit}${s.package ? ` · ${s.package}` : ''}`]),
      ...g.visits.map((v) => [`v:${v.day_visit_id}`, `${v.guest} · Day visit ${v.code}`])];
    if (!who.length) { toast('No guests are staying and no day visitors are booked on this day.', { error: true }); return; }
    const preWho = pre.booking ? `b:${pre.booking}` : forBooking && who.some(([k]) => k === `b:${forBooking}`) ? `b:${forBooking}` : who[0][0];
    const m = modal({
      title: `Book an activity · ${fmtDay(d + 'T12:00:00+05:30')}`, width: 560,
      body: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div style="grid-column:1/-1">${field('Guest', `<select class="ns-input" name="who">${options(who, preWho)}</select>`)}</div>
        ${field('Activity', `<select class="ns-input" name="act">${options(acts.map((a) => [a.id, a.name]), pre.act || acts[0].id)}</select>`)}
        ${field('Start time', '<select class="ns-input" name="slot"></select>')}
        ${field('Adults', '<input class="ns-input" name="ad" type="number" min="0" max="500" value="1">')}
        ${field('Children', '<input class="ns-input" name="ch" type="number" min="0" max="500" value="0">')}
        <div style="grid-column:1/-1">${field('Note', '<input class="ns-input" name="note" maxlength="200" placeholder="e.g. couple massage, vegetarian">')}</div>
        <div style="grid-column:1/-1" class="ns-muted" id="a-price" ></div></div>`,
      actions: [{ label: 'Cancel' }, { label: 'Book', kind: 'primary', onClick: async (el) => {
        const v = (n) => el.querySelector(`[name=${n}]`).value; const [kind, id] = v('who').split(':');
        const r = await rpc('activity_book', { p_property: ctx.property_id, p: { activity_id: v('act'), day: d, slot: v('slot'), persons: Number(v('ad')), children: Number(v('ch')), note: v('note'),
          booking_id: kind === 'b' ? id : null, day_visit_id: kind === 'v' ? id : null } });
        toast(r.included ? 'Booked — included in their package.' : `Booked — ${rupees(r.amount_paise)} ${kind === 'b' ? 'added to their bill' : 'added to the day visit'}.`);
        await load();
      } }],
    });
    const el = m.el; const v = (n) => el.querySelector(`[name=${n}]`);
    const sync = () => {
      const a = acts.find((x) => x.id === v('act').value); const sch = data.activities.find((x) => x.id === a.id);
      v('slot').innerHTML = a.slots.map((s) => { const t = sch?.slots.find((x) => x.slot === s)?.taken || 0; const left = a.capacity ? a.capacity - t : null;
        return `<option value="${esc(s)}" ${s === pre.slot ? 'selected' : ''} ${left !== null && left <= 0 ? 'disabled' : ''}>${esc(s)}${left === null ? '' : left <= 0 ? ' — full' : ` — ${left} left`}</option>`; }).join('');
      const [kind, id] = v('who').value.split(':'); const st = kind === 'b' ? g.stays.find((x) => x.booking_id === id) : g.visits.find((x) => x.day_visit_id === id);
      if (st && !v('ad').dataset.typed) { v('ad').value = st.adults; v('ch').value = st.children; }
      const incl = kind === 'b' && st?.included?.includes(a.id);
      $('#a-price').innerHTML = incl ? `<b style="color:#157A56">Included in ${esc(st.package)}</b> — no charge (once).`
        : `${rupees(a.price_paise * Number(v('ad').value || 0) + a.child_paise * Number(v('ch').value || 0))} ${kind === 'b' ? 'will be added to the room bill' : 'will be added to the day visit'}.`;
    };
    ['ad', 'ch'].forEach((n) => v(n).addEventListener('input', () => { v('ad').dataset.typed = '1'; sync(); }));
    v('act').addEventListener('change', sync); v('slot').addEventListener('change', sync);
    v('who').addEventListener('change', () => { delete v('ad').dataset.typed; sync(); });
    sync();
  }

  // ---- add / edit activities
  const editAct = (a) => modal({
    title: a ? 'Edit activity' : 'New activity', width: 560,
    body: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div style="grid-column:1/-1">${field('Name', `<input class="ns-input" name="name" maxlength="60" value="${esc(a?.name || '')}" placeholder="e.g. Ayurvedic massage">`)}</div>
      ${field('Type', `<select class="ns-input" name="cat">${options(ACT_CATS, a?.category || 'leisure')}</select>`)}
      ${field('Length (minutes)', `<input class="ns-input" name="dur" type="number" min="5" max="1440" value="${a?.duration_min || 60}">`)}
      ${field('Price per adult (₹)', `<input class="ns-input" name="price" inputmode="decimal" value="${a ? a.price_paise / 100 : ''}">`)}
      ${field('Price per child (₹)', `<input class="ns-input" name="child" inputmode="decimal" value="${a ? a.child_paise / 100 : 0}">`)}
      ${field('Start times', `<input class="ns-input" name="slots" value="${esc((a?.slots || ['10:00', '16:00']).join(', '))}" placeholder="07:00, 16:30">`, 'Separate with commas, 24-hour time.')}
      ${field('People per slot', `<input class="ns-input" name="cap" type="number" min="0" max="500" value="${a?.capacity ?? 10}">`, '0 = no limit')}
      <label style="grid-column:1/-1;display:flex;gap:6px;align-items:center;font-size:13px"><input type="checkbox" name="active" ${!a || a.is_active ? 'checked' : ''}> Offered (shown when booking)</label></div>`,
    actions: [{ label: 'Cancel' }, { label: 'Save', kind: 'primary', onClick: async (el) => {
      const v = (n) => el.querySelector(`[name=${n}]`);
      const money = (n) => (v(n).value.trim() ? toPaise(v(n).value) : 0);
      if (Number.isNaN(money('price')) || Number.isNaN(money('child'))) throw new Error('Enter prices in rupees, e.g. 1200.');
      await rpc('activity_save', { p_property: ctx.property_id, p: { id: a?.id || null, name: v('name').value.trim(), category: v('cat').value, duration_min: Number(v('dur').value) || 60,
        price_paise: money('price'), child_paise: money('child'), capacity: Number(v('cap').value) || 0,
        slots: v('slots').value.split(/[,\s]+/).map((x) => x.trim()).filter(Boolean).map((x) => (/^\d:\d\d$/.test(x) ? '0' + x : x)), is_active: v('active').checked } });
      toast('Activity saved.'); await load();
    } }],
  });

  document.querySelector('.ns-content').addEventListener('click', async (e) => {
    const bk = e.target.closest('[data-book]'); if (bk) { const [act, slot] = bk.dataset.book.split('|'); book({ act, slot }); return; }
    const st = e.target.closest('[data-st]');
    if (st) { const [id, s] = st.dataset.st.split('|'); st.disabled = true;
      try { await rpc('activity_booking_status', { p_id: id, p_status: s }); toast(s === 'cancelled' ? 'Cancelled — removed from the bill.' : 'Marked done.'); await load(); }
      catch (err) { toast(err.message, { error: true }); st.disabled = false; } return; }
    if (e.target.closest('#a-add')) { editAct(null); return; }
    if (e.target.closest('#a-suggest')) {
      try {
        for (const a of [{ name: 'Ayurvedic massage', category: 'spa', duration_min: 60, price_paise: 250000, capacity: 2, slots: ['10:00', '16:00'] },
          { name: 'Jungle jeep safari', category: 'adventure', duration_min: 150, price_paise: 120000, child_paise: 60000, capacity: 8, slots: ['06:30', '15:30'] },
          { name: 'Plantation walk', category: 'leisure', duration_min: 90, price_paise: 60000, child_paise: 30000, capacity: 15, slots: ['08:00'] },
          { name: 'Bonfire & BBQ', category: 'food', duration_min: 120, price_paise: 90000, child_paise: 45000, capacity: 30, slots: ['19:30'] }]) await rpc('activity_save', { p_property: ctx.property_id, p: a });
        toast('4 example activities added — change prices and times to yours.'); await load();
      } catch (err) { toast(err.message, { error: true }); }
      return;
    }
    const row = e.target.closest('[data-act]'); if (!row) return; const a = list.find((x) => x.id === row.dataset.act);
    if (e.target.closest('[data-edit]')) editAct(a);
    if (e.target.closest('[data-del]')) modal({ title: 'Remove activity', width: 420, body: `<p style="margin:0;font-size:14px">Remove <b>${esc(a.name)}</b>? Past bookings keep its name.</p>`,
      actions: [{ label: 'Cancel' }, { label: 'Remove', kind: 'danger', onClick: async () => { await rpc('activity_delete', { p_id: a.id }); toast('Activity removed.'); await load(); } }] });
  });

  await load();
  if (forBooking && staff) book({ booking: forBooking });
});
