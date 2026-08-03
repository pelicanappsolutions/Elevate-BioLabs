/**
 * SendGrid — transactional email.
 *
 * sendEmail() posts to the SendGrid v3 Mail Send API when a key is present,
 * otherwise logs and returns { ok: true, mock: true } so local dev never needs
 * credentials. Also exports a few tiny inline-styled, mobile-friendly HTML
 * template builders. Templates accept `any` order objects to avoid tight
 * coupling to the Prisma schema.
 */
import { env, isConfigured } from "@/lib/env";
import { unsubscribeUrl } from "@/lib/unsubscribe";
import {
  PAYMENT_RAIL_META,
  type PaymentRailName,
} from "@/lib/payments/meta";

export async function sendEmail(input: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  /** When set, attach List-Unsubscribe headers + optional SendGrid ASM group. */
  marketing?: {
    unsubscribeLink: string;
    oneClickUrl?: string;
    asmGroupId?: number | null;
  };
}): Promise<{ ok: boolean; mock: boolean; status?: number; error?: string }> {
  if (!isConfigured.sendgrid()) {
    // MOCK mode.
    // eslint-disable-next-line no-console
    console.log(
      `[email:sendgrid MOCK] to=${JSON.stringify(input.to)} subject="${input.subject}"`
    );
    return { ok: true, mock: true };
  }

  const recipients = (Array.isArray(input.to) ? input.to : [input.to])
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!recipients.length) {
    return { ok: false, mock: false, error: "No recipient email" };
  }

  const replyTo = (input.replyTo ?? env.contactEmail ?? env.sendgrid.fromEmail).trim();
  const marketing = input.marketing;
  let oneClickApi = marketing?.oneClickUrl ?? null;
  if (!oneClickApi && marketing?.unsubscribeLink) {
    try {
      const token = new URL(marketing.unsubscribeLink).searchParams.get("token");
      if (token) {
        oneClickApi = `${env.SITE_URL}/api/unsubscribe?token=${encodeURIComponent(token)}`;
      }
    } catch {
      oneClickApi = null;
    }
  }

  const payload: Record<string, unknown> = {
    personalizations: [{ to: recipients.map((email) => ({ email })) }],
    from: { email: env.sendgrid.fromEmail, name: env.sendgrid.fromName },
    ...(replyTo ? { reply_to: { email: replyTo } } : {}),
    subject: input.subject,
    content: [
      {
        type: "text/plain",
        value: input.text ?? stripHtml(input.html),
      },
      { type: "text/html", value: input.html },
    ],
  };

  if (marketing?.unsubscribeLink) {
    const listUnsub = oneClickApi
      ? `<${oneClickApi}>, <${marketing.unsubscribeLink}>`
      : `<${marketing.unsubscribeLink}>`;
    payload.headers = {
      "List-Unsubscribe": listUnsub,
      ...(oneClickApi ? { "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } : {}),
    };
  }

  if (marketing?.asmGroupId && marketing.asmGroupId > 0) {
    payload.asm = {
      group_id: marketing.asmGroupId,
      groups_to_display: [marketing.asmGroupId],
    };
  }

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.sendgrid.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    // eslint-disable-next-line no-console
    console.error(`[email:sendgrid] send failed: ${res.status} ${body}`);
    return { ok: false, mock: false, status: res.status, error: body };
  }

  return { ok: true, mock: false, status: res.status };
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Template builders (inline-styled, max-width 600, mobile-friendly)
//
// Design tokens (kept in sync across all templates):
//   navy   #0f2e4c  brand / header
//   accent #1e6fd9  links + primary buttons
//   green  #15803d  order-confirmed accent
//   ink    #1a2b3c  body text
//   muted  #6b7a89  secondary text
//   line   #e6ebf0  borders
//   canvas #eef2f6  page background
// Everything is table-based + inline-styled so it survives Outlook/Gmail.
// ---------------------------------------------------------------------------

const BRAND = {
  navy: "#0f2e4c",
  accent: "#1e6fd9",
  green: "#15803d",
  ink: "#1a2b3c",
  muted: "#6b7a89",
  line: "#e6ebf0",
  canvas: "#eef2f6",
  subtle: "#f5f8fb",
};

const SUPPORT_EMAIL = env.contactEmail;

function money(cents: unknown): string {
  const n = typeof cents === "number" ? cents : Number(cents ?? 0);
  return `$${(n / 100).toFixed(2)}`;
}

function formatDate(input: unknown): string {
  try {
    const d = input instanceof Date ? input : new Date(input as string);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return "";
  }
}

/** Hidden inbox-preview text shown next to the subject in most clients. */
function preheader(text: string): string {
  return `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#eef2f6;opacity:0;">${escapeHtml(
    text
  )}</div>`;
}

/** Bulletproof (Outlook-safe) button. */
function button(href: string, label: string, color: string = BRAND.accent): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0;"><tr>
    <td align="center" style="border-radius:8px;background:${color};">
      <a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 30px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;line-height:1;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(
        label
      )}</a>
    </td></tr></table>`;
}

/** Small colored status pill. */
function pill(label: string, color: string): string {
  return `<span style="display:inline-block;padding:5px 12px;border-radius:999px;background:${color}1a;color:${color};font-size:12px;font-weight:700;letter-spacing:0.4px;text-transform:uppercase;">${escapeHtml(
    label
  )}</span>`;
}

/** Formats a frozen shipTo JSON snapshot into an address block. */
function addressBlock(shipTo: any): string {
  if (!shipTo || typeof shipTo !== "object") return "";
  const line2 = shipTo.street2 ? `${escapeHtml(shipTo.street2)}<br/>` : "";
  const phone = shipTo.phone
    ? `<br/><span style="color:${BRAND.muted};">Phone: ${escapeHtml(String(shipTo.phone))}</span>`
    : "";
  return `
    <div style="font-size:14px;line-height:1.5;color:${BRAND.ink};">
      ${shipTo.fullName ? `<strong>${escapeHtml(shipTo.fullName)}</strong><br/>` : ""}
      ${shipTo.street1 ? `${escapeHtml(shipTo.street1)}<br/>` : ""}
      ${line2}
      ${escapeHtml(shipTo.city ?? "")}${shipTo.city ? ", " : ""}${escapeHtml(shipTo.state ?? "")} ${escapeHtml(
        shipTo.zip ?? ""
      )}
      ${phone}
    </div>`;
}

function paymentRailLabel(rail: unknown): string {
  const key = String(rail ?? "") as PaymentRailName;
  return PAYMENT_RAIL_META[key]?.label ?? String(rail ?? "Payment").replace(/_/g, " ");
}

function formatShipService(service: unknown): string {
  if (!service) return "";
  return String(service).replace(/_/g, " ");
}

/** A light "info card" wrapper with an optional label. */
function card(inner: string, label?: string): string {
  return `
    ${label ? `<div style="font-size:12px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:${BRAND.muted};margin:0 0 8px;">${escapeHtml(label)}</div>` : ""}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.subtle};border:1px solid ${BRAND.line};border-radius:10px;margin:0 0 22px;">
      <tr><td style="padding:16px 18px;">${inner}</td></tr>
    </table>`;
}

function shell(
  title: string,
  preview: string,
  body: string,
  opts?: { unsubscribeHref?: string }
): string {
  const unsub = opts?.unsubscribeHref
    ? `<div style="margin-top:14px;font-size:11px;line-height:1.5;color:#9aa8b5;text-align:center;">
        You're receiving this because you opted in to ElevateBioLab updates.<br/>
        <a href="${escapeHtml(opts.unsubscribeHref)}" style="color:#9aa8b5;text-decoration:underline;">Unsubscribe</a>
        from marketing emails anytime.
      </div>`
    : `<span style="color:#9aa8b5;">You're receiving this because you placed an order or created an account with ElevateBioLab.</span>`;

  return `<!-- ${title} -->
${preheader(preview)}
<div style="margin:0;padding:0;background:${BRAND.canvas};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.canvas};padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid ${BRAND.line};font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${BRAND.ink};">
        <tr><td style="background:${BRAND.navy};padding:22px 28px;">
          <span style="color:#ffffff;font-size:19px;font-weight:800;letter-spacing:1.5px;">ELEVATE BIO-LABS</span>
          <div style="color:#9fb8cf;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-top:3px;">Analytical Standards · RUO</div>
        </td></tr>
        <tr><td style="padding:30px 28px 8px;">
          ${body}
        </td></tr>
        <tr><td style="padding:22px 28px;background:${BRAND.subtle};border-top:1px solid ${BRAND.line};color:${BRAND.muted};font-size:12px;line-height:1.6;">
          <strong style="color:${BRAND.ink};">For Research Use Only (RUO)</strong> — not for human or veterinary use, food, or drug applications.<br/>
          Questions? <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND.accent};text-decoration:none;">${SUPPORT_EMAIL}</a><br/>
          ${unsub}
        </td></tr>
      </table>
    </td></tr>
  </table>
</div>`;
}

/** Marketing / promotional blast HTML with a small-font unsubscribe footer. */
export function promotionalHtml(input: {
  email: string;
  headline?: string;
  bodyHtml?: string;
}): string {
  const href = unsubscribeUrl(input.email);
  const headline = input.headline ?? "Updates from ElevateBioLab";
  const bodyInner =
    input.bodyHtml ??
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:${BRAND.muted};">
      New analytical standards, batch releases, and lab updates — only when they're useful.
    </p>
    <div style="margin:0 0 8px;">${button(env.SITE_URL + "/products", "Browse the catalog")}</div>`;

  const body = `
    <div style="margin:0 0 14px;">${pill("Update", BRAND.accent)}</div>
    <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;color:${BRAND.ink};">${escapeHtml(headline)}</h1>
    ${bodyInner}`;

  return shell("Promotional", headline, body, { unsubscribeHref: href });
}

export function orderConfirmationHtml(order: any): string {
  const items: any[] = Array.isArray(order?.items) ? order.items : [];
  const orderNo = escapeHtml(order?.orderNumber ?? "");
  const orderNumberRaw = String(order?.orderNumber ?? "");
  const placed = formatDate(order?.createdAt);
  const rail = order?.rail ?? order?.payments?.[0]?.rail;
  const isP2P = ["P2P_ZELLE", "P2P_VENMO", "P2P_WIRE"].includes(String(rail ?? ""));
  const instructions = order?.instructions;
  const redirectUrl =
    typeof order?.redirectUrl === "string" && order.redirectUrl.startsWith("http")
      ? order.redirectUrl
      : "";
  const successUrl = orderNumberRaw
    ? `${env.SITE_URL}/checkout/success?order=${encodeURIComponent(orderNumberRaw)}`
    : `${env.SITE_URL}/dashboard`;
  const shipService = formatShipService(order?.shipService);

  const rows = items
    .map((it, i) => {
      const qty = Number(it?.quantity ?? 1);
      const unit = it?.unitPriceCents ?? it?.priceCents;
      const lineTotal = it?.totalCents ?? (Number(unit ?? 0) * qty);
      const border = i === 0 ? "" : `border-top:1px solid ${BRAND.line};`;
      const sku = it?.sku ? ` · SKU ${escapeHtml(String(it.sku))}` : "";
      return `
      <tr>
        <td style="padding:12px 0;${border}font-size:14px;color:${BRAND.ink};vertical-align:top;">
          <div style="font-weight:600;">${escapeHtml(it?.name ?? "Research compound")}</div>
          <div style="color:${BRAND.muted};font-size:12px;margin-top:2px;">Qty ${qty} · ${money(unit)} each${sku}</div>
        </td>
        <td style="padding:12px 0;${border}font-size:14px;font-weight:600;text-align:right;color:${BRAND.ink};vertical-align:top;white-space:nowrap;">
          ${money(lineTotal)}
        </td>
      </tr>`;
    })
    .join("");

  // Cost breakdown — only render discount row when there is one.
  const discount = Number(order?.discountCents ?? 0);
  const totalsRow = (label: string, value: string, opts: { bold?: boolean } = {}) => `
    <tr>
      <td style="padding:4px 0;font-size:${opts.bold ? "16px" : "14px"};color:${opts.bold ? BRAND.ink : BRAND.muted};font-weight:${opts.bold ? "700" : "400"};">${label}</td>
      <td style="padding:4px 0;font-size:${opts.bold ? "16px" : "14px"};color:${BRAND.ink};font-weight:${opts.bold ? "700" : "400"};text-align:right;white-space:nowrap;">${value}</td>
    </tr>`;

  const itemsCard = card(`
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;border-top:2px solid ${BRAND.line};padding-top:6px;">
      <tr><td style="height:8px;"></td></tr>
      ${totalsRow("Subtotal", money(order?.subtotalCents))}
      ${totalsRow(
        shipService ? `Shipping (${escapeHtml(shipService)})` : "Shipping",
        Number(order?.shippingCents ?? 0) === 0 ? "FREE" : money(order?.shippingCents)
      )}
      ${totalsRow("Tax", money(order?.taxCents))}
      ${discount > 0 ? totalsRow("Discount", `−${money(discount)}`) : ""}
      <tr><td colspan="2" style="border-top:1px solid ${BRAND.line};height:8px;"></td></tr>
      ${totalsRow("Total due", money(order?.totalCents), { bold: true })}
    </table>
  `, "Order summary");

  const shipCard = order?.shipTo ? card(addressBlock(order.shipTo), "Shipping to") : "";

  const paymentSummary = rail
    ? card(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:${BRAND.ink};line-height:1.5;">
          <tr><td style="padding:3px 0;"><strong>Method:</strong> ${escapeHtml(paymentRailLabel(rail))}</td></tr>
          <tr><td style="padding:3px 0;"><strong>Amount:</strong> ${money(order?.totalCents)}</td></tr>
          <tr><td style="padding:3px 0;"><strong>Status:</strong> ${escapeHtml(
            String(order?.status ?? (isP2P ? "AWAITING_REVIEW" : "PENDING_PAYMENT")).replace(/_/g, " ")
          )}</td></tr>
        </table>`,
        "Payment"
      )
    : "";

  const p2pCard =
    isP2P && instructions
      ? card(
          `
      <p style="margin:0 0 12px;font-size:14px;line-height:1.5;color:${BRAND.ink};">
        Your order is held until we confirm payment. Send the <strong>exact</strong> amount and use the memo below so we can match it.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:${BRAND.ink};line-height:1.5;">
        <tr><td style="padding:3px 0;"><strong>Method:</strong> ${escapeHtml(instructions.method)}</td></tr>
        <tr><td style="padding:3px 0;"><strong>Send to:</strong> <span style="font-family:ui-monospace,Consolas,monospace;font-weight:700;">${escapeHtml(instructions.handle)}</span></td></tr>
        <tr><td style="padding:3px 0;"><strong>Exact amount:</strong> <span style="font-weight:700;">${money(order?.totalCents)}</span></td></tr>
        <tr><td style="padding:3px 0;"><strong>Memo / reference:</strong> <span style="font-family:ui-monospace,Consolas,monospace;font-weight:700;">${escapeHtml(instructions.memo)}</span></td></tr>
        <tr><td style="padding:10px 0 0;color:${BRAND.muted};font-size:13px;">${escapeHtml(instructions.note)}</td></tr>
      </table>
    `,
          "Action required — send payment"
        )
      : "";

  const payOnline =
    !isP2P && redirectUrl
      ? `<div style="margin:0 0 22px;text-align:center;">
          <p style="margin:0 0 10px;font-size:14px;color:${BRAND.muted};">Finish checkout with your selected payment method:</p>
          ${button(redirectUrl, "Complete payment", BRAND.navy)}
        </div>`
      : "";

  const viewOrderCta = `
    <div style="margin:0 0 22px;text-align:center;">
      ${button(successUrl, isP2P ? "View payment instructions" : "View your order")}
      <div style="margin-top:8px;font-size:12px;color:${BRAND.muted};">
        Or open your account:
        <a href="${escapeHtml(env.SITE_URL + "/dashboard")}" style="color:${BRAND.accent};text-decoration:none;">Dashboard</a>
      </div>
    </div>`;

  const nextSteps = card(
    `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:${BRAND.ink};line-height:1.5;">
      ${
        isP2P
          ? `<tr><td style="padding:2px 0;"><strong style="color:${BRAND.accent};">1.</strong>&nbsp; Send <strong>${money(order?.totalCents)}</strong> with memo <strong>${escapeHtml(String(instructions?.memo ?? orderNumberRaw))}</strong>.</td></tr>
             <tr><td style="padding:2px 0;"><strong style="color:${BRAND.accent};">2.</strong>&nbsp; We match your payment (usually within a few hours) and email you when it clears.</td></tr>
             <tr><td style="padding:2px 0;"><strong style="color:${BRAND.accent};">3.</strong>&nbsp; We pack, QC-check, and ship — you'll get tracking when it leaves.</td></tr>
             <tr><td style="padding:2px 0;"><strong style="color:${BRAND.accent};">4.</strong>&nbsp; Each vial includes a batch-matched Certificate of Analysis.</td></tr>`
          : redirectUrl
            ? `<tr><td style="padding:2px 0;"><strong style="color:${BRAND.accent};">1.</strong>&nbsp; Complete payment using the button above if you haven't already.</td></tr>
               <tr><td style="padding:2px 0;"><strong style="color:${BRAND.accent};">2.</strong>&nbsp; Once paid, we prepare and QC-check your order.</td></tr>
               <tr><td style="padding:2px 0;"><strong style="color:${BRAND.accent};">3.</strong>&nbsp; You'll get a tracking email the moment it ships.</td></tr>
               <tr><td style="padding:2px 0;"><strong style="color:${BRAND.accent};">4.</strong>&nbsp; Each vial ships with a batch-matched Certificate of Analysis.</td></tr>`
            : `<tr><td style="padding:2px 0;"><strong style="color:${BRAND.accent};">1.</strong>&nbsp; We're preparing and QC-checking your order.</td></tr>
               <tr><td style="padding:2px 0;"><strong style="color:${BRAND.accent};">2.</strong>&nbsp; You'll get a tracking email the moment it ships.</td></tr>
               <tr><td style="padding:2px 0;"><strong style="color:${BRAND.accent};">3.</strong>&nbsp; Each vial ships with a batch-matched Certificate of Analysis.</td></tr>`
      }
    </table>
  `,
    "What happens next"
  );

  const headline = isP2P
    ? "Thanks — one more step to complete payment"
    : "Thanks — your order is in.";
  const pillLabel = isP2P ? "Payment needed" : "Order confirmed";
  const pillColor = isP2P ? BRAND.accent : BRAND.green;

  const body = `
    <div style="margin:0 0 14px;">${pill(pillLabel, pillColor)}</div>
    <h1 style="margin:0 0 8px;font-size:24px;line-height:1.25;color:${BRAND.ink};">${headline}</h1>
    <p style="margin:0 0 22px;font-size:15px;line-height:1.55;color:${BRAND.muted};">
      Order <strong style="color:${BRAND.ink};">${orderNo}</strong>${placed ? ` · placed ${placed}` : ""} · total <strong style="color:${BRAND.ink};">${money(order?.totalCents)}</strong>.
      ${isP2P ? " Use the payment details below so we can release your order." : " Here's everything you ordered."}
    </p>
    ${p2pCard}
    ${payOnline}
    ${viewOrderCta}
    ${itemsCard}
    ${paymentSummary}
    ${shipCard}
    ${nextSteps}
    <p style="margin:14px 0 0;font-size:13px;color:${BRAND.muted};line-height:1.5;">
      Need to make a change? Reply to this email or reach us at
      <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND.accent};text-decoration:none;">${SUPPORT_EMAIL}</a>.
    </p>
    <p style="margin:12px 0 0;font-size:11px;color:${BRAND.muted};line-height:1.5;">
      For Research Use Only. Products are analytical reference standards — not for human or veterinary consumption.
    </p>`;

  return shell(
    "Order Confirmation",
    isP2P
      ? `Action needed: pay ${money(order?.totalCents)} for order ${order?.orderNumber ?? ""}`
      : `Order ${order?.orderNumber ?? ""} confirmed — ${money(order?.totalCents)} total`,
    body
  );
}

/** Internal alert to the shop inbox when a customer places a new order. */
export function newOrderAdminHtml(order: any): string {
  const orderNo = escapeHtml(order?.orderNumber ?? "");
  const rail = escapeHtml(String(order?.rail ?? order?.payments?.[0]?.rail ?? "—").replace(/_/g, " "));
  const email = escapeHtml(order?.customerEmail ?? order?.guestEmail ?? "—");
  const items: any[] = Array.isArray(order?.items) ? order.items : [];
  const rows = items
    .map(
      (it) =>
        `<tr>
          <td style="padding:6px 0;font-size:14px;color:${BRAND.ink};border-top:1px solid ${BRAND.line};">${escapeHtml(it?.name ?? "Item")}</td>
          <td style="padding:6px 0;font-size:14px;color:${BRAND.muted};border-top:1px solid ${BRAND.line};text-align:center;">× ${Number(it?.quantity ?? 1)}</td>
          <td style="padding:6px 0;font-size:14px;color:${BRAND.ink};border-top:1px solid ${BRAND.line};text-align:right;">${money(it?.totalCents)}</td>
        </tr>`
    )
    .join("");

  const adminUrl = `${env.SITE_URL}/admin/orders/${escapeHtml(order?.id ?? "")}`;

  const body = `
    <div style="margin:0 0 14px;">${pill("New order", BRAND.accent)}</div>
    <h1 style="margin:0 0 8px;font-size:24px;line-height:1.25;color:${BRAND.ink};">New order ${orderNo}</h1>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.55;color:${BRAND.muted};">
      A customer just placed an order. Total <strong style="color:${BRAND.ink};">${money(order?.totalCents)}</strong> via <strong style="color:${BRAND.ink};">${rail}</strong>.
    </p>
    ${card(
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:${BRAND.ink};line-height:1.5;">
        <tr><td style="padding:3px 0;"><strong>Customer:</strong> ${email}</td></tr>
        <tr><td style="padding:3px 0;"><strong>Status:</strong> ${escapeHtml(String(order?.status ?? "PENDING_PAYMENT").replace(/_/g, " "))}</td></tr>
        <tr><td style="padding:3px 0;"><strong>Payment:</strong> ${rail}</td></tr>
      </table>`,
      "Order details"
    )}
    ${items.length ? card(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`, "Items") : ""}
    ${order?.shipTo ? card(addressBlock(order.shipTo), "Ship to") : ""}
    <div style="margin:18px 0 0;">${button(adminUrl, "Open in admin")}</div>`;

  return shell("New Order", `New order ${order?.orderNumber ?? ""} — ${money(order?.totalCents)}`, body);
}

/** Sent when admin confirms payment / notifies that the order is being prepared to ship. */
export function paymentReceivedHtml(order: any): string {
  const orderNo = escapeHtml(order?.orderNumber ?? "");
  const items: any[] = Array.isArray(order?.items) ? order.items : [];
  const rows = items
    .map(
      (it, i) =>
        `<div style="font-size:14px;color:${BRAND.ink};padding:${i === 0 ? "0" : "8px"} 0 0;${
          i === 0 ? "" : `border-top:1px solid ${BRAND.line};margin-top:8px;`
        }"><strong>${escapeHtml(it?.name ?? "Research compound")}</strong> <span style="color:${BRAND.muted};">× ${Number(
          it?.quantity ?? 1
        )}</span></div>`
    )
    .join("");

  const itemsCard = items.length ? card(rows, "Your order") : "";
  const shipCard = order?.shipTo ? card(addressBlock(order.shipTo), "Shipping to") : "";

  const body = `
    <div style="margin:0 0 14px;">${pill("Payment received", BRAND.green)}</div>
    <h1 style="margin:0 0 8px;font-size:24px;line-height:1.25;color:${BRAND.ink};">We've got your payment.</h1>
    <p style="margin:0 0 22px;font-size:15px;line-height:1.55;color:${BRAND.muted};">
      Order <strong style="color:${BRAND.ink};">${orderNo}</strong> is confirmed and being prepared for shipment. You'll get another email with tracking as soon as it leaves our facility.
    </p>
    ${itemsCard}
    ${shipCard}
    ${card(
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:${BRAND.ink};line-height:1.5;">
        <tr><td style="padding:2px 0;"><strong style="color:${BRAND.accent};">1.</strong>&nbsp; Payment verified — thank you.</td></tr>
        <tr><td style="padding:2px 0;"><strong style="color:${BRAND.accent};">2.</strong>&nbsp; We're packing and QC-checking your order now.</td></tr>
        <tr><td style="padding:2px 0;"><strong style="color:${BRAND.accent};">3.</strong>&nbsp; Tracking details arrive the moment it ships.</td></tr>
      </table>`,
      "What happens next"
    )}
    <p style="margin:14px 0 0;font-size:13px;color:${BRAND.muted};line-height:1.5;">
      Questions? Reply to this email or reach us at
      <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND.accent};text-decoration:none;">${SUPPORT_EMAIL}</a>.
    </p>`;

  return shell(
    "Payment Received",
    `Payment received for order ${order?.orderNumber ?? ""} — preparing to ship`,
    body
  );
}

export function shipmentTrackingHtml(order: any): string {
  const tracking = order?.trackingNumber ?? order?.tracking ?? "";
  const carrier = order?.carrier ?? "USPS";
  const service = order?.shipService
    ? String(order.shipService).replace(/_/g, " ").replace(/\bUSPS\b/i, "USPS")
    : "";
  const url =
    order?.trackingUrl ??
    (tracking ? `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(tracking)}` : "");

  const items: any[] = Array.isArray(order?.items) ? order.items : [];
  const itemsList = items.length
    ? card(
        items
          .map(
            (it, i) =>
              `<div style="font-size:14px;color:${BRAND.ink};padding:${i === 0 ? "0" : "8px"} 0 0;${
                i === 0 ? "" : `border-top:1px solid ${BRAND.line};margin-top:8px;`
              }"><strong>${escapeHtml(it?.name ?? "Research compound")}</strong> <span style="color:${BRAND.muted};">× ${Number(
                it?.quantity ?? 1
              )}</span></div>`
          )
          .join(""),
        "In this shipment"
      )
    : "";

  const trackingCard = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.subtle};border:1px solid ${BRAND.line};border-radius:10px;margin:0 0 20px;">
      <tr><td style="padding:20px;text-align:center;">
        <div style="font-size:12px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:${BRAND.muted};margin-bottom:6px;">Tracking number</div>
        <div style="font-size:20px;font-weight:800;letter-spacing:0.5px;color:${BRAND.ink};word-break:break-all;">${escapeHtml(
          tracking || "Pending"
        )}</div>
        ${carrier || service ? `<div style="font-size:13px;color:${BRAND.muted};margin-top:6px;">${escapeHtml(carrier)}${service ? ` · ${escapeHtml(service)}` : ""}</div>` : ""}
      </td></tr>
    </table>
    ${url ? `<div style="text-align:center;margin:0 0 22px;">${button(url, "Track your package", BRAND.navy)}</div>` : ""}`;

  const shipCard = order?.shipTo ? card(addressBlock(order.shipTo), "Delivering to") : "";

  const body = `
    <div style="margin:0 0 14px;">${pill("Shipped", BRAND.accent)}</div>
    <h1 style="margin:0 0 8px;font-size:24px;line-height:1.25;color:${BRAND.ink};">Your order is on the way.</h1>
    <p style="margin:0 0 22px;font-size:15px;line-height:1.55;color:${BRAND.muted};">
      Order <strong style="color:${BRAND.ink};">${escapeHtml(order?.orderNumber ?? "")}</strong> has left our facility. Track it below.
    </p>
    ${trackingCard}
    ${itemsList}
    ${shipCard}
    <p style="margin:14px 0 0;font-size:13px;color:${BRAND.muted};line-height:1.5;">
      Tracking can take a few hours to show movement. Questions?
      <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND.accent};text-decoration:none;">${SUPPORT_EMAIL}</a>.
    </p>`;

  return shell(
    "Shipment Tracking",
    `Order ${order?.orderNumber ?? ""} has shipped${tracking ? ` — ${tracking}` : ""}`,
    body
  );
}

export function passwordResetHtml(url: string): string {
  const body = `
    <div style="margin:0 0 14px;">${pill("Security", BRAND.navy)}</div>
    <h1 style="margin:0 0 8px;font-size:24px;line-height:1.25;color:${BRAND.ink};">Reset your password</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:${BRAND.muted};">
      We received a request to reset the password for your ElevateBioLab account. Click below to choose a new one.
    </p>
    <div style="margin:0 0 18px;">${button(url, "Reset password")}</div>
    ${card(
      `<div style="font-size:13px;color:${BRAND.muted};line-height:1.5;">This link expires in <strong style="color:${BRAND.ink};">1 hour</strong>. If the button doesn't work, copy and paste this URL:<br/><a href="${escapeHtml(
        url
      )}" style="color:${BRAND.accent};word-break:break-all;">${escapeHtml(url)}</a></div>`
    )}
    <p style="margin:6px 0 0;font-size:13px;color:${BRAND.muted};line-height:1.5;">
      Didn't request this? You can safely ignore this email — your password won't change.
    </p>`;

  return shell("Password Reset", "Reset your ElevateBioLab password (link expires in 1 hour)", body);
}

export function welcomeHtml(name: string): string {
  const chips = ["Metabolic (GLP-1)", "Recovery & Repair", "Growth Hormone", "Blends"]
    .map(
      (c) =>
        `<span style="display:inline-block;margin:0 6px 6px 0;padding:6px 12px;border:1px solid ${BRAND.line};border-radius:999px;background:${BRAND.subtle};font-size:12px;color:${BRAND.ink};">${escapeHtml(
          c
        )}</span>`
    )
    .join("");

  const body = `
    <div style="margin:0 0 14px;">${pill("Welcome", BRAND.green)}</div>
    <h1 style="margin:0 0 8px;font-size:24px;line-height:1.25;color:${BRAND.ink};">Welcome${
      name ? `, ${escapeHtml(name)}` : ""
    }.</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:${BRAND.muted};">
      Thanks for joining ElevateBioLab — your source for third-party tested, batch-tracked analytical reference standards. Every order ships with a matching Certificate of Analysis.
    </p>
    ${card(`<div style="margin-bottom:2px;">${chips}</div>`, "Popular research categories")}
    <div style="margin:0 0 18px;">${button(env.SITE_URL + "/products", "Browse the catalog")}</div>
    <p style="margin:0;font-size:13px;color:${BRAND.muted};line-height:1.5;">
      All products are <strong style="color:${BRAND.ink};">For Research Use Only</strong>. Questions? We're at
      <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND.accent};text-decoration:none;">${SUPPORT_EMAIL}</a>.
    </p>`;

  return shell("Welcome", "Welcome to ElevateBioLab — analytical standards with a COA on every order", body);
}

function escapeHtml(input: unknown): string {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
