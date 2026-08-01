/**
 * SendGrid Advanced Suppression Management (unsubscribe groups).
 * Ensures a "Marketing" group exists so ASM substitution tags populate in
 * marketing emails, and returns the numeric group id for the mail/send payload.
 */
import { env, isConfigured } from "@/lib/env";

const GROUP_NAME = "Marketing";
const GROUP_DESC = "Research updates, new batches, and occasional offers from Elevate Bio-Labs.";

let cachedGroupId: number | null = null;

async function sgFetch<T>(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data?: T; text: string }> {
  const res = await fetch(`https://api.sendgrid.com/v3${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.sendgrid.apiKey}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let data: T | undefined;
  try {
    data = text ? (JSON.parse(text) as T) : undefined;
  } catch {
    data = undefined;
  }
  return { ok: res.ok, status: res.status, data, text };
}

/** Resolve or create the SendGrid Marketing unsubscribe group. */
export async function getMarketingAsmGroupId(): Promise<number | null> {
  const fromEnv = Number(process.env.SENDGRID_ASM_GROUP_ID ?? "");
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;

  if (cachedGroupId) return cachedGroupId;
  if (!isConfigured.sendgrid()) return null;

  const listed = await sgFetch<Array<{ id: number; name: string }>>("/asm/groups");
  if (listed.ok && Array.isArray(listed.data)) {
    const existing = listed.data.find(
      (g) => g.name.toLowerCase() === GROUP_NAME.toLowerCase()
    );
    if (existing?.id) {
      cachedGroupId = existing.id;
      return existing.id;
    }
  }

  const created = await sgFetch<{ id: number }>("/asm/groups", {
    method: "POST",
    body: JSON.stringify({
      name: GROUP_NAME,
      description: GROUP_DESC,
      is_default: false,
    }),
  });

  if (created.ok && created.data?.id) {
    cachedGroupId = created.data.id;
    return created.data.id;
  }

  // eslint-disable-next-line no-console
  console.error("[email:asm] could not resolve Marketing group:", created.status, created.text);
  return null;
}
