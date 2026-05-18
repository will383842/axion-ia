/**
 * Topic Fingerprint — SimHash sémantique 64-bit pour dedup cross-entry.
 *
 * City Domination 2026-05-18 P1-6 (audit A7 P1).
 *
 * Pourquoi un fingerprint sémantique en plus de Levenshtein/MinHash texte ?
 *   - Levenshtein/MinHash détectent le PLAGIAT (texte ~identique mot-à-mot)
 *   - SimHash sémantique détecte la REDONDANCE THÉMATIQUE (même sujet, mots
 *     différents). Ex : 2 articles "Comment auditer son IA en PME" vs
 *     "Audit IA pour TPE/PME : guide pratique" → mots différents mais
 *     topic identique. Spam Brain HCU 2024-2026 pénalise.
 *
 * Stratégie :
 *   - Hash projection des embeddings Voyage AI (1024-dim float vector) en
 *     signature 64-bit SimHash via locality-sensitive hashing.
 *   - 2 fingerprints avec Hamming distance ≤ 8 → considérés topic-similaires
 *     (seuil empirique LSH 64-bit ≈ 12.5 % bits différents)
 *   - Cosine similarity équivalente : ~0.85 (boundary HCU thématique)
 *
 * État V1 (Sprint S+1) :
 *   - Function `computeTopicFingerprint(text)` STUBBED — retourne null tant
 *     que Voyage AI key non activée prod (cf A13 P0-12 KB pipeline)
 *   - Migration `topic_fingerprint` colonne ADD COLUMN livrée (P1-6 migration)
 *   - Helper Hamming distance prêt pour activation Sprint S+2 quand Voyage AI
 *     key fournie + worker embedding-fill-worker activé
 *
 * Activation Sprint S+2 :
 *   1. Voyage AI key prod injectée Coolify env (VOYAGE_API_KEY)
 *   2. computeTopicFingerprint() utilise Voyage embed-3-large 1024-dim
 *   3. similarity-monitor wire fingerprint comparison via hammingDistance()
 *   4. Threshold dedup : ≤ 8 = block, 9-12 = warn, > 12 = pass
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

/**
 * STUB V1 — retourne null tant que Voyage AI key prod non activée.
 *
 * Sprint S+2 implémentation cible :
 *   ```ts
 *   const embedding = await voyageAi.embed({ input: text, model: "embed-3-large" });
 *   // embedding.data[0].embedding = Float[1024]
 *   return projectEmbeddingToSimHash64(embedding.data[0].embedding);
 *   ```
 *
 * Fallback déterministe en attendant : si VOYAGE_AI_FINGERPRINT_FALLBACK=true
 * dans l'env, retourne un fingerprint pseudo-aléatoire dérivé du SHA-256 du
 * texte. Permet de tester le pipeline dedup côté infrastructure sans clé API
 * (utile dev + tests d'intégration). Ne PAS activer en prod — risque faux
 * positifs car le SHA-256 ne capture pas la sémantique (juste le texte exact).
 */
export async function computeTopicFingerprint(text: string): Promise<string | null> {
  const hasVoyageKey = !!process.env["VOYAGE_API_KEY"];
  if (hasVoyageKey) {
    // TODO Sprint S+2 — implémentation Voyage AI embed + SimHash projection.
    // Retourner null pour l'instant force le caller à fail-soft (pas de bloc
    // dedup tant que pipeline complet pas testé bout-en-bout).
    return null;
  }
  if (process.env["VOYAGE_AI_FINGERPRINT_FALLBACK"] === "true") {
    // Fallback déterministe — SHA-256 → 16 premiers hex chars. NE PAS UTILISER
    // EN PROD (fingerprint ne capture pas la sémantique).
    const hash = createHash("sha256").update(text.trim().toLowerCase()).digest("hex");
    return hash.slice(0, 16);
  }
  return null;
}

/** Seuils Hamming distance pour dedup décisions. */
export const TOPIC_FINGERPRINT_THRESHOLDS = {
  /** ≤ 8 bits différents = topic redondant, bloquer republication. */
  BLOCK: 8,
  /** 9-12 bits = warn review-queue. */
  WARN: 12,
} as const;
