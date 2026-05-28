// Route Handler — Sitemap Google Image 1.1 — Villes Tier 3 & 4 (5 000 – 49 999 hab).
//
// T3 (20K–50K) : 332 villes — image générique PME/ETI
// T4 (5K–20K)  : 1702 villes — image générique humanisée
// Total        : 2034 URLs
//
// Les images T3/T4 pointent vers 2 images génériques existantes :
//   T3 : axion-ia-formation-acculturation-ia-tpe-pme-eti-2026-photo-banniere
//   T4 : axion-ia-formation-ia-comprendre-creer-transformer-humaine-augmentee-banniere
//
// Metadata (alt, caption, geo_location) uniques par ville grâce au nom et département.
//
// Référencé dans `app/sitemap-index.xml/route.ts` (CUSTOM_SITEMAPS).

import { VILLES, isVilleIndexable } from "@/content/villes";
import { SITEMAP_CACHE_HEADER } from "@/server/image-bank/constants";
import {
  buildVillesSitemapXml,
  GENERIC_SLUG_T3,
  GENERIC_SLUG_T4,
} from "@/server/image-bank/utils/villes-sitemap";

// Drip-aware sitemap (Will 2026-05-28 — audit GSC `_AUDIT/GSC-INDEXATION-2026-05-28`).
// Avant ce patch (`force-static` + zéro filtre) : 2034 URLs villes T3-T4 émises
// d'un coup à Google, annulant la stratégie drip et provoquant le saut
// 336→2953 « Détectée non indexée » en GSC le 2026-05-19 (domaine jeune, 0
// backlink, famine crawl budget). Désormais filtré sur :
//   - `v.copy` présent (anti-doorway HCU 2024)
//   - `isVilleIndexable(slug)` (cohorte drip du jour : premium au jour 0,
//     puis +50/jour → 100 % en ~34 jours)
// `force-dynamic` + `revalidate=86400` : le filtre date-aware suit
// automatiquement l'élargissement de la cohorte sans nouveau deploy.
export const dynamic = "force-dynamic";
export const revalidate = 86400;

export function GET(): Response {
  const t3t4 = [...VILLES]
    .filter(
      (v) => v.population >= 5_000 && v.population < 50_000 && !!v.copy && isVilleIndexable(v.slug),
    )
    .sort((a, b) => b.population - a.population);

  const body = buildVillesSitemapXml(
    t3t4,
    (v) => (v.population >= 20_000 ? GENERIC_SLUG_T3 : GENERIC_SLUG_T4),
    "Tier 3 (20K–50K) + Tier 4 (5K–20K) — images génériques",
  );

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": SITEMAP_CACHE_HEADER,
    },
  });
}
