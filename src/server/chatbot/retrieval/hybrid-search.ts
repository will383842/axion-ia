// Retrieval hybride (T-06, doc 16 G-3) — pgvector cosine + FTS fr_unaccent, fusion RRF.
//
// Combine recherche vectorielle (sémantique, embedding Voyage) et FTS lexicale
// (tsv fr_unaccent), fusionnées par Reciprocal Rank Fusion (RRF). Filtre STRICT
// par tenant_id (R-TENANT) — un chunk d'un autre tenant n'est JAMAIS retourné.
// Toutes les requêtes sont paramétrées ($queryRaw) → pas d'injection SQL.

import { prisma } from "@/lib/prisma";
import { embedChatbotText } from "@/server/chatbot/embeddings";
import { RETRIEVAL_TOP_K } from "@/server/chatbot/constants";

export interface RetrievedChunk {
  readonly id: string;
  readonly sourceType: string;
  readonly sourceRef: string;
  readonly categorie: string;
  readonly contenu: string;
  readonly contexte: string | null;
  /** Score de fusion RRF (plus haut = plus pertinent). */
  readonly score: number;
}

interface RankedRow {
  id: string;
  source_type: string;
  source_ref: string;
  categorie: string;
  contenu: string;
  contexte: string | null;
}

/**
 * Reciprocal Rank Fusion : fusionne plusieurs listes classées. score(d) =
 * Σ 1/(k0 + rank_l(d)). Pur & déterministe. `k0` amortit les têtes de liste.
 */
export function reciprocalRankFusion<T extends { id: string }>(
  lists: ReadonlyArray<ReadonlyArray<T>>,
  opts: { k0?: number; topK?: number } = {},
): Array<{ item: T; score: number }> {
  const k0 = opts.k0 ?? 60;
  const scores = new Map<string, number>();
  const items = new Map<string, T>();
  for (const list of lists) {
    list.forEach((item, rank) => {
      items.set(item.id, item);
      scores.set(item.id, (scores.get(item.id) ?? 0) + 1 / (k0 + rank + 1));
    });
  }
  const fused = [...scores.entries()]
    .map(([id, score]) => ({ item: items.get(id)!, score }))
    .sort((a, b) => b.score - a.score);
  return opts.topK ? fused.slice(0, opts.topK) : fused;
}

/** Recherche vectorielle cosine (pgvector), filtrée tenant + actif. */
async function vectorSearch(
  tenantId: string,
  queryVec: readonly number[],
  topK: number,
): Promise<RankedRow[]> {
  const literal = `[${queryVec.join(",")}]`;
  return prisma.$queryRaw<RankedRow[]>`
    SELECT id, source_type, source_ref, categorie, contenu, contexte
    FROM "chat_kb_chunks"
    WHERE "tenant_id" = ${tenantId}::uuid AND "actif" = true AND "embedding" IS NOT NULL
    ORDER BY "embedding" <=> ${literal}::vector
    LIMIT ${topK}
  `;
}

/** Recherche FTS lexicale (tsv fr_unaccent), filtrée tenant + actif. */
async function ftsSearch(tenantId: string, query: string, topK: number): Promise<RankedRow[]> {
  return prisma.$queryRaw<RankedRow[]>`
    SELECT id, source_type, source_ref, categorie, contenu, contexte
    FROM "chat_kb_chunks", websearch_to_tsquery('fr_unaccent', ${query}) AS q
    WHERE "tenant_id" = ${tenantId}::uuid AND "actif" = true AND "tsv" @@ q
    ORDER BY ts_rank_cd("tsv", q) DESC
    LIMIT ${topK}
  `;
}

const toChunk = (r: RankedRow, score: number): RetrievedChunk => ({
  id: r.id,
  sourceType: r.source_type,
  sourceRef: r.source_ref,
  categorie: r.categorie,
  contenu: r.contenu,
  contexte: r.contexte,
  score,
});

/**
 * Recherche hybride : embed la question → cosine pgvector + FTS → fusion RRF →
 * top-k. Filtre tenant_id (R-TENANT). Si l'embedding échoue, repli FTS seul.
 */
export async function hybridSearch(
  tenantId: string,
  query: string,
  opts: { topK?: number } = {},
): Promise<RetrievedChunk[]> {
  const topK = opts.topK ?? RETRIEVAL_TOP_K;

  const fts = await ftsSearch(tenantId, query, topK);

  let vector: RankedRow[] = [];
  try {
    const embed = await embedChatbotText(query);
    // Si aucun provider réel (OpenAI/Voyage) n'est dispo, embedChatbotText délègue
    // au module partagé qui renvoie un STUB déterministe (hash)
    // au lieu de throw : un vecteur-requête factice comparé aux vrais embeddings
    // des chunks donne des voisins sémantiquement aberrants (pollution RRF). On
    // détecte le stub (modelVersion suffixée `-stub`) et on bascule en FTS-seul,
    // conformément à l'intention documentée « repli FTS seul si embeddings
    // indisponibles » — pas de faux vecteur dans le chemin runtime.
    if (embed.modelVersion.endsWith("-stub")) {
      console.warn("[chatbot:retrieval] embedding stub (VOYAGE_API_KEY absente) → repli FTS seul");
    } else {
      vector = await vectorSearch(tenantId, embed.embedding, topK);
    }
  } catch (err) {
    // Repli FTS seul si embeddings indisponibles (Voyage down / erreur HTTP).
    console.warn("[chatbot:retrieval] vector search indisponible, repli FTS:", err);
  }

  const fused = reciprocalRankFusion<RankedRow>([vector, fts], { topK });
  return fused.map(({ item, score }) => toChunk(item, score));
}
