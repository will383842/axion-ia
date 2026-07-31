/**
 * Content Generator — Readability score (Flesch-Kincaid adapté FR).
 *
 * Sprint 1 Day 3 AGT-E (§ 10 master prompt).
 *
 * Score 0-100 : > 70 = facile, 60-70 = idéal Axion-IA B2B, 40-60 = standard,
 * < 40 = difficile. Formule adaptée FR (Kandel & Moles 1958) :
 *   FRE_FR = 207 − 1.015 × (mots/phrases) − 73.6 × (syllabes/mots)
 */

/**
 * Compte les syllabes d'un mot français (heuristic — pas un algo phonologique complet).
 * Règles simples : compte les voyelles + diphthongs, soustrait les `e` muets finaux.
 */
function countSyllablesFr(word: string): number {
  if (!word) return 0;
  let w = word.toLowerCase();
  // Remove final silent "e"
  w = w.replace(/e$/, "");
  // Count vowel groups (consider "ai", "ou", "oi", etc. as 1 vowel group)
  const vowelGroups = w.match(/[aeiouyàâäéèêëïîôöùûüœ]+/g);
  return vowelGroups ? vowelGroups.length : 1;
}

export interface ReadabilityResult {
  readonly score: number;
  readonly wordCount: number;
  readonly sentenceCount: number;
  readonly avgWordsPerSentence: number;
  readonly avgSyllablesPerWord: number;
  readonly level:
    "très-facile" | "facile" | "idéal-b2b" | "standard" | "difficile" | "très-difficile";
}

function levelFromScore(score: number): ReadabilityResult["level"] {
  if (score >= 90) return "très-facile";
  if (score >= 70) return "facile";
  if (score >= 60) return "idéal-b2b";
  if (score >= 50) return "standard";
  if (score >= 30) return "difficile";
  return "très-difficile";
}

/**
 * Convertit un score Flesch brut en « fitness » de lisibilité pour la notation
 * qualité (round 2 2026-06-18). Le contenu IA B2B est dense par nature ; une
 * lisibilité « difficile/standard » (30-60) est APPROPRIÉE pour la cible
 * (dirigeants/experts). On ne récompense donc plus « plus simple = mieux »
 * (anti-dilution) : pleine valeur dès la bande professionnelle (≥60), créditée
 * généreusement de 30 à 60, dégradée seulement quand c'est vraiment illisible
 * (<30). Borne [0,100].
 */
export function readabilityFitScore(rawScore: number): number {
  const s = Math.max(0, Math.min(100, rawScore));
  if (s >= 60) return 100;
  if (s >= 30) return Math.round(70 + (s - 30));
  return Math.round(s * 2.33);
}

export function computeReadabilityFr(text: string): ReadabilityResult {
  // Phrases : split sur .!?
  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // Mots : split sur whitespace après removal punctuation
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);

  const wordCount = words.length;
  const sentenceCount = Math.max(sentences.length, 1);
  const syllableCount = words.reduce((acc, w) => acc + countSyllablesFr(w), 0);

  const avgWordsPerSentence = wordCount / sentenceCount;
  const avgSyllablesPerWord = wordCount > 0 ? syllableCount / wordCount : 0;

  // Formula Kandel-Moles FR
  const rawScore = 207 - 1.015 * avgWordsPerSentence - 73.6 * avgSyllablesPerWord;
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));

  return {
    score,
    wordCount,
    sentenceCount,
    avgWordsPerSentence: Number(avgWordsPerSentence.toFixed(2)),
    avgSyllablesPerWord: Number(avgSyllablesPerWord.toFixed(2)),
    level: levelFromScore(score),
  };
}
