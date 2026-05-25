/**
 * Anti-duplicate check entre hub ville et ses 5 sous-pages verticales.
 *
 * Sprint Quality 2026 — Phase 3 (2026-05-24).
 *
 * Doctrine :
 *   - Le hub ville (`/implantations/[region]/[ville]`) introduit BRIÈVEMENT les services
 *   - Les 5 verticales (`/[verticale]`) traitent CHAQUE service en profondeur
 *   - Si le hub.pitchFr OU directAnswerFr est trop similaire à une verticale.hero ou
 *     verticale.directAnswer → duplicate content vis-à-vis de Google → BAD
 *
 * Mesure : Jaccard similarity sur shingles 3-grams (mots normalisés).
 * Seuil : > 0.4 = considéré comme trop similaire (à ajuster selon feedback).
 */

/** Normalise un texte : lowercase, retire ponctuation, split en mots. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[.,;:!?()«»"'\[\]{}]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3);
}

/** Génère des shingles de taille n (n-grams de mots). */
function shingles(tokens: string[], n: number = 3): Set<string> {
  const set = new Set<string>();
  if (tokens.length < n) return set;
  for (let i = 0; i <= tokens.length - n; i++) {
    set.add(tokens.slice(i, i + n).join(" "));
  }
  return set;
}

/** Jaccard similarity = |A ∩ B| / |A ∪ B|. Range : [0, 1]. */
export function computeJaccardSimilarity(textA: string, textB: string, n: number = 3): number {
  const a = shingles(tokenize(textA), n);
  const b = shingles(tokenize(textB), n);
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return intersection / union;
}

export interface CrossDuplicateCheckInput {
  readonly hubPitchFr: string;
  readonly hubDirectAnswerFr: string;
  readonly verticales: ReadonlyArray<{
    readonly slug: string;
    readonly hero: string;
    readonly directAnswer?: string;
  }>;
}

export interface CrossDuplicateCheckResult {
  readonly maxSimilarity: number;
  readonly issues: ReadonlyArray<{
    readonly verticaleSlug: string;
    readonly compared: string; // "hubPitch vs verticaleHero" | …
    readonly similarity: number;
    readonly threshold: number;
  }>;
  readonly retryFeedback: string;
}

export const DUPLICATE_THRESHOLD = 0.4;

/**
 * Calcule la similarité Jaccard entre le hub et toutes les verticales.
 * Retourne un feedback exploitable par la boucle retry du generator si > threshold.
 */
export function checkHubVsVerticalesDuplicate(
  input: CrossDuplicateCheckInput,
): CrossDuplicateCheckResult {
  const issues: Array<{
    verticaleSlug: string;
    compared: string;
    similarity: number;
    threshold: number;
  }> = [];
  let maxSim = 0;

  for (const v of input.verticales) {
    // hub.pitchFr vs verticale.hero
    const s1 = computeJaccardSimilarity(input.hubPitchFr, v.hero);
    maxSim = Math.max(maxSim, s1);
    if (s1 > DUPLICATE_THRESHOLD) {
      issues.push({
        verticaleSlug: v.slug,
        compared: "hub.pitchFr vs verticale.hero",
        similarity: s1,
        threshold: DUPLICATE_THRESHOLD,
      });
    }
    // hub.directAnswerFr vs verticale.directAnswer (si présent)
    if (v.directAnswer) {
      const s2 = computeJaccardSimilarity(input.hubDirectAnswerFr, v.directAnswer);
      maxSim = Math.max(maxSim, s2);
      if (s2 > DUPLICATE_THRESHOLD) {
        issues.push({
          verticaleSlug: v.slug,
          compared: "hub.directAnswerFr vs verticale.directAnswer",
          similarity: s2,
          threshold: DUPLICATE_THRESHOLD,
        });
      }
    }
  }

  const retryFeedback =
    issues.length > 0
      ? `Contenu HUB trop similaire à ${issues.length} sous-page(s) verticale(s). DIFFÉRENCIE le hub : reformule pitchFr/directAnswerFr avec d'autres angles (écosystème + cibles audience), évite de répéter les phrases utilisées dans : ${issues.map((i) => `${i.verticaleSlug} (Jaccard ${i.similarity.toFixed(2)})`).join(", ")}.`
      : "";

  return { maxSimilarity: maxSim, issues, retryFeedback };
}
