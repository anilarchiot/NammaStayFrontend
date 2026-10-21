// Dashboard card: business health score + the top thing to do (037). Owner and managers. Shown at the bottom of the dashboard.
import { rpc, esc } from '../core.js';
import { ring } from './health-ring.js';

export async function mountHealthCard(ctx) {
  if (!['owner', 'manager'].includes(ctx.role)) return;
  const h = await rpc('business_health', { p_property: ctx.property_id }).catch(() => null);
  const box = document.querySelector('.ns-content');
  if (!h || !box || box.querySelector('.bh-dash')) return;
  const top = h.actions?.[0]?.text || (h.score == null ? 'Add bookings, payments and expenses to see your score.' : 'Nothing urgent — keep it up.');
  box.insertAdjacentHTML('beforeend', `<a class="ns-card bh-dash" href="health.html">${ring(h.score, 64)}
    <span class="bh-dash-txt"><b>Business health: ${esc(h.label)}</b><br><span class="ns-muted" style="font-size:12.5px">${esc(top)}</span></span>
    <span class="bh-dash-go">See details →</span></a>`);
}
