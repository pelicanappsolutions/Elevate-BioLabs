/**
 * Shippo label adapter — preferred label provider while USPS direct API
 * credentials are pending. Uses Shippo's REST API to create a shipment,
 * pick a USPS rate matching our service code, and purchase a label.
 *
 * Auth: Authorization: ShippoToken <SHIPPO_API_KEY>
 * Test keys (shippo_test_*) return test labels with no charge.
 */
import { env, isConfigured } from "@/lib/env";

const SHIPPO_API = "https://api.goshippo.com";

/** Map our internal shipService codes to Shippo USPS servicelevel tokens. */
function serviceLevelTokens(service: string): string[] {
  switch (service) {
    case "USPS_PRIORITY_EXPRESS":
      return ["usps_priority_express", "priority_express", "express"];
    case "USPS_PRIORITY":
      return ["usps_priority", "priority"];
    case "USPS_GROUND_ADVANTAGE":
    default:
      return ["usps_ground_advantage", "ground_advantage", "parcel_select", "usps_parcel_select"];
  }
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

function pickRate(rates: ShippoRate[], service: string): ShippoRate | null {
  if (!rates.length) return null;
  const tokens = serviceLevelTokens(service);
  const usps = rates.filter((r) => (r.provider ?? "").toUpperCase() === "USPS");
  const pool = usps.length ? usps : rates;

  for (const token of tokens) {
    const match = pool.find(
      (r) => (r.servicelevel?.token ?? "").toLowerCase() === token.toLowerCase()
    );
    if (match) return match;
  }

  // Fallback: cheapest USPS (or cheapest overall).
  return [...pool].sort((a, b) => parseFloat(a.amount) - parseFloat(b.amount))[0] ?? null;
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

  const shipment = await shippoFetch<ShippoShipment>("/shipments/", {
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
        name: input.toName,
        street1: input.toStreet1,
        street2: input.toStreet2 || undefined,
        city: input.toCity,
        state: input.toState,
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
