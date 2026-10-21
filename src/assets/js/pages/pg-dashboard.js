// Dashboard for PG / co-living accounts (032_pg_app.sql): tenants, beds, rent — no nightly arrivals/departures.
import { rpc, content, setSubtitle, headerActions, headerSearch, esc, rupees, fmtLong, fmtDay, avatar, pill, waNumber } from '../core.js';

const day = (d) => fmtDay(String(d).slice(0, 10) + 'T12:00:00+05:30');

export async function pgDashboard(ctx) {
  const d = await rpc('pg_dashboard', { p_property: ctx.property_id });
  setSubtitle(`${fmtLong(d.today + 'T12:00:00+05:30')} · ${ctx.property_name}`);
  const head = headerActions();
  if (head) head.innerHTML = ctx.can('owner', 'manager', 'front_desk') ? '<a href="tenants.html?movein=1" class="ns-btn">+ Move in tenant</a>' : '';
  headerSearch('Search tenant, phone or bed…', (v, enter) => { if (enter && v) location.href = 'tenants.html?q=' + encodeURIComponent(v); });

  const occ = d.beds_total ? Math.round((d.beds_occupied / d.beds_total) * 100) : 0;
  const stat = (label, value, sub, extra = '') => `<div class="ns-stat${extra}"><div class="ns-stat-label">${label}</div>
      <div class="ns-stat-value">${value}</div><div class="ns-stat-sub">${sub}</div></div>`;
  const row = (href, name, sub, right) => `<a class="ns-list-row" href="${href}" style="color:inherit">
      <div style="display:flex;align-items:center;gap:10px;min-width:0">${avatar(name)}
        <div style="min-width:0"><div style="font-size:13px;font-weight:700">${esc(name)}</div><div class="ns-muted" style="font-size:11px">${esc(sub)}</div></div></div>${right}</a>`;
  const card = (title, link, body) => `<div class="ns-card" style="padding:18px 20px;display:flex;flex-direction:column;gap:6px;min-width:0">
      <div style="display:flex;justify-content:space-between;align-items:center"><div class="ns-h3">${title}</div>${link || ''}</div>${body}</div>`;
  const empty = (t) => `<div class="ns-empty" style="padding:18px">${t}</div>`;
  const remind = (x) => {
    const n = waNumber(x.phone); if (!n) return '';
    const text = `Hi ${String(x.name).split(/\s+/)[0]}, a gentle reminder from ${d.property.name}: ${rupees(x.due_paise)} rent is due.${d.property.upi_id ? `\nPay by UPI to: ${d.property.upi_id}` : ''}\nThank you!`;
    return `<a class="ns-btn-ghost" style="height:28px;font-size:12px;padding:0 10px" target="_blank" rel="noopener" href="https://wa.me/${n}?text=${encodeURIComponent(text)}">Remind</a>`;
  };

  content(`
    <div class="pgd-stats">
      ${stat('Beds occupied', `${d.beds_occupied}<span style="font-size:15px;color:#6B7280"> / ${d.beds_total}</span>`, `${occ}% full · ${d.vacant.length} vacant`)}
      ${stat('Tenants', d.tenants, d.on_notice ? `${d.on_notice} on notice` : 'living here now')}
      ${stat('Monthly rent roll', rupees(d.rent_roll_paise), 'rent + food per month')}
      ${stat('Collected this month', rupees(d.collected_month_paise), 'rent & charges')}
      ${stat('Rent due now', rupees(d.due_now_paise), d.overdue_paise ? `<span style="color:#B23A3A">${rupees(d.overdue_paise)} late (5+ days)</span>` : 'nothing late', d.due_now_paise ? ' is-dark' : '')}
    </div>
    <div class="pgd-grid">
      ${card('Rent to collect', '<a href="tenants.html" style="font-size:12.5px;font-weight:700">All tenants →</a>', d.dues.length ? d.dues.map((x) => `<div class="ns-list-row">
          <a href="tenants.html?id=${esc(x.id)}" style="display:flex;align-items:center;gap:10px;min-width:0;color:inherit;flex:1">${avatar(x.name)}
            <div style="min-width:0"><div style="font-size:13px;font-weight:700">${esc(x.name)}</div><div class="ns-muted" style="font-size:11px">${esc(x.bed)} · since ${day(x.oldest)}</div></div></a>
          <span style="display:flex;gap:6px;align-items:center;flex-shrink:0">${remind(x)}<span class="ns-pill ${x.late ? 'red' : 'amber'}">${rupees(x.due_paise)}</span></span></div>`).join('') : empty('Everyone has paid 🎉'))}
      ${card('Rent day this week', '', d.rent_days.length ? d.rent_days.map((x) => row(`tenants.html?id=${esc(x.id)}`, x.name, x.bed, pill(`${day(x.day)} · ${rupees(x.amount_paise)}`, 'blue'))).join('') : empty('No rent days in the next 7 days.'))}
      ${card('Vacant beds', `<span class="ns-muted" style="font-size:12px">${d.vacant.length} of ${d.beds_total}</span>`, d.vacant.length ? `<div class="pgd-beds">${d.vacant.slice(0, 24).map((b) =>
        `<a href="tenants.html?movein=1&bed=${esc(b.id)}" class="pgd-bed" title="Move a tenant in">${esc(b.bed)}${b.rent_paise ? `<small>${rupees(b.rent_paise)}/mo</small>` : ''}</a>`).join('')}</div>` : empty('Full house — no vacant beds.'))}
      ${card('Leaving soon', '', d.leaving.length ? d.leaving.map((x) => row(`tenants.html?id=${esc(x.id)}`, x.name, x.bed, pill(day(x.day), 'amber'))).join('') : empty('Nobody is on notice.'))}
      ${d.arriving.length ? card('Moving in soon', '', d.arriving.map((x) => row(`tenants.html?id=${esc(x.id)}`, x.name, x.bed, pill(day(x.day), 'green'))).join('')) : ''}
      ${ctx.allow('view_payments') ? card('Recent payments', '<a href="pg-payments.html" style="font-size:12.5px;font-weight:700">All payments →</a>', d.recent.length ? d.recent.map((p) => `<div class="ns-list-row">
          <div style="min-width:0"><div style="font-size:13px;font-weight:700">${esc(p.name)}</div><div class="ns-muted" style="font-size:11px">${esc(p.code)} · ${esc(p.kind === 'refund' ? 'Refund' : p.for || 'Payment')} · ${day(String(p.at).slice(0, 10))}</div></div>
          <b style="${p.kind === 'refund' ? 'color:#B23A3A' : ''}">${p.kind === 'refund' ? '−' : ''}${rupees(p.amount_paise)}</b></div>`).join('') : empty('No payments yet.')) : ''}
    </div>`);
}
