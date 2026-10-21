// Homestay add-ons (033_homestay.sql) — used only when the property type is Homestay.
//   • Meal plans: Settings card, a plan on each booking (added to the bill as one "Meals: …" extra), kitchen list
//   • Book the whole home: one tap adds every free room to a new booking
//   • House guide: Settings card, "Send house guide" on WhatsApp, shown to the guest after online check-in
// Self-contained: if 033 isn't installed, the cards simply don't appear and nothing else changes.
import { W,
  rpc, esc, rupees, toPaise, toast, modal, field, ymd, addDays, fmtDay, waNumber, SITE_URL, unitName, $,
} from '../core.js';

const MEALS = [['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['dinner', 'Dinner']];
const mealsOf = (p) => MEALS.filter(([k]) => p[k]).map(([, l]) => l).join(' + ');
const notInstalled = (e) => /database update|Could not find the function|does not exist/i.test(e?.message || '');
const perNight = (p, adults, children) => (p.adult_paise || 0) * Math.max(1, adults) + (p.child_paise || 0) * Math.max(0, children);

async function plansOrNull(ctx) {
  try { return await rpc('meal_plans_list', { p_property: ctx.property_id }); } catch (e) { if (notInstalled(e)) return null; throw e; }
}

// =================================================================== Settings → Rooms: meal plans
export async function mountMealPlansCard(ctx) {
  const host = document.querySelector('.ns-content'); if (!host) return;
  const plans = await plansOrNull(ctx);
  if (plans === null) { host.insertAdjacentHTML('beforeend', '<div class="ns-card ns-muted">Meal plans need the database update <b>033_homestay.sql</b>.</div>'); return; }
  const can = ctx.can('owner', 'manager') && ctx.allow('manage_rooms');
  const card = document.createElement('div'); card.className = 'ns-card'; card.id = 'meal-plans';
  card.style.cssText = 'padding:0;overflow:hidden';
  host.append(card);
  const draw = (list) => {
    card.innerHTML = `<div style="padding:18px 20px;display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
        <div><div class="ns-h3">🍳 Meal plans</div><div class="ns-muted">Price per adult and per child for each night. Choose a plan on a booking and it’s added to the bill — the kitchen list on the dashboard counts the meals.</div></div>
        ${can ? `<span style="display:flex;gap:8px">${list.length ? '' : '<button type="button" class="ns-btn-ghost" id="mp-suggest">Add the usual 3</button>'}<button type="button" class="ns-btn" id="mp-add">+ Add meal plan</button></span>` : ''}</div>
      <div style="overflow-x:auto"><table class="ns-table" style="min-width:560px"><thead><tr><th>Plan</th><th>Meals</th><th style="text-align:right">Adult / night</th><th style="text-align:right">Child / night</th><th>Offered</th><th class="ns-sticky-end"><span class="sr-only">Actions</span></th></tr></thead><tbody>
      ${list.map((p) => `<tr data-mp="${esc(p.id)}"><td style="font-weight:700">${esc(p.name)}</td><td>${esc(mealsOf(p))}</td>
          <td style="text-align:right">${rupees(p.adult_paise)}</td><td style="text-align:right">${rupees(p.child_paise)}</td>
          <td>${p.is_active ? '<span class="ns-pill green">Yes</span>' : '<span class="ns-pill grey">Hidden</span>'}</td>
          <td class="ns-sticky-end" style="text-align:right;white-space:nowrap">${can ? '<button type="button" class="ns-btn-ghost" data-mp-edit style="height:30px;font-size:12px">Edit</button> <button type="button" class="ns-btn-ghost" data-mp-del style="height:30px;font-size:12px;color:#B23A3A">Remove</button>' : ''}</td></tr>`).join('')
        || '<tr><td colspan="6" class="ns-empty">No meal plans yet — every booking is room only.</td></tr>'}
      </tbody></table></div>`;
  };
  let list = plans; draw(list);
  const reload = async () => { list = await rpc('meal_plans_list', { p_property: ctx.property_id }); draw(list); };
  const edit = (p) => modal({
    title: p ? 'Edit meal plan' : 'New meal plan', width: 480,
    body: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div style="grid-column:1/-1">${field('Name', `<input class="ns-input" name="name" maxlength="60" value="${esc(p?.name || '')}" placeholder="e.g. Breakfast included">`)}</div>
      <div style="grid-column:1/-1;display:flex;gap:16px;flex-wrap:wrap">${MEALS.map(([k, l]) => `<label style="display:flex;gap:6px;align-items:center;font-size:13.5px;font-weight:600"><input type="checkbox" name="${k}" ${p?.[k] ? 'checked' : ''}> ${l}</label>`).join('')}</div>
      ${field('Per adult, per night (₹)', `<input class="ns-input" name="adult" inputmode="decimal" value="${p ? p.adult_paise / 100 : ''}" placeholder="e.g. 250">`)}
      ${field('Per child, per night (₹)', `<input class="ns-input" name="child" inputmode="decimal" value="${p ? p.child_paise / 100 : ''}" placeholder="0 if free">`)}
      <label style="grid-column:1/-1;display:flex;gap:6px;align-items:center;font-size:13px"><input type="checkbox" name="active" ${!p || p.is_active ? 'checked' : ''}> Offer this plan on new bookings</label></div>`,
    actions: [{ label: 'Cancel' }, { label: 'Save', kind: 'primary', onClick: async (el) => {
      const v = (n) => el.querySelector(`[name=${n}]`);
      const a = v('adult').value.trim() ? toPaise(v('adult').value) : 0; const c = v('child').value.trim() ? toPaise(v('child').value) : 0;
      if (Number.isNaN(a) || Number.isNaN(c) || a < 0 || c < 0) throw new Error('Enter the prices in rupees, e.g. 250.');
      await rpc('meal_plan_save', { p_property: ctx.property_id, p: { id: p?.id || null, name: v('name').value.trim(), breakfast: v('breakfast').checked,
        lunch: v('lunch').checked, dinner: v('dinner').checked, adult_paise: a, child_paise: c, is_active: v('active').checked } });
      toast('Meal plan saved.'); await reload();
    } }],
  });
  card.addEventListener('click', async (e) => {
    if (e.target.closest('#mp-add')) { edit(null); return; }
    if (e.target.closest('#mp-suggest')) {
      try {
        for (const p of [{ name: 'Breakfast included', breakfast: true, adult_paise: 25000, child_paise: 15000 },
          { name: 'Breakfast + Dinner', breakfast: true, dinner: true, adult_paise: 60000, child_paise: 35000 },
          { name: 'All meals', breakfast: true, lunch: true, dinner: true, adult_paise: 90000, child_paise: 50000 }]) await rpc('meal_plan_save', { p_property: ctx.property_id, p });
        toast('3 meal plans added — change the prices to yours.'); await reload();
      } catch (err) { toast(err.message, { error: true }); }
      return;
    }
    const row = e.target.closest('[data-mp]'); if (!row) return;
    const p = list.find((x) => x.id === row.dataset.mp);
    if (e.target.closest('[data-mp-edit]')) edit(p);
    if (e.target.closest('[data-mp-del]')) {
      modal({ title: 'Remove meal plan', width: 420, body: `<p style="margin:0;font-size:14px">Remove <b>${esc(p.name)}</b>? Bookings that already have it keep it on their bill.</p>`,
        actions: [{ label: 'Cancel' }, { label: 'Remove', kind: 'danger', onClick: async () => { await rpc('meal_plan_delete', { p_id: p.id }); toast('Meal plan removed.'); await reload(); } }] });
    }
  });
}

// =================================================================== Settings → Property: house guide
const GUIDE = [
  ['welcome', 'Welcome note', 'textarea', 'e.g. Welcome to our home! We live upstairs — knock any time.'],
  ['host_name', 'Host name', 'input', 'e.g. Anil'], ['host_phone', 'Host phone (WhatsApp)', 'tel', '+91 98400 12233'],
  ['wifi_name', 'Wi-Fi name', 'input', ''], ['wifi_password', 'Wi-Fi password', 'input', ''],
  ['checkin_info', 'Check-in', 'textarea', 'e.g. Key is with the caretaker. Check-in from 1 PM.'],
  ['checkout_info', 'Check-out', 'textarea', 'e.g. Check-out by 11 AM. Leave the key on the table.'],
  ['house_rules', 'House rules', 'textarea', 'e.g. No smoking inside · Quiet after 10 PM · Pets on request'],
  ['food_info', 'Food', 'textarea', 'e.g. Breakfast 8–10 AM. Tell us by 5 PM if you want dinner.'],
  ['directions', 'How to reach', 'textarea', 'e.g. 2 km from the bus stand; turn left after the temple.'],
  ['maps_url', 'Google Maps link', 'input', 'https://maps.app.goo.gl/…'],
];
export async function mountGuideCard(ctx) {
  const host = document.querySelector('.ns-content'); if (!host) return;
  let g;
  try { g = await rpc('guide_get', { p_property: ctx.property_id }); } catch (e) { if (notInstalled(e)) return; throw e; }
  const can = ctx.can('owner', 'manager');
  const card = document.createElement('div'); card.className = 'ns-card'; card.id = 'guide';
  card.style.cssText = 'display:flex;flex-direction:column;gap:14px';
  card.innerHTML = `<div><div class="ns-h3">${W.kind === 'resort' ? '🧭 Guest guide' : '🏡 House guide for guests'}</div>
      <div class="ns-muted">Sent to guests on WhatsApp from the booking, and shown after they check in online. The Wi-Fi password is shown to them only from the day before arrival.</div></div>
    <div class="hs-guide-grid">${GUIDE.map(([k, l, t, ph]) => `<div style="${t === 'textarea' ? 'grid-column:1/-1' : ''}">${field(l, t === 'textarea'
      ? `<textarea class="ns-input" name="${k}" maxlength="${k === 'house_rules' ? 2000 : 1000}" placeholder="${esc(ph)}" style="min-height:64px" ${can ? '' : 'disabled'}>${esc(g[k] || '')}</textarea>`
      : `<input class="ns-input" name="${k}" ${t === 'tel' ? 'type="tel"' : ''} value="${esc(g[k] || '')}" placeholder="${esc(ph)}" ${can ? '' : 'disabled'}>`)}</div>`).join('')}</div>
    ${can ? '<div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap"><button type="button" class="ns-btn-ghost" id="guide-preview">Preview message</button><button type="button" class="ns-btn" id="guide-save">Save house guide</button></div>' : ''}`;
  host.append(card);
  if (location.hash === '#guide') setTimeout(() => card.scrollIntoView({ block: 'start', behavior: 'smooth' }), 200);
  const read = () => Object.fromEntries(GUIDE.map(([k]) => [k, card.querySelector(`[name=${k}]`).value.trim()]));
  $('#guide-save')?.addEventListener('click', async (e) => {
    e.target.disabled = true;
    try { await rpc('guide_save', { p_property: ctx.property_id, p: read() }); toast('House guide saved.'); } catch (err) { toast(err.message, { error: true }); }
    finally { e.target.disabled = false; }
  });
  $('#guide-preview')?.addEventListener('click', () => modal({ title: 'WhatsApp message preview', width: 460,
    body: `<pre style="white-space:pre-wrap;font:13px/1.5 inherit;margin:0;background:#E7F8EE;border-radius:12px;padding:14px">${esc(guideText({ ...read(), property: ctx.property_name }, { guest: 'Priya', link: `${SITE_URL}/self-check-in.html?t=…` }))}</pre>`,
    actions: [{ label: 'Close', kind: 'primary' }] }));
}

/** The house guide as one WhatsApp message. */
export function guideText(g, { guest, link, room } = {}) {
  const L = [];
  L.push(`Hi ${guest || 'there'}, welcome to ${g.property || 'our home'}! 🏡`);
  if (g.welcome) L.push('', g.welcome);
  if (room) L.push('', `Your room: ${room}`);
  if (g.checkin_info) L.push('', `🔑 Check-in: ${g.checkin_info}`);
  if (g.checkout_info) L.push(`🧳 Check-out: ${g.checkout_info}`);
  if (g.wifi_name) L.push('', `📶 Wi-Fi: ${g.wifi_name}${g.wifi_password ? ` · Password: ${g.wifi_password}` : ''}`);
  if (g.food_info) L.push('', `🍳 Food: ${g.food_info}`);
  if (g.house_rules) L.push('', `📋 House rules:\n${g.house_rules}`);
  if (g.directions || g.maps_url) L.push('', `📍 How to reach: ${[g.directions, g.maps_url].filter(Boolean).join('\n')}`);
  if (g.host_name || g.host_phone) L.push('', `📞 Your host: ${[g.host_name, g.host_phone].filter(Boolean).join(' · ')}`);
  if (link) L.push('', `Check in online (ID & details, 2 minutes): ${link}`);
  return L.join('\n');
}

// =================================================================== New booking: whole home + meal plan
/**
 * @param {{ ctx, unitsBox: HTMLElement, addRow: Function, units: () => object[], refresh: Function }} o
 * @returns {Promise<{ total(rows, nights): number, lines(rows, nights): string, wholeHome(): void, save(made): Promise<{failed:number}> }>}
 */
export async function mountCheckinHomestay({ ctx, unitsBox, addRow, units, refresh }) {
  const addBtn = document.getElementById('add-unit');
  const whole = document.createElement('button');
  whole.type = 'button'; whole.className = 'ns-btn-ghost'; whole.id = 'whole-home'; whole.style.alignSelf = 'flex-start';
  whole.textContent = W.kind === 'resort' ? '👥 Add all free rooms' : '🏡 Book the whole home';
  whole.title = 'Add every free room to this booking — for a family or group';
  const wrap = document.createElement('div'); wrap.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap';
  if (addBtn) { addBtn.replaceWith(wrap); wrap.append(addBtn, whole); } else { unitsBox.insertAdjacentElement('afterend', wrap); wrap.append(whole); }
  const wholeHome = () => {
    const free = units();
    if (!free.length) { toast('No rooms are free for these dates.', { error: true }); return; }
    [...unitsBox.querySelectorAll('.unit-row')].slice(1).forEach((r) => r.remove());
    const first = unitsBox.querySelector('[name=unit]');
    first.value = free[0].id; first.dispatchEvent(new Event('change', { bubbles: true }));
    free.slice(1, 10).forEach((u) => {
      addRow(false);
      const sel = unitsBox.lastElementChild.querySelector('[name=unit]');
      sel.value = u.id; sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    toast(`${Math.min(free.length, 10)} room${free.length > 1 ? 's' : ''} added — set the guests in each.`);
  };
  whole.addEventListener('click', wholeHome);

  // meal plan (one plan for all rooms in this booking)
  let plans = null;
  try { plans = (await plansOrNull(ctx))?.filter((p) => p.is_active) || null; } catch { plans = null; }
  let sel = null;
  if (plans?.length) {
    const box = document.createElement('div');
    box.innerHTML = field('Meal plan', `<select class="ns-input" name="meal_plan"><option value="">Room only (no meals)</option>${plans.map((p) => `<option value="${esc(p.id)}">${esc(p.name)} — ${rupees(p.adult_paise)}/adult${p.child_paise ? ` · ${rupees(p.child_paise)}/child` : ''} a night</option>`).join('')}</select>`,
      'Added to the bill for every night and every guest. You can change it later on the booking.');
    wrap.insertAdjacentElement('afterend', box);
    sel = box.querySelector('select');
    sel.addEventListener('change', refresh);
  }
  const plan = () => plans?.find((p) => p.id === sel?.value) || null;
  return {
    wholeHome,
    total(rows, n) { const p = plan(); return p ? rows.filter((r) => r.unit).reduce((t, r) => t + perNight(p, r.adults, r.children) * n, 0) : 0; },
    lines(rows, n) {
      const p = plan(); if (!p || !rows.some((r) => r.unit)) return '';
      const t = this.total(rows, n);
      return `<div style="display:flex;justify-content:space-between;gap:10px;font-size:13px;color:#AEB6C9"><span>🍳 ${esc(p.name)}<br><small>${esc(mealsOf(p))} · ${n} night${n > 1 ? 's' : ''}</small></span><span>${rupees(t)}</span></div>`;
    },
    async save(made) {
      const p = plan(); if (!p) return { failed: 0 };
      let failed = 0;
      for (const b of made) { try { await rpc('booking_meal_set', { p_booking: b.id, p_plan: p.id }); } catch { failed += 1; } }
      return { failed };
    },
  };
}

// =================================================================== Booking page: meal plan + house guide
export async function mountBookingHomestay({ ctx, booking, guest, bed, anchor, selfLink }) {
  if (!anchor) return;
  let cur; let plans; let guide;
  try { [cur, plans, guide] = await Promise.all([rpc('booking_meal_get', { p_booking: booking.id }), rpc('meal_plans_list', { p_property: ctx.property_id }),
    rpc('guide_get', { p_property: ctx.property_id })]); } catch { return; }    // 033 not installed → nothing to show
  const staff = ctx.can('owner', 'manager', 'front_desk');
  const live = ['pending', 'confirmed', 'checked_in'].includes(booking.status);
  const canMeal = staff && live && ctx.allow('add_extras');
  const hasGuide = Object.keys(guide || {}).some((k) => !['updated_at'].includes(k) && guide[k]);
  const phone = waNumber(guest.phone);
  if (!cur.plan && !plans.length && !(hasGuide && phone)) return;
  const card = document.createElement('div');
  card.className = 'hs-booking';
  card.style.cssText = 'display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:12px;background:#FFFDF6;border:1px solid #F0EBDB';
  anchor.insertAdjacentElement('afterend', card);
  const active = plans.filter((p) => p.is_active || p.id === cur.plan?.plan_id);
  const m = cur.plan;
  const inPkg = !!m && /\(in package\)$/.test(m.name || '');          // resort stay package's meal plan: changed with the package (034)
  card.innerHTML = `
    ${m || plans.length ? `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
      <div><div style="font-size:13.5px;font-weight:800">🍳 Meal plan</div>
        <div class="ns-muted" style="font-size:11.5px">${m ? `${esc(m.name)}${m.name.toLowerCase() === mealsOf(m).toLowerCase() ? '' : ` · ${esc(mealsOf(m))}`} · ${inPkg ? 'included in the stay package' : `${rupees(m.amount_paise)} on the bill`}${m.stale ? ' · <b style="color:#B4711A">dates or guests changed — choose it again to update</b>' : ''}` : 'Room only — no meals'}</div></div>
      ${canMeal && !inPkg ? `<select class="ns-input" id="hs-meal" style="height:34px;width:auto;max-width:240px"><option value="">Room only</option>${active.map((p) => `<option value="${esc(p.id)}" ${m?.plan_id === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>` : ''}
    </div>` : ''}
    ${hasGuide && phone && staff ? `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;${m || plans.length ? 'border-top:1px solid #F3EFE1;padding-top:10px' : ''}">
      <div><div style="font-size:13.5px;font-weight:800">🏡 House guide</div><div class="ns-muted" style="font-size:11.5px">Wi-Fi, house rules, how to reach, host phone${selfLink ? ' and the online check-in link' : ''}</div></div>
      <a class="ns-btn" id="hs-guide" target="_blank" rel="noopener" style="height:32px;font-size:12.5px;background:#25D366;border-color:#25D366;display:inline-flex;align-items:center"
        href="https://wa.me/${phone}?text=${encodeURIComponent(guideText({ ...guide, property: ctx.property_name }, { guest: String(guest.full_name).split(/\s+/)[0], link: selfLink && !booking.self_checkin_at && live ? selfLink : null, room: bed ? unitName(bed.room, bed.label) : null }))}">Send on WhatsApp</a></div>` : ''}`;
  card.querySelector('#hs-meal')?.addEventListener('change', async (e) => {
    e.target.disabled = true;
    try { await rpc('booking_meal_set', { p_booking: booking.id, p_plan: e.target.value || null }); toast(e.target.value ? 'Meal plan added to the bill.' : 'Meal plan removed — room only.'); setTimeout(() => location.reload(), 500); }
    catch (err) { toast(err.message, { error: true }); e.target.disabled = false; e.target.value = m?.plan_id || ''; }
  });
}

// =================================================================== Dashboard: kitchen list
export async function mountKitchenCard(ctx) {
  const host = document.querySelector('.ns-content'); if (!host) return;
  const plans = await plansOrNull(ctx).catch(() => null);
  if (!plans?.length) return;                                          // no meal plans → no kitchen card
  const today = ymd(); const tomorrow = addDays(today, 1);
  const [a, b] = await Promise.all([rpc('kitchen_list', { p_property: ctx.property_id, p_day: today }), rpc('kitchen_list', { p_property: ctx.property_id, p_day: tomorrow })]);
  const t = (x, k) => x.totals[k] || 0;
  const chip = (label, n) => `<span class="hs-chip${n ? '' : ' is-zero'}"><b>${n}</b> ${label}</span>`;
  const card = document.createElement('div');
  card.className = 'ns-card hs-kitchen';
  card.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
      <div><div class="ns-h3">🍳 Kitchen</div><div class="ns-muted" style="font-size:12px">Meals from the guests’ meal plans</div></div>
      <button type="button" class="ns-btn-ghost" id="hs-kl" style="height:34px">Kitchen list</button></div>
    <div class="hs-kitchen-days">
      <div><div class="hs-day">Today</div>${chip('breakfast', t(a, 'breakfast'))}${chip('lunch', t(a, 'lunch'))}${chip('dinner', t(a, 'dinner'))}</div>
      <div><div class="hs-day">Tomorrow</div>${chip('breakfast', t(b, 'breakfast'))}${chip('lunch', t(b, 'lunch'))}${chip('dinner', t(b, 'dinner'))}</div></div>`;
  const stats = host.firstElementChild;
  (stats && stats.nextSibling ? stats : host.lastElementChild)?.insertAdjacentElement('afterend', card);
  card.querySelector('#hs-kl').onclick = () => {
    const list = (x) => (x.rows.length ? x.rows.map((r) => `<tr><td><b>${esc(r.guest)}</b><div class="ns-muted" style="font-size:11px">${esc(unitName(r.room, r.unit))} · ${esc(r.plan)}</div></td>
        <td style="text-align:center">${r.adults}${r.children ? ` + ${r.children}` : ''}</td><td style="text-align:center">${r.breakfast ? '✓' : ''}</td><td style="text-align:center">${r.lunch ? '✓' : ''}</td><td style="text-align:center">${r.dinner ? '✓' : ''}</td></tr>`).join('')
      : '<tr><td colspan="5" class="ns-empty">No meals.</td></tr>');
    const table = (x, title) => `<div class="ns-h3" style="margin:6px 0">${title} · ${esc(fmtDay(x.day + 'T12:00:00+05:30'))}</div>
      <table class="ns-table"><thead><tr><th>Guest</th><th style="text-align:center">Adults + kids</th><th style="text-align:center">Breakfast</th><th style="text-align:center">Lunch</th><th style="text-align:center">Dinner</th></tr></thead><tbody>${list(x)}</tbody></table>`;
    modal({ title: 'Kitchen list', width: 640, body: `<div style="display:flex;flex-direction:column;gap:16px">${table(a, 'Today')}${table(b, 'Tomorrow')}</div>`,
      actions: [{ label: 'Print', onClick: () => { window.print(); return false; } }, { label: 'Close', kind: 'primary' }] });
  };
}
