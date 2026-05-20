// Route Handler — Sitemap Google Image 1.1 pour les pages de services.
//
// Référencement des 73 images marketing Axion-IA (audit/formation/automatisation/
// 1-to-1/logos/propositions) sur leurs pages hôtes de service.
//
// Spec : https://developers.google.com/search/docs/crawling-indexing/sitemaps/image-sitemaps
// Namespace image: xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
//
// Données : `@/server/image-bank/data/service-sitemap-data` (auto-généré
// par scripts/extract-service-sitemap-data.ts depuis l'audit image-bank 2026-05-20).
// Pour ajouter/modifier des images : mettre à jour service-sitemap-data.ts
// OU re-lancer le script extract-service-sitemap-data.ts.
//
// Référencé dans `app/sitemap-index.xml/route.ts` (CUSTOM_SITEMAPS).

import { SITE_URL } from "@/lib/seo";
import { escapeXml } from "@/server/image-bank/utils/xml";
import { SERVICE_SITEMAP_PAGES } from "@/server/image-bank/data/service-sitemap-data";
import { SITEMAP_CACHE_HEADER } from "@/server/image-bank/constants";

export const dynamic = "force-static";

const LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/";

export function GET(): Response {
  const urlBlocks: string[] = [];

  for (const page of SERVICE_SITEMAP_PAGES) {
    const absPageUrl = `${SITE_URL}${page.pageUrl}`;
    const imageBlocks = page.images.map(
      (img) => `    <image:image>
      <image:loc>${img.loc}</image:loc>
      <image:title>${escapeXml(img.title)}</image:title>
      <image:caption>${escapeXml(img.caption)}</image:caption>
      <image:license>${LICENSE_URL}</image:license>
    </image:image>`,
    );

    urlBlocks.push(`  <url>\n    <loc>${absPageUrl}</loc>\n${imageBlocks.join("\n")}\n  </url>`);
  }

  const totalImages = SERVICE_SITEMAP_PAGES.reduce((s, p) => s + p.images.length, 0);
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <!-- ${SERVICE_SITEMAP_PAGES.length} pages de services — ${totalImages} images -->
  <!-- CC BY 4.0 — © 2026 Axion-IA OÜ — aiGenerated:true (AI Act art. 50) -->
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
