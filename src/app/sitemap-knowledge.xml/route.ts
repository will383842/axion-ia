// Sub-sitemap KB DB-aware — Route Handler XML brut, calculé AU RUNTIME.
//
// Pourquoi un Route Handler dédié et PAS la convention metadata
// `app/sitemap.ts` (`generateSitemaps()`) :
//   Le nombre de chunks `knowledge-*` était auparavant dérivé au BUILD via
//   `countKnowledgePublicEntries()` (cf. `app/sitemap.ts`). Or depuis
//   l'externalisation du build (ADR 0026, 2026-05-16), le build GH Actions
//   tourne avec `DATABASE_URL=...stub.invalid` → ce compte retourne TOUJOURS 0
//   → `generateSitemaps()` ne déclare JAMAIS d'ID `knowledge-N` → la route
//   metadata `/sitemap/knowledge-N.xml` n'est pas un param valide → 404.
//   Résultat : tout le contenu KB public devenait indécouvrable via sitemap
//   (et Google gardait en mémoire des `knowledge-1/2.xml` fantômes en 404).
//
//   Ce Route Handler contourne le problème : comme `sitemap-news.xml`,
//   `sitemaps/images-{fr,en}.xml` et `sitemap-carrieres.xml`, il lit la DB
//   AU RUNTIME (ISR `revalidate=3600`, vraie `DATABASE_URL` injectée par
//   Coolify). Au build (stub), `listKnowledgeSitemapEntries()` court-circuite
//   sur `[]` → sitemap vide valide, repeuplé sous 1h par l'ISR.
//
// Référencé manuellement dans `app/sitemap-index.xml/route.ts` (CUSTOM_SITEMAPS).
//
// Cap : un sitemap unique (pas de chunking) suffit tant que le volume KB public
// reste < cap qualité. Si le volume explose (> KB_SITEMAP_MAX_URLS), on tronque
// + warn (à ce moment-là, refactorer en chunks paginés `/sitemap-knowledge-N.xml`).
// Le cap dur sitemaps.org (50 000 URLs) reste très au-dessus.

import { listKnowledgeSitemapEntries } from "@/server/exporters/knowledge-sitemap";
import { buildExcludeSlugsByType } from "@/app/sitemap";

// EN désactivé (AGENTS.md §EN locale désactivé 2026-05-16) → on n'émet ni les
// `<url>` EN (qui seraient 301→FR) ni les `hreflang="en"` (qui pointeraient vers
// un 301). Symétrique de `filterEnIfDisabled()` dans `app/sitemap.ts`.
const EN_LOCALE_ENABLED = process.env["EN_LOCALE_ENABLED"] === "true";

// Best-practice qualité Search Console : on reste bien sous le cap dur (50 000).
// Si dépassé, on tronque déterministiquement (entrées triées par fraîcheur via
// `listKnowledgeSitemapEntries`) + warn pour signaler le besoin de chunking.
const KB_SITEMAP_MAX_URLS = 45000;

// Rendu DYNAMIQUE au runtime (vraie DB à CHAQUE requête, comme `sitemap-news.xml`).
// Volontairement PAS `force-static` : sous le build stub.invalid (ADR 0026) la
// version pré-rendue serait VIDE, et resterait servie ~1h (jusqu'à la 1re
// revalidation ISR) après chaque deploy. Or un `<urlset>` sans `<url>` est flaggé
// par Google Search Console (« Balise XML manquante : url » → sitemap en erreur).
// En `force-dynamic` le sitemap reflète TOUJOURS la DB live (jamais vide tant qu'il
// y a du KB public) ; le cache CDN (Cache-Control s-maxage=600) absorbe la charge
// des crawls. Au build, la route dynamique n'est même pas pré-rendue (pas de stub).
export const dynamic = "force-dynamic";
export const revalidate = 600;

function escapeXml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(): Promise<Response> {
  // Dédup vs les builders TS (blog tier-1, case studies, help, faq) — mêmes slugs
  // déjà émis dans pages/blog/faq/help → on ne les ré-émet pas ici (anti-doublon
  // sitemap-index). SSOT = `buildExcludeSlugsByType()` (exporté depuis sitemap.ts).
  const entries = await listKnowledgeSitemapEntries(buildExcludeSlugsByType());

  const capped = entries.slice(0, KB_SITEMAP_MAX_URLS);
  if (entries.length > KB_SITEMAP_MAX_URLS) {
    console.warn(
      `[KB sitemap] ${entries.length} entries > cap ${KB_SITEMAP_MAX_URLS} — truncated. ` +
        `Refactor sitemap-knowledge.xml into paginated chunks.`,
    );
  }

  const urlBlocks: string[] = [];
  for (const e of capped) {
    const lastmod =
      e.lastModified instanceof Date ? e.lastModified.toISOString() : String(e.lastModified);
    const priority = e.status === "deprecated" ? "0.3" : "0.6";
    const frLoc = escapeXml(e.url);

    if (EN_LOCALE_ENABLED && e.urlEn !== e.url) {
      // FR + EN : paire complète avec hreflang fr/en/x-default.
      const enLoc = escapeXml(e.urlEn);
      const alternates =
        `    <xhtml:link rel="alternate" hreflang="fr" href="${frLoc}" />\n` +
        `    <xhtml:link rel="alternate" hreflang="en" href="${enLoc}" />\n` +
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${frLoc}" />`;
      for (const loc of [frLoc, enLoc]) {
        urlBlocks.push(
          `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${priority}</priority>
${alternates}
  </url>`,
        );
      }
    } else {
      // EN désactivé (ou pas de variante EN) : FR seul, hreflang fr + x-default.
      urlBlocks.push(
        `  <url>
    <loc>${frLoc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${priority}</priority>
    <xhtml:link rel="alternate" hreflang="fr" href="${frLoc}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${frLoc}" />
  </url>`,
      );
    }
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urlBlocks.join("\n")}
</urlset>
`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=600, stale-while-revalidate=3600",
    },
  });
}
