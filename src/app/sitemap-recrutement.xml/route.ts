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

import { COMMERCIAL_OFFER_DATE_POSTED } from "@/content/recrutement/dates";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-static";
export const revalidate = 86400;

export async function GET(): Promise<Response> {
  // lastmod = date de (re)publication de l'offre commerciale — suit la même
  // constante que le JobPosting de la page (pas BUILD_TIME, qui avançait à
  // chaque deploy sans changement de l'offre).
  const lm = COMMERCIAL_OFFER_DATE_POSTED;
  const entries: Array<{ path: string; priority: string; freq: string }> = [
    { path: "/devenir-commercial-ia", priority: "0.9", freq: "weekly" },
    { path: "/devenir-commercial-ia/candidature", priority: "0.7", freq: "monthly" },
    // Landing presse « Le Mémo de l'Isère » — recrutement Sud-Grésivaudan (2026-08-12).
    { path: "/memo-isere", priority: "0.9", freq: "weekly" },
    // Page SEO de l'annonce jemepropose.com (2026-08-23). INDEXABLE — contrairement
    // aux landings `/partenaire/*`, elle vise un cluster de requêtes distinct
    // (« apporteur d'affaires indépendant ») là où `/devenir-commercial-ia` vise
    // « devenir commercial IA ». Deux intentions, deux vocabulaires.
    {
      path: "/apporteur-affaires-independant-formation-ia-entreprise",
      priority: "0.8",
      freq: "weekly",
    },
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
