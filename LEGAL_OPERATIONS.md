# Recommended Legal Operations & Compliance Build Plan

**Purpose:** Translate the compliance requirements ElevateBioLab received from legal/regulatory sources into a concrete map of site/software work, content work, physical operations, and business tasks. This is a **development & operations planning document**, not legal advice. Counsel is the authority on *what* is required; this doc organizes *how* the software supports it.

**Prepared:** 2026-07-20 · **Updated:** 2026-08-01 · **Status:** Path B (grey-area / individual-sales) confirmed by client 2026-08-01. Path A (institutional/IRB gate) is out of scope — do not build it. Shared + Path B build items below are unblocked.

**Guidance inputs absorbed:**
- **Input A ("institutional" model):** RUO is not a shield; sell **only to licensed research facilities** with IRB/oversight, institutional documentation, and chain-of-custody. FDA Final Guidance on Research-Grade Peptides (Mar 2025 / enforceable Jan 2026).
- **Input B ("grey-area / individual-sales" model):** A narrowing but real RUO grey area **permits selling to individuals** *if* the business operates as a **lab-supply vendor** — strict RUO/"not for human consumption" labeling, zero health claims, high-purity third-party COAs, high-risk payment + LegitScript, and careful product selection.

---

## ✅ Decision made: Path B (grey-area / individual sales)
Client confirmed 2026-08-01: operating as a lab-supply vendor selling to individuals, not institution-only. The institutional verification gate (Path A) will **not** be built. This is the client's business directive, not a legal opinion from BDS — counsel remains the authority on whether the underlying RUO labeling/claims/COA rigor this path requires is actually being met; nothing here substitutes for that review.

Inputs A and B originally pointed at **two different business models**, and which one you choose determines the whole software build:

| | **Path A — Institutional (B2B only)** | **Path B — Grey-area (sell to individuals)** |
|---|---|---|
| Who can buy | Verified research facilities w/ IRB oversight | Individuals, positioned as lab-supply customers |
| Gate before checkout | **Institutional verification required** (IRB, protocol, document upload, admin approval) | **No institutional gate** — but hard RUO labeling, no claims, strong COAs |
| Core software | Verification gate + chain-of-custody | Labeling/claims rigor + enhanced COAs + product-selection controls |
| Chain-of-custody to a protocol | Required | Not required (no institutional protocol) |

**These are mutually exclusive on the biggest feature: the institutional verification gate.** Build it for Path A; *don't* build it for Path B. **Do not start that build until counsel confirms which model ElevateBioLab is operating under.** Everything else below is largely shared.

---

## How to read this
Every requirement falls into one of four buckets:
- 🟦 **Software** — the site/app can enforce or record this. BDS builds it.
- 🟨 **Content** — copy/labels. BDS drafts; **counsel must approve** before it ships.
- 🟥 **Physical / operational** — packaging, fulfillment, shipping. **Not software.**
- ⬜ **Business / legal** — accounts, certifications, per-product calls. **Not code** — client action.

---

## Already implemented (baseline in place today)
| Capability | State |
|---|---|
| Age gate — 21+ / RUO self-attestation | ✅ live |
| Age/consent **audit logging** (IP + timestamp on "I am 21+") | ✅ live |
| RUO "For Research Use Only — Not for human consumption" notices across home / product / cart / checkout / compliance | ✅ live |
| **Account required to check out** (no anonymous guest orders) | ✅ live |
| Third-party **COA system** — per-strength batch/lot, purity, test date, public verify + certificate archive | ✅ live |
| Order → batch/lot linkage (OrderItem → variant → COA) | ✅ partial (custody foundation) |
| US-only shipping via required state + US ZIP validation; "US delivery only" notice | ✅ partial (not hard-blocked) |
| High-risk-friendly payment architecture (avoids Stripe/PayPal; crypto + P2P + high-risk rails) | ✅ live |
| **LegitScript readiness tracker** in admin | ✅ live |
| Admin **audit log** viewer (who did what, when, IP) | ✅ live |
| Per-compound / per-strength **active toggle** (disable any product in one click) | ✅ live |

---

## 🟦 Software to build

### 1. Institutional / researcher verification gate — **Path A ONLY**
Gate checkout on a verified research entity: collect institution name, IRB/oversight reference, research protocol ID, upload institutional documentation; admin review/approve; unverified accounts browse but **cannot check out**. Reuses the proof-of-payment upload+approve pattern.
- **Build only if counsel chooses Path A.** Under Path B this is *not needed* (and would block the individual sales the grey-area model depends on).
- **Needs before build:** exact fields, required documents, verification standard, expiry/re-verification.

### 2. Chain-of-custody records — **Path A ONLY**
Capture research protocol per order; link **order → verified buyer/institution → batch/lot (COA)**; admin custody view/export. Depends on #1.

### 3. Enhanced COA standard — **BOTH paths (heavier for Path B)**
Input B raises the bar: "a standard COA is no longer sufficient" for selling to individuals — expect **≥98% purity, third-party testing, and analytical panels like ICP-MS for heavy metals.**
- **Software:** extend the COA record beyond `purity` + `fileUrl` to capture test-panel metadata (e.g., heavy-metal / ICP-MS panel present, third-party lab name, purity method), and surface it on the product/verify pages so the quality story is visible.
- Under Path B this is a **primary trust/compliance mechanism** (it substitutes for institutional affiliation), so it's high priority there.

### 4. MSDS management — **BOTH paths**
Per-product/variant **MSDS upload** (mirror COA infra), shown on product pages and **downloadable with every order** (for shipment enclosure). Site hosts it; physical enclosure is 🟥 ops.

### 5. US-only enforcement (hardening) — **BOTH paths**
Turn soft US-only (address validation) into an **explicit block** so a non-US destination can't pass checkout.

### 6. Product-selection controls — **BOTH paths (already possible)**
Input B: **BPC-157 and TB-500 as finished/pre-mixed products "do not comply with current FDA regulations"** and should be reconsidered for individual sale. The active toggle already lets you **disable any compound/strength in one click** — no build needed; this is a client + counsel decision, and the tool is ready.

---

## 🟨 Content — BDS drafts, counsel approves

### Labeling wording (both containers)
Input B is specific: primary **and** secondary containers must carry "For Research Use Only" / "Not for Human Consumption," and copy should position products for **"laboratory purposes only"** — never as therapies. BDS can generate print-ready label PDFs; wording is counsel-approved.

### Claims / marketing audit
Disclaimers are already strong, but a scan flagged **benefit-framed labels** to review: category names **"Recovery & Repair"** and **"Longevity,"** category description **"Tissue repair and recovery,"** and product descriptions using words like "recovery."
- **Hold the line (per both inputs):** no weight-loss / muscle / anti-aging / recovery / therapeutic claims; no "generic" / "clinically proven"; nothing implying human consumption or treatment. Making a health claim **exits the grey area into the "unapproved drug" zone** (Input B).
- **Action:** BDS proposes research-framed rewrites; **counsel approves** before shipping.

---

## 🟥 Physical / operational — NOT software (client ops)
- RUO + "Not for Human Consumption" text on **actual vials** (primary + secondary). Site generates artwork; application is ops.
- **Physically enclosing** MSDS with every shipment.
- Handling / cold-chain / any custody paperwork in the box.

---

## ⬜ Business / legal — NOT code (client action)
- **High-risk merchant account** — apply; higher fees / reserves / monitoring. Per Input B, sellers with proper RUO labeling + disclaimers + COAs "are not the primary targets" and are more likely to get approved. Site is architected for it.
- **LegitScript certification** — increasingly the standard to unlock high-risk processors; pursue it. Admin tracks readiness.
- **Per-peptide legal calls** — BPC-157 status under evaluation; 2026 removal of 14 peptides from a restricted list is **not** deregulation. Client + counsel decide the catalog; site disables instantly.

---

## 2026 checklist → site responsibility → status
| Requirement | Bucket | Path | Site responsibility | Status |
|---|---|---|---|---|
| RUO labeling, primary + secondary containers | 🟥+🟨 | Both | Generate label PDF; apply = ops | ⬜ |
| No health / "generic" / "proven" claims | 🟨 | Both | Claims audit + rewrites (counsel approves) | ⬜ |
| High-purity 3rd-party COA (≥98%, ICP-MS panel) | 🟦+🟨 | Both (heavier B) | Extend COA data + surface it | ⬜ |
| MSDS with every shipment | 🟦+🟥 | Both | Host/attach per order; enclose = ops | ⬜ |
| Institutional (IRB) verification of purchaser | 🟦 | **A only** | Verification gate before checkout | N/A — Path B chosen, not building |
| Chain-of-custody to a protocol | 🟦 | **A only** | Protocol capture + custody export | N/A — Path B chosen, not building |
| Reconsider BPC-157 / TB-500 as finished products | ⬜ | Both | One-click disable available | client + counsel |
| High-risk merchant account | ⬜ | Both | Architecture ready | client action |
| LegitScript certification | ⬜ | Both | Readiness tracker in admin | client action |
| US-only / international caution | 🟦 | Both | Harden US-only enforcement | ⬜ (partial today) |
| Age / consent record | 🟦 | Both | ✅ audit-logged (IP + timestamp) | ✅ done |

---

## Recommended sequence (once path is chosen)
**Shared, path-independent — safe to build anytime:**
1. **Enhanced COA fields** (purity method, heavy-metal/ICP-MS panel, third-party lab) — central to Path B, valuable in both.
2. **MSDS management** — upload + per-order download.
3. **US-only enforcement** — hard block.
4. **Claims/content audit** — flag + propose rewrites for counsel (low risk, parallel).

**Path-dependent — not applicable, Path B chosen:**
5. ~~(Path A only) Institutional verification gate, then chain-of-custody records~~ — out of scope.

**Client-side in parallel:** physical labeling/MSDS enclosure (🟥), high-risk merchant + LegitScript (⬜), and the BPC-157/TB-500 catalog decision (one-click disable ready).

---

*This document is an engineering/operations plan derived from guidance the client received about their legal/regulatory obligations. It is not itself legal advice, and where the two guidance inputs conflict (notably institutional-only vs. individual sales) that conflict must be resolved by qualified counsel — this doc only shows how each path maps to software. BDS provides software development and technical implementation, not legal, medical, regulatory, or payment-processing advice (per the project agreement).*
