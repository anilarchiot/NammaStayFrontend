# NammaStay website (https://thenammastay.com)

One repo, one website, one domain. Everything is in this folder:

| Address | What it is |
|---|---|
| `thenammastay.com` (`index.html`) | Marketing homepage — pricing, features, "Request a demo" form |
| `thenammastay.com/login.html` | **Sign in** → the property app (dashboard, bookings, calendar, OTA sync through Beds24, check-in, Form C, rooms, housekeeping, payments, expenses, reports, settings) |
| `thenammastay.com/signup.html` | Free-trial sign-up → setup wizard (`setup.html`) |
| `thenammastay.com/admin-login.html` | **NammaStay admin login** (link at the bottom of the sign-in page) — 2-step code login → `admin.html`, `subscribers.html`, `revenue.html`, `leads.html`, `activity.html`, `connections.html` |
| `thenammastay.com/self-check-in.html` | Guests' online check-in link |
| `terms.html`, `privacy.html`, `refund.html` | Legal pages |

## Setup
1. In the GitHub repo (NammaStayFrontend), set Settings → Pages → Build and deployment → Source to **Deploy from a branch**, then select `main` and `/(root)`.
2. The `CNAME` file holds `thenammastay.com`. In GoDaddy keep only the apex A records (185.199.108–111.153) and `www` CNAME → `anilarchiot.github.io`.
   The old `app` and `admin` CNAME records can be deleted.
3. `assets/js/config.js`: paste the Supabase Project URL + anon key. `siteUrl` stays `https://thenammastay.com`.
4. Supabase → Authentication → URL configuration: Site URL `https://thenammastay.com`, Redirect URLs `https://thenammastay.com/**`.

The admin pages are safe on the same site: every admin screen and every admin database function checks
`is_platform_admin()` on the server (plus the authenticator-app code when it is turned on). Hostel staff who open
`admin.html` are simply sent back to the admin login.

## Windows desktop app (foundation)
The desktop shell and installer are built with Electron:

```bash
npm install
npm run desktop:dev
npm run desktop:build:win
```

The Windows installer is written to `release/`. The desktop app uses the same Supabase project as the website for
sign-in and all current property, booking, and calendar operations. Its local SQLite store encrypts record values
with a key protected by Windows system encryption; the desktop Supabase session is stored there. The database is
kept in Electron's per-user application data folder, not in the install directory.

Build the installer on Windows with `npm run desktop:build:win`. The GitHub Actions workflow
`Build Windows desktop app` also builds the installer and publishes it as a downloadable workflow artifact.

This is the desktop/local-storage foundation, **not yet an offline copy of the operational app**. Non-booking
business records are still read from and written to Supabase, and booking/calendar changes still require an
internet connection. Keep using the website or desktop app online until the local-data migration and explicit
offline booking/calendar status behavior are completed. Do not treat the current desktop build as an offline
backup of guest or property records.

## Source structure
HTML pages and the `assets/` directory are at the repository root and are served directly by GitHub Pages. Route metadata is in `assets/js/routes.js`. `npm run build` validates the published root files without generating a separate `dist/` folder; `npm run dev` serves the same root site locally.
