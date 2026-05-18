/**
 * Soft-404 word count gate — bouclier anti-doorway HCU 2024-2026.
 *
 * City Domination 2026-05-18 P1-5 (audit A7 P1).
 *
 * Google Helpful Content Update (HCU) 2024 + Spam Brain 2026 pénalisent les
 * "thin content pages" — pages générées dynamiquement avec peu de valeur
 * éditoriale ajoutée. Sur ~2150 pages pSEO villes auto-générées, le risque
 * doorway est concret : si le LLM produit 200 mots de variations INSEE sans
 * substance Axion-IA-centric, on tombe sous le seuil HCU.
 *
 * Seuils empiriques (validés audit A7 + cross-cut 21 faceted nav crawl traps) :
 *   - DEFAULT : 350 mots → noindex (auto-tier-3-noindex-nofollow)
 *   - Avec JSON-LD `LocalBusiness` complet + cas concret local structuré :
 *     tolérance abaissée à 280 mots (la richesse structurée compense le texte
 *     court — Google AI Overviews lit le JSON-LD comme contenu sémantique).
 *
 * Cibles connues du projet :
 *   - Paris pilote : ~5 000 mots × 4 services × 2 locales (largement au-dessus)
 *   - Top 50 villes Tier-1 : cible 1 500-2 500 mots
 *   - T3 long-tail villes : cible 300-500 mots auto-gen + review spot
 *
 * Le gate s'applique :
 *   1. Côté generator (`landing-ville.ts` post-LLM, pré-DB insert) → force
 *      `tier_3_noindex_nofollow` si soft-404
 *   2. Côté cron retroactive scan (worker dédié à venir Phase B) → re-évalue
 *      les pages déjà publiées et flag rétroactif
 *
 * NB : aucun impact sur les pages avec copy gold standard manuel
 * (>1 500 mots) — le gate ne déclenche que sur les vrais squelettes.
 */

export const SOFT_404_MIN_WORD_COUNT_DEFAULT = 350;
export const SOFT_404_MIN_WORD_COUNT_WITH_RICH_JSON_LD = 280;

export interface Soft404Input {
  /** Nombre de mots du body texte (post strip HTML). */
  readonly wordCount: number;
  /**
   * True si la page émet `LocalBusiness` JSON-LD complet (areaServed City +
   * GeoCoordinates + address PostalAddress + openingHours + priceRange).
   * Sans tous ces sous-fields, considérer false.
   */
  readonly hasFullLocalBusinessJsonLd: boolean;
  /**
   * True si la page embed au moins 1 cas concret local structuré
   * (témoignage avec auteur + entreprise + ROI chiffré).
   */
  readonly hasLocalCase: boolean;
  /**
   * Optional — count de FAQ items émis dans `FAQPage` JSON-LD. Une FAQ riche
   * (≥ 4 questions) compense ~50 mots de body texte.
   */
  readonly faqCount?: number;
}

export type Soft404Verdict =
  | { readonly isSoft404: false; readonly reason: "above-threshold"; readonly threshold: number }
  | {
      readonly isSoft404: true;
      readonly reason: "below-default" | "below-rich-tolerance";
      readonly threshold: number;
      readonly wordCount: number;
    };

/**
 * Détermine si la page est en risque doorway HCU.
 *
 * Retourne :
 *   - `{ isSoft404: false, reason: "above-threshold" }` → page indexable
 *   - `{ isSoft404: true, reason: "below-default" }` → wordCount < 350 sans
 *     compensation JSON-LD/cas concret
 *   - `{ isSoft404: true, reason: "below-rich-tolerance" }` → wordCount < 280
 *     même avec JSON-LD/cas concret (vraiment thin)
 */
export function evaluateSoft404(input: Soft404Input): Soft404Verdict {
  const richBonus = input.hasFullLocalBusinessJsonLd && input.hasLocalCase;
  // Bonus FAQ : ≥ 4 questions = +50 mots équivalents (compensation richesse)
  const faqBonus = (input.faqCount ?? 0) >= 4 ? 50 : 0;
  const effectiveWordCount = input.wordCount + faqBonus;
  const threshold = richBonus
    ? SOFT_404_MIN_WORD_COUNT_WITH_RICH_JSON_LD
    : SOFT_404_MIN_WORD_COUNT_DEFAULT;

  if (effectiveWordCount >= threshold) {
    return { isSoft404: false, reason: "above-threshold", threshold };
  }
  return {
    isSoft404: true,
    reason: richBonus ? "below-rich-tolerance" : "below-default",
    threshold,
    wordCount: input.wordCount,
  };
}
