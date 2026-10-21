// NammaStay admin — Company (040_company.sql): NammaStay's own business numbers. Platform admins only.
// Tab 1 "My company": payback, runway, milestones, money in vs costs, where the money goes, filings & renewals,
//                     founders & money put in, unit economics, other income.
// Tab 2 "Company health": one score from 8 areas, top things to do, weekly trend.
import { adminPage, rpc, content, setSubtitle, headerActions, esc, rupees, toPaise, fmtDate, ymd, modal, field, options, toast, confirmDialog, $, $$ } from '../core.js';

const I = (d, w = 20, sw = 2) => `<svg aria-hidden="true" width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const P = {
  check: '<path d="M20 6L9 17l-5-5"/>',
  coins: '<ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v4c0 1.7 2.7 3 6 3s6-1.3 6-3V7"/><path d="M9 14v3c0 1.7 2.7 3 6 3s6-1.3 6-3v-4c0-1.7-2.7-3-6-3"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  down: '<path d="M3 7l6 6 4-4 8 8"/><path d="M15 17h6v-6"/>',
  wallet: '<path d="M20 7H5a2 2 0 0 1 0-4h13v4"/><path d="M3 5v14a2 2 0 0 0 2 2h15V7"/><circle cx="16" cy="14" r="1.5"/>',
  receipt: '<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  home: '<path d="M3 10l9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
  star: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
  fuel: '<path d="M3 22V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v17"/><path d="M3 22h12M6 8h6"/><path d="M15 11h2a2 2 0 0 1 2 2v4a2 2 0 0 0 4 0V9l-3-3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  alert: '<path d="M12 8v5M12 16.5v.01"/><circle cx="12" cy="12" r="9"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  dash: '<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>',
  todo: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  pulse: '<path d="M3 12h4l2-5 4 10 2-5h6"/>',
  chart: '<path d="M4 19V10"/><path d="M12 19V5"/><path d="M20 19v-7"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c0-3.6 2.9-6.4 6.5-6.4s6.5 2.8 6.5 6.4"/><circle cx="18" cy="9" r="2.3"/><path d="M15.8 13.8c2.3.5 4.2 2.5 4.2 5.4"/>',
  calc: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 18h8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
};
// cost categories
const CAT = {
  salaries: ['Salaries', '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>', '#2D5FA6'],
  marketing: ['Marketing', '<path d="M3 11l15-6v14L3 13z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>', '#E2A03F'],
  servers: ['Servers & hosting', '<rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6.5h.01M7 17.5h.01"/>', '#1C9A6C'],
  tools: ['Software & tools', '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>', '#7B61C9'],
  office: ['Office & travel', '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>', '#C2412D'],
  compliance: ['CA, legal & fees', '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/>', '#0E7490'],
  other: ['Other', '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>', '#6B7280'],
};
const KIND = {
  gst: ['GST', P.receipt], tds: ['TDS', P.receipt], roc: ['ROC (MCA)', '<path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5"/>'], itr: ['Income tax', P.calc],
  domain: ['Domain', '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'],
  ssl: ['SSL / security', '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'],
  trademark: ['Trademark', '<circle cx="12" cy="12" r="9"/><path d="M8 9h4M10 9v6M13 15V9l2 3 2-3v6"/>'],
  server: ['Server / app plan', CAT.servers[1]], licence: ['Licence', P.todo], other: ['Other', P.flag],
};
const REPEAT = { none: 'One time', month: 'Every month', quarter: 'Every 3 months', year: 'Every year' };
const SOURCE = { founder: 'Founder', investor: 'Investor', loan: 'Loan', grant: 'Grant', other: 'Other' };
const AV = ['#1C9A6C', '#2D5FA6', '#E2A03F', '#7B61C9', '#C2412D', '#0E7490'];

const rr = (p) => rupees(Math.round(Number(p || 0) / 100) * 100);          // whole rupees
const short = (p) => { const r = Math.round(Number(p || 0) / 100); const a = Math.abs(r); const s = r < 0 ? '−' : '';
  return a >= 1e7 ? `${s}₹${(a / 1e7).toFixed(1).replace(/\.0$/, '')}Cr` : a >= 1e5 ? `${s}₹${(a / 1e5).toFixed(1).replace(/\.0$/, '')}L` : a >= 1000 ? `${s}₹${Math.round(a / 1000)}k` : `${s}₹${a}`; };
const mon = (m, year = false) => new Date(m.slice(0, 7) + '-01T12:00:00Z').toLocaleDateString('en-IN', { month: 'short', ...(year ? { year: 'numeric' } : {}), timeZone: 'UTC' }).replace('Sept', 'Sep');
const rupeeIn = (p) => (p == null || p === '' ? '' : String(Math.round(Number(p) / 100)));
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const today = () => ymd(new Date());

let S = null; let H = null; let tab = 'company';

adminPage(async () => {
  headerActions().innerHTML = `<button type="button" class="ns-btn-ghost" id="co-print">${I(P.receipt, 16)} Investor summary (PDF)</button>
    <button type="button" class="ns-btn" id="co-add-cost">+ Add cost</button>`;
  $('#co-add-cost').addEventListener('click', () => costDialog());
  $('#co-print').addEventListener('click', async () => { if (tab !== 'company') { tab = 'company'; await draw(); } setTimeout(() => window.print(), 50); });
  window.addEventListener('hashchange', () => fromHash(true));
  fromHash(false);
  await draw();
  afterHash();
});

function fromHash(redraw) {
  const h = location.hash.replace('#', '');
  const want = h === 'health' ? 'health' : 'company';
  const changed = want !== tab; tab = want;
  if (redraw) (changed ? draw() : Promise.resolve()).then(afterHash);
}
function afterHash() {
  const h = location.hash.replace('#', '');
  if (h === 'cash') settingsDialog();
  if (['costs', 'renewals', 'founders', 'cash'].includes(h)) $(`#co-${h === 'cash' ? 'top' : h}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function draw() {
  try {
    [S, H] = await Promise.all([rpc('company_summary'), rpc('company_health')]);
  } catch (e) {
    content(`<div class="ns-card ns-empty">${/function|schema cache|does not exist/i.test(e.message) ? 'The Company feature isn’t installed on the database yet — run <b>040_company.sql</b> in Supabase, then reload.' : esc(e.message)}</div>`);
    return;
  }
  const rate = S.run_rate; const cust = S.customers;
  setSubtitle(`Monthly income ${rr(rate.income_paise)} · ${plural(cust.paying, 'paying property', 'paying properties')} · ${S.runway.self_funding ? 'self-funding' : S.runway.months != null ? `${S.runway.months} months of cash` : 'spending more than earning'}`);
  const acts = (H.counts?.act || 0);
  content(`<div class="co-tabs" role="tablist" aria-label="Company">
      <button type="button" class="co-tab" role="tab" data-tab="company" aria-selected="${tab === 'company'}">My company</button>
      <button type="button" class="co-tab" role="tab" data-tab="health" aria-selected="${tab === 'health'}">Company health${acts ? `<span class="co-count" aria-label="${acts} need action">${acts}</span>` : ''}</button>
    </div>
    <div class="co-print">NammaStay — company summary · ${esc(fmtDate(today()))}</div>
    <div class="co-panel" role="tabpanel">${tab === 'company' ? companyTab() : healthTab()}</div>`, 'padding:24px 32px;display:flex;flex-direction:column;gap:20px;');
  $$('.co-tab').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.tab === tab) return;
    history.replaceState(null, '', b.dataset.tab === 'health' ? '#health' : location.pathname + location.search);
    tab = b.dataset.tab; draw();
  }));
  wire();
}

// ================================================================ My company
function companyTab() {
  return `${alerts()}${hero()}
    <div class="co-g2">${chartCard()}${splitCard()}</div>
    <div class="co-g2b">${renewalsCard()}${foundersCard()}</div>
    <div class="co-g2b">${unitCard()}${incomeCard()}</div>`;
}

function alerts() {
  const out = [];
  const over = S.renewals.filter((r) => r.state === 'overdue'); const soon = S.renewals.filter((r) => r.state === 'soon');
  if (over.length) out.push(`<div class="co-alert is-red">${I(P.alert, 18)}<span>${over.length === 1 ? `<b>${esc(over[0].title)}</b> is overdue (was due ${esc(fmtDate(over[0].due_on))}).` : `${over.length} filings or renewals are overdue.`} <button type="button" class="co-link" data-go="renewals">See them</button></span></div>`);
  if (soon.length) out.push(`<div class="co-alert">${I(P.clock, 18)}<span>${soon.map((r) => `<b>${esc(r.title)}</b> ${r.days_left === 0 ? 'today' : `in ${plural(r.days_left, 'day', 'days')}`}`).join(' · ')}</span></div>`);
  const cu = S.profile.cash_updated_on;
  if (S.profile.cash_paise != null && cu && (Date.now() - new Date(cu).getTime()) / 864e5 > 35) out.push(`<div class="co-alert">${I(P.wallet, 18)}<span>Cash in bank was last updated on ${esc(fmtDate(cu))}. <button type="button" class="co-link" data-cash>Update it</button> so runway stays right.</span></div>`);
  return out.length ? `<div class="co-alerts">${out.join('')}</div>` : '';
}

function hero() {
  const pb = S.payback; const rate = S.run_rate; const rw = S.runway; const inc = S.income; const cust = S.customers;
  const pct = Math.max(0, Math.min(100, Number(pb.pct) || 0)); const has = pb.invested_paise > 0;
  const C = 2 * Math.PI * 70;
  const ring = `<svg class="co-ring" viewBox="0 0 172 172" role="img" aria-label="${has ? `${pct}% of the money put in has come back` : 'No money put in recorded yet'}">
    <circle cx="86" cy="86" r="70" fill="none" stroke="#24305A" stroke-width="16"/>
    <circle cx="86" cy="86" r="70" fill="none" stroke="#3CC48F" stroke-width="16" stroke-linecap="round" stroke-dasharray="${(C * pct / 100).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 86 86)"/>
    <text x="86" y="90" text-anchor="middle" class="co-ring-pct">${has ? pct + '%' : '—'}</text>
    <text x="86" y="114" text-anchor="middle" class="co-ring-sub">paid back</text></svg>`;
  const be = pb.break_even_on;
  const head = has ? `<span class="co-kicker">${I(P.coins, 16)} Money back from profit</span>
      <div class="co-amount">${rr(pb.recovered_paise)}</div>
      <div class="co-of">of <b>${rr(pb.invested_paise)}</b> put in · ${pb.left_paise > 0 ? `<b>${rr(pb.left_paise)}</b> still to recover` : '<b>all of it is back</b> 🎉'}</div>
      <div class="co-small">${pb.left_paise > 0 ? (be ? `At the current pace: break-even around <b style="color:#F2C46A">${esc(mon(be, true))}</b>` : 'Break-even date shows once the company makes a profit') : 'Every rupee of profit from here is a return.'}</div>`
    : `<span class="co-kicker">${I(P.coins, 16)} Money back from profit</span>
      <div class="co-amount" style="font-size:26px">How much has come back?</div>
      <div class="co-of">Add the money the founders and investors have put in, and this shows how much of it the profit has paid back.</div>
      <div><button type="button" class="ns-btn" data-add-invest style="margin-top:6px">+ Add money put in</button></div>`;

  // runway
  const goal = rw.goal_months; let rv; let rs; let fill = 0; let tone = ''; let gTone = null;
  if (rw.self_funding) {
    const cover = S.profile.cash_paise != null && rate.costs_paise > 0 ? Math.round((S.profile.cash_paise / rate.costs_paise) * 10) / 10 : null;
    rv = 'Self-funding'; rs = `Income covers costs, with <b>${rr(rate.profit_paise)}</b> left over every month.`
      + (cover != null ? `<br>Cash ${rr(S.profile.cash_paise)} = <b>${cover} months</b> of costs (goal ${goal}).` : '');
    fill = cover != null ? Math.min(1, cover / goal) : 1; gTone = cover != null && cover < goal ? 'is-amber' : '';
  } else if (rw.months != null) {
    rv = `${rw.months} months`; tone = rw.months >= goal ? '' : rw.months >= 3 ? 'is-amber' : 'is-red';
    rs = `Spending <b>${rr(rw.burn_paise)}</b> a month more than earning. Cash ${rr(rw.cash_paise)} lasts until about <b>${esc(mon(addMonths(today(), Math.floor(rw.months)), true))}</b>.`;
    fill = Math.min(1, rw.months / goal);
  } else {
    rv = 'Add cash in bank'; tone = 'is-amber';
    rs = rate.costs_paise ? `Spending <b>${rr(-rate.profit_paise)}</b> a month more than earning. Enter cash in bank to see how long it lasts.` : 'Add your monthly costs and cash in bank to see your runway.';
  }
  const runway = `<div class="co-runway" id="co-top">
      <div class="co-runway-h">${I(P.fuel, 16)} Runway</div>
      <div class="co-runway-v ${tone}">${rv}</div>
      <div class="co-runway-s">${rs}</div>
      ${S.profile.cash_paise != null || !rw.self_funding ? `<div class="co-gauge" aria-hidden="true"><i style="width:${(fill * 100).toFixed(0)}%;${(gTone ?? tone) === 'is-red' ? 'background:#F0806A' : (gTone ?? tone) === 'is-amber' ? 'background:#F2B33D' : ''}"></i></div>
      <div class="co-gauge-l"><span>0</span><span>goal ${goal} months</span></div>` : ''}
      <div class="co-small">${S.profile.cash_updated_on ? `Cash updated ${esc(fmtDate(S.profile.cash_updated_on))} · ` : ''}<button type="button" class="co-link" data-cash>${S.profile.cash_paise != null ? 'Update cash' : 'Enter cash in bank'}</button></div>
    </div>`;

  // tiles
  const g = inc.mrr_prev_net_paise > 0 ? Math.round(((inc.mrr_net_paise - inc.mrr_prev_net_paise) * 1000) / inc.mrr_prev_net_paise) / 10 : null;
  const top = S.cost_split[0];
  const tile = (icon, toneC, label, value, sub) => `<div class="co-tile"><span class="co-tile-ic co-${toneC}">${I(icon, 22)}</span>
      <div style="min-width:0"><span class="co-tile-l">${label}</span><span class="co-tile-v">${value}</span><span class="co-tile-s">${sub}</span></div></div>`;
  const tiles = `<div class="co-tiles">
      ${tile(P.trend, 'green', 'Monthly income', rr(rate.income_paise), `${g == null ? 'subscriptions + other' : `<span class="${g >= 0 ? 'co-up' : 'co-down'}">${g >= 0 ? '▲' : '▼'} ${Math.abs(g)}%</span> vs 30 days ago`}${S.gst_registered ? ' · after GST' : ''}`)}
      ${tile(P.receipt, 'coral', 'Monthly costs', rr(rate.costs_paise), top ? `Biggest: ${esc(CAT[top.category]?.[0] || top.category)}` : 'no costs added yet')}
      ${tile(P.coins, rate.profit_paise >= 0 ? 'amber' : 'coral', rate.profit_paise >= 0 ? 'Profit a month' : 'Loss a month', rr(Math.abs(rate.profit_paise)), pb.left_paise > 0 && be ? `break-even ~${esc(mon(be, true))}` : rate.profit_paise >= 0 ? 'income minus costs' : 'costs are more than income')}
      ${tile(P.home, 'blue', 'Paying properties', String(cust.paying), `<span class="co-up">+${cust.new_this_month}</span> this month · ${cust.trials} on trial`)}
    </div>`;
  const started = S.profile.counted_from;
  return `<section class="co-hero" aria-label="Company payback and runway">
      <div class="co-top">${ring}<div class="co-head">${head}</div>${runway}</div>
      ${road()}
      ${tiles}
      <div class="co-foot">${I(P.clock, 15)} Counting from <b>${esc(mon(started, true))}</b> · <button type="button" class="co-link" data-cash>Change</button></div>
    </section>`;
}

function road() {
  const ms = S.milestones || []; const paying = S.customers.paying;
  const targets = ms.map((m) => m.target);
  let next = targets.findIndex((t) => t > paying); if (next < 0) next = targets.length - 1;
  const from = Math.max(0, next - 3); const list = ms.slice(from, Math.min(ms.length, from + 6));
  const n = list.length; const at = (i) => (n > 1 ? (i / (n - 1)) * 100 : 0);
  let you = 0;
  for (let i = 0; i < n; i++) {
    if (paying >= list[i].target) you = at(i);
    if (i < n - 1 && paying >= list[i].target && paying < list[i + 1].target) you = at(i) + (at(i + 1) - at(i)) * (paying - list[i].target) / (list[i + 1].target - list[i].target);
  }
  if (paying < list[0].target) you = 0;
  const label = (t) => (t === 1 ? '1st' : t >= 1000 ? `${t / 1000}k` : String(t));
  const nextT = list.find((m) => m.target > paying);
  return `<div class="co-road-wrap"><div class="co-road-t">${nextT ? `Road to ${nextT.target} paying properties · ${nextT.target - paying} to go` : `${paying} paying properties`}</div>
    <div class="co-road" role="img" aria-label="${paying} paying properties${nextT ? `, next milestone ${nextT.target}` : ''}">
      <div class="co-road-line"><i style="width:${you.toFixed(1)}%"></i></div>
      ${list.map((m, i) => { const done = paying >= m.target; const isNext = m === nextT; const ic = done ? P.check : i === n - 1 ? P.trophy : isNext ? P.star : P.flag;
        return `<span class="co-node${done ? ' is-done' : ''}${isNext ? ' is-next' : ''}${i % 2 && n > 4 ? ' is-small' : ''}" style="left:${at(i)}%" title="${done && m.reached_on ? `Reached ${esc(fmtDate(m.reached_on))}` : `${m.target} paying`}">
          <span class="co-node-dot">${I(ic, 14, 2.4)}</span><b>${label(m.target)}</b></span>`; }).join('')}
      <span class="co-you" style="left:${you.toFixed(1)}%"><span>Now: ${paying}</span></span>
    </div></div>`;
}

function chartCard() {
  const m = S.months || [];
  if (!m.length) return '';
  const W = 640; const H = 230; const L = 46; const B = 30; const T = 14; const n = m.length;
  const max = Math.max(1, ...m.map((x) => Math.max(x.income_paise, x.costs_paise)));
  const step = (W - L - 10) / n; const bw = Math.min(18, step / 3);
  const y = (v) => T + (H - B - T) * (1 - v / max);
  const grid = [0, 0.5, 1].map((f) => `<line x1="${L}" x2="${W - 6}" y1="${y(max * f)}" y2="${y(max * f)}" stroke="#F1EAD6"/><text x="${L - 6}" y="${y(max * f) + 4}" font-size="11" fill="#5B6478" text-anchor="end">${short(max * f)}</text>`).join('');
  const bars = m.map((x, i) => { const cx = L + step * i + step / 2;
    return `<g><title>${mon(x.month, true)}: in ${rr(x.income_paise)}, costs ${rr(x.costs_paise)}, ${x.profit_paise >= 0 ? 'profit' : 'loss'} ${rr(Math.abs(x.profit_paise))}</title>
      <rect x="${(cx - bw - 1).toFixed(1)}" y="${y(x.income_paise).toFixed(1)}" width="${bw}" height="${(H - B - y(x.income_paise)).toFixed(1)}" rx="3" fill="#1C9A6C"/>
      <rect x="${(cx + 1).toFixed(1)}" y="${y(x.costs_paise).toFixed(1)}" width="${bw}" height="${(H - B - y(x.costs_paise)).toFixed(1)}" rx="3" fill="#F0A08C"/>
      <text x="${cx}" y="${H - 10}" font-size="11.5" fill="#5B6478" text-anchor="middle">${mon(x.month)}</text></g>`; }).join('');
  const last = m[n - 1]; const prof = m.filter((x) => x.profit_paise >= 0).length;
  return `<section class="ns-card co-card" aria-label="Money in vs costs">
      <div class="co-card-h"><h2 class="ns-h3">${I(P.chart, 18)} Money in vs costs</h2>
        <div class="co-legend"><span><i style="background:#1C9A6C"></i>Money in</span><span><i style="background:#F0A08C"></i>Costs</span></div></div>
      <div class="co-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Money in and costs for the last ${n} months">${grid}${bars}</svg></div>
      <div class="co-small" style="color:#5B6478">${prof} of the last ${n} months made a profit. This month so far: in ${rr(last.income_paise)}, costs ${rr(last.costs_paise)}.${S.gst_registered ? ' Subscription money is counted after GST.' : ''}</div>
    </section>`;
}

function splitCard() {
  const sp = S.cost_split; const total = sp.reduce((t, x) => t + x.monthly_paise, 0); const max = Math.max(1, ...sp.map((x) => x.monthly_paise));
  const running = S.costs.filter((c) => c.running); const other = S.costs.filter((c) => !c.running);
  const row = (c) => `<div class="co-row${c.running || c.every === 'once' ? '' : ' is-off'}"><span class="co-row-ic" style="color:${CAT[c.category]?.[2]}">${I(CAT[c.category]?.[1] || P.dash, 18)}</span>
      <div class="co-row-main"><b>${esc(c.name)}</b><small>${rr(c.amount_paise)} ${c.every === 'once' ? `once · ${esc(fmtDate(c.starts_on))}` : c.every === 'year' ? `a year (${rr(c.amount_paise / 12)}/month)` : 'a month'}${c.ends_on ? ` · stopped ${esc(fmtDate(c.ends_on))}` : ''}</small></div>
      <div class="co-row-end"><button type="button" class="ns-btn-ghost" data-cost="${esc(c.id)}">Edit</button></div></div>`;
  return `<section class="ns-card co-card" id="co-costs" aria-label="Where the money goes">
      <div class="co-card-h"><h2 class="ns-h3">${I(P.wallet, 18)} Where the money goes</h2>
        <div class="co-actions"><button type="button" class="ns-btn-ghost" data-add-cost>+ Add cost</button></div></div>
      ${sp.length ? `<div class="co-split">${sp.map((x) => { const c = CAT[x.category] || CAT.other; const share = total ? Math.round((x.monthly_paise * 100) / total) : 0;
        return `<div class="co-split-row"><span class="co-split-ic" style="color:${c[2]}">${I(c[1], 18)}</span>
          <div><b>${esc(c[0])}</b> <small style="display:inline">· ${share}%</small><div class="co-bar"><i style="width:${((x.monthly_paise / max) * 100).toFixed(0)}%;background:${c[2]}"></i></div></div>
          <span class="co-split-amt">${rr(x.monthly_paise)}</span></div>`; }).join('')}</div>
        <div class="co-total"><span>Every month</span><span>${rr(total)}</span></div>`
      : `<div class="co-empty">${I(P.wallet, 26)}<span>Add salaries, servers, tools and other costs — monthly, yearly or one-time — to see profit and runway.</span><button type="button" class="ns-btn" data-add-cost>+ Add your first cost</button></div>`}
      ${S.costs.length ? `<details><summary class="co-link" style="text-decoration:none">All costs (${S.costs.length})</summary><div class="co-list" style="margin-top:6px">${[...running, ...other].map(row).join('')}</div></details>` : ''}
    </section>`;
}

function renewalsCard() {
  const open = S.renewals.filter((r) => r.state !== 'done'); const done = S.renewals.filter((r) => r.state === 'done');
  const pill = (r) => (r.state === 'overdue' ? `<span class="co-pill is-red">${I(P.alert, 12)} ${plural(-r.days_left, 'day', 'days')} late</span>`
    : r.state === 'soon' ? `<span class="co-pill is-amber">${I(P.clock, 12)} ${r.days_left === 0 ? 'Today' : `In ${plural(r.days_left, 'day', 'days')}`}</span>`
    : r.state === 'pending' ? '<span class="co-pill">Pending</span>'
    : r.state === 'done' ? `<span class="co-pill is-green">${I(P.check, 12)} Done</span>`
    : `<span class="co-pill is-green">${r.days_left} days</span>`);
  const tone = (r) => (r.state === 'overdue' ? ' is-red' : r.state === 'soon' ? ' is-amber' : r.state === 'done' ? ' is-green' : '');
  const row = (r) => `<div class="co-row${tone(r)}"><span class="co-row-ic">${I(KIND[r.kind]?.[1] || P.flag, 18)}</span>
      <div class="co-row-main"><b>${esc(r.title)}</b><small>${r.due_on ? `Due ${esc(fmtDate(r.due_on))}` : 'No date yet'} · ${esc(REPEAT[r.repeat])}${r.amount_paise ? ` · ${rr(r.amount_paise)}` : ''}${r.done_on ? ` · done ${esc(fmtDate(r.done_on))}` : ''}</small></div>
      <div class="co-row-end">${pill(r)}${r.state !== 'done' ? `<button type="button" class="ns-btn-ghost" data-done="${esc(r.id)}" title="${r.repeat === 'none' ? 'Mark as finished' : 'Done — move to the next due date'}">${I(P.check, 14)} Done</button>` : ''}<button type="button" class="ns-btn-ghost" data-ren="${esc(r.id)}">Edit</button></div></div>`;
  return `<section class="ns-card co-card" id="co-renewals" aria-label="Filings and renewals">
      <div class="co-card-h"><h2 class="ns-h3">${I(P.todo, 18)} Filings & renewals</h2>
        <div class="co-actions"><button type="button" class="ns-btn-ghost" data-presets>Add common ones</button><button type="button" class="ns-btn-ghost" data-add-ren>+ Add</button></div></div>
      ${open.length ? `<div class="co-list">${open.map(row).join('')}</div>`
        : `<div class="co-empty">${I(P.todo, 26)}<span>Keep GST, TDS, ROC, income tax, domain and trademark dates here. The menu shows a badge 7 days before anything is due.</span><button type="button" class="ns-btn" data-presets>Add common ones</button></div>`}
      ${done.length ? `<details><summary class="co-link" style="text-decoration:none">Finished (${done.length})</summary><div class="co-list">${done.map(row).join('')}</div></details>` : ''}
    </section>`;
}

function foundersCard() {
  const F = S.founders; const inv = S.investments; const totalShare = F.reduce((t, f) => t + Number(f.share_pct), 0);
  const invested = inv.reduce((t, x) => t + x.amount_paise, 0);
  const fr = F.map((f, i) => `<div class="co-row"><span class="co-av" style="background:${AV[i % AV.length]}">${esc(f.name.trim()[0] || '?').toUpperCase()}</span>
      <div class="co-row-main"><b>${esc(f.name)}${f.is_me ? ' <span class="co-pill is-green" style="padding:2px 7px">You</span>' : ''}</b><small>${f.role ? esc(f.role) + ' · ' : ''}put in ${rr(f.invested_paise)}</small></div>
      <div class="co-row-end"><b style="font:800 18px Sora,sans-serif">${Number(f.share_pct)}%</b><button type="button" class="ns-btn-ghost" data-founder="${esc(f.id)}">Edit</button></div></div>`).join('');
  const ir = inv.slice(0, 5).map((x) => `<div class="co-row"><span class="co-row-ic">${I(P.coins, 18)}</span>
      <div class="co-row-main"><b>${rr(x.amount_paise)}</b><small>${esc(fmtDate(x.made_on))} · ${esc(x.founder || SOURCE[x.source])}${x.note ? ' · ' + esc(x.note) : ''}</small></div>
      <div class="co-row-end"><button type="button" class="ns-btn-ghost" data-invest="${esc(x.id)}">Edit</button></div></div>`).join('');
  return `<section class="ns-card co-card" id="co-founders" aria-label="Founders and money put in">
      <div class="co-card-h"><h2 class="ns-h3">${I(P.users, 18)} ${F.length === 1 ? 'Founder' : 'Founders'} & money put in</h2>
        <div class="co-actions"><button type="button" class="ns-btn-ghost" data-add-founder>+ Founder</button><button type="button" class="ns-btn-ghost" data-add-invest>+ Money put in</button></div></div>
      ${F.length ? `<div class="co-share" role="img" aria-label="Shares: ${F.map((f) => `${esc(f.name)} ${Number(f.share_pct)}%`).join(', ')}">${F.map((f, i) => `<i style="width:${Number(f.share_pct)}%;background:${AV[i % AV.length]}"></i>`).join('')}</div>
        ${totalShare !== 100 ? `<div class="co-note is-amber">Shares add up to ${totalShare}% — ${totalShare < 100 ? `${100 - totalShare}% is not given to anyone yet (e.g. kept for staff options)` : 'more than 100%'}.</div>` : ''}
        <div class="co-list">${fr}</div>` : '<div class="co-small" style="color:#5B6478">Add the founders and their share — it’s used for who put in what.</div>'}
      <div class="co-total"><span>Money put in so far</span><span>${rr(invested)}</span></div>
      ${inv.length ? `<div class="co-list">${ir}</div>${inv.length > 5 ? `<div class="co-small" style="color:#5B6478">+ ${inv.length - 5} older entries</div>` : ''}` : ''}
    </section>`;
}

function unitCard() {
  const u = S.unit; const has = S.customers.paying > 0;
  const box = (label, v, sub) => `<div><span>${label}</span><b>${v}</b><small>${sub}</small></div>`;
  let note = '';
  if (has && u.arpu_paise) {
    const margin = u.server_per_property_paise != null ? Math.round(((u.arpu_paise - u.server_per_property_paise) * 100) / u.arpu_paise) : null;
    note = `Each paying property brings about <b>${rr(u.arpu_paise)}</b> a month${u.server_per_property_paise ? ` and costs about <b>${rr(u.server_per_property_paise)}</b> in servers (${margin}% kept)` : ''}.`
      + (u.cac_payback_months != null ? ` Winning one costs about <b>${rr(u.cac_paise)}</b> in marketing — earned back in <b>${u.cac_payback_months} months</b>.` : '');
  }
  const good = u.cac_payback_months == null || u.cac_payback_months <= 12;
  return `<section class="ns-card co-card" aria-label="Unit economics">
      <div class="co-card-h"><h2 class="ns-h3">${I(P.calc, 18)} Per property (unit economics)</h2></div>
      ${has ? `<div class="co-unit">
          ${box('Income a property', rr(u.arpu_paise), 'per month, average')}
          ${box('All costs a property', rr(u.cost_per_property_paise), 'per month')}
          ${box('Servers a property', u.server_per_property_paise ? rr(u.server_per_property_paise) : '—', 'per month')}
          ${box('Cost to win one', u.cac_paise != null ? rr(u.cac_paise) : '—', 'marketing ÷ new paying, 90 days')}
        </div>
        ${note ? `<div class="co-note${good ? '' : ' is-amber'}">${note}${good ? '' : ' That’s slow — aim for under 12 months.'}</div>` : ''}`
      : '<div class="co-small" style="color:#5B6478">Shows once properties are paying.</div>'}
    </section>`;
}

function incomeCard() {
  const L = S.income_list;
  return `<section class="ns-card co-card" aria-label="Other income">
      <div class="co-card-h"><h2 class="ns-h3">${I(P.trend, 18)} Other income</h2>
        <div class="co-actions"><button type="button" class="ns-btn-ghost" data-add-income>+ Add</button></div></div>
      <div class="co-small" style="color:#5B6478">Subscriptions are counted automatically. Add money from anything else — setup fees, training, a website job.</div>
      ${L.length ? `<div class="co-list">${L.slice(0, 6).map((x) => `<div class="co-row"><span class="co-row-ic co-green" style="background:#E3F4EB;color:#0E6E4B">${I(P.plus, 18)}</span>
          <div class="co-row-main"><b>${esc(x.source)}</b><small>${esc(fmtDate(x.received_on))}${x.note ? ' · ' + esc(x.note) : ''}</small></div>
          <div class="co-row-end"><b>${rr(x.amount_paise)}</b><button type="button" class="ns-btn-ghost" data-income="${esc(x.id)}">Edit</button></div></div>`).join('')}</div>` : ''}
    </section>`;
}

// ================================================================ Company health
const AREA = {
  growth: ['Growth', P.trend, 'leads.html', 'Open leads'],
  churn: ['Customers leaving', '<circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c0-3.6 2.9-6.4 6.5-6.4s6.5 2.8 6.5 6.4"/><path d="M16 11h6"/>', 'subscribers.html', 'Subscribers'],
  conversion: ['Trial → paid', '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>', 'admin.html', 'Trials in Overview'],
  activation: ['New sign-ups active', '<path d="M5 15c-1.5 1.3-2 4-2 6 2 0 4.7-.5 6-2"/><path d="M9 12a12 12 0 0 1 11-9 12 12 0 0 1-9 11z"/><circle cx="15" cy="9" r="1.5"/>', 'admin.html', 'Overview'],
  inactive: ['Quiet customers', '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>', 'admin.html', 'Overview'],
  collections: ['Payments to collect', P.wallet, 'subscribers.html', 'Review payments'],
  runway: ['Runway', P.fuel, null, 'See runway'],
  filings: ['Filings & renewals', P.todo, null, 'Filings'],
};
const TONE = { good: 'green', watch: 'amber', act: 'red' };
const WORD = { green: 'Good', amber: 'Watch', red: 'Act now', unknown: 'No data yet' };
const COLOR = { green: '#3CC48F', amber: '#F2B33D', red: '#F0806A', unknown: '#8A93AD' };
const ST_IC = { green: P.check, amber: P.eye, red: P.alert, unknown: P.dash };
const linkLabel = (a) => (/costs/.test(a.link || '') ? 'Add costs' : /cash/.test(a.link || '') ? 'Enter cash' : AREA[a.key][3]);
const areaLink = (a) => (a.link && /^company\.html/.test(a.link) ? a.link.replace('company.html', '') || '#' : a.link || AREA[a.key]?.[2] || '');

function healthTab() {
  const s = H.score; const tone = s == null ? 'unknown' : s >= 75 ? 'green' : s >= 50 ? 'amber' : 'red';
  const label = s == null ? 'Not enough data yet' : H.verdict === 'healthy' ? 'Healthy' : H.verdict === 'attention' ? 'Needs attention' : 'At risk';
  const t = H.history || []; const delta = s != null && H.last_week != null ? s - H.last_week : null;
  const deltaHtml = delta == null ? '' : `<span class="coh-delta ${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)} vs last week</span>`;
  const C = 2 * Math.PI * 80; const arc = C * 0.75; const val = s == null ? 0 : (arc * s) / 100;
  const gauge = `<svg class="coh-gauge" viewBox="0 0 200 190" role="img" aria-label="Company health ${s == null ? 'not available' : s + ' out of 100'}">
    <circle cx="100" cy="100" r="80" fill="none" stroke="#24305A" stroke-width="16" stroke-linecap="round" stroke-dasharray="${arc.toFixed(1)} ${C.toFixed(1)}" transform="rotate(135 100 100)"/>
    <circle cx="100" cy="100" r="80" fill="none" stroke="${COLOR[tone]}" stroke-width="16" stroke-linecap="round" stroke-dasharray="${val.toFixed(1)} ${C.toFixed(1)}" transform="rotate(135 100 100)"/>
    <text x="100" y="106" text-anchor="middle" class="coh-score">${s == null ? '—' : s}</text>
    <text x="100" y="132" text-anchor="middle" class="coh-of">out of 100</text>
    <text x="44" y="182" text-anchor="middle" class="coh-end">0</text><text x="156" y="182" text-anchor="middle" class="coh-end">100</text></svg>`;
  const spark = t.length < 2 ? '' : (() => {
    const W = 160; const Hh = 40; const lo = Math.min(...t.map((p) => p.score)) - 5; const hi = Math.max(...t.map((p) => p.score)) + 5;
    const x = (i) => 5 + i * ((W - 10) / (t.length - 1)); const y = (v) => 5 + ((hi - v) * (Hh - 10)) / ((hi - lo) || 1);
    return `<svg class="coh-spark" viewBox="0 0 ${W} ${Hh}" aria-hidden="true"><polyline points="${t.map((p, i) => `${x(i).toFixed(1)},${y(p.score).toFixed(1)}`).join(' ')}" fill="none" stroke="#3CC48F" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${x(t.length - 1)}" cy="${y(t[t.length - 1].score)}" r="4" fill="#3CC48F"/></svg>`;
  })();
  const areas = H.areas.map((a) => ({ ...a, tone: TONE[a.status] || 'unknown' }));
  const order = { red: 0, amber: 1, green: 2, unknown: 3 };
  const todo = [...areas.filter((a) => a.tone === 'red' && a.todo), ...areas.filter((a) => a.tone === 'amber' && a.todo), ...areas.filter((a) => a.tone === 'unknown' && a.todo)].slice(0, 3);
  const actions = todo.map((a, i) => `<li class="coh-act is-${a.tone === 'unknown' ? 'amber' : a.tone}"><span class="coh-act-n">${i + 1}</span>
      <div><span class="coh-act-area">${I(AREA[a.key][1], 15)} ${esc(AREA[a.key][0])}</span><p>${esc(a.todo)}</p>
      ${areaLink(a) ? `<a href="${esc(areaLink(a))}" class="coh-act-go">${esc(linkLabel(a))} →</a>` : ''}</div></li>`).join('')
    || `<li class="coh-act is-green"><span class="coh-act-n">${I(P.check, 14)}</span><div><p>Nothing urgent — keep growing.</p></div></li>`;
  const card = (a) => `<article class="coh-area is-${a.tone}">
      <header><span class="coh-ic">${I(AREA[a.key][1], 21)}</span><b>${esc(AREA[a.key][0])}</b><span class="coh-pill">${I(ST_IC[a.tone], 13)}${WORD[a.tone]}</span></header>
      ${a.value ? `<div class="coh-value">${esc(a.value)}</div>` : ''}
      <div class="coh-detail">${esc(a.detail || '')}</div>
      ${a.todo && a.tone !== 'green' ? `<div class="coh-tip">${esc(a.todo)}</div>` : ''}
      ${areaLink(a) && a.tone !== 'green' ? `<footer><a href="${esc(areaLink(a))}" class="coh-go">${esc(linkLabel(a))} →</a></footer>` : ''}</article>`;
  const attention = areas.filter((a) => a.tone === 'red' || a.tone === 'amber').sort((x, y) => order[x.tone] - order[y.tone]);
  const good = areas.filter((a) => a.tone === 'green'); const none = areas.filter((a) => a.tone === 'unknown');
  const section = (list, colour, title) => (list.length ? `<h2 class="coh-sec"><span class="coh-sec-dot" style="background:${colour}"></span>${title} <small>${list.length}</small></h2><div class="coh-grid">${list.map(card).join('')}</div>` : '');
  const trend = (() => {
    if (t.length < 2) return `<section class="ns-card coh-trend"><h2 class="ns-h3" style="margin:0">Score every week</h2><p class="ns-muted" style="margin:6px 0 0">The trend starts this week — the score is saved every week you open this page.</p></section>`;
    const phone = window.innerWidth < 640; const W = phone ? 380 : 900; const Hh = phone ? 220 : 200; const n = t.length; const x = (i) => 30 + i * ((W - 60) / (n - 1));
    const lo = Math.max(0, Math.min(70, ...t.map((p) => p.score)) - 8); const y = (v) => 24 + ((100 - v) * (Hh - 56)) / (100 - lo);
    const pts = t.map((p, i) => `${x(i).toFixed(1)},${y(p.score).toFixed(1)}`);
    return `<section class="ns-card coh-trend"><div class="coh-trend-h"><h2 class="ns-h3" style="margin:0">Score every week</h2>${deltaHtml}</div>
      <svg viewBox="0 0 ${W} ${Hh}" width="100%" role="img" aria-label="Weekly company health, ${t[0].score} to ${t[n - 1].score}" style="margin-top:6px">
        <rect x="30" y="${y(100)}" width="${W - 60}" height="${(y(75) - y(100)).toFixed(1)}" rx="6" fill="#E9F5EE"></rect>
        <text x="40" y="${y(100) + 17}" font-size="12" fill="#0E6E4B" font-weight="700">healthy zone · 75+</text>
        <polyline points="${pts.join(' ')}" fill="none" stroke="#101A3D" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"></polyline>
        ${t.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.score)}" r="${i === n - 1 ? 7 : 5}" fill="${i === n - 1 ? '#1C9A6C' : '#101A3D'}" stroke="#fff" stroke-width="2"><title>Week of ${esc(fmtDate(p.week))}: ${p.score}</title></circle>
          <text x="${x(i)}" y="${y(p.score) - 14}" font-size="13" font-weight="800" fill="#101A3D" text-anchor="middle">${p.score}</text>`).join('')}
        <text x="30" y="${Hh - 8}" font-size="12.5" fill="#5B6478">${esc(fmtDate(t[0].week))}</text>
        <text x="${W - 30}" y="${Hh - 8}" font-size="12.5" fill="#5B6478" text-anchor="end">This week</text></svg></section>`;
  })();
  const cnt = (k) => areas.filter((a) => a.tone === k).length;
  return `<section class="coh-hero" aria-label="Company health score">
      <div class="coh-score-box">${gauge}
        <div class="coh-verdict"><span class="co-kicker">${I(P.pulse, 15)} Company health</span>
          <b class="coh-label coh-l-${tone}">${label}</b>
          <span class="co-small">Last 30 days, from billing data and what you entered</span>
          <div class="coh-trendline">${deltaHtml}${spark}</div>
          <div class="coh-counts"><span><i style="background:${COLOR.green}"></i>${cnt('green')} good</span><span><i style="background:${COLOR.amber}"></i>${cnt('amber')} watch</span><span><i style="background:${COLOR.red}"></i>${cnt('red')} act now</span></div>
        </div></div>
      <div class="coh-todo"><h2>${I(P.todo, 18)} Top things to do</h2><ol>${actions}</ol></div>
    </section>
    ${section(attention, COLOR.amber, 'Needs attention')}
    ${section(good, COLOR.green, 'Doing well')}
    ${section(none, COLOR.unknown, 'Not enough data yet')}
    ${trend}
    <p class="ns-muted" style="margin:0;font-size:12.5px">Good = 100, Watch = 60, Act now = 20; the score is the average of the areas that have data. A guide for the founders, not financial advice.</p>`;
}

// ================================================================ wiring & dialogs
function wire() {
  const on = (sel, fn) => $$(sel).forEach((b) => b.addEventListener('click', () => fn(b)));
  on('[data-add-cost]', () => costDialog());
  on('[data-cost]', (b) => costDialog(S.costs.find((c) => c.id === b.dataset.cost)));
  on('[data-cash]', () => settingsDialog());
  on('[data-add-invest]', () => investDialog());
  on('[data-invest]', (b) => investDialog(S.investments.find((x) => x.id === b.dataset.invest)));
  on('[data-add-founder]', () => founderDialog());
  on('[data-founder]', (b) => founderDialog(S.founders.find((x) => x.id === b.dataset.founder)));
  on('[data-add-income]', () => incomeDialog());
  on('[data-income]', (b) => incomeDialog(S.income_list.find((x) => x.id === b.dataset.income)));
  on('[data-add-ren]', () => renewalDialog());
  on('[data-ren]', (b) => renewalDialog(S.renewals.find((x) => x.id === b.dataset.ren)));
  on('[data-presets]', () => presetsDialog());
  on('[data-go]', (b) => $(`#co-${b.dataset.go}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  on('[data-done]', async (b) => {
    const r = S.renewals.find((x) => x.id === b.dataset.done); b.disabled = true;
    try { const res = await rpc('company_renewal_done', { p_id: r.id });
      toast(res.due_on && r.repeat !== 'none' ? `${r.title}: done — next due ${fmtDate(res.due_on)}` : `${r.title}: marked as finished`); await draw();
    } catch (e) { toast(e.message, { error: true }); b.disabled = false; }
  });
}

const amountIn = (name, v, ph = '0') => `<input class="ns-input" name="${name}" inputmode="decimal" placeholder="${ph}" value="${esc(rupeeIn(v))}">`;
const dateIn = (name, v) => `<input class="ns-input" type="date" name="${name}" value="${esc(v || '')}" max="2100-12-31">`;
const val = (el, n) => el.querySelector(`[name="${n}"]`)?.value.trim() ?? '';
const money = (el, n, need = true) => { const v = val(el, n); if (!v && !need) return null; const p = toPaise(v); if (!Number.isFinite(p) || p <= 0) throw new Error('Enter the amount in rupees.'); return p; };
const deleteAction = (what, fn) => ({ label: 'Delete', kind: 'danger', onClick: async () => { if (!(await confirmDialog(`Delete ${what}?`, 'This can’t be undone.', { confirmLabel: 'Delete', danger: true }))) return false; await fn(); toast('Deleted'); await draw(); } });

function costDialog(c = null) {
  const m = modal({ title: c ? 'Edit cost' : 'Add a cost', width: 520, body: `<div class="co-form">
      ${field('What is it?', `<input class="ns-input" name="name" maxlength="80" placeholder="e.g. Supabase, Developer salary, Google Ads" value="${esc(c?.name || '')}">`)}
      <div class="co-f2">${field('Category', `<select class="ns-input" name="category">${options(Object.entries(CAT).map(([k, v]) => [k, v[0]]), c?.category || 'servers')}</select>`)}
        ${field('How often', `<select class="ns-input" name="every">${options([['month', 'Every month'], ['year', 'Every year'], ['once', 'One time']], c?.every || 'month')}</select>`)}</div>
      <div class="co-f2">${field('Amount (₹)', amountIn('amount', c?.amount_paise))}${field('Started on', dateIn('starts_on', c?.starts_on || today()), '<span data-start-help>For a one-time cost: the day you paid.</span>')}</div>
      <div data-end>${field('Stopped on (leave empty if still running)', dateIn('ends_on', c?.ends_on))}</div>
      ${field('Note (optional)', `<input class="ns-input" name="note" maxlength="200" value="${esc(c?.note || '')}">`)}
    </div>`,
  actions: [...(c ? [deleteAction('this cost', () => rpc('company_cost_delete', { p_id: c.id }))] : []), { label: 'Cancel' },
    { label: c ? 'Save' : 'Add cost', kind: 'primary', onClick: async (el) => {
      await rpc('company_cost_save', { p: { id: c?.id || null, name: val(el, 'name'), category: val(el, 'category'), every: val(el, 'every'), amount_paise: money(el, 'amount'),
        starts_on: val(el, 'starts_on'), ends_on: val(el, 'every') === 'once' ? null : val(el, 'ends_on') || null, note: val(el, 'note') } });
      toast(c ? 'Cost saved' : 'Cost added'); await draw(); } }] });
  const ev = m.el.querySelector('[name="every"]'); const sync = () => { m.el.querySelector('[data-end]').hidden = ev.value === 'once'; m.el.querySelector('[name="starts_on"]').closest('.ns-field').querySelector('label').textContent = ev.value === 'once' ? 'Paid on' : 'Started on'; };
  ev.addEventListener('change', sync); sync();
}

function settingsDialog() {
  const p = S.profile;
  modal({ title: 'Cash & settings', width: 480, body: `<div class="co-form">
      ${field('Cash in bank today (₹)', amountIn('cash', p.cash_paise, 'e.g. 460000'), 'All company bank accounts together. Used for runway.')}
      ${field('Runway goal (months)', `<input class="ns-input" name="goal" type="number" min="1" max="36" value="${esc(p.runway_goal_months || 6)}">`, 'How many months of costs you want to keep in the bank. 6 is a common goal.')}
      ${field('Count payback from', `<input class="ns-input" type="month" name="started" value="${esc((p.started_on || p.counted_from || '').slice(0, 7))}">`, 'The month the company started spending. Profit is added up from here.')}
    </div>`,
  actions: [{ label: 'Cancel' }, { label: 'Save', kind: 'primary', onClick: async (el) => {
    const cash = val(el, 'cash'); const pc = cash === '' ? null : toPaise(cash);
    if (pc != null && (!Number.isFinite(pc) || pc < 0)) throw new Error('Enter cash in rupees.');
    const st = val(el, 'started');
    await rpc('company_profile_save', { p: { cash_paise: pc, runway_goal_months: Number(val(el, 'goal')) || 6, started_on: st ? st + '-01' : null } });
    if (location.hash === '#cash') history.replaceState(null, '', location.pathname);
    toast('Saved'); await draw(); } }] });
}

function investDialog(x = null) {
  const F = S.founders;
  modal({ title: x ? 'Edit money put in' : 'Add money put in', width: 480, body: `<div class="co-form">
      <div class="co-f2">${field('Amount (₹)', amountIn('amount', x?.amount_paise, 'e.g. 500000'))}${field('Date', dateIn('made_on', x?.made_on || today()))}</div>
      <div class="co-f2">${field('From', `<select class="ns-input" name="source">${options(Object.entries(SOURCE), x?.source || 'founder')}</select>`)}
        ${field('Put in by', `<select class="ns-input" name="founder"><option value="">—</option>${options(F.map((f) => [f.id, f.name + (f.is_me ? ' (you)' : '')]), x?.founder_id || (F.find((f) => f.is_me)?.id || ''))}</select>`)}</div>
      ${field('Note (optional)', `<input class="ns-input" name="note" maxlength="200" placeholder="e.g. Seed money, laptop, first year servers" value="${esc(x?.note || '')}">`)}
    </div>`,
  actions: [...(x ? [deleteAction('this entry', () => rpc('company_investment_delete', { p_id: x.id }))] : []), { label: 'Cancel' },
    { label: 'Save', kind: 'primary', onClick: async (el) => {
      await rpc('company_investment_save', { p: { id: x?.id || null, amount_paise: money(el, 'amount'), made_on: val(el, 'made_on'), source: val(el, 'source'), founder_id: val(el, 'founder') || null, note: val(el, 'note') } });
      toast('Saved'); await draw(); } }] });
}

function founderDialog(f = null) {
  modal({ title: f ? 'Edit founder' : 'Add a founder', width: 460, body: `<div class="co-form">
      ${field('Name', `<input class="ns-input" name="name" maxlength="60" value="${esc(f?.name || '')}">`)}
      <div class="co-f2">${field('Role (optional)', `<input class="ns-input" name="role" maxlength="60" placeholder="e.g. CEO, CTO" value="${esc(f?.role || '')}">`)}
        ${field('Share (%)', `<input class="ns-input" name="share" inputmode="decimal" value="${esc(f ? Number(f.share_pct) : '')}">`)}</div>
      <label class="ns-help" style="display:flex;gap:8px;align-items:center;font-weight:700"><input type="checkbox" name="me" ${f?.is_me || (!f && !S.founders.some((x) => x.is_me)) ? 'checked' : ''}> This is me</label>
    </div>`,
  actions: [...(f ? [deleteAction(f.name, () => rpc('company_founder_delete', { p_id: f.id }))] : []), { label: 'Cancel' },
    { label: 'Save', kind: 'primary', onClick: async (el) => {
      const share = Number(val(el, 'share').replace('%', '')); if (!Number.isFinite(share) || share < 0 || share > 100) throw new Error('Share: a number from 0 to 100.');
      await rpc('company_founder_save', { p: { id: f?.id || null, name: val(el, 'name'), role: val(el, 'role'), share_pct: share, is_me: el.querySelector('[name="me"]').checked } });
      toast('Saved'); await draw(); } }] });
}

function incomeDialog(x = null) {
  modal({ title: x ? 'Edit income' : 'Add other income', width: 460, body: `<div class="co-form">
      ${field('From', `<input class="ns-input" name="source" maxlength="80" placeholder="e.g. Setup fee — Hotel Arya" value="${esc(x?.source || '')}">`)}
      <div class="co-f2">${field('Amount (₹)', amountIn('amount', x?.amount_paise))}${field('Received on', dateIn('received_on', x?.received_on || today()))}</div>
      ${field('Note (optional)', `<input class="ns-input" name="note" maxlength="200" value="${esc(x?.note || '')}">`)}
    </div>`,
  actions: [...(x ? [deleteAction('this income', () => rpc('company_income_delete', { p_id: x.id }))] : []), { label: 'Cancel' },
    { label: 'Save', kind: 'primary', onClick: async (el) => {
      await rpc('company_income_save', { p: { id: x?.id || null, source: val(el, 'source'), amount_paise: money(el, 'amount'), received_on: val(el, 'received_on'), note: val(el, 'note') } });
      toast('Saved'); await draw(); } }] });
}

function renewalDialog(r = null) {
  modal({ title: r ? 'Edit filing / renewal' : 'Add a filing or renewal', width: 500, body: `<div class="co-form">
      ${field('Name', `<input class="ns-input" name="title" maxlength="80" placeholder="e.g. GSTR-3B, thenammastay.com" value="${esc(r?.title || '')}">`)}
      <div class="co-f2">${field('Type', `<select class="ns-input" name="kind">${options(Object.entries(KIND).map(([k, v]) => [k, v[0]]), r?.kind || 'gst')}</select>`)}
        ${field('Repeats', `<select class="ns-input" name="repeat">${options(Object.entries(REPEAT), r?.repeat || 'month')}</select>`)}</div>
      <div class="co-f2">${field('Next due date', dateIn('due_on', r?.due_on), 'Leave empty if there’s no date yet.')}${field('Fee (₹, optional)', amountIn('amount', r?.amount_paise, ''))}</div>
      ${field('Note (optional)', `<input class="ns-input" name="note" maxlength="200" placeholder="e.g. CA files it, login in password manager" value="${esc(r?.note || '')}">`)}
    </div>`,
  actions: [...(r ? [deleteAction(r.title, () => rpc('company_renewal_delete', { p_id: r.id }))] : []), { label: 'Cancel' },
    { label: 'Save', kind: 'primary', onClick: async (el) => {
      const fee = val(el, 'amount'); const pf = fee === '' ? null : toPaise(fee); if (pf != null && (!Number.isFinite(pf) || pf < 0)) throw new Error('Fee: enter rupees or leave it empty.');
      await rpc('company_renewal_save', { p: { id: r?.id || null, title: val(el, 'title'), kind: val(el, 'kind'), repeat: val(el, 'repeat'), due_on: val(el, 'due_on') || null, amount_paise: pf, note: val(el, 'note') } });
      toast('Saved'); await draw(); } }] });
}

// common Indian company filings — next due dates worked out from today (the admin can change them)
function nextDay(day, monthsAhead = 1) { const d = new Date(today() + 'T12:00:00Z'); const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), day, 12));
  if (t <= d) t.setUTCMonth(t.getUTCMonth() + monthsAhead); return t.toISOString().slice(0, 10); }
function nextOf(list) { const now = today(); const y = Number(now.slice(0, 4));
  return [y, y + 1].flatMap((yy) => list.map((md) => `${yy}-${md}`)).filter((d) => d >= now).sort()[0]; }
function addMonths(d, n) { const t = new Date(d.slice(0, 10) + 'T12:00:00Z'); t.setUTCMonth(t.getUTCMonth() + n); return t.toISOString().slice(0, 10); }
const PRESETS = () => [
  ['gst', 'GSTR-1 (sales return)', 'month', nextDay(11), 'Monthly, by the 11th'],
  ['gst', 'GSTR-3B (pay GST)', 'month', nextDay(20), 'Monthly, by the 20th'],
  ['tds', 'TDS payment', 'month', nextDay(7), 'Monthly, by the 7th — if you deduct TDS on salaries or fees'],
  ['tds', 'TDS return (24Q / 26Q)', 'quarter', nextOf(['01-31', '05-31', '07-31', '10-31']), 'Every quarter'],
  ['itr', 'Income tax return (company)', 'year', nextOf(['10-31']), 'Every year — 31 Oct when accounts are audited'],
  ['roc', 'ROC: AOC-4 (accounts)', 'year', nextOf(['10-30']), 'Every year, within 30 days of the AGM'],
  ['roc', 'ROC: MGT-7 (annual return)', 'year', nextOf(['11-29']), 'Every year, within 60 days of the AGM'],
  ['domain', 'Domain thenammastay.com', 'year', '', 'Add the expiry date from your domain registrar'],
  ['trademark', 'Trademark “NammaStay”', 'none', '', 'Application status — add a date when there’s a hearing or renewal'],
];
function presetsDialog() {
  const have = new Set(S.renewals.map((r) => r.title.toLowerCase()));
  const list = PRESETS().filter((p) => !have.has(p[1].toLowerCase()));
  if (!list.length) { toast('All the common ones are already added.'); return; }
  modal({ title: 'Add common filings & renewals', width: 560, body: `<p class="ns-muted" style="margin:0 0 10px">Usual dates for a private limited company in India. Check them with your CA — you can change any date later.</p>
      <div class="co-presets">${list.map((p, i) => `<label><input type="checkbox" data-p="${i}" ${p[3] && p[0] !== 'tds' ? 'checked' : ''}>
        <span style="flex:1"><b>${esc(p[1])}</b><small>${esc(p[4])}</small></span>
        <input class="ns-input" type="date" data-d="${i}" value="${esc(p[3])}" style="width:150px" aria-label="Due date for ${esc(p[1])}"></label>`).join('')}</div>`,
  actions: [{ label: 'Cancel' }, { label: 'Add selected', kind: 'primary', onClick: async (el) => {
    const pick = list.map((p, i) => ({ p, on: el.querySelector(`[data-p="${i}"]`).checked, d: el.querySelector(`[data-d="${i}"]`).value })).filter((x) => x.on);
    if (!pick.length) throw new Error('Tick at least one.');
    const miss = pick.find((x) => x.p[2] !== 'none' && !x.d); if (miss) throw new Error(`Add the due date for ${miss.p[1]}.`);
    for (const x of pick) await rpc('company_renewal_save', { p: { kind: x.p[0], title: x.p[1], repeat: x.p[2], due_on: x.d || null } });
    toast(`${plural(pick.length, 'item', 'items')} added`); await draw(); } }] });
}
