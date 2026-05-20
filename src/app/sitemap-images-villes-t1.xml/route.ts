// Route Handler — Sitemap Google Image 1.1 — Villes Tier 1 (pop >= 100 000).
//
// 40 villes avec images dédiées générées par DALL-E (Paris + Lyon existantes,
// 38 restantes à générer — prompts dans _AUDIT/image-bank-complet-2026/07).
//
// Image slug pattern T1 : axion-ia-{ville.slug}-formation-ia-banniere
// Une image par ville (bannière 1920×1080 + carré 1200×1200 V1.5+).
//
// Référencé dans `app/sitemap-index.xml/route.ts` (CUSTOM_SITEMAPS).

import { VILLES } from "@/content/villes";
import { SITEMAP_CACHE_HEADER } from "@/server/image-bank/constants";
import { buildVillesSitemapXml } from "@/server/image-bank/utils/villes-sitemap";

export const dynamic = "force-static";

export function GET(): Response {
  const t1 = [...VILLES]
    .filter((v) => v.population >= 100_000)
    .sort((a, b) => b.population - a.population);

  const body = buildVillesSitemapXml(
    t1,
    (v) => `axion-ia-${v.slug}-formation-ia-banniere`,
    "Tier 1 — population ≥ 100 000 — images DALL-E dédiées",
  );

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": SITEMAP_CACHE_HEADER,
    },
  });
}
