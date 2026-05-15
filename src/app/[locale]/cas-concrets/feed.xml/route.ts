// RSS 2.0 feed for case studies (per locale).

import { CASE_STUDIES } from "@/content/case-studies";
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

  const items = CASE_STUDIES.map((c) => {
    const link = `${SITE_URL}/${locale}/cas-concrets/${c.slug}`;
    const copy = c[loc];
    return `    <item>
      <title>${escapeXml(copy.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <category>${escapeXml(loc === "fr" ? c.industry : c.industryEn)}</category>
      <description>${escapeXml(copy.excerpt)}</description>
    </item>`;
  }).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Axion-IA · ${isFr ? "Cas concrets" : "Case studies"} ${locale.toUpperCase()}</title>
    <link>${SITE_URL}/${locale}/cas-concrets</link>
    <description>${isFr ? "Résultats clients chiffrés et témoignages." : "Quantified client results and testimonials."}</description>
    <language>${locale === "fr" ? "fr-FR" : "en-US"}</language>
    <atom:link href="${SITE_URL}/${locale}/cas-concrets/feed.xml" rel="self" type="application/rss+xml" />
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
