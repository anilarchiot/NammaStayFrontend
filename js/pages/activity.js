// NammaStay admin: every change made by an admin — who, what, when.
import { adminPage, rpc, content, setSubtitle, headerActions, headerSearch, esc, fmtDayTime, $ } from '../core.js';

const LABEL = {
  payment_approved: 'Approved a payment', payment_rejected: 'Rejected a payment', payment_pending: 'Re-opened a payment', subscription_changed: 'Changed a subscription',
  plan_changed: 'Changed a plan / price', settings_changed: 'Changed billing / invoice settings', insert_property: 'Added a property', update_property: 'Edited a property',
  delete_property: 'Deleted a property', insert_coupon: 'Created a coupon', update_coupon: 'Edited a coupon', delete_coupon: 'Deleted a coupon', lead_changed: 'Updated a lead',
  insert_admin: 'Added an admin', delete_admin: 'Removed an admin', payment_changed: 'Edited a payment' };
const FIELD = { paid_until: 'Paid until', trial_ends_at: 'Trial ends', is_complimentary: 'Free (complimentary)', is_suspended: 'Suspended', suspended_reason: 'Suspension reason',
  admin_note: 'Private note', price_paise: 'Price', status: 'Status', name: 'Name', is_active: 'Active', value: 'Discount', max_uses: 'Max uses', upi_id: 'UPI ID' };
const fmt = (k, v) => v === null || v === undefined ? '—' : k.endsWith('_paise') || k === 'value' ? `₹${(Number(v) / 100).toLocaleString('en-IN')}`
  : /_at$|_until$/.test(k) && typeof v === 'string' ? fmtDayTime(v) : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v).slice(0, 80);

adminPage(async () => {
  let q = '';
  headerActions().innerHTML = '<div class="ns-search"><span>Search</span></div>';
  headerSearch('Search admin, property, action…', (v) => { q = v.toLowerCase(); draw(); });
  const list = await rpc('admin_actions_list', { p_limit: 500 });
  function draw() {
    const rows = list.filter((a) => !q || [a.admin_email, a.property, LABEL[a.action] || a.action, a.details?.code, a.details?.name].some((x) => String(x || '').toLowerCase().includes(q)));
    setSubtitle(`${rows.length} change${rows.length === 1 ? '' : 's'} by NammaStay admins`);
    content(`<div class="ns-card" style="padding:0;overflow:hidden">${rows.length ? rows.map((a) => {
      const ch = a.details?.changes || {};
      const keys = Object.keys(ch).filter((k) => FIELD[k]).slice(0, 4);
      return `<div class="al-row"><div class="al-when">${fmtDayTime(a.at)}</div>
        <div class="al-main"><b>${esc(LABEL[a.action] || a.action)}</b>${a.property ? ` · <a href="admin.html?id=${esc(a.property_id)}">${esc(a.property)}</a>` : ''}${a.details?.code ? ` · ${esc(a.details.code)}` : ''}
          ${keys.length ? `<div class="al-diff">${keys.map((k) => `<span>${esc(FIELD[k])}: <s>${esc(fmt(k, ch[k][0]))}</s> → <b>${esc(fmt(k, ch[k][1]))}</b></span>`).join('')}</div>` : ''}</div>
        <div class="al-who">${esc(a.admin_email || '')}</div></div>`; }).join('')
      : '<div class="ns-empty" style="padding:22px">No admin changes yet.</div>'}</div>`, 'padding:24px 32px;');
  }
  draw();
});
