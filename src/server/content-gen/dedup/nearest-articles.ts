/**
 * Content Generator — articles les plus proches par embedding (PR4).
 *
 * Couche 4 de la détection des doublons : lit la colonne vectorielle qui correspond
 * au fournisseur actif (`embedding` OpenAI 1536, ou `embedding_voyage` Voyage 1024) et
 * applique les seuils DE CE fournisseur. Les deux espaces ne se comparent jamais.
 *
 * Lecture seule. Le nom de colonne vient d'une table de constantes (jamais d'une
 * entrée externe) ; l'identifiant et la limite sont passés en paramètres liés.
 */

import type { PrismaClient } from "../../../../prisma/generated/client";
import { classifyDedupVerdict, type DedupVerdictResult } from "./embedding-similarity";
import {
  ARTICLE_EMBEDDING_COLUMN,
  getDedupThresholds,
  getEmbeddingProvider,
  type EmbeddingProvider,
} from "./embedding-provider";

export interface NearestArticle {
  readonly id: string;
  readonly similarity: number;
}

export interface NearestArticlesInput {
  readonly articleId: string;
  readonly limit?: number;
  /** Défaut : fournisseur actif (`CONTENT_EMBEDDING_PROVIDER`). */
  readonly provider?: EmbeddingProvider;
}

export async function findNearestArticles(
  prisma: Pick<PrismaClient, "$queryRawUnsafe">,
  input: NearestArticlesInput,
): Promise<NearestArticle[]> {
  const provider = input.provider ?? getEmbeddingProvider();
  const col = ARTICLE_EMBEDDING_COLUMN[provider];
  const limit = Math.max(1, Math.min(50, Math.floor(input.limit ?? 5)));

  const rows = (await prisma.$queryRawUnsafe(
    `SELECT b.id::text AS id,
            (1 - (b."${col}" <=> (SELECT "${col}" FROM articles WHERE id = $1::uuid)))::float8 AS similarity
       FROM articles b
      WHERE b.id <> $1::uuid
        AND b.status = 'published'
        AND b."${col}" IS NOT NULL
        AND (SELECT "${col}" FROM articles WHERE id = $1::uuid) IS NOT NULL
      ORDER BY b."${col}" <=> (SELECT "${col}" FROM articles WHERE id = $1::uuid)
      LIMIT $2`,
    input.articleId,
    limit,
  )) as Array<{ id: string; similarity: number }>;

  return rows.map((r) => ({ id: r.id, similarity: Number(r.similarity) }));
}

/** Verdict du plus proche voisin, avec les seuils du fournisseur. `null` si aucun voisin. */
export function verdictPourVoisinLePlusProche(
  voisins: readonly NearestArticle[],
  provider: EmbeddingProvider = getEmbeddingProvider(),
): DedupVerdictResult | null {
  const top = voisins[0];
  if (!top) return null;
  return classifyDedupVerdict({ similarity: top.similarity, ...getDedupThresholds(provider) });
}
