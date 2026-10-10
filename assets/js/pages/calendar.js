// Calendar — every bed, every night. Drag across a bed's row (or tap the first
// and last night on a phone) to create a booking for those dates.
import { otaOf, guestFace, W, roomsMode, guestsText, q, sb, toInputDT, confirmDialog, sendBookingWhatsApp, deleteBookingDialog, statusPill, fmtDayTime, page, rpc, content, setSubtitle, headerActions, esc, ymd, addDays, fmtWeekday, fmtDay, rupees, toPaise,
  modal, toast, field, options, METHOD_OPTIONS, SOURCES, debounce, fromInputDT, $, $$ } from '../core.js';

let DAYS = 9;                                     // 9 days (week view) or the days of the month (month view)
const WEEK_DAYS = 9;
// Month view — for PG / monthly stays. Remembered per device; the 9-day view stays the default.
let VIEW = (() => { try { return localStorage.getItem('ns.cal.view') === 'month' ? 'month' : 'week'; } catch { return 'week'; } })();
const monthStart = (d) => d.slice(0, 8) + '01';
const monthDays = (d) => new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7), 0)).getUTCDate();
const shiftMonth = (d, n) => { const x = new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1 + n, 1)); return x.toISOString().slice(0, 10); };
const LIVE = ['pending', 'confirmed', 'checked_in'];
const TIP = () => `<b style="color:#157A56">Tip:</b> drag across a ${W.unit}’s free nights to book them — on a phone, tap the first night, then the last.`;

page('calendar', async (ctx) => {
  const staff = ctx.can('owner', 'manager', 'front_desk');
  let from = VIEW === 'month' ? monthStart(ymd()) : addDays(ymd(), -2);
  let data = null;
  const head = headerActions();
  head.innerHTML = `<div class="cal-viewtog" role="group" aria-label="Calendar view">
      <button type="button" data-view="week" aria-pressed="${VIEW === 'week'}">9 days</button><button type="button" data-view="month" aria-pressed="${VIEW === 'month'}">Month</button></div>
    <button type="button" class="ns-btn-ghost" id="prev" aria-label="Previous">‹ Prev</button>
    <button type="button" class="ns-btn-ghost" id="today">Today</button>
    <button type="button" class="ns-btn-ghost" id="next" aria-label="Next week">Next ›</button>
    ${staff ? '<a href="check-in.html?new=1" class="ns-btn">+ New booking</a>' : ''}`;
  $('#prev').onclick = () => { from = VIEW === 'month' ? shiftMonth(from, -1) : addDays(from, -7); draw(); };
  $('#next').onclick = () => { from = VIEW === 'month' ? shiftMonth(from, 1) : addDays(from, 7); draw(); };
  $('#today').onclick = () => { from = VIEW === 'month' ? monthStart(ymd()) : addDays(ymd(), -2); draw(); };
  head.querySelectorAll('.cal-viewtog button').forEach((btn) => btn.addEventListener('click', () => {
    if (btn.dataset.view === VIEW) return;
    VIEW = btn.dataset.view; try { localStorage.setItem('ns.cal.view', VIEW); } catch { /* ignore */ }
    head.querySelectorAll('.cal-viewtog button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.view === VIEW)));
    from = VIEW === 'month' ? monthStart(from > ymd() || addDays(from, WEEK_DAYS) < ymd() ? from : ymd()) : (from.slice(0, 7) === ymd().slice(0, 7) ? addDays(ymd(), -2) : from);
    draw();
  }));

  const today = ymd();
  const earliest = addDays(today, -1);            // bookings can start at most yesterday
  let days = [];
  const taken = new Map();                        // bed_id → Set of busy nights

  async function draw() {
    sel = null;
    const month = VIEW === 'month';
    DAYS = month ? monthDays(from) : WEEK_DAYS;
    data = await rpc('calendar_range', { p_property: ctx.property_id, p_from: from, p_days: DAYS });
    const d = data;
    const to = addDays(from, DAYS - 1);
    setSubtitle(month
      ? `${new Date(from + 'T12:00:00Z').toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })} · ${ctx.property_name}`
      : `${fmtDay(from + 'T12:00:00+05:30')} – ${fmtDay(to + 'T12:00:00+05:30')} · ${ctx.property_name}`);
    const cols = `grid-template-columns:repeat(${DAYS},minmax(0,1fr))`;
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
    const occByDay = {}; const totalUnits = d.beds.length;
    d.bookings.filter((b) => ['pending', 'confirmed', 'checked_in', 'checked_out'].includes(b.status)).forEach((b) => {
      const seen = new Set(); nights(b.check_in_at, b.check_out_at).forEach((n) => { if (!seen.has(n)) { seen.add(n); occByDay[n] = (occByDay[n] || 0) + 1; } });
    });

    let room = null;
    const rows = d.beds.map((bed) => {
      let html = '';
      if (bed.room !== room) { room = bed.room; html += `<div style="font-size:11px;font-weight:800;color:#6B7280;text-transform:uppercase;letter-spacing:.04em;padding:14px 0 4px">${esc(room)}</div>`; }
      const bars = [
        ...d.blocks.filter((k) => k.bed_id === bed.id).map((k) => { const p = span(k.starts_at, k.ends_at);
          const ota = otaOf(k.reason);
          if (ota) return `<button type="button" class="bar cb cb-ota${p.cutL ? ' cut-l' : ''}${p.cutR ? ' cut-r' : ''}" data-block="${esc(k.id)}" style="grid-column:${p.s}/${p.e};--ota:${ota.color}" title="${esc(ota.label)} booking (imported) — change it on ${esc(ota.label)}"><span class="cb-ico">🔗</span><span class="cb-name">${esc(ota.label)}</span></button>`;
          return `<button type="button" class="bar cb cb-maint${p.cutL ? ' cut-l' : ''}${p.cutR ? ' cut-r' : ''}" data-block="${esc(k.id)}" style="grid-column:${p.s}/${p.e}" title="Maintenance: ${esc(k.reason)} — tap to change or remove"><span class="cb-ico">🔧</span><span class="cb-name">${esc(k.reason)}</span></button>`; }),
        ...d.bookings.filter((b) => b.bed_id === bed.id).map((b) => { const p = span(b.check_in_at, b.check_out_at);
          const cls = b.status === 'checked_out' ? 'cb-out' : b.status === 'checked_in' ? 'cb-in' : b.status === 'pending' ? 'cb-pend' : b.balance_paise > 0 ? 'cb-due' : 'cb-conf';
          const span_ = p.e - p.s; const parts = String(b.guest || '').trim().split(/\s+/);
          const short = span_ <= (month ? 3 : 1) ? parts[0] : parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
          const nights = Math.max(1, Math.round((new Date(ymd(b.check_out_at)) - new Date(ymd(b.check_in_at))) / 864e5));
          const tag = b.status === 'checked_in' ? '<span class="cb-tag cb-live" title="In house">●</span>'
            : b.balance_paise > 0 ? `<span class="cb-tag" title="${rupees(b.balance_paise)} due">₹</span>` : b.status !== 'pending' ? '<span class="cb-tag" title="Paid">✓</span>' : '';
          const label = { 'cb-in': 'In house', 'cb-conf': 'Confirmed · paid', 'cb-due': 'Balance due', 'cb-pend': 'Pending', 'cb-out': 'Checked out' }[cls];
          return `<a draggable="false" class="bar cb ${cls}${p.cutL ? ' cut-l' : ''}${p.cutR ? ' cut-r' : ''}" data-id="${esc(b.id)}" href="booking-detail.html?id=${esc(b.id)}" style="grid-column:${p.s}/${p.e}"
            title="${esc(b.guest)} · ${nights} night${nights > 1 ? 's' : ''} · ${label}${b.balance_paise > 0 ? ' · ' + rupees(b.balance_paise) + ' due' : ''}">
            ${guestFace(b.guest, month ? 20 : 24)}${month && span_ <= 1 ? '' : `<span class="cb-name">${esc(short)}</span>`}${span_ > (month ? 4 : 1) ? `<span class="cb-n">${nights >= 28 && month ? `${Math.round(nights / 30 * 10) / 10} mo` : `${nights}n`}</span>` : ''}${month && span_ <= 2 ? '' : tag}</a>`; }),
      ].join('');
      return html + `<div style="display:grid;grid-template-columns:140px 1fr;align-items:center;border-top:1px solid #F3EFE1">
          <div class="cal-bed"><span class="cal-bed-ico" aria-hidden="true">${roomsMode() ? '🚪' : '🛏'}</span><span>${esc(bed.label)}</span></div>
          <div class="row cal-row" style="position:relative;${cols}">${days.map((x, i) => `<div class="cal-cell${x === today ? ' is-today' : ''}${[0, 6].includes(new Date(x + 'T12:00:00Z').getUTCDay()) ? ' is-weekend' : ''}${staff && x >= earliest && !taken.get(bed.id).has(x) ? ' is-free' : ''}"
            data-bed="${esc(bed.id)}" data-i="${i}" style="grid-row:1;grid-column:${i + 1}"></div>`).join('')}${bars}</div></div>`;
    }).join('');

    content(`
      <div class="ns-card${month ? ' cal-month' : ''}" style="padding:18px 20px;overflow-x:auto">
        ${staff ? `<div id="cal-hint" class="ns-muted" style="font-size:12.5px;margin-bottom:10px;min-height:28px">${TIP()}</div>` : ''}
        <div style="min-width:${month ? 140 + DAYS * 28 : 760}px">
          <div style="display:grid;grid-template-columns:140px 1fr"><div></div>
            <div class="row cal-head" style="height:auto;${cols}">${days.map((x) => {
              const dt = new Date(x + 'T12:00:00Z'); const occ = occByDay[x] || 0; const pct = totalUnits ? Math.round((occ / totalUnits) * 100) : 0;
              const wk = [0, 6].includes(dt.getUTCDay());
              return `<div class="cal-day${x === today ? ' is-today' : ''}${wk ? ' is-weekend' : ''}">
                <div class="cal-wd">${x === today && !month ? 'Today' : dt.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' }).slice(0, month ? 2 : 3)}</div>
                <div class="cal-dn">${dt.getUTCDate()}</div>
                <div class="cal-mo">${dt.toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' }).replace('Sept', 'Sep')}</div>
                <div class="cal-occ" title="${occ} of ${totalUnits} ${W.units} booked"><span style="width:${pct}%;background:${pct >= 90 ? '#B23A3A' : pct >= 60 ? '#1C9A6C' : '#E2A03F'}"></span></div>
                <div class="cal-occn">${occ}/${totalUnits}</div></div>`; }).join('')}</div></div>
          ${rows || '<div class="ns-empty">No ${W.units} set up yet. Add them in ${W.setup}.</div>'}
        </div>
        <div class="cal-legend">
          <span><i class="lg cb-in"></i> In house</span><span><i class="lg cb-conf"></i> Confirmed · paid</span>
          <span><i class="lg cb-due"></i> Balance due</span><span><i class="lg cb-pend"></i> Pending</span>
          <span><i class="lg cb-out"></i> Checked out</span><span><i class="lg cb-maint"></i> Maintenance</span><span><i class="lg cb-ota"></i> 🔗 OTA booking</span>
          ${staff ? '<span><i class="lg" style="background:#CDEBDC;border:1px solid #1C9A6C"></i> Your selection</span>' : ''}
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
  const clearSel = () => { sel = null; paint(); hint(TIP()); };

  function finish() {
    const lo = Math.min(sel.a, sel.b); const hi = Math.max(sel.a, sel.b);
    const problem = rangeProblem(sel.bed, lo, hi);
    if (problem) { toast(problem, { error: true }); clearSel(); return; }
    openBookingDialog(data.beds.find((b) => b.id === sel.bed), days[lo], addDays(days[hi], 1));
  }

  // ------------------------------------------------------------ move a booking: drag (mouse) or "Move…" then tap (phone)
  let mv = null;            // { b, grab, startIdx, n, x0, y0, active, ghost, target }
  let moveMode = null;      // tap-to-place: { b }
  let justMoved = false;
  const dayIdx = (day) => Math.round((new Date(day + 'T12:00:00Z') - new Date(days[0] + 'T12:00:00Z')) / 864e5);
  const stayNights = (b) => Math.max(1, Math.round((new Date(ymd(b.check_out_at) + 'T12:00:00Z') - new Date(ymd(b.check_in_at) + 'T12:00:00Z')) / 864e5));
  function ownNights(b) { const out = new Set(); for (let i = 0; i < stayNights(b); i++) out.add(addDays(ymd(b.check_in_at), i)); return out; }
  function moveProblem(b, bedId, startIdx) {
    const origIdx = dayIdx(ymd(b.check_in_at)); const n = stayNights(b); const start = addDays(days[0], startIdx);
    if (b.status === 'checked_out') return 'Checked-out stays can’t be moved.';
    if (b.status === 'checked_in' && startIdx !== origIdx) return `${b.guest} is checked in — you can only move them to another ${W.unit} on the same dates.`;
    if (startIdx !== origIdx && start < earliest) return 'A stay can’t be moved into the past.';
    const own = bedId === b.bed_id ? ownNights(b) : new Set();
    for (let i = 0; i < n; i++) { const d = addDays(start, i); if (taken.get(bedId)?.has(d) && !own.has(d)) return 'Part of those nights is already booked or blocked.'; }
    return null;
  }
  function paintMove(bedId, startIdx, bad) {
    $$('.cal-cell.is-sel, .cal-cell.is-bad').forEach((c) => c.classList.remove('is-sel', 'is-bad'));
    if (!bedId) return;
    const n = stayNights(mv?.b || moveMode?.b);
    cellsOf(bedId).forEach((c) => { const i = +c.dataset.i; if (i >= startIdx && i < startIdx + n) c.classList.add(bad ? 'is-bad' : 'is-sel'); });
  }
  function confirmMove(b, bedId, startIdx) {
    const n = stayNights(b); const bed = data.beds.find((x) => x.id === bedId); const oldBed = data.beds.find((x) => x.id === b.bed_id);
    const newIn = addDays(days[0], startIdx);
    if (bedId === b.bed_id && newIn === ymd(b.check_in_at)) return;
    const inT = toInputDT(b.check_in_at).slice(11); const outT = toInputDT(b.check_out_at).slice(11);
    const checkIn = fromInputDT(`${newIn}T${inT}`); const checkOut = fromInputDT(`${addDays(newIn, n)}T${outT}`);
    const fmt = (iso) => fmtDay(iso);
    modal({
      title: `Move ${b.guest}?`, width: 480,
      body: `<div class="mv-grid">
          <div class="mv-box"><div class="mv-lbl">From</div><b>${esc(oldBed.room)} · ${esc(oldBed.label)}</b><div>${fmt(b.check_in_at)} → ${fmt(b.check_out_at)}</div></div>
          <div class="mv-arrow">→</div>
          <div class="mv-box is-new"><div class="mv-lbl">To</div><b>${esc(bed.room)} · ${esc(bed.label)}</b><div>${fmt(checkIn)} → ${fmt(checkOut)}</div></div></div>
        <div class="ns-muted" style="font-size:12.5px">${n} night${n > 1 ? 's' : ''}, same check-in and check-out times.${bedId !== b.bed_id ? ` The price follows ${esc(bed.label)}’s rate.` : ''}</div>`,
      actions: [{ label: 'Cancel', onClick: () => { paintMove(null); } },
        { label: 'Move booking', kind: 'primary', onClick: async () => {
          await rpc('update_booking', { p_booking: b.id, p: { check_in_at: checkIn, check_out_at: checkOut, bed_id: bedId } });
          toast(`${b.guest} moved to ${bed.label}, ${fmt(checkIn)}.`); moveMode = null; hint(TIP()); draw();
        } }],
    }).el.querySelector('.ns-x').addEventListener('click', () => paintMove(null));
  }
  function startMoveMode(b) {
    moveMode = { b };
    hint(`<b>Moving ${esc(b.guest)}</b> — tap the new <b>first night</b> on any ${W.unit}${b.status === 'checked_in' ? ` (checked in: pick a ${W.unit}, dates stay the same)` : ''}.
      <button type="button" class="ns-btn-ghost" id="mv-cancel" style="height:28px;font-size:12px;margin-left:6px">Cancel</button>`);
    $('#mv-cancel').onclick = (ev) => { ev.stopPropagation(); moveMode = null; paintMove(null); hint(TIP()); };
  }

  if (staff) {
    const host = $('.ns-content');
    host.addEventListener('dragstart', (e) => { if (e.target.closest?.('a.bar')) e.preventDefault(); });
    host.addEventListener('pointerdown', (e) => {                       // mouse: drag a booking bar to move it
      const bar = e.target.closest('a.bar[data-id]');
      if (!bar || e.pointerType === 'touch' || e.button !== 0) return;
      const b = data.bookings.find((x) => x.id === bar.dataset.id); if (!b || b.status === 'checked_out') return;
      const c = document.elementsFromPoint(e.clientX, e.clientY).find((el) => el.classList?.contains('cal-cell'));
      const startIdx = dayIdx(ymd(b.check_in_at));
      mv = { b, bar, startIdx, grab: c ? +c.dataset.i - startIdx : 0, x0: e.clientX, y0: e.clientY, active: false, target: null };
      e.preventDefault();
    });
    host.addEventListener('pointermove', (e) => {
      if (!mv) return;
      if (!mv.active) {
        if (Math.hypot(e.clientX - mv.x0, e.clientY - mv.y0) < 6) return;
        mv.active = true; document.body.classList.add('cal-moving');
        const r = mv.bar.getBoundingClientRect();
        mv.ghost = mv.bar.cloneNode(true); mv.ghost.classList.add('cb-ghost'); mv.ghost.style.width = `${Math.min(r.width, 260)}px`;
        mv.dx = Math.min(e.clientX - r.left, 40); mv.dy = e.clientY - r.top;
        document.body.appendChild(mv.ghost); mv.bar.classList.add('cb-dragging');
      }
      mv.ghost.style.left = `${e.clientX - mv.dx}px`; mv.ghost.style.top = `${e.clientY - mv.dy}px`;
      const c = document.elementsFromPoint(e.clientX, e.clientY).find((el) => el.classList?.contains('cal-cell'));
      if (!c) { mv.target = null; paintMove(null); return; }
      const bedId = c.dataset.bed;
      const startIdx = mv.b.status === 'checked_in' ? mv.startIdx : +c.dataset.i - mv.grab;
      const bad = moveProblem(mv.b, bedId, startIdx);
      mv.target = { bedId, startIdx, bad }; paintMove(bedId, startIdx, bad);
    });
    window.addEventListener('pointerup', () => {
      if (!mv) return;
      const m = mv; mv = null;
      if (!m.active) return;                                             // a plain click: let it open the panel
      justMoved = true; setTimeout(() => { justMoved = false; }, 80);
      m.ghost?.remove(); m.bar.classList.remove('cb-dragging'); document.body.classList.remove('cal-moving');
      if (!m.target) { paintMove(null); return; }
      if (m.target.bad) { toast(m.target.bad, { error: true }); paintMove(null); return; }
      confirmMove(m.b, m.target.bedId, m.target.startIdx);
    });
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
      if (bar) { e.preventDefault(); if (!justMoved && !moveMode) bookingPanel(bar.dataset.id); return; }
      const blk = e.target.closest('[data-block]');
      if (blk && staff) { e.preventDefault(); blockPanel(blk.dataset.block); return; }
    });
    host.addEventListener('click', (e) => {                              // touch: tap first night, then last night
      if (justDragged || justMoved) return;
      if (moveMode) {                                                    // "Move…": tap the new first night
        const c0 = e.target.closest('.cal-cell') || document.elementsFromPoint(e.clientX, e.clientY).find((el) => el.classList?.contains('cal-cell'));
        if (!c0) return;
        e.preventDefault();
        const b = moveMode.b; const startIdx = b.status === 'checked_in' ? dayIdx(ymd(b.check_in_at)) : +c0.dataset.i;
        const bad = moveProblem(b, c0.dataset.bed, startIdx);
        mv = null; paintMove(c0.dataset.bed, startIdx, bad);
        if (bad) { toast(bad, { error: true }); return; }
        confirmMove(b, c0.dataset.bed, startIdx); return;
      }
      if (e.defaultPrevented) return;
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

  // ------------------------------------------------------------ tap a maintenance block: change / remove
  const REASONS = ['Repair', 'Deep cleaning', 'Pest control', 'Painting', 'Owner / staff use'];
  function blockPanel(id) {
    const k = data.blocks.find((x) => x.id === id); if (!k) return;
    const bed = data.beds.find((x) => x.id === k.bed_id);
    const ota = otaOf(k.reason);
    if (ota) {
      modal({ title: `${ota.label} booking · ${bed.room} · ${bed.label}`, width: 440,
        body: `<div style="display:flex;flex-direction:column;gap:10px;font-size:14px">
            <div><span class="ota-badge" style="background:${ota.color}">${esc(ota.label)}</span></div>
            <div><span class="ns-muted" style="font-size:13px">Dates</span><br><b>${fmtDayTime(k.starts_at)} → ${fmtDayTime(k.ends_at)}</b></div>
            <div class="ns-muted" style="font-size:13px">Imported from ${esc(ota.label)}’s calendar, so this ${W.unit} can’t be double-booked here. To change or cancel it, do it on ${esc(ota.label)} — NammaStay updates at the next sync.</div></div>`,
        actions: [{ label: 'Close' }, ...(ctx.can('owner', 'manager') ? [{ label: 'OTA sync settings', kind: 'primary', onClick: () => { location.href = 'ota.html'; } }] : [])] });
      return;
    }
    modal({
      title: `Maintenance · ${bed.room} · ${bed.label}`, width: 460,
      body: `<div style="display:flex;flex-direction:column;gap:12px">
          ${field('Reason', `<input class="ns-input" name="reason" maxlength="120" value="${esc(k.reason || '')}">`)}
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            ${field('From', `<input class="ns-input" type="datetime-local" name="from" value="${toInputDT(k.starts_at)}">`)}
            ${field('Until', `<input class="ns-input" type="datetime-local" name="to" value="${toInputDT(k.ends_at)}">`)}</div>
          <div class="ns-help">Guests can’t be booked into this ${W.unit} while it’s blocked.</div></div>`,
      actions: [
        { label: 'Remove maintenance', kind: 'danger', onClick: async () => {
          if (!await confirmDialog('Remove maintenance', `${bed.label} will be available to book again for those dates.`, { confirmLabel: 'Remove', danger: true })) return false;
          await q(sb.from('bed_blocks').delete().eq('id', k.id));
          toast(`${bed.label} is available again.`); draw();
        } },
        { label: 'Save changes', kind: 'primary', onClick: async (el) => {
          const v = (n) => el.querySelector(`[name=${n}]`).value;
          const from = fromInputDT(v('from')); const to = fromInputDT(v('to')); const reason = v('reason').trim() || 'Maintenance';
          if (!from || !to || new Date(to) <= new Date(from)) throw new Error('“Until” must be after “From”.');
          await q(sb.from('bed_blocks').delete().eq('id', k.id));
          try { await rpc('set_bed_block', { p_bed: k.bed_id, p_from: from, p_to: to, p_reason: reason }); }
          catch (err) {                                            // put the old block back if the new dates don't fit
            await rpc('set_bed_block', { p_bed: k.bed_id, p_from: k.starts_at, p_to: k.ends_at, p_reason: k.reason }).catch(() => {});
            throw err;
          }
          toast('Maintenance updated.'); draw();
        } }],
    });
  }

  // ------------------------------------------------------------ tap a booking: quick panel
  function bookingPanel(id) {
    const b = data.bookings.find((x) => x.id === id); if (!b) return;
    const bed = data.beds.find((x) => x.id === b.bed_id);
    const canDelete = staff && ctx.allow('delete_bookings');
    const m = modal({
      title: b.guest, width: 440,
      body: `<div style="display:flex;flex-direction:column;gap:10px;font-size:14px">
          <div>${statusPill(b.status)}</div>
          <div><span class="ns-muted" style="font-size:13px">Bed</span><br><b>${esc(bed.room)} · ${esc(bed.label)}</b></div>
          <div><span class="ns-muted" style="font-size:13px">Stay</span><br><b>${fmtDayTime(b.check_in_at)} → ${fmtDayTime(b.check_out_at)}</b></div>
          <div><span class="ns-muted" style="font-size:13px">Payment</span><br><b>${b.balance_paise > 0 ? `${rupees(b.balance_paise)} due` : 'Fully paid'}</b>${b.paid_paise ? ` · ${rupees(b.paid_paise)} received` : ''}</div>
        </div>`,
      actions: [
        ...(['pending', 'confirmed', 'checked_in'].includes(b.status) ? [{ label: 'Move…', onClick: () => { setTimeout(() => startMoveMode(b), 30); } }] : []),
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
      title: `${bed.room} · ${bed.label}`, width: 560,
      body: `<div class="ns-seg light" role="tablist" id="qb-mode"><button type="button" class="is-on" data-mode="book">📅 New booking</button><button type="button" data-mode="maint">🔧 Maintenance</button></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          ${field('Check-in', `<input class="ns-input" type="datetime-local" name="in" value="${inDay}T14:00">`)}
          ${field('Check-out', `<input class="ns-input" type="datetime-local" name="out" value="${outDay}T11:00">`)}
        </div>
        <div id="qb-sum" class="ns-demo-hint" style="background:#E9F5EE;color:#157A56">Checking the ${W.unit}…</div>
        <div id="qb-maint" hidden style="display:flex;flex-direction:column;gap:10px">
          ${field('Reason', '<input class="ns-input" name="reason" maxlength="120" placeholder="e.g. Fan repair">')}
          <div style="display:flex;gap:6px;flex-wrap:wrap">${REASONS.map((r) => `<button type="button" class="ns-chip" data-reason="${esc(r)}">${esc(r)}</button>`).join('')}</div>
          <div class="ns-help">The ${W.unit} can’t be booked while it’s blocked. Tap the block on the calendar later to change or remove it.</div>
        </div>
        <div id="qb-book" style="display:flex;flex-direction:column;gap:12px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          ${field('Guest name *', '<input class="ns-input" name="name" autocomplete="off" maxlength="120">')}
          ${field('Phone', '<input class="ns-input" name="phone" type="tel" autocomplete="off" placeholder="+91 98400 12233">')}
        </div>
        ${roomsMode() ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          ${field('Adults', '<input class="ns-input" name="adults" type="number" min="1" max="20" value="2">')}
          ${field('Children', '<input class="ns-input" name="children" type="number" min="0" max="20" value="0">')}</div>` : ''}
        <div id="qb-returning"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          ${field('Status', `<select class="ns-input" name="status">${options([['confirmed', 'Confirmed — arriving later'], ['pending', 'Pending (not confirmed yet)'],
            ...(inDay <= today ? [['checked_in', 'Check in now']] : [])], inDay === today ? 'checked_in' : 'confirmed')}</select>`)}
          ${field('Booked via', `<select class="ns-input" name="source">${options(SOURCES, 'walk_in')}</select>`)}
          ${ctx.allow('record_payments') ? `${field('Paid now (₹)', '<input class="ns-input" name="paid" inputmode="decimal" placeholder="0">')}
          ${field('Method', `<select class="ns-input" name="method">${options(METHOD_OPTIONS, 'upi')}</select>`)}` : ''}
        </div>
        ${ctx.allow('record_payments') ? `<div id="qb-ref">${field('UPI transaction ID (UTR)', '<input class="ns-input" name="ref" autocomplete="off" placeholder="12-digit UTR">')}</div>` : ''}
        <a href="check-in.html?bed=${encodeURIComponent(bed.id)}&in=${inDay}&out=${outDay}" style="font-size:12.5px;font-weight:700;text-decoration:underline;color:#6B7280">Need ID, email or nationality? Open the full form →</a>
        </div>`,
      actions: [{ label: 'Cancel', onClick: () => { clearSel(); } },
        { label: 'Save booking', kind: 'primary', onClick: async (el) => {
          const v = (n) => el.querySelector(`[name=${n}]`).value.trim();
          if (mode === 'maint') {
            const from = fromInputDT(v('in')); const to = fromInputDT(v('out'));
            if (!from || !to || new Date(to) <= new Date(from)) throw new Error('The end must be after the start.');
            await rpc('set_bed_block', { p_bed: bed.id, p_from: from, p_to: to, p_reason: v('reason') || 'Maintenance' });
            toast(`${bed.label} blocked for maintenance.`); hint(TIP()); draw(); return;
          }
          if (!guestId && v('name').length < 2) throw new Error('Enter the guest’s name.');
          if (rate === null) throw new Error(`This ${W.unit} isn’t free for those dates.`);
          const paid = el.querySelector('[name=paid]') && v('paid') ? toPaise(v('paid')) : 0;
          if (Number.isNaN(paid) || paid < 0) throw new Error('Enter a valid amount paid.');
          if (paid > 0 && v('method') === 'upi' && !v('ref')) throw new Error('Enter the UPI transaction ID (UTR).');
          const res = await rpc('create_booking', { p: {
            property_id: ctx.property_id, bed_id: bed.id, guest_id: guestId,
            guest: guestId ? null : { full_name: v('name'), phone: v('phone') },
            check_in_at: fromInputDT(v('in')), check_out_at: fromInputDT(v('out')),
            status: v('status'), source: v('source'),
            visitors: roomsMode() ? Math.max(1, parseInt(v('adults'), 10) || 1) : 1, children: roomsMode() ? Math.max(0, parseInt(v('children'), 10) || 0) : 0,
            payment: paid > 0 ? { amount_paise: paid, method: v('method'), reference: v('ref') || null } : null,
          } });
          toast(`${res.code} booked for ${bed.label}.`);
          hint(TIP()); draw();
          setTimeout(() => sendBookingWhatsApp(res.id, { justSaved: true }).catch(() => {}), 150);
        } }],
    });
    m.el.querySelector('.ns-x').addEventListener('click', clearSel);
    let mode = 'book';
    const saveBtn = [...m.el.querySelectorAll('.ns-modal-foot .ns-btn')].pop();
    m.el.querySelector('#qb-mode').addEventListener('click', (e) => {
      const b = e.target.closest('[data-mode]'); if (!b) return; mode = b.dataset.mode;
      m.el.querySelectorAll('#qb-mode button').forEach((x) => x.classList.toggle('is-on', x === b));
      m.el.querySelector('#qb-book').hidden = mode !== 'book'; m.el.querySelector('#qb-maint').hidden = mode !== 'maint';
      m.el.querySelector('#qb-sum').hidden = mode !== 'book';
      if (saveBtn) saveBtn.textContent = mode === 'maint' ? 'Block for maintenance' : 'Save booking';
      if (mode === 'maint') m.el.querySelector('[name=reason]').focus();
    });
    m.el.querySelectorAll('[data-reason]').forEach((c) => c.addEventListener('click', () => {
      m.el.querySelector('[name=reason]').value = c.dataset.reason;
      m.el.querySelectorAll('[data-reason]').forEach((x) => x.classList.toggle('is-on', x === c));
    }));
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
      let extra = 0; let capNote = '';
      if (roomsMode()) {
        const ad = Math.max(1, parseInt(f('adults').value, 10) || 1); const ch = Math.max(0, parseInt(f('children').value, 10) || 0);
        extra = Math.max(0, ad - (me.base_guests || 1)) * (me.extra_guest_paise || 0);
        if (ad + ch > (me.max_guests || 1)) { rate = null; box.className = 'ns-error'; box.style.cssText = ''; box.textContent = `${bed.label} fits up to ${me.max_guests} guests.`; return; }
        capNote = ` · ${guestsText(ad, ch)}${extra ? ` (+${rupees(extra)} extra adult)` : ''}`;
      }
      box.innerHTML = `✓ ${esc(bed.label)} is free${capNote} · <b>${n} night${n > 1 ? 's' : ''}</b> × ${rupees(rate + extra)} = <b>${rupees(n * (rate + extra))}</b>`;
    };
    ['in', 'out'].forEach((n) => f(n).addEventListener('change', check));
    if (roomsMode()) ['adults', 'children'].forEach((n) => f(n).addEventListener('input', check));
    f('method')?.addEventListener('change', () => { m.el.querySelector('#qb-ref').hidden = f('method').value !== 'upi'; });
    const lookup = debounce(async (src) => {
      if (guestId) return;
      const box = m.el.querySelector('#qb-returning'); const v = src.value.trim(); const digits = v.replace(/\D/g, '');
      const qv = src.name === 'phone' ? (digits.length >= 6 ? digits : '') : (v.length >= 3 ? v : '');
      if (!qv) { box.innerHTML = ''; return; }
      const found = await rpc('search_guests', { p_property: ctx.property_id, p_q: qv }).catch(() => []);
      if (!found.length || guestId) { box.innerHTML = ''; return; }
      box.innerHTML = `<div class="gs-list" style="margin-top:0"><div class="gs-head">Existing guests — tap to use</div>${found.slice(0, 4).map((g) => `<button type="button" class="gs-item" data-gid="${esc(g.id)}">
          ${guestFace(g.full_name, 30)}<span class="gs-main"><b>${esc(g.full_name)}</b><span>${esc([g.phone, g.nationality].filter(Boolean).join(' · '))}</span></span></button>`).join('')}</div>`;
      box.querySelectorAll('[data-gid]').forEach((b) => b.addEventListener('click', () => {
        const g = found.find((x) => x.id === b.dataset.gid); guestId = g.id;
        f('name').value = g.full_name; f('phone').value = g.phone || ''; f('name').readOnly = true; f('phone').readOnly = true;
        box.innerHTML = `<div class="gs-picked" style="padding:8px 12px">${guestFace(g.full_name, 30)}<span style="flex:1;font-size:13px"><b>${esc(g.full_name)}</b> · existing guest</span>
          <button type="button" class="ns-btn-ghost" style="height:30px;font-size:12px" id="qb-clear">Clear</button></div>`;
        box.querySelector('#qb-clear').onclick = () => { guestId = null; f('name').readOnly = false; f('phone').readOnly = false; f('name').value = ''; f('phone').value = ''; box.innerHTML = ''; f('name').focus(); };
      }));
    }, 300);
    ['name', 'phone'].forEach((n) => f(n).addEventListener('input', () => lookup(f(n))));
    check();
  }

  await draw();
});
