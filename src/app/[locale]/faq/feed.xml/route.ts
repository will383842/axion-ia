// RSS 2.0 feed for FAQ entries (per locale).

import { FAQ_GLOBAL } from "@/content/transversal";
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

  const items = FAQ_GLOBAL.map((f) => {
    const link = `${SITE_URL}/${locale}/faq/${f.id}`;
    return `    <item>
      <title>${escapeXml(f[loc].question)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <description>${escapeXml(f[loc].answer)}</description>
    </item>`;
  }).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Axion-IA · FAQ ${locale.toUpperCase()}</title>
    <link>${SITE_URL}/${locale}/faq</link>
    <description>${isFr ? "Questions fréquentes sur Axion-IA." : "Frequently asked questions about Axion-IA."}</description>
    <language>${locale === "fr" ? "fr-FR" : "en-US"}</language>
    <atom:link href="${SITE_URL}/${locale}/faq/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
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
