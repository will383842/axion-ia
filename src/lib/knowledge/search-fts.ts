/**
 * KB-7 — Recherche FTS Postgres sur knowledge_translations.
 *
 * Utilise `to_tsvector` matérialisé via migration `kb_fts_setup.sql` (config
 * `fr_unaccent` pour FR + `english` pour EN). Index GIN sur search_vector.
 *
 * Cible V1 : `to_tsquery` + `ts_rank_cd` + boost pinned/featured/freshness.
 * V1.5 (KB-21) : hybride RRF FTS + cosine pgvector.
 */

import { prisma } from "@/lib/prisma";
import type { KbAudience, KbType, Locale } from "../../../prisma/generated/client";

export interface KbSearchHit {
  readonly entryId: string;
  readonly translationId: string;
  readonly type: KbType;
  readonly slug: string;
  readonly title: string;
  readonly excerpt: string | null;
  readonly locale: Locale;
  readonly rank: number;
}

export interface KbSearchParams {
  readonly query: string;
  readonly locale: Locale;
  readonly types?: readonly KbType[];
  readonly audiences?: readonly KbAudience[];
  readonly sectorTagSlugs?: readonly string[];
  readonly limit?: number;
  readonly offset?: number;
}

export interface KbSearchResult {
  readonly hits: readonly KbSearchHit[];
  readonly total: number;
}

interface RawRow {
  entryId: string;
  translationId: string;
  type: KbType;
  slug: string;
  title: string;
  excerpt: string | null;
  locale: Locale;
  rank: number;
}

interface CountRow {
  count: bigint;
}

/**
 * Exécute une recherche FTS sur knowledge_translations.
 * Audience filter applied côté SQL (sécurité — pas de fuite de team/will_only).
 */
export async function searchKnowledge(params: KbSearchParams): Promise<KbSearchResult> {
  const q = params.query.trim();
  if (!q) return { hits: [], total: 0 };

  const limit = Math.min(params.limit ?? 25, 100);
  const offset = params.offset ?? 0;
  const audiences = params.audiences ?? (["public"] as KbAudience[]);
  const types = params.types && params.types.length > 0 ? params.types : null;

  // Construct ts_query : websearch_to_tsquery accepte syntaxe natural ("AND OR -NOT")
  const tsConfig = params.locale === "fr" ? "fr_unaccent" : "english";

  // SQL paramétré pour éviter injection.
  // Note : Prisma $queryRaw supporte les arrays via Prisma.sql / ANY().
  // On utilise ARRAY[...]::"KbAudience"[] pour binder l'array.
  const audienceArr = audiences;
  const typesArr = types ?? [];
  const sectorTagSlugsArr = params.sectorTagSlugs ? [...params.sectorTagSlugs] : [];
  // Numérotation des paramètres positionnels :
  //   $1=tsConfig $2=q $3=locale $4=audienceArr
  //   $5=typesArr (si présent) puis $5 ou $6 pour sectorTagSlugsArr.
  const sectorTagParamIdx = typesArr.length > 0 ? 6 : 5;

  // Hits + ranking
  const hits = await prisma.$queryRawUnsafe<RawRow[]>(
    `
    SELECT
      kt.entry_id           AS "entryId",
      kt.id                 AS "translationId",
      ke.type               AS "type",
      kt.slug               AS "slug",
      kt.title              AS "title",
      kt.excerpt            AS "excerpt",
      kt.locale             AS "locale",
      ts_rank_cd(
        kt.search_vector,
        websearch_to_tsquery($1::regconfig, $2)
      )
      * (CASE WHEN ke.pinned THEN 1.5 ELSE 1.0 END)
      * (CASE WHEN ke.featured THEN 1.3 ELSE 1.0 END)
      * (CASE WHEN ke.published_at IS NOT NULL
              THEN 1.0 + 0.1 / (1 + EXTRACT(EPOCH FROM (NOW() - ke.published_at))/86400/30)
              ELSE 1.0 END)
                            AS "rank"
    FROM knowledge_translations kt
    JOIN knowledge_entries ke ON ke.id = kt.entry_id
    WHERE kt.locale = $3::"Locale"
      AND ke.deleted_at IS NULL
      AND ke.status IN ('published', 'deprecated')
      AND ke.audience = ANY($4::"KbAudience"[])
      AND ke.confidentiality = 'public'
      AND (ke.published_at IS NULL OR ke.published_at <= NOW())
      AND (ke.embargo_until IS NULL OR ke.embargo_until <= NOW())
      ${typesArr.length > 0 ? `AND ke.type = ANY($5::"KbType"[])` : ""}
      ${
        sectorTagSlugsArr.length > 0
          ? `
      AND EXISTS (
        SELECT 1 FROM knowledge_tags_on_entries ktoe2
        JOIN knowledge_tags kt2 ON kt2.id = ktoe2.tag_id
        WHERE ktoe2.entry_id = ke.id
          AND kt2.slug = ANY($${sectorTagParamIdx}::text[])
      )`
          : ""
      }
      AND kt.search_vector @@ websearch_to_tsquery($1::regconfig, $2)
    ORDER BY "rank" DESC, ke.published_at DESC NULLS LAST
    LIMIT ${limit} OFFSET ${offset};
    `,
    tsConfig,
    q,
    params.locale,
    audienceArr,
    ...(typesArr.length > 0 ? [typesArr] : []),
    ...(sectorTagSlugsArr.length > 0 ? [sectorTagSlugsArr] : []),
  );

  // Count total (sans LIMIT)
  const countRows = await prisma.$queryRawUnsafe<CountRow[]>(
    `
    SELECT COUNT(*)::bigint AS count
    FROM knowledge_translations kt
    JOIN knowledge_entries ke ON ke.id = kt.entry_id
    WHERE kt.locale = $3::"Locale"
      AND ke.deleted_at IS NULL
      AND ke.status IN ('published', 'deprecated')
      AND ke.audience = ANY($4::"KbAudience"[])
      AND ke.confidentiality = 'public'
      AND (ke.published_at IS NULL OR ke.published_at <= NOW())
      AND (ke.embargo_until IS NULL OR ke.embargo_until <= NOW())
      ${typesArr.length > 0 ? `AND ke.type = ANY($5::"KbType"[])` : ""}
      ${
        sectorTagSlugsArr.length > 0
          ? `
      AND EXISTS (
        SELECT 1 FROM knowledge_tags_on_entries ktoe2
        JOIN knowledge_tags kt2 ON kt2.id = ktoe2.tag_id
        WHERE ktoe2.entry_id = ke.id
          AND kt2.slug = ANY($${sectorTagParamIdx}::text[])
      )`
          : ""
      }
      AND kt.search_vector @@ websearch_to_tsquery($1::regconfig, $2);
    `,
    tsConfig,
    q,
    params.locale,
    audienceArr,
    ...(typesArr.length > 0 ? [typesArr] : []),
    ...(sectorTagSlugsArr.length > 0 ? [sectorTagSlugsArr] : []),
  );

  const total = countRows[0] ? Number(countRows[0].count) : 0;

  return {
    hits: hits.map((h) => ({
      entryId: h.entryId,
      translationId: h.translationId,
      type: h.type,
      slug: h.slug,
      title: h.title,
      excerpt: h.excerpt,
      locale: h.locale,
      rank: h.rank,
    })),
    total,
  };
}
