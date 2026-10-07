// Coquille du dossier d'apporteur EN LIGNE (2026-10-05) — hors de `[locale]/`, comme
// `/questionnaire` et `/maintenance`. Le lien personnel de l'apporteur est secret et la
// page porte son identité et ses pièces : aucun script tiers, aucune navigation qui ferait
// fuir l'adresse. Le proxy l'exclut de son `matcher` (`apporteur/dossier/`) ; les
// en-têtes (`no-store`, `Referrer-Policy`, `noindex`, CSP) sont posés par `next.config.ts`.
// Polices : les mêmes fichiers que le site (`src/fonts/`), Manrope et Fraunces.

import type { Metadata } from "next";
import localFont from "next/font/local";
import "../globals.css";

const manrope = localFont({
  src: [
    { path: "../../fonts/manrope-latin-var.woff2", weight: "400", style: "normal" },
    { path: "../../fonts/manrope-latin-var.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-manrope",
  display: "swap",
});

const fraunces = localFont({
  src: [{ path: "../../fonts/fraunces-latin-var.woff2", weight: "500", style: "normal" }],
  variable: "--font-fraunces",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});

export const metadata: Metadata = {
  // Valeur fixe pour taire l'avertissement de Next sur l'image OG racine héritée.
  metadataBase: new URL("https://axion-ia.com"),
  title: "Dossier d'apporteur — Axion-IA",
  robots: { index: false, follow: false, nocache: true },
  referrer: "same-origin",
  openGraph: null,
  twitter: null,
};

export default function ApporteurLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${manrope.variable} ${fraunces.variable}`}>
      <body className="bg-bg text-fg min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
