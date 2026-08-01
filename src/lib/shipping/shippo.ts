/**
 * Shippo adapter — preferred rate + label provider while USPS direct API
 * credentials are pending. Uses Shippo's REST API to create a shipment,
 * quote rates, pick a USPS rate matching our service code, and purchase a label.
 *
 * Auth: Authorization: ShippoToken <SHIPPO_API_KEY>
 * Test keys (shippo_test_*) return test rates/labels with no charge.
 */
import { env, isConfigured } from "@/lib/env";
import type { ShippingRate } from "@/lib/shipping/usps";

const SHIPPO_API = "https://api.goshippo.com";

/** Our checkout service codes → Shippo USPS servicelevel tokens (prefer first). */
const SERVICE_DEFS: Array<{
  service: string;
  label: string;
  tokens: string[];
  estDaysFallback: string;
}> = [
  {
    service: "USPS_GROUND_ADVANTAGE",
    label: "USPS Ground Advantage",
    tokens: ["usps_ground_advantage", "ground_advantage", "parcel_select", "usps_parcel_select"],
    estDaysFallback: "5-7",
  },
  {
    service: "USPS_PRIORITY",
    label: "USPS Priority Mail",
    tokens: ["usps_priority", "priority"],
    estDaysFallback: "2-3",
  },
  {
    service: "USPS_PRIORITY_EXPRESS",
    label: "USPS Priority Mail Express",
    tokens: ["usps_priority_express", "priority_express", "express"],
    estDaysFallback: "1-2",
  },
];

/** Map our internal shipService codes to Shippo USPS servicelevel tokens. */
function serviceLevelTokens(service: string): string[] {
  return (
    SERVICE_DEFS.find((d) => d.service === service)?.tokens ??
    SERVICE_DEFS[0]?.tokens ??
    ["usps_ground_advantage"]
  );
}

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

function uspsPool(rates: ShippoRate[]): ShippoRate[] {
  const usps = rates.filter((r) => (r.provider ?? "").toUpperCase() === "USPS");
  return usps.length ? usps : rates;
}

/** Exact servicelevel token match only (no cheapest-rate fallback). */
function findRateByTokens(rates: ShippoRate[], tokens: string[]): ShippoRate | null {
  const pool = uspsPool(rates);
  for (const token of tokens) {
    const match = pool.find(
      (r) => (r.servicelevel?.token ?? "").toLowerCase() === token.toLowerCase()
    );
    if (match) return match;
  }
  return null;
}

function pickRate(rates: ShippoRate[], service: string): ShippoRate | null {
  if (!rates.length) return null;
  const exact = findRateByTokens(rates, serviceLevelTokens(service));
  if (exact) return exact;
  // Label purchase fallback: cheapest USPS (or cheapest overall).
  return [...uspsPool(rates)].sort((a, b) => parseFloat(a.amount) - parseFloat(b.amount))[0] ?? null;
}

function estDaysFromRate(rate: ShippoRate, fallback: string): string {
  if (typeof rate.estimated_days === "number" && rate.estimated_days > 0) {
    return `${rate.estimated_days} day${rate.estimated_days === 1 ? "" : "s"}`;
  }
  if (rate.duration_terms?.trim()) return rate.duration_terms.trim();
  return fallback;
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
 * Maps returned USPS rates onto our USPS_* service codes so label purchase stays consistent.
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
  const raw = shipment.rates ?? [];
  if (!raw.length) {
    const msg = shipment.messages?.map((m) => m.text).filter(Boolean).join("; ");
    throw new Error(msg || "Shippo returned no shipping rates for this address.");
  }

  const rates: ShippingRate[] = [];
  for (const def of SERVICE_DEFS) {
    const match = findRateByTokens(raw, def.tokens);
    if (!match) continue;

    const name = match.servicelevel?.name?.trim();
    rates.push({
      service: def.service,
      label: name
        ? name.toUpperCase().startsWith("USPS")
          ? name
          : `USPS ${name}`
        : def.label,
      amountCents: Math.round(parseFloat(match.amount) * 100),
      estDays: estDaysFromRate(match, def.estDaysFallback),
    });
  }

  // If token matching yielded nothing (carrier naming drift), fall back to
  // cheapest USPS rate under Ground Advantage so checkout still works.
  if (!rates.length) {
    const cheapest = pickRate(raw, "USPS_GROUND_ADVANTAGE");
    if (cheapest) {
      const name = cheapest.servicelevel?.name?.trim();
      rates.push({
        service: "USPS_GROUND_ADVANTAGE",
        label: name
          ? name.toUpperCase().startsWith("USPS")
            ? name
            : `USPS ${name}`
          : "USPS Ground Advantage",
        amountCents: Math.round(parseFloat(cheapest.amount) * 100),
        estDays: estDaysFromRate(cheapest, "5-7"),
      });
    }
  }

  return rates.sort((a, b) => a.amountCents - b.amountCents);
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

  const rate = pickRate(shipment.rates ?? [], input.service);
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
