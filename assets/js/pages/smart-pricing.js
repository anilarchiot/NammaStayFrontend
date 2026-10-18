// Settings → Smart pricing (041_smart_pricing.sql): prices follow demand, inside the owner's limits.
// Loaded by settings.js only when the tab is opened. Uses its own stylesheet (smart-pricing.css, sp-* classes).
import { W, rpc, content, esc, rupees, toPaise, fmtDate, ymd, modal, field, toast, confirmDialog, $, $$ } from '../core.js';

const I = (d, w = 20, sw = 2) => `<svg aria-hidden="true" width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const P = {
  trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  coins: '<ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v4c0 1.7 2.7 3 6 3s6-1.3 6-3V7"/><path d="M9 14v3c0 1.7 2.7 3 6 3s6-1.3 6-3v-4c0-1.7-2.7-3-6-3"/>',
  bed: '<path d="M2 16V9a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1"/><path d="M9 16V9a2 2 0 0 1 2-2h9v9"/><path d="M2 16h20v4M2 20v-4M22 20v-4"/>',
  tag: '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  bulb: '<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>',
  shield: '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
  star: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>',
  sync: '<path d="M21 12a9 9 0 0 1-15.5 6.2M3 12a9 9 0 0 1 15.5-6.2"/><path d="M21 4v5h-5M3 20v-5h5"/>',
  alert: '<path d="M12 8v5M12 16.5v.01"/><circle cx="12" cy="12" r="9"/>',
  pin: '<path d="M12 17v5"/><path d="M9 3h6l-1 6 3 3v2H7v-2l3-3z"/>',
  cal: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>',
  pause: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
};
const MODES = [['suggest', 'Suggest only'], ['auto', 'Automatic'], ['off', 'Off']];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dayOf = (d) => new Date(d + 'T12:00:00Z');
const dLabel = (d) => `${DOW[dayOf(d).getUTCDay()]} ${dayOf(d).getUTCDate()} ${dayOf(d).toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' }).replace('Sept', 'Sep')}`;
const rr = (p) => rupees(Math.round(Number(p || 0) / 100) * 100);
const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;
const timeAgo = (t) => { if (!t) return 'not yet'; const m = Math.round((Date.now() - new Date(t).getTime()) / 60000);
  return m < 2 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : fmtDate(t); };

function loadCss() {
  if (document.querySelector('link[data-sp-css]')) return;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'assets/css/smart-pricing.css'; l.dataset.spCss = '1'; document.head.appendChild(l);
}

let S = null; let page0 = 0; let CTX = null;

export async function smartPricing(ctx) {
  CTX = ctx; loadCss();
  await draw();
}

async function draw() {
  try { S = await rpc('sp_get', { p_property: CTX.property_id }); }
  catch (e) {
    content(`<div class="ns-card ns-empty">${/function|schema cache|does not exist/i.test(e.message) ? 'Smart pricing isn’t installed on the database yet — run <b>041_smart_pricing.sql</b> in Supabase, then reload.' : esc(e.message)}</div>`);
    return;
  }
  if (S.is_pg) { content('<div class="ns-card ns-empty">Smart pricing is for nightly stays. PG / monthly tenants keep their fixed rent.</div>'); return; }
  content(`${hero()}${pausedBar()}${suggestions()}${calendar()}
    <div class="sp-g2">${limitsCard()}<div class="sp-col">${howCard()}${otaCard()}${datesCard()}${runsCard()}</div></div>`, 'padding:24px 32px;display:flex;flex-direction:column;gap:20px;');
  wire();
}

// ---------------------------------------------------------------- pieces
function hero() {
  const st = S.settings; const s = S.stats; const on = st.mode !== 'off';
  const tile = (icon, tone, label, value, sub) => `<div class="sp-tile"><span class="sp-tile-ic sp-${tone}">${I(icon, 22)}</span>
      <div style="min-width:0"><span class="sp-tile-l">${label}</span><span class="sp-tile-v">${value}</span><span class="sp-tile-s">${sub}</span></div></div>`;
  return `<section class="sp-hero" aria-label="Smart pricing">
    <div class="sp-hero-top">
      <div class="sp-hero-text">
        <span class="sp-kicker${on ? '' : ' is-off'}">${I(P.trend, 15, 2.2)} Smart pricing is ${on ? 'on' : 'off'}</span>
        <h2 class="sp-title">${on ? 'Prices follow demand — inside the limits you set' : 'Let prices follow demand'}</h2>
        <p class="sp-lead">Every morning NammaStay checks the next 60 nights: how full each night is, how fast ${W.units} are going and how close the date is. Busy nights go up, quiet nights a few days away get a small discount. Bookings already made keep their price.</p>
      </div>
      <div class="sp-mode">
        <span class="sp-mode-l" id="sp-mode-l">How it works for you</span>
        <div class="sp-seg" role="radiogroup" aria-labelledby="sp-mode-l">
          ${MODES.map(([k, l]) => `<button type="button" role="radio" aria-checked="${st.mode === k}" data-mode="${k}">${l}</button>`).join('')}
        </div>
        <span class="sp-mode-help">${st.mode === 'auto' ? 'Automatic: prices change by themselves each morning; you get a notification with what changed.' : st.mode === 'suggest' ? 'Suggest only: you see suggestions here and tap Apply. Nothing changes without you.' : 'Off: your own prices and price rules only.'}</span>
      </div>
    </div>
    <div class="sp-tiles">
      ${tile(P.coins, 'green', 'Extra earned', rr(s.extra_30_paise), 'last 30 days, vs your normal prices')}
      ${tile(P.bed, 'blue', 'Beds filled', plural(s.discount_nights_30, 'night', 'nights'), 'sold after a small discount, 30 days')}
      ${tile(P.tag, 'amber', 'Next 60 nights', `${s.up_now} up · ${s.down_now} down`, 'nights with a smart price now')}
      ${tile(P.clock, 'coral', 'Last checked', esc(timeAgo(st.last_run_at)), on ? `<button type="button" class="sp-link" id="sp-run">Check now</button> · <button type="button" class="sp-link" id="sp-pause">${st.paused_until ? 'Resume' : 'Pause for a week'}</button>` : 'turn on to start')}
    </div>
  </section>`;
}

function pausedBar() {
  if (!S.settings.paused_until) return '';
  return `<div class="sp-bar">${I(P.pause, 18)}<span>Paused until <b>${esc(fmtDate(S.settings.paused_until))}</b> — prices stay as they are now and nothing new is changed.</span><button type="button" class="ns-btn-ghost" id="sp-resume">Resume now</button></div>`;
}

function groupSuggestions() {
  const rooms = new Set(S.groups.map((g) => g.room_id)).size;
  const by = new Map();
  for (const x of S.suggestions) { const k = x.night + '|' + x.pct; if (!by.has(k)) by.set(k, []); by.get(k).push(x); }
  return [...by.values()].map((list) => ({ list, night: list[0].night, pct: list[0].pct, reason: list[0].reason,
    where: list.length >= rooms && rooms > 1 ? 'all rooms' : list.map((x) => x.room).join(', '), from: list[0].from_paise, to: list[0].to_paise }))
    .sort((a, b) => (a.night < b.night ? -1 : 1));
}
function suggestions() {
  if (S.settings.mode !== 'suggest') return '';
  const G = groupSuggestions();
  if (!G.length) return `<section class="ns-card sp-card"><div class="sp-card-h"><h2 class="ns-h3">${I(P.bulb, 20)} No price suggestions right now</h2></div><p class="sp-muted">Prices look right for the next 60 nights. New suggestions appear each morning.</p></section>`;
  const shown = G.slice(0, 8);
  return `<section class="ns-card sp-card" aria-label="Price suggestions">
    <div class="sp-card-h"><h2 class="ns-h3">${I(P.bulb, 20)} ${plural(G.length, 'price suggestion', 'price suggestions')} for you</h2>
      <div class="sp-actions"><button type="button" class="ns-btn-ghost" id="sp-skip-all">Skip all</button><button type="button" class="ns-btn" id="sp-apply-all">Apply all ${G.length}</button></div></div>
    <div class="sp-list">${shown.map((g, i) => `<div class="sp-sug">
      <span class="sp-sug-ic ${g.pct > 0 ? 'is-up' : 'is-down'}" aria-hidden="true">${g.pct > 0 ? '▲' : '▼'}</span>
      <div class="sp-sug-main"><b>${esc(dLabel(g.night))} · ${esc(g.where)}</b><span>${esc(g.reason || '')}</span></div>
      <div class="sp-sug-price"><s>${rr(g.from)}</s><b>${rr(g.to)}</b><span class="sp-pill ${g.pct > 0 ? 'is-up' : 'is-down'}">${g.pct > 0 ? '+' : '−'}${Math.abs(g.pct)}%</span></div>
      <div class="sp-actions"><button type="button" class="ns-btn-ghost" data-skip="${i}">Skip</button><button type="button" class="ns-btn sp-dark" data-apply="${i}">Apply</button></div>
    </div>`).join('')}</div>
    ${G.length > shown.length ? `<p class="sp-muted">+ ${G.length - shown.length} more — “Apply all” includes them. You can see each night in the calendar below.</p>` : ''}
  </section>`;
}

function calendar() {
  const n = 14; const from = page0 * n; const nights = S.nights.slice(from, from + n);
  const cell = (c, g) => {
    const cls = c.locked ? 'is-pin' : c.owner_rule ? 'is-own' : c.auto_pct > 0 ? 'is-up' : c.auto_pct < 0 ? 'is-down' : '';
    const t = c.locked ? 'pinned to your price' : c.owner_rule ? 'your own seasonal price' : c.auto_pct ? `smart price ${c.auto_pct > 0 ? '+' : ''}${c.auto_pct}%` : 'your normal price';
    return `<button type="button" class="sp-price ${cls}${c.suggest ? ' has-sug' : ''}" data-cell="${esc(g.room_id)}|${c.night}" aria-label="${esc(g.label)}, ${esc(dLabel(c.night))}: ${rr(c.price_paise)}, ${t}">${rr(c.price_paise).replace('₹', '₹')}${c.locked ? I(P.pin, 11, 2.4) : ''}</button>`;
  };
  return `<section class="ns-card sp-card" aria-label="Prices for the next nights">
    <div class="sp-card-h"><h2 class="ns-h3">${I(P.cal, 20)} ${dLabel(nights[0].night)} – ${dLabel(nights[nights.length - 1].night)}</h2>
      <div class="sp-actions"><div class="sp-legend"><span><i class="is-up"></i>Priced up</span><span><i class="is-down"></i>Small discount</span><span><i></i>Your price</span><span><i class="is-pin"></i>Pinned / yours</span>${S.settings.mode === 'suggest' ? '<span><i class="is-sug"></i>Suggestion waiting</span>' : ''}</div>
        <button type="button" class="ns-btn-ghost sp-icon" id="sp-prev" aria-label="Earlier nights" ${page0 === 0 ? 'disabled' : ''}>‹</button>
        <button type="button" class="ns-btn-ghost sp-icon" id="sp-next" aria-label="Later nights" ${from + n >= S.nights.length ? 'disabled' : ''}>›</button></div></div>
    <div class="sp-scroll"><div class="sp-grid" style="grid-template-columns:170px repeat(${nights.length},minmax(54px,1fr))">
      <span class="sp-grid-h">How full</span>
      ${nights.map((d) => { const o = d.cap ? Math.round((d.booked * 100) / d.cap) : 0;
        return `<div class="sp-day${d.weekend ? ' is-wk' : ''}" title="${d.booked} of ${d.cap} ${W.units} booked${d.festival ? ' · ' + esc(d.festival) : ''}">
          <span class="sp-dow">${DOW[dayOf(d.night).getUTCDay()]}</span><b>${dayOf(d.night).getUTCDate()}</b>
          <span class="sp-occ"><i style="height:${o}%" class="${o >= 85 ? 'is-hi' : o <= 33 ? 'is-lo' : ''}"></i></span><span class="sp-occ-t">${o}%</span>
          ${d.festival ? `<span class="sp-fest" title="${esc(d.festival)}">${I(P.star, 11, 2.4)}</span>` : ''}</div>`; }).join('')}
      ${S.prices.map((g) => `<div class="sp-row-h"><b>${esc(g.label)}</b><span>normal ${rr(g.rate_paise)}</span></div>${g.cells.slice(from, from + n).map((c) => cell(c, g)).join('')}`).join('')}
    </div></div>
    <p class="sp-muted">Tap a price to keep your normal price on that night — Smart pricing then leaves it alone. Nights with your own seasonal price are never changed.</p>
  </section>`;
}

function limitsCard() {
  const st = S.settings;
  return `<section class="ns-card sp-card" aria-label="Your limits">
    <div class="sp-card-h"><h2 class="ns-h3">${I(P.shield, 20)} Your limits — prices never go outside these</h2></div>
    <div class="sp-limits">
      <span class="sp-grid-h">Bed type</span><span class="sp-grid-h">Lowest</span><span class="sp-grid-h">Highest</span>
      ${S.groups.map((g, i) => `<label for="sp-min-${i}" class="sp-lim-name">${esc(g.label)} <span>(${rr(g.rate_paise)})</span></label>
        <input class="ns-input" id="sp-min-${i}" data-min="${i}" inputmode="numeric" value="${Math.round(g.min_paise / 100)}" aria-label="Lowest price, ${esc(g.label)}">
        <input class="ns-input" data-max="${i}" inputmode="numeric" value="${Math.round(g.max_paise / 100)}" aria-label="Highest price, ${esc(g.label)}">`).join('')}
    </div>
    <div class="sp-opts">
      <label>Biggest change in one day <select class="ns-input" id="sp-step">${[5, 10, 15, 20].map((v) => `<option value="${v}" ${st.max_step_pct === v ? 'selected' : ''}>${v}%</option>`).join('')}</select></label>
      <label class="sp-check"><input type="checkbox" id="sp-nowk" ${st.no_weekend_discount ? 'checked' : ''}> Never discount Fri &amp; Sat nights</label>
    </div>
    <div class="sp-actions" style="justify-content:flex-end"><button type="button" class="ns-btn" id="sp-save-limits">Save limits</button></div>
  </section>`;
}

function howCard() {
  const box = (ic, tone, t, s) => `<div class="sp-how"><span class="sp-how-ic sp-h-${tone}">${I(ic, 18)}</span><div><b>${t}</b><span>${s}</span></div></div>`;
  return `<section class="ns-card sp-card" aria-label="How it decides"><h2 class="ns-h3" style="margin:0">How it decides</h2>
    <div class="sp-how-grid">${box(P.bed, 'green', 'How full the night is', '70%+ booked → up 5%, 85%+ → up 10%')}${box(P.trend, 'blue', 'How fast it’s filling', 'faster than your usual pace → up 5% more')}
      ${box(P.clock, 'amber', 'How close the date is', 'half empty 0–2 days before → down 10%')}${box(P.star, 'red', 'Festivals & events', 'your dates below → at least up 10%')}</div></section>`;
}

function otaCard() {
  return S.channel_manager
    ? `<section class="sp-note">${I(P.sync, 20)}<div><b>Channel manager connected</b><span>New prices also go to your OTAs on the next sync. Your booking page, walk-ins and invoices use them straight away.</span></div></section>`
    : `<section class="sp-note is-amber">${I(P.alert, 20)}<div><b>OTA prices don’t change by themselves</b><span>Calendar links (iCal) share dates only, not prices. Update prices on Booking.com / Hostelworld yourself, or <a href="ota.html">connect the channel manager</a>. Your booking page, walk-ins and invoices use smart prices straight away.</span></div></section>`;
}

function datesCard() {
  return `<section class="ns-card sp-card" aria-label="Festivals and events">
    <div class="sp-card-h"><h2 class="ns-h3">${I(P.star, 20)} Festivals &amp; events</h2><div class="sp-actions"><button type="button" class="ns-btn-ghost" id="sp-add-date">+ Add</button></div></div>
    ${S.dates.length ? `<div class="sp-list">${S.dates.map((d) => `<div class="sp-date"><span><b>${esc(d.name)}</b> · ${esc(dLabel(d.date_from))}${d.date_to !== d.date_from ? ' – ' + esc(dLabel(d.date_to)) : ''}</span>
        <button type="button" class="ns-btn-ghost" data-del-date="${esc(d.id)}" aria-label="Remove ${esc(d.name)}">Remove</button></div>`).join('')}</div>`
      : '<p class="sp-muted">Add Diwali, Pongal, Christmas, New Year, long weekends and local festivals or events near you — those nights go up early, before they fill.</p>'}
  </section>`;
}

function runsCard() {
  if (!S.runs.length) return '';
  const label = (r) => ({ auto: `${r.up} up, ${r.down} down — automatic`, suggest: 'new price suggestions', applied: `you applied ${r.up + r.down} — ${r.up} up, ${r.down} down`,
    off: 'turned off — back to your prices', undo: 'a change was undone', pinned: 'a night was pinned / unpinned' })[r.kind] || r.kind;
  return `<section class="ns-card sp-card" aria-label="Recent changes"><h2 class="ns-h3" style="margin:0">Recent changes</h2>
    <div class="sp-list">${S.runs.map((r) => `<div class="sp-run"><span><b>${esc(fmtDate(r.ran_at))}</b> · ${esc(label(r))}${r.undone ? ' · <i>undone</i>' : ''}</span>
      ${r.can_undo ? `<button type="button" class="sp-link" data-undo="${esc(r.id)}">Undo</button>` : ''}</div>`).join('')}</div></section>`;
}

// ---------------------------------------------------------------- actions
async function act(fn, ok) {
  try { const r = await fn(); if (ok) toast(typeof ok === 'function' ? ok(r) : ok); await draw(); }
  catch (e) { toast(e.message, { error: true }); }
}
const pid = () => CTX.property_id;

function wire() {
  $$('[data-mode]').forEach((b) => b.addEventListener('click', async () => {
    const mode = b.dataset.mode; if (mode === S.settings.mode) return;
    if (mode === 'auto' && !(await confirmDialog('Change prices automatically?', 'Every morning prices change by themselves, inside your limits. You get a notification each time and can undo any change for 7 days.', { confirmLabel: 'Turn on Automatic' }))) return;
    if (mode === 'off' && !(await confirmDialog('Turn Smart pricing off?', 'All smart prices are removed and every night goes back to your own prices and price rules.', { confirmLabel: 'Turn off' }))) return;
    act(() => rpc('sp_settings_save', { p_property: pid(), p: { mode, max_step_pct: S.settings.max_step_pct, no_weekend_discount: S.settings.no_weekend_discount } }),
      (r) => (mode === 'off' ? 'Smart pricing is off — your own prices are back.' : mode === 'auto' ? `Automatic is on${r?.ran ? ` — ${r.up} nights up, ${r.down} down` : ''}.` : `Suggest only is on${r?.ran ? ` — ${plural(r.suggested, 'suggestion', 'suggestions')}` : ''}.`));
  }));
  $('#sp-run')?.addEventListener('click', () => act(() => rpc('sp_run_now', { p_property: pid() }),
    (r) => (S.settings.mode === 'auto' ? `Checked — ${r.up} up, ${r.down} down.` : `Checked — ${plural(r.suggested || 0, 'suggestion', 'suggestions')}.`)));
  $('#sp-pause')?.addEventListener('click', () => act(() => rpc('sp_pause', { p_property: pid(), p_days: S.settings.paused_until ? 0 : 7 }), S.settings.paused_until ? 'Resumed.' : 'Paused for a week.'));
  $('#sp-resume')?.addEventListener('click', () => act(() => rpc('sp_pause', { p_property: pid(), p_days: 0 }), 'Resumed.'));
  const G = S.settings.mode === 'suggest' ? groupSuggestions() : [];
  const pick = (g) => g.list.map((x) => ({ room_id: x.room_id, night: x.night }));
  $$('[data-apply]').forEach((b) => b.addEventListener('click', () => act(() => rpc('sp_apply', { p_property: pid(), p: pick(G[+b.dataset.apply]) }), 'Price changed.')));
  $$('[data-skip]').forEach((b) => b.addEventListener('click', () => act(() => rpc('sp_skip', { p_property: pid(), p: pick(G[+b.dataset.skip]) }), 'Skipped.')));
  $('#sp-apply-all')?.addEventListener('click', () => act(() => rpc('sp_apply', { p_property: pid(), p: null }), (n) => `${plural(n, 'price', 'prices')} changed.`));
  $('#sp-skip-all')?.addEventListener('click', () => act(() => rpc('sp_skip', { p_property: pid(), p: null }), 'All skipped.'));
  $('#sp-prev')?.addEventListener('click', () => { page0 = Math.max(0, page0 - 1); draw(); });
  $('#sp-next')?.addEventListener('click', () => { page0 += 1; draw(); });
  $$('[data-cell]').forEach((b) => b.addEventListener('click', () => cellDialog(...b.dataset.cell.split('|'))));
  $('#sp-save-limits')?.addEventListener('click', saveLimits);
  $('#sp-add-date')?.addEventListener('click', dateDialog);
  $$('[data-del-date]').forEach((b) => b.addEventListener('click', () => act(() => rpc('sp_date_delete', { p_property: pid(), p_id: b.dataset.delDate }), 'Removed.')));
  $$('[data-undo]').forEach((b) => b.addEventListener('click', async () => {
    if (!(await confirmDialog('Undo this change?', 'Those nights go back to the price they had before.', { confirmLabel: 'Undo' }))) return;
    act(() => rpc('sp_undo', { p_property: pid(), p_run: b.dataset.undo }), (n) => `Undone — ${plural(n, 'night', 'nights')} back to before.`);
  }));
}

async function saveLimits() {
  const btn = $('#sp-save-limits'); btn.disabled = true;
  try {
    const list = S.groups.map((g, i) => {
      const mn = toPaise($(`[data-min="${i}"]`).value); const mx = toPaise($(`[data-max="${i}"]`).value);
      if (!Number.isFinite(mn) || !Number.isFinite(mx)) throw new Error(`${g.label}: enter the lowest and highest price in rupees.`);
      return { room_id: g.room_id, rate_paise: g.rate_paise, min_paise: mn, max_paise: mx };
    });
    await rpc('sp_limits_save', { p_property: pid(), p: list });
    await rpc('sp_settings_save', { p_property: pid(), p: { mode: S.settings.mode, max_step_pct: Number($('#sp-step').value), no_weekend_discount: $('#sp-nowk').checked } });
    toast('Limits saved.'); await draw();
  } catch (e) { toast(e.message, { error: true }); btn.disabled = false; }
}

function cellDialog(roomId, night) {
  const g = S.prices.find((x) => x.room_id === roomId); const c = g.cells.find((x) => x.night === night);
  const own = c.owner_rule;
  modal({ title: `${dLabel(night)} · ${g.label}`, width: 460,
    body: `<p style="margin:0 0 6px;font-size:15px">Price now: <b>${rr(c.price_paise)}</b> <span class="sp-muted">(normal ${rr(g.rate_paise)})</span></p>
      <p class="sp-muted" style="margin:0">${own ? 'This night uses your own seasonal price — Smart pricing never changes it. Edit it in Rooms &amp; prices.'
        : c.locked ? 'Pinned: Smart pricing leaves this night alone (for the whole room).'
        : c.auto_pct ? `Smart pricing changed it by ${c.auto_pct > 0 ? '+' : ''}${c.auto_pct}% for the whole room.` : 'Your normal price — Smart pricing may change it if demand changes.'}</p>`,
    actions: own ? [{ label: 'Close' }] : [{ label: 'Cancel' },
      c.locked ? { label: 'Let Smart pricing decide', kind: 'primary', onClick: () => act(() => rpc('sp_night_lock', { p_property: pid(), p_room: roomId, p_night: night, p_locked: false }), 'Smart pricing will decide this night.') }
        : { label: 'Keep my normal price', kind: 'primary', onClick: () => act(() => rpc('sp_night_lock', { p_property: pid(), p_room: roomId, p_night: night, p_locked: true }), 'Pinned to your price.') }] });
}

function dateDialog() {
  const t = ymd(new Date());
  modal({ title: 'Add a festival or event', width: 460, body: `<div style="display:flex;flex-direction:column;gap:12px">
      ${field('Name', '<input class="ns-input" name="name" maxlength="60" placeholder="e.g. Diwali, Sunburn festival, long weekend">')}
      <div class="sp-f2">${field('First night', `<input class="ns-input" type="date" name="from" min="${t}" value="${t}">`)}${field('Last night', `<input class="ns-input" type="date" name="to" min="${t}" value="${t}">`)}</div></div>`,
  actions: [{ label: 'Cancel' }, { label: 'Add', kind: 'primary', onClick: async (el) => {
    const v = (n) => el.querySelector(`[name="${n}"]`).value.trim();
    await rpc('sp_date_save', { p_property: pid(), p: { name: v('name'), date_from: v('from'), date_to: v('to') || v('from') } });
    if (S.settings.mode !== 'off') await rpc('sp_run_now', { p_property: pid() }).catch(() => {});
    toast('Added.'); await draw(); } }] });
}
