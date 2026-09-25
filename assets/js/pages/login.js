import { DEMO, sb, $, modal, toast, reveal, SITE_URL, param } from '../core.js';

init();

async function init() {
  const email = $('#email');
  const pw = $('#pw');
  const btn = $('a[href="dashboard.html"]');
  const forgot = [...document.querySelectorAll('a')].find((a) => a.textContent.trim() === 'Forgot?');
  const setup = [...document.querySelectorAll('a')].find((a) => a.textContent.trim() === 'Get set up');

  $('label[for="email"]').textContent = 'Email';
  email.type = 'email'; email.autocomplete = 'username'; email.placeholder = 'you@example.com';
  pw.autocomplete = 'current-password';
  if (setup) setup.parentElement.textContent = 'Need access? Ask your property owner to invite you.';
  if (DEMO) {
    const hint = document.createElement('div');
    hint.className = 'ns-demo-hint';
    hint.innerHTML = '<b>Demo mode:</b> sign in with any email and password to explore with sample data.';
    email.closest('div').parentElement.insertAdjacentElement('beforebegin', hint);
    email.value = email.value || 'owner@demo.nammastay';
    pw.value = pw.value || 'demo-password';
  }

  // Error line under the button
  const err = document.createElement('div');
  err.className = 'ns-error'; err.setAttribute('role', 'alert'); err.hidden = true;
  btn.insertAdjacentElement('afterend', err);
  const fail = (m) => { err.textContent = m; err.hidden = false; };

  const hash = window.NS_INITIAL_HASH || '';
  const next = safeNext(param('next'));

  // Invite / password-reset links land here: ask for a new password
  sb.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') setPassword('Set a new password', next);
  });
  const { data: { session } } = await sb.auth.getSession();
  if (session && /type=invite/.test(hash)) setPassword('Welcome! Choose your password', next);
  else if (session && !/type=recovery/.test(hash)) location.replace(next);
  reveal();

  async function signIn(e) {
    e.preventDefault();
    err.hidden = true;
    if (!email.value.trim() || !pw.value) return fail('Enter your email and password.');
    btn.style.opacity = '.6'; btn.style.pointerEvents = 'none';
    const { error } = await sb.auth.signInWithPassword({ email: email.value.trim(), password: pw.value });
    btn.style.opacity = ''; btn.style.pointerEvents = '';
    if (error) {
      return fail(/Invalid login/i.test(error.message) ? 'That email and password don’t match.'
        : /rate|too many/i.test(error.message) ? 'Too many attempts. Wait a minute and try again.' : error.message);
    }
    location.replace(next);
  }
  btn.addEventListener('click', signIn);
  [email, pw].forEach((i) => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') signIn(e); }));

  forgot?.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!email.value.trim()) return fail('Type your email above first, then tap Forgot?');
    const { error } = await sb.auth.resetPasswordForEmail(email.value.trim(), { redirectTo: SITE_URL + '/login.html' });
    if (error) return fail(error.message);
    toast('If that email has an account, a reset link is on its way.');
  });
}

function setPassword(title, next) {
  modal({
    title,
    body: `<div class="ns-field"><label for="np1">New password</label>
             <input id="np1" class="ns-input" type="password" autocomplete="new-password" minlength="10"></div>
           <div class="ns-field"><label for="np2">Type it again</label>
             <input id="np2" class="ns-input" type="password" autocomplete="new-password"></div>
           <div class="ns-help">At least 10 characters. Use a phrase you don’t use anywhere else.</div>`,
    actions: [{
      label: 'Save password', kind: 'primary', onClick: async (el) => {
        const a = el.querySelector('#np1').value; const b = el.querySelector('#np2').value;
        if (a.length < 10) throw new Error('Use at least 10 characters.');
        if (a !== b) throw new Error('The two passwords don’t match.');
        const { error } = await sb.auth.updateUser({ password: a });
        if (error) throw new Error(error.message);
        toast('Password saved.');
        location.replace(next);
      },
    }],
  });
}

function safeNext(v) {
  return v && /^[a-z-]+\.html(\?[\w=&%.-]*)?$/i.test(v) && !v.startsWith('index') && !v.startsWith('login') ? v : 'dashboard.html';
}
