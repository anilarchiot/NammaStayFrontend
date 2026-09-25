import { page, rpc, content, setSubtitle, headerSearch, esc, rupees, fmtLong, fmtTime, fmtWeekday, avatar, pill, statusLabel } from '../core.js';

page('dashboard', async (ctx) => {
  const d = await rpc('dashboard_summary', { p_property: ctx.property_id });
  setSubtitle(`${fmtLong(d.today + 'T12:00:00+05:30')} · ${ctx.property_name}`);
  headerSearch('Search guests, bookings…', (v, enter) => { if (enter && v) location.href = 'bookings.html?q=' + encodeURIComponent(v); });

  const occPct = d.beds_total ? Math.round((d.beds_occupied / d.beds_total) * 100) : 0;
  const occDelta = d.beds_occupied - d.beds_occupied_yesterday;
  const revDelta = d.revenue_yesterday ? Math.round(((d.revenue_today - d.revenue_yesterday) / d.revenue_yesterday) * 100) : null;
  const max = Math.max(d.beds_total, 1);

  const stat = (label, value, sub, subColor = '#6B7280', dark = false) => `
    <div class="ns-stat${dark ? ' is-dark' : ''}"><div class="ns-stat-label">${label}</div>
      <div class="ns-stat-value">${value}</div><div class="ns-stat-sub" style="color:${subColor}">${sub}</div></div>`;

  const person = (b, right) => `
    <a class="ns-list-row" href="booking-detail.html?id=${esc(b.id)}" style="color:inherit">
      <div style="display:flex;align-items:center;gap:10px;min-width:0">${avatar(b.guest)}
        <div style="min-width:0"><div style="font-size:13px;font-weight:700">${esc(b.guest)}</div>
        <div class="ns-muted" style="font-size:11px">${esc(b.room)} · ${esc(b.bed)}</div></div></div>${right}</a>`;

  const arriving = d.arriving.length ? d.arriving.map((b) => person(b,
    b.status === 'checked_in' ? pill('Checked-in', 'green')
      : b.status === 'pending' ? pill('Pending', 'amber') : pill(fmtTime(b.check_in_at), 'green'))).join('')
    : '<div class="ns-empty">No arrivals today.</div>';
  const departing = d.departing.length ? d.departing.map((b) => person(b,
    b.overdue ? pill('Overdue', 'red') : b.status === 'checked_out' ? pill(statusLabel(b.status), 'grey')
      : pill(fmtTime(b.check_out_at), 'green'))).join('')
    : '<div class="ns-empty">No departures today.</div>';

  content(`
    <div style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:16px;">
      ${stat('Occupancy today', occPct + '%', `${d.beds_occupied} / ${d.beds_total} beds ${occDelta ? (occDelta > 0 ? '▲ ' : '▼ ') + Math.abs(occDelta) : ''}`, '#1C9A6C')}
      ${stat('Check-ins today', d.checkins_today, `${d.checkins_pending} pending arrival`)}
      ${stat('Check-outs today', d.checkouts_today, `${d.checkouts_late} late check-out${d.checkouts_late === 1 ? '' : 's'}`, d.checkouts_late ? '#B23A3A' : '#6B7280')}
      ${stat('Revenue today', rupees(d.revenue_today), revDelta === null ? 'No payments yesterday' : `${revDelta >= 0 ? '▲' : '▼'} ${Math.abs(revDelta)}% vs yesterday`, revDelta !== null && revDelta < 0 ? '#B23A3A' : '#1C9A6C')}
      ${stat('Pending dues', rupees(d.dues_paise), `${d.dues_count} unpaid booking${d.dues_count === 1 ? '' : 's'}`, '#E2A03F', true)}
    </div>
    <div style="display:grid;grid-template-columns:1.3fr 1fr;gap:20px;">
      <div class="ns-card" style="display:flex;flex-direction:column;gap:16px;padding:22px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div class="ns-h3">Occupancy — last 7 days</div><div class="ns-muted">Beds occupied / ${d.beds_total}</div></div>
        <div class="ns-bars">
          ${d.series.map((s) => `<div class="${s.day === d.today ? 'is-today' : ''}" title="${s.occupied} of ${d.beds_total} beds">
              <div class="bar-fill" style="height:${Math.round((s.occupied / max) * 100)}%"></div>
              <div style="font-size:11px;color:${s.day === d.today ? '#101A3D;font-weight:700' : '#6B7280'}">${fmtWeekday(s.day).split(' ')[0]}</div></div>`).join('')}
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;border-top:1px solid #F0EBDB;padding-top:16px">
          <div class="ns-h3">Quick actions</div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
            ${ctx.can('owner', 'manager', 'front_desk') ? '<a href="check-in.html" class="ns-btn-ghost" style="height:auto;padding:14px;justify-content:flex-start">+ New booking</a>' : ''}
            <a href="bookings.html?status=confirmed" class="ns-btn-ghost" style="height:auto;padding:14px;justify-content:flex-start">Check-in guest</a>
            <a href="payments.html?record=1" class="ns-btn-ghost" style="height:auto;padding:14px;justify-content:flex-start">Record payment</a>
          </div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="ns-card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <div class="ns-h3">Arriving today</div><a href="bookings.html" style="font-size:12px;font-weight:700">View all</a></div>${arriving}</div>
        <div class="ns-card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <div class="ns-h3">Departing today</div><a href="bookings.html?status=checked_in" style="font-size:12px;font-weight:700">View all</a></div>${departing}</div>
      </div>
    </div>`);
});
