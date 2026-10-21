// Check-in form add-on: "Other guests" — enter everyone in the room while booking (030_booking_guests.sql).
// Hotels & homestays (rooms): for each room, one block per extra adult and one per child.
// Everything is optional at this step; anything left empty can be added later on the booking page.
// Self-contained: if the database update isn't installed, the section doesn't appear.
import { rpc, esc, field, options, countryOptions, ID_TYPES, idUploadFields, wireIdPreviews, uploadIdSides, roomsMode } from '../core.js';

const GENDERS = [['female', 'Female'], ['male', 'Male'], ['other', 'Other']];

/**
 * @param {{ ctx: object, unitsBox: HTMLElement, after: HTMLElement }} o
 * @returns {Promise<null | { save: (made: {id:string}[]) => Promise<{saved:number, failed:number}> }>}
 */
export async function mountCheckinGuests({ ctx, unitsBox, after }) {
  if (!roomsMode() || !unitsBox || !after) return null;
  try { await rpc('booking_guests_list', { p_booking: '00000000-0000-0000-0000-000000000000' }); }
  catch (e) { if (/database update/i.test(e.message)) return null; }      // 030 not installed → no section ("not found" is fine)

  const card = document.createElement('div');
  card.className = 'ns-card ci-guests';
  card.style.cssText = 'display:flex;flex-direction:column;gap:14px;padding:22px';
  after.insertAdjacentElement('afterend', card);
  const kept = new Map();                                   // "row:slot" → saved field values while the form is re-drawn

  const adultsPerRow = () => [...unitsBox.querySelectorAll('.unit-row')].map((r) => {
    const sel = r.querySelector('select');
    const label = sel?.selectedOptions?.[0]?.textContent?.split('·').slice(0, 2).join('·').trim() || `Room ${[...unitsBox.children].indexOf(r) + 1}`;
    return { adults: Math.max(1, parseInt(r.querySelector('[name=adults]')?.value, 10) || 1),
      children: Math.max(0, parseInt(r.querySelector('[name=children]')?.value, 10) || 0), label };
  });

  const remember = () => card.querySelectorAll('[data-slot]').forEach((b) => {
    const v = {}; b.querySelectorAll('input:not([type=file]), select').forEach((i) => { v[i.dataset.f] = i.value; });
    kept.set(b.dataset.slot, { ...v, files: b.querySelectorAll('input[type=file]') });
  });

  function draw() {
    remember();
    const rows = adultsPerRow();
    const total = rows.reduce((s, r) => s + r.adults - 1 + r.children, 0);
    card.hidden = total === 0;
    if (!total) { card.innerHTML = ''; return; }
    card.innerHTML = `<div><div class="ns-h3">Other guests in the room${rows.length > 1 ? 's' : ''}</div>
        <div class="ns-muted" style="font-size:12.5px;margin-top:2px">Everyone staying in the room — ${total} more guest${total > 1 ? 's' : ''} besides the main guest. Optional now; you can add or finish them later on the booking. ID number and photo help with police / Form C records.</div></div>
      ${rows.map((r, ri) => [...Array.from({ length: r.adults - 1 }, (_, k) => slot(ri, `a${k}`, `Guest ${k + 2}`, rows.length > 1 ? r.label : '')),
        ...Array.from({ length: r.children }, (_, k) => slot(ri, `c${k}`, `Child ${k + 1}`, rows.length > 1 ? r.label : '', true))].join('')).join('')}`;
    // put back photos the user already chose (file inputs can't be re-filled, so move the original elements)
    card.querySelectorAll('[data-slot]').forEach((b) => {
      const old = kept.get(b.dataset.slot)?.files;
      if (old?.length) b.querySelectorAll('.ns-id-drop').forEach((drop, i) => { if (old[i]?.files?.length) drop.replaceWith(old[i].closest('.ns-id-drop')); });
    });
    wireIdPreviews(card);
  }

  function slot(ri, k, title, roomLabel, child = false) {
    const key = `${ri}:${k}`; const v = kept.get(key) || (child ? { relation: 'Child', id_type: '' } : {});
    const inp = (f, label, attrs = '') => field(label, `<input class="ns-input" data-f="${f}" ${attrs} value="${esc(v[f] || '')}">`);
    return `<div data-slot="${key}" style="border:1px solid #F0EBDB;border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:12px;background:#FFFDF6">
      <div style="font-size:12px;font-weight:800;color:#6B7280;text-transform:uppercase;letter-spacing:.04em">${esc(title)}${roomLabel ? ` · ${esc(roomLabel)}` : ''}</div>
      <div class="ci-g-grid">
        ${inp('full_name', 'Full name', 'maxlength="120" placeholder="As on the ID"')}
        ${inp('phone', 'Phone', 'type="tel" placeholder="Optional"')}
        ${inp('relation', 'Relation', 'maxlength="40" placeholder="Spouse, friend, child…"')}
        ${inp('age', 'Age', `type="number" min="0" max="${child ? 17 : 120}" inputmode="numeric"`)}
        ${field('Gender', `<select class="ns-input" data-f="gender"><option value="">—</option>${options(GENDERS, v.gender || '')}</select>`)}
        ${field('Nationality', `<select class="ns-input" data-f="nationality">${countryOptions(v.nationality || 'India')}</select>`)}
        ${field('Proof of identity', `<select class="ns-input" data-f="id_type"><option value="">None</option>${options(ID_TYPES, v.id_type ?? 'aadhaar')}</select>`)}
        ${inp('id_number', 'ID number', 'autocomplete="off"')}
      </div>
      ${child ? '' : idUploadFields({ front: 'ID photo — front (optional)', back: 'ID photo — back (optional)' })}
    </div>`;
  }

  draw();
  unitsBox.addEventListener('input', (e) => { if (['adults', 'children'].includes(e.target.name)) draw(); });
  unitsBox.addEventListener('change', (e) => { if (e.target.tagName === 'SELECT') draw(); });
  new MutationObserver(() => draw()).observe(unitsBox, { childList: true });

  return {
    /** After the bookings are created (same order as the room rows): save the guests that have a name. */
    async save(made) {
      let saved = 0; let failed = 0;
      for (const b of card.querySelectorAll('[data-slot]')) {
        const g = {}; b.querySelectorAll('input:not([type=file]), select').forEach((i) => { g[i.dataset.f] = i.value.trim(); });
        if ((g.full_name || '').length < 2) continue;
        if (!g.id_type) { delete g.id_type; delete g.id_number; }
        const booking = made[Number(b.dataset.slot.split(':')[0])];
        if (!booking) continue;
        try {
          Object.assign(g, await uploadIdSides(b, `${ctx.property_id}/staff`));
          await rpc('booking_guest_save', { p_booking: booking.id, p: g });
          saved += 1;
        } catch { failed += 1; }
      }
      return { saved, failed };
    },
  };
}
