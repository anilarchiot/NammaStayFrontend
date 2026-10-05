// NammaStay admin sign-in (admin.thenammastay.com).
// Password → 6-digit code from an authenticator app (first time: scan a QR code to set it up).
// Only platform admins get in; everyone else is signed out again.
import { sb, rpc, reveal, esc, param, DEMO, NOT_CONNECTED, markBrowserSession, SITE_URL, $ } from '../core.js';

const main = document.querySelector('.ns-login-main > div');
const email = $('#email'); const pw = $('#pw'); const btn = main.querySelector('a[href="admin.html"]');
const formBits = [...main.children].slice(1);                     // everything below the logo: heading, form, footer
const next = (() => { const n = param('next') || ''; return /^(admin|subscribers|leads)\.html(\?[^#]*)?$/.test(n) ? n : 'admin.html'; })();
const err = document.createElement('div'); err.className = 'ns-error'; err.hidden = true; btn.insertAdjacentElement('beforebegin', err);
const fail = (m) => { err.textContent = m; err.hidden = false; btn.style.opacity = ''; btn.style.pointerEvents = ''; };
const go = () => { markBrowserSession(); location.replace(next); };
// "Hostel staff? Go to the normal sign-in" → the hostel app's sign-in (another website)
try { const a = main.querySelector('a[href="login.html"]'); if (a && self.origin !== 'null' && new URL(SITE_URL).origin !== self.origin) a.href = `${SITE_URL}/login.html`; } catch { /* keep relative */ }

// ---------- step screens (replace the form) ----------
function step(html) {
  formBits.forEach((el) => { el.hidden = true; });
  main.querySelector('.adm-step')?.remove();
  main.insertAdjacentHTML('beforeend', `<div class="adm-step">${html}</div>`);
  reveal();
  return main.querySelector('.adm-step');
}
const codeInput = '<input class="ns-input adm-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="123456" aria-label="6-digit code">';
const signOutLink = '<button type="button" class="adm-link" data-out>Use another account</button>';
function wireOut(el) { el.querySelector('[data-out]')?.addEventListener('click', async () => { await sb.auth.signOut(); location.replace('admin-login.html'); }); }

async function askCode() {
  const { data } = await sb.auth.mfa.listFactors();
  const f = (data?.totp || []).find((x) => x.status === 'verified');
  if (!f) return setUp();
  const el = step(`<div class="adm-title">Enter your 6-digit code</div>
    <div class="adm-sub">Open your authenticator app (Google Authenticator, Microsoft Authenticator, Authy…) and type the code for <b>NammaStay admin</b>.</div>
    ${codeInput}<div class="ns-error" hidden></div><button type="button" class="ns-btn ns-btn-lg" data-ok>Verify</button>${signOutLink}
    <div class="adm-sub" style="font-size:12px">Lost your phone? Another admin can reset your 2-step login (see the guide).</div>`);
  wireOut(el); const inp = el.querySelector('.adm-code'); inp.focus();
  const verify = async () => {
    const e = el.querySelector('.ns-error'); e.hidden = true;
    if (!/^\d{6}$/.test(inp.value.trim())) { e.textContent = 'Enter the 6 digits.'; e.hidden = false; return; }
    const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: f.id, code: inp.value.trim() });
    if (error) { e.textContent = /invalid|expired/i.test(error.message) ? 'That code didn’t work — wait for a new one and try again.' : error.message; e.hidden = false; inp.select(); return; }
    go();
  };
  el.querySelector('[data-ok]').onclick = verify;
  inp.addEventListener('input', () => { if (/^\d{6}$/.test(inp.value.trim())) verify(); });
}

async function setUp() {
  // remove half-finished setups first, then start a new one
  const { data: list } = await sb.auth.mfa.listFactors();
  for (const f of (list?.all || []).filter((x) => x.status !== 'verified')) await sb.auth.mfa.unenroll({ factorId: f.id }).catch(() => {});
  const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'NammaStay admin' });
  if (error) {
    step(`<div class="adm-title">2-step login isn’t available</div><div class="adm-sub">${esc(error.message)}<br>Turn on <b>MFA → TOTP</b> in Supabase (Authentication → Multi-factor), then try again.</div>${signOutLink}`);
    wireOut(main.querySelector('.adm-step')); return;
  }
  const el = step(`<div class="adm-title">Set up 2-step login</div>
    <div class="adm-sub">Admin accounts see every property and payment, so they need a second step. One time only:</div>
    <ol class="adm-steps"><li>Install <b>Google Authenticator</b> or <b>Microsoft Authenticator</b> on your phone.</li>
      <li>Tap <b>+</b> → <b>Scan a QR code</b> and scan this:</li></ol>
    <img class="adm-qr" alt="QR code for your authenticator app" src="${esc(data.totp.qr_code)}">
    <details class="adm-secret"><summary>Can’t scan? Type this key instead</summary><code>${esc(data.totp.secret)}</code></details>
    <ol class="adm-steps" start="3"><li>Type the 6-digit code the app shows:</li></ol>
    ${codeInput}<div class="ns-error" hidden></div><button type="button" class="ns-btn ns-btn-lg" data-ok>Finish setup</button>${signOutLink}`);
  wireOut(el); const inp = el.querySelector('.adm-code');
  const finish = async () => {
    const e = el.querySelector('.ns-error'); e.hidden = true;
    if (!/^\d{6}$/.test(inp.value.trim())) { e.textContent = 'Enter the 6 digits from the app.'; e.hidden = false; return; }
    const { error: err2 } = await sb.auth.mfa.challengeAndVerify({ factorId: data.id, code: inp.value.trim() });
    if (err2) { e.textContent = 'That code didn’t work — check the phone’s time is automatic, wait for a new code and try again.'; e.hidden = false; inp.select(); return; }
    go();
  };
  el.querySelector('[data-ok]').onclick = finish;
  inp.addEventListener('input', () => { if (/^\d{6}$/.test(inp.value.trim())) finish(); });
}

// after the password (or an existing session): decide the next step
async function afterPassword() {
  if (DEMO) return go();
  const info = await rpc('admin_mfa_info').catch(() => null);
  if (!info?.admin) { await sb.auth.signOut(); return fail('This account doesn’t have NammaStay admin access.'); }
  if (info.aal === 'aal2') return go();
  return info.has_factor ? askCode() : setUp();
}

async function init() {
  if (NOT_CONNECTED) { main.innerHTML = '<div class="ns-card">NammaStay isn’t connected yet.</div>'; reveal(); return; }
  if (DEMO) { email.value = 'admin@thenammastay.com'; pw.value = 'demo-password'; }
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    if (DEMO) {
      main.insertAdjacentHTML('afterbegin', `<div class="ns-card" style="display:flex;flex-direction:column;gap:10px;text-align:center">
        <div>Demo — signed in as <b>${esc(session.user.email || 'admin')}</b></div><a class="ns-btn" href="${esc(next)}">Continue to admin</a></div>`);
    } else {
      const info = await rpc('admin_mfa_info').catch(() => null);
      if (info?.admin) { await afterPassword(); return; }
    }
  }
  reveal();
}
async function signIn(e) {
  e.preventDefault(); err.hidden = true;
  if (!email.value.trim() || !pw.value) return fail('Enter your email and password.');
  btn.style.opacity = '.6'; btn.style.pointerEvents = 'none';
  const { error } = await sb.auth.signInWithPassword({ email: email.value.trim(), password: pw.value });
  if (error) return fail(/Invalid login/i.test(error.message) ? 'That email and password don’t match.' : error.message);
  const keep = main.querySelector('input[type=checkbox]')?.checked;
  try { if (keep) localStorage.removeItem('ns.temp.session'); else localStorage.setItem('ns.temp.session', '1'); } catch { /* ignore */ }
  await afterPassword();
}
btn.addEventListener('click', signIn);
pw.addEventListener('keydown', (e) => { if (e.key === 'Enter') signIn(e); });
init();
