/**
 * Persist hosted checkout / crypto invoice URLs on Payment.providerRaw so
 * abandoned checkouts can still finish via email, success page, or dashboard.
 */

export type PaymentCheckoutMeta = {
  invoiceUrl?: string;
  invoiceId?: string;
  createdAt?: string;
  ipn?: unknown;
  [key: string]: unknown;
};

export function asPaymentMeta(raw: unknown): PaymentCheckoutMeta {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as PaymentCheckoutMeta;
}

/** Hosted NOWPayments (or similar) pay link, if we stored one. */
export function paymentCheckoutUrl(providerRaw: unknown): string | null {
  const url = asPaymentMeta(providerRaw).invoiceUrl;
  return typeof url === "string" && url.startsWith("http") ? url : null;
}

export function buildCheckoutMeta(input: {
  invoiceUrl?: string | null;
  invoiceId?: string | null;
  existing?: unknown;
}): PaymentCheckoutMeta {
  const base = asPaymentMeta(input.existing);
  return {
    ...base,
    ...(input.invoiceUrl?.startsWith("http") ? { invoiceUrl: input.invoiceUrl } : {}),
    ...(input.invoiceId ? { invoiceId: String(input.invoiceId) } : {}),
    createdAt: base.createdAt ?? new Date().toISOString(),
  };
}

/** Merge IPN/webhook payload without wiping a stored invoice URL. */
export function mergePaymentProviderRaw(
  existing: unknown,
  patch: Record<string, unknown>
): PaymentCheckoutMeta {
  return { ...asPaymentMeta(existing), ...patch };
}

/** Resolve pay link from live order payload or persisted payment meta. */
export function resolveOrderCheckoutUrl(order: {
  redirectUrl?: unknown;
  payments?: Array<{ providerRaw?: unknown | null } | null> | null;
}): string | null {
  if (typeof order.redirectUrl === "string" && order.redirectUrl.startsWith("http")) {
    return order.redirectUrl;
  }
  const payment = order.payments?.[0];
  return payment ? paymentCheckoutUrl(payment.providerRaw) : null;
}
