/**
 * KB-21 — Recherche vectorielle (pgvector cosine) sur knowledge_embeddings.
 *
 * Complément de `search-fts.ts` (lexical tsvector). Utilise l'index HNSW
 * `knowledge_embeddings_hnsw_cosine_idx` (vector_cosine_ops) créé par la
 * migration `20260514020000_kb_v4_pgvector_embeddings`.
 *
 * Applique EXACTEMENT les mêmes gates de visibilité que le FTS (locale,
 * audience, confidentiality='public', status, published_at, embargo, types,
 * sectorTags) → aucune fuite team/will_only par le canal vectoriel.
 *
 * Si la table `knowledge_embeddings` est vide (pas encore seedée / pas de
 * `VOYAGE_API_KEY`), la requête retourne `[]` → l'appelant retombe sur le FTS.
 */

import { prisma } from "@/lib/prisma";
import type { KbAudience, KbType, Locale } from "../../../prisma/generated/client";
import type { KbSearchResult } from "./search-fts";

export interface KbVectorSearchParams {
  /** Embedding 1024-dim de la requête (produit via generateEmbedding). */
  readonly queryEmbedding: readonly number[];
  readonly locale: Locale;
  readonly types?: readonly KbType[];
  readonly audiences?: readonly KbAudience[];
  readonly sectorTagSlugs?: readonly string[];
  readonly limit?: number;
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

/**
 * Construit un littéral pgvector `[x,y,z]` à partir d'un tableau de nombres.
 * Pas de risque d'injection : on filtre sur des nombres finis uniquement.
 */
function toVectorLiteral(vec: readonly number[]): string {
  return `[${vec.map((x) => (Number.isFinite(x) ? x : 0)).join(",")}]`;
}

/**
 * Recherche sémantique cosine. `rank` = similarité cosine (0..1, 1 = identique).
 * Build-safe : sous `stub.invalid` le Proxy Prisma renvoie `[]`.
 */
export async function searchKnowledgeVector(params: KbVectorSearchParams): Promise<KbSearchResult> {
  const vec = params.queryEmbedding;
  if (!vec || vec.length === 0) return { hits: [], total: 0 };

  const limit = Math.min(params.limit ?? 25, 100);
  const audiences = params.audiences ?? (["public"] as KbAudience[]);
  const types = params.types && params.types.length > 0 ? params.types : null;
  const typesArr = types ?? [];
  const sectorTagSlugsArr = params.sectorTagSlugs ? [...params.sectorTagSlugs] : [];

  // Numérotation positionnelle : $1=locale $2=audiences puis types/sectorTags.
  const sectorTagParamIdx = typesArr.length > 0 ? 4 : 3;
  const vecLiteral = toVectorLiteral(vec);

  const rows = await prisma.$queryRawUnsafe<RawRow[]>(
    `
    SELECT
      kt.entry_id AS "entryId",
      kt.id       AS "translationId",
      ke.type     AS "type",
      kt.slug     AS "slug",
      kt.title    AS "title",
      kt.excerpt  AS "excerpt",
      kt.locale   AS "locale",
      (1 - (kemb.embedding <=> '${vecLiteral}'::vector)) AS "rank"
    FROM knowledge_embeddings kemb
    JOIN knowledge_translations kt ON kt.id = kemb.translation_id
    JOIN knowledge_entries ke ON ke.id = kt.entry_id
    WHERE kt.locale = $1::"Locale"
      AND ke.deleted_at IS NULL
      AND ke.status IN ('published', 'deprecated')
      AND ke.audience = ANY($2::"KbAudience"[])
      AND ke.confidentiality = 'public'
      AND (ke.published_at IS NULL OR ke.published_at <= NOW())
      AND (ke.embargo_until IS NULL OR ke.embargo_until <= NOW())
      ${typesArr.length > 0 ? `AND ke.type = ANY($3::"KbType"[])` : ""}
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
    ORDER BY kemb.embedding <=> '${vecLiteral}'::vector ASC
    LIMIT ${limit};
    `,
    params.locale,
    audiences,
    ...(typesArr.length > 0 ? [typesArr] : []),
    ...(sectorTagSlugsArr.length > 0 ? [sectorTagSlugsArr] : []),
  );

  return {
    hits: rows.map((h) => ({
      entryId: h.entryId,
      translationId: h.translationId,
      type: h.type,
      slug: h.slug,
      title: h.title,
      excerpt: h.excerpt,
      locale: h.locale,
      rank: Number(h.rank),
    })),
    total: rows.length,
  };
}
