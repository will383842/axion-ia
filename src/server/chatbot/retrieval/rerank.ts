// Reranking Voyage AI + repli sans rerank (T-10 / précise T-41).
//
// Après la fusion hybride RRF (pgvector + FTS), on re-classe les ~20 candidats
// par pertinence sémantique fine via le cross-encoder Voyage `rerank-2-lite`,
// puis on garde le top-N injecté au prompt. Le rerank améliore nettement la
// précision du top-5 sur les questions catalogue/explication fines (le RRF seul
// mélange deux signaux lexicaux/vectoriels grossiers).
//
// ROBUSTESSE (cœur de T-10) : le rerank est un AGRÉMENT, jamais un point de
// panne. Toute indisponibilité (clé absente, 401/429/503, timeout, réponse
// malformée) → **repli silencieux sur l'ordre RRF** tronqué à top-N. Le chatbot
// répond toujours, même Voyage down (cf. vérif 2026-06-04 : VOYAGE_API_KEY 401
// en local → repli FTS + ici repli RRF, aucun crash).

import type { RetrievedChunk } from "@/server/chatbot/retrieval/hybrid-search";
import { RERANK_TOP_N } from "@/server/chatbot/constants";

const VOYAGE_RERANK_URL = "https://api.voyageai.com/v1/rerank";
/** Cross-encoder de rerank Voyage (léger, bon coût/perf). */
export const RERANK_MODEL_NAME = "rerank-2-lite" as const;
/** Budget temps du rerank : au-delà, on replie (ne pas bloquer la latence perçue). */
const RERANK_TIMEOUT_MS = 2500;

interface VoyageRerankResult {
  index: number;
  relevance_score: number;
}

/**
 * Re-classe `chunks` par pertinence vis-à-vis de `query` (Voyage), retourne le
 * top-N. En cas d'échec/indisponibilité → ordre RRF d'origine tronqué à top-N.
 */
export async function rerankChunks(
  query: string,
  chunks: ReadonlyArray<RetrievedChunk>,
  opts: { topN?: number; signal?: AbortSignal } = {},
): Promise<RetrievedChunk[]> {
  const topN = opts.topN ?? RERANK_TOP_N;
  const fallback = (): RetrievedChunk[] => chunks.slice(0, topN);

  // Rien à re-classer.
  if (chunks.length <= 1) return chunks.slice(0, topN);

  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) return fallback(); // dev/test sans coût API → ordre RRF conservé.

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RERANK_TIMEOUT_MS);
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort();
    else opts.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    const res = await fetch(VOYAGE_RERANK_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        documents: chunks.map((c) => c.contenu),
        model: RERANK_MODEL_NAME,
        top_k: topN,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.warn(`[chatbot:rerank] Voyage HTTP ${res.status} → repli RRF`);
      return fallback();
    }

    const json = (await res.json()) as { data?: VoyageRerankResult[] };
    const results = json.data;
    if (!Array.isArray(results) || results.length === 0) return fallback();

    // Tri défensif par score décroissant (Voyage renvoie déjà trié), mapping
    // index → chunk, filtrage des index hors borne, troncature top-N.
    const ranked = [...results]
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .map((r) => chunks[r.index])
      .filter((c): c is RetrievedChunk => c !== undefined)
      .slice(0, topN);

    // Si le mapping a tout perdu (réponse incohérente) → repli sûr.
    return ranked.length > 0 ? ranked : fallback();
  } catch (err) {
    // Timeout (abort) ou erreur réseau → repli RRF.
    console.warn("[chatbot:rerank] indisponible, repli RRF:", err);
    return fallback();
  } finally {
    clearTimeout(timer);
  }
}
