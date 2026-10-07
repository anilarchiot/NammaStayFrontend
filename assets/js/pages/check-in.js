import { guestFace, newId, countryOptions, statusPill, fmtDayTime, fmtDay, headerActions, headerSearch, setSubtitle, confirmDialog, sendBookingWhatsApp, W, roomsMode, guestsText, idUploadFields, wireIdPreviews, uploadIdSides,
  page, rpc, q, sb, $, esc, rupees, toPaise, ymd, addDays, daysBetween, fromInputDT, field, options,
  ID_TYPES, SOURCES, METHOD_OPTIONS, toast, compressImage, uploadIdDoc, param, uuidOk, debounce, content,
} from '../core.js';

page('checkin', async (ctx) => {
  // No booking details in the link → show today's arrivals first; the form opens with "+ New registration"
  if (!param('new') && !uuidOk(param('guest')) && !uuidOk(param('bed')) && !param('in')) return arrivalsView(ctx);
  const back = document.querySelector('.ns-main > [style*="height:76px"] a[href="bookings.html"]');
  if (back) { back.href = 'check-in.html'; back.textContent = '← Check-in list'; }
  const guestId = uuidOk(param('guest')) ? param('guest') : null;
  const existing = guestId ? await q(sb.from('guests').select('id, full_name, phone, email, nationality').eq('id', guestId).single()) : null;
  const today = ymd();
  // Opened from the calendar: ?bed=…&in=YYYY-MM-DD&out=YYYY-MM-DD
  const dayOk = (x) => /^\d{4}-\d{2}-\d{2}$/.test(x || '');
  const preIn = dayOk(param('in')) ? param('in') : today;
  const preOut = dayOk(param('out')) && param('out') > preIn ? param('out') : addDays(preIn, 1);
  const preBed = uuidOk(param('bed')) ? param('bed') : null;
  const state = { beds: [], bed: null, method: 'upi', guest: existing };

  const L = (s) => `<div style="display:flex;justify-content:space-between;font-size:13px;color:#AEB6C9">${s}</div>`;
  content(`
    <div style="display:flex;flex-direction:column;gap:20px;min-width:0">
      <div class="ns-card" style="display:flex;flex-direction:column;gap:16px;padding:22px">
        <div class="ns-h3">Guest details</div>
        <div id="returning" hidden></div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          ${field('Full name *', `<input class="ns-input" name="full_name" autocomplete="off" placeholder="e.g. Rahul Kannan" value="">`)}
          ${field('Phone number', `<input class="ns-input" name="phone" type="tel" autocomplete="off" placeholder="+91 98400 12233" value="">`)}
          <div class="gs-wrap" id="gs-wrap" style="grid-column:1/-1"><div class="gs-list" id="gs-list" hidden role="listbox" aria-label="Matching guests"></div></div>
          ${field('Email address', `<input class="ns-input" name="email" type="email" autocomplete="off" placeholder="guest@email.com" value="">`)}
          ${field('Date of birth', `<input class="ns-input" name="dob" type="date" max="${today}">`)}
          ${field('Nationality', `<select class="ns-input" name="nationality">${countryOptions('India')}</select>`)}
          ${field('Proof of identity', `<select class="ns-input" name="id_type"><option value="">Select…</option>${options(ID_TYPES, 'aadhaar')}</select>`)}
          ${field('ID document number', '<input class="ns-input" name="id_number" autocomplete="off" placeholder="e.g. XXXX XXXX 4821">', 'Aadhaar: only the last 4 digits are stored.')}
          <div style="grid-column:1/3">${idUploadFields({ front: 'ID photo — front (optional)', back: 'ID photo — back (optional)' })}
            <div class="ns-help" style="margin-top:6px" id="id-help">Compressed before upload. Deleted automatically after the retention period in Settings.</div></div>
        </div>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:#6B7280">
          <input type="checkbox" name="send_confirmation" checked style="width:16px;height:16px;accent-color:#1C9A6C">
          Email the booking confirmation and online check-in link to the guest</label>
      </div>

      <div class="ns-card" style="display:flex;flex-direction:column;gap:16px;padding:22px">
        <div class="ns-h3">Stay details</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          ${field('Check-in date & time *', `<input class="ns-input" name="check_in_at" type="datetime-local" value="${preIn}T14:00">`)}
          ${field('Check-out date & time *', `<input class="ns-input" name="check_out_at" type="datetime-local" value="${preOut}T11:00">`)}
          ${field('Booked via', `<select class="ns-input" name="source">${options(SOURCES, 'walk_in')}</select>`)}
        </div>
        <div id="units" style="display:flex;flex-direction:column;gap:10px"></div>
        <button type="button" class="ns-btn-ghost" id="add-unit" style="align-self:flex-start">+ Add another ${W.unit}</button>
        ${field('Note (optional)', '<textarea class="ns-input" name="note" maxlength="2000" placeholder="Late arrival, special request, etc."></textarea>')}
      </div>
    </div>

    <div style="display:flex;flex-direction:column;gap:14px;min-width:0">
      <div class="ns-card-dark" style="padding:24px;display:flex;flex-direction:column;gap:16px">
        <div class="ns-h3" style="color:#FBF3DE">Booking summary</div>
        <div id="s-lines" style="display:flex;flex-direction:column;gap:8px"></div>
        ${L('<span>Nights</span><span id="s-nights">1</span>')}
        <div style="height:1px;background:#22305A"></div>
        <div style="display:flex;justify-content:space-between;font-size:17px;font-weight:700;color:#FBF3DE"><span>Total</span><span id="s-total">₹0</span></div>
        <div style="height:1px;background:#22305A"></div>
        <div class="ns-field" data-paysec><label style="color:#AEB6C9">Paid now (₹)</label>
          <input class="ns-input" name="paid_now" inputmode="decimal" placeholder="0" style="background:#15244A;border-color:#2A3963;color:#FBF3DE"></div>
        <div class="ns-field"><label style="color:#AEB6C9">Payment method</label>
          <div class="ns-seg" id="method">${METHOD_OPTIONS.slice(0, 3).map(([v, l]) => `<button type="button" data-m="${v}" class="${v === 'upi' ? 'is-on' : ''}">${l}</button>`).join('')}</div></div>
        <div class="ns-field" id="ref-wrap"><label style="color:#AEB6C9">UPI transaction ID (UTR)</label>
          <input class="ns-input" name="reference" autocomplete="off" placeholder="12-digit UTR" style="background:#15244A;border-color:#2A3963;color:#FBF3DE"></div>
      </div>
      <div class="ns-error" id="err" role="alert" hidden></div>
      <button type="button" class="ns-btn ns-btn-lg" id="checkin-now">Confirm booking &amp; check in</button>
      <button type="button" class="ns-btn-ghost ns-btn-lg" id="save-confirmed" style="height:44px">Save booking (arriving later)</button>
    </div>`, 'padding:28px 32px;display:grid;grid-template-columns:1fr 380px;gap:24px;');

  const f = (n) => document.querySelector(`[name="${n}"]`);
  wireIdPreviews(document.querySelector('.ns-content'));
  if (!ctx.allow('record_payments')) {                     // this role can't take payments
    const sec = document.querySelector('[data-paysec]'); let el = sec;
    while (el && el.nextElementSibling && !el.nextElementSibling.matches('#err, .ns-error, button')) { el = el.nextElementSibling; el.style.display = 'none'; }
    if (sec) sec.style.display = 'none';
  }
  const nights = () => {
    const a = f('check_in_at').value.slice(0, 10); const b = f('check_out_at').value.slice(0, 10);
    return a && b ? Math.max(1, daysBetween(a, b)) : 1;
  };

  // ---- one or more rooms/beds in this booking
  const rooms = roomsMode();
  const unitsBox = $('#units');
  const rowHtml = (first) => `<div class="unit-row" style="display:grid;grid-template-columns:${rooms ? '1fr 90px 90px' : '1fr'}${first ? '' : ' 40px'};gap:10px;align-items:end">
      ${field(first ? `${W.Unit} *` : `Another ${W.unit}`, '<select class="ns-input" name="unit"></select>')}
      ${rooms ? `${field('Adults', '<input class="ns-input" name="adults" type="number" min="1" max="20" value="2">')}${field('Children', '<input class="ns-input" name="children" type="number" min="0" max="20" value="0">')}` : ''}
      ${first ? '' : `<button type="button" class="ns-icon-del" data-remove aria-label="Remove this ${W.unit}" title="Remove">✕</button>`}
    </div>`;
  const addRow = (first = false) => {
    unitsBox.insertAdjacentHTML('beforeend', rowHtml(first));
    const row = unitsBox.lastElementChild; fillSelect(row.querySelector('[name=unit]')); summary();
  };
  const rowsData = () => [...unitsBox.querySelectorAll('.unit-row')].map((r) => ({
    el: r, unit: state.beds.find((x) => x.id === r.querySelector('[name=unit]').value) || null,
    adults: rooms ? Math.max(1, parseInt(r.querySelector('[name=adults]').value, 10) || 1) : 1,
    children: rooms ? Math.max(0, parseInt(r.querySelector('[name=children]').value, 10) || 0) : 0 }));
  const extraFor = (u, adults) => Math.max(0, adults - (u.base_guests || 1)) * (u.extra_guest_paise || 0);
  const lineTotal = (r) => (r.unit ? (r.unit.rate_paise + extraFor(r.unit, r.adults)) * nights() : 0);
  function fillSelect(sel, keep) {
    const chosen = [...unitsBox.querySelectorAll('[name=unit]')].filter((x) => x !== sel).map((x) => x.value);
    const cur = keep ?? sel.value;
    const list = state.beds.filter((x) => !chosen.includes(x.id));
    sel.innerHTML = list.length
      ? `<option value="">Choose a ${W.unit}…</option>` + list.map((x) => `<option value="${esc(x.id)}" ${x.id === cur ? 'selected' : ''}>${esc(x.room_name)} · ${esc(x.label)} — ${rupees(x.rate_paise)}/night${rooms && x.max_guests ? ` · up to ${x.max_guests}` : ''}</option>`).join('')
      : `<option value="">No ${W.units} free for these dates</option>`;
  }
  function summary() {
    const rows = rowsData(); const n = nights();
    state.bed = rows[0]?.unit || null;
    $('#s-lines').innerHTML = rows.filter((r) => r.unit).map((r) => {
      const ex = extraFor(r.unit, r.adults);
      const over = rooms && r.adults + r.children > (r.unit.max_guests || 1);
      return `<div style="display:flex;justify-content:space-between;gap:10px;font-size:13px;color:#AEB6C9"><span>${esc(r.unit.room_name)} · ${esc(r.unit.label)}${rooms ? `<br><small>${guestsText(r.adults, r.children)}${ex ? ` · +${rupees(ex)} extra guest` : ''}</small>` : ''}
        ${over ? `<br><small style="color:#FF9B9B">Fits up to ${r.unit.max_guests}</small>` : ''}</span><span>${rupees(r.unit.rate_paise + ex)} / night</span></div>`;
    }).join('') || `<div style="font-size:13px;color:#AEB6C9">No ${W.unit} selected</div>`;
    $('#s-nights').textContent = n;
    $('#s-total').textContent = rupees(rows.reduce((t, r) => t + lineTotal(r), 0));
    $('#checkin-now').hidden = f('check_in_at').value.slice(0, 10) !== today;
    $('#add-unit').hidden = !state.beds.length || rows.length >= Math.min(10, state.beds.length);
  }
  async function loadBeds() {
    const inAt = fromInputDT(f('check_in_at').value); const outAt = fromInputDT(f('check_out_at').value);
    if (!inAt || !outAt || new Date(outAt) <= new Date(inAt)) {
      state.beds = []; unitsBox.querySelectorAll('[name=unit]').forEach((x) => { x.innerHTML = '<option value="">Check-out must be after check-in</option>'; }); summary(); return;
    }
    state.beds = await rpc('available_beds', { p_property: ctx.property_id, p_in: inAt, p_out: outAt });
    const sels = [...unitsBox.querySelectorAll('[name=unit]')];
    sels.forEach((x, i) => fillSelect(x, x.value || (i === 0 ? preBed : '')));
    summary();
  }
  unitsBox.addEventListener('change', (e) => { if (e.target.name === 'unit') unitsBox.querySelectorAll('[name=unit]').forEach((x) => { if (x !== e.target) fillSelect(x); }); summary(); });
  unitsBox.addEventListener('input', (e) => { if (['adults', 'children'].includes(e.target.name)) summary(); });
  unitsBox.addEventListener('click', (e) => { const b = e.target.closest('[data-remove]'); if (b) { b.closest('.unit-row').remove(); unitsBox.querySelectorAll('[name=unit]').forEach((x) => fillSelect(x)); summary(); } });
  $('#add-unit').addEventListener('click', () => addRow(false));
  addRow(true);

  ['check_in_at', 'check_out_at'].forEach((n) => f(n).addEventListener('change', loadBeds));

  $('#method').addEventListener('click', (e) => {
    const b = e.target.closest('[data-m]'); if (!b) return;
    state.method = b.dataset.m;
    $('#method').querySelectorAll('button').forEach((x) => x.classList.toggle('is-on', x === b));
    $('#ref-wrap').hidden = state.method !== 'upi';
  });

  // ---- existing guest: live suggestions while typing name or phone, autofill on tap
  const offers = await q(sb.from('properties').select('offers').eq('id', ctx.property_id).limit(1)).then((r) => r[0]?.offers || null).catch(() => null);
  const GF = ['full_name', 'phone', 'email', 'dob', 'nationality', 'id_type', 'id_number'];
  const list = $('#gs-list'); let lastQ = '';
  const hideList = () => { list.hidden = true; list.innerHTML = ''; };
  async function suggest(src) {
    if (state.guest) return;
    const v = src.value.trim(); const digits = v.replace(/\D/g, '');
    const qv = src.name === 'phone' ? (digits.length >= 6 ? digits : '') : (v.length >= 3 ? v : '');
    if (!qv) { hideList(); return; }
    if (qv === lastQ && !list.hidden) return; lastQ = qv;
    const found = await rpc('search_guests', { p_property: ctx.property_id, p_q: qv }).catch(() => []);
    if (!found.length || state.guest) { hideList(); return; }
    list.innerHTML = `<div class="gs-head">Existing guests — tap to fill in</div>` + found.slice(0, 6).map((g) => `<button type="button" class="gs-item" data-gid="${esc(g.id)}" role="option">
        ${guestFace(g.full_name, 34)}<span class="gs-main"><b>${esc(g.full_name)}</b><span>${esc([g.phone, g.nationality].filter(Boolean).join(' · '))}</span></span>
        <span class="gs-last">${g.last_check_in ? 'Last stay<br>' + esc(new Date(g.last_check_in).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).replace('Sept', 'Sep')) : 'No stays yet'}</span></button>`).join('');
    list.hidden = false;
  }
  async function selectGuest(id) {
    hideList();
    const g = await q(sb.from('guests').select('*').eq('id', id).single());
    const prof = await rpc('guest_profile', { p_guest: id }).catch(() => null);
    state.guest = g;
    f('full_name').value = g.full_name || ''; f('phone').value = g.phone || ''; f('email').value = g.email || '';
    f('dob').value = g.dob || ''; f('nationality').innerHTML = countryOptions(g.nationality || ''); f('nationality').dispatchEvent(new Event('change')); f('id_type').value = g.id_type || '';
    f('id_number').value = g.id_number || '';
    GF.forEach((n) => { f(n).readOnly = true; f(n).classList.add('is-filled'); if (f(n).tagName === 'SELECT') f(n).disabled = true; });
    const stays = prof ? prof.stays.filter((x) => ['checked_in', 'checked_out'].includes(x.status)).length : 0;
    let pct = 0;
    if (offers?.enabled) (offers.tiers || []).forEach((t) => { if (t.from_stay <= stays + 1 && t.pct > pct) pct = Math.min(t.pct, 50); });
    const hasId = g.id_doc_path || g.id_doc_back_path;
    $('#id-help').textContent = hasId ? 'ID photo already on file — upload only if you want to replace it.' : 'No ID photo on file yet — add one now and it is saved to their profile.';
    const box = $('#returning'); box.hidden = false;
    box.innerHTML = `<div class="gs-picked">${guestFace(g.full_name, 40)}
      <div style="flex:1;min-width:0"><div style="font-weight:800">Existing guest · ${esc(g.full_name)}</div>
        <div class="ns-muted" style="font-size:12.5px">${stays ? `${stays} previous stay${stays > 1 ? 's' : ''}` : 'No completed stays yet'} · details filled from their profile${pct ? ` · <b style="color:#157A56">🎁 ${pct}% regular-guest offer applies</b>` : ''}</div></div>
      <a class="ns-btn-ghost" style="height:32px;font-size:12px" href="guest-profile.html?id=${esc(g.id)}&edit=1" target="_blank" rel="noopener">Edit profile</a>
      <button type="button" class="ns-btn-ghost" id="gs-clear" style="height:32px;font-size:12px">Not them? Clear</button></div>`;
    $('#gs-clear').onclick = clearGuest;
  }
  function clearGuest() {
    state.guest = null; $('#returning').hidden = true; $('#returning').innerHTML = '';
    GF.forEach((n) => { f(n).readOnly = false; f(n).disabled = false; f(n).classList.remove('is-filled'); if (f(n).tagName !== 'SELECT') f(n).value = ''; });
    f('nationality').innerHTML = countryOptions('India'); f('id_type').value = 'aadhaar';
    $('#id-help').textContent = 'Compressed before upload. Deleted automatically after the retention period in Settings.';
    f('full_name').focus();
  }
  ['full_name', 'phone'].forEach((n) => f(n).addEventListener('input', debounce(() => suggest(f(n)), 300)));
  // foreign guest → Form C reminder
  const natHint = document.createElement('div'); natHint.className = 'ns-help fc-hint'; natHint.hidden = true;
  natHint.innerHTML = '🌍 Foreign guest: report on <b>Form C</b> within 24 hours of arrival — take a passport photo (front &amp; visa page) below, then finish on the <a href="formc.html">Form C</a> page.';
  f('nationality').closest('.ns-field')?.appendChild(natHint);
  const natCheck = () => { natHint.hidden = !f('nationality').value || /^(india|indian)$/i.test(f('nationality').value); };
  f('nationality').addEventListener('change', natCheck); natCheck();
  list.addEventListener('click', (e) => { const b = e.target.closest('[data-gid]'); if (b) selectGuest(b.dataset.gid); });
  document.addEventListener('click', (e) => { if (!e.target.closest('#gs-wrap, [name=full_name], [name=phone]')) hideList(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideList(); });
  if (existing) await selectGuest(existing.id);

  async function submit(status, btn) {
    const err = $('#err'); err.hidden = true;
    const fail = (m) => { err.textContent = m; err.hidden = false; err.scrollIntoView({ block: 'center' }); };
    if (!state.guest && !f('full_name').value.trim()) return fail('Enter the guest’s full name.');
    const rows = rowsData();
    if (!rows[0].unit) return fail(`Choose a ${W.unit}.`);
    if (rows.some((r) => !r.unit)) return fail(`Choose a ${W.unit} in every row, or remove the empty one.`);
    const tooMany = rooms && rows.find((r) => r.adults + r.children > (r.unit.max_guests || 1));
    if (tooMany) return fail(`${tooMany.unit.label} fits up to ${tooMany.unit.max_guests} guests.`);
    const paid = f('paid_now').value ? toPaise(f('paid_now').value) : 0;
    if (Number.isNaN(paid) || paid < 0) return fail('Enter a valid amount paid.');
    const first = lineTotal(rows[0]);
    if (paid > first) return fail(`Paid now can’t be more than the first ${W.unit}’s total (${rupees(first)}). Record the rest on the other bookings.`);
    if (paid > 0 && state.method === 'upi' && !f('reference').value.trim()) return fail('Enter the UPI transaction ID (UTR).');

    btn.disabled = true;
    const made = [];
    try {
      const ids = await uploadIdSides(document.querySelector('.ns-content'), `${ctx.property_id}/staff`);
      let guestId = state.guest?.id || null;
      if (guestId && (ids.id_doc_path || ids.id_doc_back_path)) {                 // new ID photo for an existing guest
        const r = await rpc('update_guest', { p_guest: guestId, p: ids }).catch(() => null);
        const old = [r?.old_id_doc_path, r?.old_id_doc_back_path].filter(Boolean);
        if (old.length) await sb.storage.from('guest-ids').remove(old).catch(() => {});
      }
      for (const [i, r] of rows.entries()) {
        const res = await rpc('create_booking', { p: {
          property_id: ctx.property_id,
          guest_id: guestId,
          guest: guestId ? null : {
            full_name: f('full_name').value.trim(), phone: f('phone').value, email: f('email').value,
            dob: f('dob').value, nationality: f('nationality').value, id_type: f('id_type').value,
            id_number: f('id_number').value, id_doc_path: ids.id_doc_path || null, id_doc_back_path: ids.id_doc_back_path || null,
          },
          bed_id: r.unit.id, visitors: r.adults, children: r.children,
          check_in_at: fromInputDT(f('check_in_at').value),
          check_out_at: fromInputDT(f('check_out_at').value),
          status, source: f('source').value,
          note: f('note').value + (rows.length > 1 ? `${f('note').value ? '\n' : ''}Group booking: ${i + 1} of ${rows.length}` : ''),
          send_confirmation: i === 0 && f('send_confirmation').checked,
          payment: i === 0 && paid > 0 ? { amount_paise: paid, method: state.method, reference: f('reference').value || null } : null,
        } });
        guestId = guestId || res.guest_id; made.push(res);
      }
      toast(made.length > 1 ? `${made.length} ${W.units} booked: ${made.map((x) => x.code).join(', ')}` : `${made[0].code} saved.`);
      location.href = `booking-detail.html?id=${made[0].id}&new=1`;
    } catch (e) {
      fail(made.length ? `${made.map((x) => x.code).join(', ')} saved, but the next ${W.unit} failed: ${e.message}` : e.message); btn.disabled = false;
      if (/already booked/.test(e.message)) loadBeds();
    }
  }
  $('#checkin-now').addEventListener('click', (e) => submit('checked_in', e.currentTarget));
  $('#save-confirmed').addEventListener('click', (e) => submit('confirmed', e.currentTarget));

  await loadBeds();
});

// ------------------------------------------------------------ arrivals list (default view)
async function arrivalsView(ctx) {
  const title = document.querySelector('.ns-main > [style*="height:76px"] [style*="font-size:21px"]'); if (title) title.textContent = 'Check-in';
  document.querySelector('.ns-main > [style*="height:76px"] a[href="bookings.html"]')?.remove();
  const today = ymd();
  let q = '';
  headerActions().innerHTML = '<div class="ns-search"><span>Search</span></div><a class="ns-btn" href="check-in.html?new=1">+ New registration</a>';
  headerSearch('Search guest or booking…', (v) => { q = v.trim().toLowerCase(); render(); });
  let d = null;

  async function load() {
    d = await rpc('calendar_range', { p_property: ctx.property_id, p_from: addDays(today, -2), p_days: 10 });
    render();
  }
  const bedOf = (b) => d.beds.find((x) => x.id === b.bed_id) || { room: '', label: '' };
  const match = (b) => !q || [b.guest, b.code, bedOf(b).label, bedOf(b).room].some((x) => String(x || '').toLowerCase().includes(q));

  function row(b, kind) {
    const bed = bedOf(b); const inDay = ymd(b.check_in_at);
    const late = kind === 'arriving' && inDay < today;
    const due = b.balance_paise > 0 ? `<span class="ns-pill amber">${rupees(b.balance_paise)} due</span>` : '<span class="ns-pill green">Paid</span>';
    return `<div class="ci-row">
      <div class="ci-main">
        <div style="font-weight:800;font-size:14.5px">${esc(b.guest)} ${late ? '<span class="ns-pill red">Late — was due ' + esc(fmtDay(b.check_in_at)) + '</span>' : ''}</div>
        <div class="ns-muted" style="font-size:12.5px">${esc(bed.room)} · ${esc(bed.label)} · ${esc(fmtDayTime(b.check_in_at))} → ${esc(fmtDay(b.check_out_at))}</div>
      </div>
      <div class="ci-tags">${statusPill(b.status)} ${due}</div>
      <div class="ci-acts">
        ${kind === 'arriving' ? `<button type="button" class="ns-btn" data-checkin="${esc(b.id)}" style="height:36px">Check in</button>` : ''}
        ${kind === 'in' ? `<button type="button" class="ns-btn-ghost" data-wa="${esc(b.id)}" style="height:36px;color:#157A56">WhatsApp</button>` : ''}
        <a class="ns-btn-ghost" href="booking-detail.html?id=${esc(b.id)}" style="height:36px">Open</a>
      </div></div>`;
  }
  function section(titleTxt, list, kind, empty) {
    return `<div class="ns-card" style="padding:0;overflow:hidden">
      <div style="padding:16px 20px;display:flex;justify-content:space-between;align-items:center;gap:10px"><div class="ns-h3">${titleTxt} <span class="ns-muted" style="font-weight:600">(${list.length})</span></div></div>
      ${list.length ? list.map((b) => row(b, kind)).join('') : `<div class="ns-empty" style="padding:22px">${empty}</div>`}</div>`;
  }
  function render() {
    if (!d) return;
    const bs = d.bookings.filter(match).sort((a, b) => (a.check_in_at > b.check_in_at ? 1 : -1));
    const now = new Date().toISOString();
    const arriving = bs.filter((b) => ['pending', 'confirmed'].includes(b.status) && ymd(b.check_in_at) <= today && b.check_out_at > now);
    const inToday = bs.filter((b) => b.status === 'checked_in' && ymd(b.check_in_at) === today);
    const staying = d.bookings.filter((b) => b.status === 'checked_in').length;
    const upcoming = bs.filter((b) => ['pending', 'confirmed'].includes(b.status) && ymd(b.check_in_at) > today && ymd(b.check_in_at) <= addDays(today, 7));
    setSubtitle(`${fmtDay(today + 'T12:00:00+05:30')} · ${arriving.length} to arrive · ${staying} staying now`);
    content(`
      <a href="check-in.html?new=1" class="ci-new">
        <span style="font-size:26px;line-height:1">＋</span>
        <span><b style="font-size:16px">New registration</b><br><span style="font-size:13px;opacity:.85">Walk-in or new booking — guest details, ${W.unit}, dates and payment</span></span>
        <span style="margin-left:auto;font-size:20px">→</span></a>
      ${section('Arriving today', arriving, 'arriving', 'No more arrivals today. 🎉')}
      ${section('Checked in today', inToday, 'in', 'Nobody has checked in yet today.')}
      ${section('Next 7 days', upcoming, 'upcoming', 'No arrivals in the next 7 days.')}`,
    'padding:24px 32px;display:flex;flex-direction:column;gap:18px;');
  }

  document.querySelector('.ns-content').addEventListener('click', async (e) => {
    const ci = e.target.closest('[data-checkin]');
    if (ci) {
      const b = d.bookings.find((x) => x.id === ci.dataset.checkin); const bed = bedOf(b);
      const msg = `${b.guest} → ${bed.room} · ${bed.label}.` + (b.balance_paise > 0 ? ` ${rupees(b.balance_paise)} is still due — you can take it now on the booking screen.` : '');
      if (!await confirmDialog(`Check in ${b.guest}?`, msg, { confirmLabel: 'Check in' })) return;
      ci.disabled = true;
      try {
        await rpc('booking_action', { p_booking: b.id, p_action: 'check_in' });
        toast(`${b.guest} checked in.`);
        await load();
        if (b.balance_paise > 0) setTimeout(() => { location.href = `booking-detail.html?id=${b.id}`; }, 700);
      } catch (err) { toast(err.message, { error: true }); ci.disabled = false; }
      return;
    }
    const wa = e.target.closest('[data-wa]');
    if (wa) sendBookingWhatsApp(wa.dataset.wa).catch((err) => toast(err.message, { error: true }));
  });
  await load();
}
