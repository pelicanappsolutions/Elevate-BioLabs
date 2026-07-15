# Deployment Guide — Vercel + Neon/Supabase

This project runs fully in MOCK mode with zero external accounts, so you can deploy a working demo before wiring up a single real provider. This guide walks through a full production deployment, provider by provider, plus a go-live checklist.

## Table of Contents

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

Generate the secret:
```bash
openssl rand -base64 32
```

**Compliance flags**
- `AGE_GATE_ENABLED="true"`, `MIN_AGE="18"`, `NEXT_PUBLIC_SITE_URL`

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

`npm run db:seed` (→ `prisma/seed.ts`) is written to be idempotent (`upsert` on unique keys), so it's safe to run against production, but it **creates the default admin account** (`admin@elevatebiolabs.com` / `Admin123!change-me`) and 8 sample peptides.

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
| P2P (Zelle/Venmo/Wire) | *(none — manual approval flow)* | n/a |

After registering each webhook in the provider's dashboard, send a **test event** from that dashboard and confirm:
1. The route returns `200`.
2. A `Payment` row updates to `SUCCEEDED`/`FAILED` as expected.
3. `Order.status` transitions correctly and stock decrements exactly once (idempotency — replays of the same event must not double-decrement).

See `CONNECTIONS.md` for provider-specific test payloads and curl examples.

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

1. **Obtain real credentials** from the provider (see `CONNECTIONS.md` for exactly where).
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
- [ ] One successful **test order** completed per enabled payment rail (see `CONNECTIONS.md` §Webhook testing)
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
- [ ] `AUTH_SECRET` generated fresh via `openssl rand -base64 32`
- [ ] Domain attached, `NEXTAUTH_URL` and `NEXT_PUBLIC_SITE_URL` match it exactly (https, no trailing slash)
- [ ] Each enabled payment rail: keys set, webhook registered, signing secret pasted, one test transaction verified
- [ ] USPS credentials set (or explicitly deferred, running shipping in MOCK)
- [ ] SendGrid sending domain verified; test order-confirmation email delivered
- [ ] Klaviyo list/public key set; test welcome-flow event received
- [ ] Vercel Blob enabled (or explicitly deferred, running storage in local-fallback mode — **not recommended for production**, since `/public/uploads` doesn't persist across deploys)
- [ ] Pre-launch compliance checklist (§10) fully checked
- [ ] Rollback plan understood: any single adapter can be pulled back to MOCK by unsetting its env vars and redeploying
