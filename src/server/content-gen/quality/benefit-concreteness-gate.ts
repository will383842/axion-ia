/**
 * Content Generator — Gate « bénéfice concret » (PH2, plan §4 / pack 03 réécrit).
 *
 * Vérifie qu'un contenu COMMERCIAL parle au CLIENT (bénéfice chiffré, scénario
 * avant/après) et pas au dev (jargon creux). Porté NATIVEMENT depuis le pack v2
 * `03-benefit-concreteness-gate.ts`, MAIS :
 *   - ❌ PAS de `new Anthropic()` (le pack court-circuitait cost-tracker + kill-switch).
 *     Le juge LLM (optionnel, via provider-router cost-tracké) est le périmètre PH3 ;
 *     PH2 = checks REGEX déterministes, purs, sans appel réseau.
 *   - Profil-gated COMMERCIAL-only (cf. quality-profile-table.ts) : le corpus
 *     informationnel/AEO n'est JAMAIS soumis à ce gate (sinon désindexation).
 *   - Liste anti-fluff DISTINCTE de la doctrine `banned-phrases` (concept différent :
 *     marketing creux vs marque/SIREN). À migrer en config DB ultérieurement.
 *
 * Fonction pure : 0 I/O, 100 % testable. Le worker décide du blocage (flags +
 * profil + seuil) ; ce module ne fait que SCORER.
 */

/** Chiffres concrets (pas juste « 100% »/« 1er »). Source : pack 03. */
const CONCRETE_NUMBER_PATTERNS: readonly RegExp[] = [
  /\d+\s*%\s*(de\s+)?gain/i,
  /\d+\s*%\s*(de\s+)?(réduction|baisse|économie)/i,
  /\d+\s*(h|heure|heures|min|minutes)\s*(par|\/)\s*(jour|semaine|mois)/i,
  /\d+\s*(fois\s+)?(plus\s+)?(rapide|vite|efficace)/i,
  /\d+\s*k€|\d+\s*€\s*(par|\/)\s*(mois|an|jour)/i,
  /de\s+\d+\s*(à|au)\s*\d+/i,
  /\d+\s*(jours?|semaines?)\s*(de\s+)?(délai|retard|gain)/i,
  /\d+\s*(ETP|collaborateur|agent|recruteur)/i,
  /en\s+\d+\s*(minutes?|heures?|secondes?)/i,
  /\d+\s*minutes?\s*(au\s+lieu\s+de|vs\.?)\s*\d+/i,
];

/** Scénario avant/après. Source : pack 03. */
const BEFORE_PATTERNS: readonly RegExp[] = [
  /avant\s+[,:]/i,
  /aujourd['']hui\s+[,:]/i,
  /actuellement\s+[,:]/i,
  /sans\s+(l['']IA|ce\s+système|cet\s+outil)/i,
  /vous\s+passez\s+\d+/i,
  /chaque\s+(jour|semaine|mois)\s+[,:]?\s*\d+/i,
];
const AFTER_PATTERNS: readonly RegExp[] = [
  /après\s+(mise\s+en\s+place|déploiement|implémentation)/i,
  /avec\s+l['']IA\s*[,:]/i,
  /désormais\s+[,:]/i,
  /grâce\s+à\s+[,:]/i,
  /en\s+place\s*[,:]\s*\d+/i,
  /votre\s+(équipe|collaborateur|agent)\s+(peut\s+|ne\s+|gagne)/i,
];

/**
 * Expressions « anti-fluff » (jargon marketing creux). DISTINCT de la doctrine
 * `banned-phrases` (marque/SIREN). Source : pack 03:22-40.
 */
export const ANTI_FLUFF_PHRASES: readonly string[] = [
  "innovant",
  "révolutionnaire",
  "de pointe",
  "puissant",
  "robuste",
  "solution ia",
  "intelligence artificielle de pointe",
  "intelligence artificielle avancée",
  "technologie de rupture",
  "transformation digitale",
  "levier de croissance",
  "valeur ajoutée",
  "synergies",
  "paradigme",
  "disruptif",
  "game-changer",
  "state-of-the-art",
];

export interface BenefitConcretenessResult {
  /** Score 0-100 (déterministe). */
  readonly score: number;
  readonly concreteNumbersCount: number;
  readonly hasBeforeAfter: boolean;
  readonly antiFluffFound: ReadonlyArray<string>;
  /** Retour ciblé pour la boucle d'amélioration (PH3). */
  readonly feedback: string;
}

/** Poids du score (somme = 100). */
const W_NUMBERS = 40; // ≥ 2 chiffres concrets
const W_BEFORE_AFTER = 30; // scénario avant ET après
const W_ANTI_FLUFF = 30; // aucune expression creuse

/**
 * Score « bénéfice concret » d'un texte. Pur et déterministe.
 * `content` = corps texte (output.bodyText).
 */
export function evaluateBenefitConcreteness(content: string): BenefitConcretenessResult {
  const text = content ?? "";
  // Contenu vide/blanc → score 0 (pas de bonus anti-fluff sur du néant).
  if (text.trim().length === 0) {
    return {
      score: 0,
      concreteNumbersCount: 0,
      hasBeforeAfter: false,
      antiFluffFound: [],
      feedback: "Contenu vide.",
    };
  }
  const lower = text.toLowerCase();

  const concreteNumbersCount = CONCRETE_NUMBER_PATTERNS.filter((p) => p.test(text)).length;
  const hasBefore = BEFORE_PATTERNS.some((p) => p.test(text));
  const hasAfter = AFTER_PATTERNS.some((p) => p.test(text));
  const hasBeforeAfter = hasBefore && hasAfter;
  const antiFluffFound = ANTI_FLUFF_PHRASES.filter((phrase) => lower.includes(phrase));

  let score = 0;
  // Chiffres : proportionnel jusqu'à 2 (au-delà = plein pot).
  score += Math.min(concreteNumbersCount, 2) * (W_NUMBERS / 2);
  if (hasBeforeAfter) score += W_BEFORE_AFTER;
  if (antiFluffFound.length === 0) score += W_ANTI_FLUFF;

  const issues: string[] = [];
  if (concreteNumbersCount < 2) {
    issues.push(
      `Manque de chiffres concrets (${concreteNumbersCount}/2). Ajoute des données chiffrées (gain %, h/semaine, €/mois).`,
    );
  }
  if (!hasBeforeAfter) {
    const missing = !hasBefore ? "AVANT" : "APRÈS";
    issues.push(`Scénario ${missing} manquant : décris la situation concrète avant ET après.`);
  }
  if (antiFluffFound.length > 0) {
    issues.push(`Jargon creux à supprimer : ${antiFluffFound.join(", ")}.`);
  }

  return {
    score: Math.round(score),
    concreteNumbersCount,
    hasBeforeAfter,
    antiFluffFound,
    feedback: issues.length ? issues.join(" ") : "",
  };
}
