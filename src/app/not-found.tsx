// Root-level 404 — used when the URL doesn't match any locale-prefixed route.
// Doctrine v3 légère : pas d'i18n (hors layout locale), texte FR inline,
// Fraunces + halo-warm pour cohérence visuelle avec le reste du site.
// EN désactivé (2026-05-16, cf. AGENTS.md) → on ne propose plus le lien /en
// ici (il aurait de toute façon redirigé 301 vers /fr via src/proxy.ts).

import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/lib/seo";
import { OG_IMAGE_LARGEUR, OG_IMAGE_HAUTEUR } from "@/lib/og-format";
// CSS pur : surtout pas globals.css (+260 Ko de Tailwind dans le flux de chaque page).
import "./erreur-racine.css";

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
    //
    // 🔑 Ce diagnostic était JUSTE, et il n'a été appliqué qu'ici. La fabrique
    // `buildProductMetadata`, qui sert les 1 666 autres pages, a continué à
    // annoncer 630 pendant trois mois — mesuré le 2026-08-17. Les valeurs
    // viennent maintenant de `@/lib/og-format`, partagé par tout le monde.
    images: [
      {
        url: `${PROD_ORIGIN}/opengraph-image`,
        width: OG_IMAGE_LARGEUR,
        height: OG_IMAGE_HAUTEUR,
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
      <body className="racine-corps">
        <div className="racine-bloc">
          <p className="racine-etiquette">
            <span aria-hidden="true" className="racine-puce" />
            404 · Page introuvable
          </p>
          <h1 className="racine-titre">
            Cette URL n&apos;
            <span className="racine-accent">existe pas</span>
          </h1>
          <p className="racine-texte">
            La page que vous cherchez n&apos;existe pas ou a été déplacée.
          </p>
          <div className="racine-actions">
            <Link href="/fr" className="racine-bouton">
              Retour à l&apos;accueil →
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
