# Frontend Verification Checklist

Mapped directly to the "02 FRONTEND EXPERIENCE" scope in `BDS_Elevate_Biolab_Proposal_Invoice.pdf` (Ref: BDS-EB-071426). Goal: verify every contracted frontend deliverable actually works before moving to backend/integration work.

**Status legend:** ✅ verified (code + live response checked) · ⚠️ broken, fixed this pass · 🔲 exists in code, needs a real browser click-through to fully confirm (cart/checkout state is client-side — curl can't see it) · ❌ not yet built

**Last verified:** 2026-07-19, against `http://localhost:3001`

---

## 1. Landing page — ✅
- ✅ Hero with value proposition + CTA to `/products`
- ✅ 9 featured product links on homepage
- ✅ Trust badges (lab-tested / USA-based / purity)
- ✅ RUO notices — present in title, meta description, banner strip, hero copy, footer, and per-product descriptions

## 2. Homepage feature areas — ✅
- ✅ Category navigation (navbar "Shop" + footer category links)
- ✅ Search bar (navbar) — functional, redirects to `/products?q=`
- ✅ Newsletter section + working subscribe form
- ✅ "How it works" section present

## 3. Filterable product catalog (`/products`) — ✅
- ✅ Category filter, Form filter, price min/max, in-stock-only, sort, pagination — all present
- ✅ Price filter re-tested this pass — Enter-key submit + clear both work correctly
- ✅ Product cards show name/price correctly

## 4. Product detail pages — ✅
- ✅ CAS, purity, storage info, description all present
- ✅ COA link present
- ✅ Bulk pricing tiers ("Bulk 5+") shown
- ✅ Add-to-cart button present
- ✅ Reconstitution/dosage calculator present, numeric-input-restricted

## 5. Research quantity/calculation interface — ✅
- ✅ Calculator present on product pages (item 4) and in dashboard dosage log
- ✅ No dosing-advice language — confirmed by design (component doc comment: "deliberately gives no dosing recommendation")

## 6. Persistent cart — 🔲
- ✅ Cart page loads, correct title/meta
- 🔲 **Needs a real browser check**: cart content is entirely client-rendered from the Zustand store (localStorage) — curl with no browser session can't see items, quantity controls, or the order summary. Please manually: add an item → confirm navbar badge updates → change quantity → remove item → reload the page → confirm cart survived the reload.

## 7. Multi-step checkout — 🔲
- ✅ `/checkout` route loads (200)
- ✅ Confirmed in code: all payment rails (Card/NexaPay, Stripe, Coinbase, SeamlessChex, PayRam, Zelle, Venmo, Wire) are registered in `src/lib/payments/meta.ts`, and `proof-of-payment-modal.tsx` exists for the P2P upload flow
- 🔲 **Needs a real browser check**: like the cart, the checkout flow (shipping rate calc, payment-method selector, tax/shipping breakdown, proof-of-payment upload) is entirely client-rendered against real cart contents — curl with an empty cart can't exercise it. Please walk through a full checkout with at least one item in cart.

## 8. Customer dashboard — ✅ (corrected from earlier assumption)
- ✅ Confirmed in code: all five tabs are wired to real components, not stubs — **Orders** (`OrderHistory`), **Saved** (`SavedProducts` — a genuine wishlist feature, contrary to an earlier note in `RESYNC.md` saying this wasn't built), **Dosage log** (`DosageLogPanel`), **Addresses** (`AddressBook`), **Profile** (`ProfileSettings`)
- ✅ Orders tab (the default-visible one) confirmed rendering live
- 🔲 The other four tabs are Radix `Tabs` panels that only mount when clicked — recommend clicking through each once live to visually confirm, though the code backing them is solid

## 9. Compliance & company pages — ✅
- ✅ `/compliance`, `/verify-coa`, `/certificates` all load (200)
- ✅ Age-gate component present and wired at root layout
- ✅ RUO notices confirmed across home/product/compliance pages

## 10. Mobile-first, responsive, PWA — ✅ (one real bug found and fixed)
- ✅ Mobile nav (Sheet menu), collapsible product filters — present in code
- ✅ Touch targets sized at 44px (`h-11 min-h-[44px]` pattern used throughout)
- ⚠️ **Fixed this pass**: `manifest.json` referenced `/icons/icon-192.png` and `/icons/icon-512.png`, but the entire `public/icons/` folder didn't exist — every browser trying to install the PWA was 404ing on both icons. Generated real brand-colored PNG icons (blue background, white flask mark) at both sizes, verified they're valid images and serve correctly (`200 image/png`).
- ✅ Also updated `manifest.json`'s stale `background_color`/`theme_color` (old dark-theme hex values) to match the current light-theme brand color, and matched `layout.tsx`'s `themeColor` to respond to `prefers-color-scheme` (light/dark) — consistent with the auto dark-mode support added earlier.

---

## Net result of this pass
- **1 real bug found and fixed**: broken PWA icons (would have blocked "installable-app foundation" entirely).
- **1 stale assumption corrected**: the dashboard's "Saved items" feature is fully built — an earlier note in `RESYNC.md` was wrong and should be updated.
- **Two sections (Cart, Checkout) need your own live click-through** — their content is 100% client-side and depends on real cart state, which isn't something I can drive from the terminal. Everything backing them (payment rails, proof-of-payment modal, Zustand cart store) is confirmed present in code; I just can't prove the *interaction* works without a real browser session.

## Suggested next step
Do one full manual pass: add a product to cart → adjust quantity → go to checkout → pick a payment rail (try P2P to see the proof-of-payment upload) → place the order → confirm it shows up in the dashboard's Orders tab. Tell me what breaks, if anything, and I'll fix it — that closes out the frontend checklist before we move to backend/integration work.
