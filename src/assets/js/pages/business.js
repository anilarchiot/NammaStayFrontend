// My business (039) — loans & EMIs, partners & payouts, lease. Owner only. Used by investment.js (tab "Loans, partners & lease").
import { rpc, esc, rupees, toPaise, fmtDate, ymd, modal, field, toast, confirmDialog, $, $$ } from '../core.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const monthYear = (ym) => { if (!ym || ym === 'done') return ''; const [y, m] = String(ym).slice(0, 7).split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; };
const rr = (p) => rupees(Math.round(Number(p || 0) / 100) * 100);   // whole rupees for big figures
const pl = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const pct = (n) => `${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 1 })}%`;
const wa = (phone, text) => { let d = String(phone || '').replace(/\D/g, ''); if (d.length === 10) d = '91' + d; return `https://wa.me/${d}?text=${encodeURIComponent(text)}`; };
const yearsMonths = (m) => { const y = Math.floor(m / 12); const r = m % 12; return [y ? pl(y, 'year') : '', r ? pl(r, 'month') : ''].filter(Boolean).join(' ') || '0 months'; };

/** Loads My business data; null if 039 is not installed */
export async function loadBusiness(propertyId) {
  try { return await rpc('biz_summary', { p_property: propertyId }); } catch (e) { if (/biz_summary|function|schema cache/i.test(e.message)) return null; throw e; }
}

/** One line for the payback hero when loans change the picture */
export function realPaybackHtml(B) {
  if (!B) return '';
  const P = B.payback; const out = [];
  if (P.interest_paid_paise > 0) {
    out.push(`<div class="biz-real"><span class="ivs-label">After loan interest</span>
      <b>${P.real_pct == null ? '—' : pct(Math.floor(P.real_pct))} paid back</b>
      <span>${rr(P.interest_paid_paise)} interest paid so far is counted · break-even ${P.real_breakeven === 'done' ? 'reached' : P.real_breakeven ? 'around <b>' + esc(monthYear(P.real_breakeven)) + '</b>' : 'not yet estimable'}</span></div>`);
  }
  return out.join('');
}
export function alertsHtml(B, only = null) {
  if (!B?.alerts?.length) return '';
  const list = B.alerts.filter((a) => !only || only.includes(a.kind));
  if (!list.length) return '';
  return `<div class="biz-alerts" role="status">${list.map((a) => `<div class="biz-alert biz-${a.level}"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg><span>${esc(a.text)}</span></div>`).join('')}</div>`;
}

/** Renders the tab into `el`. onChange(B) is called with fresh data after every save. */
export function renderBusiness(el, ctx, B, onChange) {
  const pr = B.profile;
  const Q = [['has_loan', 'Did you take a loan for this business?', 'Bank loan, gold loan, money from family — anything you pay back with interest.'],
    ['has_partners', 'Do you run it with partners?', 'Friends or family who put in money and share the profit.'],
    ['is_rented', 'Is the building rented / leased?', 'So we can warn you before the lease ends and the rent goes up.']];
  const unanswered = Q.filter(([k]) => pr[k] == null);
  const save = async (fn, args, msg) => { const nb = await rpc(fn, args); if (msg) toast(msg); onChange(nb); };

  el.innerHTML = `${alertsHtml(B)}
    ${unanswered.length ? `<section class="ns-card biz-q" aria-labelledby="biz-q-h"><h2 id="biz-q-h" class="ns-h3" style="margin:0;font-size:19px">${unanswered.length === 3 ? 'Three quick questions' : 'One more question'}</h2>
      <p class="ns-muted" style="margin:0;font-size:13.5px">Answer “No” and that part never shows. You can change answers any time.</p>
      ${unanswered.map(([k, q, sub]) => `<div class="biz-q-row"><div><b>${esc(q)}</b><div class="ns-muted" style="font-size:12.5px">${esc(sub)}</div></div>
        <div class="biz-yn"><button type="button" class="ns-btn-ghost" data-q="${k}" data-v="false">No</button><button type="button" class="ns-btn" data-q="${k}" data-v="true">Yes</button></div></div>`).join('')}</section>` : ''}
    ${pr.has_loan ? loansCard(B) : ''}
    ${pr.has_partners ? partnersCard(B, ctx) : ''}
    ${pr.is_rented ? leaseCard(B) : ''}
    ${!unanswered.length && !pr.has_loan && !pr.has_partners && !pr.is_rented ? '<div class="ns-card ns-empty">No loan, no partners, your own building — nothing to track here. Lucky you!</div>' : ''}
    ${unanswered.length < 3 ? `<p class="ns-muted" style="font-size:12.5px;margin:0">Answers: loan ${yn(pr.has_loan)} · partners ${yn(pr.has_partners)} · rented ${yn(pr.is_rented)} · <button type="button" class="ivs-link" data-change>Change</button></p>` : ''}`;

  $$('[data-q]', el).forEach((b) => { b.onclick = () => save('biz_profile_save', { p_property: ctx.property_id, p: { [b.dataset.q]: b.dataset.v === 'true' } }).catch((e) => toast(e.message, { error: true })); });
  $('[data-change]', el)?.addEventListener('click', () => answersDialog());
  $('[data-loan-new]', el)?.addEventListener('click', () => loanDialog());
  $$('[data-loan-edit]', el).forEach((b) => { b.onclick = () => loanDialog(B.loans.items.find((x) => x.id === b.dataset.loanEdit)); });
  $('#biz-emi-exp', el)?.addEventListener('change', (e) => save('biz_profile_save', { p_property: ctx.property_id, p: { emi_in_expenses: e.target.checked } },
    e.target.checked ? 'OK — interest is not counted twice.' : 'Interest will be counted in your payback.').catch((x) => toast(x.message, { error: true })));
  $('[data-partner-new]', el)?.addEventListener('click', () => partnerDialog());
  $$('[data-partner-edit]', el).forEach((b) => { b.onclick = () => partnerDialog(B.partners.items.find((x) => x.id === b.dataset.partnerEdit)); });
  $$('[data-payout]', el).forEach((b) => { b.onclick = () => payoutDialog(b.dataset.payout || null); });
  $$('[data-payout-del]', el).forEach((b) => { b.onclick = async () => {
    if (!await confirmDialog('Delete payout', 'Delete this payout record?', { confirmLabel: 'Delete', danger: true })) return;
    save('biz_payout_delete', { p_id: b.dataset.payoutDel }, 'Payout deleted.').catch((e) => toast(e.message, { error: true })); }; });
  $('[data-lease-edit]', el)?.addEventListener('click', () => leaseDialog(B.lease));

  // ---------------------------------------------------------------- dialogs
  function answersDialog() {
    const sel = (k, v) => `<select class="ns-input" name="${k}"><option value="true" ${v === true ? 'selected' : ''}>Yes</option><option value="false" ${v === false ? 'selected' : ''}>No</option></select>`;
    modal({ title: 'Your answers', width: 440, body: `<div style="display:flex;flex-direction:column;gap:12px">
      ${Q.map(([k, q]) => field(q, sel(k, pr[k]))).join('')}<p class="ns-muted" style="margin:0;font-size:12.5px">Saying “No” only hides the card — nothing you entered is deleted.</p></div>`,
    actions: [{ label: 'Cancel' }, { label: 'Save', kind: 'primary', onClick: async (m) => {
      const p = Object.fromEntries(Q.map(([k]) => [k, m.querySelector(`[name=${k}]`).value === 'true']));
      await save('biz_profile_save', { p_property: ctx.property_id, p }, 'Saved.');
    } }] });
  }
  function loanDialog(l = null) {
    modal({ title: l ? 'Edit loan' : 'Add a loan', width: 520, body: `<div class="biz-form">
      ${field('Who gave it', `<input class="ns-input" name="lender" maxlength="80" value="${esc(l?.lender || '')}" placeholder="e.g. SBI, HDFC, Mudra loan, family">`)}
      <div class="biz-g2">${field('Loan amount (₹)', `<input class="ns-input" name="principal" inputmode="decimal" value="${l ? l.principal_paise / 100 : ''}" placeholder="800000">`)}
        ${field('Interest rate (% a year)', `<input class="ns-input" name="rate" inputmode="decimal" value="${l ? l.rate_pct : ''}" placeholder="11">`)}</div>
      <div class="biz-g2">${field('Period (months)', `<input class="ns-input" name="tenure" inputmode="numeric" value="${l ? l.tenure_months : ''}" placeholder="60">`)}
        ${field('First EMI date', `<input class="ns-input" type="date" name="first" value="${esc(l?.first_emi_on || '')}">`)}</div>
      ${field('EMI (₹) — optional', `<input class="ns-input" name="emi" inputmode="decimal" value="${l?.emi_entered ? l.emi_paise / 100 : ''}" placeholder="Leave empty — we work it out">`)}
      <div class="biz-calc ns-muted" id="biz-calc"></div>
      ${l ? field('Closed early on (optional)', `<input class="ns-input" type="date" name="closed" max="${ymd()}" value="${esc(l.closed_on || '')}">`) : ''}
      ${field('Note (optional)', `<input class="ns-input" name="note" maxlength="200" value="${esc(l?.note || '')}">`)}</div>`,
    actions: [...(l ? [{ label: 'Delete', kind: 'danger', onClick: async () => {
      if (!await confirmDialog('Delete loan', `Delete the ${l.lender} loan?`, { confirmLabel: 'Delete', danger: true })) return false;
      await save('biz_loan_delete', { p_id: l.id }, 'Loan deleted.'); } }] : []),
    { label: 'Cancel' }, { label: 'Save', kind: 'primary', onClick: async (m) => {
      const v = (n) => m.querySelector(`[name=${n}]`)?.value.trim() || '';
      const pr2 = toPaise(v('principal')); const rate = parseFloat(v('rate')); const n = parseInt(v('tenure'), 10);
      if (!(pr2 > 0)) throw new Error('Enter the loan amount.'); if (!(rate >= 0)) throw new Error('Enter the interest rate, e.g. 11.');
      if (!(n > 0)) throw new Error('Enter the loan period in months.'); if (!v('first')) throw new Error('Enter the first EMI date.');
      await save('biz_loan_save', { p_property: ctx.property_id, p: { id: l?.id || null, lender: v('lender'), principal_paise: pr2, rate_pct: rate, tenure_months: n,
        emi_paise: v('emi') ? toPaise(v('emi')) : null, first_emi_on: v('first'), closed_on: v('closed') || null, note: v('note') } }, l ? 'Loan updated.' : 'Loan added.');
    } }] });
    const calc = () => {
      const g = (n) => document.querySelector(`.ns-modal [name=${n}]`)?.value || '';
      const P = toPaise(g('principal')); const r = parseFloat(g('rate')) / 1200; const n = parseInt(g('tenure'), 10);
      const box = $('#biz-calc'); if (!box) return;
      if (!(P > 0) || !(r >= 0) || !(n > 0)) { box.textContent = ''; return; }
      const emi = r === 0 ? P / n : P * r * (1 + r) ** n / ((1 + r) ** n - 1);
      box.innerHTML = `EMI about <b>${rr(Math.round(emi))}</b> a month · total interest <b>${rr(Math.round(emi * n - P))}</b> over ${yearsMonths(n)}`;
    };
    $$('.ns-modal [name=principal], .ns-modal [name=rate], .ns-modal [name=tenure]').forEach((i) => i.addEventListener('input', calc)); calc();
  }
  function partnerDialog(p = null) {
    const meExists = B.partners.items.some((x) => x.is_me);
    modal({ title: p ? 'Edit partner' : 'Add partner', width: 460, body: `<div class="biz-form">
      ${!p && !meExists ? `<label class="biz-check"><input type="checkbox" name="me"> This is me (the owner)</label>` : ''}
      ${field('Name', `<input class="ns-input" name="name" maxlength="60" value="${esc(p?.name || '')}">`)}
      <div class="biz-g2">${field('Profit share (%)', `<input class="ns-input" name="share" inputmode="decimal" value="${p ? p.share_pct : ''}" placeholder="40">`)}
        ${field('WhatsApp (optional)', `<input class="ns-input" name="phone" type="tel" value="${esc(p?.phone || '')}">`)}</div>
      <p class="ns-muted" style="margin:0;font-size:12.5px">Shares of all partners should add up to 100%. Mark who paid for each item in Payback → What you invested.</p>
      ${field('Note (optional)', `<input class="ns-input" name="note" maxlength="200" value="${esc(p?.note || '')}" placeholder="e.g. as per partnership deed of Jan 2025">`)}</div>`,
    actions: [...(p ? [{ label: 'Remove', kind: 'danger', onClick: async () => {
      if (!await confirmDialog('Remove partner', `Remove ${p.name}? Their payout records are deleted; items they paid for stay in your investment list.`, { confirmLabel: 'Remove', danger: true })) return false;
      await save('biz_partner_delete', { p_id: p.id }, 'Partner removed.'); } }] : []),
    { label: 'Cancel' }, { label: 'Save', kind: 'primary', onClick: async (m) => {
      const v = (n) => m.querySelector(`[name=${n}]`)?.value.trim() || '';
      await save('biz_partner_save', { p_property: ctx.property_id, p: { id: p?.id || null, name: v('name'), share_pct: parseFloat(v('share')), phone: v('phone') || null,
        note: v('note'), is_me: p ? p.is_me : !!m.querySelector('[name=me]')?.checked } }, p ? 'Partner updated.' : 'Partner added.');
    } }] });
  }
  function payoutDialog(pid) {
    const others = B.partners.items;
    modal({ title: 'Record a payout', width: 440, body: `<div class="biz-form">
      ${field('To', `<select class="ns-input" name="partner">${others.map((x) => `<option value="${esc(x.id)}" ${x.id === pid ? 'selected' : ''}>${esc(x.is_me ? x.name + ' (you)' : x.name)}</option>`).join('')}</select>`)}
      <div class="biz-g2">${field('Amount (₹)', '<input class="ns-input" name="amt" inputmode="decimal" placeholder="50000">')}
        ${field('Date', `<input class="ns-input" type="date" name="on" max="${ymd()}" value="${ymd()}">`)}</div>
      ${field('Note (optional)', '<input class="ns-input" name="note" maxlength="200" placeholder="e.g. Sept profit share, by UPI">')}</div>`,
    actions: [{ label: 'Cancel' }, { label: 'Save', kind: 'primary', onClick: async (m) => {
      const v = (n) => m.querySelector(`[name=${n}]`).value.trim(); const amt = toPaise(v('amt'));
      if (!(amt > 0)) throw new Error('Enter the amount paid.');
      await save('biz_payout_save', { p_property: ctx.property_id, p: { partner_id: v('partner'), amount_paise: amt, paid_on: v('on'), note: v('note') } }, 'Payout recorded.');
    } }] });
  }
  function leaseDialog(L = null) {
    modal({ title: L ? 'Edit lease' : 'Add your lease', width: 540, body: `<div class="biz-form">
      ${field('Landlord (optional)', `<input class="ns-input" name="landlord" maxlength="80" value="${esc(L?.landlord || '')}">`)}
      <div class="biz-g2">${field('Lease started', `<input class="ns-input" type="date" name="start" value="${esc(L?.start_on || '')}">`)}
        ${field('Lease ends', `<input class="ns-input" type="date" name="end" value="${esc(L?.end_on || '')}">`)}</div>
      <div class="biz-g2">${field('Rent at the start (₹ / month)', `<input class="ns-input" name="rent" inputmode="decimal" value="${L ? L.rent_start_paise / 100 : ''}" placeholder="40000">`)}
        ${field('Deposit (₹)', `<input class="ns-input" name="deposit" inputmode="decimal" value="${L ? L.deposit_paise / 100 : ''}" placeholder="300000">`)}</div>
      <div class="biz-g2">${field('Rent goes up by (%)', `<input class="ns-input" name="inc" inputmode="decimal" value="${L ? L.increase_pct : '5'}">`)}
        ${field('Every (months)', `<input class="ns-input" name="every" inputmode="numeric" value="${L ? L.increase_every_months : '12'}">`)}</div>
      <div class="biz-g2">${field('Lock-in (months)', `<input class="ns-input" name="lock" inputmode="numeric" value="${L ? L.lock_in_months : '0'}">`)}
        ${field('Notice period (months)', `<input class="ns-input" name="notice" inputmode="numeric" value="${L ? L.notice_months : '0'}">`)}</div>
      ${field('Note (optional)', `<input class="ns-input" name="note" maxlength="200" value="${esc(L?.note || '')}">`)}
      <p class="ns-muted" style="margin:0;font-size:12.5px">Tip: upload the rental agreement in Documents &amp; licences so it is safe and you get an expiry reminder too.</p></div>`,
    actions: [{ label: 'Cancel' }, { label: 'Save', kind: 'primary', onClick: async (m) => {
      const v = (n) => m.querySelector(`[name=${n}]`).value.trim();
      if (!v('start') || !v('end')) throw new Error('Enter when the lease started and when it ends.');
      await save('biz_lease_save', { p_property: ctx.property_id, p: { landlord: v('landlord'), start_on: v('start'), end_on: v('end'), rent_paise: toPaise(v('rent')) || 0,
        deposit_paise: toPaise(v('deposit')) || 0, increase_pct: parseFloat(v('inc')) || 0, increase_every_months: parseInt(v('every'), 10) || 12,
        lock_in_months: parseInt(v('lock'), 10) || 0, notice_months: parseInt(v('notice'), 10) || 0, note: v('note') } }, 'Lease saved.');
    } }] });
  }
}
const yn = (v) => (v == null ? '—' : v ? 'yes' : 'no');

// ---------------------------------------------------------------- cards
function loansCard(B) {
  const L = B.loans; const items = L.items;
  const rows = items.map((l) => {
    const done = l.done; const p = Math.round((l.emis_paid / l.tenure_months) * 100);
    return `<article class="biz-loan${done ? ' is-done' : ''}">
      <header><div><b>${esc(l.lender)}</b> <span class="ns-muted">· ${rr(l.principal_paise)} at ${pct(l.rate_pct)} for ${yearsMonths(l.tenure_months)}</span></div>
        <button type="button" class="ivs-link" data-loan-edit="${esc(l.id)}">Edit</button></header>
      <div class="biz-bar" role="img" aria-label="${l.emis_paid} of ${l.tenure_months} EMIs paid"><i style="width:${p}%"></i></div>
      <div class="biz-facts">
        <div><span>EMI</span><b>${rr(l.emi_paise)}</b></div>
        <div><span>EMIs paid</span><b>${l.emis_paid} of ${l.tenure_months}</b></div>
        <div><span>Still owed</span><b>${rr(l.outstanding_paise)}</b></div>
        <div><span>Interest paid so far</span><b>${rr(l.interest_paid_paise)}</b></div>
        <div><span>Total interest</span><b>${rr(l.interest_total_paise)}</b></div>
        <div><span>${done ? 'Finished' : 'Next EMI'}</span><b>${done ? esc(fmtDate(l.closed_on || l.last_emi_on)) : esc(fmtDate(l.next_emi_on))}</b></div>
      </div>
      ${!done ? `<div class="ns-muted" style="font-size:12.5px">Last EMI ${esc(fmtDate(l.last_emi_on))} · ${rr(l.interest_left_paise)} interest still to pay. Reminder in your bell 3 days before each EMI.</div>` : ''}</article>`;
  }).join('');
  return `<section class="ns-card ivs-card" aria-labelledby="biz-loans-h">
    <div class="ivs-head"><h2 id="biz-loans-h" class="ns-h3" style="margin:0;font-size:19px">Loans &amp; EMIs</h2><button type="button" class="ns-btn" style="height:36px" data-loan-new>+ Add loan</button></div>
    ${items.length ? `<div class="biz-sum"><div><span>Still owed</span><b>${rr(L.owed_paise)}</b></div><div><span>EMIs every month</span><b>${rr(L.emi_month_paise)}</b></div>
      <div><span>Interest paid so far</span><b>${rr(items.reduce((a, x) => a + x.interest_paid_paise, 0))}</b></div></div>${rows}
      <label class="biz-check"><input type="checkbox" id="biz-emi-exp" ${B.profile.emi_in_expenses ? 'checked' : ''}> I already enter my EMIs in Expenses (then interest isn’t counted twice in payback)</label>`
      : '<div class="ns-empty">Add your loan to see what you still owe, the real interest cost and your payback after interest.</div>'}
  </section>`;
}

function partnersCard(B, ctx) {
  const P = B.partners; const items = P.items;
  const statement = (x) => `${ctx.property_name} — partner statement (${monthYear(B.today)})\n${x.name}: ${pct(x.share_pct)} share\nInvested: ${rr(x.invested_paise)}\nProfit share so far (after loan interest): ${rr(x.profit_share_paise)}\nPaid out: ${rr(x.paid_out_paise)}\nBalance due: ${rr(x.profit_share_paise - x.paid_out_paise)}\n— from NammaStay`;
  const rows = items.map((x) => {
    const bal = x.profit_share_paise - x.paid_out_paise;
    return `<tr><td><b>${esc(x.name)}</b>${x.is_me ? ' <span class="ivs-pill ivs-pill-grey">you</span>' : ''}<div class="ns-muted" style="font-size:12px">${pct(x.share_pct)} share</div></td>
      <td style="text-align:right">${rr(x.invested_paise)}</td><td style="text-align:right">${rr(x.profit_share_paise)}</td><td style="text-align:right">${rr(x.paid_out_paise)}</td>
      <td style="text-align:right;font-weight:800;color:${bal > 0 ? '#0A5C40' : '#101A3D'}">${rr(bal)}</td>
      <td style="white-space:nowrap;text-align:right"><button type="button" class="ivs-link" data-payout="${esc(x.id)}">Pay out</button>
        ${!x.is_me && x.phone ? `<a class="ivs-link" href="${esc(wa(x.phone, statement(x)))}" target="_blank" rel="noopener">Send statement</a>` : ''}
        <button type="button" class="ivs-link" data-partner-edit="${esc(x.id)}">Edit</button></td></tr>`;
  }).join('');
  const recent = items.flatMap((x) => x.payouts.map((po) => ({ ...po, who: x.name }))).sort((a, b) => String(b.paid_on).localeCompare(String(a.paid_on))).slice(0, 6);
  return `<section class="ns-card ivs-card" aria-labelledby="biz-p-h">
    <div class="ivs-head"><h2 id="biz-p-h" class="ns-h3" style="margin:0;font-size:19px">Partners</h2>
      <span style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="ns-btn-ghost" style="height:36px" data-partner-new>+ Add partner</button>${items.length ? '<button type="button" class="ns-btn" style="height:36px" data-payout="">Record payout</button>' : ''}</span></div>
    ${items.length ? `<div style="overflow-x:auto"><table class="ivs-table biz-table"><thead><tr><th>Partner</th><th style="text-align:right">Invested</th><th style="text-align:right">Profit share so far</th><th style="text-align:right">Paid out</th><th style="text-align:right">Balance</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="ns-muted" style="font-size:12.5px">Profit share = each partner’s % of the profit since opening, after loan interest. Shares add up to ${pct(P.total_share)}.${P.unassigned_paise ? ` ${rr(P.unassigned_paise)} of investments isn’t linked to anyone — add yourself as a partner, or mark who paid in Payback → What you invested.` : ''}</div>
      ${recent.length ? `<div class="biz-payouts"><b style="font-size:13px">Recent payouts</b>${recent.map((po) => `<div><span>${esc(fmtDate(po.paid_on))} · ${esc(po.who)}${po.note ? ' · ' + esc(po.note) : ''}</span><span><b>${rr(po.amount_paise)}</b> <button type="button" class="ivs-link" data-payout-del="${esc(po.id)}" aria-label="Delete payout">✕</button></span></div>`).join('')}</div>` : ''}`
      : '<div class="ns-empty">Add yourself and your partners with their profit share. Everyone sees what they put in, what they earned and what was paid out.</div>'}
  </section>`;
}

function leaseCard(B) {
  const L = B.lease;
  if (!L) return `<section class="ns-card ivs-card" aria-labelledby="biz-l-h"><div class="ivs-head"><h2 id="biz-l-h" class="ns-h3" style="margin:0;font-size:19px">Lease</h2>
    <button type="button" class="ns-btn" style="height:36px" data-lease-edit>+ Add lease</button></div>
    <div class="ns-empty">Add your lease dates and rent. We’ll compare your break-even with the lease end and remind you before renewal, rent increases and the notice deadline.</div></section>`;
  const P = B.payback; const T = (d) => new Date(d + 'T00:00:00Z').getTime();
  const span = T(L.end_on) - T(L.start_on); const at = (d) => Math.max(0, Math.min(100, ((T(d) - T(L.start_on)) / span) * 100));
  const be = P.real_breakeven && P.real_breakeven !== 'done' ? P.real_breakeven + '-01' : null;
  const marks = [[B.today, 'Today', 'today'], ...(L.lock_in_until ? [[L.lock_in_until, 'Lock-in ends', 'lock']] : []), ...(L.notice_by ? [[L.notice_by, 'Notice by', 'notice']] : []),
    ...(be ? [[be, 'Break-even', 'be']] : [])].filter(([d]) => d >= L.start_on);
  const V = { ok: ['biz-ok', 'You break even well before the lease ends.', `Break-even around ${monthYear(P.real_breakeven)} · lease ends ${monthYear(L.end_on)}.`],
    tight: ['biz-tight', 'Break-even comes close to the lease end.', `Break-even around ${monthYear(P.real_breakeven)}, lease ends ${monthYear(L.end_on)}. Try to renew early for a longer term.`],
    risk: ['biz-risk', 'At this pace you break even after the lease ends.', `Break-even around ${monthYear(P.real_breakeven)} but the lease ends ${monthYear(L.end_on)}. Ask your landlord for a longer lease now — before you invest more.`],
    done: ['biz-ok', 'Your investment is already paid back.', 'Everything from here is profit — keep the lease going.'],
    unknown: ['biz-tight', 'Not enough profit history to compare yet.', 'After a few months of profit we can tell you if you break even before the lease ends.'] }[L.verdict] || null;
  return `<section class="ns-card ivs-card" aria-labelledby="biz-l-h">
    <div class="ivs-head"><h2 id="biz-l-h" class="ns-h3" style="margin:0;font-size:19px">Lease${L.landlord ? ` <span class="ns-muted" style="font-size:14px;font-weight:600">· ${esc(L.landlord)}</span>` : ''}</h2><button type="button" class="ivs-link" data-lease-edit>Edit</button></div>
    ${V ? `<div class="biz-verdict ${V[0]}"><b>${esc(V[1])}</b><span>${esc(V[2])}</span></div>` : ''}
    <div class="biz-time" role="img" aria-label="Lease from ${esc(fmtDate(L.start_on))} to ${esc(fmtDate(L.end_on))}">
      <div class="biz-time-bar"><i style="width:${at(B.today)}%"></i>${marks.map(([d, , k]) => `<span class="biz-tk biz-tk-${k}" style="left:${at(d)}%"></span>`).join('')}</div>
      <div class="biz-time-ends"><span>${esc(fmtDate(L.start_on))}</span><span>Lease ends ${esc(fmtDate(L.end_on))}</span></div>
      <div class="biz-legend">${marks.map(([d, label, k]) => `<span><i class="biz-tk-${k}"></i>${esc(label)} · ${esc(k === 'be' ? '~' + monthYear(d) : fmtDate(d))}</span>`).join('')}
        ${be && be > L.end_on ? '<span class="biz-legend-warn">Break-even falls after the lease ends</span>' : ''}</div></div>
    <div class="biz-facts">
      <div><span>Time left</span><b>${L.ended ? 'Ended' : yearsMonths(L.months_left)}</b></div>
      <div><span>Rent now</span><b>${rr(L.rent_now_paise)}<small> / month</small></b></div>
      <div><span>Next increase</span><b>${L.next_increase_on ? `${esc(fmtDate(L.next_increase_on))} → ${rr(L.next_rent_paise)}` : '—'}</b></div>
      <div><span>Rent still to pay</span><b>${rr(L.rent_to_end_paise)}</b></div>
      <div><span>Deposit</span><b>${rr(L.deposit_paise)}</b></div>
      <div><span>Notice / lock-in</span><b>${L.notice_months ? pl(L.notice_months, 'month') + ' notice' : 'No notice'}${L.lock_in_months ? ' · ' + pl(L.lock_in_months, 'month') + ' lock-in' : ''}</b></div>
    </div>
    <div class="ns-muted" style="font-size:12.5px">Reminders in your bell 180, 90 and 30 days before the lease ends, before each rent increase and before the notice deadline.</div>
  </section>`;
}
