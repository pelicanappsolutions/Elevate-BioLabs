import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import "./globals.css";
import Providers from "./providers";
import { auth } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { AgeGate } from "@/components/age-gate";
import { CookieConsent } from "@/components/cookie-consent";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: {
    default: "ElevateBioLab — Analytical Reference Standards (RUO)",
    template: "%s | ElevateBioLab",
  },
  description:
    "ElevateBioLab supplies third-party tested, batch-tracked analytical reference standards for laboratory use. For Research Use Only — not for human or veterinary consumption.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  // Matches the mobile browser chrome color to the OS light/dark preference —
  // same dark navy already used for the site's dark hero sections.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#050a14" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Fetched once here (Server Component) and seeded into SessionProvider so the
  // navbar renders the correct signed-in/out state on first paint instead of
  // flashing "logged out" while useSession() does its own client-side fetch.
  const session = await auth();

  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="font-sans">
        <Providers session={session}>
          <AgeGate />
          <Navbar />
          <main className="min-h-[70vh]">{children}</main>
          <Footer />
          <CookieConsent />
        </Providers>
      </body>
    </html>
  );
}
