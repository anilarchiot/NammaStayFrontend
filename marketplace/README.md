# nammaBookings (marketplace)

A separate public web app (booking-site style) where hosts register, list properties and receive bookings.
It reuses the project's Supabase settings from `../assets/js/config.js` and can be hosted as its own static site
(deploy the `marketplace/` folder together with `assets/js/config.js`, e.g. a second Cloudflare Pages project).

- `index.html` – guests search by city/dates/guests, view a property and book.
- `host.html` – hosts register/sign in, upload a property (photos, rooms, prices), see bookings and the **listing code**.

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
