import {
  page, rpc, content, setSubtitle, headerSearch, esc, rupees, fmtDayTime, fmtWeekday, ymd, addDays,
  avatar, statusPill, payPill, param, $,
} from '../core.js';

const CHIPS = [['', 'All'], ['confirmed', 'Confirmed'], ['pending', 'Pending'], ['checked_in', 'Checked-in'],
  ['checked_out', 'Checked-out'], ['cancelled', 'Cancelled'], ['no_show', 'No-show']];

page('bookings', async (ctx) => {
  const state = { status: param('status') || '', q: param('q') || '', cursor: null, loading: false };
  headerSearch('Search name, phone or BK-number…', (v) => { state.q = v; reload(); }, state.q);

  const today = ymd();
  const [series, counts] = await Promise.all([
    rpc('occupancy_series', { p_property: ctx.property_id, p_from: today, p_to: addDays(today, 6) }),
    rpc('booking_status_counts', { p_property: ctx.property_id }),
  ]);
  setSubtitle(`${counts.all || 0} recent & upcoming bookings · ${ctx.property_name}`);

  const avail = series.map((s) => {
    const r = s.total ? s.occupied / s.total : 0;
    const [bg, fg] = r >= 0.95 ? ['#FCE9E9', '#B23A3A'] : r >= 0.85 ? ['#FCF0DC', '#966016'] : ['#E9F5EE', '#157A56'];
    return { head: fmtWeekday(s.day), cell: `<div style="text-align:center;font-size:12px;font-weight:800;color:${fg};background:${bg};border-radius:6px;padding:4px 0" title="${s.total - s.occupied} beds free">${s.occupied}/${s.total}</div>` };
  });

  content(`
    <div class="ns-card" style="border-radius:14px;padding:16px 20px;display:flex;align-items:center;gap:0">
      <div style="width:150px;font-size:12px;font-weight:700;color:#6B7280">Bed availability</div>
      <div style="flex:1;display:grid;grid-template-columns:repeat(7,1fr);gap:8px">
        ${avail.map((a) => `<div style="text-align:center;font-size:11px;color:#6B7280;font-weight:600">${a.head}</div>`).join('')}
        ${avail.map((a) => a.cell).join('')}
      </div>
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
      <div style="display:flex;gap:8px;flex-wrap:wrap" role="tablist" aria-label="Filter by status">
        ${CHIPS.map(([v, l]) => `<button type="button" class="ns-chip${v === state.status ? ' is-on' : ''}" data-status="${v}" role="tab" aria-selected="${v === state.status}">
            ${l} (${v ? counts[v] || 0 : counts.all || 0})</button>`).join('')}
      </div>
      <div class="ns-muted" style="font-weight:600">Newest check-in first</div>
    </div>
    <div class="ns-card" style="padding:0;overflow:hidden">
      <div style="overflow-x:auto">
        <table class="ns-table" style="min-width:820px">
          <thead><tr><th>Guest</th><th>Booking</th><th>Room / Bed</th><th>Check-in</th><th>Check-out</th>
            <th>Amount</th><th>Payment</th><th>Status</th></tr></thead>
          <tbody id="rows"></tbody>
        </table>
      </div>
      <div style="padding:14px;text-align:center;border-top:1px solid #F3EFE1" id="more-wrap" hidden>
        <button type="button" class="ns-btn-ghost" id="more">Load more</button></div>
    </div>`);

  document.querySelectorAll('[data-status]').forEach((b) => b.addEventListener('click', () => {
    state.status = b.dataset.status;
    document.querySelectorAll('[data-status]').forEach((x) => {
      x.classList.toggle('is-on', x === b); x.setAttribute('aria-selected', x === b);
    });
    reload();
  }));
  $('#more').addEventListener('click', () => load(false));

  const tbody = $('#rows');
  tbody.addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-href]'); if (tr) location.href = tr.dataset.href;
  });
  tbody.addEventListener('keydown', (e) => {
    const tr = e.target.closest('tr[data-href]'); if (tr && e.key === 'Enter') location.href = tr.dataset.href;
  });

  function reload() { state.cursor = null; tbody.innerHTML = ''; load(true); }

  async function load(first) {
    if (state.loading) return;
    state.loading = true;
    $('#more').disabled = true;
    try {
      const rows = await rpc('list_bookings', {
        p_property: ctx.property_id, p_status: state.status || null, p_q: state.q || null,
        p_cursor_check_in: state.cursor?.at || null, p_cursor_id: state.cursor?.id || null, p_limit: 30,
      });
      if (first && !rows.length) {
        tbody.innerHTML = `<tr><td colspan="8" class="ns-empty">${state.q ? 'No bookings match your search.' : 'No bookings here yet.'}</td></tr>`;
      }
      tbody.insertAdjacentHTML('beforeend', rows.map(row).join(''));
      const last = rows[rows.length - 1];
      state.cursor = last ? { at: last.check_in_at, id: last.id } : null;
      $('#more-wrap').hidden = rows.length < 30;
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="8" class="ns-empty">${esc(e.message)}</td></tr>`;
    } finally {
      state.loading = false; $('#more').disabled = false;
    }
  }

  function row(b) {
    return `<tr data-href="booking-detail.html?id=${esc(b.id)}" tabindex="0">
      <td><div style="display:flex;align-items:center;gap:10px">${avatar(b.guest_name)}<div>
        <div style="font-size:13px;font-weight:700">${esc(b.guest_name)}</div>
        <div class="ns-muted" style="font-size:11px">${esc(b.guest_phone || '')}</div></div></div></td>
      <td style="font-weight:600">${esc(b.code)}</td>
      <td>${esc(b.room_name)} · ${esc(b.bed_label)}</td>
      <td>${fmtDayTime(b.check_in_at)}</td>
      <td>${fmtDayTime(b.check_out_at)}</td>
      <td style="font-weight:700">${rupees(b.total_paise)}</td>
      <td>${['cancelled', 'no_show'].includes(b.status) && !b.paid_paise ? '—' : payPill(b.total_paise, b.paid_paise)}</td>
      <td>${statusPill(b.status)}</td></tr>`;
  }

  await load(true);
});
