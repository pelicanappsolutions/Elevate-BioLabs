import type { Metadata } from "next";
import Link from "next/link";

import { applyUnsubscribe, verifyUnsubscribeToken } from "@/lib/unsubscribe";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token?.trim() ?? "";
  const email = token ? verifyUnsubscribeToken(token) : null;

  let status: "ok" | "invalid" | "missing" = "missing";
  if (!token) {
    status = "missing";
  } else if (!email) {
    status = "invalid";
  } else {
    await applyUnsubscribe(email);
    status = "ok";
  }

  return (
    <div className="container-tight flex min-h-[60vh] max-w-lg flex-col items-center justify-center py-16 text-center">
      {status === "ok" ? (
        <>
          <h1 className="text-2xl font-bold tracking-tight">You&apos;re unsubscribed</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{email}</span> will no longer
            receive marketing or promotional emails from ElevateBioLab. You will still
            get transactional messages about orders you place.
          </p>
        </>
      ) : status === "invalid" ? (
        <>
          <h1 className="text-2xl font-bold tracking-tight">Link expired or invalid</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            This unsubscribe link isn&apos;t valid. You can manage email preferences in
            your account settings, or email{" "}
            <a href="mailto:info@elevatebiolab.com" className="text-primary underline">
              info@elevatebiolab.com
            </a>
            .
          </p>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold tracking-tight">Unsubscribe</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Open the unsubscribe link from a marketing email, or turn off marketing emails
            in your account settings.
          </p>
        </>
      )}

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button asChild variant="outline">
          <Link href="/">Home</Link>
        </Button>
        <Button asChild>
          <Link href="/dashboard">Account settings</Link>
        </Button>
      </div>
    </div>
  );
}
