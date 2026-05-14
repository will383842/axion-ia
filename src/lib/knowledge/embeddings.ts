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

/**
 * Génère un embedding pour un texte.
 * V1 : implémentation stub (retourne vecteur déterministe pseudo-aléatoire) car
 * le wiring Voyage AI nécessite clé API env `VOYAGE_API_KEY` + node-fetch.
 * Sprint KB-13 V4 cablera l'appel réel quand Will fournira la clé.
 *
 * Le stub permet de :
 * - tester le pipeline de bout en bout (dedup, queue, audit log)
 * - dev locale sans coûts API
 * - définir le contrat I/O propre
 *
 * Production : remplacer le body de cette fonction par un appel Voyage AI réel.
 */
export async function generateEmbedding(
  text: string,
  confidentiality: KbConfidentiality = "public",
): Promise<EmbeddingResult> {
  // Refus dur (Agent 10 §10.5 + Agent 9 §9.10 audit Phase A V3).
  if (!isExternalApiAllowed(confidentiality)) {
    throw new EmbeddingConfidentialityRefusal(confidentiality);
  }

  // V1 stub déterministe : hash sha-256 → vecteur normalisé.
  // Permet dedup tests (textes identiques = mêmes vecteurs).
  const crypto = await import("node:crypto");
  const hash = crypto.createHash("sha256").update(text).digest();
  const embedding: number[] = [];
  for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
    const byteIndex = i % 32;
    const byteValue = hash[byteIndex] ?? 0;
    const seed = (byteValue + i * 7) % 256;
    embedding.push((seed - 128) / 128); // [-1, 1]
  }

  // Normaliser L2 pour cosine similarity stable
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
