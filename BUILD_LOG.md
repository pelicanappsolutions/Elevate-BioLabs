# Build Log — Soft Launch Ops

Living log of production readiness work for **elevate-bio-labs**  
Repo: `pelicanappsolutions/Elevate-BioLabs` · Prod: `https://elevatebiolab.com`  
Vercel: `pelicanapps-projects/elevate-bio-labs`

Use Vercel CLI for checks (`vercel ls --prod`, `vercel env ls production`, `vercel inspect elevatebiolab.com`). Do not dump secret values into this file.

---

## Soft-launch rails

| Rail | Status | Notes |
|------|--------|--------|
| NOWPayments (crypto) | Live keys on Vercel | IPN must hit unified webhook path (below) |
| Zelle / Venmo | Handles on Vercel | Manual admin confirm OK without IMAP |
| SeamlessChex | Waiting | Keys not set |
| USPS | Waiting | Client ID/secret not set; Shippo key already present |
| Shippo | Key on Vercel | Pending partner/ops use |

Compliance bar for soft launch: RUO warnings, age verification, account required. LabProfile / heavy proof screening deferred unless a processor requires it.

---

## Production snapshot (2026-08-02, Vercel CLI)

- Domain alias: Ready on `elevatebiolab.com`
- Home: `200`
- Checkout: `307` → login (auth gate)
- NOWPayments IPN probe: `POST /api/webhooks/payment/nowpayments` → `400 Invalid signature` (route live; unsigned rejected)

### Env present (production)

`NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_WEBHOOK_SECRET`, `NOWPAYMENTS_BASE_URL`, `P2P_ZELLE_HANDLE`, `P2P_VENMO_HANDLE`, `SHIPPO_API_KEY`, `SENDGRID_*`, `AUTH_SECRET` / `NEXTAUTH_SECRET`, `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXTAUTH_URL`, `BLOB_READ_WRITE_TOKEN`, age-gate / ship-from vars

### Env missing (production)

`CRON_SECRET`, `P2P_EMAIL_IMAP_*`, `SEAMLESSCHEX_API_KEY` / `_WEBHOOK_SECRET`, `USPS_CLIENT_ID` / `_SECRET`, `KLAVIYO_API_KEY`

---

## Money / security fixes shipped

| Item | Notes |
|------|--------|
| Checkout rail allowlist | Shared UI + server (`available-rails.ts`) |
| `createCharge` failure | Cancel + restock |
| Unsigned webhooks | Rejected in production |
| Proof upload | Auth + ownership |
| Success page | Owner-only; login keeps `?order=` |
| Address update | IDOR fix |
| Cancel / refund | Idempotent restock |
| Cron auth | Accepts `CRON_SECRET` (set when ready) |
| `AUTH_SECRET` | Production rejects missing / `dev-secret` |
| Age at checkout | Server-side `ageConfirm` + `ageVerified` |
| Reset password | Same `passwordRule` as register |
| Rate limits | Postgres `RateLimitBucket` migration |
| Order email | Enriched confirmation; webhook can send `PAYMENT_RECEIVED` |

### NOWPayments IPN (customer “can’t see money”)

Root cause was our IPN handling, not custody:

1. Checkout stored invoice `id`; IPN sends different `payment_id` → no match  
2. HMAC must be **sorted-key** HMAC-SHA512 (not raw body alone)  
3. `payment_id` often numeric; string-only matching failed  

**Fix:** sorted signature, numeric IDs, match `payment_id` / `invoice_id` / `order_id`, update `providerRef` after match.  
Files: `src/lib/payments/nowpayments.ts`, `src/app/api/webhooks/payment/[rail]/route.ts`, types.

**IPN URL (dashboard + invoice create):**

```text
https://elevatebiolab.com/api/webhooks/payment/nowpayments
```

Wrong path (404): `/api/webhooks/nowpayments`

---

## Cron / Hobby note

Sub-daily schedules (`*/15`, `0 */6`) fail on Vercel Hobby. Production crons are **daily** (`vercel.json`: tracking `0 6`, P2P `0 7`). For 15‑minute P2P email sync: upgrade to Pro, restore sub-daily schedules, set `CRON_SECRET`.

---

## Deferred

- **#12** LabProfile / chargeback writers / compliance doc editor — skip unless processor requires  
- Broader test coverage  
- IMAP auto-match for Zelle/Venmo (manual confirm works)  
- SeamlessChex + USPS until partner credentials arrive  
- Klaviyo until marketing is needed  

---

## Next (checklist)

- [ ] NOWPayments dashboard IPN URL = `/api/webhooks/payment/nowpayments`
- [ ] One small crypto test order → order `PAID` + confirmation email
- [ ] Optional: `vercel env add CRON_SECRET production`
- [ ] When partners reply: SeamlessChex + USPS keys; re-verify rails
- [ ] Optional: Vercel Pro if frequent P2P IMAP sync is required

### CLI smoke (no secrets)

```bash
vercel whoami
vercel ls --prod
vercel env ls production
vercel inspect elevatebiolab.com
curl -sI https://elevatebiolab.com
curl -s -X POST https://elevatebiolab.com/api/webhooks/payment/nowpayments \
  -H "Content-Type: application/json" -d "{}"
# expect: {"error":"Invalid signature"}
```

---

## Entry log

| Date | Note |
|------|------|
| 2026-08-02 | Soft-launch money/security pass; NOWPayments IPN fix; Hobby cron rollback to daily; Vercel CLI prod audit; this log created |
| 2026-08-02 | Cookie Accept/Reject gates optional Klaviyo onsite + GA scripts; essential auth/cart unchanged |
| 2026-08-02 | Site-wide age requirement raised 18+ → 21+ (gate, checkout, copy, Vercel MIN_AGE) |
| 2026-08-02 | Admin category create/rename/delete; MOTS-c seed category → Longevity |
| 2026-08-03 | Persist NOWPayments invoice URL for abandoned checkout recovery; admin email on crypto PAID |
| 2026-08-03 | Affiliate coupons: Admin → Coupons CRUD, checkout apply, redemption + commission paid/unpaid tracking |
| 2026-08-03 | LA sales tax soft-launch: flat 10.25% on LA ship-tos (state+local); charged into order total for all rails |
| 2026-08-04 | Live Shippo key on production; add SHIP_FROM_EMAIL/PHONE to fix Shippo label "address_from.email" errors |
