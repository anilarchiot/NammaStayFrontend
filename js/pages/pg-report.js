// Rent reports — month by month for a PG / co-living property (032_pg_app.sql)
import { page, rpc, content, setSubtitle, headerActions, rupees, $ } from '../core.js';

const mon = (m) => new Date(m + '-01T12:00:00Z').toLocaleDateString('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' }).replace('Sept', 'Sep');

page('pgreport', async (ctx) => {
  let months = 6;
  const head = headerActions();
  head.innerHTML = `<select class="ns-input" id="pr-n" style="height:40px;width:auto">${[[6, 'Last 6 months'], [12, 'Last 12 months'], [24, 'Last 24 months']].map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>`;
  $('#pr-n').onchange = (e) => { months = Number(e.target.value); load(); };

  async function load() {
    const r = await rpc('pg_report', { p_property: ctx.property_id, p_months: months });
    const ms = r.months || [];
    const sum = (k) => ms.reduce((s, m) => s + (m[k] || 0), 0);
    const billed = sum('billed_paise'); const got = sum('collected_paise');
    const last = ms[ms.length - 1] || {};
    const occNow = r.beds_total ? Math.round(((last.occupied || 0) / r.beds_total) * 100) : 0;
    const max = Math.max(1, ...ms.map((m) => Math.max(m.billed_paise, m.collected_paise)));
    setSubtitle(`${mon(ms[0]?.month || '')} – ${mon(last.month || '')} · ${ctx.property_name}`);
    const kpi = (l, v, s) => `<div class="ns-card pf-kpi"><div class="pf-lbl">${l}</div><div class="pf-num">${v}</div><div class="pf-sub">${s}</div></div>`;
    content(`
      <div class="pp-kpis">
        ${kpi('Rent billed', rupees(billed), `rent, food & charges · ${months} months`)}
        ${kpi('Collected', rupees(got), billed ? `${Math.round((got / billed) * 100)}% of billed` : '—')}
        ${kpi('Occupancy now', `${occNow}%`, `${last.occupied || 0} of ${r.beds_total} beds`)}
        ${kpi('Move-ins / move-outs', `${sum('move_ins')} / ${sum('move_outs')}`, `${months} months`)}
      </div>
      <div class="ns-card"><div class="ns-h3">Billed vs collected</div>
        <div class="pf-chart">${ms.map((m) => `<div class="pf-col" title="${m.month}: billed ${rupees(m.billed_paise)}, collected ${rupees(m.collected_paise)}">
            <div class="pf-bars"><span class="pf-exp" style="height:${(m.billed_paise / max) * 100}%"></span><span class="pf-rev" style="height:${(m.collected_paise / max) * 100}%"></span></div>
            <div class="pf-m">${mon(m.month)}</div></div>`).join('')}</div>
        <div class="pf-legend"><span><i style="background:#E2A03F"></i> Billed</span><span><i style="background:#1C9A6C"></i> Collected</span></div></div>
      <div class="ns-card" style="padding:0;overflow:hidden"><div style="overflow-x:auto"><table class="ns-table" style="min-width:760px"><thead><tr>
        <th>Month</th><th style="text-align:right">Billed</th><th style="text-align:right">Collected</th><th style="text-align:right">Deposits in</th>
        <th style="text-align:right">Refunds</th><th style="text-align:right">Occupancy</th><th style="text-align:right">In / out</th></tr></thead><tbody>
        ${[...ms].reverse().map((m) => `<tr><td><b>${mon(m.month)}</b></td>
          <td style="text-align:right">${rupees(m.billed_paise)}</td><td style="text-align:right;font-weight:700">${rupees(m.collected_paise)}</td>
          <td style="text-align:right">${rupees(m.deposits_in_paise)}</td><td style="text-align:right">${rupees(m.refunds_paise)}</td>
          <td style="text-align:right">${r.beds_total ? Math.round((m.occupied / r.beds_total) * 100) : 0}% <span class="ns-muted">(${m.occupied})</span></td>
          <td style="text-align:right">${m.move_ins} / ${m.move_outs}</td></tr>`).join('')}
      </tbody></table></div></div>
      <div class="ns-muted" style="font-size:12px">Collected = rent, food & charges received (plus dues taken from deposits at move-out). Deposits are not counted as income. Occupancy is counted on the 15th of each month (today for this month).</div>`);
  }
  await load();
});
