// RSS 2.0 feed for FAQ entries (per locale).
// KB-6.3 : lit via reader unifié (FAQ_GLOBAL legacy ou knowledge_entries DB).

import { routing, type Locale } from "@/i18n/routing";
import { hasLocale } from "next-intl";
import { SITE_URL } from "@/lib/seo";
import { listFaqs } from "@/lib/knowledge/readers";
import { collapsePriceProseDuplicates, resolvePriceTokens } from "@/content/pricing-tokens";

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

  // 🔴 AUDIT GEO/AEO 2026-08-15 (GEO-040, volet tokens) — les réponses FAQ sont
  // de la prose stockée dont les montants sont écrits en `{{price:…}}` et
  // résolus AU RENDU depuis le SSOT `pricing.ts`. La fiche `/faq/[slug]` les
  // résout ; ce flux, non. Mesuré au 2026-08-14 : 70 gabarits servis en clair
  // dans les `<description>`, c'est-à-dire dans le champ que les agrégateurs et
  // les moteurs de réponse recopient tel quel.
  //
  // ⚠️ Décision actée Will : on NE bascule PAS les tokens `|flat` en `|from` —
  // la prose porte déjà « à partir de », le mode `from` produirait un doublon.
  // `collapsePriceProseDuplicates` rattrape les collisions résiduelles.
  //
  // Périmètre strictement limité au rendu : ni cap d'items, ni `pubDate`, ni
  // fenêtre. La sémantique « N derniers items sans fenêtre » (fix 2026-07-31)
  // reste intacte.
  const render = (s: string) =>
    isFr ? collapsePriceProseDuplicates(resolvePriceTokens(s, "fr")) : resolvePriceTokens(s, "en");

  const faqs = await listFaqs();
  const items = faqs
    .map((f) => {
      const link = `${SITE_URL}/${locale}/faq/${f.slug}`;
      const question = render(loc === "fr" ? f.questionFr : f.questionEn);
      const answer = render(loc === "fr" ? f.answerFr : f.answerEn);
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
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400, stale-if-error=604800",
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
