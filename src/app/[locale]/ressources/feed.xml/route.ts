// KB-8 — RSS 2.0 cross-type pour le hub /ressources/.

import { routing, type Locale } from "@/i18n/routing";
import { hasLocale } from "next-intl";
import { SITE_URL } from "@/lib/seo";
import { buildRssXml, listPublicEntriesForFeed } from "@/server/exporters/knowledge-rss";

export const runtime = "nodejs";
// Audit indexation GSC 2026-08-01 — sans `force-dynamic`, cette route (aucune
// API dynamique utilisée) était PRÉ-RENDUE au build sous stub.invalid (DB
// factice → 0 entrée, cf. short-circuit de `listPublicEntriesForFeed`) puis
// BAKÉE VIDE dans l'image et servie telle quelle en prod — même mécanisme que
// les sitemaps presse/blog corrigés par les PR 450/451. Lecture DB au runtime ;
// la charge est absorbée par le Cache-Control CDN ci-dessous. Si le flux reste
// à 0 item APRÈS ce fix, c'est un état de données (aucune entrée KB publique),
// plus un bug de rendu.
export const dynamic = "force-dynamic";

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
      "Cache-Control": "public, max-age=600, stale-while-revalidate=86400, stale-if-error=604800",
    },
  });
}
