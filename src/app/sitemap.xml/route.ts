// Sitemap-index racine — listing de tous les sub-sitemaps émis via
// `generateSitemaps()` dans `app/sitemap.ts`.
//
// Pourquoi ce fichier existe :
//   Next 16 ne génère PAS automatiquement `/sitemap.xml` quand
//   `generateSitemaps()` est défini. Chaque sub-sitemap est servi à
//   `/sitemap/<id>.xml` mais l'index racine doit être créé manuellement.
//   Sans cet index, Googlebot demande `/sitemap.xml` (référencé dans
//   `robots.txt`) et reçoit un 404 — les ~17 500 routes SSG (villes
//   + services × villes + blog + cas concrets + comparaisons) ne sont
//   jamais découvertes.
//
// Cet endpoint construit le XML <sitemapindex> en réutilisant la même
// fonction `generateSitemaps()` que `app/sitemap.ts`, garantissant que
// l'index reste synchronisé avec les sub-sitemaps réellement émis.

import { generateSitemaps } from "../sitemap";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-static";
export const revalidate = 3600;

export async function GET(): Promise<Response> {
  const sitemaps = await generateSitemaps();
  const lastmod = new Date().toISOString();

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps
  .map(
    ({ id }) => `  <sitemap>
    <loc>${SITE_URL}/sitemap/${id}.xml</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>`,
  )
  .join("\n")}
</sitemapindex>
`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
