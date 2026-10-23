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
It opens maximized without the standard Windows title/menu bar and uses a NammaStay-styled top strip with window
controls.

Build the installer on Windows with `npm run desktop:build:win`. The GitHub Actions workflow
`Build Windows desktop app` also builds the installer and publishes it as a downloadable workflow artifact.

This is the desktop/local-storage foundation, **not yet an offline copy of the operational app**. Non-booking
business records are still read from and written to Supabase, and booking/calendar changes still require an
internet connection. Keep using the website or desktop app online until the local-data migration and explicit
offline booking/calendar status behavior are completed. Do not treat the current desktop build as an offline
backup of guest or property records.

## Android and iOS apps
The Android and iOS projects package the existing responsive NammaStay app with Capacitor. They use the same
Supabase project and online behavior as the website; these projects do not add offline business-data storage or
offline booking/calendar updates.

```bash
npm install
npm run mobile:android
# or, with an Android device/emulator selected:
npm run mobile:run:android
```

The Android project is in `android/`. Run these commands on a computer with Android Studio and its SDK installed.
Android Studio can build and run a debug APK; a Play Store release needs a signed Android App Bundle and Play
Console account.

Run iOS commands on macOS with Xcode and CocoaPods installed:

```bash
npm run mobile:ios
# or, with an iPhone simulator/device selected:
npm run mobile:run:ios
```

The iOS project is in `ios/App/App.xcworkspace`. Xcode can run the app in an iPhone simulator or on a device;
App Store/TestFlight distribution requires Apple signing credentials and an Apple Developer account. iOS apps
cannot be built or signed on Windows or Linux. After changing website pages or assets, the mobile commands sync
the web app into each native project automatically.

## Source structure
HTML pages and the `assets/` directory are at the repository root and are served directly by GitHub Pages. Route metadata is in `assets/js/routes.js`. `npm run build` validates the published root files without generating a separate `dist/` folder; `npm run dev` serves the same root site locally.
