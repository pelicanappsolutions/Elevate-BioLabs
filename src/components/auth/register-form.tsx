"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { registerUser } from "@/actions/auth";

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ageConfirm, setAgeConfirm] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!ageConfirm) {
      setError("You must confirm you are 18 years or older.");
      return;
    }

    setLoading(true);
    try {
      const res = await registerUser({
        name,
        email,
        password,
        confirmPassword,
        ageConfirm,
      });
      if (!res.ok) {
        setError(res.error ?? "Registration failed. Please try again.");
        toast({ variant: "destructive", title: "Couldn't create account", description: res.error });
        return;
      }

      const signInRes = await signIn("credentials", { email, password, redirect: false });
      if (signInRes?.ok) {
        toast({ title: "Account created", description: "Welcome to Elevate Bio-Labs." });
        router.push(callbackUrl);
        router.refresh();
      } else {
        toast({ title: "Account created", description: "Please sign in." });
        router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="name">Full name</Label>
        <Input
          id="name"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Min. 8 characters, one uppercase letter, one number.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3">
        <Checkbox
          id="ageConfirm"
          checked={ageConfirm}
          onCheckedChange={(v) => setAgeConfirm(v === true)}
          aria-required="true"
        />
        <Label htmlFor="ageConfirm" className="text-sm font-normal leading-snug">
          I confirm I am at least 18 years old and am acquiring these materials for laboratory
          research use only, not for human or veterinary consumption.
        </Label>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
        Create account
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Research-use-only materials; not for human or veterinary use.
      </p>
    </form>
  );
}
