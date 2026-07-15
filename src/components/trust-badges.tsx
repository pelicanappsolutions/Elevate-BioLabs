import { Beaker, FlaskConical, PackageCheck, ShieldCheck, Truck } from "lucide-react";

const BADGES = [
  { icon: Beaker, label: "≥99% Purity" },
  { icon: ShieldCheck, label: "Third-Party Tested (COA)" },
  { icon: PackageCheck, label: "Batch/Lot Tracked" },
  { icon: Truck, label: "Discreet USPS Shipping" },
  { icon: FlaskConical, label: "Research Use Only" },
];

export function TrustBadges({ className }: { className?: string }) {
  return (
    <div
      className={
        "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" + (className ? ` ${className}` : "")
      }
    >
      {BADGES.map(({ icon: Icon, label }) => (
        <div
          key={label}
          className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card px-3 py-4 text-center"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
          </span>
          <span className="text-xs font-medium leading-tight text-muted-foreground">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

export default TrustBadges;
