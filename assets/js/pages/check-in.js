import { newId,
  page, rpc, q, sb, $, esc, rupees, toPaise, ymd, addDays, daysBetween, fromInputDT, field, options,
  ID_TYPES, SOURCES, METHOD_OPTIONS, toast, compressImage, uploadIdDoc, param, uuidOk, debounce, content,
} from '../core.js';

page('checkin', async (ctx) => {
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
          ${field('Full name *', `<input class="ns-input" name="full_name" autocomplete="off" placeholder="e.g. Rahul Kannan" value="${esc(existing?.full_name || '')}" ${existing ? 'disabled' : ''}>`)}
          ${field('Number of visitors', '<input class="ns-input" name="visitors" type="number" min="1" max="20" value="1">')}
          ${field('Phone number', `<input class="ns-input" name="phone" type="tel" autocomplete="off" placeholder="+91 98400 12233" value="${esc(existing?.phone || '')}" ${existing ? 'disabled' : ''}>`)}
          ${field('Email address', `<input class="ns-input" name="email" type="email" autocomplete="off" placeholder="guest@email.com" value="${esc(existing?.email || '')}" ${existing ? 'disabled' : ''}>`)}
          ${existing ? '' : `
          ${field('Date of birth', `<input class="ns-input" name="dob" type="date" max="${today}">`)}
          ${field('Nationality', '<input class="ns-input" name="nationality" list="nat" placeholder="India"><datalist id="nat"><option>India</option><option>Germany</option><option>France</option><option>United Kingdom</option><option>United States</option><option>Spain</option><option>Israel</option><option>Netherlands</option><option>Australia</option></datalist>')}
          ${field('Proof of identity', `<select class="ns-input" name="id_type"><option value="">Select…</option>${options(ID_TYPES, 'aadhaar')}</select>`)}
          ${field('ID document number', '<input class="ns-input" name="id_number" autocomplete="off" placeholder="e.g. XXXX XXXX 4821">', 'Aadhaar: only the last 4 digits are stored.')}
          <div style="grid-column:1/3">${field('ID photo (optional)', '<input class="ns-input" name="id_file" type="file" accept="image/*,application/pdf" capture="environment" style="padding:10px">',
            'Compressed before upload. Deleted automatically after the retention period in Settings.')}</div>`}
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
          ${field('Bed *', '<select class="ns-input" name="bed_id"><option value="">Loading free beds…</option></select>')}
          ${field('Booked via', `<select class="ns-input" name="source">${options(SOURCES, 'walk_in')}</select>`)}
        </div>
        ${field('Note (optional)', '<textarea class="ns-input" name="note" maxlength="2000" placeholder="Late arrival, special request, etc."></textarea>')}
      </div>
    </div>

    <div style="display:flex;flex-direction:column;gap:14px;min-width:0">
      <div class="ns-card-dark" style="padding:24px;display:flex;flex-direction:column;gap:16px">
        <div class="ns-h3" style="color:#FBF3DE">Booking summary</div>
        ${L('<span id="s-bed">No bed selected</span><span id="s-rate"></span>')}
        ${L('<span>Nights</span><span id="s-nights">1</span>')}
        <div style="height:1px;background:#22305A"></div>
        <div style="display:flex;justify-content:space-between;font-size:17px;font-weight:700;color:#FBF3DE"><span>Total</span><span id="s-total">₹0</span></div>
        <div style="height:1px;background:#22305A"></div>
        <div class="ns-field"><label style="color:#AEB6C9">Paid now (₹)</label>
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
  const nights = () => {
    const a = f('check_in_at').value.slice(0, 10); const b = f('check_out_at').value.slice(0, 10);
    return a && b ? Math.max(1, daysBetween(a, b)) : 1;
  };

  function summary() {
    const bed = state.beds.find((x) => x.id === f('bed_id').value);
    state.bed = bed || null;
    $('#s-bed').textContent = bed ? `${bed.room_name} · ${bed.label}` : 'No bed selected';
    $('#s-rate').textContent = bed ? `${rupees(bed.rate_paise)} / night` : '';
    $('#s-nights').textContent = nights();
    $('#s-total').textContent = rupees(bed ? bed.rate_paise * nights() : 0);
    const startsToday = f('check_in_at').value.slice(0, 10) === today;
    $('#checkin-now').hidden = !startsToday;
  }

  async function loadBeds() {
    const inAt = fromInputDT(f('check_in_at').value); const outAt = fromInputDT(f('check_out_at').value);
    const sel = f('bed_id');
    if (!inAt || !outAt || new Date(outAt) <= new Date(inAt)) {
      sel.innerHTML = '<option value="">Check-out must be after check-in</option>'; summary(); return;
    }
    const keep = sel.value || preBed;
    state.beds = await rpc('available_beds', { p_property: ctx.property_id, p_in: inAt, p_out: outAt });
    sel.innerHTML = state.beds.length
      ? '<option value="">Choose a bed…</option>' + state.beds.map((x) =>
        `<option value="${esc(x.id)}" ${x.id === keep ? 'selected' : ''}>${esc(x.room_name)} · ${esc(x.label)} — ${rupees(x.rate_paise)}/night</option>`).join('')
      : '<option value="">No beds free for these dates</option>';
    summary();
  }
  ['check_in_at', 'check_out_at'].forEach((n) => f(n).addEventListener('change', loadBeds));
  f('bed_id').addEventListener('change', summary);

  $('#method').addEventListener('click', (e) => {
    const b = e.target.closest('[data-m]'); if (!b) return;
    state.method = b.dataset.m;
    $('#method').querySelectorAll('button').forEach((x) => x.classList.toggle('is-on', x === b));
    $('#ref-wrap').hidden = state.method !== 'upi';
  });

  // Returning guest? Look them up by phone.
  if (!existing) {
    f('phone').addEventListener('input', debounce(async () => {
      const v = f('phone').value.replace(/\D/g, '');
      const box = $('#returning');
      if (v.length < 8) { box.hidden = true; return; }
      const found = await rpc('search_guests', { p_property: ctx.property_id, p_q: v }).catch(() => []);
      if (!found.length) { box.hidden = true; return; }
      const gst = found[0];
      box.hidden = false;
      box.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 14px;border-radius:10px;background:#E9F5EE;font-size:13px">
          <span>Returning guest: <b>${esc(gst.full_name)}</b>${gst.last_check_in ? ' · last stay ' + new Date(gst.last_check_in).toLocaleDateString('en-IN') : ''}</span>
          <a class="ns-btn-ghost" style="height:32px" href="check-in.html?guest=${esc(gst.id)}">Use this guest</a></div>`;
    }, 400));
  }

  async function submit(status, btn) {
    const err = $('#err'); err.hidden = true;
    const fail = (m) => { err.textContent = m; err.hidden = false; err.scrollIntoView({ block: 'center' }); };
    if (!existing && !f('full_name').value.trim()) return fail('Enter the guest’s full name.');
    if (!f('bed_id').value) return fail('Choose a bed.');
    const paid = f('paid_now').value ? toPaise(f('paid_now').value) : 0;
    if (Number.isNaN(paid) || paid < 0) return fail('Enter a valid amount paid.');
    const total = state.bed.rate_paise * nights();
    if (paid > total) return fail(`Paid now can’t be more than the total (${rupees(total)}).`);
    if (paid > 0 && state.method === 'upi' && !f('reference').value.trim()) return fail('Enter the UPI transaction ID (UTR).');

    btn.disabled = true;
    try {
      let idPath = null;
      const file = f('id_file')?.files?.[0];
      if (file) {
        const small = await compressImage(file);
        idPath = await uploadIdDoc(`${ctx.property_id}/staff/${newId()}.${small.type === 'application/pdf' ? 'pdf' : 'jpg'}`, small);
      }
      const res = await rpc('create_booking', { p: {
        property_id: ctx.property_id,
        guest_id: existing?.id || null,
        guest: existing ? null : {
          full_name: f('full_name').value.trim(), phone: f('phone').value, email: f('email').value,
          dob: f('dob').value, nationality: f('nationality').value, id_type: f('id_type').value,
          id_number: f('id_number').value, id_doc_path: idPath,
        },
        bed_id: f('bed_id').value,
        visitors: f('visitors').value || 1,
        check_in_at: fromInputDT(f('check_in_at').value),
        check_out_at: fromInputDT(f('check_out_at').value),
        status, source: f('source').value, note: f('note').value,
        send_confirmation: f('send_confirmation').checked,
        payment: paid > 0 ? { amount_paise: paid, method: state.method, reference: f('reference').value || null } : null,
      } });
      toast(`${res.code} saved.`);
      location.href = `booking-detail.html?id=${res.id}&new=1`;
    } catch (e) {
      fail(e.message); btn.disabled = false;
      if (/already booked/.test(e.message)) loadBeds();
    }
  }
  $('#checkin-now').addEventListener('click', (e) => submit('checked_in', e.currentTarget));
  $('#save-confirmed').addEventListener('click', (e) => submit('confirmed', e.currentTarget));

  await loadBeds();
});
