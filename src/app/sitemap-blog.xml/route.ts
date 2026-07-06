// Sub-sitemap blog DB-aware — Route Handler XML brut, calculé AU RUNTIME.
//
// Pourquoi un Route Handler dédié et PAS la convention metadata
// `app/sitemap.ts` (`generateSitemaps()`) :
//   Le 2026-07-03 (audit blog), `BLOG_POSTS` a été vidé (`= []` dans
//   `src/content/blog/index.ts` — tout le blog est piloté par la DB). Le
//   sous-sitemap `blog` est alors devenu 100 % DB-dépendant (articles
//   `tier_1_indexable` + catégories content-gen), plus AUCUNE source FS.
//   Or il restait émis via la convention metadata `generateSitemaps()`, qui
//   est PRÉ-RENDUE au build avec `revalidate=86400`. Au build GH Actions
//   (`DATABASE_URL=...stub.invalid`, ADR 0026), la DB renvoie `[]` → le fichier
//   `/sitemap/blog.xml` était BAKÉ VIDE dans l'image Docker et resservi jusqu'à
//   ~24h (première revalidation ISR) après chaque deploy. Comme les deploys sont
//   plus fréquents que 24h, la fenêtre se réinitialisait → le sitemap restait
//   vide quasi en permanence. Google Search Console flagge un `<urlset>` sans
//   `<url>` (« Balise XML manquante : url » → sitemap en erreur, 0 page découverte).
//
//   Ce Route Handler contourne le problème EXACTEMENT comme `sitemap-knowledge.xml`,
//   `sitemap-news.xml` et `sitemap-carrieres.xml` : il lit la DB AU RUNTIME
//   (`force-dynamic`, vraie `DATABASE_URL` injectée par Coolify) → il reflète
//   TOUJOURS la DB live (jamais vide tant qu'il y a ≥ 1 article tier-1). Le cache
//   CDN (`s-maxage=600`) absorbe la charge des crawls. Au build, la route
//   dynamique n'est même pas pré-rendue (pas de stub baké vide).
//
//   ZÉRO duplication de logique : on réutilise le builder existant via le default
//   export de `app/sitemap.ts` (`sitemap({ id: "blog" })`), qui porte déjà toute
//   la logique (articles DB tier-1, catégories content-gen, taxonomies, hreflang,
//   filtrage EN). On ne fait ici QUE sérialiser le `MetadataRoute.Sitemap` en XML.
//
// Référencé manuellement dans `app/sitemap-index.xml/route.ts` (CUSTOM_SITEMAPS),
// gaté anti-vide (listé uniquement s'il émet ≥ 1 URL) — cohérence index↔route
// garantie car les deux appellent le MÊME builder.

import sitemap from "@/app/sitemap";

// Rendu DYNAMIQUE au runtime (cf. en-tête). Volontairement PAS `force-static` :
// la version pré-rendue au build stub.invalid serait vide (bug d'origine).
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

function lastmodIso(lastModified: unknown): string {
  if (lastModified instanceof Date) return lastModified.toISOString();
  if (typeof lastModified === "string") return lastModified;
  return new Date(0).toISOString();
}

export async function GET(): Promise<Response> {
  // Réutilise le builder blog existant (default export metadata sitemap). Le
  // filtrage EN (`filterEnIfDisabled`) et les alternates hreflang sont déjà
  // appliqués côté builder → on sérialise tel quel.
  const entries = await sitemap({ id: Promise.resolve("blog") });

  const urlBlocks: string[] = [];
  for (const e of entries) {
    const loc = escapeXml(e.url);
    const lastmod = lastmodIso(e.lastModified);
    const changefreq = e.changeFrequency ?? "monthly";
    const priority = typeof e.priority === "number" ? e.priority.toFixed(1) : "0.5";

    const langs = e.alternates?.languages ?? {};
    const alternateLinks = Object.entries(langs)
      .filter(([, href]) => typeof href === "string" && href.length > 0)
      .map(
        ([hreflang, href]) =>
          `    <xhtml:link rel="alternate" hreflang="${escapeXml(hreflang)}" href="${escapeXml(
            href as string,
          )}" />`,
      )
      .join("\n");

    urlBlocks.push(
      `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>${alternateLinks ? `\n${alternateLinks}` : ""}
  </url>`,
    );
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
