// Route Handler — Sitemap Google Image 1.1 — Villes Tier 1 (pop >= 100 000).
//
// 40 villes avec images dédiées (Paris + Lyon existantes, 38 restantes à importer).
// Image slug pattern T1 : axion-ia-{ville.slug}-formation-ia-banniere
// Une image par ville (bannière 1920×1080 + carré 1200×1200 V1.5+).
//
// Référencé dans `app/sitemap-index.xml/route.ts` (CUSTOM_SITEMAPS).

import { VILLES, isVilleIndexable } from "@/content/villes";
import { SITEMAP_CACHE_HEADER } from "@/server/image-bank/constants";
import { buildVillesSitemapXml } from "@/server/image-bank/utils/villes-sitemap";

// Drip-aware sitemap (Will 2026-05-28 — audit GSC `_AUDIT/GSC-INDEXATION-2026-05-28`).
// Filtre sur la cohorte drip pour rester cohérent avec sitemap-villes-* +
// `<meta robots>` côté page. Au jour 0, les ~40 villes T1 sont toutes
// premium (pop ≥ 20k) donc toutes émises. La nuance compte si le drip
// commence un jour à exclure du premium (ex: VILLES_PER_DAY < 0 pour pause).
export const dynamic = "force-dynamic";
export const revalidate = 86400;

export function GET(): Response {
  const t1 = [...VILLES]
    .filter((v) => v.population >= 100_000 && !!v.copy && isVilleIndexable(v.slug))
    .sort((a, b) => b.population - a.population);

  const body = buildVillesSitemapXml(
    t1,
    (v) => `axion-ia-${v.slug}-formation-ia-banniere`,
    "Tier 1 — population ≥ 100 000 — images dédiées",
  );

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": SITEMAP_CACHE_HEADER,
    },
  });
}
