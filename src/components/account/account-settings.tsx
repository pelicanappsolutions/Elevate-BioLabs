"use client";

import * as React from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import {
  Bell,
  Camera,
  Loader2,
  Lock,
  Mail,
  Save,
  Shield,
  User as UserIcon,
} from "lucide-react";

import {
  updateAccountName,
  changeEmail,
  changePassword,
  updateAvatar,
  updateMarketingPref,
} from "@/actions/account";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <CardHeader className="flex-row items-start gap-3 space-y-0 p-4 pb-0 sm:p-5 sm:pb-0">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </span>
      <div>
        <h2 className="text-sm font-semibold leading-none">{title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
    </CardHeader>
  );
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
    <div className="flex max-w-2xl flex-col gap-5">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Account settings</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Manage your profile, login, and email preferences.
        </p>
      </div>

      {/* Profile */}
      <Card>
        <form onSubmit={saveName}>
          <SectionHeader
            icon={UserIcon}
            title="Profile"
            description="Your name and photo, shown across orders and the admin activity log."
          />
          <CardContent className="flex flex-col gap-4 p-4 pt-4 sm:p-5 sm:pt-4">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={avatarUploading}
                aria-label={avatarUrl ? "Replace photo" : "Upload photo"}
                className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-border bg-secondary ring-2 ring-transparent transition hover:ring-primary/30 disabled:cursor-not-allowed"
              >
                {avatarUrl ? (
                  <Image src={avatarUrl} alt="" fill sizes="80px" className="object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center">
                    <UserIcon className="h-8 w-8 text-primary/40" aria-hidden="true" />
                  </span>
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  {avatarUploading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                  ) : (
                    <Camera className="h-5 w-5 text-white" />
                  )}
                </span>
              </button>
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
                    <Camera className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {avatarUrl ? "Replace photo" : "Upload photo"}
                </Button>
                <p className="mt-1.5 text-[11px] text-muted-foreground">JPG or PNG, up to 8MB.</p>
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

            <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
              {memberSince ? (
                <p className="text-xs text-muted-foreground">Member since {formatDate(memberSince)}</p>
              ) : (
                <span />
              )}
              <Button type="submit" size="sm" disabled={savingName || nameValue.trim() === name}>
                {savingName ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-2 h-3.5 w-3.5" />}
                Save name
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>

      {/* Email */}
      <Card>
        <form onSubmit={saveEmail}>
          <SectionHeader icon={Mail} title="Email" description="Used for login and order notifications." />
          <CardContent className="flex flex-col gap-3 p-4 pt-4 sm:p-5 sm:pt-4">
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
                <div className="flex justify-end border-t border-border pt-4">
                  <Button type="submit" size="sm" disabled={savingEmail || !newEmail || !emailPassword}>
                    {savingEmail && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                    Update email
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Set a password first (via the reset link) to change your email.
              </p>
            )}
          </CardContent>
        </form>
      </Card>

      {/* Password */}
      <Card>
        <SectionHeader icon={Lock} title="Password" description="Keep your account secure with a strong, unique password." />
        <CardContent className="p-4 pt-4 sm:p-5 sm:pt-4">
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
              <div className="flex justify-end border-t border-border pt-4">
                <Button type="submit" size="sm" disabled={savingPw || !curPw || !newPw || !confirmPw}>
                  {savingPw && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                  Change password
                </Button>
              </div>
            </form>
          ) : (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="h-3.5 w-3.5 shrink-0" />
              Your account signs in without a password. Use the emailed reset link to set one.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Preferences (customers only) */}
      {showMarketing && (
        <Card>
          <SectionHeader icon={Bell} title="Email preferences" description="Control what marketing email you receive." />
          <CardContent className="p-4 pt-4 sm:p-5 sm:pt-4">
            <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border p-3 hover:bg-secondary/40">
              <Checkbox
                checked={optIn}
                onCheckedChange={(v) => toggleOptIn(Boolean(v))}
                className="mt-0.5"
              />
              <span>
                <span className="block text-sm font-medium">Marketing emails</span>
                <span className="block text-xs text-muted-foreground">
                  Restocks, new batches, and occasional offers. You can unsubscribe anytime.
                </span>
              </span>
            </label>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default AccountSettings;
