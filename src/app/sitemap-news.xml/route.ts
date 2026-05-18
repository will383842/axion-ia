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
// Sprint S+4-D 2026-05-18 (audit 19-TYPE-8-PRESSE P1-18) — sitemap-news fusionne
// désormais les Articles `isNews=true` (RSS pipeline) ET les `PRESS_RELEASES`
// (communiqués éditoriaux fixtures TS). Avant ce patch, les communiqués publiés
// dans la fenêtre 48h glissante n'apparaissaient PAS dans sitemap-news → Google
// News + Top Stories les ignoraient (perte signal lancement / annonce produit).
import { PRESS_RELEASES } from "@/content/press";

// Cap dur imposé par Google News (pas par sitemaps.org 50K) — cap GLOBAL
// (DB Article isNews + PRESS_RELEASES additionnés). Si l'un des deux flux
// suffit à atteindre 1000, l'autre est tronqué après merge & sort.
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

/**
 * Unified shape pour merge des 2 sources (DB Article isNews + PRESS_RELEASES
 * fixtures TS). Permet de trier par fraîcheur puis de tronquer au cap Google
 * News (1000 URLs) sans biaiser vers une source au détriment de l'autre.
 */
interface NewsEntry {
  /** URL canonique FR (Google News index seulement FR sur axion-ia.com). */
  readonly loc: string;
  /** ISO 8601 date publication (`publication_date` Google News). */
  readonly pubDate: string;
  /** Titre brut (sera XML-escapé au render). */
  readonly title: string;
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

/**
 * Sprint S+4-D 2026-05-18 (audit 19-TYPE-8-PRESSE P1-18) — extrait les
 * `PRESS_RELEASES` publiés dans la fenêtre 48h glissante. `publishedAt` est
 * `YYYY-MM-DD` (date au sens calendaire) → on l'élargit à minuit UTC pour
 * comparaison vs cutoff. Les communiqués éditoriaux Axion-IA sont émis
 * rarement (~1-2/mois) donc ce flux apporte 0-1 URL en moyenne.
 */
function getRecentPressReleases(): NewsEntry[] {
  const cutoff = Date.now() - NEWS_FRESHNESS_WINDOW_MS;
  const out: NewsEntry[] = [];
  for (const release of PRESS_RELEASES) {
    // `publishedAt` = `YYYY-MM-DD` → Date au début du jour UTC.
    const ts = Date.parse(`${release.publishedAt}T00:00:00.000Z`);
    if (!Number.isFinite(ts)) continue;
    if (ts < cutoff) continue;
    out.push({
      loc: `${SITE_URL}/fr/presse/${release.slug}`,
      pubDate: new Date(ts).toISOString(),
      title: release.fr.title,
    });
  }
  return out;
}

export async function GET(): Promise<Response> {
  const rows = await fetchRecentNewsRows();

  // Source 1 : DB Article isNews (pipeline RSS).
  const dbEntries: NewsEntry[] = [];
  for (const row of rows) {
    const t = row.translations[0];
    if (!t || !t.slug) continue;
    if (!row.publishedAt) continue;
    dbEntries.push({
      loc: `${SITE_URL}/fr/actualites/${t.slug}`,
      pubDate: row.publishedAt.toISOString(),
      title: t.title,
    });
  }

  // Source 2 : PRESS_RELEASES éditoriaux (Sprint S+4-D).
  const pressEntries = getRecentPressReleases();

  // Merge + sort desc par publication_date + tronque au cap Google News.
  // Tri stable (Array.prototype.sort en V8 est stable depuis Node 12) garantit
  // ordre déterministe entre deux items partageant la même date (rare).
  const merged: NewsEntry[] = [...dbEntries, ...pressEntries]
    .sort((a, b) => (a.pubDate < b.pubDate ? 1 : a.pubDate > b.pubDate ? -1 : 0))
    .slice(0, NEWS_SITEMAP_MAX_URLS);

  const urlBlocks: string[] = [];
  for (const entry of merged) {
    const title = escapeXml(entry.title);
    urlBlocks.push(
      `  <url>
    <loc>${entry.loc}</loc>
    <news:news>
      <news:publication>
        <news:name>Axion-IA</news:name>
        <news:language>fr</news:language>
      </news:publication>
      <news:publication_date>${entry.pubDate}</news:publication_date>
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
      "Cache-Control": "public, max-age=300, stale-while-revalidate=600, stale-if-error=604800",
    },
  });
}
