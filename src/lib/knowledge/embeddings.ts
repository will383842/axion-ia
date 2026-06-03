/**
 * KB V4 — Wrapper embeddings pour dedup factory + recherche hybride.
 *
 * Provider default V4 (§17.6 prompt master) : **Voyage AI `voyage-3-lite`**
 * (1024 dim, $0.02/1M tokens, best cost/perf ratio).
 *
 * Refus dur (cf. confidentialités) : NE PAS envoyer à API externe les entries
 * `confidentiality IN ('confidential', 'secret')`.
 *
 * Prompt caching obligatoire (skill `claude-api` doctrine) sur LLM calls
 * adjacents — pour embeddings, le caching est géré côté provider.
 */

import type { KbConfidentiality } from "../../../prisma/generated/client";
import { isExternalApiAllowed } from "@/content/knowledge/confidentialities";

/**
 * Modèle embedding actif V1 V4.
 * Pour bascule : update `EMBEDDING_MODEL_NAME` + dimension table + reindex.
 */
export const EMBEDDING_MODEL_NAME = "voyage-3-lite" as const;
export const EMBEDDING_MODEL_VERSION = "2026-05" as const;
export const EMBEDDING_DIMENSION = 1024 as const;

export interface EmbeddingResult {
  readonly embedding: readonly number[];
  readonly model: string;
  readonly modelVersion: string;
  readonly dimensionality: number;
  readonly tokensUsed: number;
}

export class EmbeddingConfidentialityRefusal extends Error {
  constructor(public readonly confidentiality: KbConfidentiality) {
    super(
      `Refus dur : confidentialité '${confidentiality}' ne peut pas être envoyée à API externe (factory dedup).`,
    );
    this.name = "EmbeddingConfidentialityRefusal";
  }
}

/** Endpoint Voyage AI embeddings (T-04). */
const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";

/**
 * Stub déterministe (hash sha-256 → vecteur L2-normalisé). Utilisé quand
 * `VOYAGE_API_KEY` est absente (dev/test sans coût API) ; garde le dedup testable
 * (textes identiques = mêmes vecteurs).
 */
async function stubEmbedding(text: string): Promise<EmbeddingResult> {
  const crypto = await import("node:crypto");
  const hash = crypto.createHash("sha256").update(text).digest();
  const embedding: number[] = [];
  for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
    const byteIndex = i % 32;
    const byteValue = hash[byteIndex] ?? 0;
    const seed = (byteValue + i * 7) % 256;
    embedding.push((seed - 128) / 128); // [-1, 1]
  }
  const norm = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0)) || 1;
  const normalized = embedding.map((v) => v / norm);
  return {
    embedding: normalized,
    model: EMBEDDING_MODEL_NAME,
    modelVersion: `${EMBEDDING_MODEL_VERSION}-stub`,
    dimensionality: EMBEDDING_DIMENSION,
    tokensUsed: Math.ceil(text.length / 4),
  };
}

/**
 * Appel réel Voyage AI `voyage-3-lite` (1024-dim). Lève en cas d'erreur HTTP ou
 * de dimension inattendue (pas de fallback dimension-incompatible : OpenAI = 1536
 * ≠ 1024 → poisonnerait l'index vector(1024) ; le worker BullMQ retente).
 */
async function embedWithVoyage(text: string, apiKey: string): Promise<EmbeddingResult> {
  const res = await fetch(VOYAGE_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: [text],
      model: EMBEDDING_MODEL_NAME,
      input_type: "document",
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`[embeddings] Voyage HTTP ${res.status} ${res.statusText} ${detail}`.trim());
  }
  const json = (await res.json()) as {
    data?: Array<{ embedding?: number[] }>;
    usage?: { total_tokens?: number };
  };
  const embedding = json.data?.[0]?.embedding;
  if (!embedding || embedding.length !== EMBEDDING_DIMENSION) {
    throw new Error(
      `[embeddings] Voyage dimension inattendue : ${embedding?.length ?? "absent"} (attendu ${EMBEDDING_DIMENSION})`,
    );
  }
  return {
    embedding,
    model: EMBEDDING_MODEL_NAME,
    modelVersion: EMBEDDING_MODEL_VERSION,
    dimensionality: EMBEDDING_DIMENSION,
    tokensUsed: json.usage?.total_tokens ?? Math.ceil(text.length / 4),
  };
}

/**
 * Génère un embedding 1024-dim pour un texte (KB dedup + RAG chatbot).
 *
 * - `VOYAGE_API_KEY` présente → appel réel `voyage-3-lite` (T-04) ;
 * - sinon → stub déterministe (dev/test sans clé → KB tests inchangés).
 *
 * Refus dur : ne JAMAIS envoyer une entrée `confidential`/`secret` à l'API externe.
 */
export async function generateEmbedding(
  text: string,
  confidentiality: KbConfidentiality = "public",
): Promise<EmbeddingResult> {
  // Refus dur (Agent 10 §10.5 + Agent 9 §9.10 audit Phase A V3) — AVANT tout appel réseau.
  if (!isExternalApiAllowed(confidentiality)) {
    throw new EmbeddingConfidentialityRefusal(confidentiality);
  }

  const apiKey = process.env.VOYAGE_API_KEY;
  if (apiKey) {
    return embedWithVoyage(text, apiKey);
  }
  return stubEmbedding(text);
}

/**
 * Calcule la similarité cosine entre 2 vecteurs (assumés L2-normalisés).
 * Pour vecteurs non normalisés : retourne le produit scalaire / (norm1 * norm2).
 */
export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length) {
    throw new Error(`cosineSimilarity : dimension mismatch ${a.length} vs ${b.length}`);
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB) || 1;
  return dot / denom;
}

/**
 * Prépare le texte à embedder depuis title + excerpt + 500 premiers mots body.
 * Cf. §17.3 prompt master.
 */
export function buildEmbeddingInput(input: {
  readonly title: string;
  readonly excerpt?: string | null;
  readonly bodyText?: string | null;
}): string {
  const parts: string[] = [input.title];
  if (input.excerpt) parts.push(input.excerpt);
  if (input.bodyText) {
    const words = input.bodyText.split(/\s+/).slice(0, 500);
    parts.push(words.join(" "));
  }
  return parts.join("\n\n");
}
