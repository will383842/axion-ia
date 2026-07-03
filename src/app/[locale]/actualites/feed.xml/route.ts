// RSS 2.0 feed for actualités (Article DB isNews=true tier-1 indexable).
// Audit indexation 2026-05-18 P1-14 — feed catégoriel actualités séparé du
// blog feed. Crawlers : Apple News, Bing News, Inoreader, Feedly, Smart
// Speakers (Alexa flash briefings). Validé par https://validator.w3.org/feed.
//
// Pattern aligné `/blog/feed.xml/route.ts` mais filtré sur :
//   - `isNews = true`
//   - `indexationTier = tier_1_indexable`
//   - `status = published`
//   - `publishedAt >= now - 48h` (fenêtre Google News stricte, cohérent
//     `app/sitemap-news.xml/route.ts`)
//
// Fail-soft : si DB inaccessible (stub.invalid build OR P2021 bootstrap),
// retourne XML vide valide (feed reader ignore gracieusement).

import { prisma } from "@/lib/prisma";
import { routing, type Locale } from "@/i18n/routing";
import { hasLocale } from "next-intl";
import { SITE_URL } from "@/lib/seo";
import { BRAND } from "@/lib/brand";

// Force dynamic : fenêtre 48h glissante exige éval par request (CDN cache
// 5min derrière Cloudflare via Cache-Control).
export const dynamic = "force-dynamic";
export const revalidate = 300;

// Cap dur cohérent avec Google News spec (cf. sitemap-news.xml).
const ACTUALITES_FEED_MAX_ITEMS = 50;
const FRESHNESS_WINDOW_MS = 48 * 60 * 60 * 1000;

interface RouteContext {
  params: Promise<{ locale: string }>;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

interface NewsRow {
  publishedAt: Date | null;
  newsCategory: string | null;
  author: { name: string } | null;
  translations: Array<{ slug: string; title: string; excerpt: string | null }>;
}

async function fetchRecentNewsRows(locale: Locale): Promise<NewsRow[]> {
  // Build-time short-circuit (stub.invalid GH Actions runner).
  if (process.env.DATABASE_URL?.includes("stub.invalid")) return [];
  const cutoff = new Date(Date.now() - FRESHNESS_WINDOW_MS);
  try {
    return await prisma.article.findMany({
      where: {
        status: "published",
        isNews: true,
        indexationTier: "tier_1_indexable",
        publishedAt: { gte: cutoff },
      },
      orderBy: { publishedAt: "desc" },
      take: ACTUALITES_FEED_MAX_ITEMS,
      select: {
        publishedAt: true,
        newsCategory: true,
        author: { select: { name: true } },
        translations: {
          where: { locale },
          select: { slug: true, title: true, excerpt: true },
          take: 1,
        },
      },
    });
  } catch {
    // P2021 table absente bootstrap → fail-soft XML vide
    return [];
  }
}

export async function GET(_req: Request, { params }: RouteContext) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    return new Response("Unknown locale", { status: 404 });
  }
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const rows = await fetchRecentNewsRows(loc);

  // lastBuildDate = date du plus récent item (rows triées desc), sinon now.
  const newestDate = rows.find((r) => r.publishedAt)?.publishedAt ?? new Date();

  const items = rows
    .map((row) => {
      const t = row.translations[0];
      if (!t || !t.slug || !row.publishedAt) return null;
      const link = `${SITE_URL}/${locale}/actualites/${t.slug}`;
      const pub = row.publishedAt.toUTCString();
      const iso = row.publishedAt.toISOString();
      const desc = t.excerpt ?? "";
      // dc:creator = auteur réel si chargé, sinon nom éditorial de la marque.
      const creator = row.author?.name ?? BRAND.name;
      const categoryLine = row.newsCategory
        ? `\n      <category>${escapeXml(row.newsCategory)}</category>`
        : "";
      return `    <item>
      <title>${escapeXml(t.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${pub}</pubDate>
      <dc:date>${iso}</dc:date>
      <dc:creator>${escapeXml(creator)}</dc:creator>${categoryLine}
      <description>${escapeXml(desc)}</description>
    </item>`;
    })
    .filter((s): s is string => s !== null)
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Axion-IA · Actualités ${locale.toUpperCase()}</title>
    <link>${SITE_URL}/${locale}/actualites</link>
    <description>${isFr ? "Actualités IA business — analyse opérationnelle, marché, réglementation (fenêtre 48h glissante)." : "AI business news — operational analysis, market, regulation (48h sliding window)."}</description>
    <language>${locale === "fr" ? "fr-FR" : "en-US"}</language>
    <lastBuildDate>${newestDate.toUTCString()}</lastBuildDate>
    <ttl>60</ttl>
    <atom:link href="${SITE_URL}/${locale}/actualites/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600, stale-if-error=604800",
    },
  });
}
