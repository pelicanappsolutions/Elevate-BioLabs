# ElevateBioLab — Project Context & Technical Reference

**Date**: July 15, 2026  
**Project Status**: MVP Complete (Dev Server Running on Port 3001)  
**Build Timeline**: 2 weeks from start to production-ready handoff  
**Developer**: BDS (Frankie Bruno) / Client: ElevateBioLab (Chazz)

---

## Project Overview

**ElevateBioLab** is a production-ready peptide e-commerce platform for research use only (RUO). Full-stack Next.js 14 application with multi-payment rails, USPS shipping integration, compliance tracking, and comprehensive admin/user dashboards.

**Key Business Rules:**
- Research Use Only (RUO) messaging on every page
- Products: 8 original catalog items + 9 new items (image photos just added) = 17 total
- Bulk pricing tiers (5+ units: 8% off, 10+ units: 15% off)
- Multiple payment rails: NexaPay (primary, card), SeamlessChex/AllayPay (ACH), PayRam/Stripe (load balance), Coinbase (crypto), P2P manual (Zelle/Venmo/Wire)
- Age verification required (21+)
- All integrations run in MOCK mode (no live keys needed)

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 14 (App Router), React, TypeScript (strict), Tailwind CSS, shadcn/ui |
| **Backend** | Next.js Server Actions, Node.js runtime |
| **Database** | PostgreSQL (Neon/Supabase for prod, Docker local for dev), Prisma ORM |
| **Auth** | Auth.js v5 with JWT strategy, bcryptjs for passwords, Credentials + OAuth providers |
| **Client State** | Zustand (cart, persisted to localStorage) |
| **Validation** | Zod (client + server) |
| **Email** | Sendgrid + Klaviyo (both mocked) |
| **Shipping** | USPS API integration (mocked for dev) |
| **Payments** | Multi-adapter pattern (5 routes, router-based dispatch) |
| **File Storage** | Vercel Blob (fallback: `/public/uploads`) |
| **Images** | Next.js Image + optimization (AVIF/WebP) |
| **Hosting** | Vercel (production) |
| **CSS Framework** | Tailwind + shadcn/ui components |
| **Linting** | ESLint (next/core-web-vitals) |

---

## Database Schema (Prisma)

```prisma
// Core domain models
User (id, email, passwordHash, name, role: ADMIN|USER, emailVerified, ageVerified)
  └─ Orders (one-to-many)
  └─ Addresses (one-to-many)
  └─ DosageLogs (one-to-many)
  └─ SavedProducts (many-to-many)

Product (id, sku, name, slug, description, cas, purity, molarMass, sequence, form, storageInfo, priceCents, compareAtCents, stock, version, featured, active, lowStockThreshold, categoryId)
  └─ Category (many-to-one)
  └─ ProductImages (one-to-many, url, alt, sortOrder)
  └─ PriceTiers (one-to-many, minQty, unitPriceCents)
  └─ COAs (one-to-many, batchLot, fileUrl, purity, testedOn)
  └─ InventoryLogs (one-to-many, reason, delta, before, after, note)

Order (id, userId, orderNumber, status: PENDING_PAYMENT|AWAITING_REVIEW|PAID|SHIPPED|DELIVERED, paymentStatus: PENDING|MANUAL_REVIEW|COMPLETED|FAILED, paymentRailId, shippingAddressId, subtotalCents, taxCents, shippingCents, totalCents, notes, createdAt, updatedAt)
  └─ OrderItems (one-to-many, productId, productSku, quantity, unitPriceCents)
  └─ PaymentReceipt (one-to-one, proofFileUrl, proofExpiresAt, manualNotes)
  └─ ShippingLabel (one-to-one, trackingNumber, labelFileUrl, carriers, estimatedDelivery, labelCreatedAt)

Category (id, name, slug, description, sortOrder)
ComplianceDoc (id, title, slug, category: RUO|SHIPPING_POLICY|REFUND|LEGITSCRIPT, body, active, fileUrl, updatedAt)
DosageLog (id, userId, compoundName, doseMg, diluentMl, drawnVolumeUL, unitsInjected, unitType, notesText, createdAt)
SavedProduct (id, userId, productId)
Address (id, userId, name, line1, line2, city, state, zip, country, phoneNumber, isDefault)
InventoryLog (id, productId, reason: RESTOCK|SALE|ADJUSTMENT|TRANSFER, delta, before, after, note, createdAt)
```

**Key constraint**: `Product.version` enables optimistic locking (prevent inventory oversell on concurrent checkouts).

---

## Project Structure

```
elevate-bio-labs/
├── src/
│   ├── app/
│   │   ├── layout.tsx (RUO banner, Navbar, providers)
│   │   ├── page.tsx (Landing: hero, featured products, categories, newsletter)
│   │   ├── login/ → credentials auth, redirect to /dashboard on success
│   │   ├── register/ → sign up, age/email verification prompts
│   │   ├── reset-password/ → token-based flow
│   │   ├── forgot-password/ → email entry
│   │   ├── products/
│   │   │   ├── page.tsx (Catalog with filters, sort, pagination)
│   │   │   └── [slug]/page.tsx (Product detail: gallery, specs, calc, related)
│   │   ├── cart/page.tsx (CartView component, swipe-to-remove)
│   │   ├── checkout/
│   │   │   ├── page.tsx (Entry point)
│   │   │   ├── success/page.tsx (Order confirmation, payment instructions)
│   │   │   └── error/page.tsx (Error fallback)
│   │   ├── dashboard/ (Protected, requires auth)
│   │   │   └── page.tsx (Tabs: Orders, Saved, Dosage Log, Addresses, Profile)
│   │   ├── admin/ (Protected, requires ADMIN role)
│   │   │   └── page.tsx (KPIs, tabbed interface: Orders, P2P Receipt Queue, Products, COAs, Email, Compliance)
│   │   ├── compliance/page.tsx (RUO policy, batch lookup, shipping, about, contact form)
│   │   └── api/
│   │       ├── auth/[...nextauth]/ (NextAuth handler)
│   │       ├── webhooks/payment/[rail]/ (Payment webhook handlers)
│   │       └── cron/sync-tracking/ (USPS tracking sync)
│   │
│   ├── components/
│   │   ├── navbar.tsx (Header, RUO banner strip, search, cart badge, auth links)
│   │   ├── cart/
│   │   │   └── cart-view.tsx (Zustand items, swipe-left-96px threshold, remove, mobile sticky CTA)
│   │   ├── checkout/
│   │   │   ├── checkout-flow.tsx (4-step: address → delivery → rail → review)
│   │   │   └── proof-of-payment-modal.tsx (File upload for P2P)
│   │   ├── products/
│   │   │   ├── product-gallery.tsx (Image carousel, thumbnails)
│   │   │   ├── product-filters.tsx (Mobile disclosure, desktop sticky, category/form/price/stock)
│   │   │   ├── add-to-cart-panel.tsx (Qty stepper, bulk tier display)
│   │   │   └── dosage-calculator.tsx (Reconstitution math, U-100 units, save to log)
│   │   ├── dashboard/
│   │   │   ├── order-history.tsx (Status badges, USPS tracking links)
│   │   │   ├── dosage-log-panel.tsx (Table of logs, new entry form)
│   │   │   └── address-book.tsx (CRUD for shipping addresses)
│   │   ├── admin/
│   │   │   ├── admin-orders.tsx (Status transitions, shipping label creation)
│   │   │   ├── receipt-queue.tsx (P2P receipts awaiting approval, amount mismatch alerts)
│   │   │   ├── admin-products.tsx (Full product CRUD modal, restock adjustment)
│   │   │   └── coa-uploader.tsx (Product selector, batch, test date, PDF/image)
│   │   ├── compliance/
│   │   │   ├── batch-lookup.tsx (Search bar, server action lookupBatch, COA results)
│   │   │   └── contact-form.tsx (Name, email, message, submit action)
│   │   └── ui/ (shadcn: Button, Input, Dialog, Tabs, Badge, Skeleton, etc.)
│   │
│   ├── lib/
│   │   ├── auth.ts (NextAuth config with Prisma adapter, bcryptjs, Credentials provider)
│   │   ├── auth.config.ts (Edge-safe JWT/session callbacks, no providers)
│   │   ├── utils.ts (formatPrice, cn, resolveUnitPrice with bulk tiers)
│   │   ├── db.ts (Prisma client singleton)
│   │   └── payments/
│   │       ├── index.ts (5 adapter implementations: NexaPay, SeamlessChex, PayRam, Coinbase, P2P)
│   │       └── meta.ts (Client-safe metadata: labels, fees, types, requiresProof)
│   │
│   ├── actions/
│   │   ├── auth.ts (login, register, resetPassword, forgotPassword)
│   │   ├── checkout.ts (placeOrder, createShippingLabel, updateOrderStatus)
│   │   ├── cart.ts (addToCart, updateQty, removeItem)
│   │   ├── products.ts (getProductBySlug, getProducts, getFeatured, getCategories)
│   │   ├── admin.ts (adminGetOrders, adminUpdateOrderStatus, adminSyncUSPS)
│   │   ├── dashboard.ts (getOrders, getSavedProducts, logDose, getDosageLogs, getAddresses, etc.)
│   │   ├── coa.ts (lookupBatch server action with 10 req/min rate limiting)
│   │   └── contact.ts (submitContact for compliance form)
│   │
│   ├── store/
│   │   └── cart.ts (Zustand: items, hydrated, count(), subtotalCents(), addItem, setQty, remove, clear)
│   │
│   ├── types/
│   │   └── index.ts (TypeScript interfaces for Order, Product, etc.)
│   │
│   └── middleware.ts (Auth check via Edge Runtime, redirects anon users from /dashboard and /admin)
│
├── prisma/
│   ├── schema.prisma (Complete data model)
│   ├── seed.ts (Creates admin user, 6 categories, 17 products with images/tiers/COAs, compliance docs)
│   └── migrations/ (Managed by Prisma Migrate)
│
├── public/
│   ├── manifest.json (PWA metadata)
│   └── images/products/
│       ├── klow-blend-80mg.png
│       ├── ghk-cu-50mg.png
│       ├── glow-blend-70mg.png
│       ├── nad-plus-500mg.png
│       ├── tirzepatide-10mg.png
│       ├── tirzepatide-20mg.png
│       ├── retatrutide-5mg.png
│       ├── retatrutide-10mg.png
│       ├── retatrutide-20mg.png
│       └── retatrutide-30mg.png
│
├── .env.example (Template for required env vars, no secrets)
├── .eslintrc.json (next/core-web-vitals, ignores .next, node_modules, migrations)
├── next.config.mjs (Image formats: AVIF/WebP, remotePatterns for unsplash + S3)
├── tsconfig.json (strict mode, baseUrl paths)
├── package.json (all dependencies locked)
├── README.md (Setup guide, Docker Postgres example, seeded admin credentials)
└── PROJECT_CONTEXT.md (This file)
```

---

## Products in Catalog (17 Total)

### Original 8 (Stock Images)
1. **Semaglutide 5mg** — GLP-1, Metabolic, $89.99, 120 units, featured
2. **Tirzepatide 10mg** — Dual GIP/GLP-1, Metabolic, $139.99, 80 units, featured *(has real photo)*
3. **BPC-157 5mg** — Recovery, $44.99, 200 units, featured
4. **TB-500 5mg** — Recovery, $49.99, 150 units
5. **Ipamorelin 5mg** — GH secretagogue, $39.99, 175 units
6. **CJC-1295 no-DAC 2mg** — GHRH analog, $34.99, 140 units
7. **Semax 30mg** — Cognitive/nasal spray, $54.99, 90 units
8. **Selank 10mg** — Cognitive/nasal spray, $49.99, 110 units

### New 9 (Real Product Photos Added)
9. **Tirzepatide 20mg** — Dual GIP/GLP-1, Metabolic, $229.99, 60 units *(photo: tirzepatide-20mg.png)*
10. **Retatrutide 5mg** — Triple GIP/GLP-1/glucagon, Metabolic, $89.99, 90 units *(photo)*
11. **Retatrutide 10mg** — Triple GIP/GLP-1/glucagon, Metabolic, $149.99, 75 units, featured *(photo)*
12. **Retatrutide 20mg** — Triple GIP/GLP-1/glucagon, Metabolic, $249.99, 50 units *(photo)*
13. **Retatrutide 30mg** — Triple GIP/GLP-1/glucagon, Metabolic, $329.99, 40 units *(photo)*
14. **GHK-Cu 50mg** — Copper tripeptide, Recovery/Repair, $59.99, 130 units, featured *(photo: ghk-cu-50mg.png)*
15. **NAD+ 500mg** — Nicotinamide adenine dinucleotide, Longevity, $99.99, 100 units, featured *(photo: nad-plus-500mg.png)*
16. **KLOW Blend 80mg** — KPV, Larazotide, GHK-Cu, BPC-157, Blends, $189.99, 55 units, featured *(photo: klow-blend-80mg.png)*
17. **GLOW Blend 70mg** — GHK-Cu, BPC-157, TB-500, Blends, $169.99, 65 units, featured *(photo: glow-blend-70mg.png)*

**Categories:** Metabolic, Recovery & Repair, Growth Hormone, Cognitive, Blends, Longevity (6 total)

**Image Status:**
- 10 products have real product vial photos (served from `/public/images/products/`)
- 7 products fall back to placeholder (Unsplash stock flask image)
- All images optimized via Next.js Image → AVIF/WebP (~13-23 KB optimized vs. 2+ MB source)

---

## Authentication Flow

**Strategy:** Auth.js v5 with JWT + Credentials provider

```
Login Page (form)
  ↓ (email + password via server action)
lib/auth.ts (bcryptjs verify against passwordHash)
  ↓ (success)
JWT token created (nextauth secret)
  ↓ (set as secure httpOnly cookie)
Middleware (edge runtime, reads JWT)
  ↓ (if valid, user object attached to request)
Protected Routes (/dashboard, /admin) → allow
Unprotected Routes → allow
Anonymous Request to /dashboard → 307 redirect to /login
```

**Seeded Credentials:**
- Email: `admin@elevatebiolab.com`
- Password: `Admin123!change-me` (must change before production)

**Key Fix Applied:** Split auth into two configs to prevent bcryptjs/Prisma from entering Edge Runtime:
- `auth.ts` — Node-only, has Prisma adapter + bcryptjs
- `auth.config.ts` — Edge-safe, JWT callbacks only
- `middleware.ts` — builds auth from auth.config.ts

---

## Payment Rails (All Mocked)

Each rail routes to a separate adapter that returns mock responses. Real API calls are stubbed for dev.

| Rail | Adapter | Status Response | Use Case |
|------|---------|-----------------|----------|
| **NexaPay** | `nexapay.adapter.ts` | `COMPLETED` (instant) | Primary card processor |
| **SeamlessChex** | `seamlesschex.adapter.ts` | `PENDING_MANUAL_REVIEW` | ACH transfers |
| **PayRam** | `payram.adapter.ts` | `PENDING` | Backup card route |
| **Coinbase** | `coinbase.adapter.ts` | `PENDING` | Crypto payments |
| **P2P Manual** | `p2p.adapter.ts` | `AWAITING_REVIEW` | Zelle/Venmo/Wire (requires proof upload) |

**Order Flow:**
1. User selects rail on checkout step 3
2. If P2P: show payment memo + proof-upload modal → snapshot → admin review
3. If card: mock charge → return txn ID → mark `PAID`
4. Order saved to database with `paymentRailId` + `paymentStatus`
5. Admin receipt queue shows P2P pending receipts; card orders skip directly to shipping

---

## Shipping Integration

**Provider:** USPS (real API, mocked responses in dev)

**Flow:**
1. User enters ZIP on checkout step 2 → real-time rate fetch via USPS API
2. Mock rates returned: Priority Express (~$25), Priority Mail (~$12), Ground Advantage (~$8)
3. User selects rate → stored in order
4. Admin clicks "Create Shipping Label" → USPS label PDF generated (mocked)
5. Tracking number stored; customer sees link on order page
6. Cron job syncs tracking status (mocked)

---

## Email & Marketing

**Sendgrid:** Transactional (order confirmations, password resets)  
**Klaviyo:** Campaign (abandoned cart 24h, newsletter, RUO reminders)

Both mocked in dev (check logs, no real emails sent).

---

## Key Features Implemented

### Public Pages
- **Home** — Hero, featured 3-5 products (rotates featured: true), category grid, newsletter signup, trust badges
- **Catalog** — All 17 products, filters (category, form, price, stock), sort (newest/price/name), pagination (20 per page)
- **Product Detail** — Gallery (carousel + thumbnails), specs (CAS, purity, molar mass), COA downloads, storage info, reconstitution calculator, bulk pricing display, related products sidebar, add to cart
- **Compliance** — RUO policy, batch/lot COA lookup (server action, rate-limited 10 req/min), shipping policy, refund policy, LegitScript checklist, about, contact form

### User Dashboard (Protected)
- **Orders Tab** — Order history, status badge, tracking link (if label created), total/date
- **Saved Products** — Wishlist, quick add to cart
- **Dosage Log** — Table of entries (date, compound, dose mg, diluent ml, volume μL, notes), form to log new entry
- **Addresses** — CRUD shipping addresses, set as default
- **Profile** — Name, email, password reset, ageVerified flag

### Admin Dashboard (Protected, ADMIN role only)
- **KPI Strip** — Revenue (30d), P2P queue count, low stock alerts, active product count
- **Orders Tab** — All orders, status dropdown to transition (PENDING → AWAITING_REVIEW → PAID → SHIPPED → DELIVERED), USPS label creation button
- **P2P Receipt Queue** — Awaiting approval receipts, amount mismatch detection (bold alert), approve/reject buttons
- **Products Tab** — Full CRUD modal (name, SKU, category, price, compareAt, form, stock, description, specs), restock delta + note, image thumbnail, bulk tier display
- **COA Tab** — Product selector, batch/lot number input, test date picker, PDF/image upload
- **Email Campaigns Tab** — Recent campaigns, status, recipient count
- **Compliance Tab** — RUO/Shipping/Refund/LegitScript docs, edit modal, file upload, active toggle

### Cart & Checkout
- **Cart** — Items from Zustand (localStorage), swipe-left-96px threshold to remove with trash reveal, sticky order summary (desktop), mobile sticky checkout bar
- **Checkout** — 4-step flow with progress indicator:
  1. Shipping address (saved addresses quick-select or new address form)
  2. Delivery method (USPS rate fetch by ZIP, select rate)
  3. Payment rail (selector with fee notes, P2P shows memo and proof-upload requirement)
  4. Review (order summary, apply coupon placeholder, place order button)
- **Success Page** — Order confirmation, payment status (COMPLETED/PENDING/AWAITING_REVIEW), payment instructions if P2P, shipping address, estimated delivery

---

## Critical Bugs Fixed

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| Prisma schema compilation fail | Order model missing `user` relation | Added `user User? @relation(...)` to Order |
| Cart swipe touch undefined | Touch event type safety | Added `?. ?? null` guards on `e.touches[0].clientX` |
| Product gallery crash | Image access before bounds check | Moved bounds check before render; early return if !current |
| Reset password prerender fail | useSearchParams in non-Suspense component | Converted to server component; read token from props |
| Checkout bundle 161 kB | Payment adapters + node:crypto in client | Split to `meta.ts` (client-safe metadata only) |
| Edge Runtime errors | bcryptjs/Prisma in middleware | Split auth into `auth.config.ts` (edge-safe) + `auth.ts` (node) |

---

## Verified Behaviors

✅ **Inventory Oversell Prevention**: 12 concurrent buyers vs. 10-unit stock → exactly 10 succeeded, 2 rejected, stock landed at 0  
✅ **End-to-End Order**: Card order → PENDING_PAYMENT; P2P order → AWAITING_REVIEW with memo; oversell → validation error  
✅ **Pricing**: Bulk tiers applied server-side; TX tax (8.25%) calculated; USPS rates quoted  
✅ **Auth**: Wrong password → no session; correct → role ADMIN; anon → /admin redirects to /login  
✅ **Images**: All 10 vial photos serve 200 OK; next/image optimization renders AVIF ~13 KB (vs. 2.6 MB source)  
✅ **Build**: TypeScript strict, ESLint clean, 16 pages prerender, no warnings  

---

## Server & Development Environment

**Current Setup:**
- **Dev Server**: Port 3001 (http://localhost:3001)
- **Resume Matcher**: Port 3000 (separate project, left untouched)
- **Database**: Docker Postgres container `ebl-postgres` on port 55432
  - User: `ebl` / Password: `ebl` / Database: `elevate`
- **Env File**: `.env` (gitignored) points to local Postgres via DATABASE_URL and DIRECT_URL
- **Hot Reload**: Enabled; edits appear live without restart

**Start Commands:**
```bash
# Start container
docker start ebl-postgres

# Dev server (hot reload)
npm run dev

# Production build & start
npm run build
npx next start -p 3111

# Type check
npx tsc --noEmit

# Lint
npx next lint

# Seed database
npm run db:seed
```

---

## Infrastructure Handoff Model (Professional Setup)

**Owner / Controller:**
| System | Owner | BDS Access | Notes |
|--------|-------|-----------|-------|
| GitHub Repository | Elevate (private) | Developer/Team | Source of truth |
| Vercel Hosting | Elevate | Developer/Team | Deploys from main branch |
| PostgreSQL Database | Elevate (Neon/Supabase) | Developer role | Team access via org |
| Domain | Elevate | Technical if needed | DNS/registrar control |
| Payment Processors | Elevate (own accounts) | API key only | No access to disputes/chargebacks |
| USPS Account | Elevate | API integration | Shipping data only |
| Klaviyo Account | Elevate | Developer access | Campaign viewing/creation |
| SendGrid Account | Elevate | API key only | Email sending only |

**Why This Matters:**
- Chazz owns his business and the infrastructure to run it
- BDS keeps authorized developer access to maintain/update code
- Future changes: pull latest from GitHub, create branch, test, merge to main, Vercel auto-deploys
- BDS bills $40/hour for approved changes; no upfront infrastructure cost

**Never:**
- Use your personal credit card for client infrastructure
- Store client secrets in GitHub
- Act as their payment processor or accept their customer payments
- Leave infrastructure under your name/account

---

## Two-Week Delivery Checklist

- [x] Schema & migrations
- [x] Auth (login, register, reset)
- [x] Product catalog with filters/sort
- [x] Cart with Zustand + swipe gestures
- [x] 4-step checkout flow
- [x] Payment rail selection + P2P proof upload
- [x] Order confirmation page
- [x] User dashboard (orders, saved, dosage log, addresses)
- [x] Admin dashboard (KPIs, orders, P2P queue, products, COAs, email, compliance)
- [x] Compliance pages (RUO policy, batch lookup, contact form)
- [x] USPS integration (rate fetch, label creation)
- [x] Email integration (Sendgrid, Klaviyo mocked)
- [x] Image optimization & real product photos (10 vials)
- [x] TypeScript + ESLint clean
- [x] Production build tested
- [x] Bug fixes (Prisma schema, auth edge runtime, bundle size)

**Remaining Before Launch:**
- [ ] Elevate creates GitHub org + Vercel team + Neon database
- [ ] Chazz verifies account ownership (all services)
- [ ] BDS gets developer access across all platforms
- [ ] Production .env vars configured in Vercel
- [ ] USPS API real keys (if not mocked)
- [ ] Payment processors real accounts (if not mocked)
- [ ] Klaviyo/SendGrid real API keys
- [ ] Domain DNS pointed to Vercel
- [ ] SSL certificate auto-provisioned by Vercel
- [ ] Backup & recovery process documented
- [ ] Admin user password changed
- [ ] Handoff sign-off & 14-day support window begins

---

## Key Files to Know

**Core Logic:**
- `src/lib/auth.ts` — Authentication configuration
- `src/lib/payments/index.ts` — Payment adapter router
- `src/store/cart.ts` — Zustand cart state
- `prisma/schema.prisma` — Data model & relations
- `src/middleware.ts` — Route guards (auth check)

**Critical Server Actions:**
- `src/actions/checkout.ts` — placeOrder, createShippingLabel
- `src/actions/admin.ts` — adminUpdateOrderStatus, adminSyncUSPS
- `src/actions/coa.ts` — lookupBatch (batch/lot search)

**UI Components:**
- `src/components/navbar.tsx` — Header (sticky removed, now relative)
- `src/components/checkout/checkout-flow.tsx` — 4-step form
- `src/components/products/product-filters.tsx` — Category/form/price/stock
- `src/components/cart/cart-view.tsx` — Swipe-to-remove gesture
- `src/components/admin/receipt-queue.tsx` — P2P approval queue

**Pages:**
- `src/app/page.tsx` — Home (featured products, categories)
- `src/app/products/page.tsx` — Catalog (filters, search, pagination)
- `src/app/products/[slug]/page.tsx` — Product detail (specs, calc, COA)
- `src/app/dashboard/page.tsx` — User dashboard (tabbed)
- `src/app/admin/page.tsx` — Admin dashboard (KPIs, tabs)
- `src/app/compliance/page.tsx` — Policies, batch lookup, contact

---

## Environment Variables (Template)

**Required in Production .env (set in Vercel, not in repo):**

```
# Database
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# Auth
NEXTAUTH_SECRET="openssl rand -base64 32"
NEXTAUTH_URL="https://elevatebiolab.com"
NEXT_PUBLIC_SITE_URL="https://elevatebiolab.com"

# Payment Processors (API keys only)
NEXAPAY_API_KEY="..."
NEXAPAY_SECRET="..."
SEAMLESSCHEX_API_KEY="..."
PAYRAM_API_KEY="..."
COINBASE_COMMERCE_API_KEY="..."

# Shipping
USPS_API_KEY="..."

# Email & Marketing
SENDGRID_API_KEY="..."
KLAVIYO_API_KEY="..."

# File Storage
BLOB_READ_WRITE_TOKEN="..."

# OAuth (if used)
GITHUB_ID="..."
GITHUB_SECRET="..."
GOOGLE_ID="..."
GOOGLE_SECRET="..."
```

Never commit actual values. Use `.env.example` to document what's needed.

---

## Development Notes

**What to Avoid:**
1. Don't change auth strategy to session-based without reworking middleware (Edge Runtime)
2. Don't add heavyweight client libraries without measuring bundle size impact
3. Don't commit .env files or API secrets to GitHub
4. Don't modify Prisma schema without running migrations
5. Don't assume payment/shipping integrations work without real keys (mock is fine for dev)

**Performance:**
- Image optimization via Next.js Image → AVIF/WebP is working; monitored via DevTools Network tab
- Cart state persisted to localStorage → no full-page reloads needed for quantity changes
- Product pages use ISR (revalidate: 3600) → cached but fresh within 1 hour
- Admin pages server-rendered for fresh data every request

**Testing:**
- Inventory oversell: tested with 12 concurrent POST /api/checkout (works)
- Auth flow: wrong/correct password, anon redirects, ADMIN role checks (all pass)
- Order flow: card (COMPLETED), P2P (AWAITING_REVIEW), oversell (rejected)
- Images: all 10 vials serve correctly, next/image optimization confirmed

---

## Additional Context

**This is the model BDS follows for long-term client work:**

1. **Build**: Fixed $800 project fee for two weeks
2. **Deploy**: Client-owned infrastructure (Vercel, database, domain, payment accounts)
3. **Handoff**: Actual transfer of ownership + BDS retained authorized developer access
4. **Support**: 14-day bug fix window (original scope only)
5. **Maintenance**: $40/hour for approved changes, billed per hour, easy to pull latest from GitHub and deploy

The client benefits because they own their business and won't be trapped if the developer becomes unavailable. BDS benefits because future changes are easy (code in GitHub, team access to deployment) and the hourly rate sustains ongoing work.

---

**Last Updated**: July 15, 2026  
**Next Steps**: Prepare infrastructure handoff checklist; transfer GitHub org; verify all Elevate account ownerships.
