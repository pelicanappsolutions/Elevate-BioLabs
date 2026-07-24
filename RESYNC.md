# Project Resync — Elevate Bio-Labs Context Brief

**Start here when resuming work.** This document summarizes the project state, architecture, and key decisions so Claude can pick up where you left off without re-reading the entire codebase.

**Last updated:** 2026-07-21 (after dashboard build-out, require-account checkout, crypto reactivation, age-gate audit logging, and the compliance planning doc)

> ⚠️ **OPEN DECISION BLOCKING COMPLIANCE WORK:** Two legal guidance inputs conflict on the business model — **Path A (sell only to verified research institutions, IRB + chain-of-custody gate)** vs **Path B (sell to individuals as a lab-supply vendor, no gate, but hard RUO labeling + no claims + ≥98% third-party COAs)**. The institutional verification gate is Path-A-only and must NOT be built until counsel picks the path. Full analysis in [LEGAL_OPERATIONS.md](./LEGAL_OPERATIONS.md). **All compliance feature-building is PAUSED** per user until this is resolved.

---

## Project Overview

**Elevate Bio-Labs** is a full-stack e-commerce platform for research peptides and compounds, built with Next.js 14, Prisma ORM, PostgreSQL, and Auth.js v5.

**Core value prop:** Legitimate research chemical supplier with transparent testing (every batch has a third-party Certificate of Analysis uploaded + searchable), compliance-first (RUO disclaimers, age gates, LegitScript readiness tracker), and multi-rail payment processing (card, ACH, crypto, P2P).

**Live at:** http://localhost:3001 (dev), will be on Vercel + custom domain (production)  
**GitHub:** pelicanappsolutions/Elevate-BioLabs (private repo, main branch)

---

## Tech Stack & Architecture

| Layer | Tech |
|-------|------|
| **Frontend** | Next.js 14 App Router, React, TypeScript, Tailwind CSS, ShadCN UI |
| **Backend** | Next.js Server Components + Server Actions, Auth.js v5, Prisma ORM |
| **Database** | PostgreSQL (Neon/Supabase in production, local Docker in dev) |
| **Storage** | Local `/public/uploads` (dev), Vercel Blob (production) |
| **Auth** | Auth.js v5 (credentials + optional Google OAuth) |
| **Payments** | Adapter pattern: NexaPay, Stripe, Coinbase Commerce, SeamlessChex, PayRam, P2P (Zelle/Venmo/Wire) — all run in MOCK mode until credentials are set |
| **Shipping** | USPS API (MOCK mode if unconfigured) |
| **Email** | SendGrid (transactional), Klaviyo (marketing) — both MOCK if unconfigured |
| **Deployment** | Vercel (Next.js hosting) + Neon/Supabase (database) |

**Design system:** Custom CSS variables for theme (light/dark), primary color is blue (`217 91% 38%` HSL), ShadCN components for UI.

---

## Key Features (Completed)

### Customer-Facing
- **Homepage** — hero with product imagery, stats row (tested batches, 50+ compounds, ≥99% purity), "how it works" section, dark newsletter signup
- **Product catalog** (`/products`) — grid filterable by category, sort by price/name, real product photos
- **Product detail** — price tiers, reviews, RUO disclaimer, associated COAs searchable by batch
- **Cart & checkout** — multi-rail payment selector (card/ACH/crypto/P2P), address input, real-time shipping quote, tax calculation
- **COA verification** (`/verify-coa`) — search by batch/lot OR product name, suggestion chips, browse results, download PDFs
- **Certificate archive** (`/certificates`) — paginated list of all published COAs, newest first
- **Compliance page** (`/compliance`) — shipping policy, RUO info, refund policy, contact form anchor
- **Auth** (`/login`, `/register`) — split-screen design (dark brand panel + light form), remember-me checkbox on login
- **Customer dashboard** (`/dashboard`) — 5 tabs: Orders (history/tracking), Saved (wishlist), Dosage log, Addresses, Profile

### Admin Panel (`/admin`)
- **Products tab** — CRUD: edit name/price/stock/category/form/description, **upload/replace product photos**, restock via inventory dialog, deactivate (hides from catalog but visible in admin)
- **Orders tab** — filter by status, change status (PENDING_PAYMENT → PAID → PROCESSING → SHIPPED → DELIVERED, etc.), create USPS shipping label (real API in prod, fake tracking # in MOCK)
- **P2P queue tab** — approve or reject manual payments (Zelle/Venmo/wire), confirm order status updates
- **COAs tab** — upload PDF + metadata (product, batch/lot, purity %, test date), auto-links to product detail + `/certificates`
- **Email tab** — trigger manual "promotional blast" campaign to all customers (Klaviyo in prod, logged to console in MOCK)
- **Compliance tab** — read-only: chargeback ratio dashboard (Visa VAMP threshold tracker), LegitScript readiness checklist (required docs tracker)

**All admin mutations call `router.refresh()` so UI updates immediately after save — no manual reload needed.**

---

## Database Schema (Prisma)

> **Two-level product model (important):** `Product` = the compound (one slug, e.g. `tirzepatide`); `ProductVariant` = a specific mg strength with its own SKU/price/stock/COA. **Slugs carry NO mg suffix.** Cart is keyed by `variantId`. `ProductVariant.reconstitutionVolumeMl` (default 3) is admin-only and drives the dosage calculator.

**Core tables:**
- `User` — customers + admin accounts (email/password hashed with bcrypt; `marketingOptIn` bool)
- `Product` — compound-level catalog item (name, slug, category, form, description, image)
- `ProductVariant` — mg strength under a Product (sku, price in cents, stock w/ optimistic-lock `version`, `reconstitutionVolumeMl`, `active` toggle)
- `ProductImage` — product photos (stored in Vercel Blob or `/public/uploads`)
- `Category` — product categories (metabolic, recovery-repair, growth-hormone, cognitive, blends, longevity)
- `Order` — placed orders (orderNumber, status, customer email/userId, shipping address, totals in cents, items array, payments array)
- `OrderItem` — line items within an order (product name/sku/quantity/price)
- `Payment` — payment records (order ID, rail, amount, status: INITIATED/PENDING/SUCCEEDED/FAILED/REFUNDED/MANUAL_REVIEW, provider ref, webhook raw data)
- `COA` — Certificates of Analysis (product ID, batch/lot number, purity %, test date, file URL, created date)
- `ComplianceDoc` — site compliance documentation (category: RUO, SHIPPING_POLICY, REFUND, etc., title, file URL)
- `ChargebackMetric` — chargeback ratio tracking per payment rail (for Visa VAMP threshold monitoring)
- `AuditLog` — immutable log of all sensitive actions (who, what, when, entity IDs)

**Unique constraints:** Product sku, Order orderNumber.  
**Indexes:** Product category, Order status/createdAt, Payment rail/providerRef, COA batchLot.

---

## Recent Changes (Latest Session — 2026-07-19 → 07-21)

### Broken links / redirect audit
- **Footer "Shop Peptides" bug (user-reported):** `SHOP_LINKS` in `src/components/footer.tsx` had stale mg-suffixed slugs (`/products/bpc-157-5mg`) that 404'd after the earlier two-level variant migration (Product → ProductVariant; slugs carry NO mg suffix). Fixed to bare slugs (`/products/bpc-157`, `semaglutide`, `tirzepatide`, `retatrutide`, `klow-blend`). Full static/router link sweep done — footer was the only broken one.

### Require an account to check out (no guest checkout)
Chosen policy: browse freely, but checkout requires login. Enforced in 3 layers:
- `src/middleware.ts` — added `isCheckoutRoute`; guards `/checkout/:path*` alongside dashboard; redirects logged-out → `/login?callbackUrl=/checkout`.
- `src/app/checkout/page.tsx` — page-level `if (!session?.user?.id) redirect(...)` (defense in depth).
- `src/actions/checkout.ts` — `placeOrder` rejects without a session; sets `userId`, `guestEmail: null`.
- `src/components/auth/register-form.tsx` — honors `callbackUrl` so post-register returns to checkout.

### Payments — crypto reactivated, phone required
- `src/app/checkout/page.tsx` `getAvailableRails()` — Coinbase (COINBASE) now shows when configured **or in dev** (`isDev = NODE_ENV !== "production"`); auto-activates in prod when `COINBASE_COMMERCE_API_KEY` is set. **Stripe stays inert by design** (user: "leave it").
- Phone made **required** with numeric formatting: `src/lib/validations.ts` refines to a 10-digit US number; new `src/components/ui/phone-input.tsx` (`formatPhone` → `(512) 555-1234`, digit-only, `inputMode="tel"`). Address book + checkout use it.

### Age-gate / consent audit logging (compliance record-keeping)
- New `src/actions/consent.ts` → `logAgeConfirmation()`: writes an `AuditLog` row `action: "AGE_CONFIRMED"` with client **IP + server timestamp + user-agent + attestation text**; rate-limited; guest-safe (userId attached only if session present).
- `src/components/age-gate.tsx` `handleConfirm` fires it fire-and-forget (`void logAgeConfirmation().catch(()=>{})`) — a logging failure never blocks entry. Verified readable via admin Activity viewer.

### Dashboard build-out (admin + customer + shared account settings) — COMPLETE
Per the plan in `.claude/plans/bubbly-napping-flurry.md`. Highlights:
- **Schema (additive):** `User.marketingOptIn Boolean @default(false)`; `ProductVariant.reconstitutionVolumeMl Float @default(3)` (admin-only reconstitution volume driving the dosage calculator — NOT a customer choice; NAD+ 500mg=5, 1000mg=10 exceptions).
- **Shared account settings** (`src/components/account/account-settings.tsx`, `src/actions/account.ts`) — change name/email/password/avatar/marketing pref for BOTH customer and admin; live JWT refresh via `session.update()` + `auth.config.ts` `trigger === "update"` handling (no re-login needed).
- **Admin:** Analytics tab (`src/lib/analytics.ts` + hand-rolled `src/components/charts/{bar,line}-chart.tsx` — no chart lib), Customers tab (list + detail + role toggle w/ last-admin & self-demotion guards), full order detail route (`src/app/admin/orders/[id]/page.tsx` + notes + `refundOrder`), Activity tab (AuditLog + InventoryLog viewers).
- **Customer:** Buy-again/reorder (`src/actions/orders.ts` getReorderPayload), order detail route + printable invoice, dosage-log edit/delete.
- **Tab-reset constraint:** Radix Tabs are uncontrolled — new in-page tabs use CLIENT-side filter/pagination (not searchParams) so navigating doesn't reset the active tab.

### Compliance planning doc (NEW — building PAUSED)
- `LEGAL_OPERATIONS.md` created: 4-bucket map (🟦 software / 🟨 content / 🟥 physical-ops / ⬜ business) of two conflicting legal guidance inputs. See the OPEN DECISION banner at the top of this file. No compliance features built.

---

## Earlier Session (2026-07-18) — Redesign + Admin Fixes

### Redesign to Match Competitor UX
- **Theme:** Switched from forced dark mode to light/white background theme
- **Brand color:** Changed primary from green (`160 84% 32%`) to blue (`217 91% 38%`)
- **Login/register pages:** Rebuilt as split-screen layout (dark branded left panel, light form right, trust badges row)
- **New pages:** `/verify-coa` (standalone COA search), `/certificates` (full COA archive, paginated)
- **Homepage:** Restructured to 2-column hero (text left, real product vial photos right), added stats section, made newsletter dark panel
- **Navbar:** Session-aware (shows Admin/Dashboard/Sign Out if logged in + admin, Dashboard/Sign Out if logged in + customer, Login/Sign Up if anon)
- **Footer:** Fixed dead links, replaced placeholder categories/products with real slugs

### Admin Panel Fixes
- **Product photos:** Added upload/replace functionality (`uploadProductImage` server action in `/src/actions/admin.ts`)
  - Validates file is image, <8MB
  - Deletes existing ProductImage rows for that product, creates single new one
  - Photo preview in edit dialog shows Flask icon placeholder if empty
  - Photo upload disabled until product is saved once (needs productId)
- **Mutations now refresh UI:** Every admin mutation (edit product, change order status, approve receipt, upload COA, send campaign) calls `router.refresh()` on success so the screen updates immediately — previously silent, looked broken
- **Session seeding:** Root layout (`src/app/layout.tsx`) now reads session server-side and passes it to SessionProvider, so navbar renders correct login state on first paint instead of flashing "logged out" while useSession() fetches

### Local Dev Setup Docs
- Updated `DEPLOYMENT.md` with prerequisite warnings (Docker Desktop must be running, `cp .env.example .env` overwrites existing values)
- Added port-3000-conflict troubleshooting (WSL2 can collide with Windows dev server; use `-p 3001` as workaround)
- Added comprehensive "Provider Accounts" section explaining what credentials are actually needed vs. random-generated local values

---

## Current State: MOCK Mode

**Everything runs fully in MOCK mode with zero external accounts set up.** No real money moves, no real emails send, no real shipments start. This is intentional — lets you test the full flow locally without signing up for anything.

**MOCK behavior by feature:**
- **Checkout (card/ACH/crypto):** Order created, stock reserved, payment record stays PENDING_PAYMENT. To simulate webhook: either manually change status in `/admin` → Orders, or curl the webhook route with a mock providerRef (see DEPLOYMENT.md for example).
- **Shipping labels:** Returns fake USPS tracking #, no API call.
- **Emails:** Logged to terminal console (`[email:sendgrid MOCK]`), not actually sent.
- **Marketing campaigns:** Logged to console, not sent to Klaviyo.
- **P2P proof upload:** Fully real — customers can upload proof, admin can approve/reject in real time, no mocking.

**To go live:** Set env vars in Vercel (§2 in DEPLOYMENT.md), redeploy. Each adapter's `isConfigured.<name>()` flips to `true` and starts making real API calls. Rollback: unset the env var, redeploy.

---

## Important Files & Patterns

### Core App Structure
- `src/app/layout.tsx` — root layout, reads session server-side, passes to SessionProvider
- `src/app/globals.css` — CSS variables for theme (light/dark), Tailwind config
- `src/app/page.tsx` — homepage
- `src/app/admin/page.tsx` — admin dashboard (tabs for Products/Orders/P2P/COAs/Email/Compliance)
- `src/lib/auth.ts` — Auth.js configuration, providers (credentials + optional Google)
- `src/lib/env.ts` — environment variable parsing + `isConfigured.<name>()` checks for each adapter
- `src/lib/db.ts` — Prisma client
- `prisma/schema.prisma` — database schema (PostgreSQL)
- `prisma/seed.ts` — idempotent seeding script (creates admin user, 6 categories, 17 products, 4 compliance docs, sample COAs)

### Server Actions (Backend Logic)
- `src/actions/auth.ts` — login/logout/register
- `src/actions/checkout.ts` — placeOrder (inventory reservation, pricing, payment adapter routing)
- `src/actions/admin.ts` — all admin CRUD + file uploads (upsertProduct, uploadProductImage, uploadCoa, updateOrderStatus, createShippingLabel, etc.)
- `src/actions/coa.ts` — lookupBatch (search COAs by batch/lot OR product name)

### Payment Adapters
- `src/lib/payments/nexapay.ts`, `stripe.ts`, `coinbase.ts`, `seamlesschex.ts`, `payram.ts` — payment processors
- Each checks `isConfigured.<name>()` at start; if false, returns mock data
- Webhook route: `src/app/api/webhooks/payment/[rail]/route.ts` — unified entry point for all rails

### Components
- `src/components/auth/auth-split-layout.tsx` — reusable split-screen layout for login/register
- `src/components/navbar.tsx` — session-aware navigation (shows different links based on auth state + role)
- `src/components/admin/*` — admin UI (AdminProducts, AdminOrders, ReceiptQueue, CoaUploader, EmailCampaignManager, ComplianceTracker)
- `src/components/compliance/batch-lookup.tsx` — COA search input + suggestion chips

---

## Key Decisions & Constraints

1. **Single product photo model** — each product has at most one primary image. Uploading replaces existing, not multi-gallery.
2. **Stock reservation at checkout** — uses optimistic locking (Prisma's `update` with `where version == X`). Retries on conflict. Safer than simple `decrement()` under concurrent orders.
3. **Server-rendered navbar** — layout reads session server-side, passes to SessionProvider. No "flash" of logged-out UI. Trade-off: all pages now dynamic (not static-prerendered) because session is per-request.
4. **Compliance docs are read-only from admin** — no UI to edit them. They're seeded via `prisma/seed.ts` / the `ComplianceDoc` table. If you need to edit compliance docs after launch, add a compliance doc editor to `/admin` (currently just a dashboard).
5. **Payment webhook idempotency** — if the same webhook fires twice, the Payment is already in a terminal state (SUCCEEDED/FAILED/REFUNDED), so the second webhook is a no-op. Stock is not double-decremented.
6. **P2P orders stay in MANUAL_REVIEW state** — they don't auto-flip to PAID. Admin must explicitly approve the receipt in `/admin` → P2P queue, then order flips to AWAITING_REVIEW, then to PAID when approved.

---

## Local Development Quick Start

**Prerequisite:** Docker Desktop must be running.

```bash
# Step 1: install
npm install

# Step 2: start local Postgres
docker start ebl-postgres  # or: docker run -d --name ebl-postgres -e POSTGRES_USER=ebl -e POSTGRES_PASSWORD=ebl -e POSTGRES_DB=elevate -p 55432:5432 postgres:16-alpine

# Step 3: set up .env (if not already done)
# DATABASE_URL and DIRECT_URL should point to localhost:55432
# AUTH_SECRET and NEXTAUTH_SECRET: generate with openssl rand -base64 32

# Step 4: migrate + seed
npx prisma migrate dev
npm run db:seed

# Step 5: run
npm run dev  # or: npm run dev -- -p 3001  (if port 3000 conflicts with WSL2)
```

App at http://localhost:3000 (or :3001).  
Seeded admin: `admin@elevatebiolabs.com` / `Admin123!change-me`.

---

## What's NOT Built Yet

- **Compliance features (PAUSED pending Path A/B decision):** institutional verification gate (Path A only), chain-of-custody records (Path A only), MSDS management, enhanced COA fields (≥98% + ICP-MS heavy-metal panel), hard US-only enforcement, claims/labeling audit rewrites, RUO label / MSDS PDF generation. See [LEGAL_OPERATIONS.md](./LEGAL_OPERATIONS.md).
- Compliance doc editor in `/admin` (dashboard exists, editor doesn't)
- Multi-image product gallery (single image model only)
- Inventory alerts (low-stock notifications)
- Product reviews (schema exists, no UI yet)
- Google OAuth (credentials optional, unconfigured by default)

**Recently completed (no longer pending):** analytics/insights dashboard, refund UI (`refundOrder`), customer email/marketing preferences, in-app email/password/avatar change (customer + admin), buy-again/reorder, order detail routes, printable invoices, customer management + role toggle, activity/audit log viewers.

---

## Known Gotchas

1. **`cp .env.example .env` overwrites.** Don't re-run it after you've filled in real values; edit `.env` directly for individual vars.
2. **Port 3000 on Windows + WSL2 + Docker Desktop.** Something inside WSL2 can claim port 3000, and `wslrelay.exe` will non-deterministically route `localhost:3000` between your Windows dev server and whatever's in WSL2. If routes 404 unpredictably, use `-p 3001` instead and update `NEXTAUTH_URL`/`NEXT_PUBLIC_SITE_URL` in `.env`.
3. **Stale dev server after a production build.** If `.next/` cache gets mixed (dev mode + `next build` in same session), clear it: `rm -rf .next`. Can cause mysterious 404s on app router pages.
4. **Auth.js session doesn't update live.** If you manually change a user's role in the database, the logged-in session cache doesn't invalidate immediately. Log out and back in to pick up the change.
5. **MOCK webhook testing.** Orders from mocked payment rails stay `PENDING_PAYMENT` until you either manually change status in `/admin` or curl the webhook route with the right mock `providerRef` prefix.

---

## Recommended Next Steps (If Continuing)

1. **Wireup real providers** (see DEPLOYMENT.md Provider Accounts section):
   - Neon database
   - Vercel hosting
   - Domain name
   - Start with P2P rails + Coinbase Commerce (no underwriting)
   - SendGrid for emails
   - High-risk card processor (separate research needed)

2. **Add missing features** (if time permits):
   - Compliance doc editor in `/admin`
   - Customer email preferences
   - Refund processing
   - Order insights / analytics

3. **Testing checklist** before go-live:
   - Full storefront flow (browse → cart → checkout → email) with each enabled payment rail
   - Admin CRUD for products/orders/COAs
   - P2P flow (upload proof → approve receipt)
   - Shipping label generation
   - Stock reservation under concurrent orders (load test)

---

## Questions to Ask Before a New Session

- **What are you trying to build/fix?** (e.g., "add crypto payment", "fix admin upload", "integrate real Stripe")
- **What's your current blocker?** (e.g., "don't know which payment processor to use", "webhook test failing")
- **Have you set up any real provider accounts yet?** (e.g., Neon, Vercel, SendGrid)
- **Are you testing locally or production?**

---

## Useful Links (Inside This Repo)

- [README.md](./README.md) — project overview, tech stack, quick start
- [DEPLOYMENT.md](./DEPLOYMENT.md) — full deployment guide, provider setup, checklists, local dev troubleshooting
- [CLAUDE.md](./CLAUDE.md) — (if exists) — project conventions, coding style, team guidelines

---

**Happy hacking. Questions? Refer back to this doc first, then ask.**
