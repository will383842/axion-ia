/**
 * KB-8 — Exporter RSS 2.0 + JSON Feed cross-type pour le hub /ressources/.
 * Pattern aligné sur /blog/feed.xml, /cas-concrets/feed.xml, /faq/feed.xml existant.
 */

import { prisma } from "@/lib/prisma";
import type { KbType, Locale } from "../../../prisma/generated/client";
import { buildKbPublicUrl } from "@/content/knowledge/routes";

export interface FeedItem {
  readonly entryId: string;
  readonly type: KbType;
  readonly slug: string;
  readonly title: string;
  readonly excerpt: string | null;
  readonly url: string;
  readonly publishedAt: Date | null;
  readonly updatedAt: Date;
}

/**
 * Liste les entries publiques pour les flux RSS/JSON, filtré optionnellement par type.
 * Retourne format unifié `FeedItem`.
 *
 * Tolérance bootstrap (2026-05-14) : si la table `knowledge_entries` n'existe pas
 * encore en DB (premier deploy après le merge KB, migration appliquée par
 * `prisma migrate deploy` à l'entrypoint = APRÈS le build SSG), retourne `[]`.
 * Sans ce guard, le SSG des routes `/[locale]/ressources` (page + feeds RSS/JSON)
 * fail avec P2021 et bloque tout le déploiement (chicken-and-egg : la migration
 * tourne au boot du container mais on n'arrive jamais à booter si le build fail).
 * Au premier boot réussi, la migration crée la table ; l'ISR `revalidate=3600`
 * de la page hub repeuplera dans l'heure, ou plus tôt via revalidatePath.
 */
export async function listPublicEntriesForFeed(
  locale: Locale,
  type?: KbType,
): Promise<readonly FeedItem[]> {
  try {
    const entries = await prisma.knowledgeEntry.findMany({
      where: {
        ...(type ? { type } : {}),
        audience: "public",
        status: { in: ["published", "deprecated"] },
        deletedAt: null,
      },
      include: { translations: { where: { locale } } },
      orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
      take: 50,
    });

    return entries
      .map((e): FeedItem | null => {
        const t = e.translations[0];
        if (!t) return null;
        const url = buildKbPublicUrl(e.type, locale, t.slug);
        if (!url) return null;
        return {
          entryId: e.id,
          type: e.type,
          slug: t.slug,
          title: t.title,
          excerpt: t.excerpt,
          url,
          publishedAt: e.publishedAt,
          updatedAt: t.updatedAt,
        };
      })
      .filter((it): it is FeedItem => it !== null);
  } catch (err) {
    // P2021 = "The table does not exist in the current database" — table KB
    // pas encore migrée (premier deploy après merge KB ; `prisma migrate deploy`
    // tourne au boot du container, donc APRÈS le build SSG). Sans ce guard,
    // le SSG fail avec P2021 et bloque tout le déploiement.
    if (err instanceof Error && "code" in err && (err as { code: string }).code === "P2021") {
      console.warn("[KB] knowledge_entries table not migrated yet — returning empty feed");
      return [];
    }
    throw err;
  }
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Construit le RSS 2.0 XML pour une liste d'entries.
 */
export function buildRssXml(opts: {
  items: readonly FeedItem[];
  locale: Locale;
  channelTitle: string;
  channelDescription: string;
  channelLink: string;
  selfLink: string;
}): string {
  const itemsXml = opts.items
    .map((it) => {
      const fullLink = it.url.startsWith("http")
        ? it.url
        : `${opts.channelLink.replace(/\/[^/]*$/, "")}${it.url}`;
      const pub = it.publishedAt ?? it.updatedAt;
      return `    <item>
      <title>${escapeXml(it.title)}</title>
      <link>${fullLink}</link>
      <guid isPermaLink="true">${fullLink}</guid>
      <description>${escapeXml(it.excerpt ?? "")}</description>
      <pubDate>${pub.toUTCString()}</pubDate>
      <category>${escapeXml(it.type)}</category>
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(opts.channelTitle)}</title>
    <link>${opts.channelLink}</link>
    <description>${escapeXml(opts.channelDescription)}</description>
    <language>${opts.locale === "fr" ? "fr-FR" : "en-US"}</language>
    <atom:link href="${opts.selfLink}" rel="self" type="application/rss+xml" />
${itemsXml}
  </channel>
</rss>`;
}

/**
 * Construit le JSON Feed (https://www.jsonfeed.org/version/1.1/) pour une liste d'entries.
 */
export function buildJsonFeed(opts: {
  items: readonly FeedItem[];
  locale: Locale;
  title: string;
  description: string;
  homeUrl: string;
  feedUrl: string;
}): object {
  return {
    version: "https://jsonfeed.org/version/1.1",
    title: opts.title,
    description: opts.description,
    home_page_url: opts.homeUrl,
    feed_url: opts.feedUrl,
    language: opts.locale === "fr" ? "fr-FR" : "en-US",
    items: opts.items.map((it) => {
      // KB-8 fix : JSON Feed 1.1 exige URLs absolues (id + url).
      // it.url est relatif `/blog/slug`, on construit `<homeUrl>/<locale>/<path>`.
      // homeUrl est de la forme `https://axion-ia.com/fr/ressources`, on extrait
      // le préfixe locale + domain.
      const homeOrigin = opts.homeUrl.replace(/\/[^/]*$/, ""); // → `https://axion-ia.com/fr`
      const fullUrl = it.url.startsWith("http") ? it.url : `${homeOrigin}${it.url}`;
      return {
        id: fullUrl,
        url: fullUrl,
        title: it.title,
        summary: it.excerpt ?? "",
        content_text: it.excerpt ?? "",
        date_published: (it.publishedAt ?? it.updatedAt).toISOString(),
        date_modified: it.updatedAt.toISOString(),
        tags: [it.type],
      };
    }),
  };
}
