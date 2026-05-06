import type { Metadata } from "next";
import { Manrope, Inconsolata } from "next/font/google";
import "./globals.css";

// Manrope = open-source substitute for Webflow's proprietary `WF Visual Sans
// Variable`. Cf. Design.md §3 + ADR 0001-design-direction-webflow.md.
const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const inconsolata = Inconsolata({
  subsets: ["latin"],
  variable: "--font-inconsolata",
  display: "swap",
});

export const metadata: Metadata = {
  // Sprint 2 wires `generateMetadata` per locale + canonical/hreflang.
  title: "AxionIA — Cabinet IA opérationnel",
  description:
    "Cabinet IA opérationnel · interventions, audit et implémentation IA pour entreprises.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${manrope.variable} ${inconsolata.variable} h-full antialiased`}>
      <body className="bg-bg text-fg flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
