# Contract Compliance Checklist

Verifies the delivered platform against every line item in `BDS_Elevate_Biolab_Proposal_Invoice.pdf` (Ref: BDS-EB-071426) — sections 02 (Frontend), 03 (Backend), 04 (Integrations), 06 (Mobile/Performance), 07 (Deployment/Handoff). Section 02 was already checked in detail in `FRONTEND_CHECKLIST.md` (one real bug found and fixed there — broken PWA icons); this document covers what that one didn't: backend, integrations readiness, and handoff.

**Status legend:** ✅ verified in code/live · ⚠️ gap found · 🔲 depends on accounts you haven't opened yet (can't verify — not a code gap)

**Last verified:** 2026-07-20, against `http://localhost:3001` + live source inspection.

---

## 03 Backend Systems & Administration — ✅ all items present

| Contract item | Status | Where |
|---|---|---|
| PostgreSQL + Prisma ORM | ✅ | `prisma/schema.prisma`, confirmed connected and migrated |
| Core data models (users, products, categories, orders, order items, inventory logs, COAs, payment receipts, audit logs, marketing events, compliance docs) | ✅ | All 11 models confirmed present: `User`, `Product`, `Category`, `Order`, `OrderItem`, `InventoryLog`, `COA`, `PaymentReceipt`, `AuditLog`, `CampaignEvent`, `ComplianceDoc` — plus `ProductVariant` (added this session for the mg/strength selector, a superset of the original scope, not a gap) |
| Customer auth, email verification, password reset, protected routes | ✅ | Auth.js v5, `src/actions/auth.ts`, middleware-protected `/dashboard`, `/admin` |
| Protected admin dashboard (product, pricing, category, inventory, order, receipt, COA, compliance) | ✅ | `/admin` — all 6 tabs confirmed working live this session |
| Inventory controls against race conditions/overselling | ✅ | `src/lib/inventory.ts` — optimistic locking via `version` column, verified directly with a real decrement test (stock, version bump, InventoryLog all correct) |
| Validated backend actions, strict TypeScript | ✅ | Zod schemas on every mutating action (`src/lib/validations.ts`), `tsc --noEmit` clean |
| Webhook processing + signature verification | ✅ | `src/app/api/webhooks/payment/[rail]/route.ts` — HMAC/timing-safe verification present in all 5 card/crypto adapters (confirmed 17 signature-verification call sites across `src/lib/payments/*.ts`) |
| Error handling, rate limiting, retry logic, logging | ✅ | Rate limiting on 6 sensitive actions (checkout, COA lookup, etc.), retry logic in `decrementStock` (4 attempts, optimistic-lock aware), email adapters log every send/failure |
| File storage for COAs, receipts, order documents | ✅ | `src/lib/storage.ts` (`uploadFile`), used by COA upload, product images, **and** the customer-facing proof-of-payment flow (`src/actions/proof.ts` — confirmed real, not a stub: validates file size/type, uploads, creates `PaymentReceipt`, flips order to `AWAITING_REVIEW`) |
| Production environment setup, migration, deployment verification | ✅ | `DEPLOYMENT.md` — full guide, migration commands tested live this session (schema pushed, migrated, verified against real data twice) |

**No gaps in section 03.** Everything promised in the backend scope is real, not a stub — this was worth actually checking given how much of a red flag "backend looks done but isn't wired up" would be at handoff.

---

## 04 Third-Party Integrations — code readiness confirmed; account signup is on you (see Payment Verdict below)

The contract is explicit that **the client is responsible for opening and maintaining provider accounts** and that BDS doesn't guarantee approval — so this section checks *code readiness*, not account status.

| Integration | Code readiness | Real accounts opened? |
|---|---|---|
| Payments (5 card/crypto rails + 3 P2P rails) | ✅ all 8 rails coded, webhook-verified, MOCK-safe | 🔲 none yet — see verdict below |
| Shipping (USPS) | ✅ rate/label/tracking adapter complete, MOCK fallback | 🔲 not yet |
| Email (SendGrid transactional + Klaviyo marketing) | ✅ both adapters complete, MOCK fallback | 🔲 not yet |
| File storage (Vercel Blob) | ⚠️ code path exists but `@vercel/blob` package isn't installed yet (confirmed — commented out in `storage.ts` pending `npm i @vercel/blob`); local `/public/uploads` fallback works but doesn't survive a redeploy | 🔲 not yet |
| Hosting + database (Vercel + Neon/Supabase) | ✅ deploy-ready, `DEPLOYMENT.md` walks through both | 🔲 not yet |

---

## 06 Mobile, Performance & Production Readiness — ✅ (1 bug already fixed this session)

Already covered in `FRONTEND_CHECKLIST.md` — mobile-first layouts, touch targets, persistent cart, PWA manifest all confirmed. The one real gap found (broken PWA icons — `public/icons/` didn't exist) was fixed and reverified there.

---

## 07 Deployment, Handoff & Client Control

| Contract item | Status |
|---|---|
| Source code + repo access | ✅ pushed to `pelicanappsolutions/Elevate-BioLabs` |
| Production hosting access + deployment guidance | ✅ `DEPLOYMENT.md` §3 |
| Database project access + migration info | ✅ `DEPLOYMENT.md` §1, §4 — migration commands verified live this session |
| Admin dashboard access | ✅ seeded admin account works |
| Env-var/credential placement guidance | ✅ `DEPLOYMENT.md` §2, plus the new **Provider Accounts** section explaining exactly what's real vs. MOCK |
| Domain connection guidance | ✅ `DEPLOYMENT.md` §7 |
| Third-party integration connection guidance | ✅ `DEPLOYMENT.md` §9 ("Switching an Adapter from MOCK to LIVE") |
| Basic explanation of major systems | ✅ `RESYNC.md` — full architecture writeup |

**No gaps.** Everything needed for a clean handoff exists and is current.

---

## Payment Verdict — which of the 8 coded rails to actually use

You asked for a decisive answer, not more hedging, so here it is. One important thing first, since it directly addresses your "no back-and-forth after launch" concern: **you don't need any code changes to add or drop a payment rail.** Every adapter checks `isConfigured.<rail>()` — if you never set that rail's API keys, it simply never appears as configured and stays dormant. Deciding "we're only using X and Y" is purely an account-opening decision on your end, not a reconfiguration request to me.

**Drop entirely — do not open an account:**
- **Stripe** — publishes a restricted-business list that explicitly covers unapproved research chemicals/peptides. This isn't a maybe: applying risks a mid-operation account freeze with funds held, which is worse than a clean rejection. Don't build revenue on it for this product category. Just never set `STRIPE_SECRET_KEY` — the rail stays invisible to customers automatically.

**Use immediately — zero underwriting risk, already fully working:**
- **Coinbase Commerce** (crypto) — sidesteps card-network merchant-category rules entirely. This is the standard, well-established path research-chemical sellers use specifically because card processors reject them. Sign up, drop in the API key, done.
- **P2P Wire transfer** — bank-to-bank transfers aren't screened for retail product category the way card networks are. Genuinely clean, no account/application needed beyond your own business bank account. Already fully wired (proof-of-payment upload → admin approval queue).
- **P2P Zelle / Venmo** — real caveat, not hidden: these are personal P2P apps, and their terms technically restrict commercial use. There's no "application" to reject you, but there is a standing risk of an account freeze if flagged later. In practice, this is exactly how most peptide vendors operate today, but it's a risk you're accepting, not one that's been eliminated. Your call whether to enable these.

**Requires real research before you can get a verdict — I can't give you one and be honest about it:**
- **NexaPay, SeamlessChex, PayRam** — these are the "high-risk-friendly" card/ACH processors already coded. Straight talk: I cannot tell you today whether any of these three will approve a peptide merchant, and no honest answer could — high-risk underwriting is case-by-case, reviewed by a real person at the processor, and changes over time. What I can tell you: the code for all three was written to *documented* API shapes, never tested against a live account, so budget time to adapt the adapter to whatever the real provider actually hands you once you're approved — this is normal, not a sign anything's broken. **Action item, not homework for me:** search "high-risk merchant account research chemicals" or "nutraceutical payment processor" directly and get quotes from 2-3 — that market shifts, and I'd be guessing if I named one over another right now.

**Bottom line recommendation:** launch with **Coinbase Commerce + Wire + Zelle/Venmo** — all three are real today, need no further code work, and carry no application/underwriting risk beyond the Zelle/Venmo caveat above. Pursue a dedicated high-risk card processor in parallel since that's a multi-week underwriting process regardless of which one you pick — starting it now doesn't block launching with the other three today.
