// Root-level 404 — used when the URL doesn't match any locale-prefixed route.
// Doctrine v3 légère : pas d'i18n (hors layout locale), texte FR inline,
// Fraunces + halo-warm pour cohérence visuelle avec le reste du site.
// EN désactivé (2026-05-16, cf. AGENTS.md) → on ne propose plus le lien /en
// ici (il aurait de toute façon redirigé 301 vers /fr via src/proxy.ts).

import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/lib/seo";
import "./globals.css";

// metadataBase + og:image absolus explicites pour les 404 globales.
//
// Ce fichier est hors `[locale]/layout.tsx` donc n'hérite pas du `metadataBase`
// localisé. Audit 2026-05-15 (AGENT 2) a observé `og:image=http://localhost:3000/...`
// servi en prod sur les 404 malgré le `metadataBase: new URL(SITE_URL)` ci-dessous,
// vraisemblablement parce que le SSG du root not-found.tsx résout `SITE_URL`
// avant que le filet de sécurité prod (`seo.ts` §20-23) ne soit déclenché.
//
// Fix : hardcoder les og/twitter images en URLs absolues `https://axion-ia.com`
// pour ce fichier précis. SITE_URL reste utilisé pour `metadataBase` afin de
// préserver la résolution canonique relative ailleurs si besoin.
const PROD_ORIGIN = "https://axion-ia.com" as const;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL.startsWith("http://localhost") ? PROD_ORIGIN : SITE_URL),
  robots: { index: false, follow: false },
  openGraph: {
    // Audit GSC 2026-05-18 — cohérence dimensions avec `src/app/opengraph-image.tsx`
    // qui génère 1200×675 (Google Discover hard floor, vs 1200×630 standard OG).
    // Sans alignement, l'OG meta annonce 630 mais l'image réelle servie est 675.
    images: [
      {
        url: `${PROD_ORIGIN}/opengraph-image`,
        width: 1200,
        height: 675,
        alt: "Axion-IA — Cabinet IA opérationnel B2B",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: [`${PROD_ORIGIN}/opengraph-image`],
  },
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
            404 · Page introuvable
          </p>
          <h1
            className="text-fg mt-5 text-[clamp(2.5rem,6vw,4rem)] leading-[1.04] font-medium tracking-tight"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Cette URL n&apos;
            <span className="text-terracotta italic">existe pas</span>
          </h1>
          <p className="text-fg-soft mx-auto mt-5 max-w-md text-base leading-relaxed">
            La page que vous cherchez n&apos;existe pas ou a été déplacée.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/fr"
              className="bg-primary text-primary-fg cta-lift hover:bg-primary-hover inline-flex items-center gap-2 rounded-full px-6 py-3 text-base font-semibold"
            >
              Retour à l&apos;accueil →
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
