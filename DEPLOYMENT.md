# Deployment Guide — Vercel + Neon/Supabase

This project runs fully in MOCK mode with zero external accounts, so you can deploy a working demo before wiring up a single real provider. This guide walks through a full production deployment, provider by provider, plus a go-live checklist.

## Table of Contents

- [Local Development & Testing](#local-development--testing)
- [Provider Accounts — What You Actually Need to Go Live](#provider-accounts--what-you-actually-need-to-go-live)
- [1. Database (Neon or Supabase)](#1-database-neon-or-supabase)
- [2. Environment Variables](#2-environment-variables)
- [3. Vercel Project Setup](#3-vercel-project-setup)
- [4. Database Migrations in Production](#4-database-migrations-in-production)
- [5. Seeding Production Data](#5-seeding-production-data)
- [6. Webhook Configuration](#6-webhook-configuration)
- [7. Domain & URLs](#7-domain--urls)
- [8. Vercel Blob (File Storage)](#8-vercel-blob-file-storage)
- [9. Switching an Adapter from MOCK to LIVE](#9-switching-an-adapter-from-mock-to-live)
- [10. Pre-Launch Checklist](#10-pre-launch-checklist)
- [Go-Live Checklist](#go-live-checklist)

---

## Local Development & Testing

Everything in this section runs with **zero external accounts** — every integration falls back to a realistic MOCK the moment its credentials are absent, so you can exercise the full storefront and admin console without signing up for anything.

### Run it locally

**0. Open Docker Desktop and wait for it to say "Running."** Everything below fails with `Can't reach database server` if you skip this.

**1. Run these four commands, in order, in the project folder:**

```bash
docker start ebl-postgres
npx prisma migrate dev
npm run db:seed
npm run dev -- -p 3001
```

**2. Watch the last command's output.** It should end with `✓ Ready` and keep running — leave that terminal window open, don't close it.

**3. Open `http://localhost:3001`** in your browser.

**Login:** `admin@elevatebiolab.com` / `Admin123!change-me`

---

<details>
<summary><strong>Notes and troubleshooting</strong> (click to expand)</summary>

- **First time ever on a fresh machine only** (skip if `ebl-postgres` already exists — it does on this machine): instead of `docker start ebl-postgres`, create the container once with:
  ```bash
  docker run -d --name ebl-postgres -e POSTGRES_USER=ebl -e POSTGRES_PASSWORD=ebl -e POSTGRES_DB=elevate -p 55432:5432 postgres:16-alpine
  ```
  Then also run `npm install` and set up `.env` (copy `.env.example` to `.env`, fill in `AUTH_SECRET`/`NEXTAUTH_SECRET` via `openssl rand -base64 32` — a random string this app generates for itself to sign login cookies, not a credential from any company).

- **Don't re-run `cp .env.example .env`** once `.env` already has real values in it — it overwrites the whole file back to blank placeholders, including a working `DATABASE_URL`. Edit `.env` directly instead.

- **Why port 3001, not the default 3000:** something inside WSL2 on this machine permanently occupies port 3000 (an unrelated app, confirmed, not this project). Windows randomly routes `localhost:3000` between that and this dev server, so routes 404 unpredictably. `.env` is already set up for `:3001` (`NEXTAUTH_URL` and `NEXT_PUBLIC_SITE_URL`) — always include `-- -p 3001` when running `npm run dev` on this machine.

- **Nothing loads / connection refused:** almost always means the last command isn't actually still running — check the terminal for an error instead of retrying blindly. Common causes: Docker Desktop not actually running yet, or `.env`'s `DATABASE_URL`/`DIRECT_URL` don't match `postgresql://ebl:ebl@localhost:55432/elevate?schema=public`.

</details>

### Testing the storefront end-to-end

1. **Browse & cart** — `/products`, filter/sort, add a few items to cart (`/cart`), confirm quantities and totals update.
2. **Checkout — card / ACH / crypto rails.** In MOCK mode (no `NEXAPAY_*`/`STRIPE_*`/`COINBASE_*` keys set), `placeOrder` creates the order and reserves stock, but the order stays `PENDING_PAYMENT` — nothing calls the payment webhook for you, because in production that call comes from the provider, and there is no provider here. To move the order forward, either:
   - **Easiest:** log into `/admin` → **Orders** and change the status dropdown to `PAID` by hand, or
   - **Exercise the real webhook path:** simulate the provider's callback yourself. For NexaPay specifically (verified against `src/lib/payments/nexapay.ts`):
     ```bash
     curl -X POST http://localhost:3001/api/webhooks/payment/nexapay \
       -H "Content-Type: application/json" \
       -d '{"type":"charge.succeeded","data":{"id":"mock_nexa_<ORDER_NUMBER>","amount":<TOTAL_CENTS>}}'
     ```
     Swap in the real order number (shown at `/checkout/success` and in `/admin` → Orders) and the order's total in cents. A 200 response with `{"received":true}` and the order flipping to `PAID` confirms the webhook route, idempotency check, and stock/email side effects all fire correctly. The other four rails (`stripe`, `coinbase`, `seamlesschex`, `payram`) follow the same pattern with their own mock `providerRef` prefix — see the top of each adapter in `src/lib/payments/`.
   - Sending the same payload twice should be a no-op the second time (idempotency) — worth checking once if you're testing the webhook route itself.
3. **Checkout — P2P (Zelle/Venmo/Wire).** This rail requires no mocking to test fully: selecting it creates the order as `AWAITING_REVIEW`, shows payment instructions, and prompts for a proof-of-payment upload — the complete real flow, no simulated webhook needed. This is also the easiest way to populate the admin **P2P queue** (below) with something to review.
4. **Verify a COA** — `/verify-coa` (search by batch/lot or compound name — try one of the seeded suggestion chips) and `/certificates` (full archive).
5. **Dashboard** — log in as any registered customer and confirm the order you just placed shows up under `/dashboard`.

### Testing the admin panel

Log in as the seeded admin and open `/admin`. Walk each tab:

- **Products** — edit an existing product's name/price/stock; upload or replace its photo (new products need to be saved once before a photo can attach); restock via the inventory-adjustment dialog; deactivate a product and confirm it disappears from `/products` but stays visible here.
- **Orders** — change an order's status; click **Create USPS label** on an order with no tracking number yet — in MOCK mode (no `USPS_*` keys) this returns instantly with a synthesized tracking number, no real API call.
- **P2P queue** — place a test order via a P2P rail as a customer first (step 3 above), then approve or reject the receipt here and confirm the order's status updates and — if approved — a confirmation email attempt fires (check your terminal log if `SENDGRID_API_KEY` is unset; SendGrid also runs in MOCK).
- **COAs** — upload a COA PDF against any product and confirm it appears on that product's detail page and in `/certificates`.
- **Email** — trigger the manual "Promotional blast" campaign; in MOCK mode (no `KLAVIYO_API_KEY`) this logs the event without actually sending anything.
- **Compliance** — this tab is a **read-only** chargeback-ratio and LegitScript-readiness dashboard, not an editor. Confirm the metrics table and document checklist render; there's currently no UI to edit compliance docs from here (they're seeded via `prisma/seed.ts` / the `ComplianceDoc` table).

After any admin edit, the screen should update immediately without a manual reload — if it doesn't, that's a regression (every admin mutation calls `router.refresh()` after a successful save).

---

## Provider Accounts — What You Actually Need to Go Live

**First, a clarification.** `AUTH_SECRET`/`NEXTAUTH_SECRET` in your `.env` is **not** a credential from any company. It's a random string, generated locally on your own machine (`openssl rand -base64 32`), that this app uses internally to sign and encrypt its own login session cookies. No account, no signup, no external service is involved — it never leaves your server. That's the only "secret" currently filled in.

Every other credential slot in `.env` — every payment processor, USPS, SendGrid, Klaviyo, Vercel Blob — is still **blank**, meaning the app runs entirely in MOCK mode for all of them right now: checkout, shipping labels, and emails all simulate successfully without ever contacting a real company. Nothing has been signed up for on your behalf. Below is what each one actually requires before it can process real orders, real payments, or real shipments.

### 1. Database hosting (required)
Local Docker Postgres won't survive a deploy. Pick one:
- **[Neon](https://neon.tech)** — generous free tier, native Vercel integration (recommended if hosting on Vercel).
- **[Supabase](https://supabase.com)** — also free-tier friendly, adds a dashboard/auth/storage suite you won't use here but might want later.

Create the project, grab the pooled + direct connection strings, done — see §1 below.

### 2. Hosting (required)
**[Vercel](https://vercel.com)** — free tier covers this comfortably to start. Sign up, connect your GitHub account, import the repo.

### 3. Payments — the one that needs real research, not a quick signup
This is the part of the business that actually determines whether the site can take money at all, so I'm going to be direct rather than just hand you a signup list.

**Mainstream card processors will very likely reject this business.** Stripe, PayPal, and Square all publish restricted/prohibited-business lists that commonly include unapproved research chemicals and peptides sold for anything resembling human use. Applying with one of them risks an account freeze with funds held, not just a rejection — don't build a primary revenue path on them for this product category.

**The codebase already reflects that** — it's built around "high-risk-friendly" processors (`NexaPay`, `SeamlessChex`/AllayPay, `PayRam` in `src/lib/payments/`) instead of defaulting to Stripe alone. Important caveat, straight from that code's own comments: these three adapters are written to a *documented API shape*, not verified against a real, live merchant account. Treat them as a solid starting template, not a guarantee — once you actually sign up with a real high-risk processor, you'll likely need to adjust field names/auth details in that adapter to match what they actually hand you. High-risk merchant underwriting also typically wants: a registered business entity, EIN, business bank account, and sometimes a rolling reserve — budget time for that process, not just an afternoon.

**What I'd actually recommend starting with, since it's real and available today with the least friction:**
- **Coinbase Commerce** (crypto) — already coded (`src/lib/payments/coinbase.ts`), non-custodial-ish, sidesteps card-network restrictions entirely. Many research-chemical sellers lean on crypto for exactly this reason.
- **The built-in P2P rails (Zelle / Venmo / wire)** — no processor account needed at all. Checkout shows payment instructions, the customer pays you directly, they upload proof, you approve it in `/admin` → P2P queue. Zero underwriting, works today, already fully wired end-to-end.
- **Card processing** — shop this specifically as "high-risk merchant account, research chemicals/nutraceutical vertical" once you're ready; the exact provider landscape shifts, so search current options rather than treating any one name (including the ones already coded) as pre-vetted. When you land one, tell me their real API docs and I'll adapt the matching adapter to their actual endpoints.

### 4. Shipping — USPS (optional but recommended)
Real, straightforward, government-run: [USPS Business/Developer Portal](https://developer.usps.com) — free to register, get API client credentials for rates/labels/tracking. Without it, shipping stays in MOCK (labels get a fake tracking number, nothing physically ships from an API call).

### 5. Transactional email — SendGrid (recommended)
[SendGrid](https://sendgrid.com) (Twilio) — free tier covers low volume. After signup, verify a sending domain (SPF/DKIM records on your domain) or order confirmations will land in spam. Powers order confirmations, shipment tracking, password resets.

### 6. Marketing email — Klaviyo (optional)
[Klaviyo](https://www.klaviyo.com) — free tier for a small list. Powers the welcome series, abandoned-cart flows, and promotional blasts already built into `/admin` → Email. Skip it if you don't want marketing automation yet; nothing else depends on it.

### 7. File storage — Vercel Blob (recommended if hosting on Vercel)
No separate account — enabled directly from your Vercel project dashboard (Storage → Create → Blob). Needed so COAs/receipts persist across deploys; the local `/public/uploads` fallback does **not** survive a redeploy.

### 8. Domain name (required to look real)
Any registrar — Cloudflare Registrar, Namecheap, Google Domains' successor — then point it at Vercel (§7 below).

### 9. LegitScript certification (optional, but built into your admin dashboard)
`/admin` → Compliance already tracks a LegitScript-readiness checklist. [LegitScript](https://www.legitscript.com) certification is a real, recognized credential in exactly this industry — it's often what actually unlocks approval from high-risk payment processors and ad platforms for research-chemical merchants. Not required to launch, but worth knowing it exists before you're stuck explaining your business model to underwriters from scratch.

**Suggested order to tackle these:** Database + Hosting + Domain first (get something live), then P2P + Coinbase Commerce (start taking real payments with zero underwriting wait), then SendGrid (customers expect confirmation emails), then pursue a real high-risk card processor and USPS in parallel (both involve waiting on someone else's approval process), then Klaviyo and LegitScript last since neither blocks launch.

---

## 1. Database (Neon or Supabase)

1. Create a new project in [Neon](https://neon.tech) or [Supabase](https://supabase.com).
2. Grab **two** connection strings:
   - **Pooled** connection (for app runtime, PgBouncer/pgbouncer-style pooling) → `DATABASE_URL`
   - **Direct** (non-pooled) connection (required for `prisma migrate`) → `DIRECT_URL`
   - Neon: Dashboard → Connection Details → toggle "Pooled connection" on/off for each string.
   - Supabase: Project Settings → Database → use the "Transaction" pooler URL for `DATABASE_URL` and the "Session"/direct URL for `DIRECT_URL`.
3. Confirm `prisma/schema.prisma` already declares both:
   ```prisma
   datasource db {
     provider  = "postgresql"
     url       = env("DATABASE_URL")
     directUrl = env("DIRECT_URL")
   }
   ```

## 2. Environment Variables

Set every variable from `.env.example` in Vercel → Project → Settings → Environment Variables (Production **and** Preview). Group them like this:

**Core / Database**
- `DATABASE_URL`, `DIRECT_URL`

**Auth.js**
- `AUTH_SECRET` (and `NEXTAUTH_SECRET` — set both to the same value for compatibility)
- `NEXTAUTH_URL` → your production URL, e.g. `https://elevatebiolabs.com`
- `AUTH_TRUST_HOST="true"`
- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` (optional — omit to disable Google sign-in)

**Vercel Cron**
- `CRON_SECRET` — required for `/api/cron/sync-tracking` and `/api/cron/p2p-email-sync`. Generate with the same `openssl` command below and set it on the Vercel project; Vercel sends it as `Authorization: Bearer $CRON_SECRET` on cron invocations. Without it, production crons 401.
- Schedules in `vercel.json` are currently **once daily** (Hobby plan limit). For P2P email sync every 15 minutes / tracking every 6 hours, upgrade to **Vercel Pro** and restore the sub-daily expressions — Hobby rejects those deploys.

Generate secrets:
```bash
openssl rand -base64 32
```

**Compliance flags**
- `AGE_GATE_ENABLED="true"`, `MIN_AGE="21"`, `NEXT_PUBLIC_MIN_AGE="21"`, `NEXT_PUBLIC_SITE_URL`

**Payments** — set only the rails you're actually enabling; unset rails stay in MOCK mode automatically
- `NEXAPAY_API_KEY`, `NEXAPAY_SECRET`, `NEXAPAY_WEBHOOK_SECRET`, `NEXAPAY_BASE_URL`
- `SEAMLESSCHEX_API_KEY`, `SEAMLESSCHEX_WEBHOOK_SECRET`, `SEAMLESSCHEX_BASE_URL`
- `PAYRAM_API_KEY`, `PAYRAM_WEBHOOK_SECRET`, `PAYRAM_BASE_URL`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `COINBASE_COMMERCE_API_KEY`, `COINBASE_COMMERCE_WEBHOOK_SECRET`
- `P2P_ZELLE_HANDLE`, `P2P_VENMO_HANDLE`, `P2P_WIRE_INSTRUCTIONS` (display strings only — no keys)

**Shipping**
- `USPS_CLIENT_ID`, `USPS_CLIENT_SECRET`, `USPS_API_KEY`, `USPS_BASE_URL`
- `SHIP_FROM_NAME`, `SHIP_FROM_STREET`, `SHIP_FROM_CITY`, `SHIP_FROM_STATE`, `SHIP_FROM_ZIP`

**Email**
- `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `SENDGRID_FROM_NAME`
- `KLAVIYO_API_KEY`, `KLAVIYO_PUBLIC_KEY`, `KLAVIYO_LIST_ID`

**File storage**
- `BLOB_READ_WRITE_TOKEN`

Double-check every var name against `.env.example` before deploying — a typo silently leaves an adapter in MOCK mode in production.

## 3. Vercel Project Setup

1. Import the repo in Vercel (framework preset: Next.js).
2. Build command: default (`npm run build`, which runs `prisma generate && next build`).
3. Install command: default (`npm install`, which triggers `postinstall: prisma generate`).
4. Set the Node.js version to 18.x or later in Project Settings → General.
5. Add all environment variables from §2 before the first deploy (missing `DATABASE_URL` will fail the build at `prisma generate`/connection time).

## 4. Database Migrations in Production

Do **not** run `prisma migrate dev` against production — it's interactive and can prompt for destructive resets. Use:

```bash
npx prisma migrate deploy
```

Options, in order of recommendation:

- **Vercel Build Command override**: `prisma migrate deploy && prisma generate && next build` — runs migrations on every deploy. Requires `DIRECT_URL` to be reachable from the Vercel build environment.
- **CI step**: run `npx prisma migrate deploy` in a GitHub Actions job (or similar) against the production `DIRECT_URL` before/after deploy, gated by a manual approval for safety.
- **Manual**: run locally with production env vars loaded (`.env.production`) right before flipping traffic.

## 5. Seeding Production Data

`npm run db:seed` (→ `prisma/seed.ts`) is written to be idempotent (`upsert` on unique keys), so it's safe to run against production, but it **creates the default admin account** (`admin@elevatebiolab.com` / `Admin123!change-me`), 6 categories, and 17 sample peptides (10 with product photos, all with sample COAs).

For a real launch:
1. Either edit `prisma/seed.ts` to point at real product data / a real admin email before running it in production, **or**
2. Run it once for scaffolding (categories, compliance docs, an initial admin), then **immediately change the admin password** and replace/remove the sample products through `/admin`.

Never leave `Admin123!change-me` active on a publicly reachable deployment.

## 6. Webhook Configuration

Every payment rail posts to the same route, keyed by a path segment:

```
POST https://<your-domain>/api/webhooks/payment/{rail}
```

| Rail | Webhook URL | Where to paste the signing secret |
|---|---|---|
| NexaPay | `/api/webhooks/payment/nexapay` | NexaPay dashboard → Webhooks → paste into `NEXAPAY_WEBHOOK_SECRET` |
| Stripe | `/api/webhooks/payment/stripe` | Stripe Dashboard → Developers → Webhooks → Add endpoint → copy signing secret into `STRIPE_WEBHOOK_SECRET` |
| Coinbase Commerce | `/api/webhooks/payment/coinbase` | Coinbase Commerce → Settings → Webhook subscriptions → copy shared secret into `COINBASE_COMMERCE_WEBHOOK_SECRET` |
| SeamlessChex/AllayPay | `/api/webhooks/payment/seamlesschex` | Provider dashboard → Webhooks → paste into `SEAMLESSCHEX_WEBHOOK_SECRET` |
| PayRam | `/api/webhooks/payment/payram` | Provider dashboard → Webhooks → paste into `PAYRAM_WEBHOOK_SECRET` |
| NOWPayments (crypto) | `/api/webhooks/payment/nowpayments` | NOWPayments dashboard → Payment Settings → generate **IPN Secret** → `NOWPAYMENTS_WEBHOOK_SECRET`. Also set the IPN callback URL (or rely on `ipn_callback_url` sent at invoice create). |
| P2P (Zelle/Venmo/Wire) | *(none — manual approval flow)* | n/a |

After registering each webhook in the provider's dashboard, send a **test event** from that dashboard and confirm:
1. The route returns `200`.
2. A `Payment` row updates to `SUCCEEDED`/`FAILED` as expected.
3. `Order.status` transitions correctly and stock decrements exactly once (idempotency — replays of the same event must not double-decrement).

For simulating a rail's webhook locally against MOCK data (no real provider needed), see [Local Development & Testing](#local-development--testing) above — the NexaPay curl example there generalizes to the other rails by swapping the mock `providerRef` prefix (see each adapter under `src/lib/payments/`).

## 7. Domain & URLs

1. Add your custom domain in Vercel → Project → Domains.
2. Set:
   - `NEXTAUTH_URL="https://elevatebiolabs.com"`
   - `NEXT_PUBLIC_SITE_URL="https://elevatebiolabs.com"`
3. If using Google OAuth, add the production redirect URI (`https://elevatebiolabs.com/api/auth/callback/google`) in the Google Cloud Console credentials.
4. Re-deploy after changing any `NEXT_PUBLIC_*` variable (these are inlined at build time).

## 8. Enabling Vercel Blob

1. Vercel → Project → Storage → Create → Blob.
2. Copy the generated `BLOB_READ_WRITE_TOKEN` into your environment variables.
3. Install the SDK: `npm i @vercel/blob`.
4. In `src/lib/storage.ts`, uncomment the Vercel Blob block inside `uploadFile()` (currently commented out pending the package install) so COAs/receipts/invoices upload to Blob instead of falling through to `/public/uploads`.
5. Re-deploy. `isConfigured.blob()` will now return `true` and the app switches automatically — no other code changes needed.

## 9. Switching an Adapter from MOCK to LIVE

Every integration in this codebase follows the same pattern: `isConfigured.<name>()` in `src/lib/env.ts` checks whether the required keys are present, and each adapter branches on that at the top of its functions. To go live for any one of them:

1. **Obtain real credentials** from the provider — their dashboard's API/developer settings page; exact steps vary by provider and aren't documented in this repo.
2. **Set the env vars** in Vercel (Production scope at minimum; Preview if you want staging to also hit the real sandbox).
3. **Register the webhook** (payment rails) pointing at `/api/webhooks/payment/{rail}`, and copy the signing secret back into the matching `*_WEBHOOK_SECRET` var.
4. **Redeploy** — no code changes are required. `isConfigured.<name>()` flips to `true` automatically and the adapter starts making real API calls instead of returning mocked data.
5. **Run one test transaction** end-to-end per rail before announcing it live (see the Pre-Launch Checklist below).
6. **Roll back safely**: if a provider misbehaves, simply unset its env vars and redeploy — the app falls back to MOCK for that rail without any other code path changing, so you can pull a broken rail out of rotation instantly (`PAYMENT_RAIL_META` still lists it, so also hide it from the checkout rail-picker UI if you want it visually gone, not just non-functional).

## 10. Pre-Launch Checklist

- [ ] RUO disclaimers rendered on home, product, cart, and checkout pages (backed by `ComplianceDoc` slug `ruo-policy`)
- [ ] Age gate (`AGE_GATE_ENABLED="true"`) confirmed live in production
- [ ] GDPR cookie consent banner shown before non-essential cookies fire
- [ ] COAs uploaded for every active product (via `/admin` → Product → COA)
- [ ] One successful **test order** completed per enabled payment rail (see §6 Webhook Configuration above)
- [ ] USPS `SHIP_FROM_*` address set and verified (`getRates`/`createLabel` tested against a real destination)
- [ ] Chargeback monitoring on — `ChargebackMetric` rows populating, dashboard visible to admin, alert threshold set at the 2026 Visa VAMP 1.5% ratio
- [ ] Database backups enabled (Neon: automatic point-in-time restore; Supabase: enable daily backups in project settings)
- [ ] Default admin password rotated away from `Admin123!change-me`
- [ ] `AUTH_SECRET` is a unique, freshly generated value (not reused from `.env.example` or a dev environment)

## Go-Live Checklist

- [ ] Database provisioned (Neon/Supabase), `DATABASE_URL` + `DIRECT_URL` set
- [ ] `prisma migrate deploy` run successfully against production
- [ ] Production seed run (or real catalog/admin data loaded manually)
- [ ] All required env vars set in Vercel (Production scope)
- [ ] `AUTH_SECRET` generated fresh via `openssl rand -base64 32` (never `"dev-secret"` — production boot rejects that fallback)
- [ ] `CRON_SECRET` set in Vercel (Production) so scheduled cron routes authorize
- [ ] Domain attached, `NEXTAUTH_URL` and `NEXT_PUBLIC_SITE_URL` match it exactly (https, no trailing slash)
- [ ] Each enabled payment rail: keys set, webhook registered, signing secret pasted, one test transaction verified
- [ ] USPS credentials set (or explicitly deferred, running shipping in MOCK)
- [ ] SendGrid sending domain verified; test order-confirmation email delivered
- [ ] Klaviyo list/public key set; test welcome-flow event received
- [ ] Vercel Blob enabled (or explicitly deferred, running storage in local-fallback mode — **not recommended for production**, since `/public/uploads` doesn't persist across deploys)
- [ ] Pre-launch compliance checklist (§10) fully checked
- [ ] Rollback plan understood: any single adapter can be pulled back to MOCK by unsetting its env vars and redeploying
