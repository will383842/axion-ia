// Sitemap dédié aux vidéos du studio (/fr/videos). DB-driven, motif de `sitemap-avis.xml` :
// `force-dynamic` (la base factice du build y figerait 0 vidéo) ; 404 tant que l'interrupteur
// est éteint ou qu'aucune vidéo n'est publiée (la lecture rend alors une liste vide) ;
// listé dans `sitemap-index.xml` sous la même condition.
//
// À soumettre UNE fois dans la Search Console, le jour de la première vidéo publiée (avant,
// la route rend 404 : la soumettre plus tôt créerait une erreur).

import { SITE_URL } from "@/lib/seo";
import { videosPubliees } from "@/server/videos/lecture";
import { construireSitemapVideos } from "@/server/videos/sitemap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const xml = construireSitemapVideos(await videosPubliees(), SITE_URL);
  if (xml === null) return new Response("Not found", { status: 404 });
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
