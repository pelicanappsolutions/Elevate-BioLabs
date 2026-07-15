# Elevate Bio-Labs

A production-grade Next.js 14 e-commerce platform for research peptides — catalog, cart, multi-rail checkout, inventory with optimistic locking, USPS shipping, transactional + marketing email, and an admin back office.

> **⚠️ FOR RESEARCH USE ONLY (RUO)**
> All products listed on this platform are intended **strictly for laboratory and in-vitro research use**. They are **not drugs, foods, cosmetics, or dietary supplements**, are **not FDA-approved** for the diagnosis, treatment, cure, mitigation, or prevention of any disease, and are **not for human or veterinary consumption**. Purchasers must certify they are 18+ and qualified researchers. See `ComplianceDoc` (slug `ruo-policy`) for the full policy rendered in-app, plus the age gate and GDPR cookie consent enforced site-wide.

---

## Table of Contents

- [Value Proposition](#value-proposition)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [NPM Scripts](#npm-scripts)
- [How It All Connects](#how-it-all-connects)
- [Security Notes](#security-notes)
- [Further Reading](#further-reading)

---

## Value Proposition

Elevate Bio-Labs is a batteries-included storefront built for a category (research peptides) with unusual operational demands: fragile card-processing relationships, chargeback-ratio sensitivity, batch/lot traceability, and a hard compliance layer. It solves this with:

- A **swappable payment adapter pattern** so the business can add/drop high-risk-friendly rails (crypto, ACH, P2P) without touching checkout code.
- **Optimistic-locked inventory** so concurrent checkouts never oversell.
- **Mock-by-default integrations** — every third-party service (payments, shipping, email, storage) auto-detects missing credentials and falls back to a realistic mock, so the entire app — including checkout — runs locally with **zero external accounts**.
- A compliance layer (RUO disclaimers, age gate, COA/batch tracking, chargeback-ratio monitoring) built in as first-class data models, not an afterthought.

## Features

- Product catalog with categories, bulk price tiers, product images, and per-batch Certificates of Analysis (COA)
- Cart with offline persistence (Zustand + localStorage) that survives refreshes and network loss
- Multi-rail checkout: card, ACH, crypto, and manual P2P (Zelle/Venmo/Wire) with proof-of-payment upload
- Optimistic-locked inventory (no overselling under concurrent checkouts)
- Server-authoritative pricing (bulk tiers + destination sales tax — client cart prices are never trusted)
- USPS live rates, label purchase, and tracking (OAuth2 client-credentials), with a full mock fallback
- Transactional email (order confirmation, shipment tracking, password reset, welcome) via SendGrid
- Marketing automation (welcome series, abandoned cart 24h/48h, post-purchase review, promotions) via Klaviyo
- Auth.js v5 (Credentials + optional Google OAuth), JWT sessions, role-gated `/admin` and `/dashboard`
- Admin console: order management, P2P proof-of-payment approval, inventory adjustments, COA uploads
- Compliance module: RUO disclaimers, 18+ age gate, GDPR cookie consent, LegitScript readiness, VAMP/chargeback-ratio tracking
- File storage via Vercel Blob (COAs, receipts, invoices) with a local `/public/uploads` dev fallback
- Dashboard tools for customers: saved products, dosage log, order/tracking history

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router), TypeScript (strict) |
| Styling / UI | Tailwind CSS, shadcn/ui (Radix primitives) |
| Client state | Zustand (`persist` middleware → localStorage) |
| Database | PostgreSQL (Neon or Supabase) |
| ORM | Prisma (with `Product.version` optimistic locking) |
| Auth | Auth.js / NextAuth v5 (beta) — Credentials (bcrypt) + optional Google OAuth, JWT sessions |
| Payments | Adapter pattern: NexaPay, SeamlessChex/AllayPay, PayRam, Stripe, Coinbase Commerce, P2P (Zelle/Venmo/Wire) |
| Shipping | USPS APIs v3 (OAuth2 client-credentials) |
| Transactional email | SendGrid |
| Marketing email | Klaviyo |
| File storage | Vercel Blob (dev fallback: `/public/uploads`) |
| Validation | Zod |
| Hosting | Vercel; Postgres via Neon or Supabase |

## Project Structure

```
elevate-bio-labs/
├─ prisma/
│  ├─ schema.prisma          # User, Account, Session, VerificationToken, Address,
│  │                         # Category, Product(+version), ProductImage, PriceTier,
│  │                         # COA, Order, OrderItem, Payment, PaymentReceipt,
│  │                         # InventoryLog, SavedProduct, DosageLog, AuditLog,
│  │                         # CampaignEvent, ComplianceDoc, ChargebackMetric
│  └─ seed.ts                # admin user, 4 categories, 8 peptides w/ tiers+COAs, compliance docs
│
├─ src/
│  ├─ app/                                    # App Router
│  │  ├─ (marketing)/                         # landing, category, product detail pages
│  │  ├─ (shop)/cart/, checkout/              # cart + multi-rail checkout flow
│  │  ├─ dashboard/                           # customer account area (role: CUSTOMER+)
│  │  ├─ admin/                               # admin console (role: ADMIN, middleware-guarded)
│  │  ├─ api/
│  │  │  ├─ auth/[...nextauth]/route.ts       # Auth.js handler
│  │  │  └─ webhooks/payment/[rail]/route.ts  # single payment webhook endpoint (all rails)
│  │  ├─ layout.tsx / providers.tsx / globals.css
│  │
│  ├─ components/
│  │  ├─ ui/            # shadcn/ui primitives (button, card, dialog, sheet, tabs, toast, ...)
│  │  ├─ landing/        # hero, trust badges, featured products
│  │  ├─ catalog/        # category grid, filters (Sheet on mobile), product cards
│  │  ├─ product/        # gallery, price tiers, COA viewer, dosage calculator
│  │  ├─ cart/           # cart drawer, line items, sticky mobile CTA
│  │  ├─ checkout/       # address form, rail selector, P2P proof upload
│  │  ├─ dashboard/      # order history, saved products, dosage log
│  │  ├─ admin/          # order table, receipt approval, inventory, COA upload
│  │  └─ compliance/     # RUO banner, age gate modal, cookie consent
│  │
│  ├─ lib/
│  │  ├─ payments/       # types.ts, index.ts (router: getAdapter/verifyWebhook),
│  │  │                  # nexapay.ts, seamlesschex.ts, payram.ts, stripe.ts, coinbase.ts, p2p.ts
│  │  ├─ shipping/
│  │  │  └─ usps.ts      # OAuth2 token cache, getRates, createLabel, getTracking (+ MOCK)
│  │  ├─ email/
│  │  │  ├─ index.ts     # facade: sendTransactional, trackMarketing, subscribeNewsletter
│  │  │  ├─ sendgrid.ts  # transactional templates + send
│  │  │  └─ klaviyo.ts   # events + list subscription
│  │  ├─ db.ts           # Prisma client singleton
│  │  ├─ auth.ts         # NextAuth() config — providers, JWT callbacks
│  │  ├─ env.ts          # centralized env access + isConfigured.* (MOCK/LIVE detection)
│  │  ├─ utils.ts        # cn(), resolveUnitPrice(), formatting helpers
│  │  ├─ validations.ts  # Zod schemas (login, checkout, admin forms, ...)
│  │  ├─ inventory.ts    # decrementStock() / adjustStock() — optimistic locking
│  │  ├─ pricing.ts      # priceCart() — server-authoritative tiers + tax
│  │  ├─ rate-limit.ts   # sliding-window limiter (swap-in for Upstash Redis in prod)
│  │  └─ storage.ts      # uploadFile() — Vercel Blob or local /public/uploads
│  │
│  ├─ actions/           # Server Actions (mutations)
│  │  ├─ auth.ts         # register, login, password reset
│  │  ├─ checkout.ts     # priceCart → createCharge → create Order/Payment
│  │  ├─ proof.ts        # P2P proof-of-payment upload
│  │  ├─ admin.ts        # order status, receipt approval, inventory, COA upload
│  │  ├─ dashboard.ts    # saved products, dosage log entries
│  │  └─ newsletter.ts   # subscribeNewsletter()
│  │
│  ├─ store/
│  │  └─ cart.ts         # useCart — Zustand + persist(localStorage), offline-safe
│  │
│  └─ middleware.ts       # guards /admin (role=ADMIN) and /dashboard via Auth.js
│
├─ public/
│  ├─ manifest.json       # PWA manifest
│  └─ uploads/            # local dev fallback for Blob storage
│
├─ docs/
│  └─ MOBILE.md
├─ .env.example
├─ README.md / DEPLOYMENT.md / CONNECTIONS.md
└─ package.json / tsconfig.json / tailwind.config.ts / next.config.mjs
```

## Quick Start

**Prerequisites**

- Node.js 18.18+ (repo `engines` requires it)
- A PostgreSQL database — [Neon](https://neon.tech) or [Supabase](https://supabase.com) both work (pooled + direct URLs), or Docker for a local one (below)
- No third-party API keys required to run locally — every integration falls back to MOCK mode

**Setup**

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Fill in at minimum: DATABASE_URL, DIRECT_URL, AUTH_SECRET (openssl rand -base64 32)

# 3. Create the schema
npx prisma migrate dev

# 4. Seed sample data (admin user, categories, 8 peptides, compliance docs)
npm run db:seed

# 5. Run the dev server
npm run dev
```

App runs at `http://localhost:3000`.

**Option: local Postgres via Docker**

If you'd rather not sign up for a hosted database to develop against:

```bash
docker run -d --name ebl-postgres \
  -e POSTGRES_USER=ebl -e POSTGRES_PASSWORD=ebl -e POSTGRES_DB=elevate \
  -p 55432:5432 postgres:16-alpine
```

Then set both URLs in `.env` (port 55432 avoids clashing with any Postgres already on 5432):

```
DATABASE_URL="postgresql://ebl:ebl@localhost:55432/elevate?schema=public"
DIRECT_URL="postgresql://ebl:ebl@localhost:55432/elevate?schema=public"
```

Run `npx prisma migrate dev && npm run db:seed` against it as above. Stop or restart the
container any time with `docker stop ebl-postgres` / `docker start ebl-postgres` — data
persists in the container's volume.

**Seeded admin login**

| Field | Value |
|---|---|
| Email | `admin@elevatebiolabs.com` |
| Password | `Admin123!change-me` |

> Change this password (or the seed script) before deploying anywhere reachable by the public.

## NPM Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | `prisma generate && next build` — production build |
| `npm run start` | Start production server (after `build`) |
| `npm run lint` | ESLint (`next lint`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run prisma:generate` | Regenerate the Prisma Client |
| `npm run prisma:migrate` | Create/apply a dev migration (`prisma migrate dev`) |
| `npm run prisma:deploy` | Apply pending migrations in prod (`prisma migrate deploy`) |
| `npm run prisma:studio` | Open Prisma Studio (DB GUI) |
| `npm run db:seed` | Run `prisma/seed.ts` |
| `postinstall` | Auto-runs `prisma generate` after `npm install` |

## How It All Connects

```
┌─────────────┐      Server Actions / Server Components      ┌──────────────────┐
│  Frontend    │ ───────────────────────────────────────────▶ │  Prisma  ↔  DB   │
│ App Router   │ ◀─────────────────────────────────────────── │  (PostgreSQL)    │
│ + Zustand    │              read models directly            └──────────────────┘
└──────┬───────┘
       │ checkout (Server Action)
       ▼
┌────────────────────┐   createCharge()   ┌───────────────────────────────┐
│ src/actions/        │ ─────────────────▶ │ Payment Gateway (adapter)      │
│ checkout.ts         │                     │ NexaPay / SeamlessChex /       │
│  priceCart() →       │                     │ PayRam / Stripe / Coinbase /   │
│  Order+Payment(INITIATED)                  │ P2P (Zelle/Venmo/Wire)        │
└────────────────────┘                     └───────────────┬───────────────┘
                                                             │ redirect / instructions
                                                             ▼
                                                   customer pays externally
                                                             │
                                                             ▼
                                        POST /api/webhooks/payment/{rail}
                                                             │ verifyWebhook() — signature check
                                                             ▼
                                    ┌───────────────────────────────────────────┐
                                    │ Update Payment.status + Order.status       │
                                    │ decrementStock() — OPTIMISTIC LOCKING       │
                                    │   (Product.version guards the race)         │
                                    │ sendTransactional("ORDER_CONFIRMATION")     │
                                    └───────────────────────┬─────────────────────┘
                                                             │ (idempotent, retry-safe)
                                                             ▼
                                                   ┌───────────────────┐
                                                   │ SendGrid           │
                                                   │ (transactional)    │
                                                   └───────────────────┘

Admin fulfillment:
  admin action → USPS getRates()/createLabel() → trackingNumber+labelUrl saved to Order
                → sendTransactional("SHIPMENT_TRACKING")

Marketing (async, non-blocking):
  order events → trackMarketing() → Klaviyo (abandoned cart, post-purchase review, promos)
                → CampaignEvent row logged
```

**P2P (Zelle / Venmo / Wire) flow** — no webhook exists for these rails; approval is manual:

```
checkout selects P2P rail
   → p2pAdapter.createCharge() returns { instructions: { handle, memo, note } }, status=MANUAL_REVIEW
   → Order created as PENDING_PAYMENT, Payment as MANUAL_REVIEW
customer sends funds externally, then uploads proof
   → src/actions/proof.ts → storage.uploadFile() (Vercel Blob / local) → PaymentReceipt row
admin reviews in /admin
   → src/actions/admin.ts approves receipt → PaymentReceipt.approved=true
   → decrementStock() (optimistic locking) → Order.status=PAID
   → sendTransactional("ORDER_CONFIRMATION")
   → AuditLog row records the approval (who, when, order)
```

## Security Notes

- **Input validation** — all Server Action and API inputs are parsed with Zod schemas (`src/lib/validations.ts`) before touching the DB.
- **Rate limiting** — `src/lib/rate-limit.ts` sliding-window limiter guards auth (login/register) and payment-initiation endpoints; swap the in-memory `Map` for Upstash Redis when running multi-region.
- **Webhook signature verification** — every payment webhook is verified against its provider's signing secret in the adapter's `verifyAndParse()` before any DB write; invalid signatures short-circuit with a 400 and touch nothing.
- **Optimistic locking** — inventory decrements are guarded by `Product.version` (`src/lib/inventory.ts`); a lost race retries against fresh data instead of overselling or table-locking.
- **Auth** — bcrypt-hashed passwords, JWT sessions, middleware-enforced role gates on `/admin` (ADMIN only) and `/dashboard` (any authenticated user).
- **Compliance-as-code** — RUO disclaimers and the 18+ age gate are enforced site-wide (`AGE_GATE_ENABLED`), GDPR cookie consent is shown before non-essential cookies fire, and `ChargebackMetric` tracks each rail against the 2026 Visa VAMP 1.5% threshold.
- **Secrets hygiene** — `.env` is git-ignored; `.env.example` documents every variable without values; MOCK mode means local dev never needs real secrets at all.

## Further Reading

- [`DEPLOYMENT.md`](./DEPLOYMENT.md) — Vercel + Neon/Supabase deployment checklist, env var setup, webhook configuration, go-live checklist
- [`CONNECTIONS.md`](./CONNECTIONS.md) — per-integration setup, MOCK→LIVE switch, and testing instructions
- [`docs/MOBILE.md`](./docs/MOBILE.md) — mobile/web performance and UX implementation notes
