/**
 * Price-gate — garde-fou post-génération anti-prix-non-SSOT (Sprint Pricing SSOT
 * 2026-05-29, Phase 3).
 *
 * Doctrine Will : `src/content/pricing.ts` est la SEULE source de vérité des
 * tarifs. Tout contenu généré (villes, blog, landing…) ne doit citer QUE :
 *   - des tokens `{{price:<tierId>}}` (résolus au rendu — pas de « € » littéral) ;
 *   - ou un montant € dont la VALEUR existe dans pricing.ts (SSOT).
 * Tout autre montant € (ex « 3 500 € » inventé, « 8 000 € » périmé) est bloqué :
 * le quality-gate régénère plutôt que de publier un prix qui contredit la SSOT.
 *
 * Réutilise `PATTERN_AMOUNT_EUR` (fact-check/claims-extractor) et l'allowlist
 * dérivée de `pricing.ts`. Branché dans `quality/doctrine-check.ts::checkDoctrine`.
 */
import {
  PRICING_CATEGORIES,
  UN_A_UN_TIERS,
  UN_A_UN_RECURRING_TIER,
  type PricingTier,
} from "@/content/pricing";
import { PATTERN_AMOUNT_EUR } from "../fact-check/claims-extractor";

/**
 * Ensemble des montants € autorisés = toutes les valeurs numériques présentes
 * dans pricing.ts (priceFlat / priceFlatOnsite / priceMin / priceMax + sous-tiers).
 * Construit une seule fois.
 */
const SSOT_AMOUNTS: ReadonlySet<number> = (() => {
  const set = new Set<number>();
  const groups: ReadonlyArray<ReadonlyArray<PricingTier>> = [
    ...Object.values(PRICING_CATEGORIES),
    UN_A_UN_TIERS,
    [UN_A_UN_RECURRING_TIER],
  ];
  for (const group of groups) {
    for (const tier of group) {
      for (const v of [tier.priceFlat, tier.priceFlatOnsite, tier.priceMin, tier.priceMax]) {
        if (typeof v === "number") set.add(v);
      }
      for (const sub of tier.subTiers ?? []) set.add(sub.priceFlat);
    }
  }
  return set;
})();

export interface PriceGateViolation {
  /** Le montant en dur tel qu'écrit (ex « 3 500 € HT »). */
  readonly amount: string;
  /** La valeur numérique extraite (ex 3500). */
  readonly value: number;
}

/** Vrai si le montant capturé est en euros (≠ $, USD…). */
function isEuro(raw: string): boolean {
  return /€|\bEUR\b|euros?/i.test(raw);
}

/**
 * Scanne un texte généré et retourne les montants € qui NE sont PAS dans la
 * SSOT. Les tokens `{{price:…}}` ne contiennent pas de « € » → jamais flaggés.
 */
export function findNonSsotPrices(text: string): PriceGateViolation[] {
  const violations: PriceGateViolation[] = [];
  const re = new RegExp(PATTERN_AMOUNT_EUR.source, "gi"); // instance locale (lastIndex)
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0];
    if (!isEuro(raw)) continue; // ignore $ / USD
    const value = Number.parseInt(raw.replace(/[^\d]/g, ""), 10);
    if (!Number.isFinite(value)) continue;
    if (SSOT_AMOUNTS.has(value)) continue; // montant SSOT → OK
    violations.push({ amount: raw.trim(), value });
  }
  return violations;
}

/** Vrai si le texte ne contient aucun prix € hors-SSOT. */
export function passesPriceGate(text: string): boolean {
  return findNonSsotPrices(text).length === 0;
}
