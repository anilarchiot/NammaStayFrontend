// Resort add-ons (034_resort.sql) — used only when the property is a Resort.
//   • Settings → Room types & pricing: Stay packages, Extra beds
//   • New booking: stay package + group / event
//   • Booking page: package, extra beds, group, activities
//   • Dashboard: today at the resort (activities, day visitors, groups arriving)
// Self-contained: if 034 isn't installed, the cards don't appear and nothing else changes.
import { rpc, esc, rupees, toPaise, toast, modal, field, options, ymd, addDays, fmtDay, $ } from '../core.js';

export const GROUP_KINDS = [['wedding', 'Wedding'], ['corporate', 'Corporate / offsite'], ['family', 'Family function'], ['school', 'School / college'], ['tour', 'Tour group'], ['other', 'Other']];
export const ACT_CATS = [['spa', 'Spa & wellness'], ['adventure', 'Adventure'], ['leisure', 'Leisure'], ['kids', 'Kids'], ['food', 'Food & dining'], ['other', 'Other']];
const notInstalled = (e) => /database update|Could not find the function|does not exist/i.test(e?.message || '');
const day = (d) => fmtDay(String(d).slice(0, 10) + 'T12:00:00+05:30');

// =================================================================== Settings → Room types: stay packages + extra beds
export async function mountResortSettings(ctx) {
  const host = document.querySelector('.ns-content'); if (!host) return;
  let pk; let st; let meals; let acts;
  try { [pk, st, meals, acts] = await Promise.all([rpc('stay_packages_list', { p_property: ctx.property_id }), rpc('resort_settings_get', { p_property: ctx.property_id }),
    rpc('meal_plans_list', { p_property: ctx.property_id }).catch(() => []), rpc('activities_list', { p_property: ctx.property_id })]); }
  catch (e) { if (notInstalled(e)) { host.insertAdjacentHTML('beforeend', '<div class="ns-card ns-muted">Resort features need the database update <b>034_resort.sql</b>.</div>'); return; } throw e; }
  const can = ctx.can('owner', 'manager') && ctx.allow('manage_rooms');

  // ---- extra beds
  const beds = document.createElement('div'); beds.className = 'ns-card'; beds.id = 'rs-beds';
  beds.innerHTML = `<div class="ns-h3">🛏 Extra beds</div>
    <div class="ns-muted">Charged per bed, per night. Add them on a booking — they go on the bill as “Extra bed”.</div>
    <div class="rs-row">${field('Price per extra bed, per night (₹)', `<input class="ns-input" name="eb_price" inputmode="decimal" value="${st.extra_bed_paise / 100}" ${can ? '' : 'disabled'}>`)}
      ${field('Most extra beds in a room', `<select class="ns-input" name="eb_max" ${can ? '' : 'disabled'}>${options([0, 1, 2, 3, 4].map((n) => [String(n), String(n)]), String(st.extra_bed_max))}</select>`)}
      ${can ? '<button type="button" class="ns-btn" id="eb-save" style="align-self:flex-end">Save</button>' : ''}</div>`;
  host.append(beds);
  $('#eb-save')?.addEventListener('click', async (e) => {
    const price = toPaise(beds.querySelector('[name=eb_price]').value || '0');
    if (Number.isNaN(price) || price < 0) return toast('Enter the price in rupees, e.g. 800.', { error: true });
    e.target.disabled = true;
    try { await rpc('resort_settings_save', { p_property: ctx.property_id, p: { extra_bed_paise: price, extra_bed_max: Number(beds.querySelector('[name=eb_max]').value) } }); toast('Extra-bed price saved.'); }
    catch (err) { toast(err.message, { error: true }); } finally { e.target.disabled = false; }
  });

  // ---- stay packages
  const card = document.createElement('div'); card.className = 'ns-card'; card.id = 'rs-packages'; card.style.cssText = 'padding:0;overflow:hidden';
  host.append(card);
  const draw = (list) => {
    card.innerHTML = `<div style="padding:18px 20px;display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
        <div><div class="ns-h3">🎁 Stay packages</div><div class="ns-muted">Fixed-price packages per room, e.g. “2N/3D Honeymoon” with meals and activities included. Choose one on a booking — the bill shows the room charge plus one “Package” line.</div></div>
        ${can ? '<button type="button" class="ns-btn" id="sp-add">+ Add package</button>' : ''}</div>
      <div style="overflow-x:auto"><table class="ns-table" style="min-width:640px"><thead><tr><th>Package</th><th>Nights</th><th style="text-align:right">Price / room</th><th>Includes</th><th>Offered</th><th class="ns-sticky-end"><span class="sr-only">Actions</span></th></tr></thead><tbody>
      ${list.map((p) => `<tr data-sp="${esc(p.id)}"><td><b>${esc(p.name)}</b><div class="ns-muted" style="font-size:11.5px">for ${p.base_guests} adults${p.extra_adult_paise ? ` · +${rupees(p.extra_adult_paise)} per extra adult` : ''}${p.child_paise ? ` · +${rupees(p.child_paise)} per child` : ''}</div></td>
          <td>${p.nights}</td><td style="text-align:right;font-weight:700">${rupees(p.price_paise)}</td>
          <td style="white-space:normal;min-width:200px">${esc([p.meal_plan, ...(p.activities || [])].filter(Boolean).join(' · ') || '—')}${p.includes ? `<div class="ns-muted" style="font-size:11.5px">${esc(p.includes)}</div>` : ''}</td>
          <td>${p.is_active ? '<span class="ns-pill green">Yes</span>' : '<span class="ns-pill grey">Hidden</span>'}</td>
          <td class="ns-sticky-end" style="text-align:right;white-space:nowrap">${can ? '<button type="button" class="ns-btn-ghost" data-sp-edit style="height:30px;font-size:12px">Edit</button> <button type="button" class="ns-btn-ghost" data-sp-del style="height:30px;font-size:12px;color:#B23A3A">Remove</button>' : ''}</td></tr>`).join('')
        || '<tr><td colspan="6" class="ns-empty">No packages yet.</td></tr>'}</tbody></table></div>`;
  };
  let list = pk; draw(list);
  const reload = async () => { list = await rpc('stay_packages_list', { p_property: ctx.property_id }); draw(list); };
  const edit = (p) => modal({
    title: p ? 'Edit stay package' : 'New stay package', width: 620,
    body: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div style="grid-column:1/-1">${field('Name', `<input class="ns-input" name="name" maxlength="60" value="${esc(p?.name || '')}" placeholder="e.g. 2N/3D Honeymoon">`)}</div>
      ${field('Nights', `<input class="ns-input" name="nights" type="number" min="1" max="30" value="${p?.nights || 2}">`)}
      ${field('Price per room (₹)', `<input class="ns-input" name="price" inputmode="decimal" value="${p ? p.price_paise / 100 : ''}" placeholder="whole package, e.g. 24000">`)}
      ${field('Adults included', `<input class="ns-input" name="base" type="number" min="1" max="20" value="${p?.base_guests || 2}">`)}
      ${field('Each extra adult (₹)', `<input class="ns-input" name="xadult" inputmode="decimal" value="${p ? p.extra_adult_paise / 100 : 0}">`)}
      ${field('Each child (₹)', `<input class="ns-input" name="child" inputmode="decimal" value="${p ? p.child_paise / 100 : 0}">`)}
      ${field('Meal plan included', `<select class="ns-input" name="meal"><option value="">None</option>${meals.map((m) => `<option value="${esc(m.id)}" ${p?.meal_plan_id === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select>`,
        meals.length ? '' : 'Add meal plans in the Meal plans card first.')}
      <div style="grid-column:1/-1"><div class="ns-field"><label>Activities included (once each)</label>
        <div style="display:flex;flex-wrap:wrap;gap:6px 14px">${acts.length ? acts.map((a) => `<label style="display:flex;gap:6px;align-items:center;font-size:13px"><input type="checkbox" name="act" value="${esc(a.id)}" ${p?.activity_ids?.includes(a.id) ? 'checked' : ''}> ${esc(a.name)}</label>`).join('')
          : '<span class="ns-muted" style="font-size:12.5px">No activities yet — add them on the Activities page.</span>'}</div></div></div>
      <div style="grid-column:1/-1">${field('Also includes (shown to staff and guests)', `<input class="ns-input" name="includes" maxlength="500" value="${esc(p?.includes || '')}" placeholder="e.g. Candle-light dinner · flower decoration">`)}</div>
      <label style="grid-column:1/-1;display:flex;gap:6px;align-items:center;font-size:13px"><input type="checkbox" name="active" ${!p || p.is_active ? 'checked' : ''}> Offer this package on new bookings</label></div>`,
    actions: [{ label: 'Cancel' }, { label: 'Save', kind: 'primary', onClick: async (el) => {
      const v = (n) => el.querySelector(`[name=${n}]`);
      const money = (n) => (v(n).value.trim() ? toPaise(v(n).value) : 0);
      const price = money('price'); if (!(price > 0)) throw new Error('Enter the package price.');
      await rpc('stay_package_save', { p_property: ctx.property_id, p: { id: p?.id || null, name: v('name').value.trim(), nights: Number(v('nights').value) || 1, price_paise: price,
        base_guests: Number(v('base').value) || 2, extra_adult_paise: money('xadult'), child_paise: money('child'), meal_plan_id: v('meal').value || null,
        activity_ids: [...el.querySelectorAll('[name=act]:checked')].map((x) => x.value), includes: v('includes').value.trim(), is_active: v('active').checked } });
      toast('Package saved.'); await reload();
    } }],
  });
  card.addEventListener('click', (e) => {
    if (e.target.closest('#sp-add')) { edit(null); return; }
    const row = e.target.closest('[data-sp]'); if (!row) return; const p = list.find((x) => x.id === row.dataset.sp);
    if (e.target.closest('[data-sp-edit]')) edit(p);
    if (e.target.closest('[data-sp-del]')) {
      modal({ title: 'Remove package', width: 420, body: `<p style="margin:0;font-size:14px">Remove <b>${esc(p.name)}</b>? Bookings that already have it keep it on their bill.</p>`,
        actions: [{ label: 'Cancel' }, { label: 'Remove', kind: 'danger', onClick: async () => { await rpc('stay_package_delete', { p_id: p.id }); toast('Package removed.'); await reload(); } }] });
    }
  });
}

// =================================================================== New booking: stay package + group / event
export async function mountCheckinResort({ ctx, unitsBox, refresh }) {
  let pk;
  try { pk = (await rpc('stay_packages_list', { p_property: ctx.property_id })).filter((p) => p.is_active); } catch { return null; }
  const box = document.createElement('div'); box.className = 'rs-ci';
  box.innerHTML = `${pk.length ? field('Stay package', `<select class="ns-input" name="rs_package"><option value="">No package (room rate)</option>${pk.map((p) => `<option value="${esc(p.id)}">${esc(p.name)} — ${rupees(p.price_paise)} / room · ${p.nights} night${p.nights > 1 ? 's' : ''}</option>`).join('')}</select>`,
      'The check-out date follows the package’s nights. Meals and activities in the package are included.') : ''}
    <label style="display:flex;gap:8px;align-items:center;font-size:13.5px;font-weight:700;margin-top:4px"><input type="checkbox" name="rs_group"> Group / event booking (wedding, corporate…)</label>
    <div class="rs-group" hidden>
      <div class="rs-row">${field('Group name *', '<input class="ns-input" name="rs_gname" maxlength="80" placeholder="e.g. Ananya & Rohit wedding">')}
        ${field('Type', `<select class="ns-input" name="rs_gkind">${options(GROUP_KINDS, 'wedding')}</select>`)}</div>
      <div class="rs-row">${field('Contact person', '<input class="ns-input" name="rs_gcontact" maxlength="120">')}
        ${field('Contact phone', '<input class="ns-input" name="rs_gphone" type="tel" placeholder="+91 98400 12233">')}</div>
      <div class="ns-help">Add every room with “+ Add another room”. All rooms are saved under this group with one group bill.</div></div>`;
  const wrapEl = unitsBox.parentElement.querySelector('#whole-home')?.parentElement || unitsBox;
  wrapEl.insertAdjacentElement('afterend', box);
  const sel = box.querySelector('[name=rs_package]');
  const grp = box.querySelector('[name=rs_group]');
  grp.addEventListener('change', () => { box.querySelector('.rs-group').hidden = !grp.checked; });
  const plan = () => pk.find((p) => p.id === sel?.value) || null;
  const priceFor = (p, r) => p.price_paise + p.extra_adult_paise * Math.max(r.adults - p.base_guests, 0) + p.child_paise * r.children;
  sel?.addEventListener('change', () => {
    const p = plan();
    if (p) {                                                     // check-out = check-in + package nights (same time)
      const inEl = document.querySelector('[name=check_in_at]'); const outEl = document.querySelector('[name=check_out_at]');
      if (inEl?.value && outEl) {
        const time = outEl.value.slice(10) || 'T11:00';
        outEl.value = addDays(inEl.value.slice(0, 10), p.nights) + time;
        outEl.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    refresh();
  });
  return {
    // the package replaces the room charge in the summary: (package − room) per room
    total(rows, n) { const p = plan(); if (!p) return 0; return rows.filter((r) => r.unit).reduce((t, r) => t + priceFor(p, r) - (r.unit.rate_paise + Math.max(0, r.adults - (r.unit.base_guests || 1)) * (r.unit.extra_guest_paise || 0)) * n, 0); },
    lines(rows, n) {
      const p = plan(); if (!p || !rows.some((r) => r.unit)) return '';
      const t = rows.filter((r) => r.unit).reduce((s, r) => s + priceFor(p, r), 0);
      return `<div style="display:flex;justify-content:space-between;gap:10px;font-size:13px;color:#FBF3DE"><span>🎁 ${esc(p.name)}<br><small style="color:#AEB6C9">${n === p.nights ? `package price for ${rows.filter((r) => r.unit).length} room${rows.filter((r) => r.unit).length > 1 ? 's' : ''}` : `<b style="color:#FF9B9B">set ${p.nights} night${p.nights > 1 ? 's' : ''}</b>`}</small></span><span>${rupees(t)}</span></div>`;
    },
    async save(made) {
      let failed = 0; const p = plan();
      if (p) for (const b of made) { try { await rpc('booking_package_set', { p_booking: b.id, p_package: p.id }); } catch (e) { failed += 1; toast(`Package not added to ${b.code}: ${e.message}`, { error: true }); } }
      if (grp.checked) {
        const name = box.querySelector('[name=rs_gname]').value.trim() || `Group ${made[0]?.code || ''}`;
        try { await rpc('group_save', { p_property: ctx.property_id, p: { name, kind: box.querySelector('[name=rs_gkind]').value, contact_name: box.querySelector('[name=rs_gcontact]').value.trim(),
          contact_phone: box.querySelector('[name=rs_gphone]').value.trim(), booking_ids: made.map((b) => b.id) } }); }
        catch (e) { failed += 1; toast(`Group not saved: ${e.message}`, { error: true }); }
      }
      return { failed };
    },
  };
}

// =================================================================== Booking page: package, extra beds, group, activities
export async function mountBookingResort({ ctx, booking, anchor }) {
  if (!anchor) return;
  let d; let pk;
  let groups = [];
  try { [d, pk, groups] = await Promise.all([rpc('booking_resort_get', { p_booking: booking.id }), rpc('stay_packages_list', { p_property: ctx.property_id }),
    rpc('groups_list', { p_property: ctx.property_id }).catch(() => [])]); } catch { return; }
  const staff = ctx.can('owner', 'manager', 'front_desk');
  const live = ['pending', 'confirmed', 'checked_in'].includes(booking.status);
  const canEdit = staff && live && ctx.allow('add_extras');
  const card = document.createElement('div'); card.className = 'rs-booking';
  card.style.cssText = 'display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:12px;background:#FFFDF6;border:1px solid #F0EBDB';
  anchor.insertAdjacentElement('afterend', card);
  const p = d.package; const offered = pk.filter((x) => x.is_active || x.id === p?.package_id);
  const sec = (first) => (first ? '' : 'border-top:1px solid #F3EFE1;padding-top:10px');
  const rows = [];
  if (p || offered.length) rows.push(`<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
      <div><div style="font-size:13.5px;font-weight:800">🎁 Stay package</div>
        <div class="ns-muted" style="font-size:11.5px">${p ? `${esc(p.name)} · ${rupees(p.price_paise)} (room ${rupees(p.room_paise)} + package line)${p.activities.length ? ` · includes ${p.activities.map((a) => `${esc(a.name)}${a.used ? ' ✓' : ''}`).join(', ')}` : ''}` : 'No package — room rate'}</div></div>
      ${canEdit ? `<select class="ns-input" id="rs-pkg" style="height:34px;width:auto;max-width:240px"><option value="">No package</option>${offered.map((x) => `<option value="${esc(x.id)}" ${p?.package_id === x.id ? 'selected' : ''}>${esc(x.name)} (${x.nights}N)</option>`).join('')}</select>` : ''}</div>`);
  if (d.settings.extra_bed_max > 0) rows.push(`<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;${sec(!rows.length)}">
      <div><div style="font-size:13.5px;font-weight:800">🛏 Extra beds</div><div class="ns-muted" style="font-size:11.5px">${d.extra_beds ? `${d.extra_beds} × ${rupees(d.settings.extra_bed_paise)} a night on the bill` : `${rupees(d.settings.extra_bed_paise)} per bed, per night`}</div></div>
      ${canEdit ? `<select class="ns-input" id="rs-beds" style="height:34px;width:auto">${options(Array.from({ length: d.settings.extra_bed_max + 1 }, (_, i) => [String(i), i ? `${i} extra bed${i > 1 ? 's' : ''}` : 'No extra bed']), String(d.extra_beds))}</select>` : ''}</div>`);
  rows.push(`<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;${sec(!rows.length)}">
      <div style="min-width:0"><div style="font-size:13.5px;font-weight:800">🌿 Activities</div><div class="ns-muted" style="font-size:11.5px">${d.activities.length ? d.activities.map((a) => `${esc(a.name)} · ${day(a.day)} ${esc(a.slot)} · ${a.persons} ${a.status === 'cancelled' ? '(cancelled)' : a.included ? '(included)' : rupees(a.amount_paise)}`).join('<br>') : 'None booked yet'}</div></div>
      ${staff && live ? `<a class="ns-btn-ghost" href="activities.html?booking=${esc(booking.id)}" style="height:32px;font-size:12.5px;display:inline-flex;align-items:center">+ Book activity</a>` : ''}</div>`);
  if (!d.group && staff && live && groups.length) rows.push(`<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;${sec(false)}">
      <div><div style="font-size:13.5px;font-weight:800">👥 Group</div><div class="ns-muted" style="font-size:11.5px">Not in a group</div></div>
      <select class="ns-input" id="rs-grp" style="height:34px;width:auto;max-width:240px"><option value="">Add to group…</option>${groups.map((x) => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')}</select></div>`);
  if (d.group) rows.push(`<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;${sec(false)}">
      <div><div style="font-size:13.5px;font-weight:800">👥 Group</div><div class="ns-muted" style="font-size:11.5px">${esc(d.group.name)}</div></div>
      <a class="ns-btn-ghost" href="groups.html?id=${esc(d.group.id)}" style="height:32px;font-size:12.5px;display:inline-flex;align-items:center">Open group bill</a></div>`);
  card.innerHTML = rows.join('');
  const act = (fn, msg) => async (e) => { e.target.disabled = true; try { await fn(e.target.value); toast(msg(e.target.value)); setTimeout(() => location.reload(), 500); } catch (err) { toast(err.message, { error: true }); e.target.disabled = false; } };
  card.querySelector('#rs-pkg')?.addEventListener('change', act((v) => rpc('booking_package_set', { p_booking: booking.id, p_package: v || null }), (v) => (v ? 'Package added to the bill.' : 'Package removed.')));
  card.querySelector('#rs-grp')?.addEventListener('change', act((v) => rpc('group_save', { p_property: ctx.property_id, p: { ...groups.find((x) => x.id === v), booking_ids: [booking.id] } }), () => 'Added to the group.'));
  card.querySelector('#rs-beds')?.addEventListener('change', act((v) => rpc('booking_extra_beds_set', { p_booking: booking.id, p_beds: Number(v) }), (v) => (Number(v) ? 'Extra bed added to the bill.' : 'Extra bed removed.')));
}

// =================================================================== Dashboard: today at the resort
export async function mountResortToday(ctx) {
  const host = document.querySelector('.ns-content'); if (!host) return;
  let d; try { d = await rpc('resort_today', { p_property: ctx.property_id, p_day: ymd() }); } catch { return; }
  const dv = d.day_visits;
  const card = document.createElement('div'); card.className = 'ns-card rs-today';
  card.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
      <div><div class="ns-h3">🌴 Today at the resort</div><div class="ns-muted" style="font-size:12px">Activities, day visitors and groups</div></div>
      <span style="display:flex;gap:8px;flex-wrap:wrap"><a class="ns-btn-ghost" href="activities.html" style="height:34px;display:inline-flex;align-items:center">Activities</a>
        <a class="ns-btn-ghost" href="day-visitors.html" style="height:34px;display:inline-flex;align-items:center">Day visitors</a></span></div>
    <div class="rs-today-grid">
      <div><div class="hs-day">Activities</div>${d.activities.length ? d.activities.slice(0, 6).map((a) => `<div class="rs-li"><b>${esc(a.slot)}</b> ${esc(a.name)} <span class="ns-muted">· ${a.people} ${a.people === 1 ? 'person' : 'people'}</span></div>`).join('')
        + (d.activities.length > 6 ? `<div class="ns-muted" style="font-size:12px">+ ${d.activities.length - 6} more</div>` : '') : '<div class="ns-muted" style="font-size:12.5px">Nothing booked today.</div>'}</div>
      <div><div class="hs-day">Day visitors</div><div class="rs-li"><b>${dv.people}</b> expected · <b>${dv.arrived}</b> arrived</div><div class="rs-li"><b>${dv.lunches}</b> lunches · ${dv.visits} booking${dv.visits === 1 ? '' : 's'}</div></div>
      <div><div class="hs-day">Groups arriving</div>${d.groups.length ? d.groups.map((g) => `<div class="rs-li"><a href="groups.html?id=${esc(g.id)}"><b>${esc(g.name)}</b></a> <span class="ns-muted">· ${g.rooms} room${g.rooms > 1 ? 's' : ''}</span></div>`).join('') : '<div class="ns-muted" style="font-size:12.5px">No groups today.</div>'}</div>
    </div>`;
  const first = host.firstElementChild;
  (first ? first : host).insertAdjacentElement(first ? 'afterend' : 'afterbegin', card);
}
