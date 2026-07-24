import { DollarSign, Receipt, TrendingUp } from "lucide-react";

import type { AnalyticsDTO } from "@/lib/analytics";
import { formatPrice } from "@/lib/utils";
import { BarChart } from "@/components/charts/bar-chart";
import { LineChart } from "@/components/charts/line-chart";

/** Read-only analytics view — no client hooks, renders in a tab. */
export function AdminAnalytics({ data }: { data: AnalyticsDTO }) {
  return (
    <div className="flex flex-col gap-6">
      {/* Sub-KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat icon={DollarSign} label="Revenue (30d, paid)" value={formatPrice(data.totalRevenueCents)} />
        <Stat icon={Receipt} label="Paid orders (30d)" value={String(data.orderCount)} />
        <Stat icon={TrendingUp} label="Avg. order value" value={formatPrice(data.aovCents)} />
      </div>

      {/* Revenue over time */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Revenue over time (last 30 days)</h2>
        <LineChart
          data={data.revenueSeries.map((d) => ({ label: d.label, value: d.value }))}
          formatValue={(n) => formatPrice(n)}
          emptyLabel="No paid orders in the last 30 days."
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top products */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Top products (by units sold)</h2>
          <BarChart
            data={data.topProducts.map((p) => ({
              label: p.label,
              value: p.quantity,
              secondary: formatPrice(p.revenue),
            }))}
            formatValue={(n) => `${n} sold`}
            emptyLabel="No sales recorded yet."
          />
        </div>

        {/* Revenue by rail */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Revenue by payment method</h2>
          <BarChart
            data={data.revenueByRail.map((r) => ({ label: r.rail, value: r.value }))}
            formatValue={(n) => formatPrice(n)}
            emptyLabel="No successful payments yet."
          />
        </div>

        {/* Revenue by category */}
        <div className="rounded-lg border border-border bg-card p-4 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold">Revenue by category</h2>
          <BarChart
            data={data.revenueByCategory.map((c) => ({ label: c.category, value: c.value }))}
            formatValue={(n) => formatPrice(n)}
            emptyLabel="No category sales yet."
          />
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

export default AdminAnalytics;
