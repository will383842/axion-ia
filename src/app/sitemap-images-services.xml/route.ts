// Route Handler — Sitemap Google Image 1.1 pour les pages de services.
//
// Référence les images éditoriales/marketing RÉELLEMENT affichées sur chaque
// page de service, sur leur page hôte, pour la découverte Google Images + AEO.
//
// Spec : https://developers.google.com/search/docs/crawling-indexing/sitemaps/image-sitemaps
// Namespace image: xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
//
// ⚠️ SOURCE UNIQUE DE VÉRITÉ : `@/lib/seo/page-images` (`PAGE_IMAGES_MANIFEST`).
// Le MÊME manifeste alimente le rendu `<Image>` des pages et leur JSON-LD
// `ImageObject` (via `buildPageImageGraphJsonLd`). Ajouter/retirer une image se
// fait UNIQUEMENT dans le manifeste → les 3 consommateurs restent synchronisés.
//
// Historique : ce sitemap lisait un snapshot figé (`service-sitemap-data.ts`,
// 2026-05-20) qui décrivait l'ancienne architecture `-ia` du site + d'anciennes
// images → il servait à Google des URLs de pages mortes et laissait les vraies
// photos hors de toute couverture. Remplacé par la lecture du manifeste SSOT.
//
// Locale : FR uniquement (EN désactivé/301→FR depuis 2026-05-16). Les `<image:loc>`
// sont locale-agnostiques (même fichier statique).
//
// Référencé dans `app/sitemap-index.xml/route.ts` (CUSTOM_SITEMAPS).

import { SITE_URL } from "@/lib/seo";
import { escapeXml } from "@/server/image-bank/utils/xml";
import { PAGE_IMAGES_MANIFEST } from "@/lib/seo/page-images";
import { SITEMAP_CACHE_HEADER } from "@/server/image-bank/constants";

export const dynamic = "force-static";

// GEO-037 (audit GEO/AEO 2026-08-14) — cette licence n'est déclarée QUE sur les
// images dont Axion-IA détient les droits (`origin` absent ou `"own"` dans le
// manifeste). Les photos tierces curées localement (`origin: "unsplash"`) sont
// servies par notre domaine mais restent la propriété du photographe : leur
// déclarer une licence CC BY 4.0 reviendrait à accorder à des tiers un droit de
// réutilisation qu'on ne détient pas — et Google Images affiche le badge
// « Licensable » sur la foi de cette déclaration. Pour elles, la balise est
// simplement OMISE : l'image reste indexable, elle n'est juste pas licenciée.
const LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/";

export function GET(): Response {
  const urlBlocks: string[] = [];
  let totalImages = 0;

  for (const page of PAGE_IMAGES_MANIFEST) {
    if (page.images.length === 0) continue;
    const absPageUrl = `${SITE_URL}/fr${page.path === "/" ? "" : page.path}`;
    const imageBlocks = page.images.map((img) => {
      totalImages += 1;
      const licenceLigne =
        img.origin === "unsplash"
          ? ""
          : `
      <image:license>${LICENSE_URL}</image:license>`;
      return `    <image:image>
      <image:loc>${SITE_URL}${img.src}</image:loc>
      <image:title>${escapeXml(img.nameFr)}</image:title>
      <image:caption>${escapeXml(img.altFr)}</image:caption>${licenceLigne}
    </image:image>`;
    });

    urlBlocks.push(`  <url>\n    <loc>${absPageUrl}</loc>\n${imageBlocks.join("\n")}\n  </url>`);
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <!-- ${urlBlocks.length} pages de services — ${totalImages} images -->
  <!-- CC BY 4.0 — © 2026 Axion-IA — aiGenerated:true (AI Act art. 50) -->
  <!-- Les photos tierces (Unsplash) sont indexables mais NON licenciées : voir GEO-037 -->
${urlBlocks.join("\n")}
</urlset>
`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": SITEMAP_CACHE_HEADER,
    },
  });
}
