// Public page — guests open it from the link in their confirmation email / WhatsApp.
import { newId, DEMO, sb, esc, fmtDay, fmtDate, field, options, ID_TYPES, compressImage, uploadIdDoc, reveal, param, uuidOk, ymd } from '../core.js';

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
  const stop = (msg) => { body.innerHTML = `<div style="padding:30px 10px;text-align:center;font-size:14px;line-height:1.6">${esc(msg)}</div>`; footer.innerHTML = ''; reveal(); };

  if (!uuidOk(token)) return stop('Please open the check-in link sent to you by the hostel.');
  const { data: b, error } = await sb.rpc('selfcheckin_get', { p_token: token });
  if (error) return stop(error.message);
  const brand = [...header.querySelectorAll('div')].find((d) => !d.children.length && /HOSTEL/.test(d.textContent));
  if (brand) brand.textContent = b.property.toUpperCase();

  if (b.submitted) { step(3, 'All set'); done('You’re checked in online', `We have your details for ${b.code}. Just show a photo ID at the front desk when you arrive.`); return reveal(); }

  step(1, 'Your details');
  body.innerHTML = `
    <div style="background:#FFFFFF;border:1px solid #E7DFC7;border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:4px">
      <div style="display:flex;justify-content:space-between"><b style="font-size:13px">Booking ${esc(b.code)}</b></div>
      <div style="font-size:12px;color:#6B7280">${esc(b.room)} · ${esc(b.bed)}</div>
      <div style="font-size:12px;color:#6B7280">${fmtDay(b.check_in_at)} – ${fmtDate(b.check_out_at)} · ${b.nights} night${b.nights > 1 ? 's' : ''}</div></div>
    ${field('Full name (as on your ID)', `<input class="ns-input" name="full_name" autocomplete="name" value="${esc(b.full_name)}">`)}
    ${field('Date of birth', `<input class="ns-input" name="dob" type="date" max="${ymd()}" autocomplete="bday">`)}
    ${field('Phone', '<input class="ns-input" name="phone" type="tel" autocomplete="tel" placeholder="+91 98400 12233">')}
    ${field('Email', '<input class="ns-input" name="email" type="email" autocomplete="email">')}
    ${field('Nationality', '<input class="ns-input" name="nationality" autocomplete="country-name" placeholder="India">')}
    ${field('Proof of identity', `<select class="ns-input" name="id_type"><option value="">Choose…</option>${options(ID_TYPES, '')}</select>`)}
    ${field('ID number', '<input class="ns-input" name="id_number" autocomplete="off">', 'For Aadhaar we keep only the last 4 digits.')}
    ${field('Photo of your ID', '<input class="ns-input" name="id_file" type="file" accept="image/*,application/pdf" capture="environment" style="padding:10px;height:auto">',
      'Foreign guests: photo page of your passport and visa.')}
    <label style="display:flex;align-items:flex-start;gap:10px;font-size:12.5px;line-height:1.5">
      <input type="checkbox" name="consent" style="width:16px;height:16px;accent-color:#1C9A6C;margin-top:2px">
      My details are accurate. I agree to the house rules, and to the hostel keeping my ID for legal guest-registration needs and deleting it afterwards.</label>
    <div class="ns-error" id="err" role="alert" hidden></div>`;
  footer.innerHTML = '<button type="button" class="ns-btn ns-btn-lg" id="go">Complete check-in</button>';
  reveal();

  const v = (n) => body.querySelector(`[name="${n}"]`);
  document.getElementById('go').onclick = async (e) => {
    const err = document.getElementById('err'); err.hidden = true;
    const fail = (m) => { err.textContent = m; err.hidden = false; e.target.disabled = false; step(1, 'Your details'); };
    if (!v('full_name').value.trim() || !v('dob').value || !v('id_type').value) return fail('Please fill in your name, date of birth and ID type.');
    if (!v('consent').checked) return fail('Please tick the box to confirm.');
    e.target.disabled = true;
    try {
      let path = null;
      const file = v('id_file').files[0];
      if (file) {
        step(2, 'Uploading your ID');
        const small = await compressImage(file);
        path = await uploadIdDoc(`${b.property_id}/${token}/${newId()}.${small.type === 'application/pdf' ? 'pdf' : 'jpg'}`, small);
      }
      const { error: subErr } = await sb.rpc('selfcheckin_submit', { p_token: token, p: {
        full_name: v('full_name').value.trim(), dob: v('dob').value, phone: v('phone').value, email: v('email').value,
        nationality: v('nationality').value, id_type: v('id_type').value, id_number: v('id_number').value,
        id_doc_path: path, consent: true } });
      if (subErr) return fail(subErr.message);
      step(3, 'All set');
      done('You’re checked in online', `Thanks! We’ve saved your details for ${b.code}. See you at ${b.property}.`);
    } catch (ex) { fail(ex.message); }
  };
}
