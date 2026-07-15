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

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<{ ok: boolean; mock: boolean }> {
  if (!isConfigured.sendgrid()) {
    // MOCK mode.
    // eslint-disable-next-line no-console
    console.log(
      `[email:sendgrid MOCK] to=${input.to} subject="${input.subject}"`
    );
    return { ok: true, mock: true };
  }

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.sendgrid.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: input.to }] }],
      from: { email: env.sendgrid.fromEmail, name: env.sendgrid.fromName },
      subject: input.subject,
      content: [
        {
          type: "text/plain",
          value: input.text ?? stripHtml(input.html),
        },
        { type: "text/html", value: input.html },
      ],
    }),
  });

  if (!res.ok) {
    // eslint-disable-next-line no-console
    console.error(
      `[email:sendgrid] send failed: ${res.status} ${await res.text()}`
    );
    return { ok: false, mock: false };
  }

  return { ok: true, mock: false };
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Template builders (inline-styled, max-width 600, mobile-friendly)
// ---------------------------------------------------------------------------

function money(cents: unknown): string {
  const n = typeof cents === "number" ? cents : Number(cents ?? 0);
  return `$${(n / 100).toFixed(2)}`;
}

function shell(title: string, body: string): string {
  return `<!-- ${title} -->
<div style="margin:0;padding:0;background:#f4f6f8;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a2b3c;">
        <tr><td style="background:#0f2e4c;padding:20px 28px;">
          <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.3px;">Elevate Bio-Labs</span>
        </td></tr>
        <tr><td style="padding:28px;">
          ${body}
        </td></tr>
        <tr><td style="padding:20px 28px;background:#f4f6f8;color:#6b7a89;font-size:12px;line-height:1.5;">
          Elevate Bio-Labs • For research use only.<br/>
          You are receiving this email because you placed an order or created an account.
        </td></tr>
      </table>
    </td></tr>
  </table>
</div>`;
}

export function orderConfirmationHtml(order: any): string {
  const items: any[] = Array.isArray(order?.items) ? order.items : [];
  const rows = items
    .map(
      (it) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #eef1f4;font-size:14px;">
          ${escapeHtml(it?.name ?? it?.productName ?? "Item")} × ${it?.quantity ?? 1}
        </td>
        <td style="padding:8px 0;border-bottom:1px solid #eef1f4;font-size:14px;text-align:right;">
          ${money(it?.priceCents ?? it?.unitPriceCents)}
        </td>
      </tr>`
    )
    .join("");

  const body = `
    <h1 style="margin:0 0 12px;font-size:22px;">Thanks for your order!</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#3a4a5a;">
      Order <strong>${escapeHtml(order?.orderNumber ?? "")}</strong> is confirmed. Here's a summary:
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
      ${rows}
      <tr>
        <td style="padding:12px 0 0;font-size:16px;font-weight:700;">Total</td>
        <td style="padding:12px 0 0;font-size:16px;font-weight:700;text-align:right;">${money(order?.totalCents)}</td>
      </tr>
    </table>
    <p style="margin:0;font-size:14px;color:#6b7a89;">We'll email you tracking as soon as it ships.</p>`;

  return shell("Order Confirmation", body);
}

export function shipmentTrackingHtml(order: any): string {
  const tracking = order?.trackingNumber ?? order?.tracking ?? "";
  const carrier = order?.carrier ?? "USPS";
  const url =
    order?.trackingUrl ??
    (tracking ? `https://tools.usps.com/go/TrackConfirmAction?tLabels=${tracking}` : "");

  const body = `
    <h1 style="margin:0 0 12px;font-size:22px;">Your order is on the way!</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#3a4a5a;">
      Order <strong>${escapeHtml(order?.orderNumber ?? "")}</strong> has shipped via ${escapeHtml(carrier)}.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;border-radius:8px;margin-bottom:20px;">
      <tr><td style="padding:16px;font-size:14px;">
        <div style="color:#6b7a89;margin-bottom:4px;">Tracking number</div>
        <div style="font-size:16px;font-weight:700;">${escapeHtml(tracking)}</div>
      </td></tr>
    </table>
    ${
      url
        ? `<a href="${escapeHtml(url)}" style="display:inline-block;background:#0f2e4c;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:15px;font-weight:600;">Track your package</a>`
        : ""
    }`;

  return shell("Shipment Tracking", body);
}

export function passwordResetHtml(url: string): string {
  const body = `
    <h1 style="margin:0 0 12px;font-size:22px;">Reset your password</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#3a4a5a;">
      We received a request to reset your password. Click the button below to choose a new one. This link expires in 1 hour.
    </p>
    <a href="${escapeHtml(url)}" style="display:inline-block;background:#0f2e4c;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:15px;font-weight:600;">Reset password</a>
    <p style="margin:20px 0 0;font-size:13px;color:#6b7a89;">If you didn't request this, you can safely ignore this email.</p>`;

  return shell("Password Reset", body);
}

export function welcomeHtml(name: string): string {
  const body = `
    <h1 style="margin:0 0 12px;font-size:22px;">Welcome${name ? `, ${escapeHtml(name)}` : ""}!</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#3a4a5a;">
      Thanks for joining Elevate Bio-Labs. You'll be the first to hear about new products, restocks, and research-grade offers.
    </p>
    <a href="${escapeHtml(env.SITE_URL)}" style="display:inline-block;background:#0f2e4c;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:15px;font-weight:600;">Start shopping</a>`;

  return shell("Welcome", body);
}

function escapeHtml(input: unknown): string {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
