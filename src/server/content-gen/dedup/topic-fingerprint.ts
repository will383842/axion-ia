/**
 * Topic Fingerprint — SimHash sémantique 64-bit pour dedup cross-entry.
 *
 * City Domination 2026-05-18 P1-6 (audit A7 P1). Activé 2026-06-14.
 *
 * Pourquoi un fingerprint sémantique en plus de Levenshtein/MinHash texte ?
 *   - Levenshtein/MinHash détectent le PLAGIAT (texte ~identique mot-à-mot)
 *   - SimHash sémantique détecte la REDONDANCE THÉMATIQUE (même sujet, mots
 *     différents). Ex : 2 articles "Comment auditer son IA en PME" vs
 *     "Audit IA pour TPE/PME : guide pratique" → mots différents mais
 *     topic identique. Spam Brain HCU 2024-2026 pénalise. Utile aussi pour le
 *     cross-flux RSS : 2 sources couvrant le MÊME événement, rédigées
 *     différemment (donc passant le plagiat lexical Jaccard).
 *
 * Stratégie :
 *   - Embeddings Voyage AI (1024-dim) → signature 64-bit via random-projection
 *     SimHash (Charikar) : 64 hyperplans Rademacher ±1 déterministes (seedés),
 *     bit i = signe(produit scalaire embedding · hyperplan_i).
 *   - 2 fingerprints avec Hamming distance ≤ 8 → topic-similaires
 *     (seuil empirique LSH 64-bit ≈ 12,5 % bits différents ≈ cosine ~0.85).
 *
 * Fail-soft : si pas de clé Voyage (embedding "-stub") ou erreur réseau →
 * retourne null → le caller ne bloque PAS (pas de dedup sémantique sans
 * embeddings réels). Aucune régression quand Voyage est indisponible.
 */

import { createHash } from "node:crypto";

/**
 * Compute Hamming distance entre 2 fingerprints hex 64-bit.
 * Retourne -1 si format invalide. Inférieur = plus similaire.
 */
export function hammingDistance(fp1: string, fp2: string): number {
  if (fp1.length !== 16 || fp2.length !== 16) return -1;
  if (!/^[0-9a-fA-F]+$/.test(fp1) || !/^[0-9a-fA-F]+$/.test(fp2)) return -1;
  let distance = 0;
  for (let i = 0; i < 16; i++) {
    const c1 = parseInt(fp1[i]!, 16);
    const c2 = parseInt(fp2[i]!, 16);
    let xor = c1 ^ c2;
    while (xor) {
      distance += xor & 1;
      xor >>= 1;
    }
  }
  return distance;
}

/** PRNG déterministe (mulberry32) — pas de Math.random (reproductible cross-process). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Projette un embedding dense (1024-dim) en signature SimHash 64-bit (16 hex).
 * 64 hyperplans Rademacher ±1 déterministes (seed fixe par bit) → reproductible.
 */
function projectEmbeddingToSimHash64(embedding: readonly number[]): string {
  const dim = embedding.length;
  let bits = 0n;
  for (let i = 0; i < 64; i++) {
    const rng = mulberry32((0x9e3779b9 ^ (i * 0x85ebca6b)) >>> 0);
    let dot = 0;
    for (let d = 0; d < dim; d++) {
      dot += (rng() < 0.5 ? -1 : 1) * (embedding[d] ?? 0);
    }
    if (dot >= 0) bits |= 1n << BigInt(i);
  }
  return bits.toString(16).padStart(16, "0");
}

/**
 * Fingerprint sémantique 64-bit (hex) d'un texte via embedding Voyage + SimHash.
 *
 * - Clé Voyage présente + embedding réel → SimHash sémantique.
 * - Embedding "-stub" (pas de clé) → null (pas de sémantique → pas de dedup).
 * - `VOYAGE_AI_FINGERPRINT_FALLBACK=true` (dev/test) → SHA-256 déterministe
 *   (NE PAS utiliser en prod : ne capture pas la sémantique).
 * - Erreur réseau / Voyage down → null (fail-soft, pas de blocage dedup).
 */
export async function computeTopicFingerprint(text: string): Promise<string | null> {
  if (process.env["VOYAGE_AI_FINGERPRINT_FALLBACK"] === "true") {
    const hash = createHash("sha256").update(text.trim().toLowerCase()).digest("hex");
    return hash.slice(0, 16);
  }
  try {
    const { generateEmbedding } = await import("@/lib/knowledge/embeddings");
    const emb = await generateEmbedding(text);
    // Embedding stub (sans VOYAGE_API_KEY) = non sémantique → pas de fingerprint.
    if (emb.modelVersion.endsWith("-stub")) return null;
    if (!emb.embedding || emb.embedding.length === 0) return null;
    return projectEmbeddingToSimHash64(emb.embedding);
  } catch {
    return null;
  }
}

/** Seuils Hamming distance pour dedup décisions. */
export const TOPIC_FINGERPRINT_THRESHOLDS = {
  /** ≤ 8 bits différents = topic redondant, bloquer republication. */
  BLOCK: 8,
  /** 9-12 bits = warn review-queue. */
  WARN: 12,
} as const;

export type TopicDuplicateVerdict = "duplicate" | "similar" | "ok";

/**
 * Compare un fingerprint à un corpus de fingerprints existants et retourne le
 * verdict + la distance minimale + le fingerprint le plus proche.
 * `duplicate` (≤ BLOCK) → bloquer ; `similar` (≤ WARN) → review ; `ok` sinon.
 */
export function classifyTopicDuplicate(
  fingerprint: string,
  corpus: ReadonlyArray<string>,
): { verdict: TopicDuplicateVerdict; minDistance: number; nearest: string | null } {
  let minDistance = Number.POSITIVE_INFINITY;
  let nearest: string | null = null;
  for (const other of corpus) {
    const d = hammingDistance(fingerprint, other);
    if (d < 0) continue; // format invalide → ignore
    if (d < minDistance) {
      minDistance = d;
      nearest = other;
    }
  }
  if (nearest === null) return { verdict: "ok", minDistance: -1, nearest: null };
  const verdict: TopicDuplicateVerdict =
    minDistance <= TOPIC_FINGERPRINT_THRESHOLDS.BLOCK
      ? "duplicate"
      : minDistance <= TOPIC_FINGERPRINT_THRESHOLDS.WARN
        ? "similar"
        : "ok";
  return { verdict, minDistance, nearest };
}

/**
 * Similarité en % (0-100) dérivée de la distance de Hamming 64-bit, pour un
 * affichage lisible (« 92 % de similarité ») à la place du « Hamming 6 »
 * technique. 0 bits différents = 100 % ; 64 = 0 %. Borne à [0, 100].
 */
export function hammingToSimilarityPct(distance: number): number {
  if (distance < 0) return 0;
  const pct = Math.round((1 - distance / 64) * 100);
  return Math.max(0, Math.min(100, pct));
}

/**
 * Variante de `classifyTopicDuplicate` qui CONSERVE la source du plus proche
 * (n'importe quel objet porteur d'un `fingerprint`) — permet de logguer « bloqué
 * car trop proche de l'article X » au lieu d'une simple distance anonyme.
 *
 * Générique sur le type de corpus : l'appelant passe p.ex. `{ fingerprint, id }`
 * et récupère l'item le plus proche pour résoudre ensuite son titre/slug.
 */
export function classifyTopicDuplicateWithSource<T extends { fingerprint: string }>(
  fingerprint: string,
  corpus: ReadonlyArray<T>,
): { verdict: TopicDuplicateVerdict; minDistance: number; nearest: T | null } {
  let minDistance = Number.POSITIVE_INFINITY;
  let nearest: T | null = null;
  for (const item of corpus) {
    const d = hammingDistance(fingerprint, item.fingerprint);
    if (d < 0) continue; // format invalide → ignore
    if (d < minDistance) {
      minDistance = d;
      nearest = item;
    }
  }
  if (nearest === null) return { verdict: "ok", minDistance: -1, nearest: null };
  const verdict: TopicDuplicateVerdict =
    minDistance <= TOPIC_FINGERPRINT_THRESHOLDS.BLOCK
      ? "duplicate"
      : minDistance <= TOPIC_FINGERPRINT_THRESHOLDS.WARN
        ? "similar"
        : "ok";
  return { verdict, minDistance, nearest };
}
