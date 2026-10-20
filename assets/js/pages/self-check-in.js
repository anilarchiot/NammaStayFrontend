// Public page — guests open it from the link in their confirmation email / WhatsApp.
import { unitName, MARKETING_URL, langPicker, countryOptions, idUploadFields, wireIdPreviews, uploadIdSides, newId, DEMO, NOT_CONNECTED, sb, esc, fmtDay, fmtDate, field, options, ID_TYPES, compressImage, uploadIdDoc, reveal, param, uuidOk, ymd } from '../core.js';

init();

async function init() {
  const phone = document.querySelector('.ns-phone');
  const [header, body, footer] = phone.children;
  const stepText = header.lastElementChild;
  const bars = header.children[header.children.length - 2]?.children || [];
  const step = (n, label) => {
    stepText.textContent = `Step ${n} of 3 — ${label}`;
    [...bars].forEach((b, i) => { b.style.background = i < n ? '#1C9A6C' : '#2A3963'; });
  };
  let token = param('t');
  if (!token && DEMO) {               // demo: open the next upcoming booking's link
    token = (await sb.rpc('demo_checkin_token')).data;
    if (token) history.replaceState(null, '', '?t=' + token);
  }

  const done = (title, text) => {
    body.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;text-align:center;gap:12px;padding:30px 10px">
      <div style="width:56px;height:56px;border-radius:50%;background:#E9F5EE;display:flex;align-items:center;justify-content:center;font-size:28px;color:#1C9A6C">✓</div>
      <div style="font-family:'Sora',sans-serif;font-size:19px;font-weight:700">${esc(title)}</div>
      <div style="font-size:13.5px;color:#6B7280;line-height:1.6">${esc(text)}</div></div>`;
    footer.innerHTML = '';
  };
  // Homestay house guide (033): shown under the "done" message when the host has written one; ignored if not installed
  const guideRow = (icon, label, v) => (v ? `<div style="display:flex;gap:10px;padding:9px 0;border-top:1px solid #F0EBDB"><span aria-hidden="true">${icon}</span><div style="min-width:0"><div style="font-size:11px;font-weight:800;color:#6B7280;text-transform:uppercase;letter-spacing:.04em">${label}</div><div style="font-size:13.5px;line-height:1.5;white-space:pre-line;overflow-wrap:anywhere">${v}</div></div></div>` : '');
  const showGuide = async () => {
    const g = await sb.rpc('guide_for_token', { p_token: token }).then((r) => r.data || {}, () => ({}));
    if (!g || !Object.keys(g).some((k) => k !== 'property' && g[k])) return;
    body.insertAdjacentHTML('beforeend', `<div style="background:#FFFFFF;border:1px solid #E7DFC7;border-radius:14px;padding:14px;text-align:left">
      <div style="font-family:'Sora',sans-serif;font-size:15px;font-weight:700;margin-bottom:4px">🏡 Your house guide</div>
      ${g.welcome ? `<div style="font-size:13.5px;line-height:1.5;margin-bottom:6px">${esc(g.welcome)}</div>` : ''}
      ${guideRow('🔑', 'Check-in', esc(g.checkin_info || ''))}${guideRow('🧳', 'Check-out', esc(g.checkout_info || ''))}
      ${guideRow('📶', 'Wi-Fi', g.wifi_name ? `${esc(g.wifi_name)}${g.wifi_password ? ` · password <b>${esc(g.wifi_password)}</b>` : ' · password shared on the day you arrive'}` : '')}
      ${guideRow('🍳', 'Food', esc(g.food_info || ''))}${guideRow('📋', 'House rules', esc(g.house_rules || ''))}
      ${guideRow('📍', 'How to reach', `${esc(g.directions || '')}${g.maps_url ? `${g.directions ? '<br>' : ''}<a href="${esc(g.maps_url)}" target="_blank" rel="noopener" style="font-weight:700">Open in Google Maps</a>` : ''}`)}
      ${guideRow('📞', 'Your host', g.host_name || g.host_phone ? `${esc(g.host_name || '')}${g.host_phone ? ` <a href="tel:${esc(g.host_phone)}" style="font-weight:700">${esc(g.host_phone)}</a>` : ''}` : '')}
    </div>`);
  };
  const stop = (msg) => { body.innerHTML = `<div style="padding:30px 10px;text-align:center;font-size:14px;line-height:1.6">${esc(msg)}</div>`; footer.innerHTML = ''; reveal(); };
  if (NOT_CONNECTED) return stop('Online check-in is unavailable right now. Please check in at the front desk.');

  if (!uuidOk(token)) return stop('Please open the check-in link sent to you by the hostel.');
  const top = document.querySelector('.ns-phone > div'); if (top && !top.querySelector('.ns-lang')) {
    const w = top.firstElementChild; const sel = langPicker('margin-left:auto;height:30px;border-radius:8px;border:1px solid #2A3963;background:#15244A;color:#FBF3DE;font:600 12px Manrope,sans-serif;padding:0 6px');
    if (w) w.appendChild(sel);
  }
  const { data: b, error } = await sb.rpc('selfcheckin_get', { p_token: token });
  if (error) return stop(error.message);
  const brand = [...header.querySelectorAll('div')].find((d) => !d.children.length && /HOSTEL/.test(d.textContent));
  if (brand) brand.textContent = b.property.toUpperCase();

  // PG / co-living tenant? Then it's a tenant registration, not a nightly booking (032; ignored if not installed)
  const pgi = await sb.rpc('pg_selfcheckin_info', { p_token: token }).then((r) => r.data || {}, () => ({}));
  if (pgi.tenant) {
    const t = document.querySelector('.ns-phone [style*="font-size:20px"]'); if (t) t.textContent = 'Tenant registration';
    document.title = 'Tenant registration · NammaStay';
  }
  if (b.submitted && pgi.tenant) { step(3, 'All set'); done('You’re registered', `${b.property} already has your details. Thank you!`); return reveal(); }
  if (b.submitted) { step(3, 'All set'); done('You’re checked in online', `We have your details for ${b.code}. Just show a photo ID at the front desk when you arrive.`); await showGuide(); return reveal(); }

  step(1, 'Your details');
  body.innerHTML = `
    <div style="background:#FFFFFF;border:1px solid #E7DFC7;border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:4px">
      <div style="display:flex;justify-content:space-between"><b style="font-size:13px">${pgi.tenant ? `Tenant at ${esc(b.property)}` : `Booking ${esc(b.code)}`}</b></div>
      <div style="font-size:12px;color:#6B7280">${esc(unitName(b.room, b.bed))}</div>
      <div style="font-size:12px;color:#6B7280">${pgi.tenant ? `${pgi.moved_in ? 'Living here since' : 'Moving in'} ${fmtDate(pgi.start_date + 'T12:00:00+05:30')}`
        : `${fmtDay(b.check_in_at)} – ${fmtDate(b.check_out_at)} · ${b.nights} night${b.nights > 1 ? 's' : ''}`}</div></div>
    ${field('Full name (as on your ID)', `<input class="ns-input" name="full_name" autocomplete="name" value="${esc(b.full_name)}">`)}
    ${field('Date of birth', `<input class="ns-input" name="dob" type="date" max="${ymd()}" autocomplete="bday">`)}
    ${field('Phone', '<input class="ns-input" name="phone" type="tel" autocomplete="tel" placeholder="+91 98400 12233">')}
    ${field('Email', '<input class="ns-input" name="email" type="email" autocomplete="email">')}
    ${field('Nationality', `<select class="ns-input" name="nationality" autocomplete="country-name">${countryOptions('', { placeholder: 'Choose your country…' })}</select>`)}
    ${field('Proof of identity', `<select class="ns-input" name="id_type"><option value="">Choose…</option>${options(ID_TYPES, '')}</select>`)}
    ${field('ID number', '<input class="ns-input" name="id_number" autocomplete="off">', 'For Aadhaar we keep only the last 4 digits.')}
    ${idUploadFields({ front: 'Photo of your ID — front', back: 'Back side (Aadhaar / licence)' })}
    <div class="ns-help" style="margin-top:-6px">Passport: the photo page is enough. Foreign guests: add your visa page as the second photo.</div>
    <label style="display:flex;align-items:flex-start;gap:10px;font-size:12.5px;line-height:1.5">
      <input type="checkbox" name="consent" style="width:16px;height:16px;accent-color:#1C9A6C;margin-top:2px">
      My details are accurate. I agree to the house rules, and to ${esc(b.property)} keeping my ID for legal guest-registration needs and deleting it afterwards. <a href="${MARKETING_URL}/privacy.html" target="_blank" rel="noopener" style="font-weight:700">How data is handled</a></label>
    <div class="ns-error" id="err" role="alert" hidden></div>`;
  footer.innerHTML = '<button type="button" class="ns-btn ns-btn-lg" id="go">Complete check-in</button>';
  reveal();

  const v = (n) => body.querySelector(`[name="${n}"]`);
  wireIdPreviews(body);
  document.getElementById('go').onclick = async (e) => {
    const err = document.getElementById('err'); err.hidden = true;
    const fail = (m) => { err.textContent = m; err.hidden = false; e.target.disabled = false; step(1, 'Your details'); };
    if (!v('full_name').value.trim() || !v('dob').value || !v('id_type').value) return fail('Please fill in your name, date of birth and ID type.');
    if (!v('consent').checked) return fail('Please tick the box to confirm.');
    e.target.disabled = true;
    try {
      if (v('id_file').files[0] || v('id_file_back').files[0]) step(2, 'Uploading your ID');
      const ids = await uploadIdSides(body, `${b.property_id}/${token}`);
      const { error: subErr } = await sb.rpc('selfcheckin_submit', { p_token: token, p: {
        full_name: v('full_name').value.trim(), dob: v('dob').value, phone: v('phone').value, email: v('email').value,
        nationality: v('nationality').value, id_type: v('id_type').value, id_number: v('id_number').value,
        id_doc_path: ids.id_doc_path || null, id_doc_back_path: ids.id_doc_back_path || null, consent: true } });
      if (subErr) return fail(subErr.message);
      step(3, 'All set');
      if (pgi.tenant) done('You’re registered', `Thanks! ${b.property} has your details and ID now.`);
      else { done('You’re checked in online', `Thanks! We’ve saved your details for ${b.code}. See you at ${b.property}.`); showGuide(); }
    } catch (ex) { fail(ex.message); }
  };
}
