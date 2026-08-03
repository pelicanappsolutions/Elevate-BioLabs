/**
 * Centralized env access. Payment/shipping/email adapters check `isConfigured`
 * to decide between LIVE and MOCK mode, so the app runs end-to-end with zero
 * third-party keys during local development.
 */

const DEV_AUTH_SECRET_FALLBACK = "dev-secret";

/**
 * Resolve the Auth.js signing secret.
 * Production must set AUTH_SECRET (or NEXTAUTH_SECRET) to a real value — never
 * the insecure "dev-secret" fallback that previously shipped by default.
 */
export function resolveAuthSecret(input: {
  authSecret?: string | null;
  nextAuthSecret?: string | null;
  nodeEnv?: string | null;
  vercelEnv?: string | null;
} = {}): string {
  const configured = (input.authSecret ?? input.nextAuthSecret ?? "").trim();
  const nodeEnv = input.nodeEnv ?? process.env.NODE_ENV;
  const vercelEnv = input.vercelEnv ?? process.env.VERCEL_ENV;
  const isProd = nodeEnv === "production" || vercelEnv === "production";

  if (configured) {
    if (isProd && configured === DEV_AUTH_SECRET_FALLBACK) {
      throw new Error(
        'AUTH_SECRET must not be the insecure default "dev-secret" in production. Generate one with: openssl rand -base64 32'
      );
    }
    return configured;
  }

  if (isProd) {
    throw new Error(
      "AUTH_SECRET (or NEXTAUTH_SECRET) is required in production. Generate one with: openssl rand -base64 32"
    );
  }

  // Local / test only — never used when NODE_ENV or VERCEL_ENV is production.
  console.warn(
    '[env] AUTH_SECRET not set — using insecure local fallback "dev-secret". Set AUTH_SECRET before deploying.'
  );
  return DEV_AUTH_SECRET_FALLBACK;
}

export const env = {
  DATABASE_URL: process.env.DATABASE_URL ?? "",

  AUTH_SECRET: resolveAuthSecret({
    authSecret: process.env.AUTH_SECRET,
    nextAuthSecret: process.env.NEXTAUTH_SECRET,
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
  }),
  /**
   * Vercel Cron bearer secret. When set on the Vercel project, Cron invocations
   * send `Authorization: Bearer $CRON_SECRET`. Required for production crons.
   */
  CRON_SECRET: process.env.CRON_SECRET ?? "",
  NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? "http://localhost:3000",
  SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",

  AGE_GATE_ENABLED: (process.env.AGE_GATE_ENABLED ?? "true") === "true",
  MIN_AGE: Number(process.env.NEXT_PUBLIC_MIN_AGE ?? process.env.MIN_AGE ?? 21),

  google: {
    id: process.env.AUTH_GOOGLE_ID ?? "",
    secret: process.env.AUTH_GOOGLE_SECRET ?? "",
  },

  nexapay: {
    apiKey: process.env.NEXAPAY_API_KEY ?? "",
    secret: process.env.NEXAPAY_SECRET ?? "",
    webhookSecret: process.env.NEXAPAY_WEBHOOK_SECRET ?? "",
    baseUrl: process.env.NEXAPAY_BASE_URL ?? "https://api.nexapay.example/v1",
  },
  seamlesschex: {
    apiKey: process.env.SEAMLESSCHEX_API_KEY ?? "",
    webhookSecret: process.env.SEAMLESSCHEX_WEBHOOK_SECRET ?? "",
    baseUrl: process.env.SEAMLESSCHEX_BASE_URL ?? "https://api.seamlesschex.com/v1",
  },
  payram: {
    apiKey: process.env.PAYRAM_API_KEY ?? "",
    webhookSecret: process.env.PAYRAM_WEBHOOK_SECRET ?? "",
    baseUrl: process.env.PAYRAM_BASE_URL ?? "https://api.payram.example/v1",
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY ?? "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "",
  },
  coinbase: {
    apiKey: process.env.COINBASE_COMMERCE_API_KEY ?? "",
    webhookSecret: process.env.COINBASE_COMMERCE_WEBHOOK_SECRET ?? "",
  },
  nowpayments: {
    apiKey: process.env.NOWPAYMENTS_API_KEY ?? "",
    webhookSecret: process.env.NOWPAYMENTS_WEBHOOK_SECRET ?? "",
    baseUrl: process.env.NOWPAYMENTS_BASE_URL ?? "https://api.nowpayments.io/v1",
  },
  p2p: {
    zelle: process.env.P2P_ZELLE_HANDLE ?? "trosclair.danny@gmail.com",
    venmo: process.env.P2P_VENMO_HANDLE ?? "@elevateresearch",
    wire:
      process.env.P2P_WIRE_INSTRUCTIONS ??
      "Contact info@elevatebiolab.com for wire details",
  },
  usps: {
    apiKey: process.env.USPS_API_KEY ?? "",
    clientId: process.env.USPS_CLIENT_ID ?? "",
    clientSecret: process.env.USPS_CLIENT_SECRET ?? "",
    baseUrl: process.env.USPS_BASE_URL ?? "https://apis.usps.com",
    from: {
      name: process.env.SHIP_FROM_NAME ?? "C&D RESEARCH LLC",
      street: process.env.SHIP_FROM_STREET ?? "110 Tall Pines St",
      city: process.env.SHIP_FROM_CITY ?? "Belle Chasse",
      state: process.env.SHIP_FROM_STATE ?? "LA",
      zip: process.env.SHIP_FROM_ZIP ?? "70037",
    },
  },
  shippo: {
    apiKey: process.env.SHIPPO_API_KEY ?? "",
  },
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY ?? "",
    fromEmail: process.env.SENDGRID_FROM_EMAIL ?? "info@elevatebiolab.com",
    fromName: process.env.SENDGRID_FROM_NAME ?? "ElevateBioLab",
  },
  /** Public contact address shown in emails / UI. */
  contactEmail: process.env.CONTACT_EMAIL ?? "info@elevatebiolab.com",
  p2pEmail: {
    host: process.env.P2P_EMAIL_IMAP_HOST ?? "",
    port: Number(process.env.P2P_EMAIL_IMAP_PORT ?? "993"),
    user: process.env.P2P_EMAIL_IMAP_USER ?? "",
    password: process.env.P2P_EMAIL_IMAP_PASSWORD ?? "",
    folder: process.env.P2P_EMAIL_POLL_FOLDER ?? "INBOX",
    // How far back (in hours) to look for unread notifications on each run.
    lookbackHours: Number(process.env.P2P_EMAIL_LOOKBACK_HOURS ?? "24"),
    // Max emails to process per run to stay within serverless limits.
    maxPerRun: Number(process.env.P2P_EMAIL_MAX_PER_RUN ?? "50"),
  },
  klaviyo: {
    apiKey: process.env.KLAVIYO_API_KEY ?? "",
    publicKey: process.env.KLAVIYO_PUBLIC_KEY ?? "",
    listId: process.env.KLAVIYO_LIST_ID ?? "",
  },
  blob: {
    token: process.env.BLOB_READ_WRITE_TOKEN ?? "",
    storeId: process.env.BLOB_READ_WRITE_TOKEN_STORE_ID ?? process.env.BLOB_STORE_ID ?? "",
  },
};

export const isConfigured = {
  nexapay: () => !!env.nexapay.apiKey && !!env.nexapay.secret,
  seamlesschex: () => !!env.seamlesschex.apiKey,
  payram: () => !!env.payram.apiKey,
  stripe: () => !!env.stripe.secretKey,
  coinbase: () => !!env.coinbase.apiKey,
  nowpayments: () => !!env.nowpayments.apiKey,
  usps: () => !!env.usps.clientId && !!env.usps.clientSecret,
  shippo: () => !!env.shippo.apiKey,
  sendgrid: () => !!env.sendgrid.apiKey,
  p2pEmail: () => !!env.p2pEmail.host && !!env.p2pEmail.user && !!env.p2pEmail.password,
  klaviyo: () => !!env.klaviyo.apiKey,
  blob: () => !!env.blob.token || !!env.blob.storeId,
};
