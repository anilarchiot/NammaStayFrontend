# NammaStay — frontend

The website for **thenammastay.com**: marketing homepage + the NammaStay app. Plain HTML/CSS/JS, served by GitHub Pages.
The backend (database, security rules, server functions) is in the separate **backend repo**.

| Path | What it is |
|---|---|
| `index.html` | Marketing homepage with early-access form (edit WhatsApp/email at the bottom) |
| `login.html` | Staff sign-in |
| `dashboard.html`, `bookings.html`, `calendar.html`, `check-in.html`, `rooms.html`, `payments.html`, `guest-profile.html`, `reports.html`, `settings.html`, `leads.html`, `booking-detail.html` | The app |
| `self-check-in.html` | Guest online check-in (public link) |
| `assets/js/config.js` | **Connection to Supabase** — paste Project URL + anon key here to go live |
| `assets/js/core.js`, `assets/js/pages/` | App logic, one script per screen |
| `assets/js/demo-backend.js` | Sample data used when `config.js` is empty (demo mode) |
| `assets/css/styles.css`, `assets/img/` | Styles, logo, screenshots |

**Demo mode:** with `config.js` empty, everything runs in the browser on sample data.
**Live mode:** fill `supabaseUrl` + `supabaseAnonKey` in `config.js` (never the service_role key).
