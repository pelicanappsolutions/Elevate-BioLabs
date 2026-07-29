import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata = {
  title: "Create Account",
};

export default function RegisterPage() {
  return (
    <AuthSplitLayout
      heroTitle="Register account"
      heroSubtitle="An account is required to browse and purchase analytical reference materials. Institutional emails (.edu / .gov) are auto-approved. Independent researchers complete enhanced laboratory verification before checkout. Every compound is third-party tested and HPLC-MS verified, with COAs published for every batch."
      heroCtaHref="/login"
      heroCtaLabel="Sign in here"
      formTitle="Create your account"
      footerPrompt="Already have an account?"
      footerLinkHref="/login"
      footerLinkLabel="Sign in here"
    >
      <RegisterForm />
    </AuthSplitLayout>
  );
}
