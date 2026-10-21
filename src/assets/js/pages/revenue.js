// NammaStay admin: revenue (MRR, ARR, collected per month, plan mix, churn) and coupon codes.
import { adminPage, rpc, content, setSubtitle, headerActions, esc, rupees, fmtDate, modal, field, options, toast, $, $$ } from '../core.js';

const mon = (m) => new Date(m + '-01T12:00:00Z').toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' }).replace('Sept', 'Sep');

adminPage(async () => {
  headerActions().innerHTML = '<button type="button" class="ns-btn" id="new-coupon">+ New coupon</button>';
  async function draw() {
    const [r, coupons, plans] = await Promise.all([rpc('admin_revenue'), rpc('admin_coupons'), rpc('admin_subscriptions', { p_q: null }).then((x) => x.plans || []).catch(() => [])]);
    setSubtitle(`MRR ${rupees(r.mrr_paise)} · ${r.paying} paying · ${r.trials} in trial`);
    const max = Math.max(1, ...r.months.map((m) => m.collected_paise));
    const conv = r.conversion_90.trials ? Math.round((r.conversion_90.paid * 100) / r.conversion_90.trials) : 0;
    content(`
      <div class="rv-kpis">
        <div class="ns-card rv-kpi rv-main"><div class="rv-lbl">Monthly recurring revenue</div><div class="rv-num">${rupees(r.mrr_paise)}</div><div class="rv-sub">ARR ${rupees(r.arr_paise)} · yearly plans counted ÷ 12</div></div>
        <div class="ns-card rv-kpi"><div class="rv-lbl">Collected this month</div><div class="rv-num">${rupees(r.collected_this_month)}</div><div class="rv-sub">approved payments</div></div>
        <div class="ns-card rv-kpi"><div class="rv-lbl">Paying · in trial</div><div class="rv-num">${r.paying} · ${r.trials}</div><div class="rv-sub">${r.complimentary} complimentary</div></div>
        <div class="ns-card rv-kpi"><div class="rv-lbl">Trial → paid (90 days)</div><div class="rv-num">${conv}%</div><div class="rv-sub">${r.conversion_90.paid} of ${r.conversion_90.trials} · ${r.churned_30} ended in 30 days</div></div>
      </div>
      <div class="rv-grid">
        <div class="ns-card"><div class="ns-h3">Collected per month</div>
          <div class="rv-chart">${r.months.map((m) => `<div class="rv-col" title="${m.month}: ${rupees(m.collected_paise)}"><div class="rv-bar-wrap"><span class="rv-bar" style="height:${(m.collected_paise / max) * 100}%"></span></div>
            <div class="rv-val">${m.collected_paise ? rupees(m.collected_paise).replace(/,000$/, 'k') : ''}</div><div class="rv-m">${mon(m.month)}</div></div>`).join('')}</div></div>
        <div class="ns-card"><div class="ns-h3">Plan mix (paying now)</div>
          ${r.mix.length ? r.mix.map((x) => `<div class="pl-row"><span><b>${esc(x.plan)}</b> <span class="ns-muted">· ${esc(x.kind)}</span></span><span class="ns-pill ${x.yearly ? 'green' : 'blue'}">${x.yearly ? 'Yearly' : 'Monthly'} × ${x.count}</span></div>`).join('')
            : '<div class="ns-empty" style="padding:14px">No paying properties yet.</div>'}</div>
      </div>
      <div class="ns-card" style="padding:0;overflow:hidden">
        <div style="padding:16px 20px" class="ns-h3">Coupons <span class="ns-muted" style="font-weight:600;font-size:13px">— owners type the code when they pay</span></div>
        <div style="overflow-x:auto"><table class="ns-table" style="min-width:680px"><thead><tr><th>Code</th><th>Discount</th><th>Plans</th><th>Used</th><th>Expires</th><th>Status</th><th></th></tr></thead><tbody>
        ${coupons.length ? coupons.map((c, i) => `<tr><td><b class="rv-code">${esc(c.code)}</b>${c.note ? `<div class="ns-muted" style="font-size:12px">${esc(c.note)}</div>` : ''}</td>
          <td>${c.kind === 'percent' ? `${c.value}% off` : `${rupees(c.value)} off`}</td><td>${c.plan_ids ? esc(c.plan_ids.join(', ')) : 'All plans'}</td>
          <td>${c.used}${c.max_uses ? ` / ${c.max_uses}` : ''}</td><td>${c.expires_at ? fmtDate(c.expires_at) : '—'}</td>
          <td><span class="ns-pill ${c.is_active && (!c.expires_at || new Date(c.expires_at) > new Date()) && (!c.max_uses || c.used < c.max_uses) ? 'green' : 'grey'}">${c.is_active ? ((c.max_uses && c.used >= c.max_uses) ? 'Used up' : (c.expires_at && new Date(c.expires_at) < new Date()) ? 'Expired' : 'Active') : 'Off'}</span></td>
          <td style="text-align:right"><button type="button" class="ns-btn-ghost" style="height:30px;font-size:12px" data-edit="${i}">Edit</button></td></tr>`).join('')
          : '<tr><td colspan="7" class="ns-empty">No coupons yet — e.g. LAUNCH20 for your launch offer.</td></tr>'}
        </tbody></table></div></div>`, 'padding:24px 32px;display:flex;flex-direction:column;gap:18px;');
    $$('[data-edit]').forEach((b) => b.onclick = () => couponDialog(coupons[+b.dataset.edit], plans));
    $('#new-coupon').onclick = () => couponDialog(null, plans);
  }
  function couponDialog(c, plans) {
    const planOpts = plans.filter((p) => !p.is_quote).map((p) => [p.id, `${p.name} · ${p.kind || 'hostel'} (${rupees(p.price_paise)})`]);
    modal({
      title: c ? `Coupon ${c.code}` : 'New coupon', width: 520,
      body: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        ${field('Code', `<input class="ns-input" name="code" maxlength="20" value="${esc(c?.code || '')}" ${c ? 'readonly' : ''} placeholder="LAUNCH20" style="text-transform:uppercase">`)}
        ${field('Type', `<select class="ns-input" name="kind">${options([['percent', '% off'], ['flat', '₹ off']], c?.kind || 'percent')}</select>`)}
        ${field('Discount', `<input class="ns-input" name="value" inputmode="decimal" value="${c ? (c.kind === 'flat' ? c.value / 100 : c.value) : ''}" placeholder="20 (%) or 8000 (₹)">`)}
        ${field('Max uses (optional)', `<input class="ns-input" name="max_uses" type="number" min="1" value="${c?.max_uses || ''}" placeholder="e.g. 20">`)}
        ${field('Expires on (optional)', `<input class="ns-input" name="expires" type="date" value="${c?.expires_at ? c.expires_at.slice(0, 10) : ''}">`)}
        ${field('Status', `<select class="ns-input" name="active">${options([['1', 'Active'], ['0', 'Off']], c && !c.is_active ? '0' : '1')}</select>`)}
        <div style="grid-column:1/-1">${field('Only for these plans (leave empty for all)', `<select class="ns-input" name="plans" multiple size="5" style="height:auto">${planOpts.map(([v, l]) => `<option value="${esc(v)}"${c?.plan_ids?.includes(v) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`, 'Hold Ctrl/⌘ to pick several.')}</div>
        <div style="grid-column:1/-1">${field('Note (only you see it)', `<input class="ns-input" name="note" maxlength="200" value="${esc(c?.note || '')}" placeholder="e.g. First 20 hostels — launch offer">`)}</div></div>`,
      actions: [{ label: 'Cancel' }, { label: 'Save coupon', kind: 'primary', onClick: async (el) => {
        const v = (n) => el.querySelector(`[name=${n}]`).value.trim();
        await rpc('admin_save_coupon', { p: { code: v('code').toUpperCase(), kind: v('kind'), value: v('value'), max_uses: v('max_uses'),
          expires_at: v('expires') ? new Date(v('expires') + 'T23:59:59+05:30').toISOString() : '', note: v('note'), is_active: v('active') === '1',
          plan_ids: [...el.querySelector('[name=plans]').selectedOptions].map((o) => o.value) } });
        toast('Coupon saved.'); draw();
      } }],
    });
  }
  await draw();
});
