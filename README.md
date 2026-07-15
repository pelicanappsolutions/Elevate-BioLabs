# Elevate Bio-Labs

A production-grade Next.js 14 e-commerce platform for research peptides — catalog, cart, multi-rail checkout, inventory with optimistic locking, USPS shipping, transactional + marketing email, batch/COA verification, and a full admin back office.

> **⚠️ FOR RESEARCH USE ONLY (RUO)**
> All products listed on this platform are intended **strictly for laboratory and in-vitro research use**. They are **not drugs, foods, cosmetics, or dietary supplements**, are **not FDA-approved** for the diagnosis, treatment, cure, mitigation, or prevention of any disease, and are **not for human or veterinary consumption**. Purchasers must certify they are 18+ and qualified researchers. See `/compliance` for the full policy rendered in-app, plus the age gate and cookie consent enforced site-wide.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [NPM Scripts](#npm-scripts)
- [Pages & Routes](#pages--routes)
- [How Checkout Connects](#how-checkout-connects)
- [Security Notes](#security-notes)
- [Further Reading](#further-reading)

---

## Features

- Product catalog (17 seeded compounds across 6 categories) with bulk price tiers, real product photography, filters, sort, and pagination
- Product detail pages: image gallery, CAS/purity/molar-mass specs, reconstitution dosage calculator, bulk pricing, related products
- Standalone **batch/COA verification** (`/verify-coa`) and a full **certificate archive** (`/certificates`) — search by batch/lot number or compound name
- Cart with offline persistence (Zustand + localStorage) that survives refreshes and network loss, with swipe-to-remove on mobile
- Multi-rail checkout: card (NexaPay), ACH (SeamlessChex), crypto (Coinbase), and manual P2P (Zelle/Venmo/Wire) with proof-of-payment upload
- Optimistic-locked inventory (`Product.version`) — verified under concurrent load, never oversells
- Server-authoritative pricing (bulk tiers + destination sales tax); the client cart price is never trusted
- USPS live rates, label purchase, and tracking, with a full mock fallback for local dev
- Transactional email (order confirmation, shipment tracking, password reset) via SendGrid; marketing automation via Klaviyo
- Auth.js v5 (Credentials + optional Google OAuth), JWT sessions, split Edge-safe/Node auth config, role-gated `/admin` and `/dashboard`
- Admin console: product CRUD (with photo upload), inventory adjustments, order management, P2P receipt approval, COA upload, email campaigns, compliance/LegitScript readiness dashboard (read-only reporting — no doc editor yet)
- Compliance module: RUO disclaimers, 18+ age gate, cookie consent, LegitScript-readiness copy
- Mock-by-default integrations — every third-party service (payments, shipping, email, storage) auto-detects missing credentials and falls back to a realistic mock, so the entire app — including checkout — runs locally with **zero external accounts**

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router), TypeScript (strict) |
| Styling / UI | Tailwind CSS, shadcn/ui (Radix primitives) — light theme, blue brand accent |
| Client state | Zustand (`persist` middleware → localStorage) |
| Database | PostgreSQL (Neon, Supabase, or local Docker) |
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
│  ├─ schema.prisma          # User, Order, Product(+version), Category, ProductImage,
│  │                         # PriceTier, COA, Address, DosageLog, SavedProduct,
│  │                         # InventoryLog, ComplianceDoc, and payment/shipping models
│  └─ seed.ts                # admin user, 6 categories, 17 products (10 with real photos), COAs
│
├─ src/
│  ├─ app/                              # App Router
│  │  ├─ page.tsx                       # landing: hero, stats, how-it-works, featured products
│  │  ├─ products/                      # catalog (filters/sort/pagination) + [slug] detail page
│  │  ├─ cart/, checkout/                # cart + 4-step multi-rail checkout flow
│  │  ├─ verify-coa/, certificates/      # batch/COA lookup + full certificate archive
│  │  ├─ login/, register/               # split-screen auth pages (auth-split-layout.tsx)
│  │  ├─ dashboard/                      # customer account area (orders, dosage log, addresses)
│  │  ├─ admin/                          # admin console (role: ADMIN, middleware-guarded)
│  │  ├─ compliance/                     # RUO policy, shipping/refund policy, about, contact
│  │  ├─ api/
│  │  │  ├─ auth/[...nextauth]/route.ts # Auth.js handler
│  │  │  └─ webhooks/payment/[rail]/route.ts
│  │  └─ layout.tsx / providers.tsx / globals.css
│  │
│  ├─ components/
│  │  ├─ ui/                # shadcn/ui primitives (button, card, dialog, sheet, tabs, toast, ...)
│  │  ├─ auth/               # login/register forms, auth-split-layout.tsx
│  │  ├─ products/           # gallery, filters, add-to-cart, dosage calculator
│  │  ├─ cart/               # swipe-to-remove line items, sticky checkout CTA
│  │  ├─ checkout/           # step flow, payment rail selector, P2P proof upload
│  │  ├─ dashboard/          # order history, dosage log, address book
│  │  ├─ admin/              # products, orders, receipt queue, COA uploader
│  │  ├─ compliance/         # batch lookup (with suggestion chips), contact form
│  │  ├─ navbar.tsx / footer.tsx / age-gate.tsx / cookie-consent.tsx
│  │
│  ├─ lib/
│  │  ├─ payments/           # index.ts (router), meta.ts (client-safe), per-rail adapters
│  │  ├─ shipping/usps.ts    # OAuth2 token cache, getRates, createLabel, getTracking (+ MOCK)
│  │  ├─ email/              # sendgrid.ts, klaviyo.ts, index.ts facade
│  │  ├─ auth.ts / auth.config.ts   # Node config + Edge-safe JWT/session config
│  │  ├─ db.ts, env.ts, utils.ts, validations.ts, inventory.ts, pricing.ts, rate-limit.ts, storage.ts
│  │
│  ├─ actions/               # Server Actions: auth, checkout, coa, dashboard, admin, newsletter
│  ├─ store/cart.ts          # Zustand cart, persist(localStorage)
│  └─ middleware.ts          # Edge-safe auth guard for /admin and /dashboard
│
├─ public/
│  ├─ manifest.json
│  └─ images/products/       # real product photography (10 vials)
│
├─ .env.example
├─ README.md / DEPLOYMENT.md / PROJECT_CONTEXT.md
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

# 4. Seed sample data (admin user, 6 categories, 17 products, COAs, compliance docs)
npm run db:seed

# 5. Run the dev server
npm run dev
```

App runs at `http://localhost:3000`.

> **Port already in use?** If something else is already running on 3000, start on another port
> (`npm run dev -- -p 3001`) and update `NEXTAUTH_URL` / `NEXT_PUBLIC_SITE_URL` in `.env` to match
> — Auth.js redirects (login, OAuth callback) use that value and will send you to the wrong port
> if it's stale.

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

**Production build**

```bash
npm run build   # prisma generate && next build
npm run start   # serve the production build
```

If you've been running a dev server on the same port, stop it first — Next.js won't warn you if
a stale process is still holding the port; it'll just silently keep serving the old build.

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

## Pages & Routes

| Route | Description |
|---|---|
| `/` | Landing page — hero, trust badges, stats, how-it-works, featured products, newsletter |
| `/products` | Catalog — filter by category/form/price/stock, sort, paginate |
| `/products/[slug]` | Product detail — gallery, specs, COA, dosage calculator, bulk tiers |
| `/cart` | Cart — swipe-to-remove, order summary |
| `/checkout` | 4-step checkout — address → delivery → payment rail → review |
| `/checkout/success` | Order confirmation + payment instructions |
| `/verify-coa` | Search a batch/lot number or compound name for its Certificate of Analysis |
| `/certificates` | Full archive of every published COA |
| `/login`, `/register` | Split-screen auth pages |
| `/dashboard` | Customer account — orders, tracking, saved products, dosage log, addresses (auth required) |
| `/admin` | Admin console — products, orders, P2P queue, COAs, email, compliance (ADMIN role required) |
| `/compliance` | RUO policy, shipping/refund policy, about, contact form |

## How Checkout Connects

```
Frontend (App Router + Zustand cart)
   │  checkout (Server Action)
   ▼
src/actions/checkout.ts
   priceCart() [server-authoritative bulk tiers + tax]
   → createCharge() via src/lib/payments/{rail}.ts adapter
   → Order + Payment row created
   ▼
customer pays externally (card/ACH/crypto) or follows P2P instructions
   ▼
POST /api/webhooks/payment/{rail}
   verifyWebhook() — signature check before any DB write
   → Order.status / Payment.status updated
   → decrementStock() — optimistic locking via Product.version
   → sendTransactional("ORDER_CONFIRMATION") via SendGrid
```

**P2P (Zelle / Venmo / Wire)** has no webhook — approval is manual:

```
checkout selects P2P rail → Order created PENDING_PAYMENT, instructions shown (handle + memo)
customer sends funds externally, then uploads a screenshot/receipt (src/actions/proof.ts)
admin reviews the receipt queue in /admin
   → approves → decrementStock() → Order.status = PAID → confirmation email sent
```

## Security Notes

- **Input validation** — all Server Action and API inputs are parsed with Zod schemas (`src/lib/validations.ts`) before touching the DB.
- **Rate limiting** — `src/lib/rate-limit.ts` sliding-window limiter guards auth and the public batch/COA lookup; swap the in-memory `Map` for Upstash Redis when running multi-region.
- **Webhook signature verification** — every payment webhook is verified against its provider's signing secret before any DB write; invalid signatures short-circuit with a 400 and touch nothing.
- **Optimistic locking** — inventory decrements are guarded by `Product.version` (`src/lib/inventory.ts`); a lost race retries against fresh data instead of overselling.
- **Auth** — bcrypt-hashed passwords, JWT sessions, middleware-enforced role gates on `/admin` (ADMIN only) and `/dashboard` (any authenticated user). Auth config is split (`auth.ts` for Node/bcrypt, `auth.config.ts` for the Edge-safe middleware) so bcrypt never gets bundled into the Edge Runtime.
- **Compliance-as-code** — RUO disclaimers and the 18+ age gate are enforced site-wide, cookie consent is shown before non-essential cookies fire.
- **Secrets hygiene** — `.env` is git-ignored; `.env.example` documents every variable without values; MOCK mode means local dev never needs real secrets at all.

## Further Reading

- [`DEPLOYMENT.md`](./DEPLOYMENT.md) — Vercel + Neon/Supabase deployment checklist, env var setup, webhook configuration, go-live checklist
- [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) — full build history, schema reference, and the infrastructure-ownership handoff model for client work
