import { page, rpc, content, setSubtitle, headerActions, esc, ymd, addDays, fmtWeekday, fmtDay, $ } from '../core.js';

const DAYS = 9;

page('calendar', async (ctx) => {
  let from = addDays(ymd(), -2);
  const head = headerActions();
  head.innerHTML = `<button type="button" class="ns-btn-ghost" id="prev" aria-label="Previous week">‹ Prev</button>
    <button type="button" class="ns-btn-ghost" id="today">Today</button>
    <button type="button" class="ns-btn-ghost" id="next" aria-label="Next week">Next ›</button>
    ${ctx.can('owner', 'manager', 'front_desk') ? '<a href="check-in.html" class="ns-btn">+ New booking</a>' : ''}`;
  $('#prev').onclick = () => { from = addDays(from, -7); draw(); };
  $('#next').onclick = () => { from = addDays(from, 7); draw(); };
  $('#today').onclick = () => { from = addDays(ymd(), -2); draw(); };

  async function draw() {
    const d = await rpc('calendar_range', { p_property: ctx.property_id, p_from: from, p_days: DAYS });
    const to = addDays(from, DAYS - 1);
    setSubtitle(`${fmtDay(from + 'T12:00:00+05:30')} – ${fmtDay(to + 'T12:00:00+05:30')} · ${ctx.property_name}`);
    const today = ymd();
    const days = Array.from({ length: DAYS }, (_, i) => addDays(from, i));
    // A stay fills the nights it covers: check-in day up to the day before check-out.
    const span = (startIso, endIso) => {
      const sDay = ymd(startIso);
      let eDay = addDays(ymd(endIso), -1);
      if (eDay < sDay) eDay = sDay;
      const cutL = sDay < days[0]; const cutR = eDay > days[DAYS - 1];
      const s = cutL ? 0 : days.indexOf(sDay); const e = cutR ? DAYS - 1 : days.indexOf(eDay);
      return { s: s + 1, e: e + 2, cutL, cutR };
    };

    let room = null;
    const rows = d.beds.map((bed) => {
      let html = '';
      if (bed.room !== room) { room = bed.room; html += `<div style="font-size:11px;font-weight:800;color:#6B7280;text-transform:uppercase;letter-spacing:.04em;padding:14px 0 4px">${esc(room)}</div>`; }
      const bars = [
        ...d.blocks.filter((k) => k.bed_id === bed.id).map((k) => { const p = span(k.starts_at, k.ends_at);
          return `<div class="bar" style="grid-row:1;grid-column:${p.s}/${p.e};background:repeating-linear-gradient(135deg,#DAD2B6,#DAD2B6 8px,#EDE7D3 8px,#EDE7D3 16px);color:#7A7154" title="${esc(k.reason)}">${esc(k.reason)}</div>`; }),
        ...d.bookings.filter((b) => b.bed_id === bed.id).map((b) => { const p = span(b.check_in_at, b.check_out_at);
          const bg = p.cutL || b.status === 'checked_out' ? '#9CA9C4' : (b.status === 'pending' || b.balance_paise > 0) ? '#E2A03F' : '#1C9A6C';
          const r = `${p.cutL ? 0 : 8}px ${p.cutR ? 0 : 8}px ${p.cutR ? 0 : 8}px ${p.cutL ? 0 : 8}px`;
          return `<a class="bar" href="booking-detail.html?id=${esc(b.id)}" style="grid-row:1;grid-column:${p.s}/${p.e};background:${bg};border-radius:${r};color:#fff" title="${esc(b.guest)}">${esc(b.guest)}</a>`; }),
      ].join('');
      return html + `<div style="display:grid;grid-template-columns:140px 1fr;align-items:center;border-top:1px solid #F3EFE1">
          <div style="font-size:12.5px;font-weight:700">${esc(bed.label)}</div>
          <div class="row" style="position:relative">${days.map((x, i) => `<div style="grid-row:1;grid-column:${i + 1};height:100%;${x === today ? 'background:#F3FAF6;' : ''}"></div>`).join('')}${bars}</div></div>`;
    }).join('');

    content(`
      <div class="ns-card" style="padding:18px 20px;overflow-x:auto">
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
        </div>
      </div>`);
  }
  await draw();
});
