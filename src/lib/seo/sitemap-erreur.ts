/**
 * Erreur « la base est injoignable » levée par les sitemaps DB-aware en mode
 * strict (lot 9 audit blog 2026-10-24).
 *
 * Pourquoi : quand la lecture des articles échoue, le builder retombait sur une
 * liste vide, et le Route Handler répondait 200 avec un plan sans articles, mis
 * en cache 10 min par le CDN. Google lit alors « le blog a disparu ». Avec cette
 * erreur, la route répond 503 + Retry-After, que Google traite comme un incident
 * temporaire et ne retient pas.
 *
 * Module volontairement minuscule et sans import : il est partagé par
 * `app/sitemap.ts`, `server/exporters/knowledge-sitemap.ts` et les routes.
 */
export class SitemapDbIndisponibleError extends Error {
  constructor(source: string) {
    super(`[sitemap] base indisponible pour « ${source} »`);
    this.name = "SitemapDbIndisponibleError";
  }
}

/** Corps XML valide mais vide : accompagne la réponse 503 (jamais mis en cache). */
export function reponseSitemap503(): Response {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n`,
    {
      status: 503,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Retry-After": "300",
        "Cache-Control": "no-store",
      },
    },
  );
}
