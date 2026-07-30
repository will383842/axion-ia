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
  getFormationBrackets,
  getFormationEntryPrice,
  type FormationCategorie,
  type FormationDuree,
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
 * Libellé prix d'une offre CATALOGUE (tierId null) : dérivé de la matrice
 * `FORMATION_PRICE_MATRIX` via `gamme` + `dureeCode` → prix fixe par groupe.
 *
 * Refonte 2026-07-19 : la colonne DB `OffreSite.gamme` porte désormais la
 * CATÉGORIE (« generale » | « metier » | « secteur ») pour les offres du
 * catalogue actuel. Les offres archivées portent une ancienne gamme
 * (« ia-standard »…) qui ne résout plus dans la matrice → « Sur devis ».
 */
export function resolveOffrePriceLabelV2(
  gamme: string | null,
  dureeCode: string | null,
  locale: "fr" | "en" = "fr",
): string {
  if (!gamme || !dureeCode) return locale === "fr" ? "Sur devis" : "On quote";
  const entry = getFormationEntryPrice(gamme as FormationCategorie, dureeCode as FormationDuree);
  if (entry == null) return locale === "fr" ? "Sur devis" : "On quote";
  // `formatAmount` inclut déjà « € HT » (fr) / « (excl. VAT) » (en) — pas de suffixe.
  // Tranche unique 2-15 : prix fixe par groupe, plus de « À partir de ».
  return formatAmount(entry, locale);
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

/**
 * Prix HT en EUROS d'une offre — UNIQUEMENT quand il est FERME.
 *
 * `null` signifie « aucun montant ferme dérivable », jamais « zéro » : offre sur
 * devis, tier disparu, gamme absente de la matrice, fourchette priceMin/priceMax,
 * prix « à partir de » (`isFromPrice`) ou tier à paliers d'effectif (`subTiers`).
 * Dans tous ces cas l'admin chiffre à la main — on n'invente jamais un montant
 * sur une pièce commerciale.
 *
 * ⚠️ Ce n'est PAS le miroir de `resolveOffrePrice`, et il ne faut pas le
 * « simplifier » pour qu'il le devienne : `formatPrice` sait rendre une
 * FOURCHETTE (« 2 000 - 30 000 € HT » pour `codage-web`) ou un PLANCHER
 * (« À partir de 1 190 € HT » pour les 8 tiers d'audit, `isFromPrice: true`),
 * un nombre non. Inscrire ce plancher comme PU HT d'un devis — pièce ferme,
 * signée « bon pour accord », transformable en convention — est une
 * sous-facturation silencieuse (facteur 15 sur `codage-web`). Même piège sur
 * `subTiers` : `intervention-essentielle` et `intervention-claude` portent un
 * `priceFlat` qui n'est que le prix d'ENTRÉE de la tranche 2-15.
 *
 * Le débit d'un créneau (`booking-catalog`) lit bien `priceFlat` malgré
 * `isFromPrice` — c'est un prix catalogue à périmètre fixe. Un devis, lui,
 * engage sur un périmètre négocié : la règle Will 2026-07-17 « les audits sont
 * TOUJOURS à partir de » y interdit le pré-remplissage.
 */
export function resolveOffrePriceEur(offre: {
  tierId: string | null;
  gamme: string | null;
  dureeCode: string | null;
  tarifType?: OffreTarifType | null;
}): number | null {
  if (offre.tarifType === "sur_devis") return null;
  if (offre.gamme && offre.dureeCode) {
    return (
      getFormationEntryPrice(
        offre.gamme as FormationCategorie,
        offre.dureeCode as FormationDuree,
      ) ?? null
    );
  }
  if (!offre.tierId) return null;
  const tier = findPricingTier(offre.tierId);
  if (!tier) return null;
  if (tier.priceMax != null) return null; // fourchette → pas ferme
  if ((tier.subTiers?.length ?? 0) > 0) return null; // paliers d'effectif → pas ferme
  if (tier.isFromPrice === true) return null; // plancher « à partir de » → pas ferme
  return tier.priceFlat ?? null; // jamais `priceMin` seul
}

/**
 * Rappel à afficher sous le PU HT d'un devis, dérivé de l'offre — jamais figé.
 *
 * Deux faits changent d'une offre à l'autre et se paient cher s'ils sont écrits
 * en dur :
 *  - l'EFFECTIF couvert : la matrice catalogue est un prix PAR GROUPE (laisser
 *    Qté = 1), alors que `intervention-dirigeants`, `intervention-membre-equipe`
 *    et `intervention-dirigeant-vision` sont facturés PAR PERSONNE ;
 *  - les FRAIS : la matrice est documentée « intra-entreprise, hors frais de
 *    déplacement » (pricing.ts), tandis que les interventions 1-to-1 portent
 *    « déplacement / hébergement / repas en sus systématiquement ».
 *
 * Écrire une phrase unique serait donc faux dans un cas sur deux, et pousserait
 * à l'erreur inverse (devis divisé par le nombre de participants).
 */
export function resolveOffreDevisNoteFr(offre: {
  tierId: string | null;
  gamme: string | null;
  dureeCode: string | null;
  tarifType?: OffreTarifType | null;
}): string {
  if (resolveOffrePriceEur(offre) === null) {
    return "Aucun prix ferme dérivable (offre sur devis, fourchette, prix « à partir de » ou paliers d'effectif) — saisissez le PU HT à la main.";
  }
  if (offre.gamme && offre.dureeCode) {
    const bracket = getFormationBrackets(
      offre.gamme as FormationCategorie,
      offre.dureeCode as FormationDuree,
    )[0];
    const effectif =
      bracket !== undefined ? `${bracket.replace("-", " à ")} participants` : "Effectif à préciser";
    return `${effectif} — prix par GROUPE, laisser Qté = 1. Intra-entreprise HT, hors frais de déplacement (ajouter une ligne si applicable).`;
  }
  const tier = offre.tierId !== null ? findPricingTier(offre.tierId) : null;
  const effectif = tier?.groupSizeFr ?? "Effectif à préciser";
  return `${effectif} — prix HT pour cet effectif. Frais de déplacement, hébergement et repas EN SUS (ajouter une ligne).`;
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
      input.gamme as FormationCategorie,
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
