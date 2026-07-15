"use client";

import * as React from "react";
import { Calculator, Loader2, Save } from "lucide-react";

import { logDose } from "@/actions/dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

/**
 * Reconstitution math for lyophilized vials.
 *
 *   concentration (mcg/mL) = vial strength (mg) * 1000 / diluent (mL)
 *   draw volume (mL)       = target dose (mcg) / concentration
 *   insulin units          = draw volume (mL) * 100   (U-100 syringe)
 *
 * Pure arithmetic, RUO-framed — deliberately gives no dosing recommendation.
 */
function reconstitute(vialMg: number, diluentMl: number, doseMcg: number) {
  if (!(vialMg > 0) || !(diluentMl > 0) || !(doseMcg > 0)) return null;

  const totalMcg = vialMg * 1000;
  const concentrationMcgPerMl = totalMcg / diluentMl;
  const drawMl = doseMcg / concentrationMcgPerMl;
  const units = drawMl * 100;
  const dosesPerVial = totalMcg / doseMcg;

  if (drawMl > diluentMl) return { error: "Target exceeds the full vial." as const };

  return {
    concentrationMcgPerMl,
    drawMl,
    units,
    dosesPerVial,
    error: null,
  };
}

export function DosageCalculator({
  productId,
  productName,
}: {
  productId?: string;
  productName?: string;
}) {
  const { toast } = useToast();
  const [vialMg, setVialMg] = React.useState("5");
  const [diluentMl, setDiluentMl] = React.useState("2");
  const [doseMcg, setDoseMcg] = React.useState("250");
  const [saving, setSaving] = React.useState(false);

  const result = React.useMemo(
    () => reconstitute(Number(vialMg), Number(diluentMl), Number(doseMcg)),
    [vialMg, diluentMl, doseMcg]
  );

  async function handleSave() {
    if (!result || result.error) return;
    setSaving(true);
    try {
      const res = await logDose({
        productId,
        doseMcg: Number(doseMcg),
        volumeMl: Number(result.drawMl.toFixed(4)),
        note: productName ? `Reconstitution plan — ${productName}` : undefined,
      });
      if (res.ok) {
        toast({
          title: "Saved to your dosage log",
          description: "View it any time from your dashboard.",
        });
      } else {
        toast({
          title: "Couldn't save",
          description: res.error ?? "Sign in to keep a dosage log.",
          variant: "destructive",
        });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-4 flex items-center gap-2">
        <Calculator className="h-4 w-4 text-primary" aria-hidden="true" />
        <h3 className="text-sm font-semibold">Reconstitution calculator</h3>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="vialMg" className="text-xs">
            Vial strength (mg)
          </Label>
          <Input
            id="vialMg"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.1"
            value={vialMg}
            onChange={(e) => setVialMg(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="diluentMl" className="text-xs">
            Diluent (mL)
          </Label>
          <Input
            id="diluentMl"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.1"
            value={diluentMl}
            onChange={(e) => setDiluentMl(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="doseMcg" className="text-xs">
            Target dose (mcg)
          </Label>
          <Input
            id="doseMcg"
            type="number"
            inputMode="decimal"
            min={0}
            step="1"
            value={doseMcg}
            onChange={(e) => setDoseMcg(e.target.value)}
            className="mt-1"
          />
        </div>
      </div>

      <div className="mt-4 rounded-md bg-secondary/60 p-3">
        {!result ? (
          <p className="text-sm text-muted-foreground">
            Enter all three values to calculate.
          </p>
        ) : result.error ? (
          <p className="text-sm text-destructive">{result.error}</p>
        ) : (
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Concentration" value={`${round(result.concentrationMcgPerMl)} mcg/mL`} />
            <Stat label="Draw volume" value={`${round(result.drawMl, 3)} mL`} />
            <Stat label="U-100 units" value={`${round(result.units, 1)}`} highlight />
            <Stat label="Doses / vial" value={`${round(result.dosesPerVial, 1)}`} />
          </dl>
        )}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-3 w-full"
        onClick={handleSave}
        disabled={saving || !result || Boolean(result.error)}
      >
        {saving ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Save className="mr-2 h-4 w-4" />
        )}
        Save to dosage log
      </Button>

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Arithmetic aid for in-vitro experimental design only. This is not dosing
        guidance, and these compounds are not for human or animal administration.
      </p>
    </div>
  );
}

function round(n: number, dp = 2) {
  return Number(n.toFixed(dp)).toLocaleString("en-US");
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd
        className={
          highlight ? "text-sm font-bold text-primary" : "text-sm font-semibold"
        }
      >
        {value}
      </dd>
    </div>
  );
}

export default DosageCalculator;
