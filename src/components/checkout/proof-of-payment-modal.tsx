"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import type { PaymentRail } from "@prisma/client";

import { uploadProofOfPayment } from "@/actions/proof";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { formatPrice } from "@/lib/utils";

const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPTED = "image/png,image/jpeg,image/webp,application/pdf";

export function ProofOfPaymentModal({
  orderId,
  orderNumber,
  rail,
  amountCents,
}: {
  orderId: string;
  orderNumber: string;
  rail: PaymentRail;
  amountCents: number;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [reference, setReference] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!file) return setError("Attach a screenshot or PDF of the transfer.");
    // Mirrors the server-side guard so the user gets feedback before the upload.
    if (file.size > MAX_BYTES) return setError("File too large (max 8MB).");

    const formData = new FormData();
    formData.set("orderId", orderId);
    formData.set("rail", rail);
    formData.set("file", file);
    formData.set("amountCents", String(amountCents));
    if (reference.trim()) formData.set("reference", reference.trim());

    setPending(true);
    try {
      const res = await uploadProofOfPayment(formData);
      if (!res.ok) {
        setError(res.error ?? "Upload failed. Please try again.");
        return;
      }
      setOpen(false);
      toast({
        title: "Proof received",
        description: "An admin will verify your payment shortly.",
      });
      router.refresh();
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="tap w-full">
          <Upload className="mr-2 h-4 w-4" />
          Upload proof of payment
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Upload proof of payment</DialogTitle>
            <DialogDescription>
              Order {orderNumber} • {formatPrice(amountCents)}. PNG, JPG, WEBP, or PDF up
              to 8MB.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex flex-col gap-4">
            <div>
              <Label htmlFor="proof-file" className="text-xs">
                Payment screenshot or receipt
              </Label>
              <Input
                id="proof-file"
                type="file"
                accept={ACCEPTED}
                required
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="mt-1 file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-medium"
              />
              {file && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {file.name} • {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="proof-ref" className="text-xs">
                Confirmation number / sender note (optional)
              </Label>
              <Input
                id="proof-ref"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. Zelle confirmation #A1B2C3"
                className="mt-1"
              />
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive"
              >
                {error}
              </p>
            )}
          </div>

          <DialogFooter className="mt-5">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit for review
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default ProofOfPaymentModal;
