import { page, rpc, content, setSubtitle, headerActions, esc, rupees, fmtDay, ymd, addDays, downloadCsv, options, $ } from '../core.js';

const SOURCE = { walk_in: 'Walk-in', direct: 'Direct', ota: 'Hostelworld / OTA', referral: 'Referral' };

page('reports', async (ctx) => {
  const t = ymd();
  const RANGES = { '30': ['Last 30 days', addDays(t, -29)], month: ['This month', t.slice(0, 8) + '01'],
    '90': ['Last 90 days', addDays(t, -89)], '365': ['Last 12 months', addDays(t, -364)] };
  const head = headerActions();
  head.innerHTML = `<select class="ns-input" id="range" style="height:40px;width:auto">${options(Object.entries(RANGES).map(([k, v]) => [k, v[0]]), 'month')}</select>
    <button type="button" class="ns-btn-ghost" id="csv">Export report</button>`;
  let last = null;

  async function draw() {
    const from = RANGES[$('#range').value][1];
    const r = last = await rpc('report_summary', { p_property: ctx.property_id, p_from: from, p_to: t });
    r.from = from;
    setSubtitle(`${fmtDay(from + 'T12:00:00+05:30')} – ${fmtDay(t + 'T12:00:00+05:30')} · ${ctx.property_name}`);
    const maxW = Math.max(1, ...r.weekly.map((w) => w.digital + w.cash));
    const srcTotal = Object.values(r.sources).reduce((a, b) => a + b, 0) || 1;
    const natTotal = r.nationalities.reduce((a, b) => a + b.n, 0) || 1;
    const kpi = (l, v, s = '') => `<div class="ns-stat"><div class="ns-stat-label">${l}</div><div class="ns-stat-value">${v}</div>${s ? `<div class="ns-stat-sub">${s}</div>` : ''}</div>`;
    content(`
      <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px">
        ${kpi('Revenue', rupees(r.revenue))}${kpi('Avg. occupancy', Math.round(r.occupancy * 100) + '%')}
        ${kpi('Avg. length of stay', r.alos + ' nights')}${kpi('RevPAB', rupees(Math.round(r.revpab / 100) * 100), 'Revenue per available bed per night')}</div>
      <div style="display:grid;grid-template-columns:1.6fr 1fr;gap:20px">
        <div class="ns-card" style="display:flex;flex-direction:column;gap:18px">
          <div style="display:flex;justify-content:space-between;align-items:center"><div class="ns-h3">Revenue by week</div>
            <div class="ns-muted"><span style="color:#1C9A6C">■</span> UPI + card &nbsp; <span style="color:#E7DFC7">■</span> Cash</div></div>
          <div class="ns-bars" style="height:200px">${r.weekly.map((w) => `<div title="${rupees(w.digital + w.cash)}">
              <div style="width:100%;display:flex;flex-direction:column;justify-content:flex-end;height:100%">
                <div style="background:#EDE7D3;border-radius:6px 6px 0 0;height:${(w.cash / maxW) * 100}%"></div>
                <div style="background:#1C9A6C;height:${(w.digital / maxW) * 100}%"></div></div>
              <div class="ns-muted" style="font-size:10.5px">${fmtDay(w.start + 'T12:00:00+05:30')}</div></div>`).join('')}</div>
          <table class="ns-table"><thead><tr><th>Room type</th><th>Beds</th><th>Occupancy</th><th style="text-align:right">Revenue</th></tr></thead>
            <tbody>${r.rooms.map((x) => `<tr><td style="font-weight:700">${esc(x.name)}</td><td>${x.beds}</td>
              <td style="font-weight:700;color:${x.occupancy >= 0.8 ? '#157A56' : '#966016'}">${Math.round(x.occupancy * 100)}%</td>
              <td style="text-align:right;font-weight:700">${rupees(x.revenue)}</td></tr>`).join('')}</tbody></table>
        </div>
        <div style="display:flex;flex-direction:column;gap:16px">
          <div class="ns-card"><div class="ns-h3" style="margin-bottom:12px">Guest source</div>
            ${Object.entries(r.sources).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<div style="margin-bottom:10px">
              <div style="display:flex;justify-content:space-between;font-size:12.5px"><span>${esc(SOURCE[k] || k)}</span><b>${Math.round((n / srcTotal) * 100)}%</b></div>
              <div class="ns-meter" style="background:#F3EFE1"><span style="width:${(n / srcTotal) * 100}%"></span></div></div>`).join('') || '<div class="ns-muted">No bookings yet.</div>'}</div>
          <div class="ns-card-dark"><div class="ns-h3" style="color:#FBF3DE;margin-bottom:12px">Guest nationality mix</div>
            ${r.nationalities.map((x) => `<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:12.5px;color:#AEB6C9">
              <span>${esc(x.name)}</span><span>${Math.round((x.n / natTotal) * 100)}%</span></div>
              <div class="ns-meter"><span style="width:${(x.n / natTotal) * 100}%"></span></div></div>`).join('') || '<div style="color:#AEB6C9;font-size:12px">No data yet.</div>'}</div>
        </div></div>`);
  }
  $('#range').onchange = draw;
  $('#csv').onclick = () => {
    if (!last) return;
    const rows = [['NammaStay report', ctx.property_name], ['From', last.from], ['To', t], [],
      ['Revenue (₹)', last.revenue / 100], ['Avg occupancy %', Math.round(last.occupancy * 100)], ['Avg length of stay', last.alos], ['RevPAB (₹)', last.revpab / 100], [],
      ['Week starting', 'UPI+card (₹)', 'Cash (₹)'], ...last.weekly.map((w) => [w.start, w.digital / 100, w.cash / 100]), [],
      ['Room type', 'Beds', 'Occupancy %', 'Revenue (₹)'], ...last.rooms.map((x) => [x.name, x.beds, Math.round(x.occupancy * 100), x.revenue / 100]), [],
      ['Source', 'Bookings'], ...Object.entries(last.sources).map(([k, n]) => [SOURCE[k] || k, n]), [],
      ['Nationality', 'Bookings'], ...last.nationalities.map((x) => [x.name, x.n])];
    downloadCsv(`report_${last.from}_to_${t}.csv`, rows);
  };
  await draw();
});
