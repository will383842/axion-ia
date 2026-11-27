/**
 * Rapport (LECTURE SEULE) des articles publiés dont une photo Unsplash est en
 * doublon : même photo sur un autre article (image principale ou corps), ou
 * deux fois dans le même article. Aucun remplacement ici : le bouton « Remplacer »
 * de la console passe par `backfillHeroImages({ articleIds })`, un article à la fois.
 */

import { prisma } from "../../../lib/prisma";
import { PHOTO_KEY_REGEX_SOURCE, photoKeyFromUrl } from "./photo-quality";

export interface ArticleRef {
  readonly articleId: string;
  readonly slug: string;
  readonly title: string;
  /** Clé de l'image principale (null = aucune ou non Unsplash). */
  readonly heroKey: string | null;
  /** Clés des images du corps (avec répétitions éventuelles). */
  readonly bodyKeys: readonly string[];
}

export interface DuplicateEntry {
  readonly key: string;
  readonly where: "hero" | "corps";
  /** Slugs des AUTRES articles qui portent la même photo. */
  readonly sharedWith: string[];
  /** Photo répétée dans ce même article. */
  readonly repeatedInArticle: boolean;
}

export interface DuplicateArticle {
  readonly articleId: string;
  readonly slug: string;
  readonly title: string;
  /** true = l'image principale est en doublon → « Remplacer » possible. */
  readonly heroDuplicate: boolean;
  readonly duplicates: DuplicateEntry[];
}

/** Pur : calcule les articles en doublon à partir des références. */
export function computeDuplicates(refs: readonly ArticleRef[]): DuplicateArticle[] {
  const owners = new Map<string, Set<string>>(); // clé → ids d'articles
  for (const r of refs) {
    const keys = [...(r.heroKey ? [r.heroKey] : []), ...r.bodyKeys];
    for (const k of keys) {
      if (!owners.has(k)) owners.set(k, new Set());
      owners.get(k)!.add(r.articleId);
    }
  }
  const slugById = new Map(refs.map((r) => [r.articleId, r.slug] as const));
  const out: DuplicateArticle[] = [];
  for (const r of refs) {
    const entries: DuplicateEntry[] = [];
    const occurrences = new Map<string, number>();
    for (const k of [...(r.heroKey ? [r.heroKey] : []), ...r.bodyKeys]) {
      occurrences.set(k, (occurrences.get(k) ?? 0) + 1);
    }
    const consider: Array<[string, "hero" | "corps"]> = [
      ...(r.heroKey ? ([[r.heroKey, "hero"]] as Array<[string, "hero" | "corps"]>) : []),
      ...[...new Set(r.bodyKeys)].map((k): [string, "hero" | "corps"] => [k, "corps"]),
    ];
    for (const [key, where] of consider) {
      const sharedWith = [...(owners.get(key) ?? [])]
        .filter((id) => id !== r.articleId)
        .map((id) => slugById.get(id) ?? id);
      const repeated = (occurrences.get(key) ?? 0) > 1;
      if (sharedWith.length > 0 || repeated) {
        entries.push({ key, where, sharedWith, repeatedInArticle: repeated });
      }
    }
    if (entries.length > 0) {
      out.push({
        articleId: r.articleId,
        slug: r.slug,
        title: r.title,
        heroDuplicate: entries.some((e) => e.where === "hero"),
        duplicates: entries,
      });
    }
  }
  return out.sort((a, b) => b.duplicates.length - a.duplicates.length);
}

/** Charge les articles publiés (FR) et leurs clés de photos, puis détecte les doublons. */
export async function scanDuplicateImages(): Promise<DuplicateArticle[]> {
  const articles = await prisma.article.findMany({
    where: { status: "published" },
    select: {
      id: true,
      featuredImage: true,
      translations: { where: { locale: "fr" }, select: { slug: true, title: true }, take: 1 },
    },
  });
  const bodyRows = await prisma.$queryRaw<Array<{ articleId: string; keys: string[] | null }>>`
    SELECT t.article_id::text AS "articleId",
           (SELECT array_agg(m[1]) FROM regexp_matches(t.body, ${PHOTO_KEY_REGEX_SOURCE}, 'g') AS m) AS keys
    FROM article_translations t
    JOIN articles a ON a.id = t.article_id
    WHERE a.status = 'published' AND t.locale = 'fr' AND t.body LIKE '%images.unsplash.com%'`;
  const bodyByArticle = new Map((bodyRows ?? []).map((r) => [r.articleId, r.keys ?? []] as const));

  const refs: ArticleRef[] = articles.map((a) => ({
    articleId: a.id,
    slug: a.translations[0]?.slug ?? a.id,
    title: a.translations[0]?.title ?? "",
    heroKey: photoKeyFromUrl(a.featuredImage),
    bodyKeys: bodyByArticle.get(a.id) ?? [],
  }));
  return computeDuplicates(refs);
}
