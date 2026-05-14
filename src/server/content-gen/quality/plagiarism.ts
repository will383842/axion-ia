/**
 * Content Generator — Plagiarism detection via shingling 5-gram + Jaccard similarity.
 *
 * Sprint 1 Day 3 AGT-E (§ 10.1 master prompt).
 *
 * 2 seuils :
 * - Interne (vs corpus contenus déjà publiés) : Jaccard ≥ 0.30 → re-write section divergente
 * - RSS (vs source originale) : Jaccard ≥ 0.10 → re-write strict obligatoire
 *
 * Pour V1, l'algo est déterministe (no ML). V2 ajoutera embeddings cosine.
 */

const SHINGLE_SIZE = 5;

/**
 * Génère les shingles (séquences de N mots consécutifs) d'un texte.
 * Normalisation : lowercase + remove punctuation + collapse whitespace.
 */
export function shingles(text: string, size: number = SHINGLE_SIZE): Set<string> {
  const normalized = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = normalized.split(" ").filter((w) => w.length > 0);
  const set = new Set<string>();
  if (words.length < size) return set;
  for (let i = 0; i <= words.length - size; i++) {
    set.add(words.slice(i, i + size).join(" "));
  }
  return set;
}

/**
 * Calcule la similarité Jaccard entre 2 textes (intersection / union des shingles).
 * Retourne [0, 1].
 */
export function jaccardSimilarity(textA: string, textB: string): number {
  const setA = shingles(textA);
  const setB = shingles(textB);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const s of setA) {
    if (setB.has(s)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export interface PlagiarismCheckResult {
  readonly maxSimilarity: number;
  readonly topMatches: ReadonlyArray<{ corpusId: string; similarity: number }>;
  readonly passed: boolean;
  readonly threshold: number;
}

/**
 * Vérifie un contenu vs un corpus (autres contenus existants).
 * Retourne max similarity + top 5 matches + flag passed selon seuil.
 *
 * @param content Texte à vérifier
 * @param corpus Map slug → texte du corpus de référence
 * @param threshold Seuil bloquant Jaccard (default 0.30 interne, 0.10 RSS)
 */
export function checkPlagiarism(
  content: string,
  corpus: ReadonlyMap<string, string>,
  threshold: number = 0.3,
): PlagiarismCheckResult {
  const matches: Array<{ corpusId: string; similarity: number }> = [];
  for (const [id, text] of corpus) {
    const sim = jaccardSimilarity(content, text);
    if (sim > 0) matches.push({ corpusId: id, similarity: sim });
  }
  matches.sort((a, b) => b.similarity - a.similarity);
  const top5 = matches.slice(0, 5);
  const maxSim = top5[0]?.similarity ?? 0;
  return {
    maxSimilarity: maxSim,
    topMatches: top5,
    passed: maxSim < threshold,
    threshold,
  };
}
