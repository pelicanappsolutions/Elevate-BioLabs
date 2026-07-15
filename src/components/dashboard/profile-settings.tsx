"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, Save } from "lucide-react";

import { updateProfile } from "@/actions/dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { formatDate } from "@/lib/utils";

export function ProfileSettings({
  name,
  email,
  memberSince,
}: {
  name: string;
  email: string;
  memberSince: string | null;
}) {
  const { toast } = useToast();
  const [value, setValue] = React.useState(name);
  const [pending, setPending] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const res = await updateProfile({ name: value.trim() });
      if (res.ok) toast({ title: "Profile updated" });
      else
        toast({
          title: "Couldn't update",
          description: res.error,
          variant: "destructive",
        });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="max-w-lg">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4"
      >
        <h2 className="text-sm font-semibold">Profile</h2>

        <div>
          <Label htmlFor="name" className="text-xs">
            Display name
          </Label>
          <Input
            id="name"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="mt-1"
            autoComplete="name"
          />
        </div>

        <div>
          <Label htmlFor="email" className="text-xs">
            Email
          </Label>
          {/* Email is the auth identifier — changing it needs re-verification,
              so it's read-only here. */}
          <Input id="email" value={email} disabled className="mt-1" />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Contact support to change the email on your account.
          </p>
        </div>

        {memberSince && (
          <p className="text-xs text-muted-foreground">
            Member since {formatDate(memberSince)}
          </p>
        )}

        <Button type="submit" disabled={pending || value.trim() === name}>
          {pending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save changes
        </Button>
      </form>

      <div className="mt-4 rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Security</h2>
        <Separator className="my-3" />
        <p className="text-sm text-muted-foreground">
          Reset your password via the emailed link flow.
        </p>
        <Button asChild variant="outline" size="sm" className="mt-3">
          <Link href="/forgot-password">Reset password</Link>
        </Button>
      </div>
    </div>
  );
}

export default ProfileSettings;
