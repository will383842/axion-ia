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

import { VILLES } from "@/content/villes";
import { SITEMAP_CACHE_HEADER } from "@/server/image-bank/constants";
import {
  buildVillesSitemapXml,
  GENERIC_SLUG_T3,
  GENERIC_SLUG_T4,
} from "@/server/image-bank/utils/villes-sitemap";

export const dynamic = "force-static";

export function GET(): Response {
  const t3t4 = [...VILLES]
    .filter((v) => v.population >= 5_000 && v.population < 50_000)
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
