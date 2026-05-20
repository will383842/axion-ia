// Helpers partagés pour les sitemaps images des villes françaises.
// Utilisé par les 3 Route Handlers :
//   - sitemap-images-villes-t1.xml (pop >= 100 000)
//   - sitemap-images-villes-t2.xml (50 000 – 99 999)
//   - sitemap-images-villes-t3-t4.xml (5 000 – 49 999)
//
// Spec Google Image Sitemap 1.1 + recommandation image:geo_location pour
// Google Images domination locale (audit image-bank-complet 2026-05-20).

import type { VilleData } from "@/content/villes/data/types";
import { escapeXml } from "./xml";

export const VILLES_LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/";
export const SITE_BASE = "https://axion-ia.com";

// Slug image générique par tier (images existantes dans public/images/)
export const GENERIC_SLUG_T3 =
  "axion-ia-formation-acculturation-ia-tpe-pme-eti-2026-photo-banniere";
export const GENERIC_SLUG_T4 =
  "axion-ia-formation-ia-comprendre-creer-transformer-humaine-augmentee-banniere";

export const REGION_LABELS: Readonly<Record<string, string>> = {
  "ile-de-france": "Île-de-France",
  "auvergne-rhone-alpes": "Auvergne-Rhône-Alpes",
  "provence-alpes-cote-d-azur": "Provence-Alpes-Côte d'Azur",
  occitanie: "Occitanie",
  "nouvelle-aquitaine": "Nouvelle-Aquitaine",
  "hauts-de-france": "Hauts-de-France",
  "grand-est": "Grand Est",
  "pays-de-la-loire": "Pays de la Loire",
  bretagne: "Bretagne",
  normandie: "Normandie",
  "bourgogne-franche-comte": "Bourgogne-Franche-Comté",
  "centre-val-de-loire": "Centre-Val de Loire",
  corse: "Corse",
};

/** Génère un bloc <url> Google Image Sitemap pour une ville. */
export function buildVilleUrlBlock(v: VilleData, imageSlug: string): string {
  const region = REGION_LABELS[v.region] ?? v.region;
  const dept = v.departementLabel ?? v.departement;
  const pageUrl = `${SITE_BASE}/fr/ia-${v.slug}`;
  const imgUrl = `${SITE_BASE}/images/${imageSlug}.webp`;
  const title = escapeXml(`Formation IA à ${v.nameFr} — Axion-IA`);
  const caption = escapeXml(
    `Axion-IA propose des formations IA, audits IA et accompagnement à ${v.nameFr} (${dept}), en ${region}. Cabinet conseil IA B2B spécialisé PME/ETI.`,
  );
  const geo = escapeXml(`${v.nameFr}, ${region}, France`);

  return `  <url>
    <loc>${pageUrl}</loc>
    <image:image>
      <image:loc>${imgUrl}</image:loc>
      <image:title>${title}</image:title>
      <image:caption>${caption}</image:caption>
      <image:geo_location>${geo}</image:geo_location>
      <image:license>${VILLES_LICENSE_URL}</image:license>
    </image:image>
  </url>`;
}

/** Groupe les villes par région (pour les commentaires de lisibilité dans le XML). */
export function groupByRegion(villes: ReadonlyArray<VilleData>): Map<string, VilleData[]> {
  const map = new Map<string, VilleData[]>();
  for (const v of villes) {
    if (!map.has(v.region)) map.set(v.region, []);
    map.get(v.region)!.push(v);
  }
  return map;
}

/** Construit le XML complet d'un sitemap images villes. */
export function buildVillesSitemapXml(
  villes: ReadonlyArray<VilleData>,
  getImageSlug: (v: VilleData) => string,
  comment: string,
): string {
  const byRegion = groupByRegion(villes);
  const urlBlocks: string[] = [];

  for (const [region, regionVilles] of byRegion) {
    const label = REGION_LABELS[region] ?? region;
    urlBlocks.push(`  <!-- === ${label.toUpperCase()} === -->`);
    for (const v of regionVilles) {
      urlBlocks.push(buildVilleUrlBlock(v, getImageSlug(v)));
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <!-- ${comment} — ${villes.length} URLs -->
  <!-- CC BY 4.0 — © 2026 Axion-IA OÜ -->
${urlBlocks.join("\n")}
</urlset>
`;
}
