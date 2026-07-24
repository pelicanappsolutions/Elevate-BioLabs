/**
 * Dependency-free line/area chart (SVG). Theme-aware via --primary. Pure
 * presentational. Designed for a ~30-point daily series; only first/mid/last
 * x-labels are drawn to avoid crowding.
 */
export interface LinePoint {
  label: string;
  value: number;
}

export function LineChart({
  data,
  formatValue = (n) => String(n),
  height = 160,
  emptyLabel = "No data yet.",
  className,
}: {
  data: LinePoint[];
  formatValue?: (n: number) => string;
  height?: number;
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

  const W = 600; // viewBox width; scales responsively via width:100%
  const H = height;
  const padX = 8;
  const padY = 12;
  const max = Math.max(...data.map((d) => d.value), 1);
  const n = data.length;

  const x = (i: number) => padX + (i / Math.max(1, n - 1)) * (W - padX * 2);
  const y = (v: number) => H - padY - (v / max) * (H - padY * 2);

  const linePts = data.map((d, i) => `${x(i)},${y(d.value)}`).join(" ");
  const areaPts = `${x(0)},${H - padY} ${linePts} ${x(n - 1)},${H - padY}`;

  const midIdx = Math.floor((n - 1) / 2);
  const first = data[0]!; // data guaranteed non-empty by the early return above
  const last = data[n - 1]!;
  const mid = data[midIdx]!;

  return (
    <div className={className}>
      <div className="mb-1 flex items-baseline justify-between text-xs text-muted-foreground">
        <span>Peak {formatValue(max)}</span>
        <span className="font-medium text-foreground">
          Latest {formatValue(last.value)}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height }}
        role="img"
        aria-label="Revenue over time"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="lc-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.25" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={areaPts} fill="url(#lc-area)" />
        <polyline
          points={linePts}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {data.map((d, i) => (
          <circle key={i} cx={x(i)} cy={y(d.value)} r="1.5" fill="hsl(var(--primary))">
            <title>{`${d.label}: ${formatValue(d.value)}`}</title>
          </circle>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{first.label}</span>
        <span>{mid.label}</span>
        <span>{last.label}</span>
      </div>
    </div>
  );
}

export default LineChart;
