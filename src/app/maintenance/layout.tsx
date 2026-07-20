// Co-located layout for /maintenance route — out of [locale]/.
//
// Required by Next.js App Router (webpack strict mode) : every page must
// have a Layout in its ancestry chain. Since /maintenance is at the same
// level as /[locale]/, the [locale]/layout.tsx doesn't apply, and there's
// no root src/app/layout.tsx (root pages provide their own html/body via
// global-error.tsx pattern).
//
// This layout provides the minimum html/body wrapper + globals.css import
// so the maintenance page renders standalone.

import type { Metadata } from "next";
import { SITE_URL } from "@/lib/seo";
import "../globals.css";

// `metadataBase` explicite — même raison que `src/app/not-found.tsx` (cf. le
// commentaire détaillé là-bas). Ce fichier est hors `[locale]/layout.tsx`, donc
// il n'hérite pas de son `metadataBase`. Or `src/app/opengraph-image.tsx` est une
// convention de fichier au niveau racine : Next injecte automatiquement son
// `openGraph.images` dans TOUTES les routes descendantes, y compris celle-ci.
// Sans `metadataBase`, Next doit résoudre cette image et retombe sur
// `http://localhost:3000` en émettant au boot :
//   ⚠ metadataBase property in metadata export is not set […] using "http://localhost:3000"
//
// Même garde localhost que `not-found.tsx` : au SSG, `SITE_URL` peut être résolu
// avant le filet de sécurité prod de `seo.ts` (§20-23).
const PROD_ORIGIN = "https://axion-ia.com" as const;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL.startsWith("http://localhost") ? PROD_ORIGIN : SITE_URL),
  title: "Maintenance — Axion-IA",
  description: "Site temporairement indisponible pour maintenance planifiée.",
  robots: { index: false, follow: false },
};

export default function MaintenanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
