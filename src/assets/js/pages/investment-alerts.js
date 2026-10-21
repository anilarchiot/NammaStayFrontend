// Dashboard card for the owner: legal documents expired or expiring within 30 days (036_investment.sql).
import { rpc, esc, fmtDate } from '../core.js';

export async function mountDocAlerts(ctx) {
  if (ctx.role !== 'owner') return;
  const r = await rpc('legal_docs_alerts', { p_property: ctx.property_id }).catch(() => null);
  const box = document.querySelector('.ns-content');
  if (!r || !r.count || !box || box.querySelector('.ivs-dash')) return;
  const when = (d) => d.days_left < 0 ? `expired ${fmtDate(d.expires_on)}` : d.days_left === 0 ? 'expires today'
    : `expires in ${d.days_left} day${d.days_left === 1 ? '' : 's'}`;
  const first = r.items[0];
  const more = r.count > 1 ? ` · ${r.count - 1} more` : '';
  box.insertAdjacentHTML('afterbegin', `<a class="ns-card hk-dash ivs-dash" href="investment.html#docs">
    <span><b>${esc(first.title)} ${esc(when(first))}</b><br><span class="ns-muted" style="font-size:12.5px">Renew it and update the date${esc(more)}</span></span>
    <span>Legal documents →</span></a>`);
}
