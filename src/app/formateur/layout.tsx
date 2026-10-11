// Coquille du dossier en ligne du FORMATEUR indépendant (lot L5) — hors de `[locale]/`,
// comme `/apporteur/dossier`. Le lien personnel est secret et la page porte l'identité et
// les pièces du formateur : aucun script tiers. Le proxy l'exclut de son `matcher`
// (`formateur/dossier/`) ; les en-têtes (`Referrer-Policy: same-origin`, `noindex`, CSP)
// sont posés par `next.config.ts`. Polices : les mêmes fichiers que le site (`src/fonts/`).

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
  metadataBase: new URL("https://axion-ia.com"),
  title: "Dossier de formateur — Axion-IA",
  robots: { index: false, follow: false, nocache: true },
  referrer: "same-origin",
  openGraph: null,
  twitter: null,
};

export default function FormateurLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${manrope.variable} ${fraunces.variable}`}>
      <body className="bg-bg text-fg min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
