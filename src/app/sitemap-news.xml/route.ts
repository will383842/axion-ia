// Sitemap Google News dédié — Route Handler XML brut conforme spec
// https://developers.google.com/search/docs/crawling-indexing/sitemaps/news-sitemap
//
// Pourquoi un Route Handler custom et pas `app/sitemap.ts` (`generateSitemaps`) :
//   La convention Next 16 metadata `MetadataRoute.Sitemap` produit du XML
//   sitemap classique (`xmlns:sitemap`) et ne supporte PAS le namespace
//   `xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"` requis
//   par Google News. Sans ce namespace + les balises `<news:news>`,
//   Google News refuse purement et simplement le sitemap (le sitemap
//   reste valide pour Google Search mais News ne crawle pas).
//
// Spec Google News (résumé) :
//   - Fenêtre stricte 48h (publications plus anciennes = retirer du sitemap)
//   - Max 1 000 URLs par sitemap (cap hard Google News, pas 50 000)
//   - 1 entry = 1 `<url>` avec `<news:news>` enfant
//   - `<news:publication><news:name>` + `<news:language>` obligatoires
//   - `<news:publication_date>` ISO 8601 obligatoire
//   - `<news:title>` obligatoire (texte brut, échappé XML)
//   - `<news:keywords>` / `<news:genres>` optionnels
//
// Fail-soft : si table `articles` absente (P2021 bootstrap pré-migration)
// ou aucune actualité récente → XML vide valide (sitemapindex ignore proprement).
//
// Cache : 5 min `max-age` + 10 min `stale-while-revalidate` — bon compromis
// freshness Google News (qui re-crawle souvent) vs. charge DB. Le sitemap
// regen automatiquement quand on dépublie/publie une actu (fenêtre 48h
// glissante).

import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/seo";

// Cap dur imposé par Google News (pas par sitemaps.org 50K)
const NEWS_SITEMAP_MAX_URLS = 1000;
// Fenêtre stricte Google News (publications > 48h = retirer)
const NEWS_FRESHNESS_WINDOW_MS = 48 * 60 * 60 * 1000;

// Force dynamic — la fenêtre 48h glissante exige une éval à chaque request
// (revalidate=300s en cache CDN derrière Cloudflare).
export const dynamic = "force-dynamic";
export const revalidate = 300;

/**
 * Échappe les caractères XML spéciaux dans un titre / nom de publication.
 * Évite l'injection et les XML parsing errors côté Google.
 */
function escapeXml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

interface NewsRow {
  publishedAt: Date | null;
  translations: Array<{ slug: string; title: string }>;
}

async function fetchRecentNewsRows(): Promise<NewsRow[]> {
  const cutoff = new Date(Date.now() - NEWS_FRESHNESS_WINDOW_MS);
  try {
    return await prisma.article.findMany({
      where: {
        status: "published",
        isNews: true,
        indexationTier: "tier_1_indexable",
        publishedAt: { gte: cutoff },
      },
      orderBy: { publishedAt: "desc" },
      take: NEWS_SITEMAP_MAX_URLS,
      select: {
        publishedAt: true,
        translations: {
          where: { locale: "fr" },
          select: { slug: true, title: true },
          take: 1,
        },
      },
    });
  } catch {
    // P2021 (table absente bootstrap) — fail-soft XML vide
    return [];
  }
}

export async function GET(): Promise<Response> {
  const rows = await fetchRecentNewsRows();

  const urlBlocks: string[] = [];
  for (const row of rows) {
    const t = row.translations[0];
    if (!t || !t.slug) continue;
    if (!row.publishedAt) continue;

    const loc = `${SITE_URL}/fr/actualites/${t.slug}`;
    const pubDate = row.publishedAt.toISOString();
    const title = escapeXml(t.title);

    urlBlocks.push(
      `  <url>
    <loc>${loc}</loc>
    <news:news>
      <news:publication>
        <news:name>Axion-IA</news:name>
        <news:language>fr</news:language>
      </news:publication>
      <news:publication_date>${pubDate}</news:publication_date>
      <news:title>${title}</news:title>
    </news:news>
  </url>`,
    );
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urlBlocks.join("\n")}
</urlset>
`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
    },
  });
}
