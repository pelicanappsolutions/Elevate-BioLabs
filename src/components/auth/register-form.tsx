"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { registerUser } from "@/actions/auth";
import { isInstitutionalEmail } from "@/lib/validations";

type VerificationTier = "INSTITUTIONAL" | "INDEPENDENT";

const RESEARCH_APPLICATIONS = [
  { value: "HPLC_REFERENCE_STANDARD", label: "HPLC Reference Standard" },
  { value: "MASS_SPECTROMETRY_CALIBRATION", label: "Mass Spectrometry Calibration" },
  { value: "RECEPTOR_BINDING_ASSAY", label: "Receptor Binding Assay" },
  { value: "CHROMATOGRAPHY_METHOD_DEVELOPMENT", label: "Chromatography Method Development" },
] as const;

const CERTIFICATION_TEMPLATE = `I certify that I operate a private analytical chemistry laboratory equipped for peptide analysis. I understand these materials are unapproved chemical reagents intended for research applications only. I intend to use them for chromatography reference standards, mass spectrometry calibration, or receptor binding assays. I will not introduce these materials into humans or animals.`;

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

  const [verificationTier, setVerificationTier] = useState<VerificationTier | "">("");

  const [labName, setLabName] = useState("");
  const [einOrRegistration, setEinOrRegistration] = useState("");
  const [labStreet1, setLabStreet1] = useState("");
  const [labStreet2, setLabStreet2] = useState("");
  const [labCity, setLabCity] = useState("");
  const [labState, setLabState] = useState("");
  const [labZip, setLabZip] = useState("");
  const [researchApplication, setResearchApplication] = useState("");
  const [equipmentCertified, setEquipmentCertified] = useState(false);
  const [certificationAccepted, setCertificationAccepted] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const emailIsInstitutional = isInstitutionalEmail(email);

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
    if (!verificationTier) {
      setError("Select a verification track.");
      return;
    }
    if (verificationTier === "INSTITUTIONAL" && !emailIsInstitutional) {
      setError("Institutional verification requires an .edu, .gov, or recognized academic/government email domain.");
      return;
    }
    if (verificationTier === "INDEPENDENT" && !certificationAccepted) {
      setError("You must electronically sign the Independent Laboratory Certification.");
      return;
    }

    const payload: {
      name: string;
      email: string;
      password: string;
      confirmPassword: string;
      ageConfirm: boolean;
      verificationTier: VerificationTier;
      labProfile?: {
        labName: string;
        einOrRegistration: string;
        labStreet1: string;
        labStreet2?: string;
        labCity: string;
        labState: string;
        labZip: string;
        researchApplication: string;
        equipmentCertified: boolean;
        certificationText: string;
      };
    } = {
      name,
      email,
      password,
      confirmPassword,
      ageConfirm,
      verificationTier,
    };

    if (verificationTier === "INDEPENDENT") {
      payload.labProfile = {
        labName,
        einOrRegistration,
        labStreet1,
        labStreet2: labStreet2 || undefined,
        labCity,
        labState: labState.toUpperCase(),
        labZip,
        researchApplication,
        equipmentCertified,
        certificationText: CERTIFICATION_TEMPLATE,
      };
    }

    setLoading(true);
    try {
      const res = await registerUser(payload);
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
        <p className="text-xs text-muted-foreground">
          Institutional emails (.edu, .gov) are auto-approved. All other domains require
          Independent Laboratory verification.
        </p>
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

      <div className="space-y-2">
        <Label>Verification track</Label>
        <Select
          value={verificationTier}
          onValueChange={(v) => setVerificationTier(v as VerificationTier)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select your research setting" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="INSTITUTIONAL">
              Institutional Fast Lane (.edu / .gov / corporate lab)
            </SelectItem>
            <SelectItem value="INDEPENDENT">
              Verified Independent Laboratory
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {verificationTier === "INSTITUTIONAL" && (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm text-muted-foreground">
          Track A: Institutional Fast Lane. Email-domain verification applies. No additional
          documentation is required; standard For Research Use Only labeling applies.
        </div>
      )}

      {verificationTier === "INDEPENDENT" && (
        <div className="space-y-4 rounded-lg border border-border bg-muted/40 p-4">
          <h3 className="text-sm font-semibold">Independent Laboratory verification</h3>
          <p className="text-xs text-muted-foreground">
            This track creates an enhanced liability paper trail proving your infrastructure for
            analytical research, not consumption.
          </p>

          <div className="space-y-2">
            <Label htmlFor="labName">Laboratory name</Label>
            <Input
              id="labName"
              value={labName}
              onChange={(e) => setLabName(e.target.value)}
              placeholder="[LastName] Analytical Services"
            />
            <p className="text-xs text-muted-foreground">
              Cannot be &quot;Home&quot; or &quot;Personal&quot;. Use a professional analytical-services name.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ein">EIN or business registration number</Label>
            <Input
              id="ein"
              value={einOrRegistration}
              onChange={(e) => setEinOrRegistration(e.target.value)}
              placeholder="XX-XXXXXXX"
            />
            <p className="text-xs text-muted-foreground">
              Sole proprietorship EINs are accepted. Obtain one free from the IRS in minutes if needed.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="labStreet1">Laboratory address</Label>
              <Input
                id="labStreet1"
                value={labStreet1}
                onChange={(e) => setLabStreet1(e.target.value)}
                placeholder="123 Main St"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="labStreet2">Suite / Lab / Unit</Label>
              <Input
                id="labStreet2"
                value={labStreet2}
                onChange={(e) => setLabStreet2(e.target.value)}
                placeholder="Suite 100 or Lab"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Residential addresses are accepted if labeled &quot;Suite&quot; or &quot;Lab&quot;.
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="labCity">City</Label>
              <Input
                id="labCity"
                value={labCity}
                onChange={(e) => setLabCity(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="labState">State</Label>
              <Input
                id="labState"
                value={labState}
                onChange={(e) => setLabState(e.target.value.toUpperCase().slice(0, 2))}
                placeholder="TX"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="labZip">ZIP</Label>
              <Input
                id="labZip"
                value={labZip}
                onChange={(e) => setLabZip(e.target.value)}
                inputMode="numeric"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="researchApplication">Intended research application</Label>
            <Select
              value={researchApplication}
              onValueChange={setResearchApplication}
            >
              <SelectTrigger id="researchApplication">
                <SelectValue placeholder="Select an analytical application" />
              </SelectTrigger>
              <SelectContent>
                {RESEARCH_APPLICATIONS.map((app) => (
                  <SelectItem key={app.value} value={app.value}>
                    {app.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-start gap-3 rounded-md border border-border bg-background p-3">
            <Checkbox
              id="equipmentCertified"
              checked={equipmentCertified}
              onCheckedChange={(v) => setEquipmentCertified(v === true)}
            />
            <Label htmlFor="equipmentCertified" className="text-sm font-normal leading-snug">
              I certify access to analytical equipment (HPLC, LC-MS, or equivalent) suitable for
              peptide analysis.
            </Label>
          </div>

          <div className="space-y-2 rounded-md border border-border bg-background p-3">
            <Label className="text-sm font-semibold">Independent Laboratory Certification</Label>
            <p className="max-h-32 overflow-y-auto text-xs leading-relaxed text-muted-foreground">
              {CERTIFICATION_TEMPLATE}
            </p>
            <div className="flex items-start gap-3 pt-2">
              <Checkbox
                id="certificationAccepted"
                checked={certificationAccepted}
                onCheckedChange={(v) => setCertificationAccepted(v === true)}
              />
              <Label
                htmlFor="certificationAccepted"
                className="text-xs font-normal leading-snug"
              >
                I electronically sign this certification. I understand it is generated with a
                timestamp and IP address for our compliance records.
              </Label>
            </div>
          </div>
        </div>
      )}

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
