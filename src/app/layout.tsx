import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import "./globals.css";
import Providers from "./providers";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { AgeGate } from "@/components/age-gate";
import { CookieConsent } from "@/components/cookie-consent";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: {
    default: "Elevate Bio-Labs — Research Peptides (RUO)",
    template: "%s | Elevate Bio-Labs",
  },
  description:
    "Elevate Bio-Labs supplies third-party tested, batch-tracked research peptides for laboratory use. For Research Use Only — not for human consumption.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#052e2b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable}`} suppressHydrationWarning>
      <body className="font-sans">
        <Providers>
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
