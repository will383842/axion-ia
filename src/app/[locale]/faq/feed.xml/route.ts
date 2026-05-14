// RSS 2.0 feed for FAQ entries (per locale).
// KB-6.3 : lit via reader unifié (FAQ_GLOBAL legacy ou knowledge_entries DB).

import { routing, type Locale } from "@/i18n/routing";
import { hasLocale } from "next-intl";
import { SITE_URL } from "@/lib/seo";
import { listFaqs } from "@/lib/knowledge/readers";

// runtime nodejs (au lieu de edge) car les readers utilisent Prisma
// (incompatible avec edge runtime).
export const runtime = "nodejs";

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

  const faqs = await listFaqs();
  const items = faqs
    .map((f) => {
      const link = `${SITE_URL}/${locale}/faq/${f.slug}`;
      const question = loc === "fr" ? f.questionFr : f.questionEn;
      const answer = loc === "fr" ? f.answerFr : f.answerEn;
      return `    <item>
      <title>${escapeXml(question)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <description>${escapeXml(answer)}</description>
    </item>`;
    })
    .join("\n");

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
