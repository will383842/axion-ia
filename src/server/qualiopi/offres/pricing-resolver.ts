/**
 * Qualiopi — Résolution prix/durée d'une offre depuis le SSOT `pricing.ts`.
 *
 * Le modèle `OffreSite` ne stocke JAMAIS le prix : il porte un `tierId` qui
 * pointe vers `src/content/pricing.ts`. Ce module résout le tier et expose le
 * libellé prix (via `formatPrice`) — zéro prix en dur, propagation automatique
 * quand Will modifie un tarif dans pricing.ts.
 */

import {
  PRICING_CATEGORIES,
  UN_A_UN_RECURRING_TIER,
  formatAmount,
  formatPrice,
  getFormationEntryPrice,
  type FormationDuree,
  type FormationGamme,
  type PricingTier,
} from "@/content/pricing";
import type { OffreTarifType } from "@/server/qualiopi/offres/types";

/** Index plat de tous les tiers connus (toutes catégories + récurrent). */
const ALL_TIERS: ReadonlyArray<PricingTier> = [
  ...Object.values(PRICING_CATEGORIES).flat(),
  UN_A_UN_RECURRING_TIER,
];

/** Tier pricing.ts pour un `tierId`, ou `null` si introuvable (offre orpheline). */
export function findPricingTier(tierId: string): PricingTier | null {
  return ALL_TIERS.find((t) => t.id === tierId) ?? null;
}

/**
 * Libellé prix affichable d'une offre (FR) résolu depuis pricing.ts.
 * Renvoie « Tarif indisponible » si le tier n'existe plus (incohérence à
 * corriger — détectée par `verifyOffreCoherence`).
 */
export function resolveOffrePriceLabel(tierId: string | null, locale: "fr" | "en" = "fr"): string {
  if (!tierId) return locale === "fr" ? "Sur devis" : "On quote";
  const tier = findPricingTier(tierId);
  if (!tier) return locale === "fr" ? "Tarif indisponible" : "Price unavailable";
  return formatPrice(tier, locale);
}

/**
 * Libellé prix d'une offre CATALOGUE V2 (tierId null) : dérivé de la matrice
 * `FORMATION_PRICE_MATRIX` via `gamme` + `dureeCode` → « À partir de X € HT ».
 */
export function resolveOffrePriceLabelV2(
  gamme: string | null,
  dureeCode: string | null,
  locale: "fr" | "en" = "fr",
): string {
  if (!gamme || !dureeCode) return locale === "fr" ? "Sur devis" : "On quote";
  const entry = getFormationEntryPrice(gamme as FormationGamme, dureeCode as FormationDuree);
  if (entry == null) return locale === "fr" ? "Sur devis" : "On quote";
  // `formatAmount` inclut déjà « € HT » (fr) / « (excl. VAT) » (en) — pas de suffixe.
  return locale === "fr"
    ? `À partir de ${formatAmount(entry, "fr")}`
    : `From ${formatAmount(entry, "en")}`;
}

/**
 * Résout le prix d'une offre, V2 (gamme+dureeCode → matrice) OU legacy
 * (tierId → pricing.ts). À utiliser partout où une offre peut être de l'un ou
 * l'autre type (admin, fiche).
 */
export function resolveOffrePrice(
  offre: {
    tierId: string | null;
    gamme: string | null;
    dureeCode: string | null;
    /** Si « sur_devis », prime sur toute dérivation (offre AXION 2026-07). */
    tarifType?: OffreTarifType | null;
  },
  locale: "fr" | "en" = "fr",
): string {
  // Offre déclarée « sur devis » : aucun prix dérivé (ni matrice ni tier) — le
  // tarifType stocké est la source de vérité (offre AXION : prix par personne
  // câblés ultérieurement, jamais les anciens prix matrice).
  if (offre.tarifType === "sur_devis") {
    return locale === "fr" ? "Sur devis" : "On quote";
  }
  if (offre.gamme && offre.dureeCode) {
    return resolveOffrePriceLabelV2(offre.gamme, offre.dureeCode, locale);
  }
  return resolveOffrePriceLabel(offre.tierId, locale);
}

/** Dérive le type d'affichage tarifaire à partir d'un tier pricing.ts. */
export function deriveTarifType(tier: PricingTier): OffreTarifType {
  if (tier.onQuote && tier.priceFlat == null && tier.priceMin == null) return "sur_devis";
  if (tier.subTiers && tier.subTiers.length > 0) return "a_partir_de";
  if (tier.priceMin != null && tier.priceMax != null) return "a_partir_de";
  if (tier.priceFlat != null) return "fixe";
  return "sur_devis";
}

/**
 * Vérifie la cohérence offre ↔ pricing.ts : le `tierId` existe-t-il encore et
 * le `tarifType` stocké correspond-il au tier ? Retourne la liste des écarts.
 */
export function verifyOffreCoherence(input: {
  tierId: string | null;
  tarifType: OffreTarifType;
  gamme?: string | null;
  dureeCode?: string | null;
}): {
  ok: boolean;
  ecarts: string[];
} {
  // Offre « sur devis » : cohérente par définition (aucun prix à résoudre —
  // c'est le mode de l'offre AXION tant que les prix par personne ne sont pas câblés).
  if (input.tarifType === "sur_devis") return { ok: true, ecarts: [] };
  // Offres catalogue V2 : cohérence = la paire gamme+dureeCode résout un prix dans
  // FORMATION_PRICE_MATRIX (sinon l'offre afficherait silencieusement « Sur devis »).
  if (input.gamme && input.dureeCode) {
    const entry = getFormationEntryPrice(
      input.gamme as FormationGamme,
      input.dureeCode as FormationDuree,
    );
    if (entry == null) {
      return {
        ok: false,
        ecarts: [`gamme/durée "${input.gamme}/${input.dureeCode}" absente de la matrice prix`],
      };
    }
    return { ok: true, ecarts: [] };
  }
  // Offre legacy sans tierId (cas résiduel) : rien à vérifier.
  if (!input.tierId) return { ok: true, ecarts: [] };
  const ecarts: string[] = [];
  const tier = findPricingTier(input.tierId);
  if (!tier) {
    ecarts.push(`tierId "${input.tierId}" introuvable dans pricing.ts`);
    return { ok: false, ecarts };
  }
  const expected = deriveTarifType(tier);
  if (expected !== input.tarifType) {
    ecarts.push(`tarifType "${input.tarifType}" ≠ pricing.ts attendu "${expected}"`);
  }
  return { ok: ecarts.length === 0, ecarts };
}
