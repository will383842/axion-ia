// Route Handler — Sitemap Google Image 1.1 — Villes Tier 2 (50 000 – 99 999 hab).
//
// Audit images 2026-06-20 — FIX 404 : le pattern
// `axion-ia-{ville.slug}-formation-ia-banniere` ne correspondait à aucun fichier
// (les images Sharp par-ville n'ont jamais été générées sur disque). → toutes les
// `<image:loc>` T2 étaient en 404. On pointe une bannière générique RÉELLE (comme
// T3/T4), garantissant du 200.
//
// Référencé dans `app/sitemap-index.xml/route.ts` (CUSTOM_SITEMAPS).

import { VILLES, isVilleIndexable } from "@/content/villes";
import { SITEMAP_CACHE_HEADER } from "@/server/image-bank/constants";
import { buildVillesSitemapXml, GENERIC_SLUG_T3 } from "@/server/image-bank/utils/villes-sitemap";

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
    () => GENERIC_SLUG_T3,
    "Tier 2 — population 50 000–99 999 — bannière générique (fichier réel)",
  );

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": SITEMAP_CACHE_HEADER,
    },
  });
}
