// Self sign-up: 1) create account → 2) create property → 15-day free trial starts.
import { DEMO, sb, $, esc, rpc, reveal, param, SITE_URL } from '../core.js';

const box = $('.ns-login-main > div');
const brand = box.querySelector('.ns-login-brand').outerHTML;
const input = (id, label, attrs = '') => `<div class="ns-field"><label for="${id}">${label}</label><input class="ns-input" id="${id}" ${attrs}></div>`;
const render = (title, sub, body) => {
  box.innerHTML = `${brand}<div><div style="font-family:'Sora',sans-serif;font-size:28px;font-weight:700">${title}</div>
    <div style="font-size:15px;color:#6B7280;margin-top:6px">${sub}</div></div>${body}`;
  reveal();
};
const errBox = '<div class="ns-error" id="err" role="alert" hidden></div>';
const fail = (m) => { const e = $('#err'); e.textContent = m; e.hidden = false; const b = $('#go'); if (b) b.disabled = false; };

init();

async function init() {
  if (DEMO) {
    render('Start your free trial', 'Sign-up opens once NammaStay is connected to its database.',
      `<div class="ns-demo-hint">This site is in demo mode. You can explore everything with sample data.</div>
       <a class="ns-btn ns-btn-lg" href="login.html">Open the demo</a>`);
    return;
  }
  const { data: { session } } = await sb.auth.getSession();
  if (session || param('step') === 'property') {
    if (!session) { location.replace('login.html?next=' + encodeURIComponent('signup.html?step=property')); return; }
    const mems = await rpc('my_memberships').catch(() => []);
    if (mems.length) { location.replace('dashboard.html'); return; }
    return propertyStep(session);
  }
  accountStep();
}

function accountStep() {
  render('Start your 15-day free trial', 'No card needed. Takes about 2 minutes.', `
    <div style="display:flex;flex-direction:column;gap:16px">
      ${input('name', 'Your name', 'autocomplete="name" maxlength="80"')}
      ${input('email', 'Email', 'type="email" autocomplete="email"')}
      ${input('pw', 'Password', 'type="password" autocomplete="new-password" minlength="10"')}
      <div class="ns-help" style="margin-top:-8px">At least 10 characters.</div>
      <label style="display:flex;gap:8px;align-items:flex-start;font-size:13px;color:#6B7280">
        <input type="checkbox" id="agree" style="width:16px;height:16px;accent-color:#1C9A6C;margin-top:2px">
        I agree to use NammaStay for my own property and to handle guest data responsibly.</label>
      ${errBox}
      <button type="button" class="ns-btn ns-btn-lg" id="go">Create account</button>
      <div style="font-size:14px;color:#6B7280;text-align:center">Already have an account? <a href="login.html" style="font-weight:700">Sign in</a></div>
    </div>`);
  $('#go').onclick = async (e) => {
    const name = $('#name').value.trim(); const email = $('#email').value.trim(); const pw = $('#pw').value;
    if (name.length < 2) return fail('Please enter your name.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail('Please enter a valid email.');
    if (pw.length < 10) return fail('Password must be at least 10 characters.');
    if (!$('#agree').checked) return fail('Please tick the box to continue.');
    e.target.disabled = true;
    const { data, error } = await sb.auth.signUp({ email, password: pw,
      options: { data: { name }, emailRedirectTo: SITE_URL + '/signup.html?step=property' } });
    if (error) return fail(/registered|exists/i.test(error.message) ? 'An account with this email already exists. Please sign in.' : error.message);
    if (data.session) return propertyStep(data.session);
    render('Check your email', `We sent a confirmation link to <b>${esc(email)}</b>.`,
      `<div style="font-size:15px;line-height:1.7;color:#6B7280">Open it on this device to finish setting up your property. It can take a minute to arrive — check spam too.</div>
       <a class="ns-btn-ghost ns-btn-lg" href="login.html" style="height:48px">Back to sign in</a>`);
  };
}

function propertyStep(session) {
  const name = session.user.user_metadata?.name || '';
  render('Set up your property', 'Your 15-day free trial starts now.', `
    <div style="display:flex;flex-direction:column;gap:16px">
      ${input('pname', 'Property name', 'maxlength="120" placeholder="e.g. Blue Door Hostel"')}
      <div class="ns-field"><label for="kind">Type</label><select class="ns-input" id="kind">
        <option value="hostel">Hostel</option><option value="homestay">Homestay</option><option value="hotel">Hotel / guest house</option></select></div>
      ${input('city', 'City', 'autocomplete="address-level2" maxlength="80"')}
      ${input('phone', 'Phone (optional)', 'type="tel" autocomplete="tel" maxlength="20"')}
      ${input('oname', 'Your name', `value="${esc(name)}" maxlength="80"`)}
      ${errBox}
      <button type="button" class="ns-btn ns-btn-lg" id="go">Start free trial</button>
      <button type="button" class="ns-btn-ghost" id="out" style="align-self:center">Use a different account</button>
    </div>`);
  $('#out').onclick = async () => { await sb.auth.signOut(); location.replace('signup.html'); };
  $('#go').onclick = async (e) => {
    if ($('#pname').value.trim().length < 2) return fail('Please enter your property name.');
    e.target.disabled = true;
    try {
      const r = await rpc('create_my_property', { p: { name: $('#pname').value, kind: $('#kind').value, city: $('#city').value,
        phone: $('#phone').value, owner_name: $('#oname').value } });
      localStorage.setItem('ns.property', r.property_id);
      location.replace('rooms.html?welcome=1');
    } catch (err) { fail(err.message); }
  };
}
