/**
 * Webhook signature policy.
 *
 * Dev/test may trust unsigned bodies so MOCK adapters stay usable without
 * provider secrets. Production must never accept an unsigned payment event —
 * a missing webhook secret previously let anyone flip orders to PAID.
 */

export type WebhookSecretResolution =
  | { mode: "verify"; secret: string }
  | { mode: "unsigned-dev" }
  | { mode: "reject" };

/** Unsigned bodies are only allowed outside production. */
export function allowUnsignedWebhooks(
  opts: { isProd?: boolean } = {}
): boolean {
  const isProd = opts.isProd ?? process.env.NODE_ENV === "production";
  return !isProd;
}

/**
 * Decide how to handle a rail's webhook secret for this request.
 * - secret present → caller must HMAC-verify
 * - secret absent + non-prod → trust body (local mock)
 * - secret absent + production → reject (return null from verifyAndParse)
 */
export function resolveWebhookSecret(
  secret: string | undefined | null,
  opts: { isProd?: boolean; rail?: string } = {}
): WebhookSecretResolution {
  const trimmed = (secret ?? "").trim();
  if (trimmed) return { mode: "verify", secret: trimmed };

  if (allowUnsignedWebhooks(opts)) return { mode: "unsigned-dev" };

  console.error(
    `[webhooks] rejecting event — ${opts.rail ?? "rail"} webhook secret is not configured in production`
  );
  return { mode: "reject" };
}
