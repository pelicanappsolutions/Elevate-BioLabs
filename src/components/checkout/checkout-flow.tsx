"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  CreditCard,
  Landmark,
  Loader2,
  Lock,
  Bitcoin,
  Smartphone,
} from "lucide-react";
import type { PaymentRail } from "@prisma/client";

import { getShippingQuote, placeOrder } from "@/actions/checkout";
// Import from ./meta, not ./index — index pulls every adapter (and node:crypto
// plus server env) into the client bundle.
import { PAYMENT_RAIL_META } from "@/lib/payments/meta";
import type { ShippingRate } from "@/lib/shipping/usps";
import { cn, formatPrice } from "@/lib/utils";
import { useCart } from "@/store/cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";

interface SavedAddress {
  id: string;
  label: string | null;
  fullName: string;
  street1: string;
  street2: string | null;
  city: string;
  state: string;
  zip: string;
  phone: string | null;
  isDefault: boolean;
}

interface AddressForm {
  fullName: string;
  street1: string;
  street2: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
}

const EMPTY_ADDRESS: AddressForm = {
  fullName: "",
  street1: "",
  street2: "",
  city: "",
  state: "",
  zip: "",
  phone: "",
};

const RAIL_ORDER: PaymentRail[] = [
  "NEXAPAY",
  "SEAMLESSCHEX",
  "COINBASE",
  "PAYRAM",
  "STRIPE",
  "P2P_ZELLE",
  "P2P_VENMO",
  "P2P_WIRE",
];

const RAIL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  card: CreditCard,
  ach: Landmark,
  crypto: Bitcoin,
  p2p: Smartphone,
};

const STEPS = ["Shipping", "Delivery", "Payment", "Review"] as const;

export function CheckoutFlow({
  defaultEmail,
  savedAddresses,
}: {
  defaultEmail: string;
  savedAddresses: SavedAddress[];
}) {
  const router = useRouter();
  const { toast } = useToast();

  const hydrated = useCart((s) => s.hydrated);
  const items = useCart((s) => s.items);
  const subtotal = useCart((s) => s.subtotalCents());
  const clearCart = useCart((s) => s.clear);

  const [step, setStep] = React.useState(0);
  const [email, setEmail] = React.useState(defaultEmail);
  const [ageConfirm, setAgeConfirm] = React.useState(false);

  const defaultSaved = savedAddresses.find((a) => a.isDefault) ?? savedAddresses[0];
  const [address, setAddress] = React.useState<AddressForm>(
    defaultSaved
      ? {
          fullName: defaultSaved.fullName,
          street1: defaultSaved.street1,
          street2: defaultSaved.street2 ?? "",
          city: defaultSaved.city,
          state: defaultSaved.state,
          zip: defaultSaved.zip,
          phone: defaultSaved.phone ?? "",
        }
      : EMPTY_ADDRESS
  );

  const [rates, setRates] = React.useState<ShippingRate[]>([]);
  const [loadingRates, setLoadingRates] = React.useState(false);
  const [shipService, setShipService] = React.useState<string>("");
  const [rail, setRail] = React.useState<PaymentRail>("NEXAPAY");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const selectedRate = rates.find((r) => r.service === shipService);
  const shippingCents = selectedRate?.amountCents ?? 0;
  // Display-only estimate. placeOrder re-prices everything server-side.
  const estTotal = subtotal + shippingCents;

  /** Pull live USPS rates once we have a deliverable ZIP. */
  const fetchRates = React.useCallback(async () => {
    if (!/^\d{5}(-\d{4})?$/.test(address.zip) || items.length === 0) return;
    setLoadingRates(true);
    try {
      const res = await getShippingQuote({
        toZip: address.zip,
        toState: address.state,
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      });
      setRates(res.rates);
      setShipService((prev) =>
        res.rates.some((r) => r.service === prev) ? prev : res.rates[0]?.service ?? ""
      );
    } catch {
      toast({
        title: "Couldn't load shipping rates",
        description: "Check the ZIP code and try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingRates(false);
    }
  }, [address.zip, address.state, items, toast]);

  function validateAddress(): string | null {
    if (!/^\S+@\S+\.\S+$/.test(email)) return "Enter a valid email address.";
    if (address.fullName.trim().length < 2) return "Enter the recipient's full name.";
    if (address.street1.trim().length < 3) return "Enter a street address.";
    if (address.city.trim().length < 2) return "Enter a city.";
    if (!/^[A-Za-z]{2}$/.test(address.state)) return "Enter a 2-letter state code.";
    if (!/^\d{5}(-\d{4})?$/.test(address.zip)) return "Enter a valid US ZIP code.";
    return null;
  }

  async function next() {
    setError(null);
    if (step === 0) {
      const problem = validateAddress();
      if (problem) return setError(problem);
      setStep(1);
      void fetchRates();
      return;
    }
    if (step === 1) {
      if (!shipService) return setError("Select a shipping service.");
      setStep(2);
      return;
    }
    if (step === 2) {
      setStep(3);
      return;
    }
  }

  async function submit() {
    setError(null);
    if (!ageConfirm) {
      return setError("Please confirm the Research Use Only acknowledgement.");
    }

    setSubmitting(true);
    try {
      const result = await placeOrder({
        email,
        address: {
          fullName: address.fullName,
          street1: address.street1,
          street2: address.street2 || undefined,
          city: address.city,
          state: address.state.toUpperCase(),
          zip: address.zip,
          country: "US",
          phone: address.phone || undefined,
        },
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        rail,
        shipService,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      // The order now exists server-side with stock reserved, so the local cart
      // has done its job — drop it before handing off to the gateway.
      clearCart();

      if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
        return;
      }
      router.push(`/checkout/success?order=${result.orderNumber}`);
    } catch {
      setError("Something went wrong placing your order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!hydrated) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Skeleton className="h-96 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-12 text-center">
        <h2 className="text-lg font-semibold">Nothing to check out</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your cart is empty. Add a compound to continue.
        </p>
        <Button asChild className="mt-5">
          <Link href="/products">Browse catalog</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
      <div>
        {/* Step indicator */}
        <ol className="mb-6 flex items-center gap-1.5" aria-label="Checkout progress">
          {STEPS.map((label, i) => (
            <li key={label} className="flex flex-1 items-center gap-1.5">
              <div className="flex flex-1 flex-col gap-1.5">
                <div
                  className={cn(
                    "h-1 rounded-full transition-colors",
                    i <= step ? "bg-primary" : "bg-border"
                  )}
                />
                <span
                  className={cn(
                    "text-[11px] font-medium sm:text-xs",
                    i <= step ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {label}
                </span>
              </div>
            </li>
          ))}
        </ol>

        <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
          {/* ── Step 0: contact + address ── */}
          {step === 0 && (
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold">Contact & shipping address</h2>

              {savedAddresses.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {savedAddresses.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() =>
                        setAddress({
                          fullName: a.fullName,
                          street1: a.street1,
                          street2: a.street2 ?? "",
                          city: a.city,
                          state: a.state,
                          zip: a.zip,
                          phone: a.phone ?? "",
                        })
                      }
                      className="tap rounded-md border border-border px-3 text-left text-xs transition-colors hover:border-primary/50"
                    >
                      <span className="font-medium">{a.label ?? a.fullName}</span>
                      <span className="block text-muted-foreground">
                        {a.street1}, {a.city} {a.state}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <Field
                id="email"
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="you@lab.com"
                autoComplete="email"
              />
              <Field
                id="fullName"
                label="Full name"
                value={address.fullName}
                onChange={(v) => setAddress((a) => ({ ...a, fullName: v }))}
                autoComplete="name"
              />
              <Field
                id="street1"
                label="Street address"
                value={address.street1}
                onChange={(v) => setAddress((a) => ({ ...a, street1: v }))}
                autoComplete="address-line1"
              />
              <Field
                id="street2"
                label="Apt, suite, unit (optional)"
                value={address.street2}
                onChange={(v) => setAddress((a) => ({ ...a, street2: v }))}
                autoComplete="address-line2"
              />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Field
                  id="city"
                  label="City"
                  value={address.city}
                  onChange={(v) => setAddress((a) => ({ ...a, city: v }))}
                  autoComplete="address-level2"
                />
                <Field
                  id="state"
                  label="State"
                  value={address.state}
                  onChange={(v) =>
                    setAddress((a) => ({ ...a, state: v.toUpperCase().slice(0, 2) }))
                  }
                  placeholder="TX"
                  autoComplete="address-level1"
                />
                <Field
                  id="zip"
                  label="ZIP"
                  value={address.zip}
                  onChange={(v) => setAddress((a) => ({ ...a, zip: v }))}
                  inputMode="numeric"
                  autoComplete="postal-code"
                />
              </div>
              <Field
                id="phone"
                label="Phone (optional, for carrier updates)"
                value={address.phone}
                onChange={(v) => setAddress((a) => ({ ...a, phone: v }))}
                inputMode="tel"
                autoComplete="tel"
              />
            </div>
          )}

          {/* ── Step 1: shipping service ── */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold">Delivery method</h2>
              {loadingRates ? (
                <div className="flex flex-col gap-2">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                  ))}
                </div>
              ) : rates.length === 0 ? (
                <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  No rates returned for {address.zip}.
                  <Button variant="link" onClick={() => void fetchRates()}>
                    Retry
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2" role="radiogroup">
                  {rates.map((rate) => (
                    <button
                      key={rate.service}
                      type="button"
                      role="radio"
                      aria-checked={shipService === rate.service}
                      onClick={() => setShipService(rate.service)}
                      className={cn(
                        "tap flex items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors",
                        shipService === rate.service
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40"
                      )}
                    >
                      <div>
                        <p className="text-sm font-medium">{rate.label}</p>
                        <p className="text-xs text-muted-foreground">{rate.estDays}</p>
                      </div>
                      <span className="text-sm font-semibold">
                        {rate.amountCents === 0 ? "Free" : formatPrice(rate.amountCents)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: payment rail ── */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold">Payment method</h2>
              <div className="flex flex-col gap-2" role="radiogroup">
                {RAIL_ORDER.map((r) => {
                  const meta = PAYMENT_RAIL_META[r];
                  const Icon = RAIL_ICONS[meta.type] ?? CreditCard;
                  return (
                    <button
                      key={r}
                      type="button"
                      role="radio"
                      aria-checked={rail === r}
                      onClick={() => setRail(r)}
                      className={cn(
                        "tap flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                        rail === r
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40"
                      )}
                    >
                      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium">{meta.label}</p>
                          <Badge variant="outline" className="font-normal">
                            {meta.feeNote}
                          </Badge>
                          {meta.requiresProof && (
                            <Badge variant="secondary" className="font-normal">
                              Manual review
                            </Badge>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {meta.description}
                        </p>
                      </div>
                      {rail === r && <Check className="h-4 w-4 shrink-0 text-primary" />}
                    </button>
                  );
                })}
              </div>

              {PAYMENT_RAIL_META[rail].requiresProof && (
                <div className="flex gap-2 rounded-md border border-primary/30 bg-primary/5 p-3">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-primary" />
                  <p className="text-xs text-muted-foreground">
                    After placing the order you&apos;ll get payment instructions and a
                    screen to upload your payment screenshot. We release the order once
                    an admin verifies it — usually within a few hours.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Step 3: review ── */}
          {step === 3 && (
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold">Review & place order</h2>

              <ReviewRow title="Contact" onEdit={() => setStep(0)}>
                {email}
              </ReviewRow>
              <ReviewRow title="Ship to" onEdit={() => setStep(0)}>
                {address.fullName}
                <br />
                {address.street1}
                {address.street2 ? `, ${address.street2}` : ""}
                <br />
                {address.city}, {address.state.toUpperCase()} {address.zip}
              </ReviewRow>
              <ReviewRow title="Delivery" onEdit={() => setStep(1)}>
                {selectedRate?.label ?? shipService} — {selectedRate?.estDays}
              </ReviewRow>
              <ReviewRow title="Payment" onEdit={() => setStep(2)}>
                {PAYMENT_RAIL_META[rail].label}
              </ReviewRow>

              <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border p-3">
                <Checkbox
                  checked={ageConfirm}
                  onCheckedChange={(v) => setAgeConfirm(Boolean(v))}
                  className="mt-0.5"
                />
                <span className="text-xs leading-relaxed text-muted-foreground">
                  I confirm I am 18 or older, that I am purchasing these compounds
                  strictly For Research Use Only, and that I will not administer them to
                  humans or animals. I have read the{" "}
                  <Link href="/compliance" className="text-primary underline">
                    compliance policy
                  </Link>
                  .
                </span>
              </label>
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          {/* Nav */}
          <div className="mt-6 flex gap-3">
            {step > 0 && (
              <Button
                variant="outline"
                onClick={() => setStep((s) => s - 1)}
                disabled={submitting}
                className="tap"
              >
                Back
              </Button>
            )}
            {step < 3 ? (
              <Button onClick={next} className="tap flex-1">
                Continue
              </Button>
            ) : (
              <Button
                onClick={submit}
                disabled={submitting}
                size="lg"
                className="tap flex-1"
              >
                {submitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Lock className="mr-2 h-4 w-4" />
                )}
                Place order • {formatPrice(estTotal)}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Summary rail */}
      <div className="lg:sticky lg:top-8">
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-base font-semibold">Order summary</h2>
          <ul className="mt-3 flex flex-col gap-3">
            {items.map((i) => (
              <li key={i.productId} className="flex justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="line-clamp-1 font-medium">{i.name}</span>
                  <span className="text-xs text-muted-foreground">
                    Qty {i.quantity} • {i.sku}
                  </span>
                </span>
                <span className="shrink-0 font-medium">
                  {formatPrice(i.priceCents * i.quantity)}
                </span>
              </li>
            ))}
          </ul>

          <Separator className="my-4" />

          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd>{formatPrice(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Shipping</dt>
              <dd>
                {selectedRate ? formatPrice(shippingCents) : "—"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Tax</dt>
              <dd className="text-xs text-muted-foreground">Applied at order time</dd>
            </div>
          </dl>

          <Separator className="my-4" />

          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium">Estimated total</span>
            <span className="text-xl font-bold">{formatPrice(estTotal)}</span>
          </div>

          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Lock className="h-3 w-3" />
            Bulk tiers, tax, and shipping are re-verified server-side before charging.
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  inputMode,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  inputMode?: "text" | "numeric" | "tel" | "decimal" | "email";
  autoComplete?: string;
}) {
  return (
    <div>
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1"
      />
    </div>
  );
}

function ReviewRow({
  title,
  children,
  onEdit,
}: {
  title: string;
  children: React.ReactNode;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
        <p className="mt-1 text-sm">{children}</p>
      </div>
      <Button variant="ghost" size="sm" onClick={onEdit} className="shrink-0">
        Edit
      </Button>
    </div>
  );
}

export default CheckoutFlow;
