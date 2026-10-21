# NammaStay website (https://thenammastay.com)

One repo, one website, one domain. Everything is in this folder:

| Address | What it is |
|---|---|
| `thenammastay.com` (`src/pages/index.html`) | Marketing homepage — pricing, features, "Request a demo" form |
| `thenammastay.com/login.html` | **Sign in** → the hostel app (dashboard, bookings, calendar, check-in, Form C, rooms, housekeeping, OTA sync, payments, expenses, reports, settings) |
| `thenammastay.com/signup.html` | Free-trial sign-up → setup wizard (`setup.html`) |
| `thenammastay.com/admin-login.html` | **NammaStay admin login** (link at the bottom of the sign-in page) — 2-step code login → `admin.html`, `subscribers.html`, `revenue.html`, `leads.html`, `activity.html` |
| `thenammastay.com/self-check-in.html` | Guests' online check-in link |
| `terms.html`, `privacy.html`, `refund.html` | Legal pages |

## Setup
1. In the GitHub repo (NammaStayFrontend), set Settings → Pages → Build and deployment → Source to **GitHub Actions**.
2. The `CNAME` file holds `thenammastay.com`. In GoDaddy keep only the apex A records (185.199.108–111.153) and `www` CNAME → `anilarchiot.github.io`.
   The old `app` and `admin` CNAME records can be deleted.
3. `src/assets/js/config.js`: paste the Supabase Project URL + anon key. `siteUrl` stays `https://thenammastay.com`.
4. Supabase → Authentication → URL configuration: Site URL `https://thenammastay.com`, Redirect URLs `https://thenammastay.com/**`.

The admin pages are safe on the same site: every admin screen and every admin database function checks
`is_platform_admin()` on the server (plus the authenticator-app code when it is turned on). Hostel staff who open
`admin.html` are simply sent back to the admin login.

## Source structure
Page documents live in `src/pages/`, shared frontend assets in `src/assets/`, and route metadata in `src/assets/js/routes.js`. `npm test` emits the same public `.html` URLs into `dist/`; deploy `dist/`, never `src/`.
