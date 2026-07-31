/**
 * KB V4 (Sprint KB-16) — Score de lisibilité simplifié FR.
 *
 * Formule Flesch adapt. FR (Kandel/Moles 1958) :
 *   score = 207 - 1.015 × (mots / phrases) - 73.6 × (syllabes / mots)
 *
 * Interprétation :
 *   90-100 : très facile (CM1)
 *   60-70  : standard (collège — cible KB)
 *   30-50  : difficile (lycée / supérieur)
 *   < 30   : très difficile (académique)
 *
 * V1 : estimation syllabes via comptage des voyelles consécutives.
 *      Imparfaite (« voiture » = 3 syl. mais formule en compte 2) mais
 *      suffisante pour scoring relatif.
 *
 * Utilisé pour `KnowledgeTranslation.readabilityScore`.
 */

const VOWELS_FR = "aeiouyéèêëàâäîïôöûü";

function countSyllables(word: string): number {
  if (!word) return 0;
  const lower = word.toLowerCase();
  let count = 0;
  let prevVowel = false;
  for (const ch of lower) {
    const isVowel = VOWELS_FR.includes(ch);
    if (isVowel && !prevVowel) count += 1;
    prevVowel = isVowel;
  }
  // Mot d'au moins 1 lettre → minimum 1 syllabe
  return Math.max(1, count);
}

export interface ReadabilityResult {
  readonly score: number; // arrondi à 0.1
  readonly grade:
    "very_easy" | "easy" | "standard" | "fairly_difficult" | "difficult" | "very_difficult";
  readonly wordCount: number;
  readonly sentenceCount: number;
  readonly syllableCount: number;
}

/**
 * Calcule le score Flesch FR depuis un plain text (déjà stripé du HTML).
 * Retourne null si texte trop court (< 30 mots) pour être statistiquement fiable.
 */
export function computeReadability(plainText: string): ReadabilityResult | null {
  if (!plainText || plainText.trim().length === 0) return null;

  const normalized = plainText.replace(/\s+/g, " ").trim();
  const sentences = normalized
    .split(/[.!?]+\s/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const words = normalized
    .split(/\s+/u)
    .map((w) => w.replace(/[^a-zA-Zéèêëàâäîïôöûüçÿœæ-]/g, ""))
    .filter((w) => w.length > 0);

  if (words.length < 30) return null;

  const wordCount = words.length;
  const sentenceCount = Math.max(1, sentences.length);
  const syllableCount = words.reduce((acc, w) => acc + countSyllables(w), 0);

  const wordsPerSentence = wordCount / sentenceCount;
  const syllablesPerWord = syllableCount / wordCount;

  const raw = 207 - 1.015 * wordsPerSentence - 73.6 * syllablesPerWord;
  const score = Math.round(Math.max(0, Math.min(100, raw)) * 10) / 10;

  const grade = scoreToGrade(score);
  return { score, grade, wordCount, sentenceCount, syllableCount };
}

function scoreToGrade(score: number): ReadabilityResult["grade"] {
  if (score >= 90) return "very_easy";
  if (score >= 80) return "easy";
  if (score >= 60) return "standard";
  if (score >= 50) return "fairly_difficult";
  if (score >= 30) return "difficult";
  return "very_difficult";
}
