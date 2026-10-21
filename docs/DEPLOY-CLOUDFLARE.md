# NammaStay — Hosting on Cloudflare Pages & scaling to many properties

This guide moves the website from GitHub Pages to **Cloudflare Pages** and explains how to run one NammaStay deployment for any number of properties (hotels, hostels, homestays) and their staff.

See [GO-LIVE.md](./GO-LIVE.md) for the Supabase (database, login, emails) setup.

---

## 1. How NammaStay scales

Run **one website + one Supabase project for every customer**. Do not create a separate copy per property.

```
Browser (thenammastay.com)  ──►  Cloudflare Pages (static site, global CDN)
                            ──►  Supabase Pro, Mumbai (one shared database)
                                   └─ each property's data is isolated by row-level security
```

Every property, staff member and booking is a row in the same database. Row-level security (`supabase/migrations/002_security.sql`) makes sure a user only ever sees the properties they are a member of. Adding customers needs no new deployment; you upgrade plans as usage grows.

### Recommended set-up

| Part | Service | Why |
|---|---|---|
| Website | **Cloudflare Pages** (free) | Unlimited bandwidth, global CDN, auto-deploy from GitHub, preview links for pull requests |
| Database, login, files | **Supabase Pro**, region Mumbai (ap-south-1) | Daily backups, no pausing, 8 GB database included |
| Staging | A second Supabase project | Try migrations and the load test before touching live data |
| Email | **Resend** on your own domain | Used for login emails (custom SMTP) and booking/lead emails; Supabase's built-in sender is rate-limited |

### When to upgrade

| Properties | What to have |
|---|---|
| Up to ~50 | Supabase Pro (~US$25/month), Cloudflare Pages free, Resend free tier |
| 50–500 | Supabase compute **Small/Medium**, Resend paid tier, **Point-in-Time Recovery** add-on, test a backup restore |
| 500+ | Medium/Large compute or a read replica, uptime monitoring, front-end error tracking (e.g. Sentry), staging → production release routine |

### What limits growth, in order

1. **Realtime connections** — every open app tab keeps one live connection for the notification bell. Supabase Pro includes about 500 concurrent connections. Example: 200 properties × 3 staff × 2 tabs ≈ 1,200 → buy the realtime add-on or a bigger plan.
2. **ID photo storage** — ~150–300 KB each. Keep the automatic ID-photo deletion (retention setting) switched on.
3. **Auth rate limits** — after custom SMTP is configured, raise the limits in **Authentication → Rate Limits**.
4. **Database size** — comes last: 8 GB holds tens of lakhs of bookings, and every list is indexed and paginated.

Watch these in **Supabase → Reports** and **Usage** every month.

---

## 2. Before you start

- You can sign in to the domain registrar for `thenammastay.com`.
- The static site check works: `npm ci` then `npm test` validates the root HTML pages and assets. The website is served directly from the repository root.
- Keep GitHub Pages running until step 5 — the site stays online during the move.

---

## 3. Create the Cloudflare Pages project

1. Sign up / sign in at **dash.cloudflare.com**.
2. **Workers & Pages → Create → Pages → Connect to Git**.
3. Authorise GitHub and choose the repository `anilarchiot/NammaStayFrontend`.
4. Build settings:

   | Setting | Value |
   |---|---|
   | Production branch | `main` |
   | Framework preset | None |
   | Build command | `npm test` |
   | Build output directory | `.` |
   | Root directory | *(leave empty)* |

5. **Environment variables → Add**: `NODE_VERSION` = `22`.
6. **Save and Deploy**. Wait for the build to finish (1–2 minutes).
7. Open the address Cloudflare shows (`https://<project>.pages.dev`) and check:
   - the homepage loads;
   - `/login.html` loads and you can sign in;
   - the language picker and a few app pages work.

From now on every push to `main` deploys automatically, and every pull request gets its own preview link.

### If Cloudflare created a Worker instead of a Pages project

Cloudflare's dashboard may set the site up as a **Worker** with the deploy command `npx wrangler deploy`. The `wrangler.jsonc` publishes the root static site files. Use these settings (**Workers & Pages → your Worker → Settings → Build**):

| Setting | Value |
|---|---|
| Build command | `npm test` |
| Deploy command | `npx wrangler deploy` |
| Root directory | *(leave empty)* |
| Variable | `NODE_VERSION` = `22` |

- The `name` in `wrangler.jsonc` must match the Worker's name in the dashboard. Change one of them if they differ.
- Error `Asset too large … node_modules/workerd/bin/workerd`: Wrangler is uploading the whole repository. Make sure `wrangler.jsonc` is on the `main` branch and the build command is set.
- Custom domains are added under the Worker's **Settings → Domains & Routes** (same DNS steps as section 4).

---

## 4. Move the domain to Cloudflare

Cloudflare Pages can only serve the bare domain (`thenammastay.com`, without `www`) when the domain's DNS is on Cloudflare.

### 4a. Move DNS to Cloudflare
1. Cloudflare dashboard → **Add a domain** → `thenammastay.com` → **Free** plan.
2. Cloudflare imports your existing DNS records. **Compare them with your registrar's list** and add anything missing, especially:
   - **MX** records (your mailbox);
   - **TXT** records (SPF, DKIM, DMARC, Google/other verifications);
   - **Resend** domain-verification records.
3. At your domain registrar, replace the nameservers with the two Cloudflare shows.
4. Wait until Cloudflare shows the domain as **Active** (usually minutes, up to 24 hours).

### 4b. Attach the domain to the Pages project
1. **Workers & Pages → your project → Custom domains → Set up a custom domain**.
2. Add `thenammastay.com` → **Activate domain**. Cloudflare replaces the old GitHub Pages records (`185.199.108–111.153` A records) automatically.
3. Repeat for `www.thenammastay.com`.
4. Wait until both show **Active** with an SSL certificate.
5. Open https://thenammastay.com and https://www.thenammastay.com in a private window and confirm the site loads.

Optional: **Rules → Redirect Rules** to send `www` to the bare domain (or the other way), so there is one address.

---

## 5. Switch off GitHub Pages

Only after the domain works on Cloudflare:

1. GitHub repo → **Settings → Pages** → set **Source** to **None** (or unpublish the site).
2. GitHub Pages is configured separately in **Settings → Pages**; after switching to Cloudflare, set its source to **None** so it does not continue serving the domain.
3. The `CNAME` file can stay in the repo; Cloudflare ignores it.

---

## 6. Check everything after the move

1. **Supabase → Authentication → URL Configuration**
   - Site URL: `https://thenammastay.com`
   - Redirect URLs: `https://thenammastay.com/**` and `https://www.thenammastay.com/**`
   - Also add `https://<project>.pages.dev/**` if you want to sign in on preview links.
2. **Edge function secret** `SITE_URL` (used in booking emails) should be `https://thenammastay.com`:
   ```bash
   supabase secrets set SITE_URL=https://thenammastay.com
   ```
3. Run the smoke test:
   - sign in, wrong password shows an error, "Forgot?" sends an email;
   - create a booking, record a payment;
   - copy an online check-in link, open it on a phone, submit it;
   - switch language a few times;
   - submit the homepage enquiry form and confirm it appears under **Leads**.
4. Hard-refresh (Ctrl+Shift+R) if you still see the old site.

---

## 7. Day-to-day

- **Updating the site:** push to `main` → Cloudflare builds and deploys. See progress in **Workers & Pages → your project → Deployments**.
- **Rollback:** Deployments → pick an earlier successful deployment → **Rollback to this deployment**.
- **Failed build:** open the deployment's build log. A failure in `npm test` means the static-site checks (`scripts/validate-production.cjs`) failed — fix it locally first with `npm ci && npm test`.
- **Database changes:** new numbered migration → run on the staging Supabase project → run on live → re-run `supabase/tests/01_security_checks.sql`.

---

## 8. Load test on the staging project

Prove the database stays fast with lakhs of bookings before onboarding many properties. Use the **staging** Supabase project only — never the live one.

1. In the staging project run migrations `001`–`003` (or `supabase/SETUP_ALL.sql`).
2. **Authentication → Users → Add user → Create new user**: `loadtest@example.com` (any password), tick **Auto Confirm User**.
   - To use a different login, change `v_email` at the top of `supabase/tests/02_load_test.sql`.
   - If you see `Create the test login loadtest@example.com first.`, that login does not exist in this project yet; nothing was changed, so create it and run again.
   - Check with:
     ```sql
     select id, email from auth.users where lower(email) = lower('loadtest@example.com');
     ```
3. Run `supabase/tests/02_load_test.sql` in the SQL Editor (takes 1–3 minutes).
4. Every screen's query should take under ~300 ms, and the final EXPLAIN should show index scans, not `Seq Scan` on bookings.
5. Delete or reset the staging data afterwards.

---

## 9. Homepage enquiry emails

The homepage enquiry form (`index.html`) does **not** send email itself. It saves the request through the Supabase function `submit_lead` into the `leads` table, which you can see in the admin app under **Leads**.

To also get an email for every enquiry:

1. Set the address that should receive enquiries:
   ```bash
   supabase secrets set LEADS_NOTIFY_EMAIL=you@thenammastay.com
   ```
2. Deploy the `notify-lead` edge function:
   ```bash
   supabase functions deploy notify-lead --no-verify-jwt
   ```
   Note: `notify-lead` is not in this repository yet (`supabase/functions/` only contains `notify-booking` and `purge-id-docs`). Check **Supabase → Edge Functions** to see whether it is already deployed in your project.
3. **Database → Webhooks → Create**: table `leads`, event **Insert**, type **Supabase Edge Function** → `notify-lead`, HTTP header `x-webhook-secret: <your WEBHOOK_SECRET>`.
4. Submit a test enquiry and check the inbox (and **Edge Functions → Logs** if nothing arrives).

---

## 10. Monthly cost

| Item | Cost |
|---|---|
| Cloudflare Pages + DNS | Free |
| Domain | What you already pay |
| Supabase Pro | ~US$25/month + compute/add-ons as you grow |
| Resend | Free tier, then paid by email volume |
| UPI | ₹0 — no gateway fees |
