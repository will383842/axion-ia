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
import { searchKnowledgeVector } from "@/lib/knowledge/search-vector";
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

/** Constante RRF (Reciprocal Rank Fusion) — standard littérature IR. */
const RRF_K = 60;

/** Recherche FTS lexicale (tsvector). */
async function retrieveFts(opts: KbRetrieveOptions, k: number): Promise<KbRetrievedChunk[]> {
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

/**
 * Recherche vectorielle cosine. Retourne `[]` (sans throw) si l'embedding réel
 * n'est pas disponible — clé Voyage absente (embedding "-stub" non sémantique),
 * table d'embeddings vide, ou erreur réseau — pour que l'appelant retombe sur
 * le FTS. C'est la garantie « zéro casse » tant que la KB n'est pas embeddée.
 */
async function retrieveVector(opts: KbRetrieveOptions, k: number): Promise<KbRetrievedChunk[]> {
  try {
    const emb = await generateEmbedding(opts.query);
    // Embedding stub (hash SHA-256, sans VOYAGE_API_KEY) = inutile sémantiquement.
    // On l'ignore pour ne pas polluer les résultats avec du bruit.
    if (emb.modelVersion.endsWith("-stub")) return [];

    const filters = opts.filters ?? {};
    const result = await searchKnowledgeVector({
      queryEmbedding: emb.embedding,
      locale: opts.locale,
      ...(filters.types && filters.types.length > 0 ? { types: [...filters.types] } : {}),
      audiences:
        filters.audiences && filters.audiences.length > 0 ? [...filters.audiences] : ["public"],
      ...(opts.sectorTagSlugs ? { sectorTagSlugs: [...opts.sectorTagSlugs] } : {}),
      limit: k,
    });
    return result.hits.map((it) => ({
      entryId: it.entryId,
      translationId: it.translationId,
      title: it.title,
      slug: it.slug,
      excerpt: it.excerpt,
      type: it.type,
      locale: it.locale,
      similarity: it.rank,
    }));
  } catch (err) {
    console.warn("[kb-client] retrieveVector fallback (FTS):", (err as Error).message);
    return [];
  }
}

/**
 * Fusionne deux listes classées via Reciprocal Rank Fusion (RRF), dédupliquées
 * par `translationId`. Conserve les métadonnées (ftsRank/similarity) de la 1ʳᵉ
 * occurrence rencontrée.
 */
function rrfMerge(
  fts: readonly KbRetrievedChunk[],
  vector: readonly KbRetrievedChunk[],
  k: number,
): KbRetrievedChunk[] {
  const scores = new Map<string, number>();
  const byId = new Map<string, KbRetrievedChunk>();
  for (const list of [fts, vector]) {
    list.forEach((chunk, idx) => {
      const id = chunk.translationId;
      scores.set(id, (scores.get(id) ?? 0) + 1 / (RRF_K + idx + 1));
      const prev = byId.get(id);
      byId.set(id, {
        ...(prev ?? chunk),
        ...(chunk.ftsRank !== undefined ? { ftsRank: chunk.ftsRank } : {}),
        ...(chunk.similarity !== undefined ? { similarity: chunk.similarity } : {}),
      });
    });
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([id]) => byId.get(id)!)
    .filter(Boolean);
}

/**
 * RAG retrieve — consomme la KB en lecture seule via FTS / vector / hybrid.
 *
 * - `fts`    : recherche lexicale tsvector (toujours disponible).
 * - `vector` : recherche sémantique cosine pgvector ; fallback FTS si embeddings
 *              réels indisponibles (clé Voyage absente / table vide).
 * - `hybrid` : fusion RRF FTS + vectoriel. Si le vectoriel ne renvoie rien
 *              (cas par défaut tant que la KB n'est pas embeddée), retourne le
 *              FTS pur → comportement strictement identique à l'ancien V1.
 */
export async function retrieve(opts: KbRetrieveOptions): Promise<KbRetrievedChunk[]> {
  const mode = opts.mode ?? "fts";
  const k = opts.k ?? 8;

  let chunks: KbRetrievedChunk[];
  if (mode === "fts") {
    chunks = await retrieveFts(opts, k);
  } else if (mode === "vector") {
    const vector = await retrieveVector(opts, k);
    chunks = vector.length > 0 ? vector : await retrieveFts(opts, k);
  } else {
    // hybrid : FTS + vectoriel fusionnés (RRF). Sur-échantillonne chaque canal.
    const [fts, vector] = await Promise.all([
      retrieveFts(opts, k * 2),
      retrieveVector(opts, k * 2),
    ]);
    chunks = vector.length === 0 ? fts.slice(0, k) : rrfMerge(fts, vector, k);
  }

  // Observabilité RAG (P1) : un retrieval vide = génération SANS grounding KB.
  // On log seulement (flux et valeur de retour inchangés) pour rendre visible
  // la dégradation silencieuse (clé Voyage absente / KB non embeddée / FTS sec).
  if (chunks.length === 0) {
    console.warn(
      `[kb-client] retrieval vide — génération sans grounding KB pour query="${opts.query}" (mode=${mode}, locale=${opts.locale})`,
    );
  }

  return chunks;
}
