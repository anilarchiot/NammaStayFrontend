// Calendar — every bed, every night. Drag across a bed's row (or tap the first
// and last night on a phone) to create a booking for those dates.
import { sendBookingWhatsApp, deleteBookingDialog, statusPill, fmtDayTime, page, rpc, content, setSubtitle, headerActions, esc, ymd, addDays, fmtWeekday, fmtDay, rupees, toPaise,
  modal, toast, field, options, METHOD_OPTIONS, SOURCES, debounce, fromInputDT, $, $$ } from '../core.js';

const DAYS = 9;
const LIVE = ['pending', 'confirmed', 'checked_in'];
const TIP = '<b style="color:#157A56">Tip:</b> drag across a bed’s free nights to book them — on a phone, tap the first night, then the last.';

page('calendar', async (ctx) => {
  const staff = ctx.can('owner', 'manager', 'front_desk');
  let from = addDays(ymd(), -2);
  let data = null;
  const head = headerActions();
  head.innerHTML = `<button type="button" class="ns-btn-ghost" id="prev" aria-label="Previous week">‹ Prev</button>
    <button type="button" class="ns-btn-ghost" id="today">Today</button>
    <button type="button" class="ns-btn-ghost" id="next" aria-label="Next week">Next ›</button>
    ${staff ? '<a href="check-in.html" class="ns-btn">+ New booking</a>' : ''}`;
  $('#prev').onclick = () => { from = addDays(from, -7); draw(); };
  $('#next').onclick = () => { from = addDays(from, 7); draw(); };
  $('#today').onclick = () => { from = addDays(ymd(), -2); draw(); };

  const today = ymd();
  const earliest = addDays(today, -1);            // bookings can start at most yesterday
  let days = [];
  const taken = new Map();                        // bed_id → Set of busy nights

  async function draw() {
    sel = null;
    data = await rpc('calendar_range', { p_property: ctx.property_id, p_from: from, p_days: DAYS });
    const d = data;
    const to = addDays(from, DAYS - 1);
    setSubtitle(`${fmtDay(from + 'T12:00:00+05:30')} – ${fmtDay(to + 'T12:00:00+05:30')} · ${ctx.property_name}`);
    days = Array.from({ length: DAYS }, (_, i) => addDays(from, i));
    // A stay fills the nights it covers: check-in day up to the day before check-out.
    const nights = (startIso, endIso) => { const out = []; let x = ymd(startIso); const last = addDays(ymd(endIso), -1);
      do { out.push(x); x = addDays(x, 1); } while (x <= last); return out; };
    const span = (startIso, endIso) => {
      const sDay = ymd(startIso);
      let eDay = addDays(ymd(endIso), -1);
      if (eDay < sDay) eDay = sDay;
      const cutL = sDay < days[0]; const cutR = eDay > days[DAYS - 1];
      const s = cutL ? 0 : days.indexOf(sDay); const e = cutR ? DAYS - 1 : days.indexOf(eDay);
      return { s: s + 1, e: e + 2, cutL, cutR };
    };
    taken.clear();
    d.beds.forEach((b) => taken.set(b.id, new Set()));
    d.bookings.filter((b) => LIVE.includes(b.status)).forEach((b) => nights(b.check_in_at, b.check_out_at).forEach((n) => taken.get(b.bed_id)?.add(n)));
    d.blocks.forEach((k) => nights(k.starts_at, k.ends_at).forEach((n) => taken.get(k.bed_id)?.add(n)));

    let room = null;
    const rows = d.beds.map((bed) => {
      let html = '';
      if (bed.room !== room) { room = bed.room; html += `<div style="font-size:11px;font-weight:800;color:#6B7280;text-transform:uppercase;letter-spacing:.04em;padding:14px 0 4px">${esc(room)}</div>`; }
      const bars = [
        ...d.blocks.filter((k) => k.bed_id === bed.id).map((k) => { const p = span(k.starts_at, k.ends_at);
          return `<div class="bar" style="grid-row:1;grid-column:${p.s}/${p.e};background:repeating-linear-gradient(135deg,#DAD2B6,#DAD2B6 8px,#EDE7D3 8px,#EDE7D3 16px);color:#7A7154;position:relative;z-index:1" title="${esc(k.reason)}">${esc(k.reason)}</div>`; }),
        ...d.bookings.filter((b) => b.bed_id === bed.id).map((b) => { const p = span(b.check_in_at, b.check_out_at);
          const bg = p.cutL || b.status === 'checked_out' ? '#9CA9C4' : (b.status === 'pending' || b.balance_paise > 0) ? '#E2A03F' : '#1C9A6C';
          const r = `${p.cutL ? 0 : 8}px ${p.cutR ? 0 : 8}px ${p.cutR ? 0 : 8}px ${p.cutL ? 0 : 8}px`;
          return `<a class="bar" data-id="${esc(b.id)}" href="booking-detail.html?id=${esc(b.id)}" style="grid-row:1;grid-column:${p.s}/${p.e};background:${bg};border-radius:${r};color:#fff;position:relative;z-index:1" title="${esc(b.guest)}">${esc(b.guest)}</a>`; }),
      ].join('');
      return html + `<div style="display:grid;grid-template-columns:140px 1fr;align-items:center;border-top:1px solid #F3EFE1">
          <div style="font-size:12.5px;font-weight:700">${esc(bed.label)}</div>
          <div class="row cal-row" style="position:relative">${days.map((x, i) => `<div class="cal-cell${x === today ? ' is-today' : ''}${staff && x >= earliest && !taken.get(bed.id).has(x) ? ' is-free' : ''}"
            data-bed="${esc(bed.id)}" data-i="${i}" style="grid-row:1;grid-column:${i + 1}"></div>`).join('')}${bars}</div></div>`;
    }).join('');

    content(`
      <div class="ns-card" style="padding:18px 20px;overflow-x:auto">
        ${staff ? `<div id="cal-hint" class="ns-muted" style="font-size:12.5px;margin-bottom:10px;min-height:28px">${TIP}</div>` : ''}
        <div style="min-width:760px">
          <div style="display:grid;grid-template-columns:140px 1fr"><div></div>
            <div class="row" style="height:auto">${days.map((x) => `<div style="text-align:center;font-size:11.5px;font-weight:${x === today ? 800 : 600};color:${x === today ? '#157A56' : '#6B7280'}">${fmtWeekday(x)}</div>`).join('')}</div></div>
          ${rows || '<div class="ns-empty">No beds set up yet. Add them in Rooms & beds.</div>'}
        </div>
        <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:16px;font-size:12px;color:#6B7280">
          <span><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#1C9A6C"></span> Confirmed / paid</span>
          <span><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#E2A03F"></span> Pending / balance due</span>
          <span><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#9CA9C4"></span> Continues / checked out</span>
          <span><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#DAD2B6"></span> Maintenance</span>
          ${staff ? '<span><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#CDEBDC;border:1px solid #1C9A6C"></span> Your selection</span>' : ''}
        </div>
      </div>`);
  }

  // ------------------------------------------------------------ drag / tap selection
  let sel = null;            // { bed, a, b, done }
  let dragging = false; let justDragged = false;

  const cellsOf = (bed) => $$('.cal-cell').filter((c) => c.dataset.bed === bed);
  function rangeProblem(bed, lo, hi) {
    for (let i = lo; i <= hi; i++) {
      if (days[i] < earliest) return 'Bookings can’t start more than a day in the past.';
      if (taken.get(bed)?.has(days[i])) return 'Part of that range is already booked or blocked.';
    }
    return null;
  }
  function paint() {
    $$('.cal-cell.is-sel, .cal-cell.is-bad').forEach((c) => c.classList.remove('is-sel', 'is-bad'));
    if (!sel) return;
    const lo = Math.min(sel.a, sel.b); const hi = Math.max(sel.a, sel.b);
    const bad = rangeProblem(sel.bed, lo, hi);
    cellsOf(sel.bed).forEach((c) => { const i = +c.dataset.i; if (i >= lo && i <= hi) c.classList.add(bad ? 'is-bad' : 'is-sel'); });
  }
  const hint = (html) => { const h = $('#cal-hint'); if (h) h.innerHTML = html; };
  const clearSel = () => { sel = null; paint(); hint(TIP); };

  function finish() {
    const lo = Math.min(sel.a, sel.b); const hi = Math.max(sel.a, sel.b);
    const problem = rangeProblem(sel.bed, lo, hi);
    if (problem) { toast(problem, { error: true }); clearSel(); return; }
    openBookingDialog(data.beds.find((b) => b.id === sel.bed), days[lo], addDays(days[hi], 1));
  }

  if (staff) {
    const host = $('.ns-content');
    host.addEventListener('pointerdown', (e) => {                       // mouse / pen: drag
      const c = e.target.closest('.cal-cell.is-free');
      if (!c || e.pointerType === 'touch' || e.button !== 0) return;
      e.preventDefault();
      dragging = true; sel = { bed: c.dataset.bed, a: +c.dataset.i, b: +c.dataset.i, done: true }; paint();
    });
    host.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      // look under booking bars too, so dragging onto a booked night shows red
      const c = document.elementsFromPoint(e.clientX, e.clientY).find((el) => el.classList?.contains('cal-cell'));
      if (c && c.dataset.bed === sel.bed && +c.dataset.i !== sel.b) { sel.b = +c.dataset.i; paint(); }
    });
    window.addEventListener('pointerup', () => {
      if (!dragging) return;
      dragging = false; justDragged = true; setTimeout(() => { justDragged = false; }, 60);
      finish();
    });
    host.addEventListener('click', (e) => {                              // tap a booking bar → quick panel
      const bar = e.target.closest('a.bar[data-id]');
      if (bar) { e.preventDefault(); bookingPanel(bar.dataset.id); return; }
    });
    host.addEventListener('click', (e) => {                              // touch: tap first night, then last night
      if (justDragged || e.defaultPrevented) return;
      const c = e.target.closest('.cal-cell'); if (!c) return;
      const i = +c.dataset.i;
      if (sel && !sel.done && c.dataset.bed === sel.bed && i >= sel.a) { sel.b = i; sel.done = true; paint(); finish(); return; }
      if (!c.classList.contains('is-free')) return;
      sel = { bed: c.dataset.bed, a: i, b: i, done: false }; paint();
      const bed = data.beds.find((b) => b.id === sel.bed);
      hint(`<b>${esc(bed.label)}</b> from <b>${esc(fmtDay(days[i] + 'T12:00:00+05:30'))}</b> — now tap the <b>last night</b> (or the same night again for 1 night).
        <button type="button" class="ns-btn-ghost" id="cal-cancel" style="height:28px;font-size:12px;margin-left:6px">Cancel</button>`);
      $('#cal-cancel').onclick = (ev) => { ev.stopPropagation(); clearSel(); };
    });
  }

  // ------------------------------------------------------------ tap a booking: quick panel
  function bookingPanel(id) {
    const b = data.bookings.find((x) => x.id === id); if (!b) return;
    const bed = data.beds.find((x) => x.id === b.bed_id);
    const canDelete = staff;
    const m = modal({
      title: b.guest, width: 440,
      body: `<div style="display:flex;flex-direction:column;gap:10px;font-size:14px">
          <div>${statusPill(b.status)}</div>
          <div><span class="ns-muted" style="font-size:13px">Bed</span><br><b>${esc(bed.room)} · ${esc(bed.label)}</b></div>
          <div><span class="ns-muted" style="font-size:13px">Stay</span><br><b>${fmtDayTime(b.check_in_at)} → ${fmtDayTime(b.check_out_at)}</b></div>
          <div><span class="ns-muted" style="font-size:13px">Payment</span><br><b>${b.balance_paise > 0 ? `${rupees(b.balance_paise)} due` : 'Fully paid'}</b>${b.paid_paise ? ` · ${rupees(b.paid_paise)} received` : ''}</div>
        </div>`,
      actions: [
        ...(canDelete ? [{ label: 'Delete booking', kind: 'danger', onClick: () => {
          deleteBookingDialog({ ctx, id: b.id, guest: b.guest, room: bed.room, bed: bed.label, checkIn: b.check_in_at, checkOut: b.check_out_at,
            status: b.status, paidPaise: b.paid_paise, onDone: () => draw() });
        } }] : []),
        { label: 'Open booking', kind: 'primary', onClick: () => { location.href = `booking-detail.html?id=${b.id}`; return false; } },
      ],
    });
    return m;
  }

  // ------------------------------------------------------------ quick booking dialog
  function openBookingDialog(bed, inDay, outDay) {
    let rate = null; let guestId = null;
    const m = modal({
      title: `New booking · ${bed.room} · ${bed.label}`, width: 560,
      body: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          ${field('Check-in', `<input class="ns-input" type="datetime-local" name="in" value="${inDay}T14:00">`)}
          ${field('Check-out', `<input class="ns-input" type="datetime-local" name="out" value="${outDay}T11:00">`)}
        </div>
        <div id="qb-sum" class="ns-demo-hint" style="background:#E9F5EE;color:#157A56">Checking the bed…</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          ${field('Guest name *', '<input class="ns-input" name="name" autocomplete="off" maxlength="120">')}
          ${field('Phone', '<input class="ns-input" name="phone" type="tel" autocomplete="off" placeholder="+91 98400 12233">')}
        </div>
        <div id="qb-returning"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          ${field('Status', `<select class="ns-input" name="status">${options([['confirmed', 'Confirmed — arriving later'], ['pending', 'Pending (not confirmed yet)'],
            ...(inDay <= today ? [['checked_in', 'Check in now']] : [])], inDay === today ? 'checked_in' : 'confirmed')}</select>`)}
          ${field('Booked via', `<select class="ns-input" name="source">${options(SOURCES, 'walk_in')}</select>`)}
          ${field('Paid now (₹)', '<input class="ns-input" name="paid" inputmode="decimal" placeholder="0">')}
          ${field('Method', `<select class="ns-input" name="method">${options(METHOD_OPTIONS, 'upi')}</select>`)}
        </div>
        <div id="qb-ref">${field('UPI transaction ID (UTR)', '<input class="ns-input" name="ref" autocomplete="off" placeholder="12-digit UTR">')}</div>
        <a href="check-in.html?bed=${encodeURIComponent(bed.id)}&in=${inDay}&out=${outDay}" style="font-size:12.5px;font-weight:700;text-decoration:underline;color:#6B7280">Need ID, email or nationality? Open the full form →</a>`,
      actions: [{ label: 'Cancel', onClick: () => { clearSel(); } },
        { label: 'Save booking', kind: 'primary', onClick: async (el) => {
          const v = (n) => el.querySelector(`[name=${n}]`).value.trim();
          if (!guestId && v('name').length < 2) throw new Error('Enter the guest’s name.');
          if (rate === null) throw new Error('This bed isn’t free for those dates.');
          const paid = v('paid') ? toPaise(v('paid')) : 0;
          if (Number.isNaN(paid) || paid < 0) throw new Error('Enter a valid amount paid.');
          if (paid > 0 && v('method') === 'upi' && !v('ref')) throw new Error('Enter the UPI transaction ID (UTR).');
          const res = await rpc('create_booking', { p: {
            property_id: ctx.property_id, bed_id: bed.id, guest_id: guestId,
            guest: guestId ? null : { full_name: v('name'), phone: v('phone') },
            check_in_at: fromInputDT(v('in')), check_out_at: fromInputDT(v('out')),
            status: v('status'), source: v('source'), visitors: 1,
            payment: paid > 0 ? { amount_paise: paid, method: v('method'), reference: v('ref') || null } : null,
          } });
          toast(`${res.code} booked for ${bed.label}.`);
          hint(TIP); draw();
          setTimeout(() => sendBookingWhatsApp(res.id, { justSaved: true }).catch(() => {}), 150);
        } }],
    });
    m.el.querySelector('.ns-x').addEventListener('click', clearSel);
    const f = (n) => m.el.querySelector(`[name=${n}]`);
    const check = async () => {
      const inAt = fromInputDT(f('in').value); const outAt = fromInputDT(f('out').value); const box = m.el.querySelector('#qb-sum');
      const bad = (msg) => { rate = null; box.className = 'ns-error'; box.style.cssText = ''; box.textContent = msg; };
      if (!inAt || !outAt || new Date(outAt) <= new Date(inAt)) return bad('Check-out must be after check-in.');
      const free = await rpc('available_beds', { p_property: ctx.property_id, p_in: inAt, p_out: outAt }).catch(() => []);
      const me = free.find((x) => x.id === bed.id);
      if (!me) return bad(`${bed.label} isn’t free for all of those dates.`);
      const n = Math.max(1, Math.round((new Date(f('out').value.slice(0, 10)) - new Date(f('in').value.slice(0, 10))) / 864e5));
      rate = me.rate_paise; box.className = 'ns-demo-hint'; box.style.cssText = 'background:#E9F5EE;color:#157A56';
      box.innerHTML = `✓ ${esc(bed.label)} is free · <b>${n} night${n > 1 ? 's' : ''}</b> × ${rupees(rate)} = <b>${rupees(n * rate)}</b>`;
    };
    ['in', 'out'].forEach((n) => f(n).addEventListener('change', check));
    f('method').addEventListener('change', () => { m.el.querySelector('#qb-ref').hidden = f('method').value !== 'upi'; });
    f('phone').addEventListener('input', debounce(async () => {
      const digits = f('phone').value.replace(/\D/g, ''); const box = m.el.querySelector('#qb-returning');
      guestId = null; f('name').disabled = false;
      if (digits.length < 8) { box.innerHTML = ''; return; }
      const found = await rpc('search_guests', { p_property: ctx.property_id, p_q: digits }).catch(() => []);
      if (!found.length) { box.innerHTML = ''; return; }
      const g = found[0];
      box.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;background:#EAF1FB;font-size:13px">
        <span>Returning guest: <b>${esc(g.full_name)}</b></span><button type="button" class="ns-btn-ghost" style="height:30px;font-size:12px" id="qb-use">Use</button></div>`;
      box.querySelector('#qb-use').onclick = () => {
        guestId = g.id; f('name').value = g.full_name; f('name').disabled = true;
        box.innerHTML = `<div class="ns-muted">Booking for <b>${esc(g.full_name)}</b> (existing guest)</div>`;
      };
    }, 400));
    check();
  }

  await draw();
});
