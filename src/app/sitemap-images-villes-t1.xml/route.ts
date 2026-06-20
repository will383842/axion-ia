// Route Handler — Sitemap Google Image 1.1 — Villes Tier 1 (pop >= 100 000).
//
// Audit images 2026-06-20 — FIX 404 : l'ancien pattern
// `axion-ia-{ville.slug}-formation-ia-banniere` ne correspondait à AUCUN fichier
// sur disque (seules Paris/Lyon ont des bannières, sous des noms longs ≠ pattern).
// → les 40 `<image:loc>` T1 étaient toutes en 404 = signal négatif Google Images.
// On pointe désormais une bannière générique RÉELLE (comme T3/T4), garantissant
// du 200. (Optimisation future : mapper les ~10 villes à bannière dédiée via une
// table de lookup ; le 404 était bien pire que le partage d'un visuel générique.)
//
// Référencé dans `app/sitemap-index.xml/route.ts` (CUSTOM_SITEMAPS).

import { VILLES, isVilleIndexable } from "@/content/villes";
import { SITEMAP_CACHE_HEADER } from "@/server/image-bank/constants";
import { buildVillesSitemapXml, GENERIC_SLUG_T3 } from "@/server/image-bank/utils/villes-sitemap";

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
    () => GENERIC_SLUG_T3,
    "Tier 1 — population ≥ 100 000 — bannière générique (fichier réel)",
  );

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": SITEMAP_CACHE_HEADER,
    },
  });
}
