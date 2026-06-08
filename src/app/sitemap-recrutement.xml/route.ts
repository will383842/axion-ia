// Sitemap dédié au module recrutement commercial (devenir-commercial-ia).
// Route Handler XML brut isolé — ne touche PAS au sitemap.ts principal.
// Référencé dans `sitemap-index.xml` (CUSTOM_SITEMAPS).
//
// N'émet QUE la page France + la candidature : les 40 pages ville sont en
// `noindex` (offre commune ≈ 89 % de contenu identique → doorway). La visibilité
// PAR VILLE passe par le JobPosting multi-lieux de la page France (Google for
// Jobs), pas par 40 URLs indexées.
//
// FR canonique uniquement (EN désactivé 2026-05-16 → 301, hors crawl budget).

import { SITE_URL, SITE_EDITORIAL_DATE } from "@/lib/seo";

export const dynamic = "force-static";
export const revalidate = 86400;

export async function GET(): Promise<Response> {
  // Audit fraîcheur 2026-06-08 : lastmod figé sur la date éditoriale (pas
  // BUILD_TIME, qui avançait à chaque deploy sans changement de l'offre).
  const lm = SITE_EDITORIAL_DATE;
  const entries: Array<{ path: string; priority: string; freq: string }> = [
    { path: "/devenir-commercial-ia", priority: "0.9", freq: "weekly" },
    { path: "/devenir-commercial-ia/candidature", priority: "0.7", freq: "monthly" },
  ];

  const urls = entries
    .map((e) => {
      const loc = `${SITE_URL}/fr${e.path}`;
      return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lm}</lastmod>\n    <changefreq>${e.freq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
