"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileCheck2, Loader2, Upload } from "lucide-react";

import { uploadCoa } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

interface CoaVariant {
  id: string; // ProductVariant id
  name: string; // combined display name, e.g. "Tirzepatide 10mg"
  sku: string;
  coaCount: number;
}

export function CoaUploader({ products }: { products: CoaVariant[] }) {
  const { toast } = useToast();
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [variantId, setVariantId] = React.useState("");
  const [batchLot, setBatchLot] = React.useState("");
  const [purity, setPurity] = React.useState("");
  const [testedOn, setTestedOn] = React.useState("");
  const [fileName, setFileName] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const selectedVariant = products.find((p) => p.id === variantId);

  // Live filename preview — update as form fields change
  React.useEffect(() => {
    if (selectedVariant && batchLot && purity) {
      const purityNum = purity.replace("%", "").trim();
      const filename = `${selectedVariant.name}_${batchLot}_${purityNum}_COA.pdf`;
      setFileName(filename);
    } else {
      setFileName("");
    }
  }, [selectedVariant, batchLot, purity]);

  // Validate form fields
  function validateForm(): string | null {
    if (!variantId) return "Choose a product.";
    if (!batchLot.trim()) return "Enter batch/lot number.";
    if (!purity.trim()) return "Enter purity percentage.";
    if (!testedOn) return "Select test date.";

    const purityNum = parseFloat(purity.replace("%", "").trim());
    if (isNaN(purityNum) || purityNum < 0 || purityNum > 100) {
      return "Purity must be a number between 0-100.";
    }

    const testDate = new Date(testedOn);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (testDate > today) {
      return "Test date cannot be in the future.";
    }

    return null;
  }

  // fileName is just the display preview (product+batch+purity) — it says nothing
  // about whether a file was actually picked, so it must not gate validity. The
  // file input's `required` attribute plus the server-side check in uploadCoa
  // are what actually enforce a file is attached.
  const isFormValid = !validateForm();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    const formData = new FormData(e.currentTarget);
    formData.set("variantId", variantId);
    formData.set("batchLot", batchLot);
    formData.set("purity", purity);
    formData.set("testedOn", testedOn);

    setPending(true);
    try {
      const res = await uploadCoa(formData);
      if (!res.ok) {
        setError(res.error ?? "Upload failed.");
        return;
      }
      toast({
        title: "COA published",
        description: `Saved as: ${fileName}`,
      });
      formRef.current?.reset();
      setVariantId("");
      setBatchLot("");
      setPurity("");
      setTestedOn("");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr] lg:items-start">
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
      >
        <h2 className="text-sm font-semibold">Upload Certificate of Analysis</h2>

        <div>
          <Label className="text-xs">Product</Label>
          <Select value={variantId} onValueChange={setVariantId}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Choose a product" />
            </SelectTrigger>
            <SelectContent>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} ({p.sku})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="batchLot" className="text-xs">
            Batch / lot number
          </Label>
          <Input
            id="batchLot"
            name="batchLot"
            value={batchLot}
            onChange={(e) => setBatchLot(e.target.value)}
            required
            placeholder="EBL-2026-0417"
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="coa-purity" className="text-xs">
            Tested purity <span className="text-destructive">*</span>
          </Label>
          <Input
            id="coa-purity"
            value={purity}
            onChange={(e) => setPurity(e.target.value)}
            placeholder="99.4 or 99.4%"
            className="mt-1"
          />
          <p className="mt-0.5 text-[10px] text-muted-foreground">Number 0-100, optional % sign</p>
        </div>

        <div>
          <Label htmlFor="testedOn" className="text-xs">
            Test date <span className="text-destructive">*</span>
          </Label>
          <Input
            id="testedOn"
            type="date"
            value={testedOn}
            onChange={(e) => setTestedOn(e.target.value)}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="coa-file" className="text-xs">
            COA PDF <span className="text-destructive">*</span>
          </Label>
          <Input
            id="coa-file"
            name="file"
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            required
            className="mt-1 file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-medium"
          />
        </div>

        {fileName && (
          <div className="rounded-md border border-primary/40 bg-primary/5 p-2.5">
            <p className="text-xs font-medium text-primary">Filename preview:</p>
            <p className="mt-1 break-words font-mono text-xs text-foreground">{fileName}</p>
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive"
          >
            {error}
          </p>
        )}

        <Button type="submit" disabled={pending || !isFormValid}>
          {pending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          Publish COA
        </Button>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Every batch shipped must have a matching third-party COA on file — this is the
          core of the LegitScript and RUO evidence trail.
        </p>
      </form>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[420px] text-sm">
          <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Product</th>
              <th className="px-3 py-2 font-medium">SKU</th>
              <th className="px-3 py-2 font-medium">COAs on file</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-3 py-2 font-medium">{p.name}</td>
                <td className="px-3 py-2 text-muted-foreground">{p.sku}</td>
                <td className="px-3 py-2">
                  {p.coaCount === 0 ? (
                    <span className="text-destructive">None — action needed</span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-primary">
                      <FileCheck2 className="h-3.5 w-3.5" />
                      {p.coaCount}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default CoaUploader;
