"use client";

import * as React from "react";
import { Calculator, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NumericInput } from "@/components/ui/numeric-input";
import { Label } from "@/components/ui/label";

/**
 * Analytical concentration calculator for lyophilized reference standards.
 *
 *   concentration (mcg/mL) = analyte mass (mcg) / diluent volume (mL)
 *
 * Pure arithmetic, RUO-framed — deliberately gives no dosing recommendation
 * or sample-preparation protocol.
 */
function calculateConcentration(analyteMcg: number, diluentMl: number) {
  if (!(analyteMcg > 0) || !(diluentMl > 0)) return null;
  return {
    concentrationMcgPerMl: analyteMcg / diluentMl,
    totalVialMcg: analyteMcg,
  };
}

export function DosageCalculator({
  vialMg,
  reconstitutionVolumeMl,
}: {
  variantId?: string;
  productName?: string;
  /** The selected variant's actual strength — a fact, not editable here. */
  vialMg: number;
  /** Default analytical dilution volume used for concentration calculations. */
  reconstitutionVolumeMl: number;
}) {
  const [analyteMcg, setAnalyteMcg] = React.useState(String(vialMg * 1000));
  const [diluentMl, setDiluentMl] = React.useState(String(reconstitutionVolumeMl));

  const result = React.useMemo(
    () => calculateConcentration(Number(analyteMcg), Number(diluentMl)),
    [analyteMcg, diluentMl]
  );

  const vialTotalMcg = vialMg * 1000;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-4 flex items-center gap-2">
        <Calculator className="h-4 w-4 text-primary" aria-hidden="true" />
        <h3 className="text-sm font-semibold">Analytical standard calculator</h3>
      </div>

      <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-3">
        <FlaskConical className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <p className="text-sm">
          Vial contains <span className="font-semibold text-primary">{vialMg}mg</span> of reference
          material ({vialTotalMcg.toLocaleString()} mcg total).
        </p>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="analyteMcg" className="text-xs">
            Analyte mass (mcg)
          </Label>
          <NumericInput
            id="analyteMcg"
            value={analyteMcg}
            onChange={setAnalyteMcg}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="diluentMl" className="text-xs">
            Diluent volume (mL)
          </Label>
          <NumericInput
            id="diluentMl"
            value={diluentMl}
            onChange={setDiluentMl}
            className="mt-1"
          />
        </div>
      </div>

      <div className="mt-4 rounded-md bg-secondary/60 p-3">
        {!result ? (
          <p className="text-sm text-muted-foreground">
            Enter a positive analyte mass and diluent volume to calculate concentration.
          </p>
        ) : (
          <dl className="grid grid-cols-2 gap-3">
            <Stat
              label="Concentration"
              value={`${round(result.concentrationMcgPerMl)} mcg/mL`}
              highlight
            />
            <Stat
              label="Total analyte"
              value={`${round(result.totalVialMcg)} mcg`}
            />
          </dl>
        )}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Arithmetic aid for in-vitro analytical method development only. This is not a
        sample-preparation protocol, dosing guidance, or reconstitution instruction. These
        compounds are not for human or animal administration.
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
