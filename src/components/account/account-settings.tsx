"use client";

import * as React from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { ImageUp, Loader2, Save, User as UserIcon } from "lucide-react";

import {
  updateAccountName,
  changeEmail,
  changePassword,
  updateAvatar,
  updateMarketingPref,
} from "@/actions/account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { formatDate } from "@/lib/utils";

interface AccountSettingsProps {
  name: string;
  email: string;
  image: string | null;
  marketingOptIn: boolean;
  memberSince: string | null;
  hasPassword: boolean;
  /** Marketing toggle only makes sense for customers; hidden for admins. */
  showMarketing?: boolean;
}

export function AccountSettings({
  name,
  email,
  image,
  marketingOptIn,
  memberSince,
  hasPassword,
  showMarketing = false,
}: AccountSettingsProps) {
  const { toast } = useToast();
  const { update } = useSession();

  // Profile
  const [nameValue, setNameValue] = React.useState(name);
  const [avatarUrl, setAvatarUrl] = React.useState(image);
  const [savingName, setSavingName] = React.useState(false);
  const [avatarUploading, setAvatarUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  // Email
  const [newEmail, setNewEmail] = React.useState("");
  const [emailPassword, setEmailPassword] = React.useState("");
  const [savingEmail, setSavingEmail] = React.useState(false);
  const [emailError, setEmailError] = React.useState<string | null>(null);

  // Password
  const [curPw, setCurPw] = React.useState("");
  const [newPw, setNewPw] = React.useState("");
  const [confirmPw, setConfirmPw] = React.useState("");
  const [savingPw, setSavingPw] = React.useState(false);
  const [pwError, setPwError] = React.useState<string | null>(null);

  // Preferences
  const [optIn, setOptIn] = React.useState(marketingOptIn);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setSavingName(true);
    try {
      const res = await updateAccountName({ name: nameValue.trim() });
      if (res.ok) {
        toast({ title: "Name updated" });
        await update({ name: nameValue.trim() });
      } else {
        toast({ title: "Couldn't update", description: res.error, variant: "destructive" });
      }
    } finally {
      setSavingName(false);
    }
  }

  async function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAvatarUploading(true);
    try {
      const fd = new FormData();
      fd.set("avatar", file);
      const res = await updateAvatar(fd);
      if (res.ok && res.url) {
        setAvatarUrl(res.url);
        toast({ title: "Photo updated" });
        await update({ picture: res.url });
      } else {
        toast({ title: "Upload failed", description: res.error, variant: "destructive" });
      }
    } finally {
      setAvatarUploading(false);
    }
  }

  async function saveEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailError(null);
    setSavingEmail(true);
    try {
      const res = await changeEmail({ currentPassword: emailPassword, newEmail: newEmail.trim() });
      if (res.ok) {
        toast({ title: "Email updated", description: newEmail.trim() });
        setNewEmail("");
        setEmailPassword("");
        await update({ email: newEmail.trim() });
      } else {
        setEmailError(res.error ?? "Couldn't change email.");
      }
    } finally {
      setSavingEmail(false);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    setSavingPw(true);
    try {
      const res = await changePassword({
        currentPassword: curPw,
        newPassword: newPw,
        confirmPassword: confirmPw,
      });
      if (res.ok) {
        toast({ title: "Password changed" });
        setCurPw("");
        setNewPw("");
        setConfirmPw("");
      } else {
        setPwError(res.error ?? "Couldn't change password.");
      }
    } finally {
      setSavingPw(false);
    }
  }

  async function toggleOptIn(next: boolean) {
    setOptIn(next);
    const res = await updateMarketingPref({ optIn: next });
    if (!res.ok) {
      setOptIn(!next); // revert on failure
      toast({ title: "Couldn't save preference", description: res.error, variant: "destructive" });
    }
  }

  return (
    <div className="flex max-w-lg flex-col gap-4">
      {/* Profile */}
      <form onSubmit={saveName} className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Profile</h2>

        <div className="flex items-center gap-4">
          <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-border bg-secondary">
            {avatarUrl ? (
              <Image src={avatarUrl} alt="" fill sizes="64px" className="object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center">
                <UserIcon className="h-7 w-7 text-primary/40" aria-hidden="true" />
              </span>
            )}
          </span>
          <div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={avatarUploading}
              onClick={() => fileRef.current?.click()}
            >
              {avatarUploading ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <ImageUp className="mr-1.5 h-3.5 w-3.5" />
              )}
              {avatarUrl ? "Replace photo" : "Upload photo"}
            </Button>
          </div>
        </div>

        <div>
          <Label htmlFor="acct-name" className="text-xs">Display name</Label>
          <Input
            id="acct-name"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            className="mt-1"
            autoComplete="name"
          />
        </div>

        {memberSince && (
          <p className="text-xs text-muted-foreground">Member since {formatDate(memberSince)}</p>
        )}

        <Button type="submit" disabled={savingName || nameValue.trim() === name} className="self-start">
          {savingName ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save name
        </Button>
      </form>

      {/* Email */}
      <form onSubmit={saveEmail} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Email</h2>
        <p className="text-xs text-muted-foreground">
          Current: <span className="font-medium text-foreground">{email}</span>
        </p>
        {hasPassword ? (
          <>
            <div>
              <Label htmlFor="new-email" className="text-xs">New email</Label>
              <Input
                id="new-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="mt-1"
                autoComplete="email"
              />
            </div>
            <div>
              <Label htmlFor="email-cur-pw" className="text-xs">Current password</Label>
              <Input
                id="email-cur-pw"
                type="password"
                value={emailPassword}
                onChange={(e) => setEmailPassword(e.target.value)}
                className="mt-1"
                autoComplete="current-password"
              />
            </div>
            {emailError && (
              <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
                {emailError}
              </p>
            )}
            <Button type="submit" disabled={savingEmail || !newEmail || !emailPassword} className="self-start">
              {savingEmail && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update email
            </Button>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            Set a password first (via the reset link) to change your email.
          </p>
        )}
      </form>

      {/* Password */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Password</h2>
        {hasPassword ? (
          <form onSubmit={savePassword} className="flex flex-col gap-3">
            <div>
              <Label htmlFor="cur-pw" className="text-xs">Current password</Label>
              <Input
                id="cur-pw"
                type="password"
                value={curPw}
                onChange={(e) => setCurPw(e.target.value)}
                className="mt-1"
                autoComplete="current-password"
              />
            </div>
            <div>
              <Label htmlFor="new-pw" className="text-xs">New password</Label>
              <Input
                id="new-pw"
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                className="mt-1"
                autoComplete="new-password"
              />
              <p className="mt-0.5 text-[10px] text-muted-foreground">Min 8 chars, 1 uppercase, 1 number.</p>
            </div>
            <div>
              <Label htmlFor="confirm-pw" className="text-xs">Confirm new password</Label>
              <Input
                id="confirm-pw"
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                className="mt-1"
                autoComplete="new-password"
              />
            </div>
            {pwError && (
              <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
                {pwError}
              </p>
            )}
            <Button type="submit" disabled={savingPw || !curPw || !newPw || !confirmPw} className="self-start">
              {savingPw && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Change password
            </Button>
          </form>
        ) : (
          <p className="text-xs text-muted-foreground">
            Your account signs in without a password. Use the emailed reset link to set one.
          </p>
        )}
      </div>

      {/* Preferences (customers only) */}
      {showMarketing && (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Email preferences</h2>
          <label className="flex cursor-pointer items-center gap-2">
            <Checkbox checked={optIn} onCheckedChange={(v) => toggleOptIn(Boolean(v))} />
            <span className="text-sm">Email me about restocks, new batches, and offers</span>
          </label>
        </div>
      )}
    </div>
  );
}

export default AccountSettings;
