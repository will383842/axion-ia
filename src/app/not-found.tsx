// Root-level 404 — used when the URL doesn't match any locale-prefixed route.
// Doctrine v3 légère : pas d'i18n (hors layout locale), texte bilingue inline,
// Fraunces + halo-warm pour cohérence visuelle avec le reste du site.

import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/lib/seo";
import "./globals.css";

// metadataBase explicite : ce fichier est hors `[locale]/layout.tsx` donc
// n'hérite pas du `metadataBase` localisé. Sans ça, Next.js fallback sur
// `http://localhost:3000` côté og:image (résolu via `app/opengraph-image.tsx`),
// ce qui casse les previews sociales si quelqu'un partage une URL 404.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  robots: { index: false, follow: false },
};

export default function RootNotFound() {
  return (
    <html lang="fr">
      <body className="bg-halo-warm text-fg flex min-h-screen items-center justify-center p-8">
        <div className="max-w-xl text-center">
          <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
            <span
              aria-hidden="true"
              className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
            />
            404 · Page introuvable · Page not found
          </p>
          <h1
            className="text-fg mt-5 text-[clamp(2.5rem,6vw,4rem)] leading-[1.04] font-medium tracking-tight"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Cette URL n&apos;
            <span className="text-terracotta italic">existe pas</span>
          </h1>
          <p className="text-fg-soft mx-auto mt-5 max-w-md text-base leading-relaxed">
            Choisissez votre langue pour rejoindre l&apos;accueil.
            <br />
            Pick your language to reach the home page.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/fr"
              className="bg-primary text-primary-fg cta-lift hover:bg-primary-hover inline-flex items-center gap-2 rounded-full px-6 py-3 text-base font-semibold"
            >
              Français →
            </Link>
            <Link
              href="/en"
              className="border-border-strong text-fg bg-paper hover:border-fg cta-lift inline-flex items-center gap-2 rounded-full border px-6 py-3 text-base font-semibold"
            >
              English →
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
