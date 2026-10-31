# nammaBookings (marketplace)

A separate public web app (booking-site style) where hosts register, list properties and receive bookings.
It reuses the project's Supabase settings from `../assets/js/config.js` and can be hosted as its own static site
(deploy the `marketplace/` folder together with `assets/js/config.js`, e.g. a second Cloudflare Pages project).

- `index.html` – the NammaBookings homepage and product guide, with the full screenshot gallery and links into guest search and host signup.
- `stays.html` – guests search hostels and PGs by city/dates, choose a bed, book or request a visit, and track their request.
- `find.html` – guests search and book homestays, hotels and resorts.
- `host.html` – hosts register/sign in, upload a property (photos, rooms, prices), see bookings and the **listing code**.
- `owner.html` – free hostel/PG listing, booking requests, availability and monthly bills.
- `search-admin.html` – internal listing review and billing tools.

The homepage screenshot gallery uses the images in `marketplace/screens/`; all 31 supplied product screenshots are included as local site assets.

## Run and deploy as its own web app

The folder is self-contained (own `config.js`, `_headers`, installable PWA manifest, `wrangler.jsonc`).
- Local: `npm run stays:dev` → http://localhost:4174
- Deploy: `npm run stays:deploy` (Cloudflare Worker `nammastay-stays`), or point any static host at `marketplace/`.
- Keep `marketplace/config.js` in step with `assets/js/config.js` (same Supabase URL and anon key).

## Setup

1. Run `supabase/migrations/055_marketplace.sql` (after 049).
2. Create a long random key (32+ chars) and set the secrets:
   ```
   supabase secrets set NAMMASTAY_API_KEY=<random-key> \
     NAMMASTAY_API_URL=https://<project>.supabase.co/functions/v1/marketplace-api
   ```
3. Deploy the functions: `supabase functions deploy marketplace-api` (JWT check is disabled in `supabase/config.toml`;
   the function authenticates with `NAMMASTAY_API_KEY` itself) and redeploy `connect`.

## OTA sync between the NammaStay app and nammaBookings

The NammaStay app talks to nammaBookings through NammaStay Connect as the `nammastay` channel, using NammaStay's own API key
(never an OTA partner key). In the app: Connect → *nammaBookings* → enter the listing code from the host dashboard → map rooms → Go live.

- App → nammaBookings: room units and rates are pushed (`/availability`).
- nammaBookings → App: marketplace bookings are pulled into Connect reservations (`/reservations`).

## Protected live build (hidden API + obfuscated code)

`npm run build:live` writes `live/site` and `live/stays` with all JavaScript obfuscated, HTML minified, and the app
pointed at its own `/api` proxy ([worker/index.js](../worker/index.js)). The Supabase URL and anon key are not in the shipped
files; they live in the Worker (`SUPABASE_URL` var, `SUPABASE_ANON_KEY` secret). Deploy with `npm run deploy:live` after
`wrangler secret put SUPABASE_ANON_KEY --config wrangler.live.jsonc` (and `--config marketplace/wrangler.live.jsonc`).
Note: this makes code and traffic much harder to read, but anything a browser runs can still be inspected.

## NammaStay Search (free hostel / PG listings)

Mobile-first guest app and owner portal built on the same Supabase project (migration `supabase/migrations/056_nammastay_search.sql`, rollback in `supabase/rollbacks/`).

- `stays.html` – guests: search (hostel per night / PG monthly), results with live-beds vs owner-confirms, map, bed picker, women-only filter, 360° view, reviews, booking request, PG visit scheduling, request tracking, post-stay review.
- `owner.html` – owners: free sign-up (5+ photos, rooms, map pin, proof), then Requests (accept / can't take it, did they stay?), Free beds (women-only, 360°, WhatsApp community, Instagram, review replies) and Bill (launch offer, 9% after, UTR payment).
- `search-admin.html` – NammaStay team: checklist-gated approval (Verified badge), ask for changes / reject, bills (confirm UTR, WhatsApp reminder), commission settings, subscribers.

Setup: run `056_nammastay_search.sql` after 055, then make yourself an admin:
`insert into public.mk_admins (user_id) select id from auth.users where email = 'you@example.com';`
Optional: set `upiId` in `config.js` to show a "Pay by UPI" button on owner bills. Phone "Send code" verification needs an SMS provider; until then the team ticks "Phone verified" on the video call.

### Guest rewards

Run `supabase/migrations/057_guest_rewards.sql` after `056_nammastay_search.sql`. Guests can open **Guest rewards** from the search app and verify with a booking reference plus the phone number used for that booking. They earn 1 point per ₹100 of an accepted stay's booking total after checkout and host confirmation. Points unlock Explorer (100), Trailblazer (500), and Legend (1,000) tiers; they have no cash value. No extra guest account or personal-data table is created.
