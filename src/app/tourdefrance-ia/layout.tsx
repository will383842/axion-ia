// Coquille de la landing du Tour de France IA (2026-10-25) — hors de `[locale]/`,
// comme le questionnaire et `/maintenance`.
//
// Pourquoi hors de la coquille du site : `[locale]/layout.tsx` monte l'en-tête
// et le pied de page d'Axion, next-intl, le chatbot et les scripts de mesure. La
// landing n'en veut AUCUN : c'est une page d'événement, mobile d'abord, sans
// script tiers. Elle a son propre bandeau et son propre pied de page.
//
// Le proxy ne la 301 PAS vers `/fr/…` : sa règle 0-TDF la sert telle quelle (et
// répond 404 tant que `TOUR_PUBLIC` est faux, sauf aperçu par cookie).
//
// Polices : les mêmes fichiers que le site (`src/fonts/`), mêmes replis
// métriques manuels (`globals.css`, « Fraunces Fallback », « Manrope Fallback »).
// Fraunces 500 est PRÉCHARGÉE : c'est la police du H1, donc du LCP.

import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import { TOUR_PUBLIC } from "@/features/tour-de-france/visibilite";
import { SITE_URL } from "@/lib/site-url";

import "../globals.css";

const manrope = localFont({
  src: [
    { path: "../../fonts/manrope-latin-var.woff2", weight: "400", style: "normal" },
    { path: "../../fonts/manrope-latin-var.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-manrope",
  display: "swap",
  adjustFontFallback: false,
});

const fraunces = localFont({
  src: [{ path: "../../fonts/fraunces-latin-var.woff2", weight: "500", style: "normal" }],
  variable: "--font-fraunces",
  display: "swap",
  preload: true,
  adjustFontFallback: false,
});

// Repères (numéros, surtitres) : ~5 % du texte, jamais au-dessus de la ligne de
// flottaison en LCP — pas de préchargement, comme sur le reste du site.
const inconsolata = localFont({
  src: [{ path: "../../fonts/inconsolata-latin-var.woff2", weight: "200 900", style: "normal" }],
  variable: "--font-inconsolata",
  display: "swap",
  preload: false,
});

// Même garde que `maintenance/layout.tsx` : au prérendu, `SITE_URL` peut valoir
// localhost ; l'image de partage et la canonique doivent viser la production.
const ORIGINE = SITE_URL.startsWith("http://localhost") ? "https://axion-ia.com" : SITE_URL;

export const metadata: Metadata = {
  metadataBase: new URL(ORIGINE),
  // Fermé : ni indexé, ni suivi. Ouvert (`TOUR_PUBLIC`) : indexable.
  robots: TOUR_PUBLIC ? { index: true, follow: true } : { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#faf8f3", // hex-ok: ivoire de la charte, dupliqué de globals.css --color-bg (Next exige un littéral)
  colorScheme: "light",
};

export default function TourLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${manrope.variable} ${fraunces.variable} ${inconsolata.variable}`}>
      <body className="bg-bg text-fg min-h-screen overflow-x-clip font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
