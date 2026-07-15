/**
 * USPS integration (USPS APIs v3, OAuth2 client-credentials).
 *
 * Provides rate quotes, label purchase, and tracking. Runs in MOCK mode when
 * OAuth credentials are absent (isConfigured.usps()), returning realistic fake
 * rates / tracking numbers / timelines so shipping works locally with no keys.
 * The OAuth token is cached in-module until shortly before expiry.
 */
import crypto from "crypto";
import { env, isConfigured } from "@/lib/env";

export interface ShippingRate {
  service: string;
  label: string;
  amountCents: number;
  estDays: string;
}

interface CachedToken {
  token: string;
  expiresAt: number; // epoch ms
}

let tokenCache: CachedToken | null = null;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  // 60s safety margin before expiry.
  if (tokenCache && tokenCache.expiresAt - 60_000 > now) {
    return tokenCache.token;
  }

  const res = await fetch(`${env.usps.baseUrl}/oauth2/v3/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: env.usps.clientId,
      client_secret: env.usps.clientSecret,
    }),
  });

  if (!res.ok) {
    throw new Error(`USPS OAuth failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = {
    token: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };
  return data.access_token;
}

const RATE_TIERS: Array<{
  service: string;
  label: string;
  baseCents: number;
  estDays: string;
}> = [
  {
    service: "USPS_GROUND_ADVANTAGE",
    label: "USPS Ground Advantage",
    baseCents: 599,
    estDays: "5-7",
  },
  {
    service: "USPS_PRIORITY",
    label: "USPS Priority Mail",
    baseCents: 999,
    estDays: "2-3",
  },
  {
    service: "USPS_PRIORITY_EXPRESS",
    label: "USPS Priority Mail Express",
    baseCents: 2699,
    estDays: "1-2",
  },
];

function surchargeCents(weightOz: number): number {
  // +$0.25 per ounce over 8oz.
  const over = Math.max(0, weightOz - 8);
  return Math.round(over) * 25;
}

export async function getRates(input: {
  toZip: string;
  toState?: string;
  weightOz: number;
}): Promise<ShippingRate[]> {
  if (!isConfigured.usps()) {
    // MOCK mode.
    const extra = surchargeCents(input.weightOz);
    return RATE_TIERS.map((t) => ({
      service: t.service,
      label: t.label,
      amountCents: t.baseCents + extra,
      estDays: t.estDays,
    }));
  }

  const token = await getAccessToken();
  const weightLb = input.weightOz / 16;

  const rates = await Promise.all(
    RATE_TIERS.map(async (t) => {
      const res = await fetch(`${env.usps.baseUrl}/prices/v3/base-rates/search`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          originZIPCode: env.usps.from.zip,
          destinationZIPCode: input.toZip,
          weight: weightLb,
          length: 6,
          width: 4,
          height: 2,
          mailClass: t.service,
          processingCategory: "MACHINABLE",
          rateIndicator: "SP",
          destinationEntryFacilityType: "NONE",
          priceType: "RETAIL",
        }),
      });

      if (!res.ok) {
        // Fall back to the mock tier price if a specific class errors.
        return {
          service: t.service,
          label: t.label,
          amountCents: t.baseCents + surchargeCents(input.weightOz),
          estDays: t.estDays,
        };
      }

      const data = (await res.json()) as {
        totalBasePrice?: number;
        rates?: Array<{ price?: number }>;
      };
      const price = data.totalBasePrice ?? data.rates?.[0]?.price;

      return {
        service: t.service,
        label: t.label,
        amountCents:
          typeof price === "number"
            ? Math.round(price * 100)
            : t.baseCents + surchargeCents(input.weightOz),
        estDays: t.estDays,
      };
    })
  );

  return rates;
}

export async function createLabel(input: {
  toName: string;
  toStreet1: string;
  toStreet2?: string;
  toCity: string;
  toState: string;
  toZip: string;
  weightOz: number;
  service: string;
}): Promise<{ trackingNumber: string; labelUrl: string }> {
  if (!isConfigured.usps()) {
    // MOCK mode — synthesize a USPS-style 22-digit tracking number.
    const rand16 = Array.from(crypto.randomBytes(16))
      .map((b) => (b % 10).toString())
      .join("");
    const trackingNumber = `9400${rand16}`;
    return {
      trackingNumber,
      labelUrl: `/uploads/labels/mock-${trackingNumber}.pdf`,
    };
  }

  const token = await getAccessToken();

  const res = await fetch(`${env.usps.baseUrl}/labels/v3/label`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      imageInfo: { imageType: "PDF", labelType: "4X6LABEL" },
      fromAddress: {
        streetAddress: env.usps.from.street,
        city: env.usps.from.city,
        state: env.usps.from.state,
        ZIPCode: env.usps.from.zip,
        firstName: env.usps.from.name,
      },
      toAddress: {
        streetAddress: input.toStreet1,
        secondaryAddress: input.toStreet2,
        city: input.toCity,
        state: input.toState,
        ZIPCode: input.toZip,
        firstName: input.toName,
      },
      packageDescription: {
        mailClass: input.service,
        weight: input.weightOz / 16,
        length: 6,
        width: 4,
        height: 2,
        processingCategory: "MACHINABLE",
        rateIndicator: "SP",
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`USPS createLabel failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as {
    trackingNumber?: string;
    labelAddress?: unknown;
    labelUrl?: string;
    labelImage?: string;
  };

  return {
    trackingNumber: data.trackingNumber ?? "",
    labelUrl: data.labelUrl ?? `/uploads/labels/${data.trackingNumber}.pdf`,
  };
}

export async function getTracking(
  trackingNumber: string
): Promise<{
  status: string;
  events: { date: string; description: string; location?: string }[];
}> {
  if (!isConfigured.usps()) {
    // MOCK mode — plausible 3-event timeline.
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    return {
      status: "In Transit",
      events: [
        {
          date: new Date(now - 2 * day).toISOString(),
          description: "Shipping Label Created, USPS Awaiting Item",
          location: `${env.usps.from.city}, ${env.usps.from.state}`,
        },
        {
          date: new Date(now - 1 * day).toISOString(),
          description: "Accepted at USPS Origin Facility",
          location: `${env.usps.from.city}, ${env.usps.from.state}`,
        },
        {
          date: new Date(now - 6 * 60 * 60 * 1000).toISOString(),
          description: "In Transit to Next Facility",
        },
      ],
    };
  }

  const token = await getAccessToken();

  const res = await fetch(
    `${env.usps.baseUrl}/tracking/v3/tracking/${encodeURIComponent(trackingNumber)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    }
  );

  if (!res.ok) {
    throw new Error(`USPS getTracking failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as {
    status?: string;
    statusSummary?: string;
    trackingEvents?: Array<{
      eventTimestamp?: string;
      eventType?: string;
      eventCity?: string;
      eventState?: string;
    }>;
  };

  return {
    status: data.status ?? data.statusSummary ?? "Unknown",
    events: (data.trackingEvents ?? []).map((e) => ({
      date: e.eventTimestamp ?? "",
      description: e.eventType ?? "",
      location: [e.eventCity, e.eventState].filter(Boolean).join(", ") || undefined,
    })),
  };
}
