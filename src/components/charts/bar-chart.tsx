/**
 * Dependency-free horizontal bar chart (SVG/CSS). Theme-aware via the app's
 * --primary / --muted CSS vars, so it tracks light/dark automatically. Pure
 * presentational — no client hooks, safe to render in a server component.
 */
export interface BarDatum {
  label: string;
  value: number;
  /** Optional secondary label shown after the primary value, e.g. revenue. */
  secondary?: string;
}

export function BarChart({
  data,
  formatValue = (n) => String(n),
  emptyLabel = "No data yet.",
  className,
}: {
  data: BarDatum[];
  formatValue?: (n: number) => string;
  emptyLabel?: string;
  className?: string;
}) {
  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className={className} role="img" aria-label="Bar chart">
      <ul className="flex flex-col gap-2.5">
        {data.map((d, i) => {
          const pct = Math.max(2, Math.round((d.value / max) * 100));
          return (
            <li key={`${d.label}-${i}`} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="truncate font-medium">{d.label}</span>
                <span className="shrink-0 text-muted-foreground">
                  {formatValue(d.value)}
                  {d.secondary ? ` • ${d.secondary}` : ""}
                </span>
              </div>
              <div
                className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
                title={`${d.label}: ${formatValue(d.value)}`}
              >
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default BarChart;
