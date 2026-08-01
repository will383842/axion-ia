// KB-8 — JSON Feed 1.1 cross-type pour le hub /ressources/.

import { NextResponse } from "next/server";
import { routing, type Locale } from "@/i18n/routing";
import { hasLocale } from "next-intl";
import { SITE_URL } from "@/lib/seo";
import { buildJsonFeed, listPublicEntriesForFeed } from "@/server/exporters/knowledge-rss";

export const runtime = "nodejs";
// Même fix que le feed.xml voisin (audit indexation GSC 2026-08-01) : sans
// `force-dynamic`, route bakée VIDE au build stub.invalid et servie telle
// quelle en prod. Lecture DB au runtime, charge absorbée par le CDN.
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ locale: string }>;
}

export async function GET(_req: Request, { params }: RouteContext) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    return NextResponse.json({ error: "Unknown locale" }, { status: 404 });
  }
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const items = await listPublicEntriesForFeed(loc);

  const feed = buildJsonFeed({
    items,
    locale: loc,
    title: `Axion-IA · ${isFr ? "Ressources" : "Resources"} ${locale.toUpperCase()}`,
    description: isFr
      ? "Articles, FAQ, cas concrets, glossaire IA, guides."
      : "Articles, FAQ, case studies, AI glossary, guides.",
    homeUrl: `${SITE_URL}/${locale}/ressources`,
    feedUrl: `${SITE_URL}/${locale}/ressources/feed.json`,
  });

  return NextResponse.json(feed, {
    status: 200,
    headers: {
      "Content-Type": "application/feed+json; charset=utf-8",
      "Cache-Control": "public, max-age=600, stale-while-revalidate=86400, stale-if-error=604800",
    },
  });
}
