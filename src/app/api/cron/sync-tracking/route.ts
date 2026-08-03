import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTracking } from "@/lib/shipping/usps";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";

/**
 * Tracking sync. USPS tracking is pull-based, so instead of an inbound webhook
 * we poll: vercel.json runs this every 6 hours. It walks SHIPPED orders, pulls
 * the latest USPS status, and flips the order to DELIVERED when USPS reports
 * delivery.
 *
 * Auth: Vercel sends Authorization: Bearer $CRON_SECRET when CRON_SECRET is set.
 */
export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const shipped = await db.order.findMany({
    where: { status: "SHIPPED", trackingNumber: { not: null } },
    select: { id: true, trackingNumber: true, orderNumber: true },
    take: 200,
  });

  let updated = 0;
  for (const order of shipped) {
    if (!order.trackingNumber) continue;
    try {
      const t = await getTracking(order.trackingNumber);
      if (/delivered/i.test(t.status)) {
        await db.order.update({
          where: { id: order.id },
          data: { status: "DELIVERED", deliveredAt: new Date() },
        });
        updated++;
      }
    } catch {
      // skip this order on transient errors; next run retries
    }
  }

  return NextResponse.json({ ok: true, checked: shipped.length, delivered: updated });
}
