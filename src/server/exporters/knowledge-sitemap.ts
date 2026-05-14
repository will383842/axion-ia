/**
 * Sub-sitemap KB DB-aware — Sprint SEO 2026-05-14.
 *
 * Pourquoi : le content-gen V1 (factory KB V4) publie des entrées `audience='public'`
 * directement en DB (modèle `KnowledgeEntry` + `KnowledgeTranslation`). Le sitemap
 * historique lit les fichiers TS (`@/content/blog`, `@/content/case-studies`, etc.)
 * → toute entrée née de la factory est invisible au sitemap, donc à Google.
 *
 * Ce module exporte une liste d'URLs sitemap dérivée de la DB :
 *   - `audience = 'public'`
 *   - `status IN ('published', 'deprecated')` (deprecated = encore indexable
 *     historiquement, mais signalé bas)
 *   - `deletedAt IS NULL`
 *   - dédupliquée vs les slugs déjà émis par les builders TS (passés en arg)
 *
 * Tolérance bootstrap (P2021) : si la table `knowledge_entries` n'existe pas
 * encore (premier deploy après merge KB-V4, migration appliquée au boot du
 * container = APRÈS le build SSG), retourne `[]` au lieu de fail le build.
 * Pattern aligné sur `knowledge-rss.ts` qui a déjà ce guard.
 *
 * Chunking : géré par le sitemap-index (Next 16 `generateSitemaps` côté
 * `app/sitemap.ts`). Cap pratique : 1 000 entries/chunk pour rester sous le
 * cap qualité Search Console (cf. doctrine `SITEMAP_CHUNK_SIZE`).
 *
 * URL canonique : via `buildKbPublicUrl()` qui mappe `type` → route publique
 * existante (`/blog/[slug]` pour article, `/cas-concrets/[slug]` pour case_study,
 * `/ressources/[type]/[slug]` pour types V4 factory sans route dédiée).
 */

import type { MetadataRoute } from "next";

import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/seo";
import { buildKbPublicUrl } from "@/content/knowledge/routes";

export interface KnowledgeSitemapEntry {
  readonly url: string; // canonical FR
  readonly urlEn: string; // mirror EN
  readonly lastModified: Date;
  readonly status: "published" | "deprecated";
}

/**
 * Lit toutes les entrées KB publiques publiées (FR+EN si translations existent).
 * Retourne `[]` si la table n'est pas migrée (P2021) — bootstrap-safe.
 *
 * @param excludeSlugsByType - dédup : slugs déjà émis par les builders TS,
 *   indexés par type pour éviter doublons sur les routes partagées
 *   (blog tier-1 fichiers TS + blog factory DB → 1 seule entry sitemap).
 */
export async function listKnowledgeSitemapEntries(
  excludeSlugsByType: ReadonlyMap<string, ReadonlySet<string>> = new Map(),
): Promise<readonly KnowledgeSitemapEntry[]> {
  try {
    const entries = await prisma.knowledgeEntry.findMany({
      where: {
        audience: "public",
        status: { in: ["published", "deprecated"] },
        deletedAt: null,
      },
      select: {
        id: true,
        type: true,
        status: true,
        publishedAt: true,
        updatedAt: true,
        translations: {
          select: { locale: true, slug: true, updatedAt: true },
        },
      },
      orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
    });

    const out: KnowledgeSitemapEntry[] = [];
    for (const e of entries) {
      const frT = e.translations.find((t) => t.locale === "fr");
      const enT = e.translations.find((t) => t.locale === "en");
      // V1 KB factory = FR-only ; pas de translation FR → on saute.
      if (!frT) continue;

      // Dédup vs builders TS : si le slug est déjà émis par un fichier TS
      // (cf. @/content/blog, @/content/case-studies, etc.), on ne le ré-émet
      // pas ici pour éviter un doublon dans sitemap-index. Le builder TS
      // gagne car il porte le contenu canonique pré-migration KB.
      const excluded = excludeSlugsByType.get(e.type);
      if (excluded?.has(frT.slug)) continue;

      const urlFr = buildKbPublicUrl(e.type, "fr", frT.slug);
      if (!urlFr) continue;
      // EN mirror : si pas de translation EN, le sitemap reflète quand même la
      // version FR (canonique). next-intl posera le hreflang correct côté page.
      const urlEn = enT?.slug
        ? buildKbPublicUrl(e.type, "en", enT.slug)
        : buildKbPublicUrl(e.type, "en", frT.slug);

      // lastModified : publishedAt si défini (rare qu'il manque pour status=published)
      // sinon updatedAt translation. Signal fraîcheur honnête vs Google.
      const lastModified = e.publishedAt ?? frT.updatedAt ?? e.updatedAt;

      out.push({
        url: `${SITE_URL}${urlFr.startsWith("/") ? "" : "/"}${urlFr}`,
        urlEn: `${SITE_URL}${(urlEn ?? urlFr).startsWith("/") ? "" : "/"}${urlEn ?? urlFr}`,
        lastModified,
        status: e.status as "published" | "deprecated",
      });
    }
    return out;
  } catch (err) {
    // P2021 = table inexistante (premier deploy post-merge KB) → bootstrap-safe.
    if (err instanceof Error && "code" in err && (err as { code: string }).code === "P2021") {
      console.warn("[KB sitemap] knowledge_entries table not migrated yet — returning empty");
      return [];
    }
    throw err;
  }
}

/**
 * Memoization process-local. `app/sitemap.ts` appelle `buildKnowledgeSitemapChunk`
 * une fois par chunk (knowledge-1, knowledge-2, ..., knowledge-N). Sans cache,
 * chaque appel re-lit toute la table KnowledgeEntry → O(N²) requêtes au build.
 *
 * Cache de niveau processus, invalidé naturellement entre builds (le module est
 * réinstancié à chaque `next build` ou revalidate ISR). Pas de TTL nécessaire :
 * un build SSG est instantané et le worker meurt après.
 *
 * Clé = hash des slugs d'exclusion pour qu'un changement de dédup invalide.
 * V1 : un seul caller (sitemap.ts) avec la même map d'exclusion, donc cache
 * trivial. Si plusieurs callers émergent, étendre la clé.
 */
let cachedEntries: readonly KnowledgeSitemapEntry[] | null = null;
let cacheKey: string | null = null;

function buildCacheKey(excludeSlugsByType: ReadonlyMap<string, ReadonlySet<string>>): string {
  const parts: string[] = [];
  for (const [type, slugs] of excludeSlugsByType) {
    parts.push(`${type}:${[...slugs].sort().join(",")}`);
  }
  return parts.sort().join("|");
}

/**
 * Reset le cache memoize. Utilisé par les tests pour garantir l'isolation.
 * En prod, le cache se reset naturellement entre builds (worker reset).
 */
export function __resetKnowledgeSitemapCache(): void {
  cachedEntries = null;
  cacheKey = null;
}

/**
 * Format MetadataRoute.Sitemap (consommé par `app/sitemap.ts`).
 *
 * @param chunkIdx - 1-indexed chunk (paginate à 1 000 entries pour rester
 *   sous le cap qualité Search Console — best practice 2026).
 * @param chunkSize - taille de chunk (1000 par défaut, aligné `SITEMAP_CHUNK_SIZE`).
 */
export async function buildKnowledgeSitemapChunk(
  chunkIdx: number,
  chunkSize: number,
  excludeSlugsByType: ReadonlyMap<string, ReadonlySet<string>> = new Map(),
): Promise<MetadataRoute.Sitemap> {
  const key = buildCacheKey(excludeSlugsByType);
  let all: readonly KnowledgeSitemapEntry[];
  if (cachedEntries && cacheKey === key) {
    all = cachedEntries;
  } else {
    all = await listKnowledgeSitemapEntries(excludeSlugsByType);
    cachedEntries = all;
    cacheKey = key;
  }
  const start = (chunkIdx - 1) * chunkSize;
  const slice = all.slice(start, start + chunkSize);
  const out: MetadataRoute.Sitemap = [];
  for (const e of slice) {
    const langs = { fr: e.url, en: e.urlEn, "x-default": e.url };
    // Priority/changeFreq : Google ignore depuis 2017 mais on garde cohérence
    // avec les autres builders. `deprecated` priority basse (signal interne).
    const priority = e.status === "deprecated" ? 0.3 : 0.6;
    out.push({
      url: e.url,
      lastModified: e.lastModified,
      changeFrequency: "monthly",
      priority,
      alternates: { languages: langs },
    });
    if (e.urlEn !== e.url) {
      out.push({
        url: e.urlEn,
        lastModified: e.lastModified,
        changeFrequency: "monthly",
        priority,
        alternates: { languages: langs },
      });
    }
  }
  return out;
}

/**
 * Compte le nombre total d'entries publiques (utilisé par `generateSitemaps`
 * pour dériver le nombre de chunks). Bootstrap-safe (P2021 → 0).
 */
export async function countKnowledgePublicEntries(): Promise<number> {
  try {
    return await prisma.knowledgeEntry.count({
      where: {
        audience: "public",
        status: { in: ["published", "deprecated"] },
        deletedAt: null,
      },
    });
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as { code: string }).code === "P2021") {
      return 0;
    }
    throw err;
  }
}
