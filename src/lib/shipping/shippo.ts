/**
 * Shippo adapter — preferred rate + label provider while USPS direct API
 * credentials are pending. Quotes all domestic carriers Shippo returns for a
 * US address, then purchases a label for the selected service.
 *
 * Auth: Authorization: ShippoToken <SHIPPO_API_KEY>
 * Test keys (shippo_test_*) return test rates/labels with no charge.
 */
import { env, isConfigured } from "@/lib/env";
import type { ShippingRate } from "@/lib/shipping/usps";

const SHIPPO_API = "https://api.goshippo.com";

/** Legacy USPS checkout codes → Shippo servicelevel tokens. */
const LEGACY_USPS_TOKENS: Record<string, string[]> = {
  USPS_PRIORITY_EXPRESS: ["usps_priority_express", "priority_express", "express"],
  USPS_PRIORITY: ["usps_priority", "priority"],
  USPS_GROUND_ADVANTAGE: [
    "usps_ground_advantage",
    "ground_advantage",
    "parcel_select",
    "usps_parcel_select",
  ],
};

async function shippoFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${SHIPPO_API}${path}`, {
    ...init,
    headers: {
      Authorization: `ShippoToken ${env.shippo.apiKey}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Shippo ${path} failed: ${res.status} ${text}`);
  }
  return JSON.parse(text) as T;
}

interface ShippoRate {
  object_id: string;
  amount: string;
  currency?: string;
  provider?: string;
  estimated_days?: number;
  duration_terms?: string;
  servicelevel?: { token?: string; name?: string };
}

interface ShippoShipment {
  object_id: string;
  rates?: ShippoRate[];
  messages?: Array<{ text?: string }>;
}

interface ShippoTransaction {
  object_id: string;
  status: string;
  tracking_number?: string;
  label_url?: string;
  messages?: Array<{ text?: string }>;
}

/** Stable checkout service code: PROVIDER__TOKEN (e.g. USPS__USPS_PRIORITY). */
export function rateServiceCode(rate: ShippoRate): string {
  const provider = (rate.provider ?? "CARRIER")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const token = (rate.servicelevel?.token ?? rate.object_id)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${provider}__${token}`;
}

function rateLabel(rate: ShippoRate): string {
  const provider = (rate.provider ?? "Carrier").trim();
  const name = rate.servicelevel?.name?.trim();
  if (!name) return provider;
  if (name.toUpperCase().startsWith(provider.toUpperCase())) return name;
  return `${provider} ${name}`;
}

function estDaysFromRate(rate: ShippoRate): string {
  if (typeof rate.estimated_days === "number" && rate.estimated_days > 0) {
    return `${rate.estimated_days} day${rate.estimated_days === 1 ? "" : "s"}`;
  }
  if (rate.duration_terms?.trim()) return rate.duration_terms.trim();
  return "Transit time varies";
}

function findRateByService(rates: ShippoRate[], service: string): ShippoRate | null {
  if (!rates.length) return null;

  const byCode = rates.find((r) => rateServiceCode(r) === service);
  if (byCode) return byCode;

  // Legacy USPS_* codes from older orders / checkout defaults.
  const legacyTokens = LEGACY_USPS_TOKENS[service];
  if (legacyTokens) {
    const usps = rates.filter((r) => (r.provider ?? "").toUpperCase() === "USPS");
    const pool = usps.length ? usps : rates;
    for (const token of legacyTokens) {
      const match = pool.find(
        (r) => (r.servicelevel?.token ?? "").toLowerCase() === token.toLowerCase()
      );
      if (match) return match;
    }
  }

  // Cheapest overall fallback so label purchase still works.
  return [...rates].sort((a, b) => parseFloat(a.amount) - parseFloat(b.amount))[0] ?? null;
}

async function createShipment(input: {
  toName?: string;
  toStreet1?: string;
  toStreet2?: string;
  toCity?: string;
  toState?: string;
  toZip: string;
  weightOz: number;
}): Promise<ShippoShipment> {
  return shippoFetch<ShippoShipment>("/shipments/", {
    method: "POST",
    body: JSON.stringify({
      address_from: {
        name: env.usps.from.name,
        street1: env.usps.from.street,
        city: env.usps.from.city,
        state: env.usps.from.state,
        zip: env.usps.from.zip,
        country: "US",
        email: env.usps.from.email,
        ...(env.usps.from.phone ? { phone: env.usps.from.phone } : {}),
      },
      address_to: {
        name: input.toName || "Customer",
        street1: input.toStreet1 || "Address",
        street2: input.toStreet2 || undefined,
        city: input.toCity || "City",
        state: input.toState || "LA",
        zip: input.toZip,
        country: "US",
      },
      parcels: [
        {
          length: "6",
          width: "4",
          height: "2",
          distance_unit: "in",
          weight: String(Math.max(1, input.weightOz)),
          mass_unit: "oz",
        },
      ],
      async: false,
    }),
  });
}

/**
 * Live checkout rates via Shippo (works with shippo_test_* keys).
 * Returns every domestic carrier/service Shippo quotes for the US address,
 * cheapest first, deduped by provider+service token.
 */
export async function getShippoRates(input: {
  toName?: string;
  toStreet1?: string;
  toStreet2?: string;
  toCity?: string;
  toState?: string;
  toZip: string;
  weightOz: number;
}): Promise<ShippingRate[]> {
  if (!isConfigured.shippo()) {
    throw new Error("Shippo is not configured. Add SHIPPO_API_KEY to Vercel.");
  }

  const shipment = await createShipment(input);
  const raw = (shipment.rates ?? []).filter((r) => {
    // Domestic USD quotes only — we ship within the U.S.
    const currency = (r.currency ?? "USD").toUpperCase();
    return currency === "USD" && Number.isFinite(parseFloat(r.amount));
  });

  if (!raw.length) {
    const msg = shipment.messages?.map((m) => m.text).filter(Boolean).join("; ");
    throw new Error(msg || "Shippo returned no shipping rates for this address.");
  }

  // Keep the cheapest quote per provider+service token.
  const best = new Map<string, ShippoRate>();
  for (const rate of raw) {
    const code = rateServiceCode(rate);
    const prev = best.get(code);
    if (!prev || parseFloat(rate.amount) < parseFloat(prev.amount)) {
      best.set(code, rate);
    }
  }

  return [...best.values()]
    .map((rate) => ({
      service: rateServiceCode(rate),
      label: rateLabel(rate),
      amountCents: Math.round(parseFloat(rate.amount) * 100),
      estDays: estDaysFromRate(rate),
    }))
    .sort((a, b) => a.amountCents - b.amountCents);
}

export async function createShippoLabel(input: {
  toName: string;
  toStreet1: string;
  toStreet2?: string;
  toCity: string;
  toState: string;
  toZip: string;
  weightOz: number;
  service: string;
}): Promise<{ trackingNumber: string; labelUrl: string; mock: boolean }> {
  if (!isConfigured.shippo()) {
    throw new Error("Shippo is not configured. Add SHIPPO_API_KEY to Vercel.");
  }

  const isTest = env.shippo.apiKey.startsWith("shippo_test_");
  const shipment = await createShipment(input);

  const rate = findRateByService(shipment.rates ?? [], input.service);
  if (!rate) {
    const msg = shipment.messages?.map((m) => m.text).filter(Boolean).join("; ");
    throw new Error(msg || "Shippo returned no shipping rates for this address.");
  }

  const tx = await shippoFetch<ShippoTransaction>("/transactions/", {
    method: "POST",
    body: JSON.stringify({
      rate: rate.object_id,
      label_file_type: "PDF",
      async: false,
    }),
  });

  if (tx.status !== "SUCCESS" && tx.status !== "QUEUED") {
    const msg = tx.messages?.map((m) => m.text).filter(Boolean).join("; ");
    throw new Error(msg || `Shippo label purchase failed: ${tx.status}`);
  }

  if (!tx.tracking_number || !tx.label_url) {
    throw new Error("Shippo response missing tracking number or label URL.");
  }

  return {
    trackingNumber: tx.tracking_number,
    labelUrl: tx.label_url,
    mock: isTest,
  };
}
