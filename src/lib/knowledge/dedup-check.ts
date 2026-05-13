/**
 * KB V4 — Dedup factory via pgvector cosine.
 *
 * Seuils (§17.3 prompt master) :
 * - ≥ 0.92 cosine : REJECT immédiat (dedup match) — l'entrée n'est PAS publiée
 * - 0.85-0.92 : publié mais flag `dedup_warning` pour revue ultérieure
 * - < 0.85 : OK
 *
 * Implémentation : utilise pgvector `<->` opérateur (cosine distance =
 * 1 - cosine similarity) via SQL raw, car Prisma ne supporte pas vector
 * operations natives.
 */

import { prisma } from "@/lib/prisma";
import type { KbType } from "../../../prisma/generated/client";

export const DEDUP_REJECT_THRESHOLD = 0.92;
export const DEDUP_WARNING_THRESHOLD = 0.85;

export interface DedupCheckResult {
  readonly action: "ok" | "warning" | "reject";
  readonly closestSimilarity: number;
  readonly matches: ReadonlyArray<{
    readonly entryId: string;
    readonly translationId: string;
    readonly slug: string;
    readonly title: string;
    readonly similarity: number;
  }>;
}

interface RawMatch {
  entryId: string;
  translationId: string;
  slug: string;
  title: string;
  similarity: number;
}

/**
 * Cherche les entrées similaires au vecteur fourni.
 * Filtre par type (même `type` uniquement — un article n'est pas comparé à une FAQ).
 * Audience publique uniquement (corpus dedup = publié).
 */
export async function findSimilarEntries(opts: {
  readonly embedding: readonly number[];
  readonly type: KbType;
  readonly excludeTranslationId?: string;
  readonly topK?: number;
}): Promise<DedupCheckResult> {
  const topK = opts.topK ?? 5;
  const vectorLiteral = `[${opts.embedding.join(",")}]`;

  // pgvector `<=>` retourne cosine distance (0 = identique, 2 = opposé).
  // similarity = 1 - distance.
  const rows = await prisma.$queryRawUnsafe<RawMatch[]>(
    `
    SELECT
      ke.id            AS "entryId",
      kt.id            AS "translationId",
      kt.slug          AS "slug",
      kt.title         AS "title",
      (1 - (kemb.embedding <=> $1::vector))::float8 AS "similarity"
    FROM knowledge_embeddings kemb
    JOIN knowledge_translations kt ON kt.id = kemb.translation_id
    JOIN knowledge_entries ke ON ke.id = kt.entry_id
    WHERE ke.type = $2::"KbType"
      AND ke.audience = 'public'::"KbAudience"
      AND ke.status IN ('published', 'deprecated')
      AND ke.deleted_at IS NULL
      ${opts.excludeTranslationId ? `AND kt.id <> $3::uuid` : ""}
    ORDER BY kemb.embedding <=> $1::vector
    LIMIT ${topK};
    `,
    vectorLiteral,
    opts.type,
    ...(opts.excludeTranslationId ? [opts.excludeTranslationId] : []),
  );

  if (rows.length === 0) {
    return { action: "ok", closestSimilarity: 0, matches: [] };
  }

  const closest = rows[0]!.similarity;

  let action: "ok" | "warning" | "reject" = "ok";
  if (closest >= DEDUP_REJECT_THRESHOLD) action = "reject";
  else if (closest >= DEDUP_WARNING_THRESHOLD) action = "warning";

  return {
    action,
    closestSimilarity: closest,
    matches: rows.map((r) => ({
      entryId: r.entryId,
      translationId: r.translationId,
      slug: r.slug,
      title: r.title,
      similarity: r.similarity,
    })),
  };
}
