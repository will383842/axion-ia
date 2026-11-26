// Sitemap dédié au module recrutement commercial (devenir-commercial-ia).
// Route Handler XML brut isolé — ne touche PAS au sitemap.ts principal.
// Référencé dans `sitemap-index.xml` (CUSTOM_SITEMAPS).
//
// N'émet QUE la page France + la candidature : les 40 pages ville ont été
// retirées, redirigées vers la page France par `proxy.ts` (offre commune
// ≈ 89 % de contenu identique → doorway). Il n'y a plus de visibilité PAR
// VILLE : l'offre d'emploi schema.org multi-lieux qui la portait a été retirée
// le 2026-09-19 (décision Will B5). B5 est levée le 25/11/2026 pour la SEULE page
// principale (un JobPosting prudent, mono-lieu, à distance) ; /memo-isere reste exclue.
//
// FR canonique uniquement (EN désactivé 2026-05-16 → 301, hors crawl budget).

import {
  APPORTEUR_JOB_POSTING_DATE_POSTED,
  COMMERCIAL_OFFER_DATE_POSTED,
} from "@/content/recrutement/dates";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-static";
export const revalidate = 86400;

export async function GET(): Promise<Response> {
  // lastmod = date de référence de la page France (`dates.ts`) — une date
  // stable, et surtout pas BUILD_TIME, qui avançait à chaque deploy sans
  // changement de la page.
  // Le hub porte aussi le JobPosting : sa date la plus récente des deux.
  const lmHub =
    APPORTEUR_JOB_POSTING_DATE_POSTED > COMMERCIAL_OFFER_DATE_POSTED
      ? APPORTEUR_JOB_POSTING_DATE_POSTED
      : COMMERCIAL_OFFER_DATE_POSTED;
  const lm = COMMERCIAL_OFFER_DATE_POSTED;
  const entries: Array<{ path: string; priority: string; freq: string; lastmod: string }> = [
    { path: "/devenir-commercial-ia", priority: "0.9", freq: "weekly", lastmod: lmHub },
    { path: "/devenir-commercial-ia/candidature", priority: "0.7", freq: "monthly", lastmod: lm },
    // Landing presse « Le Mémo de l'Isère » (2026-08-12), refondue le 2026-11-09.
    { path: "/memo-isere", priority: "0.9", freq: "weekly", lastmod: lm },
    // `/apporteur-affaires-independant-formation-ia-entreprise` n'y figure plus : depuis le
    // 2026-11-09 elle affiche la même offre que la page principale, en `noindex, follow`.
  ];

  const urls = entries
    .map((e) => {
      const loc = `${SITE_URL}/fr${e.path}`;
      return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n    <changefreq>${e.freq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`;
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
