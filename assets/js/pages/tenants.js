// Tenants & rent — PG / co-living monthly tenants (031_pg_tenants.sql).
// Separate add-on page: move-in, monthly rent & food (created automatically), deposit,
// electricity & other charges, payments with receipts, WhatsApp reminders, notice, move-out settlement.
import {
  W, page, rpc, content, headerActions, setSubtitle, headerSearch, esc, rupees, toPaise, fmtDay, ymd, addDays, avatar, pill, titleCase,
  modal, confirmDialog, toast, field, options, countryOptions, ID_TYPES, METHOD_OPTIONS, idUploadFields, wireIdPreviews, uploadIdSides,
  viewIdDocs, waNumber, SITE_URL, sb, $, $$,
} from '../core.js';

const day = (d) => (d ? fmtDay(String(d).slice(0, 10) + 'T12:00:00+05:30') : '—');
const KIND_LABEL = { rent: 'Rent', food: 'Food', deposit: 'Deposit', electricity: 'Electricity', maintenance: 'Maintenance', late_fee: 'Late fee', damage: 'Deduction', other: 'Other' };
const CHARGE_KINDS = [['electricity', 'Electricity'], ['maintenance', 'Maintenance'], ['late_fee', 'Late fee'], ['other', 'Other']];
const wa = (phone, text) => {
  const n = waNumber(phone);
  window.open(n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
};

page('tenants', async (ctx) => {
  const staff = ctx.can('owner', 'manager', 'front_desk');
  const boss = ctx.can('owner', 'manager');
  if (!ctx.isPg) {                                             // only for PG / co-living properties
    const h = headerActions(); if (h) h.innerHTML = '';
    content(`<div class="ns-card" style="max-width:560px;margin:30px auto;text-align:center;display:flex;flex-direction:column;gap:12px;align-items:center;padding:28px">
      <div style="font-size:30px">🔑</div>
      <div class="ns-h3">Tenants & rent is for PG / co-living</div>
      <div class="ns-muted" style="font-size:13.5px">Monthly tenants, automatic rent, deposits and move-out settlement. ${W.unit === 'bed'
        ? 'If this property is a PG or co-living, turn it on.' : 'It works with beds — hotels and homestays don’t use it.'}</div>
      ${W.unit === 'bed' && boss ? '<button type="button" class="ns-btn" id="pg-on">This is a PG / co-living — turn on</button>' : ''}
      <a href="dashboard.html" style="font-size:13px;font-weight:700">Back to dashboard</a></div>`);
    $('#pg-on')?.addEventListener('click', async (e) => {
      e.target.disabled = true;
      try { await rpc('pg_set_mode', { p_property: ctx.property_id, p_on: true }); location.reload(); }
      catch (err) { toast(err.message, { error: true }); e.target.disabled = false; }
    });
    return;
  }
  let data = null; let tab = 'living'; let search = '';

  const head = headerActions();
  if (head && staff) {
    head.innerHTML = '<button type="button" class="ns-btn" id="pg-new">+ Move in tenant</button>';
    $('#pg-new').onclick = () => moveIn();
  } else if (head) head.innerHTML = '';
  headerSearch('Search tenant, phone or bed…', (v) => { search = v.trim().toLowerCase(); draw(); });

  async function load() {
    data = await rpc('pg_tenants', { p_property: ctx.property_id });
    draw();
  }

  function draw() {
    const s = data.summary; const today = data.today;
    setSubtitle(`${s.active + s.notice} tenant${s.active + s.notice === 1 ? '' : 's'}${s.notice ? ` · ${s.notice} on notice` : ''} · ${ctx.property_name}`);
    const living = data.tenants.filter((t) => t.status !== 'moved_out');
    const lists = {
      living, due: living.filter((t) => t.due_paise > 0), notice: living.filter((t) => t.status === 'notice'),
      moved: data.tenants.filter((t) => t.status === 'moved_out'),
    };
    const q = (t) => !search || [t.guest.full_name, t.guest.phone, t.bed.label, t.bed.room].join(' ').toLowerCase().includes(search);
    const rows = lists[tab].filter(q);
    const card = (label, value, sub, tone = '') => `<div class="ns-card" style="padding:16px 18px;display:flex;flex-direction:column;gap:4px${tone}">
        <div class="ns-muted" style="font-size:12px;font-weight:700">${label}</div>
        <div style="font-family:'Sora',sans-serif;font-size:22px;font-weight:800">${value}</div>
        <div class="ns-muted" style="font-size:11.5px">${sub}</div></div>`;
    content(`
      <div class="pg-stats">
        ${card('Tenants', s.active + s.notice, s.notice ? `${s.notice} leaving soon` : 'living here now')}
        ${card('Monthly rent roll', rupees(s.rent_roll_paise), 'rent + food per month')}
        ${card('Collected this month', rupees(s.collected_month_paise), 'rent & charges')}
        ${card('Due now', rupees(s.due_now_paise), s.tenants_due ? `${s.tenants_due} tenant${s.tenants_due === 1 ? '' : 's'} to collect from` : 'all paid up 🎉',
          s.due_now_paise > 0 ? ';border-color:#F3D9A6;background:#FFF9EC' : '')}
        ${card('Deposits held', rupees(s.deposits_held_paise), 'refundable at move-out')}
      </div>
      <div class="pg-tabs" role="tablist">
        ${[['living', 'Living here', lists.living.length], ['due', 'Rent due', lists.due.length], ['notice', 'On notice', lists.notice.length], ['moved', 'Moved out', lists.moved.length]]
          .map(([k, l, n]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${tab === k}">${l} <span>${n}</span></button>`).join('')}
      </div>
      <div class="ns-card" style="padding:0;overflow:hidden">
        ${rows.length ? rows.map((t) => row(t, today)).join('') : `<div class="ns-empty" style="padding:36px 20px;text-align:center">
          ${data.tenants.length ? 'Nobody here.' : `<div style="font-size:15px;font-weight:800;margin-bottom:6px">No tenants yet</div>
            <div class="ns-muted" style="margin-bottom:14px">Add your monthly PG / co-living tenants. Rent is created every month automatically.</div>
            ${staff ? '<button type="button" class="ns-btn" data-pg-new>+ Move in tenant</button>' : ''}`}</div>`}
      </div>
      <div class="ns-muted" style="font-size:12px">Rent and food are added on each tenant’s rent day. A tenant’s bed shows on the calendar as a ₹0 booking (rent is kept here), so nightly guests can’t be booked into it.</div>`);
  }

  function row(t, today) {
    const due = t.due_paise; const late = t.overdue_paise > 0;
    const badge = t.status === 'moved_out' ? pill('Moved out', 'grey')
      : due > 0 ? `<span class="ns-pill ${late ? 'red' : 'amber'}">${rupees(due)} due</span>` : pill('Paid up', 'green');
    const sub = t.status === 'notice' ? `<b style="color:#B4711A">Leaving ${day(t.move_out_on)}</b>`
      : t.status === 'moved_out' ? `Moved out ${day(t.move_out_on)}${t.settled?.refund_paise ? ` · refunded ${rupees(t.settled.refund_paise)}` : ''}`
        : `Since ${day(t.start_date)}${t.next_due_on && t.next_due_on > today ? ` · next rent ${day(t.next_due_on)}` : ''}`;
    return `<div class="pg-row" data-id="${esc(t.id)}">
        <button type="button" class="pg-main" data-open aria-label="Open ${esc(t.guest.full_name)}">
          ${avatar(t.guest.full_name, 36)}
          <span style="flex:1;min-width:0;text-align:left">
            <span style="display:block;font-size:14px;font-weight:800;color:#101A3D">${esc(t.guest.full_name)}</span>
            <span class="ns-muted" style="display:block;font-size:12px">${esc(t.bed.room)} · ${esc(t.bed.label)} · ${rupees(t.rent_paise + t.food_paise)}/mo</span>
            <span class="ns-muted" style="display:block;font-size:12px">${sub}</span>
            ${t.hold_warning ? `<span style="display:block;font-size:12px;color:#B23A3A;font-weight:700">⚠ ${esc(t.hold_warning)}</span>` : ''}
          </span>
        </button>
        <span class="pg-side">${badge}
          ${t.status !== 'moved_out' && staff ? `<span style="display:flex;gap:6px">
            ${due > 0 ? '<button type="button" class="ns-btn" data-pay style="height:32px;font-size:12.5px">Collect</button>' : ''}
            ${due > 0 ? '<button type="button" class="ns-btn-ghost" data-remind style="height:32px;font-size:12.5px" title="WhatsApp rent reminder">Remind</button>' : ''}
          </span>` : ''}</span>
      </div>`;
  }

  document.querySelector('.ns-content').addEventListener('click', async (e) => {
    const tb = e.target.closest('[data-tab]'); if (tb) { tab = tb.dataset.tab; draw(); return; }
    if (e.target.closest('[data-pg-new]')) { moveIn(); return; }
    const r = e.target.closest('.pg-row'); if (!r) return;
    const t = data.tenants.find((x) => x.id === r.dataset.id); if (!t) return;
    if (e.target.closest('[data-pay]')) { const d = await rpc('pg_tenant', { p_tenancy: t.id }); pay(d); return; }
    if (e.target.closest('[data-remind]')) { const d = await rpc('pg_tenant', { p_tenancy: t.id }); remind(d); return; }
    if (e.target.closest('[data-open]')) openTenant(t.id);
  });

  // ------------------------------------------------------------ one tenant
  async function openTenant(id) {
    let d;
    try { d = await rpc('pg_tenant', { p_tenancy: id }); } catch (err) { toast(err.message, { error: true }); return; }
    const live = d.status !== 'moved_out';
    const open = d.dues.filter((x) => x.amount_paise > x.paid_paise);
    const regLink = d.self_checkin_token ? `${SITE_URL}/self-check-in.html?t=${d.self_checkin_token}` : null;
    const m = modal({
      title: d.guest.full_name, width: 760,
      body: `<div style="display:flex;flex-direction:column;gap:16px">
        <div class="pg-facts">
          <div><span>Bed</span><b>${esc(d.bed.room)} · ${esc(d.bed.label)}</b></div>
          <div><span>Phone</span><b>${esc(d.guest.phone || '—')}</b></div>
          <div><span>Moved in</span><b>${day(d.start_date)}</b></div>
          <div><span>Rent / food</span><b>${rupees(d.rent_paise)}${d.food_paise ? ` + ${rupees(d.food_paise)}` : ''} a month</b></div>
          <div><span>Rent day</span><b>${d.cycle === 'calendar' ? '1st of every month' : `Every month on the ${ordinal(Number(String(d.start_date).slice(8, 10)))}`}</b></div>
          <div><span>Deposit held</span><b>${rupees(d.deposit_held_paise)}${d.deposit_paise > d.deposit_held_paise && live ? ` <small style="color:#B4711A">of ${rupees(d.deposit_paise)}</small>` : ''}</b></div>
          <div><span>Notice period</span><b>${d.notice_days} days</b></div>
          <div><span>Status</span><b>${d.status === 'notice' ? `On notice — leaving ${day(d.move_out_on)}` : d.status === 'moved_out' ? `Moved out ${day(d.move_out_on)}` : 'Living here'}</b></div>
          <div><span>ID</span><b>${d.guest.id_type ? esc(titleCase(d.guest.id_type)) + (d.guest.id_number ? ' · ' + esc(d.guest.id_number) : '') : '—'}${d.self_checkin_at ? ' · <span style="color:#157A56">registered online</span>' : ''}</b></div>
        </div>
        ${d.hold_warning ? `<div class="ns-error" style="display:block">⚠ ${esc(d.hold_warning)}</div>` : ''}
        ${d.note ? `<div class="ns-muted" style="font-size:12.5px">📝 ${esc(d.note)}</div>` : ''}
        ${d.settled ? `<div class="pg-settle">Move-out settled: deposit ${rupees(d.settled.deposit_paid_paise)}${d.settled.advance_paise ? ` + advance ${rupees(d.settled.advance_paise)}` : ''}
          − dues ${rupees(d.settled.used_for_dues_paise)} = <b>refund ${rupees(d.settled.refund_paise)}</b>${d.settled.still_due_paise ? ` · <b style="color:#B23A3A">still owes ${rupees(d.settled.still_due_paise)}</b>` : ''}</div>` : ''}
        ${staff ? `<div class="pg-actions">
          ${open.length ? '<button type="button" class="ns-btn" data-a="pay">Record payment</button>' : ''}
          ${live ? '<button type="button" class="ns-btn-ghost" data-a="charge">+ Add charge</button>' : ''}
          ${open.length ? '<button type="button" class="ns-btn-ghost" data-a="remind">WhatsApp reminder</button>' : ''}
          ${live && regLink ? '<button type="button" class="ns-btn-ghost" data-a="reg">Registration link</button>' : ''}
          ${d.guest.has_id ? '<button type="button" class="ns-btn-ghost" data-a="id">View ID</button>' : ''}
          ${live && boss ? '<button type="button" class="ns-btn-ghost" data-a="edit">Edit rent</button>' : ''}
          ${live ? `<button type="button" class="ns-btn-ghost" data-a="notice">${d.status === 'notice' ? 'Change / withdraw notice' : 'Give notice'}</button>` : ''}
          ${live && boss ? '<button type="button" class="ns-btn-ghost" data-a="out" style="color:#B23A3A">Move out & settle</button>' : ''}
          ${d.booking_id ? `<a class="ns-btn-ghost" href="booking-detail.html?id=${esc(d.booking_id)}" style="display:inline-flex;align-items:center">Bed booking</a>` : ''}
          ${boss && !d.payments.length ? '<button type="button" class="ns-btn-ghost" data-a="del" style="color:#B23A3A">Delete</button>' : ''}
        </div>` : ''}
        <div>
          <div style="font-size:13px;font-weight:800;margin-bottom:6px">Rent & charges</div>
          <div class="pg-table"><table>
            <thead><tr><th>Due</th><th>For</th><th style="text-align:right">Amount</th><th style="text-align:right">Paid</th><th>Status</th>${boss && live ? '<th></th>' : ''}</tr></thead>
            <tbody>${d.dues.length ? d.dues.map((x) => {
              const left = x.amount_paise - x.paid_paise;
              const st = left <= 0 ? pill('Paid', 'green') : x.due_on > data.today ? pill('Upcoming', 'grey') : x.due_on < addDays(data.today, -5) ? pill('Late', 'red') : pill('Due', 'amber');
              return `<tr><td>${day(x.due_on)}</td><td>${esc(x.label)}${x.note ? `<div class="ns-muted" style="font-size:11.5px">${esc(x.note)}</div>` : ''}${x.credit_paise ? `<div style="font-size:11.5px;color:#157A56">${rupees(x.credit_paise)} paid ahead — returned at move-out</div>` : ''}</td>
                <td style="text-align:right">${rupees(x.amount_paise)}</td><td style="text-align:right">${rupees(x.paid_paise)}</td><td>${st}</td>
                ${boss && live ? `<td><button type="button" class="ns-icon-btn" data-edit-due="${esc(x.id)}" aria-label="Change amount" title="Change / waive">✎</button></td>` : ''}</tr>`;
            }).join('') : '<tr><td colspan="6" class="ns-muted">Nothing yet — rent appears on the rent day.</td></tr>'}</tbody></table></div>
        </div>
        <div>
          <div style="font-size:13px;font-weight:800;margin-bottom:6px">Payments</div>
          <div class="pg-table"><table>
            <thead><tr><th>Receipt</th><th>Date</th><th>For</th><th>Method</th><th style="text-align:right">Amount</th><th></th></tr></thead>
            <tbody>${d.payments.length ? d.payments.map((p) => `<tr><td>${esc(p.code)}</td><td>${day(String(p.received_at).slice(0, 10))}</td>
              <td>${p.kind === 'refund' ? '<b>Refund</b> · ' + esc(p.note || '') : esc(p.for || p.note || '')}${p.kind === 'deposit_adjust' ? ' <span class="ns-muted">(from deposit)</span>' : ''}</td>
              <td>${esc(p.method === 'deposit' ? 'Deposit' : (METHOD_OPTIONS.find(([v]) => v === p.method)?.[1] || p.method))}${p.reference ? `<div class="ns-muted" style="font-size:11px">${esc(p.reference)}</div>` : ''}</td>
              <td style="text-align:right;${p.kind === 'refund' ? 'color:#B23A3A' : ''}">${p.kind === 'refund' ? '−' : ''}${rupees(p.amount_paise)}</td>
              <td>${p.kind === 'payment' ? `<button type="button" class="ns-icon-btn" data-receipt="${esc(p.code)}" title="Send receipt on WhatsApp" aria-label="Send receipt">↗</button>` : ''}</td></tr>`).join('')
              : '<tr><td colspan="6" class="ns-muted">No payments yet.</td></tr>'}</tbody></table></div>
        </div>
      </div>`,
      actions: [{ label: 'Close' }],
    });
    const root = m.el;
    const again = async () => { await load(); m.close(); openTenant(id); };
    root.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      try {
        if (a === 'pay') pay(d, again);
        else if (a === 'charge') charge(d, again);
        else if (a === 'remind') remind(d);
        else if (a === 'reg') wa(d.guest.phone, `Hi ${first(d.guest.full_name)}, please fill your details and upload your ID for your stay at ${data.property.name}: ${regLink}`);
        else if (a === 'id') { const g = await sb.from('guests').select('id_doc_path, id_doc_back_path, full_name').eq('id', d.guest.id).single(); viewIdDocs({ front: g.data?.id_doc_path, back: g.data?.id_doc_back_path, name: d.guest.full_name }); }
        else if (a === 'edit') editTenancy(d, again);
        else if (a === 'notice') notice(d, again);
        else if (a === 'out') moveOut(d, again);
        else if (a === 'del') {
          if (!await confirmDialog('Delete tenant', `Delete ${d.guest.full_name}? Use this only for a mistaken entry — the bed is freed and their rent records are removed.`, { confirmLabel: 'Delete', danger: true })) return;
          await rpc('pg_delete', { p_tenancy: d.id }); toast('Deleted.'); m.close(); await load();
        }
      } catch (err) { toast(err.message, { error: true }); }
      const ed = e.target.closest('[data-edit-due]'); if (ed) editDue(d.dues.find((x) => x.id === ed.dataset.editDue), again);
      const rc = e.target.closest('[data-receipt]'); if (rc) receipt(d, d.payments.filter((p) => p.code === rc.dataset.receipt));
    });
  }

  // ------------------------------------------------------------ actions
  function remind(d) {
    const open = d.dues.filter((x) => x.amount_paise > x.paid_paise && x.due_on <= data.today);
    const total = open.reduce((s, x) => s + x.amount_paise - x.paid_paise, 0);
    if (!total) { toast('Nothing due right now.'); return; }
    const upi = data.property.upi_id ? `\nPay by UPI to: ${data.property.upi_id}` : '';
    wa(d.guest.phone, `Hi ${first(d.guest.full_name)}, a gentle reminder from ${data.property.name}: ${rupees(total)} is due\n`
      + open.map((x) => `• ${x.label}: ${rupees(x.amount_paise - x.paid_paise)}`).join('\n') + `${upi}\nPlease share the payment screenshot once paid. Thank you!`);
  }
  function receipt(d, payments) {
    if (!payments.length) return;
    const total = payments.reduce((s, p) => s + p.amount_paise, 0);
    const due = d.dues.filter((x) => x.due_on <= data.today).reduce((s, x) => s + x.amount_paise - x.paid_paise, 0);
    wa(d.guest.phone, `Payment received ✅\n${rupees(total)} on ${day(String(payments[0].received_at).slice(0, 10))} — receipt ${payments.map((p) => p.code).join(', ')}\n`
      + payments.map((p) => `• ${p.for || p.note || 'Payment'}: ${rupees(p.amount_paise)}`).join('\n')
      + `\nBalance due: ${rupees(due)}\nThank you — ${data.property.name}`);
  }

  function pay(d, after) {
    const open = d.dues.filter((x) => x.amount_paise > x.paid_paise);
    const nowDue = open.filter((x) => x.due_on <= data.today).reduce((s, x) => s + x.amount_paise - x.paid_paise, 0);
    const all = open.reduce((s, x) => s + x.amount_paise - x.paid_paise, 0);
    modal({
      title: `Record payment — ${d.guest.full_name}`, width: 520,
      body: `<div style="display:flex;flex-direction:column;gap:12px">
        <div class="ns-muted" style="font-size:12.5px">${open.map((x) => `${esc(x.label)}: <b>${rupees(x.amount_paise - x.paid_paise)}</b>${x.due_on > data.today ? ' (upcoming)' : ''}`).join(' · ')}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          ${field('Amount received (₹) *', `<input class="ns-input" name="amount" inputmode="decimal" value="${(nowDue || all) / 100}">`, 'Applied to the oldest dues first.')}
          ${field('Method', `<select class="ns-input" name="method">${options(METHOD_OPTIONS, 'upi')}</select>`)}
          <div style="grid-column:1/-1">${field('Reference (UPI ref / note)', '<input class="ns-input" name="reference" maxlength="80" placeholder="Optional">')}</div>
        </div>
        <label style="display:flex;gap:8px;align-items:center;font-size:13px"><input type="checkbox" name="send" checked> Send the receipt on WhatsApp</label>
      </div>`,
      actions: [{ label: 'Cancel' }, { label: 'Save payment', kind: 'primary', onClick: async (el) => {
        const v = (n) => el.querySelector(`[name=${n}]`);
        const amount = toPaise(v('amount').value);
        if (!(amount > 0)) throw new Error('Enter the amount received.');
        const r = await rpc('pg_pay', { p_tenancy: d.id, p: { amount_paise: amount, method: v('method').value, reference: v('reference').value } });
        toast(`${rupees(amount)} received · ${r.receipts.join(', ')}`);
        if (v('send').checked) {
          const fresh = await rpc('pg_tenant', { p_tenancy: d.id });
          receipt(fresh, fresh.payments.filter((p) => r.receipts.includes(p.code)));
        }
        if (after) await after(); else await load();
      } }],
    });
  }

  function charge(d, after) {
    const cm = modal({
      title: `Add charge — ${d.guest.full_name}`, width: 540,
      body: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        ${field('For', `<select class="ns-input" name="kind">${options(CHARGE_KINDS, 'electricity')}</select>`)}
        ${field('Due on', `<input class="ns-input" type="date" name="due_on" value="${data.today}">`)}
        <div class="pg-meter" style="grid-column:1/-1;display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
          ${field('Previous reading', '<input class="ns-input" name="m0" inputmode="decimal" placeholder="e.g. 1240">')}
          ${field('Current reading', '<input class="ns-input" name="m1" inputmode="decimal" placeholder="e.g. 1288">')}
          ${field('₹ per unit', '<input class="ns-input" name="rate" inputmode="decimal" placeholder="e.g. 8">')}
        </div>
        ${field('Amount (₹) *', '<input class="ns-input" name="amount" inputmode="decimal">')}
        ${field('Description', '<input class="ns-input" name="label" maxlength="80" placeholder="e.g. Electricity · Oct">')}
        <div style="grid-column:1/-1">${field('Note', '<input class="ns-input" name="note" maxlength="300" placeholder="Optional">')}</div>
      </div>`,
      actions: [{ label: 'Cancel' }, { label: 'Add charge', kind: 'primary', onClick: async (el) => {
        const v = (n) => el.querySelector(`[name=${n}]`).value.trim();
        const amount = toPaise(v('amount'));
        if (!(amount > 0)) throw new Error('Enter the amount.');
        await rpc('pg_add_charge', { p_tenancy: d.id, p: { kind: v('kind'), amount_paise: amount, label: v('label'), due_on: v('due_on'), note: v('note') } });
        toast('Charge added.'); if (after) await after(); else await load();
      } }],
    });
    const el = cm.el;
    const f = (n) => el.querySelector(`[name=${n}]`);
    const calc = () => {
      const units = Number(f('m1').value) - Number(f('m0').value); const rate = Number(f('rate').value);
      if (units > 0 && rate > 0) {
        f('amount').value = Math.round(units * rate * 100) / 100;
        if (!f('label').value || /^Electricity · \d/.test(f('label').value)) f('label').value = `Electricity · ${units} units`;
        f('note').value = `Meter ${f('m0').value} → ${f('m1').value} × ₹${rate}`;
      }
    };
    ['m0', 'm1', 'rate'].forEach((n) => f(n).addEventListener('input', calc));
    f('kind').addEventListener('change', () => { el.querySelector('.pg-meter').style.display = f('kind').value === 'electricity' ? 'grid' : 'none'; });
  }

  function editDue(x, after) {
    if (!x) return;
    modal({
      title: `Change ${x.label}`, width: 460,
      body: `<div style="display:flex;flex-direction:column;gap:12px">
        ${field('Amount (₹)', `<input class="ns-input" name="amount" inputmode="decimal" value="${x.amount_paise / 100}">`, x.paid_paise ? `Already paid: ${rupees(x.paid_paise)} — can’t go lower.` : 'Enter 0 to waive it.')}
        ${field('Reason', `<input class="ns-input" name="note" maxlength="300" value="${esc(x.note || '')}" placeholder="e.g. Discount for October">`)}
      </div>`,
      actions: [{ label: 'Cancel' }, { label: 'Save', kind: 'primary', onClick: async (el) => {
        const amt = toPaise(el.querySelector('[name=amount]').value || '0');
        await rpc('pg_edit_due', { p_due: x.id, p_amount_paise: amt, p_note: el.querySelector('[name=note]').value });
        toast('Updated.'); await after();
      } }],
    });
  }

  function editTenancy(d, after) {
    modal({
      title: `Edit — ${d.guest.full_name}`, width: 520,
      body: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        ${field('Rent per month (₹)', `<input class="ns-input" name="rent" inputmode="decimal" value="${d.rent_paise / 100}">`, 'Applies from the next rent day.')}
        ${field('Food per month (₹)', `<input class="ns-input" name="food" inputmode="decimal" value="${d.food_paise / 100}">`)}
        ${field('Security deposit (₹)', `<input class="ns-input" name="deposit" inputmode="decimal" value="${d.deposit_paise / 100}">`)}
        ${field('Notice period (days)', `<input class="ns-input" name="notice" type="number" min="0" max="180" value="${d.notice_days}">`)}
        <div style="grid-column:1/-1">${field('Note', `<input class="ns-input" name="note" maxlength="1000" value="${esc(d.note || '')}">`)}</div>
      </div>`,
      actions: [{ label: 'Cancel' }, { label: 'Save', kind: 'primary', onClick: async (el) => {
        const v = (n) => el.querySelector(`[name=${n}]`).value;
        await rpc('pg_update', { p_tenancy: d.id, p: { rent_paise: toPaise(v('rent')), food_paise: toPaise(v('food') || '0'), deposit_paise: toPaise(v('deposit') || '0'), notice_days: v('notice'), note: v('note') } });
        toast('Saved.'); await after();
      } }],
    });
  }

  function notice(d, after) {
    const def = d.move_out_on || addDays(data.today, d.notice_days);
    modal({
      title: `Notice — ${d.guest.full_name}`, width: 460,
      body: `<div style="display:flex;flex-direction:column;gap:12px">
        ${field('Move-out date', `<input class="ns-input" type="date" name="day" value="${def}" min="${String(d.start_date).slice(0, 10)}">`,
          `Notice period: ${d.notice_days} days → ${day(addDays(data.today, d.notice_days))}. The last month’s rent is charged only up to this date.`)}
      </div>`,
      actions: [
        ...(d.status === 'notice' ? [{ label: 'Withdraw notice', onClick: async () => { await rpc('pg_notice', { p_tenancy: d.id, p_move_out: null }); toast('Notice withdrawn.'); await after(); } }] : [{ label: 'Cancel' }]),
        { label: 'Save', kind: 'primary', onClick: async (el) => {
          const v = el.querySelector('[name=day]').value; if (!v) throw new Error('Choose the move-out date.');
          await rpc('pg_notice', { p_tenancy: d.id, p_move_out: v }); toast(`Leaving ${day(v)}.`); await after();
        } }],
    });
  }

  function moveOut(d, after) {
    const held = d.deposit_held_paise + d.dues.reduce((s, x) => s + (x.credit_paise || 0), 0);
    const om = modal({
      title: `Move out & settle — ${d.guest.full_name}`, width: 540,
      body: `<div style="display:flex;flex-direction:column;gap:12px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          ${field('Move-out date', `<input class="ns-input" type="date" name="day" value="${d.move_out_on && d.move_out_on <= data.today ? d.move_out_on : data.today}">`)}
          ${field('Deductions (₹)', '<input class="ns-input" name="ded" inputmode="decimal" value="0">', 'Damage, cleaning, key…')}
          <div style="grid-column:1/-1">${field('Reason for deductions', '<input class="ns-input" name="dnote" maxlength="200" placeholder="Optional">')}</div>
          ${field('Refund by', `<select class="ns-input" name="method">${options(METHOD_OPTIONS, 'upi')}</select>`)}
          ${field('Refund reference', '<input class="ns-input" name="ref" maxlength="80" placeholder="Optional">')}
        </div>
        <div class="pg-settle" id="pg-preview"></div>
        <div class="ns-muted" style="font-size:12px">The last month’s rent and food are charged up to the move-out date. Unpaid dues are taken from the deposit; the rest is refunded. The bed is marked for cleaning.</div>
      </div>`,
      actions: [{ label: 'Cancel' }, { label: 'Move out', kind: 'danger', onClick: async (el) => {
        const v = (n) => el.querySelector(`[name=${n}]`).value;
        const r = await rpc('pg_move_out', { p_tenancy: d.id, p: { move_out_on: v('day'), deductions_paise: toPaise(v('ded') || '0'), deduction_note: v('dnote'), refund_method: v('method'), refund_reference: v('ref') } });
        toast(r.refund_paise ? `Moved out · refund ${rupees(r.refund_paise)}` : r.still_due_paise ? `Moved out · still owes ${rupees(r.still_due_paise)}` : 'Moved out.');
        await after();
      } }],
    });
    const el = om.el;
    const span = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 864e5);
    const prev = () => {
      const ded = toPaise(el.querySelector('[name=ded]').value || '0') || 0;
      const out = el.querySelector('[name=day]').value || data.today;
      let open = ded; let credit = 0;
      d.dues.filter((x) => x.kind !== 'deposit' && x.due_on <= out).forEach((x) => {
        let target = x.amount_paise;                                   // last month: only up to the move-out day
        if (['rent', 'food'].includes(x.kind) && !x.edited && x.period_start && x.period_end && out < String(x.period_end).slice(0, 10)) {
          target = Math.round(x.amount_paise * span(x.period_start, out) / Math.max(1, span(x.period_start, x.period_end)));
        }
        open += Math.max(0, target - x.paid_paise); credit += Math.max(0, x.paid_paise - target);
      });
      const refund = held + credit - open;
      el.querySelector('#pg-preview').innerHTML = `Deposit ${rupees(held)}${credit ? ` + advance ${rupees(credit)}` : ''} − dues ${rupees(open)} = ${refund >= 0 ? `<b>refund about ${rupees(refund)}</b>` : `<b style="color:#B23A3A">tenant still owes about ${rupees(-refund)}</b>`}
        <div class="ns-muted" style="font-size:11.5px">Estimate — the exact amount (with the last month prorated) is worked out when you press Move out.</div>`;
    };
    el.querySelectorAll('[name=ded],[name=day]').forEach((x) => x.addEventListener('input', prev)); prev();
  }

  async function moveIn() {
    const start = data.today;
    const bedOptions = (list) => (list.length ? list.map((b) => `<option value="${esc(b.id)}">${esc(b.room_name)} · ${esc(b.label)} — ${b.free >= 60 ? 'free 2+ months' : `free until ${day(b.until)}`}</option>`).join('')
      : '<option value="">No free bed from that date</option>');
    // beds free on the move-in date, longest-free first ("free until …" when another guest is booked later)
    async function bedsFrom(s) {
      const list = await rpc('available_beds', { p_property: ctx.property_id, p_in: new Date(s + 'T14:00:00+05:30').toISOString(), p_out: new Date(addDays(s, 1) + 'T11:00:00+05:30').toISOString() });
      const from = s > data.today ? s : data.today;
      const cal = await rpc('calendar_range', { p_property: ctx.property_id, p_from: from, p_days: 60 }).catch(() => ({ bookings: [], blocks: [] }));
      const next = {};
      [...(cal.bookings || []).filter((b) => ['pending', 'confirmed', 'checked_in'].includes(b.status)).map((b) => [b.bed_id, String(b.check_in_at)]),
        ...(cal.blocks || []).map((k) => [k.bed_id, String(k.starts_at)])].forEach(([bed, at]) => {
        const d0 = ymd(at); if (d0 > from && (!next[bed] || d0 < next[bed])) next[bed] = d0;
      });
      return list.map((b) => ({ ...b, until: next[b.id] || null, free: next[b.id] ? Math.round((new Date(next[b.id]) - new Date(from)) / 864e5) : 99 }))
        .filter((b) => b.free >= 2).sort((a, b) => b.free - a.free);           // a 1-night gap can't take a tenant
    }
    let beds = [];
    try { beds = await bedsFrom(start); } catch { beds = []; }
    const im = modal({
      title: 'Move in a tenant', width: 680,
      body: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div style="grid-column:1/-1;font-size:12px;font-weight:800;color:#6B7280;text-transform:uppercase;letter-spacing:.04em">Tenant</div>
        <div style="grid-column:1/-1">${field('Full name *', '<input class="ns-input" name="full_name" maxlength="120" placeholder="As on the ID">')}</div>
        ${field('Phone (WhatsApp)', '<input class="ns-input" name="phone" type="tel" placeholder="98400 12345">')}
        ${field('Nationality', `<select class="ns-input" name="nationality">${countryOptions('India')}</select>`)}
        ${field('Proof of identity', `<select class="ns-input" name="id_type"><option value="">None</option>${options(ID_TYPES, 'aadhaar')}</select>`)}
        ${field('ID number', '<input class="ns-input" name="id_number" autocomplete="off">', 'Aadhaar: only the last 4 digits are kept.')}
        <div style="grid-column:1/-1">${idUploadFields({ front: 'ID front (optional)', back: 'ID back (optional)' })}
          <div class="ns-help" style="margin-top:4px">Or skip — send them the registration link after move-in to fill it themselves.</div></div>
        <div style="grid-column:1/-1;font-size:12px;font-weight:800;color:#6B7280;text-transform:uppercase;letter-spacing:.04em;margin-top:6px">Bed & rent</div>
        ${field('Bed *', `<select class="ns-input" name="bed">${bedOptions(beds)}</select>`, 'Longest-free beds first. If a bed is free only for a while, move that guest’s booking or the tenant before then.')}
        ${field('Move-in date', `<input class="ns-input" type="date" name="start" value="${start}" min="${addDays(start, -62)}">`)}
        ${field('Rent per month (₹) *', '<input class="ns-input" name="rent" inputmode="decimal" placeholder="e.g. 8000">')}
        ${field('Food per month (₹)', '<input class="ns-input" name="food" inputmode="decimal" placeholder="0 if not included">')}
        ${field('Rent day', `<select class="ns-input" name="cycle">${options([['movein', 'Same date every month (from move-in)'], ['calendar', '1st of every month (first month part-rent)']], 'movein')}</select>`)}
        ${field('Notice period (days)', '<input class="ns-input" name="notice" type="number" min="0" max="180" value="30">')}
        ${field('Security deposit (₹)', '<input class="ns-input" name="deposit" inputmode="decimal" placeholder="e.g. 10000">')}
        ${field('Deposit received now (₹)', '<input class="ns-input" name="dep_paid" inputmode="decimal" placeholder="0 if later">')}
        ${field('Paid by', `<select class="ns-input" name="method">${options(METHOD_OPTIONS, 'upi')}</select>`)}
        ${field('Reference', '<input class="ns-input" name="reference" maxlength="80" placeholder="Optional">')}
        <div style="grid-column:1/-1">${field('Note', '<input class="ns-input" name="note" maxlength="1000" placeholder="e.g. Works at TCS · veg food">')}</div>
      </div>`,
      actions: [{ label: 'Cancel' }, { label: 'Move in', kind: 'primary', onClick: async (el) => {
        const v = (n) => el.querySelector(`[name=${n}]`).value.trim();
        if (v('full_name').length < 2) throw new Error('Enter the tenant’s full name.');
        if (!v('bed')) throw new Error('Choose a bed.');
        const rent = toPaise(v('rent')); if (!(rent > 0)) throw new Error('Enter the monthly rent.');
        const ids = await uploadIdSides(el, `${ctx.property_id}/staff`);
        const r = await rpc('pg_move_in', { p_property: ctx.property_id, p: {
          guest: { full_name: v('full_name'), phone: v('phone'), nationality: v('nationality'), id_type: v('id_type'), id_number: v('id_number'), ...ids },
          bed_id: v('bed'), start_date: v('start'), rent_paise: rent, food_paise: toPaise(v('food') || '0') || 0,
          deposit_paise: toPaise(v('deposit') || '0') || 0, deposit_paid_paise: toPaise(v('dep_paid') || '0') || 0,
          method: v('method'), reference: v('reference'), cycle: v('cycle'), notice_days: v('notice') || 30, note: v('note') } });
        if (r.held_until && r.held_until < addDays(v('start'), 300)) {
          toast(`${v('full_name')} moved in. Note: this bed is free only until ${day(r.held_until)} — another guest is booked on it. Move one of them before then.`, { error: true });
        } else toast(`${v('full_name')} moved in.`);
        await load(); openTenant(r.id);
      } }],
    });
    wireIdPreviews(im.el);
    const el = im.el;
    // beds free from the chosen date
    el.querySelector('[name=start]').addEventListener('change', async (e) => {
      const s = e.target.value; if (!s) return;
      try { el.querySelector('[name=bed]').innerHTML = bedOptions(await bedsFrom(s)); } catch { /* keep the list */ }
    });
  }

  await load();
});

function first(name) { return String(name || '').trim().split(/\s+/)[0] || 'there'; }
function ordinal(n) { const s = ['th', 'st', 'nd', 'rd']; const v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
void $$;
