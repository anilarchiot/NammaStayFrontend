// Rent payments — every receipt for a PG / co-living property (032_pg_app.sql)
import { page, rpc, content, setSubtitle, headerActions, esc, rupees, fmtDay, fmtTime, ymd, addDays, toast, $, METHOD_OPTIONS } from '../core.js';

const PERIODS = [['month', 'This month'], ['last', 'Last month'], ['30', 'Last 30 days'], ['90', 'Last 90 days'], ['year', 'This year']];
const KIND = { payment: 'Payment', deposit_adjust: 'From deposit', refund: 'Refund' };
const method = (m) => (m === 'deposit' ? 'Deposit' : (METHOD_OPTIONS.find(([v]) => v === m)?.[1] || m));

page('pgpayments', async (ctx) => {
  let period = 'month'; let q = ''; let data = null;
  const head = headerActions();
  head.innerHTML = `<select class="ns-input" id="pp-period" style="height:40px;width:auto">${PERIODS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>
    <input class="ns-input" id="pp-q" placeholder="Search name, bed, receipt…" style="height:40px;width:220px">
    ${ctx.allow('export_data') ? '<button type="button" class="ns-btn-ghost" id="pp-csv">Export CSV</button>' : ''}`;
  $('#pp-period').onchange = (e) => { period = e.target.value; load(); };
  $('#pp-q').oninput = (e) => { q = e.target.value.trim().toLowerCase(); draw(); };
  $('#pp-csv')?.addEventListener('click', csv);

  const range = () => {
    const t = ymd(); const m0 = t.slice(0, 8) + '01';
    if (period === 'month') return [m0, t];
    if (period === 'last') { const lm = new Date(m0 + 'T00:00:00Z'); lm.setUTCMonth(lm.getUTCMonth() - 1); return [lm.toISOString().slice(0, 10), addDays(m0, -1)]; }
    if (period === 'year') return [t.slice(0, 4) + '-01-01', t];
    return [addDays(t, -Number(period) + 1), t];
  };
  const rows = () => data.rows.filter((r) => !q || [r.name, r.bed, r.code, r.for, r.reference, r.phone].join(' ').toLowerCase().includes(q));

  async function load() {
    const [from, to] = range();
    data = await rpc('pg_payments', { p_property: ctx.property_id, p_from: from, p_to: to });
    data.from = from; data.to = to;
    draw();
  }

  function draw() {
    const t = data.totals; const list = rows();
    setSubtitle(`${fmtDay(data.from + 'T12:00:00+05:30')} – ${fmtDay(data.to + 'T12:00:00+05:30')} · ${data.rows.length} receipt${data.rows.length === 1 ? '' : 's'}`);
    const kpi = (l, v, s) => `<div class="ns-card pf-kpi"><div class="pf-lbl">${l}</div><div class="pf-num">${v}</div><div class="pf-sub">${s}</div></div>`;
    content(`
      <div class="pp-kpis">
        ${kpi('Rent & charges received', rupees(t.rent_paise), `UPI ${rupees(t.upi_paise)} · Cash ${rupees(t.cash_paise)}${t.other_paise ? ` · Other ${rupees(t.other_paise)}` : ''}`)}
        ${kpi('Deposits received', rupees(t.deposits_in_paise), 'held — refundable at move-out')}
        ${kpi('Taken from deposits', rupees(t.from_deposit_paise), 'dues settled at move-out')}
        ${kpi('Refunds paid', rupees(t.refunds_paise), 'deposits returned')}
      </div>
      <div class="ns-card" style="padding:0;overflow:hidden">
        <div style="overflow-x:auto"><table class="ns-table" style="min-width:760px"><thead><tr>
          <th>Receipt</th><th>Date</th><th>Tenant</th><th>For</th><th>Method</th><th style="text-align:right">Amount</th></tr></thead><tbody>
          ${list.map((r) => `<tr>
            <td><b>${esc(r.code)}</b></td>
            <td>${fmtDay(r.received_at)}<div class="ns-muted" style="font-size:11px">${fmtTime(r.received_at)}</div></td>
            <td><a href="tenants.html?id=${esc(r.tenancy_id)}" style="font-weight:700">${esc(r.name)}</a><div class="ns-muted" style="font-size:11px">${esc(r.bed)}</div></td>
            <td>${esc(r.kind === 'refund' ? (r.note || 'Refund') : r.for || r.note || KIND[r.kind])}${r.kind !== 'payment' ? ` <span class="ns-pill ${r.kind === 'refund' ? 'red' : 'grey'}">${KIND[r.kind]}</span>` : ''}${r.due_kind === 'deposit' ? ' <span class="ns-pill blue">Deposit</span>' : ''}</td>
            <td>${esc(method(r.method))}${r.reference ? `<div class="ns-muted" style="font-size:11px">${esc(r.reference)}</div>` : ''}</td>
            <td style="text-align:right;font-weight:700;${r.kind === 'refund' ? 'color:#B23A3A' : ''}">${r.kind === 'refund' ? '−' : ''}${rupees(r.amount_paise)}</td></tr>`).join('')
            || `<tr><td colspan="6" class="ns-empty">${data.rows.length ? 'Nothing matches your search.' : 'No payments in this period.'}</td></tr>`}
        </tbody></table></div></div>`);
  }

  function csv() {
    const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [['Receipt', 'Date', 'Tenant', 'Phone', 'Bed', 'For', 'Type', 'Method', 'Reference', 'Amount (₹)'].map(cell).join(',')]
      .concat(rows().map((r) => [r.code, ymd(r.received_at), r.name, r.phone, r.bed, r.for || r.note || '', KIND[r.kind], method(r.method), r.reference,
        ((r.kind === 'refund' ? -1 : 1) * r.amount_paise / 100).toFixed(2)].map(cell).join(',')));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv' }));
    a.download = `rent-payments-${data.from}-to-${data.to}.csv`; a.click();
    toast('CSV downloaded.');
  }

  await load();
});
