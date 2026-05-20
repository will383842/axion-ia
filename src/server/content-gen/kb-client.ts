/**
 * Content Generator — KB V4 client (READ-ONLY wrapper § 11.1 master prompt v2.5).
 *
 * Sprint 1 Day 4 AGT-E. Consomme les helpers KB V4 codés mergés `bd0f831` :
 * - searchKnowledge (FTS Postgres tsvector + trigram)
 * - generateEmbedding (Voyage AI dim 1024 — V1 stub SHA-256)
 * - prisma.knowledgeEntry/Translation/Embedding (lecture seule)
 *
 * Interdictions strictes (cf. references/kb-doctrine.md v2.0) :
 * - JAMAIS prisma.knowledgeEntry.create/update/delete depuis content-gen
 * - JAMAIS migration sur tables Knowledge*
 * - Embedding TOUJOURS via generateEmbedding (pas OpenAI/Cohere/etc.)
 * - Write KB → POST /api/internal/kb/ingest HMAC (cf. Sprint 5 kb-feeder.ts)
 */

import { searchKnowledge } from "@/lib/knowledge/search-fts";
import { generateEmbedding } from "@/lib/knowledge/embeddings";
import type { KbAudience, KbType, Locale } from "../../../prisma/generated/client";

export interface KbRetrieveOptions {
  readonly query: string;
  readonly locale: Locale;
  readonly k?: number;
  readonly filters?: {
    readonly types?: ReadonlyArray<KbType>;
    readonly audiences?: ReadonlyArray<KbAudience>;
  };
  readonly sectorTagSlugs?: ReadonlyArray<string>;
  readonly mode?: "fts" | "vector" | "hybrid";
}

export interface KbRetrievedChunk {
  readonly entryId: string;
  readonly translationId: string;
  readonly title: string;
  readonly slug: string;
  readonly excerpt: string | null;
  readonly type: KbType;
  readonly locale: Locale;
  readonly ftsRank?: number;
  readonly similarity?: number;
}

/**
 * RAG retrieve — consomme la KB en lecture seule via FTS / vector / hybrid.
 *
 * V1 = FTS only (Voyage AI embedding live câblera mode vector/hybrid dès
 * VOYAGE_API_KEY active). Le mode "hybrid" V1 = FTS pour l'instant, sera
 * upgrade Day 5 avec fusion FTS + cosine.
 */
export async function retrieve(opts: KbRetrieveOptions): Promise<KbRetrievedChunk[]> {
  const mode = opts.mode ?? "fts";
  const k = opts.k ?? 8;

  if (mode === "fts" || mode === "hybrid") {
    const filters = opts.filters ?? {};
    const result = await searchKnowledge({
      query: opts.query,
      locale: opts.locale,
      ...(filters.types && filters.types.length > 0 ? { types: [...filters.types] } : {}),
      audiences:
        filters.audiences && filters.audiences.length > 0 ? [...filters.audiences] : ["public"],
      ...(opts.sectorTagSlugs ? { sectorTagSlugs: [...opts.sectorTagSlugs] } : {}),
      limit: k,
      offset: 0,
    });

    return result.hits.map((it) => ({
      entryId: it.entryId,
      translationId: it.translationId,
      title: it.title,
      slug: it.slug,
      excerpt: it.excerpt,
      type: it.type,
      locale: it.locale,
      ftsRank: it.rank,
    }));
  }

  // mode === "vector" : embed query + raw SQL pgvector cosine join (Sprint 1 Day 5 V1.1).
  // V1 minimal : warmup embedding pour vérifier le câblage, puis fallback FTS.
  await generateEmbedding(opts.query);
  return retrieve({ ...opts, mode: "fts" });
}
