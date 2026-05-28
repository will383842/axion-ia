// Route Handler — Sitemap Google Image 1.1 — Villes Tier 2 (50 000 – 99 999 hab).
//
// 83 villes avec image générique auto-générée par Sharp (template terracotta
// + overlay nom de la ville — cf. script generate-city-images-tier2.ts).
//
// Image slug pattern T2 : axion-ia-{ville.slug}-formation-ia-banniere
// (même pattern que T1, images générées via Sharp template)
//
// Référencé dans `app/sitemap-index.xml/route.ts` (CUSTOM_SITEMAPS).

import { VILLES, isVilleIndexable } from "@/content/villes";
import { SITEMAP_CACHE_HEADER } from "@/server/image-bank/constants";
import { buildVillesSitemapXml } from "@/server/image-bank/utils/villes-sitemap";

// Drip-aware sitemap (Will 2026-05-28 — audit GSC `_AUDIT/GSC-INDEXATION-2026-05-28`).
// Filtre sur la cohorte drip + présence copy. Les ~83 villes T2 sont toutes
// premium (pop ≥ 20k) donc toutes émises au jour 0.
export const dynamic = "force-dynamic";
export const revalidate = 86400;

export function GET(): Response {
  const t2 = [...VILLES]
    .filter(
      (v) =>
        v.population >= 50_000 && v.population < 100_000 && !!v.copy && isVilleIndexable(v.slug),
    )
    .sort((a, b) => b.population - a.population);

  const body = buildVillesSitemapXml(
    t2,
    (v) => `axion-ia-${v.slug}-formation-ia-banniere`,
    "Tier 2 — population 50 000–99 999 — template Sharp auto",
  );

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": SITEMAP_CACHE_HEADER,
    },
  });
}
