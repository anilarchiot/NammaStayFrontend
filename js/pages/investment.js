// My business (owner only) — money invested, payback from profit, milestones, legal documents (036_investment.sql);
// loans, partners and lease in their own tab (039_my_business.sql, business.js).
import { page, rpc, sb, content, setSubtitle, headerActions, esc, rupees, toPaise, fmtDate, ymd, modal, field, options,
  toast, confirmDialog, $, $$ } from '../core.js';
import { checklist, KINDS, STATE_OPTIONS, STATES, CHECKED_ON } from './licences-data.js';
import { SETUP_KINDS, setupItems } from './setup-items.js';
import { drawMilestoneCard, CARD_THEMES, CARD_SIZES } from './milestone-card.js';
import { loadBusiness, renderBusiness, alertsHtml } from './business.js';

export const DOC_TYPES = [['trade_licence', 'Trade licence'], ['fire_noc', 'Fire NOC'], ['fssai', 'FSSAI licence'], ['gst', 'GST certificate'],
  ['police', 'Police registration'], ['tourism', 'Tourism registration'], ['rental_agreement', 'Rental agreement'], ['lease_deed', 'Lease deed'],
  ['insurance', 'Insurance'], ['building_approval', 'Building approval / OC'], ['pollution', 'Pollution board consent'],
  ['partnership', 'Partnership / company documents'], ['shops_establishment', 'Shops & Establishments registration'], ['professional_tax', 'Professional tax registration'],
  ['frro', 'FRRO / Form C registration'], ['hostel_licence', 'Hostel / PG licence'], ['rwa_noc', 'Society / RWA NOC'], ['music', 'Music licence'], ['liquor', 'Bar / liquor licence'],
  ['lift', 'Lift licence'], ['labour', 'EPF / ESI registration'], ['environment', 'Environment / CRZ clearance'], ['classification', 'Tourism classification'], ['other', 'Other']];
const DOC = Object.fromEntries(DOC_TYPES);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = (ym, year = true) => { if (!ym) return ''; const [y, m] = ym.split('-').map(Number); return MONTHS[m - 1] + (year ? ' ' + y : ''); };
const PB_ICON = {
  check: '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
  flag: '<svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/></svg>',
  star: '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/></svg>',
  trophy: '<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg>',
  coins: '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v4c0 1.7 2.7 3 6 3s6-1.3 6-3V7"/><path d="M9 14v3c0 1.7 2.7 3 6 3s6-1.3 6-3v-4c0-1.7-2.7-3-6-3"/></svg>',
  calendar: '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M9 15l2 2 4-4"/></svg>',
  target: '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>',
  trend: '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>',
  bank: '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10l9-6 9 6"/><path d="M5 10v8M9 10v8M15 10v8M19 10v8M3 21h18"/></svg>',
  clock: '<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
};
const BUCKET = 'owner-docs';
const MAX_FILE = 10 * 1024 * 1024;
const ICON = {
  trophy: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg>',
  lock: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  doc: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>',
};

page('investment', async (ctx) => {
  if (ctx.role !== 'owner') { content('<div class="ns-card ns-empty">Only the owner can see this page.</div>'); return; }
  setSubtitle(`${ctx.property_name} · only you (owner) can see this page`);
  let S = null; let D = []; let C = null; let B = null;
  const TABS = [['payback', 'Payback'], ['business', 'Loans, partners & lease'], ['documents', 'Documents & licences']];
  let tab = (location.hash.replace('#', '').match(/^(payback|business|documents)$/) || [])[0] || (location.hash === '#docs' || location.hash === '#licences' ? 'documents' : 'payback');
  const actions = () => {
    const box = headerActions();
    box.innerHTML = tab === 'payback' ? '<button type="button" class="ns-btn-ghost" id="ivs-list">Choose from list</button><button type="button" class="ns-btn" id="ivs-add">+ Add investment</button>'
      : tab === 'documents' ? '<button type="button" class="ns-btn" id="doc-add">+ Upload document</button>' : '';
    $('#ivs-add')?.addEventListener('click', () => investDialog());
    $('#ivs-list')?.addEventListener('click', () => listDialog());
    $('#doc-add')?.addEventListener('click', () => docDialog());
  };
  const defaultKind = () => (ctx.isPg ? 'pg' : ctx.isResort ? 'resort' : ['hostel', 'homestay', 'hotel'].includes(ctx.kind) ? ctx.kind : 'hostel');

  async function draw() {
    [S, D, C, B] = await Promise.all([rpc('invest_summary', { p_property: ctx.property_id }), rpc('legal_docs_list', { p_property: ctx.property_id }),
      rpc('legal_checklist_get', { p_property: ctx.property_id }).catch(() => null), loadBusiness(ctx.property_id)]);
    paint();
  }
  window.addEventListener('hashchange', () => {                 // links like investment.html#docs from the dashboard
    const h = location.hash.replace('#', ''); const t = h === 'docs' || h === 'licences' ? 'documents' : h;
    if (['payback', 'business', 'documents'].includes(t) && t !== tab && S) { tab = t; paint(); if (h === 'docs' || h === 'licences') $('#' + h)?.scrollIntoView({ block: 'start' }); }
  });
  function paint() {
    actions();
    const tabs = TABS.filter(([k]) => k !== 'business' || B);
    if (!tabs.some(([k]) => k === tab)) tab = 'payback';
    const due = D.filter((d) => d.status === 'expired' || d.status === 'due').length;
    const badge = (k) => (k === 'documents' && due ? `<b class="biz-count" title="${due} documents need renewal">${due}</b>`
      : k === 'business' && B?.alerts?.length ? `<b class="biz-count">${B.alerts.length}</b>` : '');
    const bar = `<div class="biz-tabs" role="tablist" aria-label="My business">${tabs.map(([k, l]) => `<button type="button" role="tab" class="biz-tab" id="biz-tab-${k}" aria-controls="biz-panel" aria-selected="${tab === k}" data-tab="${k}">${l}${badge(k)}</button>`).join('')}</div>`;
    let body = '';
    if (tab === 'payback') {
      body = `${S.invested_paise > 0 ? hero() : welcome()}${alertsHtml(B, ['lease_payback'])}
      <div class="ivs-row">
        <section class="ns-card ivs-card" style="flex:3 1 420px" aria-label="Milestones">${milestones()}</section>
        <section class="ns-card ivs-card" style="flex:2 1 340px" aria-label="Profit each month">${chart()}</section>
      </div>
      <section class="ns-card ivs-card" aria-label="What you invested">${itemsTable()}</section>`;
    } else if (tab === 'documents') {
      body = `<section class="ns-card ivs-card" aria-label="Legal documents" id="docs">${docsList()}</section>
      ${C ? `<section class="ns-card ivs-card" aria-label="Licences checklist" id="licences">${licences()}</section>` : ''}`;
    } else body = '<div id="biz-body" class="biz-body"></div>';
    content(`${bar}<div id="biz-panel" role="tabpanel" aria-labelledby="biz-tab-${tab}" class="biz-panel">${body}</div>`);
    $$('[data-tab]').forEach((b) => { b.onclick = () => { tab = b.dataset.tab; history.replaceState(null, '', '#' + tab); paint(); }; });
    if (tab === 'business') renderBusiness($('#biz-body'), ctx, B, async (nb) => { B = nb; S = await rpc('invest_summary', { p_property: ctx.property_id }); paint(); });
    wire();
  }

  // ---------------------------------------------------------------- hero: payback
  function welcome() {
    return `<section class="ns-card ivs-welcome">
      <div><div class="ns-h3" style="font-size:20px">How much did you invest to start ${esc(ctx.property_name)}?</div>
        <p class="ns-muted" style="margin:6px 0 0;line-height:1.55">Add what you spent before opening (interiors, beds, deposit, kitchen) and any upgrades later.
        NammaStay then shows how much of it your profit has paid back, when you'll break even, and celebrates each milestone.
        Profit so far since ${esc(fmtDate(S.opened_on))}: <b>${rupees(S.recovered_paise)}</b>.</p></div>
      <span style="display:flex;gap:10px;flex-wrap:wrap"><button type="button" class="ns-btn" data-inv-list>Choose from a list of usual items</button>
        <button type="button" class="ns-btn-ghost" data-inv-first>Add one item</button></span></section>`;
  }
  function hero() {
    const pct = Math.max(0, Math.min(100, Number(S.pct || 0)));
    const done = S.remaining_paise === 0;
    const R0 = (p) => rupees(Math.round(Number(p || 0) / 100) * 100);
    const P = B?.payback; const withLoan = P && P.interest_paid_paise > 0;
    const real = withLoan ? Math.max(0, Math.min(100, Number(P.real_pct || 0))) : null;
    // ring: outer = payback from profit, inner = after loan interest (only with a loan)
    const C1 = 2 * Math.PI * 78; const C2 = 2 * Math.PI * 62;
    const ring = `<svg class="pb-ring" viewBox="0 0 190 190" role="img" aria-label="${Math.floor(pct)} percent paid back${withLoan ? `, ${Math.floor(real)} percent after loan interest` : ''}">
      <circle cx="95" cy="95" r="78" fill="none" stroke="#24305A" stroke-width="14"/>
      <circle cx="95" cy="95" r="78" fill="none" stroke="${done ? '#F2B33D' : '#3CC48F'}" stroke-width="14" stroke-linecap="round" stroke-dasharray="${(C1 * pct / 100).toFixed(1)} ${C1.toFixed(1)}" transform="rotate(-90 95 95)"/>
      ${withLoan ? `<circle cx="95" cy="95" r="62" fill="none" stroke="#24305A" stroke-width="7"/>
      <circle cx="95" cy="95" r="62" fill="none" stroke="#F2B33D" stroke-width="7" stroke-linecap="round" stroke-dasharray="${(C2 * real / 100).toFixed(1)} ${C2.toFixed(1)}" transform="rotate(-90 95 95)"/>` : ''}
      <text x="95" y="${withLoan ? 96 : 100}" text-anchor="middle" class="pb-ring-pct">${Math.floor(pct)}%</text>
      <text x="95" y="${withLoan ? 118 : 124}" text-anchor="middle" class="pb-ring-sub">${done ? 'paid back!' : 'paid back'}</text></svg>`;
    // road to break-even
    const NODES = [[10, 'flag'], [25, 'flag'], [50, 'star'], [75, 'flag'], [100, 'trophy']];
    const nextP = NODES.map(([p]) => p).find((p) => pct < p);
    const road = `<div class="pb-road" role="img" aria-label="Road to break-even: ${Math.floor(pct)} percent so far">
      <div class="pb-road-line"><i style="width:${pct}%"></i></div>
      ${NODES.map(([p, ic]) => `<span class="pb-node ${pct >= p ? 'is-done' : p === nextP ? 'is-next' : ''}" style="left:${p}%">
        <span class="pb-node-dot">${pct >= p ? PB_ICON.check : PB_ICON[ic]}</span><b>${p === 100 ? 'Break-even' : p + '%'}</b></span>`).join('')}
      ${!done ? `<span class="pb-you" style="left:${pct}%"><span>You</span></span>` : ''}</div>`;
    const tile = (icon, tone, label, value, sub) => `<div class="pb-tile"><span class="pb-tile-ic pb-${tone}">${PB_ICON[icon]}</span>
      <div><span class="pb-tile-l">${label}</span><b class="pb-tile-v">${value}</b>${sub ? `<span class="pb-tile-s">${sub}</span>` : ''}</div></div>`;
    const beVal = done ? esc(monthLabel(S.breakeven_month)) : S.breakeven_month ? esc(monthLabel(S.breakeven_month)) : 'Not yet';
    const beSub = done ? 'every rupee is back' : S.breakeven_month ? `about ${S.months_left} month${S.months_left === 1 ? '' : 's'} · at your recent pace` : (S.recovered_paise < 0 ? 'expenses are higher than income so far' : 'needs a few months of profit');
    return `<section class="ivs-hero pb-hero${done ? ' is-done' : ''}" aria-label="Payback progress">
      <div class="pb-top">
        ${ring}
        <div class="pb-head">
          <span class="pb-kicker">${PB_ICON.coins} Money back from profit</span>
          <div class="pb-amount">${R0(Math.max(0, S.recovered_paise))}</div>
          <div class="pb-of">of <b>${R0(S.invested_paise)}</b> you invested</div>
          ${S.recovered_paise < 0 ? `<div class="pb-neg">Profit since opening is ${R0(S.recovered_paise)} — not in profit yet</div>` : ''}
          ${withLoan ? `<div class="pb-legend"><span><i class="pb-dot-g"></i>From profit</span><span><i class="pb-dot-a"></i>After loan interest</span></div>` : ''}
        </div>
      </div>
      ${road}
      <div class="pb-tiles">
        ${tile('calendar', 'amber', done ? 'Break-even reached' : 'Break-even', beVal, beSub)}
        ${tile('target', 'green', 'Still to recover', done ? '₹0' : R0(S.remaining_paise), done ? 'all paid back' : 'from future profit')}
        ${tile('trend', 'blue', 'Avg profit / month', S.avg3_paise == null ? '—' : R0(S.avg3_paise), 'last 3 months · income − expenses')}
        ${withLoan ? tile('bank', 'coral', 'After loan interest', `${Math.floor(real)}%${P.real_breakeven && P.real_breakeven !== 'done' ? ' · ' + esc(monthLabel(P.real_breakeven)) : ''}`, `${R0(P.interest_paid_paise)} interest counted`) : ''}
      </div>
      <div class="ivs-foot pb-foot">${PB_ICON.clock} Counting profit from <b>${esc(fmtDate(S.opened_on))}</b> <button type="button" class="ivs-link" data-open-date>Change opening date</button></div>
    </section>`;
  }

  // ---------------------------------------------------------------- milestones
  function milestones() {
    const ms = S.milestones;
    const got = ms.filter((m) => m.achieved_on).length;
    const tiles = ms.map((m) => {
      const isNext = m.key === S.next;
      const cls = m.achieved_on ? 'is-done' : isNext ? 'is-next' : '';
      const sub = m.achieved_on ? monthLabel(String(m.achieved_on).slice(0, 7))
        : isNext ? `${rupees(S.next_needed_paise)} to go` : m.pct && !S.invested_paise ? 'add your investment' : 'locked';
      return m.achieved_on
        ? `<button type="button" class="ivs-ms ${cls}" data-share="${esc(m.key)}" aria-label="Share: ${esc(m.title)}"><span class="ivs-ms-ic">${ICON.trophy}</span><b>${esc(m.title)}</b><span>${esc(sub)}</span><em class="ivs-ms-share">Share ↗</em></button>`
        : `<div class="ivs-ms ${cls}"><span class="ivs-ms-ic">${ICON.lock}</span><b>${esc(m.title)}</b><span>${esc(sub)}</span></div>`;
    }).join('');
    const nextM = ms.find((m) => m.key === S.next);
    const last = [...ms].filter((m) => m.achieved_on).sort((a, b) => String(b.achieved_on).localeCompare(String(a.achieved_on)))[0];
    return `<div class="ivs-head"><h2 class="ns-h3" style="font-size:19px;margin:0">Milestones</h2><span class="ns-muted">${got} of ${ms.length} achieved</span></div>
      <div class="ivs-ms-grid">${tiles}</div>
      ${nextM || last ? `<div class="ivs-next">${nextM ? `<span><b>Next: ${esc(nextM.title)}</b> · ${rupees(S.next_needed_paise)} more profit${S.avg3_paise > 0 ? `, about ${Math.max(1, Math.ceil(S.next_needed_paise / S.avg3_paise))} month${Math.ceil(S.next_needed_paise / S.avg3_paise) > 1 ? 's' : ''}` : ''}</span>` : '<span><b>All payback milestones reached</b></span>'}
        ${last ? `<button type="button" class="ns-btn-ghost" data-share="${esc(last.key)}">Share “${esc(last.title)}”</button>` : ''}</div>` : ''}`;
  }

  // ---------------------------------------------------------------- monthly profit chart (last 12 months)
  function chart() {
    const ms = S.months.slice(-12);
    const best = S.best_month ? `<div class="ns-muted" style="font-size:12.5px">Best month: <b style="color:#101A3D">${esc(monthLabel(S.best_month.month))}</b> · ${rupees(S.best_month.profit_paise)}</div>` : '';
    const warn = !S.expenses_this_month ? `<a class="ivs-warn" href="expenses.html">No expenses recorded this month yet. Add rent, salaries and bills so your payback stays accurate →</a>` : '';
    if (!ms.length) return `<h2 class="ns-h3" style="font-size:19px;margin:0">Profit each month</h2><div class="ns-empty">No months yet.</div>`;
    const W = 560; const H = 220; const pad = 26; const n = ms.length; const bw = Math.min(34, (W - 20) / n - 8);
    const vals = ms.map((m) => Number(m.profit_paise));
    const max = Math.max(1, ...vals); const min = Math.min(0, ...vals);
    const y = (v) => pad + ((max - v) / (max - min || 1)) * (H - pad * 2);
    const zero = y(0);
    const short = (p) => { const r = p / 100; const a = Math.abs(r); const s = a >= 100000 ? (a / 100000).toFixed(a >= 1000000 ? 0 : 1) + 'L' : a >= 1000 ? Math.round(a / 1000) + 'k' : String(Math.round(a)); return (r < 0 ? '−' : '') + s; };
    const bars = ms.map((m, i) => {
      const x = 10 + i * ((W - 20) / n) + ((W - 20) / n - bw) / 2; const v = vals[i]; const top = Math.min(y(v), zero); const h = Math.max(2, Math.abs(y(v) - zero));
      const cur = i === n - 1 && m.month === String(S.today).slice(0, 7);
      return `<g><title>${monthLabel(m.month)}: income ${rupees(m.revenue_paise)}, expenses ${rupees(m.expenses_paise)}, profit ${rupees(v)}</title>
        <rect x="${x}" y="${top}" width="${bw}" height="${h}" rx="5" fill="${v < 0 ? '#C2412D' : cur ? '#9FD9BF' : '#1C9A6C'}"></rect>
        <text x="${x + bw / 2}" y="${v < 0 ? top + h + 13 : top - 6}" text-anchor="middle" font-size="11" font-weight="700" fill="#2B3658">${short(v)}</text>
        <text x="${x + bw / 2}" y="${H - 4}" text-anchor="middle" font-size="11" fill="#5B6478">${monthLabel(m.month, false)}</text></g>`;
    }).join('');
    return `<div class="ivs-head"><h2 class="ns-h3" style="font-size:19px;margin:0">Profit each month</h2><a href="expenses.html" class="ns-muted" style="font-size:12.5px">Expenses &amp; profit →</a></div>
      <div class="ns-muted" style="font-size:12.5px;margin-top:2px">Income minus expenses · this month (light) is still running</div>
      <svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Profit for the last ${n} months" style="margin-top:10px;max-height:260px">
        <line x1="0" x2="${W}" y1="${zero}" y2="${zero}" stroke="#E7DFC7" stroke-width="2"></line>${bars}</svg>
      ${best}${warn}`;
  }

  // ---------------------------------------------------------------- investments
  function itemsTable() {
    const who = (id) => { const pid = B?.partners?.paid_by?.[id]; const p = pid && B.partners.items.find((x) => x.id === pid); return p ? (p.is_me ? 'Paid by you' : 'Paid by ' + p.name) : ''; };
    const rows = S.items.map((it) => `<tr><td><b>${esc(it.title)}</b>${it.note || who(it.id) ? `<div class="ns-muted" style="font-size:12.5px">${esc([who(it.id), it.note].filter(Boolean).join(' · '))}</div>` : ''}</td>
      <td style="white-space:nowrap" class="ns-muted">${esc(fmtDate(it.invested_on))}</td><td style="text-align:right;font-weight:800;white-space:nowrap">${rupees(it.amount_paise)}</td>
      <td style="white-space:nowrap;text-align:right"><button type="button" class="ivs-link" data-inv-edit="${esc(it.id)}">Edit</button></td></tr>`).join('');
    return `<div class="ivs-head"><h2 class="ns-h3" style="font-size:19px;margin:0">What you invested</h2><span style="display:flex;gap:12px"><button type="button" class="ivs-link" data-inv-list>Choose from list</button><button type="button" class="ivs-link" data-inv-new>+ Add</button></span></div>
      ${S.items.length ? `<div style="overflow-x:auto"><table class="ivs-table"><thead><tr><th>Item</th><th>Date</th><th style="text-align:right">Amount</th><th></th></tr></thead>
        <tbody>${rows}<tr class="ivs-total"><td>Total invested</td><td></td><td style="text-align:right">${rupees(S.invested_paise)}</td><td></td></tr></tbody></table></div>`
        : '<div class="ns-empty">Nothing added yet. Add interiors, beds, deposit, kitchen and later upgrades.</div>'}`;
  }

  // ---------------------------------------------------------------- legal documents
  function docsList() {
    const PILL = { expired: ['Expired', 'ivs-pill-red'], due: [null, 'ivs-pill-amber'], valid: ['Valid', 'ivs-pill-green'], no_expiry: ['Stored', 'ivs-pill-grey'] };
    const rows = D.map((d) => {
      const [label, cls] = PILL[d.status];
      const txt = d.status === 'due' ? (d.days_left === 0 ? 'Expires today' : `${d.days_left} day${d.days_left === 1 ? '' : 's'} left`) : label;
      const sub = [DOC[d.doc_type] && DOC[d.doc_type] !== d.title ? DOC[d.doc_type] : '', d.doc_number ? 'No. ' + d.doc_number : '',
        d.expires_on ? (d.status === 'expired' ? 'Expired ' : 'Expires ') + fmtDate(d.expires_on) : 'No expiry'].filter(Boolean).join(' · ');
      return `<div class="ivs-doc"><span class="ivs-doc-ic">${ICON.doc}</span>
        <div class="ivs-doc-main"><b>${esc(d.title)}</b><div class="ns-muted" style="font-size:12.5px">${esc(sub)}</div></div>
        <span class="ivs-pill ${cls}">${esc(txt)}</span>
        <span class="ivs-doc-act">${d.file_path ? `<button type="button" class="ivs-link" data-doc-view="${esc(d.id)}">View</button>` : '<span class="ns-muted" style="font-size:12px">No file</span>'}
          <button type="button" class="ivs-link" data-doc-edit="${esc(d.id)}">Edit</button></span></div>`;
    }).join('');
    return `<div class="ivs-head"><h2 class="ns-h3" style="font-size:19px;margin:0">Legal documents</h2><button type="button" class="ns-btn" style="height:36px" data-doc-new>+ Upload</button></div>
      <div class="ns-muted" style="font-size:12.5px;margin:4px 0 8px">Stored privately — only you can open them. Reminders in your bell 30, 15 and 3 days before expiry.</div>
      ${D.length ? rows : `<div class="ns-empty">Keep your trade licence, fire NOC, FSSAI, GST, police registration, rental agreement and insurance here, with expiry dates.</div>`}`;
  }

  // ---------------------------------------------------------------- licences checklist (state + property type)
  function licences() {
    const code = C.state_code; const kind = C.kind || defaultKind();
    const head = `<div class="ivs-head"><h2 class="ns-h3" style="font-size:19px;margin:0">Licences checklist</h2>
        <div class="ivs-lic-pick">
          <label class="ivs-sr" for="lic-state">State</label><select class="ns-input" id="lic-state"><option value="">Choose your state…</option>${options(STATE_OPTIONS, code || '')}</select>
          <label class="ivs-sr" for="lic-kind">Property type</label><select class="ns-input" id="lic-kind">${options(KINDS, kind)}</select></div></div>
      <p class="ivs-lic-note">General guidance from official and public sources, checked ${esc(fmtDate(CHECKED_ON))}. Not legal advice — rules differ by city and change often; confirm with your local office or a consultant before you rely on it.</p>`;
    if (!code) return head + '<div class="ns-empty">Choose your state to see the licences a property like yours usually needs.</div>';
    const have = new Set(C.doc_types || []);
    const list = checklist(code, kind).map((it) => {
      const mark = C.marks?.[it.key];
      const status = it.info ? 'info' : mark === 'not_needed' ? 'na' : (it.doc && have.has(it.doc)) ? 'vault' : mark === 'done' ? 'done' : 'missing';
      return { ...it, status };
    });
    const counted = list.filter((x) => ['yes', 'check'].includes(x.need) && !x.info && x.status !== 'na');
    const ok = counted.filter((x) => x.status === 'vault' || x.status === 'done').length;
    const pct = counted.length ? Math.round((ok / counted.length) * 100) : 100;
    const GROUPS = [['yes', 'Needed'], ['if', 'Needed if it applies to you'], ['check', 'Often needed — confirm locally'], ['opt', 'Optional / good to have']];
    const row = (it) => {
      const soft = it.need === 'if' ? ['ivs-lic-soft', 'If it applies'] : it.need === 'opt' ? ['ivs-lic-soft', 'Optional'] : ['ivs-lic-miss', 'Missing'];
      const st = { vault: ['ivs-lic-ok', 'In your documents'], done: ['ivs-lic-ok', 'Marked done'], na: ['ivs-lic-na', 'Not needed'], missing: soft, info: ['ivs-lic-info', 'Good to know'] }[it.status];
      const links = (it.links || []).map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} ↗</a>`).join(' · ');
      const acts = it.status === 'missing' ? `${it.doc ? `<button type="button" class="ivs-link" data-lic-up="${esc(it.key)}">Upload</button>` : ''}
          <button type="button" class="ivs-link" data-lic-mark="${esc(it.key)}" data-v="done">I have it</button>
          <button type="button" class="ivs-link" data-lic-mark="${esc(it.key)}" data-v="not_needed">Not needed</button>`
        : (it.status === 'done' || it.status === 'na') ? `<button type="button" class="ivs-link" data-lic-mark="${esc(it.key)}" data-v="">Undo</button>` : '';
      return `<details class="ivs-lic ${st[0]}"><summary><span class="ivs-lic-dot" aria-hidden="true"></span><b>${esc(it.title)}</b>
          ${it.when ? `<span class="ivs-lic-when">${esc(it.when)}</span>` : ''}<span class="ivs-lic-st">${st[1]}</span></summary>
        <div class="ivs-lic-body"><p>${esc(it.what)}</p><p class="ns-muted"><b>Who issues it:</b> ${esc(it.who)}</p>${links ? `<p class="ivs-lic-links">${links}</p>` : ''}
          ${acts ? `<div class="ivs-lic-acts">${acts}</div>` : ''}</div></details>`;
    };
    const groups = GROUPS.map(([n, label]) => {
      const items = list.filter((x) => x.need === n); if (!items.length) return '';
      const inner = items.map(row).join('');
      return n === 'opt' ? `<details class="ivs-lic-group"><summary class="ivs-lic-gh">${label} (${items.length})</summary>${inner}</details>`
        : `<div class="ivs-lic-gh">${label}</div>${inner}`;
    }).join('');
    return `${head}<div class="ivs-lic-progress"><div class="ivs-lic-bar"><i style="width:${pct}%"></i></div>
        <span><b>${ok} of ${counted.length}</b> needed documents in place · ${esc(STATES[code]?.name || '')} · ${esc(Object.fromEntries(KINDS)[kind])}</span></div>${groups}`;
  }

  function wire() {
    $$('[data-inv-first],[data-inv-new]').forEach((b) => { b.onclick = () => investDialog(); });
    $$('[data-inv-list]').forEach((b) => { b.onclick = () => listDialog(); });
    $$('[data-inv-edit]').forEach((b) => { b.onclick = () => investDialog(S.items.find((x) => x.id === b.dataset.invEdit)); });
    $$('[data-doc-new]').forEach((b) => { b.onclick = () => docDialog(); });
    $$('[data-doc-edit]').forEach((b) => { b.onclick = () => docDialog(D.find((x) => x.id === b.dataset.docEdit)); });
    $$('[data-doc-view]').forEach((b) => { b.onclick = () => viewDoc(D.find((x) => x.id === b.dataset.docView)); });
    $$('[data-open-date]').forEach((b) => { b.onclick = () => openDateDialog(); });
    $$('[data-share]').forEach((b) => { b.onclick = () => shareCard(S.milestones.find((m) => m.key === b.dataset.share)); });
    const saveLic = async (p) => { C = await rpc('legal_checklist_save', { p_property: ctx.property_id, p }); $('#licences').innerHTML = licences(); wire(); };
    $('#lic-state')?.addEventListener('change', (e) => saveLic({ state_code: e.target.value || null }).catch((err) => toast(err.message, { error: true })));
    $('#lic-kind')?.addEventListener('change', (e) => saveLic({ kind: e.target.value }).catch((err) => toast(err.message, { error: true })));
    $$('[data-lic-mark]').forEach((b) => { b.onclick = () => saveLic({ item_key: b.dataset.licMark, status: b.dataset.v || null }).catch((err) => toast(err.message, { error: true })); });
    $$('[data-lic-up]').forEach((b) => { b.onclick = () => {
      const it = checklist(C.state_code, C.kind || defaultKind()).find((x) => x.key === b.dataset.licUp);
      if (it) docDialog(null, { doc_type: it.doc, title: it.title.slice(0, 80) });
    }; });
  }

  // ---------------------------------------------------------------- dialogs
  function investDialog(it = null) {
    const m = modal({
      title: it ? 'Edit investment' : 'Add investment', width: 460,
      body: `<div style="display:flex;flex-direction:column;gap:14px">
        ${it ? '' : '<button type="button" class="ivs-link" data-to-list style="align-self:flex-start;padding:0">Pick several from the list of usual items →</button>'}
        ${field('What was it for?', `<input class="ns-input" name="title" maxlength="80" list="ivs-ideas" value="${esc(it?.title || '')}" placeholder="e.g. Interiors & furniture">
          <datalist id="ivs-ideas">${['Interiors & furniture', 'Rental deposit', 'Beds, mattresses & lockers', 'Kitchen & appliances', 'Air conditioners', 'Renovation', 'Licences & registration', 'Website & branding'].map((x) => `<option value="${esc(x)}"></option>`).join('')}</datalist>`)}
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">
          ${field('Amount (₹)', `<input class="ns-input" name="amount" inputmode="decimal" value="${it ? it.amount_paise / 100 : ''}" placeholder="250000">`)}
          ${field('Date', `<input class="ns-input" type="date" name="on" max="${ymd()}" value="${esc(it?.invested_on || ymd())}">`)}
        </div>
        ${field('Note (optional)', `<input class="ns-input" name="note" maxlength="200" value="${esc(it?.note || '')}" placeholder="e.g. Refundable at end of lease">`)}
        ${B?.profile?.has_partners && B.partners.items.length ? field('Paid by', `<select class="ns-input" name="paidby"><option value="">— not set —</option>${B.partners.items.map((p) => `<option value="${esc(p.id)}" ${B.partners.paid_by?.[it?.id] === p.id ? 'selected' : ''}>${esc(p.is_me ? p.name + ' (you)' : p.name)}</option>`).join('')}</select>`) : ''}
      </div>`,
      actions: [
        ...(it ? [{ label: 'Delete', kind: 'danger', onClick: async () => {
          if (!await confirmDialog('Delete investment', `Delete “${it.title}” (${rupees(it.amount_paise)})?`, { confirmLabel: 'Delete', danger: true })) return false;
          await rpc('investment_delete', { p_id: it.id }); toast('Deleted.'); await draw(); } }] : []),
        { label: 'Cancel' },
        { label: 'Save', kind: 'primary', onClick: async (el) => {
          const v = (n) => el.querySelector(`[name=${n}]`).value.trim();
          const amt = toPaise(v('amount'));
          if (!v('title')) throw new Error('Give it a name, e.g. Interiors.');
          if (!(amt > 0)) throw new Error('Enter the amount in rupees.');
          const saved = await rpc('investment_save', { p_property: ctx.property_id, p: { id: it?.id || null, title: v('title'), amount_paise: amt, invested_on: v('on'), note: v('note') } });
          const pb = el.querySelector('[name=paidby]');
          if (pb && saved?.id && (pb.value || null) !== (B.partners.paid_by?.[saved.id] || null)) await rpc('biz_investment_partner', { p_investment: saved.id, p_partner: pb.value || null });
          toast(it ? 'Investment updated.' : 'Investment added.'); await draw();
        } },
      ],
    });
    m.el.querySelector('[data-to-list]')?.addEventListener('click', () => { m.close(); listDialog(); });
    return m;
  }

  // ---------------------------------------------------------------- choose several items from the usual-items list
  function listDialog() {
    let kind = C?.kind || defaultKind();
    const picked = new Map();   // name → { qty, price }
    const body = () => setupItems(kind).map((g, gi) => `<details class="ivs-pick-g" ${gi === 0 ? 'open' : ''}><summary>${esc(g.title)} <span class="ns-muted">(${g.items.length})</span></summary>
      ${g.items.map((it) => { const p = picked.get(it.name); return `<div class="ivs-pick${p ? ' is-on' : ''}" data-name="${esc(it.name)}">
        <label class="ivs-pick-name"><input type="checkbox" ${p ? 'checked' : ''}> ${esc(it.name)}</label>
        <span class="ivs-pick-in"><input class="ns-input" inputmode="numeric" aria-label="Quantity of ${esc(it.name)}" data-q value="${p ? p.qty : ''}" placeholder="${it.unit === 'lump sum' ? '1' : 'Qty'}" ${it.unit === 'lump sum' ? 'disabled' : ''}>
          <span class="ns-muted">×</span><input class="ns-input" inputmode="decimal" aria-label="Price of ${esc(it.name)} in rupees" data-p value="${p ? p.price / 100 : ''}" placeholder="₹ ${it.unit === 'lump sum' ? 'amount' : 'per ' + it.unit}"></span>
        <b class="ivs-pick-t">${p && p.price ? rupees(p.price * p.qty) : ''}</b></div>`; }).join('')}</details>`).join('');
    const m = modal({
      title: 'Choose from the usual items', width: 760,
      body: `<div style="display:flex;flex-direction:column;gap:12px">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px">
          ${field('Property type', `<select class="ns-input" name="kind">${options(SETUP_KINDS, kind)}</select>`)}
          ${field('Date bought', `<input class="ns-input" type="date" name="on" max="${ymd()}" value="${esc(S?.opened_on && S.opened_on < ymd() ? S.opened_on : ymd())}">`)}
          ${field('Search', '<input class="ns-input" name="q" placeholder="e.g. beds, CCTV">')}
        </div>
        <p class="ns-muted" style="margin:0;font-size:12.5px">Tick what you bought and enter the quantity and price. Prices are yours to enter — costs vary by city and quality.</p>
        <div class="ivs-pick-list" id="pick-list">${body()}</div>
        <div class="ivs-pick-sum" id="pick-sum"></div></div>`,
      actions: [{ label: 'Cancel' }, { label: 'Add selected', kind: 'primary', onClick: async (el) => {
        const on = el.querySelector('[name=on]').value || ymd();
        const rows = [...picked.entries()].filter(([, p]) => p.price > 0);
        if (!rows.length) throw new Error('Tick at least one item and enter its price.');
        for (const [name, p] of rows) {
          await rpc('investment_save', { p_property: ctx.property_id, p: { title: (p.qty > 1 ? `${name} × ${p.qty}` : name).slice(0, 80),
            amount_paise: p.price * p.qty, invested_on: on, note: p.qty > 1 ? `${p.qty} × ${rupees(p.price)}` : '' } });
        }
        toast(`${rows.length} investment${rows.length > 1 ? 's' : ''} added.`); await draw();
      } }],
    });
    const el = m.el; const list = el.querySelector('#pick-list');
    const sum = () => {
      const rows = [...picked.values()].filter((p) => p.price > 0);
      el.querySelector('#pick-sum').innerHTML = rows.length ? `<b>${rows.length} item${rows.length > 1 ? 's' : ''} · ${rupees(rows.reduce((a, p) => a + p.price * p.qty, 0))}</b>` : '<span class="ns-muted">Nothing selected yet</span>';
    };
    const read = (row) => {
      const name = row.dataset.name; const on = row.querySelector('[type=checkbox]').checked;
      const qty = Math.max(1, parseInt(row.querySelector('[data-q]').value, 10) || 1); const price = Math.max(0, toPaise(row.querySelector('[data-p]').value) || 0);
      if (on) picked.set(name, { qty, price }); else picked.delete(name);
      row.classList.toggle('is-on', on); row.querySelector('.ivs-pick-t').textContent = on && price ? rupees(price * qty) : ''; sum();
    };
    list.addEventListener('input', (e) => {
      const row = e.target.closest('.ivs-pick'); if (!row) return;
      if (e.target.matches('[data-q],[data-p]') && e.target.value.trim()) row.querySelector('[type=checkbox]').checked = true;
      read(row);
    });
    list.addEventListener('change', (e) => { const row = e.target.closest('.ivs-pick'); if (row) read(row); });
    el.querySelector('[name=kind]').addEventListener('change', (e) => { kind = e.target.value; list.innerHTML = body(); filter(); });
    const filter = () => {
      const q = el.querySelector('[name=q]').value.trim().toLowerCase();
      list.querySelectorAll('.ivs-pick').forEach((r) => { r.hidden = !!q && !r.dataset.name.toLowerCase().includes(q); });
      list.querySelectorAll('.ivs-pick-g').forEach((g) => { const any = [...g.querySelectorAll('.ivs-pick')].some((r) => !r.hidden); g.hidden = !any; if (q && any) g.open = true; });
    };
    el.querySelector('[name=q]').addEventListener('input', filter);
    sum();
  }

  function openDateDialog() {
    modal({
      title: 'Opening date', width: 420,
      body: `<p class="ns-muted" style="margin:0 0 12px;line-height:1.55">Profit is counted from this date. Use the day your property started taking guests.</p>
        ${field('Opened on', `<input class="ns-input" type="date" name="d" max="${ymd()}" value="${esc(S.opened_on)}">`)}`,
      actions: [{ label: 'Cancel' }, { label: 'Save', kind: 'primary', onClick: async (el) => {
        await rpc('invest_settings_save', { p_property: ctx.property_id, p_opened_on: el.querySelector('[name=d]').value });
        toast('Opening date saved.'); await draw();
      } }],
    });
  }

  function docDialog(d = null, preset = null) {
    const dlg = modal({
      title: d ? 'Edit document' : 'Upload document', width: 520,
      body: `<div style="display:flex;flex-direction:column;gap:14px">
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">
          ${field('Type', `<select class="ns-input" name="type">${options(DOC_TYPES, d?.doc_type || preset?.doc_type || 'trade_licence')}</select>`)}
          ${field('Name', `<input class="ns-input" name="title" maxlength="80" value="${esc(d?.title || preset?.title || 'Trade licence')}">`)}
        </div>
        ${field('Number (optional)', `<input class="ns-input" name="num" maxlength="60" value="${esc(d?.doc_number || '')}" placeholder="Licence / certificate number">`)}
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">
          ${field('Issued on', `<input class="ns-input" type="date" name="iss" value="${esc(d?.issued_on || '')}">`)}
          ${field('Expires on', `<input class="ns-input" type="date" name="exp" value="${esc(d?.expires_on || '')}">`, 'Leave empty if it never expires.')}
        </div>
        ${field(d?.file_path ? 'Replace file (optional)' : 'File (PDF or photo, up to 10 MB)', '<input class="ns-input" type="file" name="file" accept="application/pdf,image/jpeg,image/png,image/webp" style="padding:8px">',
          d?.file_name ? `Current file: ${esc(d.file_name)}` : '')}
        ${field('Note (optional)', `<input class="ns-input" name="note" maxlength="300" value="${esc(d?.note || '')}" placeholder="e.g. Renew at the municipal office">`)}
      </div>`,
      actions: [
        ...(d ? [{ label: 'Delete', kind: 'danger', onClick: async () => {
          if (!await confirmDialog('Delete document', `Delete “${d.title}” and its file?`, { confirmLabel: 'Delete', danger: true })) return false;
          const r = await rpc('legal_doc_delete', { p_id: d.id });
          if (r?.file_path) await sb.storage.from(BUCKET).remove([r.file_path]).catch(() => {});
          toast('Document deleted.'); await draw(); } }] : []),
        { label: 'Cancel' },
        { label: 'Save', kind: 'primary', onClick: async (el) => {
          const v = (n) => el.querySelector(`[name=${n}]`).value.trim();
          const file = el.querySelector('[name=file]').files[0];
          if (!v('title')) throw new Error('Give the document a name.');
          if (!d && !file && !v('exp')) throw new Error('Add the file, or at least the expiry date for reminders.');
          const p = { id: d?.id || null, doc_type: v('type'), title: v('title'), doc_number: v('num'), issued_on: v('iss'), expires_on: v('exp'), note: v('note') };
          let uploaded = null;
          if (file) {
            if (file.size > MAX_FILE) throw new Error('That file is over 10 MB. Use a smaller PDF or photo.');
            if (!/^(application\/pdf|image\/(jpeg|png|webp))$/.test(file.type)) throw new Error('Use a PDF, JPG, PNG or WebP file.');
            const ext = file.type === 'application/pdf' ? 'pdf' : file.type.split('/')[1].replace('jpeg', 'jpg');
            uploaded = `${ctx.property_id}/${crypto.randomUUID()}.${ext}`;
            const { error } = await sb.storage.from(BUCKET).upload(uploaded, file, { upsert: false, contentType: file.type });
            if (error) throw new Error(/bucket|not found/i.test(error.message) ? 'Document storage isn’t set up yet (run 036_investment.sql).' : error.message);
            Object.assign(p, { file_path: uploaded, file_name: file.name.slice(0, 160), file_size: file.size });
          }
          try {
            const r = await rpc('legal_doc_save', { p_property: ctx.property_id, p });
            if (r?.old_file_path) await sb.storage.from(BUCKET).remove([r.old_file_path]).catch(() => {});
          } catch (e) {
            if (uploaded) await sb.storage.from(BUCKET).remove([uploaded]).catch(() => {});
            throw e;
          }
          toast(d ? 'Document updated.' : 'Document saved.'); await draw();
        } },
      ],
    });
    const type = dlg.el.querySelector('[name=type]'); const title = dlg.el.querySelector('[name=title]');
    if (type && title) {
      let auto = (!d && !preset) || (d && title.value === DOC[d.doc_type]);
      title.addEventListener('input', () => { auto = false; });
      type.addEventListener('change', () => { if (auto) title.value = type.value === 'other' ? '' : DOC[type.value]; });
    }
  }

  async function viewDoc(d) {
    if (!d?.file_path) return;
    const w = window.open('', '_blank');
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(d.file_path, 120);
    if (error || !data?.signedUrl) { w?.close(); toast(error?.message || 'Could not open the file.', { error: true }); return; }
    if (w) w.location = data.signedUrl; else location.href = data.signedUrl;
  }

  // ---------------------------------------------------------------- share a milestone as an image (owner's choice; no money amounts on it)
  // Share a milestone: preview, theme, size; no money amounts on the card.
  function shareCard(m) {
    if (!m || !m.achieved_on) return;
    let theme = 'night'; let size = 'post'; let showPct = true; let blob = null;
    const dlg = modal({
      title: 'Share your milestone', width: 620,
      body: `<div class="ivs-share">
          <div class="ivs-share-prev"><img alt="Preview of the milestone card" data-prev></div>
          <div class="ivs-share-opts">
            <div class="ns-field"><label>Style</label><div class="ivs-swatches">${Object.entries(CARD_THEMES).map(([k, t]) => `<button type="button" data-theme="${k}" aria-pressed="${k === theme}" style="--sw:${t.bg};--sw2:${t.accent}"><i></i>${esc(t.name)}</button>`).join('')}</div></div>
            ${field('Size', `<select class="ns-input" name="size">${options(Object.entries(CARD_SIZES).map(([k, v]) => [k, v[2]]), size)}</select>`)}
            ${/^p\d+$/.test(m.key) ? '' : `<label class="ivs-check"><input type="checkbox" name="pct" checked> Show “% of investment paid back”</label>`}
            <p class="ns-muted" style="font-size:12.5px;margin:0">No money amounts are shown — safe to post on WhatsApp Status, Instagram or Google.</p>
          </div></div>`,
      actions: [{ label: 'Download', onClick: async () => { await render(); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `nammastay-${m.key}.png`; a.click(); toast('Image saved.'); return false; } },
        { label: 'Share', kind: 'primary', onClick: async () => {
          await render(); const file = new File([blob], `nammastay-${m.key}.png`, { type: 'image/png' });
          if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], text: `${m.title} at ${ctx.property_name}! 🎉` }); return; } catch { return false; } }
          const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click(); toast('Image saved — share it on WhatsApp or Instagram.'); return false;
        } }],
    });
    const el = dlg.el;
    async function render() {
      const c = await drawMilestoneCard({ m, property: ctx.property_name, openedOn: S.opened_on, pct: S.pct, showPct, theme, size });
      blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      const img = el.querySelector('[data-prev]'); if (img.src) URL.revokeObjectURL(img.src); img.src = URL.createObjectURL(blob);
    }
    el.querySelectorAll('[data-theme]').forEach((b) => { b.onclick = () => { theme = b.dataset.theme; el.querySelectorAll('[data-theme]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); render(); }; });
    el.querySelector('[name=size]').onchange = (e) => { size = e.target.value; render(); };
    el.querySelector('[name=pct]')?.addEventListener('change', (e) => { showPct = e.target.checked; render(); });
    render();
  }

  await draw();
  if (/^#(docs|licences)$/.test(location.hash)) $(location.hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
