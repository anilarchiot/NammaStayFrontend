# NammaStay

Front-desk web app for hostels, hotels and homestays — bookings, beds,
check-ins and payments. First property: Social Backpackers Hostel, Chennai.

This is a static site (plain HTML + CSS + a little JavaScript). No build step,
no framework, nothing to install. It runs as a **clickable prototype**:
every screen and link works, but forms don't save data yet.

## Pages

| URL                   | Screen                              |
| --------------------- | ----------------------------------- |
| `/` (index.html)      | Sign in                             |
| `/dashboard.html`     | Dashboard                           |
| `/bookings.html`      | Bookings list (click a row → detail)|
| `/booking-detail.html`| Booking detail dialog               |
| `/calendar.html`      | Bed calendar / timeline             |
| `/guest-profile.html` | Guest profile                       |
| `/check-in.html`      | New guest registration & check-in   |
| `/rooms.html`         | Rooms & beds                        |
| `/payments.html`      | Payments                            |
| `/reports.html`       | Reports & analytics                 |
| `/settings.html`      | Settings                            |
| `/self-check-in.html` | Guest self check-in (phone screen)  |

## Folder structure

```
nammastay/
├── index.html            ← sign-in (site entry point)
├── dashboard.html … settings.html, self-check-in.html
├── 404.html
├── .nojekyll             ← tells GitHub Pages to serve files as-is
└── assets/
    ├── css/styles.css    ← app shell, sidebar, responsive rules
    ├── js/app.js         ← mobile menu, clickable rows
    └── img/              ← logo, favicon, app icon
```

Each page keeps its screen-specific styles in a `<style>` block in its own
`<head>`; everything shared lives in `assets/`. The sidebar is identical on
every page, so if you add a menu item, add it to each page.

## Go live on GitHub Pages

1. Create a new repository on GitHub (e.g. `nammastay`). Public repos get
   Pages for free.
2. Click **Add file → Upload files** and drag in the *contents* of this folder
   (the files and the `assets` folder, not the outer folder itself).
   `.nojekyll` is a hidden file — if your computer hides it, the site still
   works without it.
3. Commit to the `main` branch.
4. Go to **Settings → Pages**. Under *Build and deployment*, choose
   **Deploy from a branch**, branch **main**, folder **/ (root)**, and save.
5. After a minute or two the site is live at
   `https://<your-username>.github.io/nammastay/`.

### Custom domain (thenammastay.in)

1. In **Settings → Pages → Custom domain**, enter `thenammastay.in` and save
   (GitHub creates a `CNAME` file for you).
2. At your domain registrar, add DNS records:
   - four **A** records for `@` pointing to
     `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - a **CNAME** record for `www` pointing to `<your-username>.github.io`
3. Once DNS resolves (can take a few hours), tick **Enforce HTTPS**.

## Other hosts

Because it's plain static files, the same folder also deploys as-is to
Netlify, Vercel or Cloudflare Pages — drag the folder in, no settings needed.

## Run locally

```
cd nammastay
python3 -m http.server 8000
```
then open http://localhost:8000.

## What's next

To make it a working app (real logins, saved bookings, live bed status,
email notifications), the screens need a backend — for example Supabase or
Firebase for auth and database — wired up in `assets/js/`.
