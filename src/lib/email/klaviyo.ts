/**
 * Klaviyo — marketing profiles & event tracking.
 *
 * Runs in MOCK mode when no API key is present (isConfigured.klaviyo()),
 * logging instead of calling the API so local dev needs no credentials.
 * Uses the Klaviyo JSON:API endpoints with the 2024-10-15 revision.
 */
import { env, isConfigured } from "@/lib/env";

export async function subscribeProfile(
  email: string,
  source?: string
): Promise<{ ok: boolean; mock: boolean }> {
  if (!isConfigured.klaviyo()) {
    // MOCK mode.
    // eslint-disable-next-line no-console
    console.log(`[email:klaviyo MOCK] subscribe email=${email} source=${source ?? "n/a"}`);
    return { ok: true, mock: true };
  }

  const res = await fetch(
    "https://a.klaviyo.com/api/profile-subscription-bulk-create-jobs",
    {
      method: "POST",
      headers: {
        Authorization: `Klaviyo-API-Key ${env.klaviyo.apiKey}`,
        revision: "2024-10-15",
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        data: {
          type: "profile-subscription-bulk-create-job",
          attributes: {
            profiles: {
              data: [
                {
                  type: "profile",
                  attributes: {
                    email,
                    subscriptions: { email: { marketing: { consent: "SUBSCRIBED" } } },
                    properties: source ? { source } : undefined,
                  },
                },
              ],
            },
          },
          relationships: env.klaviyo.listId
            ? { list: { data: { type: "list", id: env.klaviyo.listId } } }
            : undefined,
        },
      }),
    }
  );

  if (!res.ok) {
    // eslint-disable-next-line no-console
    console.error(`[email:klaviyo] subscribe failed: ${res.status} ${await res.text()}`);
    return { ok: false, mock: false };
  }

  return { ok: true, mock: false };
}

export async function trackEvent(
  metric: string,
  email: string,
  properties?: Record<string, any>
): Promise<{ ok: boolean; mock: boolean }> {
  if (!isConfigured.klaviyo()) {
    // MOCK mode.
    // eslint-disable-next-line no-console
    console.log(`[email:klaviyo MOCK] event metric=${metric} email=${email}`);
    return { ok: true, mock: true };
  }

  const res = await fetch("https://a.klaviyo.com/api/events", {
    method: "POST",
    headers: {
      Authorization: `Klaviyo-API-Key ${env.klaviyo.apiKey}`,
      revision: "2024-10-15",
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      data: {
        type: "event",
        attributes: {
          metric: { data: { type: "metric", attributes: { name: metric } } },
          profile: { data: { type: "profile", attributes: { email } } },
          properties: properties ?? {},
        },
      },
    }),
  });

  if (!res.ok) {
    // eslint-disable-next-line no-console
    console.error(`[email:klaviyo] event failed: ${res.status} ${await res.text()}`);
    return { ok: false, mock: false };
  }

  return { ok: true, mock: false };
}
