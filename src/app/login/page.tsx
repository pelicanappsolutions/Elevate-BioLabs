import { Suspense } from "react";

import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = {
  title: "Sign In",
};

export default function LoginPage() {
  return (
    <AuthSplitLayout
      heroTitle="Sign in required"
      heroSubtitle="Sign in to your qualified researcher account to access the full catalog, order tracking, dosage logs, and downloadable COAs. Don't have an account? Register and verify your free account now."
      heroCtaHref="/register"
      heroCtaLabel="Register here"
      formTitle="Sign in required"
      footerPrompt="Not a member yet?"
      footerLinkHref="/register"
      footerLinkLabel="Register here"
    >
      <Suspense fallback={<div className="h-72 animate-pulse rounded-lg bg-muted" />}>
        <LoginForm />
      </Suspense>
    </AuthSplitLayout>
  );
}
