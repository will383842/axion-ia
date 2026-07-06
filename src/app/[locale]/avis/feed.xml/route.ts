// Flux RSS 2.0 des avis clients publiés (syndication + découverte IA/agrégateurs).
// DB-driven → force-dynamic (jamais figé sur le build stub).

import { routing } from "@/i18n/routing";
import { hasLocale } from "next-intl";
import { SITE_URL } from "@/lib/seo";
import { getPublishedReviews } from "@/server/reviews/queries";
import { reviewAuthorName } from "@/lib/reviews/display";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

interface RouteContext {
  params: Promise<{ locale: string }>;
}

export async function GET(_req: Request, { params }: RouteContext): Promise<Response> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    return new Response("Unknown locale", { status: 404 });
  }

  const { items: reviews } = await getPublishedReviews({ pageSize: 48, sort: "recent" });

  const items = reviews
    .map((r) => {
      const author = reviewAuthorName(r);
      const link = `${SITE_URL}/${locale}/avis/${r.slug}`;
      const title = r.title ? `${r.title} — ${author}` : `Avis de ${author} (${r.rating}/5)`;
      const date = (r.publishedAt ?? r.createdAt).toUTCString();
      return `    <item>
      <title>${escapeXml(title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${date}</pubDate>
      <description>${escapeXml(`${r.rating}/5 — ${r.comment.slice(0, 300)}`)}</description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Avis clients Axion-IA</title>
    <link>${SITE_URL}/${locale}/avis</link>
    <description>Retours d'expérience clients vérifiés sur les services IA d'Axion-IA.</description>
    <language>${locale}</language>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
