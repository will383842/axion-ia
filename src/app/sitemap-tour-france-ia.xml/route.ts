// Sitemap de la landing du Tour France IA (2026-10-25).
//
// Tour ouvert (`TOUR_PUBLIC = true`) : l'URL de la landing y figure et
// `sitemap-index.xml` le liste. Si le Tour est refermé : `<urlset>` VIDE, et
// l'index ne le liste plus (un urlset vide listé serait signalé par la Search
// Console) — rien d'autre à toucher.
//
// La route est sous `sitemap…` : le `matcher` du proxy l'exclut déjà.

import { TOUR_PREFIX, TOUR_PUBLIC } from "@/features/tour-de-france/visibilite";
import { SITE_URL } from "@/lib/site-url";

export const dynamic = "force-static";

export function GET(): Response {
  const urls = TOUR_PUBLIC
    ? `  <url>\n    <loc>${SITE_URL}${TOUR_PREFIX}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`
    : "";
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}</urlset>
`;
  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=600, stale-while-revalidate=3600",
    },
  });
}
