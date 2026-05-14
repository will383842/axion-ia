// KB-8 — RSS 2.0 cross-type pour le hub /ressources/.

import { routing, type Locale } from "@/i18n/routing";
import { hasLocale } from "next-intl";
import { SITE_URL } from "@/lib/seo";
import { buildRssXml, listPublicEntriesForFeed } from "@/server/exporters/knowledge-rss";

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

  const items = await listPublicEntriesForFeed(loc);

  const xml = buildRssXml({
    items,
    locale: loc,
    channelTitle: `Axion-IA · ${isFr ? "Ressources" : "Resources"} ${locale.toUpperCase()}`,
    channelDescription: isFr
      ? "Articles, FAQ, cas concrets, glossaire IA, guides — toutes les ressources Axion-IA."
      : "Articles, FAQ, case studies, AI glossary, guides — all Axion-IA resources.",
    channelLink: `${SITE_URL}/${locale}/ressources`,
    selfLink: `${SITE_URL}/${locale}/ressources/feed.xml`,
  });

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=600, stale-while-revalidate=86400",
    },
  });
}
