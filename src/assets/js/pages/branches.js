// Branches (043_branches.sql): owners with more than one property.
// One screen for every branch (today / this month), "full here, free there", compare, team across branches, + Add branch.
// Owner only. Each branch stays its own property: own bookings, guests, money and subscription.
import { page, rpc, content, setSubtitle, headerActions, esc, rupees, fmtDate, modal, field, options, toast, confirmDialog, waNumber, param, SITE_URL, $, $$ } from '../core.js';

const I = (d, w = 18, sw = 2) => `<svg aria-hidden="true" width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const P = {
  home: '<path d="M3 10l9-7 9 7v10a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  swap: '<path d="M7 7h13l-3-3M17 17H4l3 3"/>', wa: '<path d="M21 12a9 9 0 0 1-13.5 7.8L3 21l1.3-4.4A9 9 0 1 1 21 12z"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c0-3.6 2.9-6.4 6.5-6.4s6.5 2.8 6.5 6.4"/><circle cx="18" cy="9" r="2.3"/><path d="M15.8 13.8c2.3.5 4.2 2.5 4.2 5.4"/>',
  chart: '<path d="M4 19V10"/><path d="M12 19V5"/><path d="M20 19v-7"/>', down: '<path d="M12 4v12M6 10l6 6 6-6M4 20h16"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
};
const TYPE = { hostel: 'Hostel', hotel: 'Hotel', homestay: 'Homestay', resort: 'Resort', pg: 'PG / Co-living' };
const ROLE = { manager: 'Manager', front_desk: 'Front desk', accountant: 'Accountant' };
const bedsy = (m) => m === 'hostel' || m === 'pg';
const unit = (m, n) => (bedsy(m) ? (n === 1 ? 'bed' : 'beds') : (n === 1 ? 'room' : 'rooms'));
const family = (m) => (m === 'pg' ? 'pg' : bedsy(m) ? 'beds' : 'rooms');      // who can take whose guests tonight
const pct = (x) => `${Math.round((x || 0) * 100)}%`;
const rr = (p) => rupees(Math.round(Number(p || 0) / 100) * 100);
const dOf = (d) => new Date(d + 'T12:00:00Z');
const dayLabel = (d) => dOf(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const longDay = (d) => dOf(d).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const addDay = (d, n) => { const t = dOf(d); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;

let D = null; let CTX = null; let period = 'today';

/** Open another branch: the app works on one property at a time (the same switch as the menu). */
function go(id, href) {
  try { localStorage.setItem('ns.property', id); } catch { /* blocked storage: the switch still works for this tab */ }
  location.href = href;
}

page('branches', async (ctx) => {
  CTX = ctx;
  if (ctx.role !== 'owner') { content('<div class="ns-card ns-empty">The Branches page is for the owner.</div>'); return; }
  try { if (localStorage.getItem('ns.br.period') === 'month') period = 'month'; } catch { /* default: today */ }
  headerActions().innerHTML = `<div class="br-seg" role="group" aria-label="Show numbers for">
      <button type="button" data-period="today">Today</button><button type="button" data-period="month">This month</button></div>
    <button type="button" class="ns-btn" id="br-add">${I(P.plus, 16, 2.4)} Add branch</button>`;
  $$('[data-period]').forEach((b) => b.addEventListener('click', () => {
    period = b.dataset.period; try { localStorage.setItem('ns.br.period', period); } catch { /* fine */ }
    draw();
  }));
  $('#br-add').addEventListener('click', addDialog);
  await load();
  if (param('add')) { history.replaceState(null, '', 'branches.html'); addDialog(); }
});

async function load() {
  try { D = await rpc('branches_overview'); }
  catch (e) {
    const missing = /branches_overview|schema cache|Could not find/i.test(e.message || '');
    content(`<div class="ns-card ns-empty">${missing ? 'Branches isn’t installed on this database yet. Ask your developer to run 043_branches.sql, then press Ctrl+F5.' : esc(e.message)}</div>`);
    return;
  }
  draw();
}

function draw() {
  const B = D.branches || [];
  $$('[data-period]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.period === period)));
  const today = B.find((b) => b.id === CTX.property_id)?.today || B[0]?.today;
  setSubtitle(`${plural(B.length, 'property', 'properties')}${today ? ' · ' + longDay(today) : ''}`);
  content(`
    ${totals(B)}
    ${B.length === 1 ? intro(B[0]) : suggestions(B)}
    <section class="br-grid" aria-label="Your branches">${B.map(card).join('')}</section>
    ${B.length > 1 ? compare(B) : ''}
    ${team(B)}`);
  wire();
}

// ---------------------------------------------------------------- totals
function totals(B) {
  const sum = (f) => B.reduce((s, b) => s + (Number(f(b)) || 0), 0);
  const units = sum((b) => b.units);
  const words = [...new Set(B.filter((b) => b.units > 0).map((b) => (bedsy(b.mode) ? 'beds' : 'rooms')))];
  const tile = (label, value, note, cls = '') => `<div class="br-tile ${cls}"><span>${esc(label)}</span><b>${esc(value)}</b><small>${esc(note)}</small></div>`;
  if (period === 'today') {
    const unpaid = sum((b) => b.arriving_unpaid); const cash = sum((b) => b.cash_today); const coll = sum((b) => b.collected_today);
    return `<section class="br-tiles" aria-label="All branches today">
      ${tile('Occupancy tonight', units ? pct(sum((b) => b.tonight) / units) : '—', `${sum((b) => b.tonight)} of ${units} ${words.length === 1 ? words[0] : 'beds & rooms'}`)}
      ${tile('Arriving today', String(sum((b) => b.arriving)), unpaid ? `${unpaid} not paid yet` : 'all paid')}
      ${tile('Leaving today', String(sum((b) => b.leaving)), 'across all branches')}
      ${tile('Collected today', rr(coll), `${rr(cash)} cash · ${rr(coll - cash)} online`)}
      ${tile('Dues', rr(sum((b) => b.dues)), 'still to collect', 'is-dark')}
    </section>`;
  }
  const rev = sum((b) => b.month.revenue); const exp = sum((b) => b.month.expenses);
  const cap = sum((b) => b.units * b.month.days); const bk = sum((b) => b.month.bookings);
  const best = B.length > 1 ? [...B].sort((a, b) => b.month.profit - a.month.profit)[0] : null;
  return `<section class="br-tiles" aria-label="All branches this month">
    ${tile('Occupancy', cap ? pct(sum((b) => b.month.nights_sold) / cap) : '—', `1 to ${dOf(B[0].today).getUTCDate()} ${dOf(B[0].today).toLocaleDateString('en-IN', { month: 'long', timeZone: 'UTC' })}`)}
    ${tile('Revenue', rr(rev), 'money received')}
    ${tile('Expenses', rr(exp), 'incl. salaries')}
    ${tile('Profit', rr(rev - exp), best && best.month.profit > 0 ? `best: ${best.name}` : 'revenue − expenses', rev - exp < 0 ? 'is-red' : '')}
    ${tile('Bookings', String(bk), bk ? `${Math.round(sum((b) => b.month.direct) * 100 / bk)}% direct (not OTA)` : 'this month', 'is-dark')}
  </section>`;
}

function intro(b) {
  return `<section class="br-intro">
    <div><h2>Run more than one property?</h2>
      <p>Add each one as a branch. Same login, one tap to switch, and this page shows all of them together. Each branch has its own bookings, guests, money and its own plan, with a free trial to start.</p></div>
    <button type="button" class="ns-btn" data-add>${I(P.plus, 16, 2.4)} Add a branch</button>
  </section>`;
}

// ---------------------------------------------------------------- full here, free there
function suggestions(B) {
  const out = [];
  B.filter((b) => b.units > 0 && b.mode !== 'pg').forEach((b) => (b.nights || []).forEach((n, i) => {
    if (n.occupied < b.units) return;
    const alt = B.filter((o) => o.id !== b.id && o.units > 0 && family(o.mode) === family(b.mode))
      .map((o) => ({ o, free: o.units - (o.nights?.[i]?.occupied || 0) })).filter((x) => x.free > 0).sort((x, y) => y.free - x.free)[0];
    if (alt) out.push({ b, day: n.day, ...alt });
  }));
  if (!out.length) return '';
  out.sort((x, y) => (x.day < y.day ? -1 : x.day > y.day ? 1 : 0));
  return `<section class="br-tips" aria-label="Full here, free there">${out.slice(0, 3).map((s) => `
    <div class="br-tip">
      <div><b>${esc(s.b.name)} is full on ${esc(s.day === s.b.today ? 'tonight' : dayLabel(s.day))}</b>
        <span>${esc(s.o.name)} has ${plural(s.free, unit(s.o.mode, 1), unit(s.o.mode, 2))} free that night. Send the guest there instead of turning them away.</span></div>
      <div class="br-tip-act">
        ${s.o.booking_slug ? `<button type="button" class="ns-btn-ghost br-sm" data-copy="${esc(`${SITE_URL}/stay.html?p=${encodeURIComponent(s.o.booking_slug)}`)}">${I(P.link, 15)} Copy booking link</button>` : ''}
        <button type="button" class="ns-btn br-sm" data-go="${esc(s.o.id)}" data-href="${esc(`check-in.html?new=1&in=${s.day}&out=${addDay(s.day, 1)}`)}">Book at ${esc(s.o.name)}</button>
      </div>
    </div>`).join('')}</section>`;
}

// ---------------------------------------------------------------- one card per branch
function planChip(p) {
  const s = p?.state;
  if (s === 'trial') return `<span class="br-plan is-amber">Free trial · ${plural(p.days_left ?? 0, 'day', 'days')} left</span>`;
  if (s === 'active') return `<span class="br-plan is-green">Paid till ${esc(fmtDate(p.ends_at))}</span>`;
  if (s === 'complimentary') return '<span class="br-plan is-green">Free plan</span>';
  if (s === 'grace') return '<span class="br-plan is-red">Plan ended · renew</span>';
  return '<span class="br-plan is-red">Plan ended</span>';
}

function nightsStrip(b) {
  const n = b.nights || [];
  if (!n.length || !b.units) return '';
  const full = n.filter((x) => x.occupied >= b.units).map((x) => (x.day === b.today ? 'tonight' : dayLabel(x.day)));
  const label = `Next 14 nights: ${full.length ? 'full on ' + full.join(', ') : 'no full nights'}`;
  return `<div class="br-nights-wrap"><div class="br-nights" role="img" aria-label="${esc(label)}">${n.map((x) => {
    const h = Math.max(6, Math.min(100, Math.round((x.occupied / b.units) * 100)));
    return `<i class="${x.occupied >= b.units ? 'is-full' : ''}" style="height:${h}%" title="${esc(dayLabel(x.day))}: ${x.occupied} of ${b.units}"></i>`;
  }).join('')}</div><div class="br-nights-k"><span>Tonight</span><span>${full.length ? `${full.length} full` : 'next 14 nights'}</span><span>${esc(dayLabel(n[n.length - 1].day))}</span></div></div>`;
}

function card(b) {
  const here = b.id === CTX.property_id;
  const occ = period === 'today' ? (b.units ? b.tonight / b.units : 0) : b.month.occupancy;
  const stats = period === 'today'
    ? [['Arriving', b.arriving + (b.arriving_unpaid ? ` · ${b.arriving_unpaid} unpaid` : '')], ['Leaving', b.leaving], ['Collected', rr(b.collected_today)], ['Dues', rr(b.dues)]]
    : [['Bookings', b.month.bookings], ['Revenue', rr(b.month.revenue)], ['Expenses', rr(b.month.expenses)], ['Profit', rr(b.month.profit)]];
  const a = b.alerts || {};
  const chips = [a.to_clean ? `${plural(a.to_clean, unit(b.mode, 1), unit(b.mode, 2))} to clean` : '', a.formc_due ? `${a.formc_due} Form C due` : '',
    a.staff_todo ? `Staff: ${a.staff_todo} to check` : ''].filter(Boolean);
  const wa = waNumber(b.phone);
  return `<article class="ns-card br-card${here ? ' is-here' : ''}">
    <div class="br-card-h">
      <div class="br-card-t"><h2>${esc(b.name)}</h2><p>${esc(TYPE[b.mode] || b.mode)}${b.city ? ' · ' + esc(b.city) : ''}${b.units ? ` · ${plural(b.units, unit(b.mode, 1), unit(b.mode, 2))}` : ''}</p></div>
      ${planChip(b.plan)}
    </div>
    ${here ? '<span class="br-here">You’re working in this branch</span>' : ''}
    ${!b.units ? `<div class="br-setup"><b>Not set up yet</b><span>Add rooms and ${bedsy(b.mode) ? 'beds' : 'prices'} to start taking bookings.</span>
        <button type="button" class="ns-btn br-sm" data-go="${esc(b.id)}" data-href="setup.html">Finish setup</button></div>` : `
    <div class="br-occ"><div class="br-occ-l"><span>${period === 'today' ? 'Occupancy tonight' : 'Occupancy this month'}</span><b>${pct(occ)}</b></div>
      <div class="br-bar" role="img" aria-label="${pct(occ)} occupied"><i style="width:${Math.round(Math.min(1, occ) * 100)}%"></i></div></div>
    <dl class="br-stats">${stats.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(String(v))}</dd></div>`).join('')}</dl>
    ${nightsStrip(b)}`}
    ${chips.length ? `<div class="br-chips">${chips.map((c) => `<span>${esc(c)}</span>`).join('')}</div>` : ''}
    <div class="br-card-act">
      ${here ? `<a class="ns-btn br-sm" href="dashboard.html">Open dashboard</a>` : `<button type="button" class="ns-btn br-sm" data-go="${esc(b.id)}" data-href="dashboard.html">${I(P.swap, 15)} Switch to this branch</button>`}
      ${wa ? `<a class="ns-btn-ghost br-sm" href="https://wa.me/${wa}" target="_blank" rel="noopener">${I(P.wa, 15)} WhatsApp branch</a>` : ''}
      ${b.plan?.state !== 'active' && b.plan?.state !== 'complimentary' ? `<button type="button" class="ns-btn-ghost br-sm" data-go="${esc(b.id)}" data-href="settings.html?tab=billing">Choose plan</button>` : ''}
    </div>
  </article>`;
}

// ---------------------------------------------------------------- compare (this month)
function rows(B) {
  return B.map((b) => ({ name: b.name, occ: b.month.occupancy, avg: b.month.nights_sold ? Math.round(b.month.revenue / b.month.nights_sold) : null,
    rev: b.month.revenue, exp: b.month.expenses, profit: b.month.profit, bookings: b.month.bookings }));
}
function compare(B) {
  const R = rows(B); const t = (f) => R.reduce((s, r) => s + (r[f] || 0), 0);
  const cap = B.reduce((s, b) => s + b.units * b.month.days, 0); const sold = B.reduce((s, b) => s + b.month.nights_sold, 0);
  const td = (v, cls = '') => `<td class="${cls}">${v}</td>`;
  return `<section class="ns-card br-cmp" aria-label="Compare branches">
    <div class="br-sec-h"><h2>${I(P.chart)} This month, side by side</h2>
      <button type="button" class="ns-btn-ghost br-sm" id="br-csv">${I(P.down, 15)} Download for my accountant</button></div>
    <div class="br-scroll"><table class="br-table">
      <thead><tr><th scope="col">Branch</th><th scope="col">Occupancy</th><th scope="col">Avg per night sold</th><th scope="col">Bookings</th><th scope="col">Revenue</th><th scope="col">Expenses</th><th scope="col">Profit</th></tr></thead>
      <tbody>${R.map((r) => `<tr><th scope="row">${esc(r.name)}</th>${td(pct(r.occ))}${td(r.avg == null ? '—' : rr(r.avg))}${td(r.bookings)}${td(rr(r.rev))}${td(rr(r.exp))}${td(rr(r.profit), r.profit < 0 ? 'is-red' : 'is-green')}</tr>`).join('')}</tbody>
      <tfoot><tr><th scope="row">All branches</th>${td(cap ? pct(sold / cap) : '—')}${td(sold ? rr(Math.round(t('rev') / sold)) : '—')}${td(t('bookings'))}${td(rr(t('rev')))}${td(rr(t('exp')))}${td(rr(t('profit')), t('profit') < 0 ? 'is-red' : 'is-green')}</tr></tfoot>
    </table></div>
  </section>`;
}

function downloadCsv() {
  const B = D.branches; const R = rows(B); const r2 = (p) => (Number(p || 0) / 100).toFixed(2);
  const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
  const lines = [['Branch', 'Type', 'City', 'Month from', 'Up to', 'Occupancy %', 'Avg per night sold (Rs)', 'Bookings', 'Revenue (Rs)', 'Expenses (Rs)', 'Profit (Rs)'].map(q).join(',')];
  B.forEach((b, i) => { const r = R[i]; lines.push([b.name, TYPE[b.mode] || b.mode, b.city || '', b.month.from, b.today, Math.round(r.occ * 1000) / 10,
    r.avg == null ? '' : r2(r.avg), r.bookings, r2(r.rev), r2(r.exp), r2(r.profit)].map(q).join(',')); });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  a.download = `branches-${B[0]?.today || 'month'}.csv`; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ---------------------------------------------------------------- team across branches
function team(B) {
  const T = D.team || [];
  if (!T.length) {
    return `<section class="ns-card br-team"><div class="br-sec-h"><h2>${I(P.users)} Who works where</h2></div>
      <p class="br-muted">Nobody else has a login yet. Add your manager or front desk in Settings → Users & roles; then you can give them more branches here.</p></section>`;
  }
  const head = B.map((b) => `<th scope="col">${esc(b.name)}</th>`).join('');
  const body = T.map((p) => `<tr><th scope="row"><b>${esc(p.name)}</b>${p.email && p.email !== p.name ? `<small>${esc(p.email)}</small>` : ''}</th>${B.map((b) => {
    const cur = (p.access || []).find((x) => x.property_id === b.id)?.role || '';
    return `<td><label class="br-vh" for="br-r-${esc(p.user_id)}-${esc(b.id)}">${esc(p.name)} at ${esc(b.name)}</label>
      <select class="br-role" id="br-r-${esc(p.user_id)}-${esc(b.id)}" data-user="${esc(p.user_id)}" data-prop="${esc(b.id)}" data-cur="${esc(cur)}">
        ${options([['', 'No access'], ['manager', 'Manager'], ['front_desk', 'Front desk'], ['accountant', 'Accountant']], cur)}</select></td>`;
  }).join('')}</tr>`).join('');
  return `<section class="ns-card br-team" aria-label="Who works where">
    <div class="br-sec-h"><h2>${I(P.users)} Who works where</h2></div>
    <p class="br-muted">Each person only sees the branches you give them, with that role. To add someone new, open that branch and use Settings → Users & roles.</p>
    <div class="br-scroll"><table class="br-table br-team-t"><thead><tr><th scope="col">Person</th>${head}</tr></thead><tbody>${body}</tbody></table></div>
  </section>`;
}

async function setRole(sel) {
  const role = sel.value || null; const prev = sel.dataset.cur || '';
  const person = (D.team || []).find((p) => p.user_id === sel.dataset.user);
  const branch = D.branches.find((b) => b.id === sel.dataset.prop);
  const left = (person?.access || []).filter((x) => x.property_id !== branch.id).length;
  if (!role && !left && !(await confirmDialog('Remove all access?', `${person.name} will no longer be able to sign in to any of your branches.`, { confirmLabel: 'Remove', danger: true }))) {
    sel.value = prev; return;
  }
  sel.disabled = true;
  try {
    await rpc('branch_access_set', { p_user: sel.dataset.user, p_property: sel.dataset.prop, p_role: role });
    toast(role ? `${person.name} is now ${ROLE[role].toLowerCase()} at ${branch.name}.` : `${person.name} no longer has access to ${branch.name}.`);
    D = await rpc('branches_overview'); draw();
  } catch (e) { sel.value = prev; toast(e.message, { error: true }); }
  finally { sel.disabled = false; }
}

// ---------------------------------------------------------------- wiring
function wire() {
  $$('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go, b.dataset.href)));
  $$('[data-add]').forEach((b) => b.addEventListener('click', addDialog));
  $$('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); toast('Booking link copied. Paste it in WhatsApp for the guest.'); }
    catch { toast(b.dataset.copy, { ms: 8000 }); }
  }));
  $('#br-csv')?.addEventListener('click', downloadCsv);
  $$('.br-role').forEach((s) => s.addEventListener('change', () => setRole(s)));
}

// ---------------------------------------------------------------- add a branch
function addDialog() {
  const B = D?.branches || []; const F = D?.features || {};
  const cur = B.find((b) => b.id === CTX.property_id) || B[0];
  const types = [['hostel', 'Hostel'], ['hotel', 'Hotel / guest house'], ['homestay', 'Homestay']];
  if (F.pg) types.push(['pg', 'PG / Co-living']);
  if (F.resort) types.push(['resort', 'Resort']);
  const T = D?.team || [];
  const box = (k, label, on = true) => `<label class="br-check"><input type="checkbox" name="copy" value="${k}" ${on ? 'checked' : ''}><span>${label}</span></label>`;
  const body = `<div class="br-form">
    ${field('Branch name', '<input class="ns-input" name="name" maxlength="120" required autocomplete="off" placeholder="e.g. Social Backpackers – HSR Layout">', 'Tip: add the area so guests and staff can tell your branches apart.')}
    <div class="br-two">
      ${field('Type', `<select class="ns-input" name="kind">${options(types, cur && types.some(([k]) => k === cur.mode) ? cur.mode : 'hostel')}</select>`)}
      ${field('City', `<input class="ns-input" name="city" maxlength="80" value="${esc(cur?.city || '')}">`)}
    </div>
    ${field('Phone for this branch', `<input class="ns-input" name="phone" inputmode="tel" maxlength="20" placeholder="${esc(cur?.phone || 'Same as now')}">`, 'Leave empty to use the same phone as the branch you copy from.')}
    ${B.length ? `<fieldset class="br-copy"><legend>Copy from an existing branch (saves setup time)</legend>
      ${field('Copy from', `<select class="ns-input" name="copy_from">${options([['', 'Don’t copy, start empty'], ...B.map((b) => [b.id, b.name])], cur?.id || '')}</select>`)}
      <div class="br-copy-list">
        ${box('rooms', 'Rooms, beds and prices (with weekend & season prices and extras). You can rename rooms after.')}
        <p class="br-note is-amber" data-rooms-note hidden>Rooms can only be copied from a branch of the same type.</p>
        ${box('details', 'Check-in & check-out times, GST, UPI and billing details')}
        ${F.guide ? box('guide', 'House rules and guest guide (not Wi-Fi or directions)') : ''}
        ${F.staff ? box('shifts', 'Staff shifts (not the staff themselves)', false) : ''}
      </div>
      ${T.length ? `<div class="br-team-pick"><b>Give these people access too</b>${T.map((p) => {
        const r = (p.access || [])[0]?.role;
        return `<label class="br-check"><input type="checkbox" name="team" value="${esc(p.user_id)}"><span>${esc(p.name)}${r ? ` · ${esc(ROLE[r] || r)}` : ''}</span></label>`;
      }).join('')}</div>` : ''}
    </fieldset>` : ''}
    ${field('Invoice number prefix', '<input class="ns-input" name="invoice_prefix" maxlength="10" placeholder="Automatic, e.g. HSR" style="text-transform:uppercase">', 'Each branch numbers its own invoices, so they never repeat.')}
    <p class="br-note">Same login, nothing new to remember. This branch starts its <b>own free trial</b>, then needs <b>its own plan</b> (Settings → Billing inside the branch). Guests, bookings and money stay separate for each branch.</p>
  </div>`;
  const m = modal({ title: 'Add a branch', width: 560, body, actions: [{ label: 'Cancel' }, { label: 'Create branch', kind: 'primary', onClick: async (el) => {
    const v = (n) => el.querySelector(`[name="${n}"]`)?.value?.trim() || '';
    const src = v('copy_from');
    const p = { name: v('name'), kind: v('kind'), city: v('city'), phone: v('phone'), invoice_prefix: v('invoice_prefix').toUpperCase(), copy_from: src || null,
      copy: src ? [...el.querySelectorAll('[name="copy"]:checked:not(:disabled)')].map((x) => x.value) : [],
      team: [...el.querySelectorAll('[name="team"]:checked')].map((x) => x.value) };
    if (p.name.length < 2) throw new Error('Enter the branch name.');
    const r = await rpc('branch_create', { p });
    toast(`${p.name} is ready. Opening it so you can finish setup…`);
    setTimeout(() => go(r.property_id, 'setup.html'), 700);
    return false;
  } }] });
  const el = m.el;
  const sync = () => {
    const src = B.find((b) => b.id === el.querySelector('[name="copy_from"]')?.value);
    const kind = el.querySelector('[name="kind"]').value;
    const rooms = el.querySelector('[name="copy"][value="rooms"]');
    el.querySelectorAll('[name="copy"], [name="team"]').forEach((x) => { x.disabled = !src; });
    if (rooms) {
      const same = src && src.mode === kind;
      rooms.disabled = !same; if (!same) rooms.checked = false; else if (!rooms.dataset.touched) rooms.checked = true;
      const note = el.querySelector('[data-rooms-note]'); if (note) note.hidden = !src || same;
    }
  };
  el.querySelector('[name="copy"][value="rooms"]')?.addEventListener('change', (e) => { e.target.dataset.touched = '1'; });
  el.querySelector('[name="kind"]').addEventListener('change', sync);
  el.querySelector('[name="copy_from"]')?.addEventListener('change', sync);
  sync();
}
