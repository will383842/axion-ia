// Coquille du questionnaire de cadrage EN LIGNE (2026-10-01) — hors de
// `[locale]/`, comme `/maintenance` (seule autre page racine du site).
//
// Pourquoi hors de la coquille du site : `[locale]/layout.tsx` monte l'en-tête,
// le pied de page, le chatbot et les scripts de mesure (Plausible, Clarity,
// LinkedIn, Meta). Une page qui porte un lien secret dans son adresse et des
// réponses de client dans ses champs n'en veut AUCUN : zéro script tiers, zéro
// navigation qui ferait fuir l'adresse. Le proxy l'exclut aussi de son
// `matcher` (sinon 301 vers `/fr/questionnaire/…`, qui n'existe pas) ; les
// en-têtes (`no-store`, `Referrer-Policy: same-origin`, `noindex`, CSP) sont posés par
// `next.config.ts`.
//
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
  // Aucun `metadataBase` utile ici : pas d'image sociale, pas d'URL canonique
  // (la page ne doit être ni partagée ni indexée). Valeur fixe pour taire
  // l'avertissement de Next sur l'image OG racine héritée.
  metadataBase: new URL("https://axion-ia.com"),
  title: "Questionnaire — Axion-IA",
  robots: { index: false, follow: false, nocache: true },
  referrer: "same-origin",
  openGraph: null,
  twitter: null,
};

export default function QuestionnaireLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${manrope.variable} ${fraunces.variable}`}>
      <body className="bg-bg text-fg min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
