// Coquille de la page « Recevoir le guide » (lot S2) — hors de `[locale]/`, comme `/questionnaire`.
//
// Pourquoi hors de la coquille du site : le lien porte un jeton secret dans son adresse. La page
// n'a besoin ni d'en-tête, ni de chatbot, ni de mesure d'audience (aucun script tiers), ni de
// navigation qui ferait fuir l'adresse. Le proxy l'exclut de son `matcher` (sinon 301 vers
// `/fr/guide-reseau`, qui n'existe pas) ; les en-têtes (`no-referrer`, `noindex`, CSP) sont posés
// par `next.config.ts`.
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

export const metadata: Metadata = {
  metadataBase: new URL("https://axion-ia.com"),
  title: "Recevoir le guide — Axion-IA",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
  openGraph: null,
  twitter: null,
};

export default function GuideReseauLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={manrope.variable}>
      <body className="bg-bg text-fg min-h-screen font-sans antialiased">
        <header className="border-border border-b">
          <div className="mx-auto flex h-16 max-w-xl items-center gap-2.5 px-5">
            <span aria-hidden="true" className="bg-terracotta h-2.5 w-2.5 rounded-full" />
            <span className="text-[20px] font-semibold">Axion-IA</span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-xl px-5 pt-8 pb-16">{children}</main>
      </body>
    </html>
  );
}
