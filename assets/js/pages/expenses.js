// Expenses & profit — money received minus money spent, by period, month and category.
import { page, rpc, q, sb, content, setSubtitle, headerActions, esc, rupees, toPaise, fmtDate, ymd, addDays, modal, field, options,
  toast, confirmDialog, downloadCsv, DEMO, $, $$ } from '../core.js';

export const EXP_CATS = [['rent', 'Rent'], ['salaries', 'Salaries'], ['electricity', 'Electricity'], ['water', 'Water'], ['internet', 'Internet & phone'],
  ['supplies', 'Supplies & toiletries'], ['laundry', 'Laundry & linen'], ['repairs', 'Repairs & maintenance'], ['ota_commission', 'OTA commission'],
  ['marketing', 'Marketing'], ['food', 'Food & kitchen'], ['taxes', 'Taxes & fees'], ['other', 'Other']];
const CAT = Object.fromEntries(EXP_CATS);
const CAT_COLOR = { rent: '#0E1B3D', salaries: '#2D5FA6', electricity: '#E2A03F', water: '#38A3C9', internet: '#7C5CC4', supplies: '#1C9A6C', laundry: '#4FB59A',
  repairs: '#B7791F', ota_commission: '#FF5A5F', marketing: '#C2569B', food: '#D9822B', taxes: '#6B7280', other: '#9CA3AF' };
const METHODS = [['cash', 'Cash'], ['upi', 'UPI'], ['card', 'Card'], ['bank', 'Bank transfer']];

page('expenses', async (ctx) => {
  const today = ymd();
  const PERIODS = [['this_month', 'This month'], ['last_month', 'Last month'], ['last_90', 'Last 90 days'], ['this_year', 'This financial year']];
  const range = (k) => {
    const [y, m] = today.split('-').map(Number);
    if (k === 'last_month') { const a = new Date(Date.UTC(y, m - 2, 1)); const z = new Date(Date.UTC(y, m - 1, 0)); return [a.toISOString().slice(0, 10), z.toISOString().slice(0, 10)]; }
    if (k === 'last_90') return [addDays(today, -89), today];
    if (k === 'this_year') { const fy = m >= 4 ? y : y - 1; return [`${fy}-04-01`, today]; }
    return [`${today.slice(0, 7)}-01`, today];
  };
  let period = 'this_month';
  headerActions().innerHTML = `<select class="ns-input" id="period" style="height:40px;width:auto">${options(PERIODS, period)}</select>
    <button type="button" class="ns-btn-ghost" id="csv">Export CSV</button><button type="button" class="ns-btn" id="add">+ Add expense</button>`;
  if (!ctx.allow('export_data')) $('#csv').remove();

  async function draw() {
    const [from, to] = range(period);
    const [sum, list] = await Promise.all([
      rpc('profit_summary', { p_property: ctx.property_id, p_from: from, p_to: to }),
      q(sb.from('expenses').select('*').eq('property_id', ctx.property_id).gte('spent_on', from).lte('spent_on', to).order('spent_on', { ascending: false }).order('created_at', { ascending: false })),
    ]);
    setSubtitle(`${fmtDate(from + 'T12:00:00+05:30')} – ${fmtDate(to + 'T12:00:00+05:30')} · ${list.length} expense${list.length === 1 ? '' : 's'}`);
    const max = Math.max(1, ...sum.months.map((m) => Math.max(m.revenue_paise, m.expenses_paise)));
    const catMax = Math.max(1, ...sum.by_category.map((c) => c.total_paise));
    const profitUp = sum.profit_paise >= 0;
    content(`
      <div class="pf-kpis">
        <div class="ns-card pf-kpi"><div class="pf-lbl">Money received</div><div class="pf-num">${rupees(sum.revenue_paise)}</div><div class="pf-sub">payments − refunds</div></div>
        <div class="ns-card pf-kpi"><div class="pf-lbl">Expenses</div><div class="pf-num">${rupees(sum.expenses_paise)}</div><div class="pf-sub">${list.length} entr${list.length === 1 ? 'y' : 'ies'}</div></div>
        <div class="ns-card pf-kpi pf-profit ${profitUp ? 'is-up' : 'is-down'}"><div class="pf-lbl">${profitUp ? 'Profit' : 'Loss'}</div><div class="pf-num">${rupees(Math.abs(sum.profit_paise))}</div>
          <div class="pf-sub">${sum.margin != null ? `${sum.margin}% margin` : 'no money received yet'}</div></div>
      </div>
      <div class="pf-grid">
        <div class="ns-card"><div class="ns-h3">Last 6 months</div>
          <div class="pf-chart">${sum.months.map((m) => { const p = m.revenue_paise - m.expenses_paise;
            return `<div class="pf-col" title="${m.month}: received ${rupees(m.revenue_paise)}, spent ${rupees(m.expenses_paise)}, ${p >= 0 ? 'profit' : 'loss'} ${rupees(Math.abs(p))}">
              <div class="pf-bars"><span class="pf-rev" style="height:${(m.revenue_paise / max) * 100}%"></span><span class="pf-exp" style="height:${(m.expenses_paise / max) * 100}%"></span></div>
              <div class="pf-p ${p >= 0 ? 'up' : 'down'}">${p >= 0 ? '+' : '−'}${rupees(Math.abs(p)).replace('₹', '₹')}</div>
              <div class="pf-m">${new Date(m.month + '-01T12:00:00Z').toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' }).replace('Sept', 'Sep')}</div></div>`; }).join('')}</div>
          <div class="pf-legend"><span><i style="background:#1C9A6C"></i> Money received</span><span><i style="background:#E2A03F"></i> Expenses</span></div></div>
        <div class="ns-card"><div class="ns-h3">Where the money went</div>
          ${sum.by_category.length ? sum.by_category.map((c) => `<div class="pf-cat"><span class="pf-cat-n">${esc(CAT[c.category] || c.category)}</span>
              <span class="pf-cat-bar"><i style="width:${(c.total_paise / catMax) * 100}%;background:${CAT_COLOR[c.category] || '#9CA3AF'}"></i></span>
              <b>${rupees(c.total_paise)}</b></div>`).join('') : '<div class="ns-empty" style="padding:18px">No expenses in this period.</div>'}</div>
      </div>
      <div class="ns-card" style="padding:0;overflow:hidden">
        <div style="padding:16px 20px" class="ns-h3">Expenses</div>
        <div style="overflow-x:auto"><table class="ns-table" style="min-width:640px"><thead><tr><th>Date</th><th>Category</th><th>Paid to / note</th><th>Method</th><th style="text-align:right">Amount</th><th class="ns-sticky-end"></th></tr></thead><tbody>
          ${list.map((x) => `<tr><td>${fmtDate(x.spent_on + 'T12:00:00+05:30')}</td>
            <td><span class="pf-dot" style="background:${CAT_COLOR[x.category] || '#9CA3AF'}"></span>${esc(CAT[x.category] || x.category)}</td>
            <td>${esc(x.vendor || '')}${x.vendor && x.note ? ' · ' : ''}<span class="ns-muted">${esc(x.note || '')}</span></td>
            <td>${esc((METHODS.find((m) => m[0] === x.method) || [0, x.method])[1])}</td><td style="text-align:right;font-weight:700">${rupees(x.amount_paise)}</td>
            <td class="ns-sticky-end" style="white-space:nowrap;text-align:right"><button type="button" class="ns-icon-edit" data-edit="${esc(x.id)}" aria-label="Edit" title="Edit">✎</button>
              <button type="button" class="ns-icon-del" data-del="${esc(x.id)}" aria-label="Delete" title="Delete">✕</button></td></tr>`).join('')
            || '<tr><td colspan="6" class="ns-empty">No expenses yet — tap + Add expense.</td></tr>'}
        </tbody></table></div></div>`, 'padding:24px 32px;display:flex;flex-direction:column;gap:18px;');
    $$('[data-edit]').forEach((b) => b.onclick = () => edit(list.find((x) => x.id === b.dataset.edit)));
    $$('[data-del]').forEach((b) => b.onclick = async () => {
      const x = list.find((y) => y.id === b.dataset.del);
      if (!await confirmDialog('Delete expense', `${CAT[x.category] || x.category} · ${rupees(x.amount_paise)} on ${fmtDate(x.spent_on + 'T12:00:00+05:30')}`, { confirmLabel: 'Delete', danger: true })) return;
      await rpc('delete_expense', { p_id: x.id }); toast('Expense deleted.'); draw();
    });
    $('#csv') && ($('#csv').onclick = () => {
      downloadCsv(`expenses_${from}_${to}.csv`, [['Date', 'Category', 'Paid to', 'Note', 'Method', 'Amount (₹)'],
        ...list.map((x) => [x.spent_on, CAT[x.category] || x.category, x.vendor, x.note, x.method, (x.amount_paise / 100).toFixed(2)]),
        [], ['Money received', '', '', '', '', (sum.revenue_paise / 100).toFixed(2)], ['Expenses', '', '', '', '', (sum.expenses_paise / 100).toFixed(2)],
        [sum.profit_paise >= 0 ? 'Profit' : 'Loss', '', '', '', '', (Math.abs(sum.profit_paise) / 100).toFixed(2)]]);
    });
  }

  function edit(x = null) {
    modal({
      title: x ? 'Edit expense' : 'Add expense', width: 520,
      body: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          ${field('Amount (₹) *', `<input class="ns-input" name="amount" inputmode="decimal" value="${x ? x.amount_paise / 100 : ''}" placeholder="e.g. 4500">`)}
          ${field('Date', `<input class="ns-input" type="date" name="spent_on" value="${x?.spent_on || today}" max="${addDays(today, 31)}">`)}
          ${field('Category', `<select class="ns-input" name="category">${options(EXP_CATS, x?.category || 'supplies')}</select>`)}
          ${field('Paid by', `<select class="ns-input" name="method">${options(METHODS, x?.method || 'cash')}</select>`)}
          <div style="grid-column:1/-1">${field('Paid to (optional)', `<input class="ns-input" name="vendor" maxlength="80" value="${esc(x?.vendor || '')}" placeholder="e.g. TNEB, Raja Laundry">`)}</div>
          <div style="grid-column:1/-1">${field('Note (optional)', `<input class="ns-input" name="note" maxlength="300" value="${esc(x?.note || '')}" placeholder="e.g. October bill">`)}</div></div>`,
      actions: [{ label: 'Cancel' }, { label: x ? 'Save' : 'Add expense', kind: 'primary', onClick: async (el) => {
        const v = (n) => el.querySelector(`[name=${n}]`).value.trim();
        const amt = toPaise(v('amount')); if (!(amt > 0)) throw new Error('Enter the amount.');
        await rpc('save_expense', { p_property: ctx.property_id, p: { id: x?.id || null, amount_paise: amt, spent_on: v('spent_on'), category: v('category'), method: v('method'), vendor: v('vendor'), note: v('note') } });
        toast(x ? 'Expense saved.' : 'Expense added.'); draw();
      } }],
    });
  }
  $('#add').onclick = () => edit();
  $('#period').onchange = (e) => { period = e.target.value; draw(); };
  await draw();
});
