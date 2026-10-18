// Demo mode only — Company (040): NammaStay's own business numbers, mirrored in the browser.
// Uses its own sample customer history (56 properties that have paid, about 49 paying now) so the page looks real;
// costs, money put in, founders, other income, cash and renewals are editable and kept in the demo data.
export const COMPANY_FUNCTIONS = ['company_summary', 'company_health', 'company_profile_save', 'company_founder_save', 'company_founder_delete',
  'company_investment_save', 'company_investment_delete', 'company_cost_save', 'company_cost_delete', 'company_income_save', 'company_income_delete',
  'company_renewal_save', 'company_renewal_done', 'company_renewal_delete', 'company_badge'];

const DAY = 864e5;
const iso = (d) => new Date(d).toISOString().slice(0, 10);
const todayStr = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);   // India date
const monthOf = (d) => d.slice(0, 7) + '-01';
const addM = (d, n) => { const t = new Date(d.slice(0, 10) + 'T12:00:00Z'); t.setUTCMonth(t.getUTCMonth() + n); return iso(t); };
const addD = (d, n) => iso(new Date(d.slice(0, 10) + 'T12:00:00Z').getTime() + n * DAY);
const diffD = (a, b) => Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / DAY);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'x' + Math.random().toString(16).slice(2) + Date.now().toString(16));
const CATS = ['salaries', 'marketing', 'servers', 'tools', 'office', 'compliance', 'other'];
const KINDS = ['gst', 'tds', 'roc', 'itr', 'domain', 'ssl', 'trademark', 'server', 'licence', 'other'];
const PLANS = [{ price: 399900, months: 1 }, { price: 399900, months: 1 }, { price: 399900, months: 1 }, { price: 2799900, months: 12 }, { price: 199900, months: 1 }];

function seed() {
  const t = todayStr(); const m0 = monthOf(t);
  // customers: when each first paid (more every month), which plan, and whether / when they stopped
  const customers = []; let k = 0;
  const perMonth = [2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 4];                     // 12 months ago … this month
  perMonth.forEach((n, i) => { const mStart = addM(m0, i - 11);
    for (let j = 0; j < n; j++) { const day = Math.min(27, 2 + Math.round((j + 1) * (24 / (n + 1)))); let first = addD(mStart, day - 1);
      if (first > t) first = addD(t, -1 - j);
      customers.push({ first, plan: PLANS[k % PLANS.length], ended: null }); k += 1; } });
  // 9 stopped paying over the year (one in the last 30 days)
  [2, 4, 7, 9, 13, 17, 22, 26].forEach((i) => { const c = customers[i]; if (c && c.plan.months === 1) c.ended = addM(c.first, 3 + (i % 3)); });
  const recent = customers.find((c, i) => i > 30 && c.plan.months === 1 && !c.ended); if (recent) recent.ended = addD(t, -12);
  customers.forEach((c) => { if (c.ended && c.ended > t) c.ended = null; });
  const started = addM(m0, -11);
  const me = uid();
  return {
    customers,
    profile: { started_on: started, cash_paise: 46000000, cash_updated_on: addD(t, -6), runway_goal_months: 6 },
    founders: [{ id: me, name: 'Sureeth', role: 'Founder & CEO', share_pct: 100, is_me: true }],
    investments: [{ id: uid(), made_on: addD(started, 3), amount_paise: 60000000, source: 'founder', founder_id: me, note: 'Seed money' },
      { id: uid(), made_on: addD(started, 3), amount_paise: 36000000, source: 'founder', founder_id: me, note: 'Laptop, design & first servers' },
      { id: uid(), made_on: addM(started, 5), amount_paise: 24000000, source: 'founder', founder_id: me, note: 'Marketing push' }],
    costs: [
      { id: uid(), name: 'Developer & support salaries', category: 'salaries', every: 'month', amount_paise: 6000000, starts_on: addM(m0, -4), ends_on: null, note: null },
      { id: uid(), name: 'Part-time developer', category: 'salaries', every: 'month', amount_paise: 1500000, starts_on: started, ends_on: addD(addM(m0, -4), -1), note: 'Before full-time hires' },
      { id: uid(), name: 'Google & Instagram ads', category: 'marketing', every: 'month', amount_paise: 2500000, starts_on: addM(m0, -5), ends_on: null, note: null },
      { id: uid(), name: 'Supabase, hosting & WhatsApp API', category: 'servers', every: 'month', amount_paise: 1200000, starts_on: started, ends_on: null, note: null },
      { id: uid(), name: 'Design, email & office tools', category: 'tools', every: 'year', amount_paise: 9600000, starts_on: started, ends_on: null, note: null },
      { id: uid(), name: 'Co-working desk & travel', category: 'office', every: 'month', amount_paise: 700000, starts_on: addM(m0, -3), ends_on: null, note: null },
      { id: uid(), name: 'Company registration & CA', category: 'compliance', every: 'once', amount_paise: 1850000, starts_on: addD(started, 10), ends_on: null, note: null },
    ],
    income: [{ id: uid(), received_on: addD(t, -40), amount_paise: 1500000, source: 'Setup & training — Hotel Arya', note: null },
      { id: uid(), received_on: addD(t, -95), amount_paise: 1000000, source: 'Website for a homestay', note: null }],
    renewals: [
      { id: uid(), kind: 'gst', title: 'GSTR-3B (pay GST)', due_on: addD(t, 5), repeat: 'month', amount_paise: null, done_on: null, note: 'CA files it' },
      { id: uid(), kind: 'gst', title: 'GSTR-1 (sales return)', due_on: addD(t, 26), repeat: 'month', amount_paise: null, done_on: null, note: null },
      { id: uid(), kind: 'roc', title: 'ROC: AOC-4 (accounts)', due_on: addD(t, 46), repeat: 'year', amount_paise: 300000, done_on: null, note: null },
      { id: uid(), kind: 'domain', title: 'Domain thenammastay.com', due_on: addD(t, 89), repeat: 'year', amount_paise: 99900, done_on: null, note: null },
      { id: uid(), kind: 'trademark', title: 'Trademark “NammaStay”', due_on: null, repeat: 'none', amount_paise: 450000, done_on: null, note: 'Application filed — waiting for exam report' },
    ],
    snaps: [62, 64, 63, 67, 69, 68, 71].map((score, i) => ({ week: addD(weekStart(t), -7 * (7 - i)), score })),
  };
}
function weekStart(d) { const t = new Date(d + 'T12:00:00Z'); const wd = (t.getUTCDay() + 6) % 7; return addD(d, -wd); }

// money from subscriptions: one payment per paid period
function payments(c, t) {
  const out = []; let d = c.first;
  while (d <= t && (!c.ended || d < c.ended)) { out.push({ on: d, paise: c.plan.price }); d = addM(d, c.plan.months); }
  return out;
}
function payingAt(C, at) {   // paying properties and MRR on a day
  let mrr = 0; let n = 0;
  C.customers.forEach((c) => { if (c.first <= at && (!c.ended || c.ended > at)) { n += 1; mrr += c.plan.price / c.plan.months; } });
  return { mrr: Math.round(mrr), paying: n };
}
function monthCosts(C, m) {
  const end = addD(addM(m, 1), -1); let s = 0;
  C.costs.forEach((c) => {
    if (c.every === 'once') { if (monthOf(c.starts_on) === m) s += c.amount_paise; return; }
    if (c.starts_on <= end && (!c.ends_on || c.ends_on >= m)) s += c.every === 'month' ? c.amount_paise : Math.round(c.amount_paise / 12);
  });
  return s;
}
function renewalsOut(C) {
  const t = todayStr();
  return C.renewals.map((r) => ({ ...r, days_left: r.due_on ? diffD(t, r.due_on) : null,
    state: r.done_on ? 'done' : !r.due_on ? 'pending' : r.due_on < t ? 'overdue' : diffD(t, r.due_on) <= 7 ? 'soon' : 'ok' }))
    .sort((a, b) => (!!a.done_on - !!b.done_on) || ((a.due_on || '9999') < (b.due_on || '9999') ? -1 : (a.due_on || '9999') > (b.due_on || '9999') ? 1 : a.title.localeCompare(b.title)));
}

function summary(C) {
  const t = todayStr(); const m0 = monthOf(t);
  const now = payingAt(C, t); const prev = payingAt(C, addD(t, -30));
  const invested = C.investments.reduce((s, x) => s + x.amount_paise, 0);
  const firstDates = [C.profile.started_on && monthOf(C.profile.started_on), ...C.investments.map((x) => monthOf(x.made_on)), ...C.costs.map((x) => monthOf(x.starts_on)), ...C.customers.map((x) => monthOf(x.first))].filter(Boolean).sort();
  let start = C.profile.started_on ? monthOf(C.profile.started_on) : firstDates[0] || m0; if (start > m0) start = m0;
  const months = [];
  for (let m = start; m <= m0; m = addM(m, 1)) {
    const sub = C.customers.reduce((s, c) => s + payments(c, t).filter((p) => monthOf(p.on) === m).reduce((a, p) => a + p.paise, 0), 0);
    const oth = C.income.filter((i) => monthOf(i.received_on) === m).reduce((s, i) => s + i.amount_paise, 0);
    const cost = monthCosts(C, m);
    months.push({ month: m.slice(0, 7), income_paise: sub + oth, subscriptions_paise: sub, other_paise: oth, costs_paise: cost, profit_paise: sub + oth - cost });
  }
  const cum = months.reduce((s, x) => s + x.profit_paise, 0);
  const full = months.filter((x) => x.month + '-01' < m0).slice(-3);
  let pace = full.length ? Math.round(full.reduce((s, x) => s + x.profit_paise, 0) / full.length) : null;
  const other3 = months.filter((x) => x.month + '-01' < m0 && x.month + '-01' >= addM(m0, -3)).reduce((s, x) => s + x.other_paise, 0);
  const running = C.costs.filter((c) => c.every !== 'once' && c.starts_on <= t && (!c.ends_on || c.ends_on >= t));
  const costsNow = running.reduce((s, c) => s + (c.every === 'month' ? c.amount_paise : Math.round(c.amount_paise / 12)), 0);
  const profitNow = now.mrr + Math.round(other3 / 3) - costsNow;
  if (pace == null) pace = profitNow;
  const left = Math.max(invested - Math.max(cum, 0), 0);
  const best = Math.max(pace, profitNow);
  const be = invested > 0 && left === 0 ? t : left > 0 && best > 0 ? addM(m0, Math.ceil(left / best)) : null;
  const runway = profitNow >= 0 || C.profile.cash_paise == null ? null : Math.round((C.profile.cash_paise / -profitNow) * 10) / 10;
  const firsts = C.customers.map((c) => c.first).sort();
  const split = {}; running.forEach((c) => { split[c.category] = (split[c.category] || 0) + (c.every === 'month' ? c.amount_paise : Math.round(c.amount_paise / 12)); });
  const mkt90 = C.costs.filter((c) => c.category === 'marketing').reduce((s, c) => {
    if (c.every === 'once') return s + (c.starts_on > addD(t, -90) ? c.amount_paise : 0);
    const from = c.starts_on > addD(t, -90) ? c.starts_on : addD(t, -90); const to = c.ends_on && c.ends_on < t ? c.ends_on : t;
    const per = c.every === 'month' ? c.amount_paise : c.amount_paise / 12;
    return s + per * Math.max(0, Math.min(3, (diffD(from, to) + 1) / 30));
  }, 0);
  const new90 = firsts.filter((f) => f > addD(t, -90)).length;
  const srv = split.servers || 0;
  return {
    profile: { started_on: C.profile.started_on, counted_from: start, cash_paise: C.profile.cash_paise, cash_updated_on: C.profile.cash_updated_on, runway_goal_months: C.profile.runway_goal_months },
    gst_registered: false,
    income: { mrr_paise: now.mrr, mrr_net_paise: now.mrr, mrr_prev_net_paise: prev.mrr, other_avg_paise: Math.round(other3 / 3) },
    customers: { paying: now.paying, paying_prev: prev.paying, trials: 9, new_this_month: firsts.filter((f) => f >= m0).length,
      new_30d: firsts.filter((f) => f > addD(t, -30)).length, new_90d: new90,
      churned_30d: C.customers.filter((c) => c.ended && c.ended > addD(t, -30)).length },
    run_rate: { income_paise: now.mrr + Math.round(other3 / 3), costs_paise: costsNow, profit_paise: profitNow },
    payback: { invested_paise: invested, recovered_paise: Math.min(Math.max(cum, 0), invested), profit_so_far_paise: cum, left_paise: left, pace_paise: pace,
      pct: invested > 0 ? Math.min(100, Math.floor((Math.max(cum, 0) * 100) / invested)) : 0, break_even_on: be },
    runway: { self_funding: profitNow >= 0, months: runway, burn_paise: Math.max(-profitNow, 0), cash_paise: C.profile.cash_paise, goal_months: C.profile.runway_goal_months },
    months: months.slice(-12),
    milestones: [1, 10, 25, 50, 100, 250, 500, 1000].map((target) => ({ target, reached_on: firsts[target - 1] || null, kind: 'properties' })),
    costs: C.costs.filter((c) => c.every !== 'once' || c.starts_on > addD(t, -365)).map((c) => ({ ...c, running: c.every !== 'once' && c.starts_on <= t && (!c.ends_on || c.ends_on >= t) }))
      .sort((a, b) => (Number(b.every !== 'once' && (!b.ends_on || b.ends_on >= t)) - Number(a.every !== 'once' && (!a.ends_on || a.ends_on >= t))) || a.category.localeCompare(b.category) || b.amount_paise - a.amount_paise),
    cost_split: Object.entries(split).map(([category, monthly_paise]) => ({ category, monthly_paise })).sort((a, b) => b.monthly_paise - a.monthly_paise),
    income_list: C.income.filter((i) => i.received_on > addD(t, -365)).slice().sort((a, b) => (a.received_on < b.received_on ? 1 : -1)),
    investments: C.investments.map((x) => ({ ...x, founder: C.founders.find((f) => f.id === x.founder_id)?.name || null })).sort((a, b) => (a.made_on < b.made_on ? 1 : -1)),
    founders: C.founders.map((f) => ({ ...f, invested_paise: C.investments.filter((x) => x.founder_id === f.id).reduce((s, x) => s + x.amount_paise, 0) }))
      .sort((a, b) => (b.is_me - a.is_me) || (b.share_pct - a.share_pct)),
    renewals: renewalsOut(C),
    unit: { arpu_paise: now.paying ? Math.round(now.mrr / now.paying) : null, cost_per_property_paise: now.paying ? Math.round(costsNow / now.paying) : null,
      server_per_property_paise: now.paying ? Math.round(srv / now.paying) : null, cac_paise: new90 ? Math.round(mkt90 / new90) : null,
      cac_payback_months: new90 && now.paying && now.mrr ? Math.round(((mkt90 / new90) / (now.mrr / now.paying)) * 10) / 10 : null, marketing_90d_paise: Math.round(mkt90) },
  };
}

const area = (key, status, value, detail, todo, link) => ({ key, status, value, detail, todo: todo || null, link, score: status === 'good' ? 100 : status === 'watch' ? 60 : status === 'act' ? 20 : null });
function health(C, DB) {
  const s = summary(C); const t = todayStr(); const a = [];
  const mrr = s.income.mrr_net_paise; const prev = s.income.mrr_prev_net_paise;
  if (!mrr && !prev) a.push(area('growth', null, null, 'No paying properties yet.', 'Get your first paying property.', 'leads.html'));
  else { const g = prev > 0 ? Math.round(((mrr - prev) * 1000) / prev) / 10 : 100;
    a.push(area('growth', g >= 5 ? 'good' : g >= 0 ? 'watch' : 'act', `${g >= 0 ? '+' : ''}${g}%`, 'Monthly income now vs 30 days ago (target: 5%+ a month).',
      g < 0 ? 'Monthly income went down — call properties that stopped paying.' : g < 5 ? 'Growth is slow — follow up your open leads this week.' : null, g < 0 ? 'subscribers.html' : 'leads.html')); }
  const ch = s.customers.churned_30d; const pay = s.customers.paying;
  if (pay + ch === 0) a.push(area('churn', null, null, 'No paying properties yet.', null, 'subscribers.html'));
  else { const r = Math.round((ch * 1000) / (pay + ch)) / 10;
    a.push(area('churn', r <= 3 ? 'good' : r <= 7 ? 'watch' : 'act', `${ch} left · ${r}%`, 'Properties whose paid period ended in the last 30 days without renewing (target: 3% or less).',
      r > 3 ? `Call the ${ch} that left — ask why, offer help or a coupon.` : null, 'subscribers.html')); }
  a.push(area('conversion', 'good', '36% (8 of 22)', 'Trials from the last 90 days that went on to pay (target: 30%+).', null, 'admin.html'));
  a.push(area('activation', 'watch', '67% (6 of 9)', 'New properties (1–8 weeks old) that have added at least one booking (target: 70%+).', '3 new properties have no bookings yet — offer a setup call.', 'admin.html'));
  const quiet = 3; const qp = pay ? Math.round((quiet * 100) / pay) : 0;
  a.push(pay ? area('inactive', qp <= 10 ? 'good' : qp <= 25 ? 'watch' : 'act', `${quiet} of ${pay}`, 'Paying properties that haven’t added a booking in 14 days (target: 10% or less). Quiet customers leave next.',
    qp > 10 ? `Check on the ${quiet} quiet properties before renewal time.` : null, 'admin.html') : area('inactive', null, null, 'No paying properties yet.', null, 'admin.html'));
  const pend = (DB.billing?.pending || []).length;
  a.push(area('collections', pend === 0 ? 'good' : pend <= 1 ? 'watch' : 'act', pend ? `${pend} to review · 0 past due` : 'All clear',
    'Payments owners sent that you haven’t checked for 2+ days, and properties past their paid date.', pend ? `Review ${pend} payment${pend === 1 ? '' : 's'} waiting more than 2 days.` : null, 'subscribers.html'));
  const goal = s.runway.goal_months;
  if (!C.costs.length) a.push(area('runway', null, null, 'Add your monthly costs to see runway.', 'Add your monthly costs (salaries, servers, tools…).', 'company.html#costs'));
  else if (s.runway.self_funding) a.push(area('runway', 'good', 'Self-funding', 'Income covers costs every month.', null, 'company.html'));
  else if (s.runway.months == null) a.push(area('runway', null, null, 'Spending more than earning — enter cash in bank to see how long it lasts.', 'Enter cash in bank to see your runway.', 'company.html#cash'));
  else { const mo = s.runway.months;
    a.push(area('runway', mo >= goal ? 'good' : mo >= 3 ? 'watch' : 'act', `${mo} months`, `How long cash in bank lasts at today’s monthly loss (goal: ${goal} months).`,
      mo < goal ? `Cut a cost or raise money — under ${goal} months of cash left.` : null, 'company.html')); }
  const open = C.renewals.filter((r) => !r.done_on); const over = open.filter((r) => r.due_on && r.due_on < t).length;
  const soon = open.filter((r) => r.due_on && r.due_on >= t && diffD(t, r.due_on) <= 7).length;
  if (!open.length) a.push(area('filings', null, null, 'No filings or renewals added yet.', 'Add GST, ROC, domain and other due dates.', 'company.html#renewals'));
  else a.push(area('filings', over ? 'act' : soon ? 'watch' : 'good', over ? `${over} overdue` : soon ? `${soon} due this week` : 'All on time',
    'GST, TDS, ROC, income tax, domain, trademark and other due dates you added.',
    over ? `File or renew the ${over} overdue item${over === 1 ? '' : 's'} — late fees add up.` : soon ? `${soon} due within 7 days — keep the documents ready.` : null, 'company.html#renewals'));
  const scored = a.filter((x) => x.status); const score = scored.length ? Math.round(scored.reduce((x, y) => x + y.score, 0) / scored.length) : null;
  const wk = weekStart(t);
  if (score != null) { const ex = C.snaps.find((x) => x.week === wk); if (ex) ex.score = score; else C.snaps.push({ week: wk, score }); }
  const last = C.snaps.filter((x) => x.week < wk).sort((x, y) => (x.week < y.week ? -1 : 1)).pop();
  const cnt = (st) => a.filter((x) => x.status === st).length;
  return { score, verdict: score == null ? null : score >= 75 ? 'healthy' : score >= 50 ? 'attention' : 'risk', last_week: last ? last.score : null, areas: a,
    history: C.snaps.slice().sort((x, y) => (x.week < y.week ? -1 : 1)).slice(-12), counts: { good: cnt('good'), watch: cnt('watch'), act: cnt('act'), nodata: a.filter((x) => !x.status).length } };
}

const txt = (v) => String(v ?? '').trim();
const num = (v) => (v === '' || v == null ? null : Number(v));
export function companyDemo(name, args, { DB, fail }) {
  if (!DB.company || !DB.company.customers) DB.company = seed();
  const C = DB.company; const p = args?.p || {}; const t = todayStr();
  const save = (list, row, notFound) => { if (p.id) { const ex = C[list].find((x) => x.id === p.id); if (!ex) fail(notFound); Object.assign(ex, row); return ex.id; } const id = uid(); C[list].push({ id, ...row }); return id; };
  const del = (list) => { C[list] = C[list].filter((x) => x.id !== args.p_id); return null; };
  switch (name) {
    case 'company_summary': return summary(C);
    case 'company_health': return health(C, DB);
    case 'company_badge': return C.renewals.filter((r) => !r.done_on && r.due_on && diffD(t, r.due_on) <= 7).length;
    case 'company_profile_save': {
      const cash = num(p.cash_paise); const goal = num(p.runway_goal_months) || 6; const st = txt(p.started_on) || null;
      if (st && st > t) fail('The start date can’t be in the future.');
      if (goal < 1 || goal > 36) fail('Runway goal: between 1 and 36 months.');
      if (cash != null && cash < 0) fail('Cash in bank can’t be negative.');
      if (cash !== C.profile.cash_paise) C.profile.cash_updated_on = cash == null ? null : t;
      Object.assign(C.profile, { started_on: st, cash_paise: cash, runway_goal_months: goal }); return null;
    }
    case 'company_founder_save': {
      const share = num(p.share_pct) || 0; const nm = txt(p.name);
      if (nm.length < 2) fail('Enter the founder’s name.');
      if (share < 0 || share > 100) fail('Share: between 0 and 100%.');
      if (p.is_me && C.founders.some((f) => f.is_me && f.id !== p.id)) fail('You are already in the list.');
      const other = C.founders.filter((f) => f.id !== p.id).reduce((s, f) => s + Number(f.share_pct), 0);
      if (other + share > 100) fail(`Shares would add up to ${other + share}%. Keep the total at 100% or less.`);
      return save('founders', { name: nm, role: txt(p.role) || null, share_pct: share, is_me: !!p.is_me }, 'Founder not found.');
    }
    case 'company_founder_delete': C.investments.forEach((x) => { if (x.founder_id === args.p_id) x.founder_id = null; }); return del('founders');
    case 'company_investment_save': {
      const amt = num(p.amount_paise); const on = txt(p.made_on);
      if (!amt || amt < 100) fail('Enter the amount.'); if (!on) fail('Pick the date.'); if (on > t) fail('The date can’t be in the future.');
      return save('investments', { made_on: on, amount_paise: amt, source: p.source || 'founder', founder_id: p.founder_id || null, note: txt(p.note) || null }, 'Entry not found.');
    }
    case 'company_investment_delete': return del('investments');
    case 'company_cost_save': {
      const amt = num(p.amount_paise); const from = txt(p.starts_on); const every = p.every || 'month'; const to = every === 'once' ? null : txt(p.ends_on) || null;
      if (txt(p.name).length < 2) fail('Give the cost a name, e.g. "Supabase".');
      if (!amt || amt < 100) fail('Enter the amount.'); if (!from) fail('Pick the start date.');
      if (to && to < from) fail('The stop date is before the start date.');
      if (!CATS.includes(p.category)) fail('Unknown category.');
      return save('costs', { name: txt(p.name), category: p.category, every, amount_paise: amt, starts_on: from, ends_on: to, note: txt(p.note) || null }, 'Cost not found.');
    }
    case 'company_cost_delete': return del('costs');
    case 'company_income_save': {
      const amt = num(p.amount_paise); const on = txt(p.received_on);
      if (txt(p.source).length < 2) fail('Where did the money come from? e.g. "Setup fee — Hotel Arya".');
      if (!amt || amt < 100) fail('Enter the amount.'); if (!on) fail('Pick the date.'); if (on > t) fail('The date can’t be in the future.');
      return save('income', { received_on: on, amount_paise: amt, source: txt(p.source), note: txt(p.note) || null }, 'Entry not found.');
    }
    case 'company_income_delete': return del('income');
    case 'company_renewal_save': {
      const rep = p.repeat || 'none'; const due = txt(p.due_on) || null;
      if (txt(p.title).length < 2) fail('Give it a name, e.g. "GSTR-3B".');
      if (!KINDS.includes(p.kind || 'other')) fail('Unknown type.');
      if (rep !== 'none' && !due) fail('A repeating item needs its next due date.');
      return save('renewals', { kind: p.kind || 'other', title: txt(p.title), due_on: due, repeat: rep, amount_paise: num(p.amount_paise), note: txt(p.note) || null,
        ...(p.id ? {} : { done_on: null }) }, 'Item not found.');
    }
    case 'company_renewal_done': {
      const r = C.renewals.find((x) => x.id === args.p_id) || fail('Item not found.');
      if (r.repeat !== 'none') r.due_on = addM(r.due_on, r.repeat === 'month' ? 1 : r.repeat === 'quarter' ? 3 : 12); else r.done_on = t;
      return { due_on: r.due_on, done_on: r.done_on };
    }
    case 'company_renewal_delete': return del('renewals');
    default: return fail(`Unknown function ${name}`);
  }
}
