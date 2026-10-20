// Demo mirror of My business (039_my_business.sql) — loans, partners, lease. Used only with ?demo=1.
const NAMES = ['biz_summary', 'biz_profile_save', 'biz_loan_save', 'biz_loan_delete', 'biz_partner_save', 'biz_partner_delete',
  'biz_investment_partner', 'biz_payout_save', 'biz_payout_delete', 'biz_lease_save'];
export const BIZ_FUNCTIONS = NAMES;

const addM = (d, n) => { const [y, m, day] = d.split('-').map(Number); const x = new Date(Date.UTC(y, m - 1 + n, 1)); const last = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).getUTCDate();
  x.setUTCDate(Math.min(day, last)); return x.toISOString().slice(0, 10); };
const monthsBetween = (a, b) => { const [y1, m1, d1] = a.split('-').map(Number); const [y2, m2, d2] = b.split('-').map(Number); let n = (y2 - y1) * 12 + (m2 - m1); if (d2 < d1) n--; return n; };
const R = (p) => '₹' + Math.round(p / 100).toLocaleString('en-IN');

export function loanCalc(l, today) {
  const r = l.rate_pct / 1200; const n = l.tenure_months; const p = l.principal_paise;
  const emi = l.emi_paise || (r === 0 ? p / n : p * r * (1 + r) ** n / ((1 + r) ** n - 1));
  const asof = l.closed_on && l.closed_on < today ? l.closed_on : today;
  let k = 0; for (let i = 0; i < n; i++) if (addM(l.first_emi_on, i) <= asof) k++;
  const f = (1 + r) ** k;
  const bal = r === 0 ? Math.max(p - emi * k, 0) : Math.max(p * f - emi * (f - 1) / r, 0);
  const paid = Math.max(emi * k - (p - bal), 0); const tot = Math.max(emi * n - p, 0);
  const closed = !!l.closed_on;
  return { id: l.id, lender: l.lender, principal_paise: p, rate_pct: l.rate_pct, tenure_months: n, emi_paise: Math.round(emi), emi_entered: !!l.emi_paise,
    first_emi_on: l.first_emi_on, closed_on: l.closed_on || null, note: l.note || null, emis_paid: k, emis_left: closed ? 0 : n - k,
    outstanding_paise: closed ? 0 : Math.round(bal), interest_paid_paise: Math.round(paid), interest_total_paise: Math.round(closed ? paid : tot),
    interest_left_paise: closed ? 0 : Math.round(Math.max(tot - paid, 0)), interest_this_month_paise: closed || k >= n ? 0 : Math.round(bal * r),
    next_emi_on: closed || k >= n ? null : addM(l.first_emi_on, k), last_emi_on: addM(l.first_emi_on, n - 1), done: closed || k >= n };
}
export function leaseCalc(b, today) {
  const steps = today < b.start_on ? 0 : Math.floor(monthsBetween(b.start_on, today) / b.increase_every_months);
  const rent = b.rent_paise * (1 + b.increase_pct / 100) ** steps;
  let next = addM(b.start_on, (steps + 1) * b.increase_every_months); if (next >= b.end_on || !b.increase_pct) next = null;
  const left = Math.max(monthsBetween(today, b.end_on), 0);
  let toEnd = 0; let d = (today > b.start_on ? today : b.start_on).slice(0, 8) + '01';
  while (d < b.end_on) { const s = Math.max(Math.floor(monthsBetween(b.start_on, d) / b.increase_every_months), 0); toEnd += b.rent_paise * (1 + b.increase_pct / 100) ** s; d = addM(d, 1); }
  return { landlord: b.landlord || null, start_on: b.start_on, end_on: b.end_on, rent_start_paise: b.rent_paise, increase_pct: b.increase_pct, increase_every_months: b.increase_every_months,
    deposit_paise: b.deposit_paise, lock_in_months: b.lock_in_months, notice_months: b.notice_months, note: b.note || null, rent_now_paise: Math.round(rent),
    next_increase_on: next, next_rent_paise: next ? Math.round(rent * (1 + b.increase_pct / 100)) : null,
    lock_in_until: b.lock_in_months ? addM(b.start_on, b.lock_in_months) : null, notice_by: b.notice_months ? addM(b.end_on, -b.notice_months) : null,
    months_left: left, days_left: Math.round((new Date(b.end_on) - new Date(today)) / 864e5), rent_to_end_paise: Math.round(toEnd), ended: b.end_on <= today };
}

export function bizDemo(fn, a, I) {
  const { DB, fail, uuid, ymd, investSummary } = I;
  if ((DB.viewAs || 'owner') !== 'owner') fail('You don’t have permission to do this.');
  const today = ymd();
  if (!DB.inv.biz) DB.inv.biz = seed();
  const Z = DB.inv.biz;

  function seed() {
    const open = DB.inv.opened_on;
    const z = { profile: { has_loan: true, has_partners: true, is_rented: true, emi_in_expenses: false }, loans: [], partners: [], payouts: [], lease: null, sent: [] };
    z.loans.push({ id: uuid(), lender: 'SBI', principal_paise: 80000000, rate_pct: 11, tenure_months: 60, emi_paise: null, first_emi_on: addM(open, 1), closed_on: null, note: 'Mudra / business loan' });
    const me = { id: uuid(), name: 'Me', phone: null, share_pct: 60, is_me: true, note: null };
    const ravi = { id: uuid(), name: 'Ravi', phone: '+919845011111', share_pct: 40, is_me: false, note: 'As per partnership deed' };
    z.partners.push(me, ravi);
    const beds = DB.inv.items.find((x) => /bed/i.test(x.title)); if (beds) beds.partner_id = ravi.id;
    const kit = DB.inv.items.find((x) => /kitchen/i.test(x.title)); if (kit) kit.partner_id = ravi.id;
    z.payouts.push({ id: uuid(), partner_id: ravi.id, amount_paise: 2500000, paid_on: addM(today, -2).slice(0, 8) + '05', note: 'Profit share by UPI' });
    z.payouts.push({ id: uuid(), partner_id: me.id, amount_paise: 3500000, paid_on: addM(today, -2).slice(0, 8) + '05', note: null });
    z.lease = { landlord: 'Mr. Rao', start_on: open, end_on: addM(open, 36), rent_paise: 4000000, increase_pct: 5, increase_every_months: 12, deposit_paise: 30000000, lock_in_months: 12, notice_months: 3, note: null };
    return z;
  }
  function remind(key, title, body) {
    if (Z.sent.includes(key)) return; Z.sent.push(key);
    DB.notifications.push({ id: uuid(), property_id: DB.properties[0].id, user_id: null, kind: 'my_business', title, body, booking_id: null, read_at: null, created_at: new Date().toISOString() });
  }
  function summary() {
    const S = investSummary(); const pr = Z.profile; const alerts = [];
    const loans = Z.loans.map((l) => loanCalc(l, today));
    let intPaid = loans.reduce((s, l) => s + l.interest_paid_paise, 0); let intMonth = loans.reduce((s, l) => s + l.interest_this_month_paise, 0);
    loans.forEach((l) => { if (l.next_emi_on) { const d = (new Date(l.next_emi_on) - new Date(today)) / 864e5;
      if (d >= 0 && d <= 3) remind(`emi:${l.id}:${l.next_emi_on}`, `EMI ${R(l.emi_paise)} due ${new Date(l.next_emi_on).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`, `${l.lender} loan — keep the money in the account.`);
      if (d >= 0 && d <= 7) alerts.push({ kind: 'emi', level: 'amber', text: `EMI of ${R(l.emi_paise)} to ${l.lender} due ${new Date(l.next_emi_on).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` }); } });
    if (pr.emi_in_expenses) { intPaid = 0; intMonth = 0; }
    const inv = S.invested_paise; const rec = S.recovered_paise; const real = rec - intPaid; const avg = S.avg3_paise;
    const ravg = avg == null ? null : avg - intMonth; const left = Math.max(inv - real, 0);
    const mleft = inv > 0 && left > 0 && ravg > 0 ? Math.ceil(left / ravg) : null;
    const be = inv > 0 && left === 0 ? 'done' : mleft != null ? addM(today.slice(0, 8) + '01', mleft).slice(0, 7) : null;
    let lease = null;
    if (Z.lease) {
      lease = leaseCalc(Z.lease, today);
      const end = Z.lease.end_on; const sixBefore = addM(end, -6);
      lease.verdict = be === 'done' ? 'done' : !be ? 'unknown' : be + '-01' <= sixBefore ? 'ok' : be + '-01' <= end ? 'tight' : 'risk';
      if (pr.is_rented !== false) {
        if (lease.days_left >= 0 && lease.days_left <= 180) alerts.push({ kind: 'lease', level: lease.days_left <= 60 ? 'red' : 'amber', text: `Lease ends in ${lease.days_left} days. Talk to your landlord about renewing.` });
        if (lease.verdict === 'risk') alerts.push({ kind: 'lease_payback', level: 'red', text: `At this pace you break even around ${new Date(be + '-01').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })} — after your lease ends (${new Date(end).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}). Ask for a longer lease now.` });
        if (lease.next_increase_on) { const d = (new Date(lease.next_increase_on) - new Date(today)) / 864e5; if (d >= 0 && d <= 60) alerts.push({ kind: 'rent_up', level: 'amber', text: `Rent goes up on ${new Date(lease.next_increase_on).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} to about ${R(lease.next_rent_paise)} a month.` }); }
      }
    }
    const total = Z.partners.reduce((s, p) => s + p.share_pct, 0); const hasMe = Z.partners.some((p) => p.is_me);
    const partners = Z.partners.map((p) => ({ ...p,
      invested_paise: DB.inv.items.filter((i) => i.partner_id === p.id || (p.is_me && !i.partner_id)).reduce((s, i) => s + i.amount_paise, 0),
      profit_share_paise: Math.round(Math.max(real, 0) * p.share_pct / 100),
      paid_out_paise: Z.payouts.filter((x) => x.partner_id === p.id).reduce((s, x) => s + x.amount_paise, 0),
      payouts: Z.payouts.filter((x) => x.partner_id === p.id).sort((x, y) => y.paid_on.localeCompare(x.paid_on)).slice(0, 24) }))
      .sort((x, y) => (y.is_me ? 1 : 0) - (x.is_me ? 1 : 0));
    if (partners.length && total !== 100) alerts.push({ kind: 'shares', level: 'amber', text: `Partner shares add up to ${total}% — they should make 100%.` });
    return { today, profile: { ...pr },
      payback: { invested_paise: inv, profit_paise: rec, interest_paid_paise: intPaid, real_recovered_paise: real, real_pct: inv > 0 ? Math.round(Math.max(real, 0) * 1000 / inv) / 10 : null,
        real_left_paise: left, avg3_paise: avg, interest_this_month_paise: intMonth, real_avg3_paise: ravg, real_months_left: mleft, real_breakeven: be, plain_breakeven: S.breakeven_month },
      loans: { items: loans, owed_paise: loans.reduce((s, l) => s + l.outstanding_paise, 0), emi_month_paise: loans.filter((l) => !l.done).reduce((s, l) => s + l.emi_paise, 0), interest_paid_paise: intPaid },
      partners: { items: partners, total_share: total, unassigned_paise: hasMe ? 0 : DB.inv.items.filter((i) => !i.partner_id).reduce((s, i) => s + i.amount_paise, 0),
        paid_by: Object.fromEntries(DB.inv.items.filter((i) => i.partner_id).map((i) => [i.id, i.partner_id])) },
      lease, alerts };
  }
  const p = a.p || {};
  switch (fn) {
    case 'biz_summary': return summary();
    case 'biz_profile_save': ['has_loan', 'has_partners', 'is_rented', 'emi_in_expenses'].forEach((k) => { if (k in p) Z.profile[k] = !!p[k]; }); return summary();
    case 'biz_loan_save': {
      if (String(p.lender || '').trim().length < 2) fail('Who gave the loan? (e.g. SBI, HDFC, family)');
      if (!(p.principal_paise >= 100)) fail('Enter the loan amount.');
      if (!(p.rate_pct >= 0 && p.rate_pct <= 60)) fail('Interest rate should be between 0 and 60% a year.');
      if (!(p.tenure_months >= 1 && p.tenure_months <= 360)) fail('Loan period: 1 to 360 months.');
      if (!p.first_emi_on) fail('When was (or is) the first EMI?');
      let l = p.id && Z.loans.find((x) => x.id === p.id); if (p.id && !l) fail('Loan not found.');
      if (!l) { l = { id: uuid() }; Z.loans.push(l); }
      Object.assign(l, { lender: p.lender.trim(), principal_paise: p.principal_paise, rate_pct: Number(p.rate_pct), tenure_months: Number(p.tenure_months), emi_paise: p.emi_paise || null,
        first_emi_on: p.first_emi_on, closed_on: p.closed_on || null, note: p.note || null });
      Z.profile.has_loan = true; return summary();
    }
    case 'biz_loan_delete': Z.loans = Z.loans.filter((x) => x.id !== a.p_id); return summary();
    case 'biz_partner_save': {
      if (String(p.name || '').trim().length < 2) fail('Enter the partner’s name.');
      const share = Number(p.share_pct); if (!(share > 0 && share <= 100)) fail('Profit share should be between 1 and 100%.');
      if (p.is_me && Z.partners.some((x) => x.is_me && x.id !== p.id)) fail('You are already in the list.');
      const other = Z.partners.filter((x) => x.id !== p.id).reduce((s, x) => s + x.share_pct, 0);
      if (other + share > 100) fail(`Shares would add up to ${other + share}%, more than 100%. Lower someone’s share first.`);
      let x = p.id && Z.partners.find((y) => y.id === p.id); if (p.id && !x) fail('Partner not found.');
      if (!x) { x = { id: uuid(), is_me: !!p.is_me }; Z.partners.push(x); }
      let ph = String(p.phone || '').replace(/[^0-9+]/g, ''); if (/^[6-9][0-9]{9}$/.test(ph)) ph = '+91' + ph;
      Object.assign(x, { name: p.name.trim(), phone: ph || null, share_pct: share, note: p.note || null });
      Z.profile.has_partners = true; return summary();
    }
    case 'biz_partner_delete': Z.partners = Z.partners.filter((x) => x.id !== a.p_id); Z.payouts = Z.payouts.filter((x) => x.partner_id !== a.p_id);
      DB.inv.items.forEach((i) => { if (i.partner_id === a.p_id) i.partner_id = null; }); return summary();
    case 'biz_investment_partner': { const it = DB.inv.items.find((x) => x.id === a.p_investment) || fail('Investment not found.'); it.partner_id = a.p_partner || null; return summary(); }
    case 'biz_payout_save': {
      if (!Z.partners.some((x) => x.id === p.partner_id)) fail('Choose the partner.');
      if (!(p.amount_paise >= 100)) fail('Enter the amount paid.');
      const on = p.paid_on || today; if (on > today) fail('The date can’t be in the future.');
      Z.payouts.push({ id: uuid(), partner_id: p.partner_id, amount_paise: p.amount_paise, paid_on: on, note: p.note || null }); return summary();
    }
    case 'biz_payout_delete': Z.payouts = Z.payouts.filter((x) => x.id !== a.p_id); return summary();
    case 'biz_lease_save': {
      if (!p.start_on || !p.end_on) fail('Enter when the lease started and when it ends.');
      if (p.end_on <= p.start_on) fail('The lease end must be after the start.');
      Z.lease = { landlord: p.landlord || null, start_on: p.start_on, end_on: p.end_on, rent_paise: p.rent_paise || 0, increase_pct: Number(p.increase_pct) || 0,
        increase_every_months: Number(p.increase_every_months) || 12, deposit_paise: p.deposit_paise || 0, lock_in_months: Number(p.lock_in_months) || 0, notice_months: Number(p.notice_months) || 0, note: p.note || null };
      Z.profile.is_rented = true; return summary();
    }
    default: fail('Unknown function ' + fn);
  }
  return null;
}
