// Booking detail add-on: "Other guests in this booking" (030_booking_guests.sql).
// A hotel / homestay room often has 2+ people — the main guest stays on the booking as before,
// everyone else is listed here with their own details and ID.
// Self-contained: if the database update isn't installed yet, the card simply doesn't show.
import {
  rpc, sb, esc, toast, modal, confirmDialog, field, options, countryOptions, ID_TYPES, avatar, titleCase,
  idUploadFields, wireIdPreviews, uploadIdSides, viewIdDocs, roomsMode,
} from '../core.js';

const GENDERS = [['female', 'Female'], ['male', 'Male'], ['other', 'Other']];

/** Mount the card right after `anchor` (the main guest box). */
export async function mountBookingGuests({ ctx, booking, anchor }) {
  if (!anchor) return;
  const staff = ctx.can('owner', 'manager', 'front_desk');
  let list;
  try { list = await rpc('booking_guests_list', { p_booking: booking.id }); } catch { return; }   // not installed yet → no card
  const adults = Math.max(1, Number(booking.visitors) || 1);
  if (!list.length && !(roomsMode() || adults > 1)) return;          // hostel bed for one person: nothing to show

  const card = document.createElement('div');
  card.className = 'ns-bguests';
  card.style.cssText = 'display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:12px;background:#FFFDF6;border:1px solid #F0EBDB';
  anchor.insertAdjacentElement('afterend', card);

  const draw = () => {
    const missing = Math.max(0, adults - 1 - list.length);
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
        <div><div style="font-size:13.5px;font-weight:800">Other guests in this booking</div>
          <div class="ns-muted" style="font-size:11.5px">${list.length ? `${list.length + 1} guests in total (main guest + ${list.length})` : 'Only the main guest so far'}${missing ? ` · <b style="color:#B4711A">${missing} more to add</b> (booked for ${adults} adults)` : ''}</div></div>
        ${staff ? '<button type="button" class="ns-btn-ghost" data-bg-add style="height:32px;font-size:12.5px">+ Add guest</button>' : ''}
      </div>
      ${list.map((g) => `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid #F3EFE1" data-bg="${esc(g.id)}">
          ${avatar(g.full_name, 32)}
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:700">${esc(g.full_name)}${g.relation ? ` <span class="ns-muted" style="font-weight:600">· ${esc(g.relation)}</span>` : ''}</div>
            <div class="ns-muted" style="font-size:11.5px">${esc([g.age != null ? `${g.age} yrs` : '', g.gender ? titleCase(g.gender) : '', g.phone].filter(Boolean).join(' · ') || '—')}</div>
            ${g.id_type || g.nationality ? `<div class="ns-muted" style="font-size:11.5px">${esc([g.id_type ? titleCase(g.id_type) + (g.id_number ? ' · ' + g.id_number : '') : '', g.nationality].filter(Boolean).join(' · '))}</div>` : ''}
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">
            ${g.id_doc_path || g.id_doc_back_path ? '<button type="button" class="ns-btn-ghost" data-bg-id style="height:30px;font-size:12px">View ID</button>' : ''}
            ${staff ? `<button type="button" class="ns-btn-ghost" data-bg-edit style="height:30px;font-size:12px">Edit</button>
              <button type="button" class="ns-btn-ghost" data-bg-del style="height:30px;font-size:12px;color:#B23A3A" aria-label="Remove ${esc(g.full_name)}">Remove</button>` : ''}
          </div>
        </div>`).join('')}`;
  };
  draw();

  const reload = async () => { list = await rpc('booking_guests_list', { p_booking: booking.id }); draw(); };

  card.addEventListener('click', async (e) => {
    if (e.target.closest('[data-bg-add]')) { edit(null); return; }
    const row = e.target.closest('[data-bg]'); if (!row) return;
    const g = list.find((x) => x.id === row.dataset.bg); if (!g) return;
    if (e.target.closest('[data-bg-id]')) { viewIdDocs({ front: g.id_doc_path, back: g.id_doc_back_path, name: g.full_name }).catch((err) => toast(err.message, { error: true })); return; }
    if (e.target.closest('[data-bg-edit]')) { edit(g); return; }
    if (e.target.closest('[data-bg-del]')) {
      if (!await confirmDialog('Remove guest', `Remove ${g.full_name} from this booking? Their ID photo is deleted too.`, { confirmLabel: 'Remove', danger: true })) return;
      try {
        await rpc('booking_guest_delete', { p_id: g.id });
        const files = [g.id_doc_path, g.id_doc_back_path].filter(Boolean);
        if (files.length) await sb.storage.from('guest-ids').remove(files).catch(() => {});
        toast(`${g.full_name} removed.`); await reload();
      } catch (err) { toast(err.message, { error: true }); }
    }
  });

  function edit(g) {
    const x = g || {};
    modal({
      title: g ? `Edit ${x.full_name}` : 'Add a guest to this booking', width: 600,
      body: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <div style="grid-column:1/-1">${field('Full name *', `<input class="ns-input" name="full_name" maxlength="120" value="${esc(x.full_name || '')}" placeholder="As on the ID">`)}</div>
          ${field('Phone', `<input class="ns-input" name="phone" type="tel" value="${esc(x.phone || '')}" placeholder="Optional">`)}
          ${field('Relation to main guest', `<input class="ns-input" name="relation" maxlength="40" value="${esc(x.relation || '')}" placeholder="e.g. Spouse, Friend, Child">`)}
          ${field('Age', `<input class="ns-input" name="age" type="number" min="0" max="120" inputmode="numeric" value="${x.age ?? ''}">`)}
          ${field('Gender', `<select class="ns-input" name="gender"><option value="">—</option>${options(GENDERS, x.gender || '')}</select>`)}
          ${field('Nationality', `<select class="ns-input" name="nationality">${countryOptions(x.nationality || 'India')}</select>`)}
          ${field('Proof of identity', `<select class="ns-input" name="id_type"><option value="">None</option>${options(ID_TYPES, x.id_type || '')}</select>`)}
          <div style="grid-column:1/-1">${field('ID number', `<input class="ns-input" name="id_number" autocomplete="off" value="${esc(x.id_number || '')}">`, 'Aadhaar: only the last 4 digits are kept.')}</div>
          <div style="grid-column:1/-1">${idUploadFields({ front: x.id_doc_path ? 'ID front — replace (optional)' : 'ID front (optional)',
            back: x.id_doc_back_path ? 'ID back — replace (optional)' : 'ID back (optional)', hasFront: !!x.id_doc_path, hasBack: !!x.id_doc_back_path })}</div>
        </div>`,
      actions: [{ label: 'Cancel' }, { label: g ? 'Save changes' : 'Add guest', kind: 'primary', onClick: async (el) => {
        const v = (n) => el.querySelector(`[name=${n}]`).value.trim();
        if (v('full_name').length < 2) throw new Error('Please enter the guest’s full name.');
        const p = { id: g?.id || null, full_name: v('full_name'), phone: v('phone'), relation: v('relation'), age: v('age'),
          gender: v('gender'), nationality: v('nationality'), id_type: v('id_type'), id_number: v('id_number') };
        Object.assign(p, await uploadIdSides(el, `${ctx.property_id}/staff`));
        const r = await rpc('booking_guest_save', { p_booking: booking.id, p });
        const old = [r?.old_id_doc_path, r?.old_id_doc_back_path].filter(Boolean);
        if (old.length) await sb.storage.from('guest-ids').remove(old).catch(() => {});
        toast(g ? 'Guest updated.' : `${p.full_name} added to the booking.`);
        await reload();
      } }],
    });
    wireIdPreviews(document.querySelector('.ns-modal'));
  }
}

