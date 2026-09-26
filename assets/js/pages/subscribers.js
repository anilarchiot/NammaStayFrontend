// NammaStay admin: every subscribing property, UPI payments to confirm, prices & settings.
import { page, rpc, content, setSubtitle, headerActions, headerSearch, esc, rupees, toPaise, fmtDate, fmtDayTime, pill, modal,
  confirmDialog, toast, field, showFatal, $, $$ } from '../core.js';

const STATE = { trial: ['Trial', 'blue'], active: ['Paying', 'green'], grace: ['Payment due', 'amber'], expired: ['Ended', 'red'], complimentary: ['Complimentary', 'grey'] };

page(null, async (ctx) => {
  if (!ctx.isAdmin) { showFatal('This screen is only for NammaStay admins.'); return; }
  let q = '';
  headerActions().innerHTML = '<div class="ns-search"><span>Search</span></div>';
  headerSearch('Search property, city, owner…', (v) => { q = v; draw(); });

  async function draw() {
    const d = await rpc('admin_subscriptions', { p_q: q || null });
    const plan = Object.fromEntries(d.plans.map((p) => [p.id, p]));
    const count = (s) => d.properties.filter((p) => p.state === s).length;
    const mrr = d.properties.filter((p) => p.state === 'active' && plan[p.plan_id])
      .reduce((sum, p) => sum + plan[p.plan_id].price_paise / plan[p.plan_id].period_months, 0);
    setSubtitle(`${d.properties.length} properties · ${d.pending.length} payment${d.pending.length === 1 ? '' : 's'} to confirm`);
    const stat = (l, v, sub = '', dark = false) => `<div class="ns-stat${dark ? ' is-dark' : ''}"><div class="ns-stat-label">${l}</div><div class="ns-stat-value">${v}</div>${sub ? `<div class="ns-stat-sub">${sub}</div>` : ''}</div>`;
    const s = d.settings;

    content(`
      <div style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:16px">
        ${stat('Paying', count('active'), `≈ ${rupees(Math.round(mrr / 100) * 100)} / month`)}${stat('In free trial', count('trial'))}
        ${stat('Payment due', count('grace'), 'within grace days')}${stat('Ended', count('expired'))}
        ${stat('To confirm', d.pending.length, 'UPI payments', true)}
      </div>

      <div class="ns-card" style="padding:0;overflow:hidden">
        <div style="padding:18px 20px"><div class="ns-h3">Payments to confirm</div>
          <div class="ns-muted">Check each UTR arrived in your bank / UPI app <b>before</b> approving. Approving extends their access by the plan period.</div></div>
        <div style="overflow-x:auto"><table class="ns-table" style="min-width:760px"><thead><tr><th>Submitted</th><th>Property</th><th>Plan</th><th>Amount</th><th>UTR</th><th></th></tr></thead><tbody>
        ${d.pending.map((p) => `<tr><td>${fmtDayTime(p.submitted_at)}</td><td style="font-weight:700">${esc(p.property)}<div class="ns-muted" style="font-weight:500">${esc(p.owner_email || '')}</div></td>
          <td>${esc(plan[p.plan_id]?.name || p.plan_id)}</td><td style="font-weight:700">${rupees(p.amount_paise)}</td><td style="font-family:monospace;font-size:13px">${esc(p.utr)}</td>
          <td style="white-space:nowrap"><button type="button" class="ns-btn" style="height:32px;font-size:12px" data-approve="${esc(p.id)}">Approve</button>
            <button type="button" class="ns-btn-danger" style="height:32px;font-size:12px" data-reject="${esc(p.id)}">Reject</button></td></tr>`).join('')
          || '<tr><td colspan="6" class="ns-empty">Nothing to confirm right now.</td></tr>'}
        </tbody></table></div>
      </div>

      <div class="ns-card" style="padding:0;overflow:hidden">
        <div class="ns-h3" style="padding:18px 20px">Properties</div>
        <div style="overflow-x:auto"><table class="ns-table" style="min-width:900px"><thead><tr><th>Property</th><th>Owner</th><th>Beds</th><th>Status</th><th>Access until</th><th>Last booking</th><th></th></tr></thead><tbody>
        ${d.properties.map((p) => { const [l, c] = STATE[p.state] || [p.state, 'grey'];
          const until = p.is_complimentary ? '—' : p.state === 'trial' ? `Trial · ${fmtDate(p.trial_ends_at)}` : p.paid_until ? fmtDate(p.paid_until) : fmtDate(p.trial_ends_at);
          return `<tr><td style="font-weight:700">${esc(p.name)}<div class="ns-muted" style="font-weight:500">${esc(p.city || '')} · joined ${fmtDate(p.created_at)}</div></td>
            <td>${esc(p.owner_name || '')}<div class="ns-muted">${esc(p.owner_email || '')}</div></td><td>${p.beds}</td>
            <td>${pill(l, c)}${p.plan_id && plan[p.plan_id] ? `<div class="ns-muted">${esc(plan[p.plan_id].name)}</div>` : ''}</td>
            <td>${until}</td><td class="ns-muted">${p.last_booking_at ? fmtDate(p.last_booking_at) : 'None yet'}</td>
            <td><button type="button" class="ns-btn-ghost" style="height:32px;font-size:12px" data-manage="${esc(p.property_id)}">Manage</button></td></tr>`; }).join('')
          || '<tr><td colspan="7" class="ns-empty">No properties found.</td></tr>'}
        </tbody></table></div>
      </div>

      <div class="ns-card" style="display:flex;flex-direction:column;gap:14px" id="bset">
        <div class="ns-h3">Billing settings</div>
        <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px">
          ${field('Your UPI ID (owners pay here)', `<input class="ns-input" name="upi_id" value="${esc(s.upi_id || '')}" placeholder="yourname@okaxis">`)}
          ${field('Payee name shown', `<input class="ns-input" name="payee_name" value="${esc(s.payee_name || '')}">`)}
          ${field('Support WhatsApp', `<input class="ns-input" name="support_whatsapp" value="${esc(s.support_whatsapp || '')}" placeholder="919840012345">`)}
          ${field('Support email', `<input class="ns-input" name="support_email" type="email" value="${esc(s.support_email || '')}">`)}
          ${field('Free trial (days)', `<input class="ns-input" name="trial_days" type="number" min="0" max="90" value="${s.trial_days}">`, 'Applies to new sign-ups.')}
          ${field('Grace after expiry (days)', `<input class="ns-input" name="grace_days" type="number" min="0" max="30" value="${s.grace_days}">`, 'Bookings keep working this long after access ends.')}
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px">
          ${d.plans.map((p) => `<div style="border:1px solid #F0EBDB;border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:10px" data-plan="${esc(p.id)}">
            <b>${esc(p.name)} · ${p.period_months} month${p.period_months > 1 ? 's' : ''}</b>
            ${field('Price (₹)', `<input class="ns-input" name="price" inputmode="decimal" value="${p.price_paise / 100}">`)}
            ${field('Label', `<input class="ns-input" name="description" value="${esc(p.description || '')}">`)}
            <label style="font-size:13px;display:flex;gap:8px;align-items:center"><input type="checkbox" name="is_active" ${p.is_active ? 'checked' : ''}> Offered to customers</label></div>`).join('')}
        </div>
        <button type="button" class="ns-btn" id="save-billing" style="align-self:flex-start">Save billing settings</button>
      </div>`);

    $$('[data-approve]').forEach((b) => b.onclick = async () => {
      const p = d.pending.find((x) => x.id === b.dataset.approve);
      if (!await confirmDialog('Approve payment', `Confirm ${rupees(p.amount_paise)} (UTR ${p.utr}) from ${p.property} has reached your account?`, { confirmLabel: 'Approve' })) return;
      try { const r = await rpc('admin_review_subscription_payment', { p_id: p.id, p_approve: true, p_note: null }); toast(`Approved — paid until ${fmtDate(r.paid_until)}.`); draw(); }
      catch (e) { toast(e.message, { error: true }); }
    });
    $$('[data-reject]').forEach((b) => b.onclick = () => modal({
      title: 'Reject payment',
      body: field('Reason (the owner sees this)', '<input class="ns-input" name="note" value="Payment not found in our account — please check the UTR">'),
      actions: [{ label: 'Cancel' }, { label: 'Reject', kind: 'danger', onClick: async (el) => {
        await rpc('admin_review_subscription_payment', { p_id: b.dataset.reject, p_approve: false, p_note: el.querySelector('[name=note]').value });
        toast('Rejected.'); draw(); } }],
    }));
    $$('[data-manage]').forEach((b) => b.onclick = () => {
      const p = d.properties.find((x) => x.property_id === b.dataset.manage);
      modal({
        title: `Manage · ${p.name}`,
        body: `${field('Extend access by (days)', '<input class="ns-input" name="days" type="number" value="30">', 'Use a negative number to shorten. Counts from today or their current end date, whichever is later.')}
          <label style="font-size:13.5px;display:flex;gap:8px;align-items:center"><input type="checkbox" name="comp" ${p.is_complimentary ? 'checked' : ''}> Complimentary — free forever (your own property, partners)</label>`,
        actions: [{ label: 'Cancel' }, { label: 'Save', kind: 'primary', onClick: async (el) => {
          const days = parseInt(el.querySelector('[name=days]').value, 10);
          await rpc('admin_update_subscription', { p_property: p.property_id, p_extend_days: Number.isFinite(days) && days !== 0 ? days : null,
            p_complimentary: el.querySelector('[name=comp]').checked });
          toast('Saved.'); draw(); } }],
      });
    });
    $('#save-billing').onclick = async (e) => {
      const v = (n) => $(`#bset > div [name="${n}"]`)?.value?.trim() ?? '';
      const plans = $$('#bset [data-plan]').map((el) => ({ id: el.dataset.plan, price_paise: toPaise(el.querySelector('[name=price]').value),
        description: el.querySelector('[name=description]').value, is_active: el.querySelector('[name=is_active]').checked }));
      if (plans.some((p) => !(p.price_paise >= 0))) return toast('Check the prices.', { error: true });
      if (v('upi_id') && !/^[A-Za-z0-9._-]{2,256}@[A-Za-z]{2,64}$/.test(v('upi_id'))) return toast('That UPI ID doesn’t look right (e.g. name@okaxis).', { error: true });
      e.target.disabled = true;
      try {
        await rpc('admin_save_billing_settings', { p: { upi_id: v('upi_id'), payee_name: v('payee_name'), trial_days: v('trial_days'), grace_days: v('grace_days'),
          support_whatsapp: v('support_whatsapp'), support_email: v('support_email'), plans } });
        toast('Billing settings saved.'); draw();
      } catch (err) { toast(err.message, { error: true }); e.target.disabled = false; }
    };
  }
  await draw();
});
