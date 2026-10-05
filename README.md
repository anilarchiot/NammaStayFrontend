# NammaStay Admin — admin.thenammastay.com

The NammaStay team's admin website: **Overview · Subscribers · Leads**, with **2-step login**
(password + 6-digit code from an authenticator app). It uses the **same Supabase project** as the
hostel app, but it is a **separate website**: hostel users never download it, and the admin sign-in
is kept apart from any hostel sign-in on the same browser.

## Set up (once)

1. **Database:** in Supabase → SQL Editor run `022_admin_2fa.sql` (backend repo).
2. **Supabase 2-step login:** Authentication → **Multi-factor (MFA)** → make sure **TOTP** is enabled.
3. **Supabase URLs:** Authentication → URL Configuration → **Redirect URLs** → add `https://admin.thenammastay.com/**`.
4. **GitHub:** create a new repository, e.g. **NammaStayAdmin** → upload everything in this folder
   (keep the `CNAME` file) → Settings → **Pages** → Deploy from branch **main / (root)** → Save.
5. **Keys:** edit `assets/js/config.js` in that repo → paste the **same** Project URL and anon key as the
   hostel app. Keep `siteUrl: 'https://thenammastay.com'`.
6. **GoDaddy DNS:** add a **CNAME** record → Name `admin` → Value `anilarchiot.github.io` → Save.
7. **HTTPS:** back in GitHub Pages, Custom domain `admin.thenammastay.com` → wait for "DNS check successful"
   → tick **Enforce HTTPS** (may take up to an hour).
8. **Admin account:** Supabase → Authentication → Add user (e.g. `admin@thenammastay.com`, strong password,
   Auto Confirm) → SQL Editor → run `3_admin_access.sql` with that email (first part only).
9. Open **https://admin.thenammastay.com** → sign in → scan the QR code with Google/Microsoft Authenticator
   → type the 6-digit code. From then on every sign-in asks for the code.

## Lost your phone?

Another admin (or you, in Supabase → SQL Editor) runs:
```sql
delete from auth.mfa_factors
where user_id = (select id from auth.users where lower(email) = lower('admin@thenammastay.com'));
```
At the next sign-in the admin sets up the authenticator again.

## Updating

When the hostel app gets a new version, copy these shared files from the hostel repo into this repo too:
`assets/css/styles.css`, `assets/js/core.js`, `assets/js/demo-backend.js`.
(Keep this repo's own `assets/js/config.js`.)
