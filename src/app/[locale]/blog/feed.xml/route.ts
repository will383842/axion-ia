// RSS 2.0 feed for the blog (per locale). Crawlers : Bing Copilot,
// Perplexity, NewsBlur, Inoreader. Validated by https://validator.w3.org/feed.

import { BLOG_POSTS } from "@/content/transversal";
import { routing, type Locale } from "@/i18n/routing";
import { hasLocale } from "next-intl";
import { SITE_URL } from "@/lib/seo";

export const runtime = "edge";

interface RouteContext {
  params: Promise<{ locale: string }>;
}

export async function GET(_req: Request, { params }: RouteContext) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    return new Response("Unknown locale", { status: 404 });
  }
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const items = BLOG_POSTS.map((p) => {
    const link = `${SITE_URL}/${locale}/blog/${p.slug}`;
    const copy = p[loc];
    const pub = new Date(p.publishedAt).toUTCString();
    return `    <item>
      <title>${escapeXml(copy.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${pub}</pubDate>
      <category>${escapeXml(p.category)}</category>
      <author>${escapeXml(p.author)}</author>
      <description>${escapeXml(copy.excerpt)}</description>
    </item>`;
  }).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Axion-IA · Blog ${locale.toUpperCase()}</title>
    <link>${SITE_URL}/${locale}/blog</link>
    <description>${isFr ? "Méthodologie, cas d'usage et stratégie IA pour entreprises." : "Methodology, use cases and AI strategy for businesses."}</description>
    <language>${locale === "fr" ? "fr-FR" : "en-US"}</language>
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

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
