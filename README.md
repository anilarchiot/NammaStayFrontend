# NammaStay

Guest management for Social Backpackers Hostel — bookings, beds, check-in/out, payments (direct UPI), reports, and guest online check-in.

- **Demo mode:** leave `assets/js/config.js` empty → the full app runs in the browser with sample data (every screen and button works; changes are saved in that browser only; *Reset* in the menu starts fresh).
- **Live mode:** follow **[docs/GO-LIVE.md](docs/GO-LIVE.md)** to set up the Supabase backend and fill in `config.js`.

| Folder | Contents |
|---|---|
| `index.html` | Marketing homepage (edit contact details at the bottom) |
| `login.html` + app pages, `assets/` | The app (staff sign-in at /login.html) |
| `assets/js/core.js`, `assets/js/pages/` | Live-mode logic, one script per screen |
| `supabase/migrations/` | Database schema, security rules, functions, seed, schedule — run in order |
| `supabase/tests/` | Security checks and the lakhs-of-rows load test |
| `supabase/functions/` | Booking email + ID-photo cleanup |
| `docs/GO-LIVE.md` | Step-by-step launch guide and checklists |

Security model: every table has Row Level Security; bookings and payments can only be changed through database functions that check the staff member's role; guest ID photos live in a private bucket and are deleted after the retention period.
