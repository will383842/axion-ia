// RSS 2.0 feed for the blog (per locale). Crawlers : Bing Copilot,
// Perplexity, NewsBlur, Inoreader. Validated by https://validator.w3.org/feed.
//
// DB-driven (audit indexation GSC 2026-07-31) — le feed mappait `BLOG_POSTS`,
// vidé le 2026-07-03 (blog 100 % DB depuis, cf. `src/content/blog/index.ts`) :
// le flux servait un `<channel>` SANS AUCUN `<item>` en permanence — signal
// « site mort » pour les crawlers AEO pourtant Allow dans robots.txt. Réécrit
// sur le pattern de `actualites/feed.xml/route.ts` : lecture DB au runtime
// (articles publiés tier-1, hors news), fail-soft, cache CDN. `runtime="edge"`
// retiré : Prisma exige Node.
//
// Sémantique RSS standard : les N derniers articles, SANS fenêtre de fraîcheur
// (un lecteur RSS déduplique par <guid> ; un flux vide entre deux publications
// serait pire qu'un flux stable).

import { prisma } from "@/lib/prisma";
import { routing, type Locale } from "@/i18n/routing";
import { hasLocale } from "next-intl";
import { SITE_URL } from "@/lib/seo";
import { BRAND } from "@/lib/brand";

export const dynamic = "force-dynamic";
export const revalidate = 300;

const BLOG_FEED_MAX_ITEMS = 30;

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

interface BlogRow {
  publishedAt: Date | null;
  author: { name: string } | null;
  translations: Array<{ slug: string; title: string; excerpt: string | null }>;
}

async function fetchBlogRows(locale: Locale): Promise<BlogRow[]> {
  // Build-time short-circuit (stub.invalid GH Actions runner).
  if (process.env.DATABASE_URL?.includes("stub.invalid")) return [];
  try {
    return await prisma.article.findMany({
      where: {
        status: "published",
        isNews: false,
        indexationTier: "tier_1_indexable",
      },
      orderBy: { publishedAt: "desc" },
      take: BLOG_FEED_MAX_ITEMS,
      select: {
        publishedAt: true,
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

  const rows = await fetchBlogRows(loc);
  const newestDate = rows.find((r) => r.publishedAt)?.publishedAt ?? new Date();

  const items = rows
    .map((row) => {
      const t = row.translations[0];
      if (!t || !t.slug || !row.publishedAt) return null;
      // Les guides (`guide-…`) sont canoniques sous /guides/[slug] — la page
      // /blog/guide-… 308-redirige (miroir de `resolveArticleRoute`, même
      // routage que `buildBlogSitemap`). Le feed pointe directement la canonique.
      const isGuide = t.slug.startsWith("guide-") || t.slug.startsWith("guide_");
      const link = `${SITE_URL}/${locale}/${isGuide ? "guides" : "blog"}/${t.slug}`;
      const creator = row.author?.name ?? BRAND.name;
      return `    <item>
      <title>${escapeXml(t.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${row.publishedAt.toUTCString()}</pubDate>
      <dc:creator>${escapeXml(creator)}</dc:creator>
      <description>${escapeXml(t.excerpt ?? "")}</description>
    </item>`;
    })
    .filter((s): s is string => s !== null)
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Axion-IA · Blog ${locale.toUpperCase()}</title>
    <link>${SITE_URL}/${locale}/blog</link>
    <description>${isFr ? "Méthodologie, cas d'usage et stratégie IA pour entreprises." : "Methodology, use cases and AI strategy for businesses."}</description>
    <language>${locale === "fr" ? "fr-FR" : "en-US"}</language>
    <lastBuildDate>${newestDate.toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/${locale}/blog/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=900, stale-while-revalidate=86400, stale-if-error=604800",
    },
  });
}
