import { page, rpc, content, setSubtitle, headerActions, esc, rupees, fmtDayTime, ymd, methodPill, pill,
  modal, toast, field, METHOD_OPTIONS, downloadCsv, debounce, param, $, $$ } from '../core.js';

page('payments', async (ctx) => {
  const t = ymd();
  const state = { method: '', from: t.slice(0, 8) + '01', to: t, cursor: null };
  const head = headerActions();
  head.innerHTML = `<button type="button" class="ns-btn-ghost" id="csv">Export CSV</button><button type="button" class="ns-btn" id="record">+ Record payment</button>`;

  content(`<div id="cards" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
      <div style="display:flex;gap:8px;flex-wrap:wrap">${[['', 'All methods'], ...METHOD_OPTIONS].map(([v, l]) =>
        `<button type="button" class="ns-chip${v === '' ? ' is-on' : ''}" data-m="${v}">${l}</button>`).join('')}</div>
      <div style="display:flex;gap:8px;align-items:center">
        <input class="ns-input" type="date" id="from" value="${state.from}" style="height:38px;width:auto" aria-label="From">
        <span class="ns-muted">to</span>
        <input class="ns-input" type="date" id="to" value="${state.to}" style="height:38px;width:auto" aria-label="To"></div>
    </div>
    <div class="ns-card" style="padding:0;overflow:hidden"><div style="overflow-x:auto">
      <table class="ns-table" style="min-width:880px"><thead><tr><th>Transaction</th><th>Guest</th><th>Booking</th><th>Method</th>
        <th>Date</th><th>Reference</th><th style="text-align:right">Amount</th><th>Status</th></tr></thead><tbody id="rows"></tbody></table></div>
      <div id="more-wrap" style="padding:14px;text-align:center;border-top:1px solid #F3EFE1" hidden><button type="button" class="ns-btn-ghost" id="more">Load more</button></div>
    </div>`);

  async function cards() {
    const s = await rpc('payment_summary', { p_property: ctx.property_id, p_from: state.from, p_to: state.to });
    const pct = (x) => (s.revenue ? Math.round((x / s.revenue) * 100) : 0);
    const delta = s.previous ? Math.round(((s.revenue - s.previous) / s.previous) * 100) : null;
    const c = (l, v, sub, color = '#6B7280', dark = false) => `<div class="ns-stat${dark ? ' is-dark' : ''}"><div class="ns-stat-label">${l}</div><div class="ns-stat-value">${v}</div><div class="ns-stat-sub" style="color:${color}">${sub}</div></div>`;
    $('#cards').innerHTML = c('Revenue — selected dates', rupees(s.revenue), delta === null ? 'No earlier data' : `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)}% vs previous period`, delta !== null && delta < 0 ? '#B23A3A' : '#1C9A6C')
      + c('Collected via UPI', rupees(s.upi), `${pct(s.upi)}% of revenue`)
      + c('Collected via Cash', rupees(s.cash), `${pct(s.cash)}% of revenue`)
      + c('Pending dues', rupees(s.dues_paise), `${s.dues_count} unpaid booking${s.dues_count === 1 ? '' : 's'}`, '#E2A03F', true);
    setSubtitle(`${ctx.property_name} · card ${rupees(s.card)} · bank ${rupees(s.bank)}`);
  }

  const args = () => ({ p_property: ctx.property_id, p_method: state.method || null, p_from: state.from, p_to: state.to,
    p_cursor_at: state.cursor?.at || null, p_cursor_id: state.cursor?.id || null, p_limit: 50 });
  const row = (x) => `<tr data-href="booking-detail.html?id=${esc(x.booking_id)}" tabindex="0" style="cursor:pointer">
      <td style="font-weight:700">${esc(x.code)}</td><td>${esc(x.guest_name)}</td><td>${esc(x.booking_code)}</td>
      <td>${methodPill(x.method)}</td><td>${fmtDayTime(x.received_at)}</td><td class="ns-muted">${esc(x.reference || '—')}</td>
      <td style="text-align:right;font-weight:700;${x.kind === 'refund' ? 'color:#B23A3A' : ''}">${x.kind === 'refund' ? '−' : ''}${rupees(x.amount_paise)}</td>
      <td>${x.kind === 'refund' ? pill('Refunded', 'red') : x.booking_balance_paise > 0 ? pill(`Partial · ${rupees(x.booking_balance_paise)} due`, 'amber') : pill('Paid', 'green')}</td></tr>`;

  async function list(first) {
    if (first) { state.cursor = null; $('#rows').innerHTML = ''; }
    const rows = await rpc('list_payments', args());
    if (first && !rows.length) $('#rows').innerHTML = '<tr><td colspan="8" class="ns-empty">No payments in this period.</td></tr>';
    $('#rows').insertAdjacentHTML('beforeend', rows.map(row).join(''));
    const last = rows[rows.length - 1];
    state.cursor = last ? { at: last.received_at, id: last.id } : null;
    $('#more-wrap').hidden = rows.length < 50;
  }
  const refresh = () => Promise.all([cards(), list(true)]).catch((e) => toast(e.message, { error: true }));

  $$('[data-m]').forEach((b) => b.onclick = () => { state.method = b.dataset.m; $$('[data-m]').forEach((x) => x.classList.toggle('is-on', x === b)); list(true); });
  ['from', 'to'].forEach((k) => $('#' + k).addEventListener('change', (e) => { if (e.target.value) { state[k] = e.target.value; refresh(); } }));
  $('#more').onclick = () => list(false);
  $('#rows').addEventListener('click', (e) => { const tr = e.target.closest('tr[data-href]'); if (tr) location.href = tr.dataset.href; });

  $('#csv').onclick = async (e) => {
    e.target.disabled = true;
    try {
      const out = [['Transaction', 'Date', 'Guest', 'Booking', 'Type', 'Method', 'Reference', 'Amount (₹)']];
      let cursor = null;
      for (let i = 0; i < 2000; i++) {           // up to 1,00,000 rows, 50 at a time
        const rows = await rpc('list_payments', { ...args(), p_cursor_at: cursor?.at || null, p_cursor_id: cursor?.id || null, p_limit: 100 });
        rows.forEach((x) => out.push([x.code, fmtDayTime(x.received_at), x.guest_name, x.booking_code, x.kind, x.method, x.reference || '',
          ((x.kind === 'refund' ? -1 : 1) * x.amount_paise / 100).toFixed(2)]));
        if (rows.length < 100) break;
        cursor = { at: rows[rows.length - 1].received_at, id: rows[rows.length - 1].id };
      }
      downloadCsv(`payments_${state.from}_to_${state.to}.csv`, out);
    } catch (err) { toast(err.message, { error: true }); } finally { e.target.disabled = false; }
  };

  // Record a payment: find the booking first
  function recordDialog() {
    const m = modal({
      title: 'Record payment',
      body: `${field('Find booking', '<input class="ns-input" name="find" placeholder="Guest name, phone or BK-number" autocomplete="off">')}
        <div id="found" style="display:flex;flex-direction:column;gap:6px"></div>`,
    });
    const box = m.el.querySelector('#found');
    m.el.querySelector('[name=find]').addEventListener('input', debounce(async (e) => {
      const v = e.target.value.trim();
      if (v.length < 2) { box.innerHTML = ''; return; }
      const rows = await rpc('list_bookings', { p_property: ctx.property_id, p_status: null, p_q: v, p_cursor_check_in: null, p_cursor_id: null, p_limit: 8 });
      const due = rows.filter((r) => r.balance_paise > 0 && !['cancelled', 'no_show'].includes(r.status));
      box.innerHTML = due.length ? due.map((r) => `<a class="ns-btn-ghost" style="justify-content:space-between;height:auto;padding:10px 12px" href="booking-detail.html?id=${esc(r.id)}">
          <span>${esc(r.code)} · ${esc(r.guest_name)}</span><span style="color:#B23A3A">${rupees(r.balance_paise)} due</span></a>`).join('')
        : '<div class="ns-muted">No bookings with a balance due match that.</div>';
    }, 350));
  }
  $('#record').onclick = recordDialog;
  if (param('record')) recordDialog();

  await refresh();
});
