/**
 * Linguistic Diversity Checker — Phase G Sprint Perfection 2026.
 *
 * Analyse purement TypeScript (0 dépendances externes) :
 *  - TTR  : Type-Token Ratio = mots uniques / mots totaux  (cible > 0.65)
 *  - Std dev longueur phrases : diversité structurelle      (cible > 4)
 *  - Ratio voix passive FR   : heuristique morphologique   (cible < 0.25)
 *
 * Utilisé par llm-judge.ts comme 8e dimension `linguisticDiversity` (~10 %).
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DiversityScore {
  /** Type-Token Ratio (0-1). Cible > 0.65. */
  readonly ttr: number;
  /** Longueur moyenne des phrases (mots). */
  readonly avgSentenceLength: number;
  /** Écart-type de la longueur des phrases. Cible > 4. */
  readonly stdSentenceLength: number;
  /** Ratio de phrases à voix passive FR. Cible < 0.25. */
  readonly passiveVoiceRatio: number;
  /** true si tous les seuils sont respectés. */
  readonly passed: boolean;
  /** Liste lisible des vérifications échouées. */
  readonly warnings: string[];
}

// ── Seuils ────────────────────────────────────────────────────────────────────

const TTR_MIN = 0.65;
const STD_SENTENCE_MIN = 4;
const PASSIVE_MAX = 0.25;

// ── Regex passive voice FR ────────────────────────────────────────────────────

/**
 * Patterns de voix passive française :
 *   - auxiliaire être conjugué (est, sont, était, étaient, a été, ont été…)
 *   - suivi (dans la même phrase) d'un participe passé FR terminant par é/ée/és/ées
 *
 * Note : `\w` JavaScript ne couvre pas les caractères accentués.
 *   On utilise une classe de caractères Unicode explicite pour les participes passés.
 *
 * Approche heuristique — quelques faux positifs acceptables.
 */
// Note : \b en JavaScript ne reconnaît pas les caractères accentués (code > 127).
// Conséquence : \bété\b échoue car 'é' n'est pas dans \w.
// On teste donc l'auxiliaire sans \b terminal, puis le participe passé directement.
const FR_PASSIVE_PATTERN =
  /(?:\best\b|\bsont\b|\bétait\b|\bétaient\b|(?:a|ont|avait|avaient)\s+été)\s+[a-zàâäéèêëîïôùûüÿæœç]{2,}é(?:e|s|es)?(?:\W|$)/i;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Supprime les balises HTML. */
function stripHtml(input: string): string {
  return input.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ");
}

/**
 * Découpe le texte en phrases sur `.`, `!`, `?`, `;`.
 * Filtre les fragments vides ou trop courts (< 2 caractères).
 */
function splitSentences(text: string): string[] {
  return text
    .split(/[.!?;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
}

/**
 * Tokenise en mots : minuscules, retire la ponctuation.
 * Ignore les tokens vides.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-zàâäéèêëîïôùûüÿæœç0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

// ── Analyse principale ────────────────────────────────────────────────────────

/**
 * Analyse la diversité linguistique d'un texte (HTML ou plain-text).
 *
 * Gestion robuste :
 *  - Texte vide ou trop court → retourne des valeurs par défaut (passed=true,
 *    pas de warnings) pour éviter les faux positifs sur les articles embryonnaires.
 *  - Jamais de throw — toujours un résultat utilisable.
 */
export function analyzeDiversity(text: string): DiversityScore {
  // ── Nettoyage ──────────────────────────────────────────────────────────────
  const clean = stripHtml(text).trim();

  // Texte vide ou minuscule → defaults sûrs.
  if (clean.length < 20) {
    return {
      ttr: 1,
      avgSentenceLength: 10,
      stdSentenceLength: 5,
      passiveVoiceRatio: 0,
      passed: true,
      warnings: [],
    };
  }

  // ── TTR ────────────────────────────────────────────────────────────────────
  const allTokens = tokenize(clean);
  const totalWords = allTokens.length;
  const uniqueWords = totalWords > 0 ? new Set(allTokens).size : 0;
  const ttr = totalWords > 0 ? uniqueWords / totalWords : 1;

  // ── Longueur des phrases ───────────────────────────────────────────────────
  const sentences = splitSentences(clean);
  const sentenceLengths = sentences.map((s) => tokenize(s).length).filter((l) => l > 0);
  const avgSentenceLength = mean(sentenceLengths);
  const stdSentenceLength = stdDev(sentenceLengths);

  // ── Voix passive ──────────────────────────────────────────────────────────
  const passiveCount = sentences.filter((s) => FR_PASSIVE_PATTERN.test(s)).length;
  const passiveVoiceRatio = sentences.length > 0 ? passiveCount / sentences.length : 0;

  // ── Verdict + warnings ────────────────────────────────────────────────────
  const warnings: string[] = [];

  if (ttr < TTR_MIN) {
    warnings.push(
      `TTR trop bas (${ttr.toFixed(2)} < ${TTR_MIN}) — vocabulaire trop répétitif. Diversifier le lexique.`,
    );
  }

  if (stdSentenceLength < STD_SENTENCE_MIN) {
    warnings.push(
      `Longueur des phrases trop uniforme (std=${stdSentenceLength.toFixed(1)} < ${STD_SENTENCE_MIN}) — alterner phrases courtes et longues.`,
    );
  }

  if (passiveVoiceRatio > PASSIVE_MAX) {
    warnings.push(
      `Trop de voix passive (${(passiveVoiceRatio * 100).toFixed(0)}% > ${PASSIVE_MAX * 100}%) — reformuler en voix active.`,
    );
  }

  const passed = warnings.length === 0;

  return {
    ttr: Math.round(ttr * 1000) / 1000,
    avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
    stdSentenceLength: Math.round(stdSentenceLength * 10) / 10,
    passiveVoiceRatio: Math.round(passiveVoiceRatio * 1000) / 1000,
    passed,
    warnings,
  };
}
