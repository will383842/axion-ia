// Sitemap-index racine — listing de tous les sub-sitemaps émis via
// `generateSitemaps()` dans `app/sitemap.ts`.
//
// Pourquoi ce fichier existe et pas `app/sitemap.xml/route.ts` :
//   Next 16 réserve le path `/sitemap.xml` à la convention metadata
//   `app/sitemap.ts` (`generateSitemaps()` génère `/sitemap/<id>.xml`).
//   Tenter un Route Handler à `app/sitemap.xml/route.ts` produit un
//   build error « Conflicting route and metadata at /sitemap.xml ».
//   Solution : exposer l'index racine à `/sitemap-index.xml` et
//   référencer ce path dans `robots.ts` (Sitemap directive).
//
//   Sans cet index, Googlebot ne découvre que le sub-sitemap pointé
//   par robots.txt — il ne saurait pas que les autres sub-sitemaps
//   `/sitemap/<id>.xml` existent. Avec cet index, un seul fetch
//   `Sitemap: /sitemap-index.xml` suffit pour découvrir les ~17 500
//   routes SSG (cities, services × cities, blog, case studies, etc.).
//
// Cet endpoint réutilise la même fonction `generateSitemaps()` que
// `app/sitemap.ts`, garantissant que l'index reste synchronisé avec
// les sub-sitemaps réellement émis.
//
// Sub-sitemaps custom (hors `generateSitemaps()`) — référencés manuellement :
//   - `/sitemap-news.xml` : Route Handler XML brut conforme Google News
//     (namespace `xmlns:news`, fenêtre 48h stricte, max 1000 URLs).
//     Ne peut PAS passer par `MetadataRoute.Sitemap` (pas de support
//     `xmlns:news`). Cf. `app/sitemap-news.xml/route.ts` + audit
//     Sitemap+IndexNow 2026-05-15 AGENT 4 §4.1.3 P0-3.

import { generateSitemaps } from "../sitemap";
import { SITE_URL } from "@/lib/seo";

// Sub-sitemaps custom (Route Handlers XML brut, hors `generateSitemaps()`).
// Référencés manuellement pour que Googlebot les découvre via l'index racine.
const CUSTOM_SITEMAPS: ReadonlyArray<string> = ["/sitemap-news.xml"];

export const dynamic = "force-static";
export const revalidate = 3600;

export async function GET(): Promise<Response> {
  const sitemaps = await generateSitemaps();
  const lastmod = new Date().toISOString();

  const generatedBlocks = sitemaps.map(
    ({ id }) => `  <sitemap>
    <loc>${SITE_URL}/sitemap/${id}.xml</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>`,
  );

  const customBlocks = CUSTOM_SITEMAPS.map(
    (path) => `  <sitemap>
    <loc>${SITE_URL}${path}</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>`,
  );

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...generatedBlocks, ...customBlocks].join("\n")}
</sitemapindex>
`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
