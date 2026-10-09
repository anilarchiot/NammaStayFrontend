# NammaStay website (https://thenammastay.com)

One repo, one website, one domain. Everything is in this folder:

| Address | What it is |
|---|---|
| `thenammastay.com` (`index.html`) | Marketing homepage — pricing, features, "Request a demo" form |
| `thenammastay.com/login.html` | **Sign in** → the hostel app (dashboard, bookings, calendar, check-in, Form C, rooms, housekeeping, OTA sync, payments, expenses, reports, settings) |
| `thenammastay.com/signup.html` | Free-trial sign-up → setup wizard (`setup.html`) |
| `thenammastay.com/admin-login.html` | **NammaStay admin login** (link at the bottom of the sign-in page) — 2-step code login → `admin.html`, `subscribers.html`, `revenue.html`, `leads.html`, `activity.html` |
| `thenammastay.com/self-check-in.html` | Guests' online check-in link |
| `terms.html`, `privacy.html`, `refund.html` | Legal pages |

## Setup
1. Push this folder to the GitHub repo (NammaStayFrontend) → Settings → Pages → deploy from `main` / root.
2. The `CNAME` file holds `thenammastay.com`. In GoDaddy keep only the apex A records (185.199.108–111.153) and `www` CNAME → `anilarchiot.github.io`.
   The old `app` and `admin` CNAME records can be deleted.
3. `assets/js/config.js`: paste the Supabase Project URL + anon key. `siteUrl` stays `https://thenammastay.com`.
4. Supabase → Authentication → URL configuration: Site URL `https://thenammastay.com`, Redirect URLs `https://thenammastay.com/**`.

The admin pages are safe on the same site: every admin screen and every admin database function checks
`is_platform_admin()` on the server (plus the authenticator-app code when it is turned on). Hostel staff who open
`admin.html` are simply sent back to the admin login.
