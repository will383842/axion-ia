// Catalogue typé requêtable des offres Axion-IA (T-33, ADR-CB-11, doc 16 §7 G-1).
//
// Dérive de `PRICING_CATEGORIES` (SSOT pricing.ts) un tableau PLAT `Offer`
// requêtable par facettes (prix, durée, effectif, format, sujet, vertical) pour
// l'outil chatbot `rechercher_offres` (T-35). ADDITIF : ne modifie PAS pricing.ts
// (zéro régression sur les consommateurs existants).
//
// ⚠️ Les facettes effectif/durée/format/sujet ne sont PAS structurées dans
// pricing.ts → on les DÉRIVE ici (parsing groupSizeFr/durationFr + déduction
// format depuis rangeFr/description). Les PRIX restent la SSOT (jamais recopiés
// en dur ailleurs) ; prixMin/prixMax tiennent compte des sous-tiers réels →
// l'inversion ETI assumée (1 900 €, D-ETI-PRIX 🔒) est préservée, jamais masquée.

import { PRICING_CATEGORIES, UN_A_UN_RECURRING_TIER, type PricingTier } from "@/content/pricing";
import { resolveOfferUrl, hasResolvableUrl } from "@/lib/offer-url";

export type OfferVertical =
  | "audit"
  | "formation"
  | "implementation"
  | "sites-web"
  | "un-a-un"
  | "maintenance";

export type OfferFormat = "presentiel" | "distanciel" | "mixte";

export type AudienceSize = "tpe" | "pme" | "eti" | "grande-entreprise";

export interface Offer {
  /** id stable (== PricingTier.id). */
  readonly id: string;
  readonly vertical: OfferVertical;
  /** Libellé FR (== PricingTier.labelFr). */
  readonly titre: string;
  /** Prix d'entrée fixe HT (si tarif unique). */
  readonly prixFlat?: number;
  /** Prix le plus bas applicable (tier + sous-tiers) — pour filtres/tri prix. */
  readonly prixMin?: number;
  /** Prix le plus haut applicable (tier + sous-tiers). */
  readonly prixMax?: number;
  /** true si sur devis (exclu des filtres prix). */
  readonly onQuote: boolean;
  /** Durée brute FR (== PricingTier.durationFr). */
  readonly dureeFr?: string;
  /** Durée en jours (1 journée → 1, demi-journée → 0.5, 2 jours → 2). */
  readonly dureeJours?: number;
  /** Durée en heures quand exprimée en heures (« 4 h » → 4). */
  readonly dureeHeures?: number;
  /** Formats déduits (jamais vide — fallback par vertical). */
  readonly format: ReadonlyArray<OfferFormat>;
  /** Effectif minimum (1 pour les 1-to-1). */
  readonly effectifMin?: number;
  /** Effectif maximum. */
  readonly effectifMax?: number;
  /** Sujet/outil dominant (« claude » pour les offres Claude ; sinon undefined). */
  readonly sujet?: string;
  /** Tailles INSEE ciblées (== PricingTier.audienceSizes). */
  readonly audienceSizes?: ReadonlyArray<AudienceSize>;
  /** URL FR canonique (résolveur T-34) — jamais un lien mort. */
  readonly urlFR: string;
}

// ── Parsing facettes ──────────────────────────────────────────────────────

/** « 2 à 30 personnes » → {min:2,max:30} ; « 1 dirigeant (1-to-1) » → {min:1,max:1}. */
export function parseEffectif(groupSizeFr?: string): { min?: number; max?: number } {
  if (!groupSizeFr) return {};
  const range = groupSizeFr.match(/(\d+)\s*à\s*(\d+)/);
  if (range) return { min: Number(range[1]), max: Number(range[2]) };
  // « 1 dirigeant (1-to-1) » / « 1 collaborateur (1-to-1) » / « 1 personne (1-to-1) »
  if (/\(1-to-1\)/i.test(groupSizeFr) || /^\s*1\s/.test(groupSizeFr)) {
    return { min: 1, max: 1 };
  }
  const single = groupSizeFr.match(/(\d+)/);
  if (single) return { min: Number(single[1]), max: Number(single[1]) };
  return {};
}

/** « 1 journée » → {jours:1} ; « Demi-journée (4 h) » → {jours:0.5,heures:4} ; « 2 jours » → {jours:2}. */
export function parseDuree(durationFr?: string): { jours?: number; heures?: number } {
  if (!durationFr) return {};
  const out: { jours?: number; heures?: number } = {};
  const heures = durationFr.match(/(\d+)\s*h\b/i);
  if (heures) out.heures = Number(heures[1]);
  if (/demi-journ[ée]e/i.test(durationFr)) out.jours = 0.5;
  const jours = durationFr.match(/(\d+)\s*jours?\b/i);
  if (jours) out.jours = Number(jours[1]);
  else if (/\b1\s*journ[ée]e\b/i.test(durationFr)) out.jours = 1;
  return out;
}

/** Déduit les formats depuis le texte du tier ; fallback par vertical (jamais vide). */
export function deriveFormat(tier: PricingTier, vertical: OfferVertical): OfferFormat[] {
  const text = [
    tier.descriptionFr,
    tier.durationFr,
    tier.groupSizeFr,
    ...(tier.subTiers ?? []).map((s) => s.rangeFr),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const found = new Set<OfferFormat>();
  if (/\bmix\b|site \+ visio|mixte/.test(text)) found.add("mixte");
  if (/à distance|distanciel|visio|en ligne/.test(text)) found.add("distanciel");
  if (/sur site|sur place|présentiel|presentiel|pl[ée]ni[èe]re/.test(text)) found.add("presentiel");

  if (found.size > 0) return [...found];

  // Fallback par vertical (toute offre a ≥ 1 format).
  switch (vertical) {
    case "formation":
    case "audit":
      return ["presentiel"];
    case "sites-web":
      return ["distanciel"];
    case "implementation":
    case "un-a-un":
    case "maintenance":
      return ["mixte"];
  }
}

/** Sujet/outil dominant : « claude » pour les offres Claude, sinon undefined. */
export function deriveSujet(tier: PricingTier): string | undefined {
  if (/claude/i.test(tier.id) || /claude/i.test(tier.labelFr)) return "claude";
  return undefined;
}

/** Vertical : par catégorie pricing ; les interventions 1-to-1 (effectif 1) → un-a-un. */
function deriveVertical(
  categoryKey: keyof typeof PRICING_CATEGORIES,
  effectifMax: number | undefined,
): OfferVertical {
  switch (categoryKey) {
    case "audit":
      return "audit";
    case "implementation":
      return "implementation";
    case "maintenance":
      return "maintenance";
    case "codage":
      return "sites-web";
    case "interventions":
      // Les journées 1-to-1 (dirigeant / membre / vision / claude-dirigeant) sont
      // sémantiquement « un-à-un », même si rangées dans INTERVENTION_TIERS.
      return effectifMax === 1 ? "un-a-un" : "formation";
  }
}

/** Prix min/max en tenant compte des sous-tiers réels (préserve l'inversion ETI). */
function derivePriceRange(tier: PricingTier): {
  prixFlat?: number;
  prixMin?: number;
  prixMax?: number;
} {
  const points: number[] = [];
  if (typeof tier.priceFlat === "number") points.push(tier.priceFlat);
  if (typeof tier.priceMin === "number") points.push(tier.priceMin);
  if (typeof tier.priceMax === "number") points.push(tier.priceMax);
  for (const sub of tier.subTiers ?? []) {
    if (typeof sub.priceFlat === "number") points.push(sub.priceFlat);
  }
  if (points.length === 0) return {};
  return {
    prixFlat: tier.priceFlat,
    prixMin: Math.min(...points),
    prixMax: Math.max(...points),
  };
}

function toOffer(
  tier: PricingTier,
  categoryKey: keyof typeof PRICING_CATEGORIES | "standalone",
): Offer | null {
  // Une offre sans URL résoluble ne doit PAS entrer au catalogue (jamais de lien mort).
  if (!hasResolvableUrl(tier.id)) return null;

  const { min: effectifMin, max: effectifMax } = parseEffectif(tier.groupSizeFr);
  const vertical =
    categoryKey === "standalone" ? "un-a-un" : deriveVertical(categoryKey, effectifMax);
  const { jours, heures } = parseDuree(tier.durationFr);
  const { prixFlat, prixMin, prixMax } = derivePriceRange(tier);

  return {
    id: tier.id,
    vertical,
    titre: tier.labelFr,
    prixFlat,
    prixMin,
    prixMax,
    onQuote: tier.onQuote === true && prixFlat === undefined && prixMin === undefined,
    dureeFr: tier.durationFr,
    dureeJours: jours,
    dureeHeures: heures,
    format: deriveFormat(tier, vertical),
    effectifMin,
    effectifMax,
    sujet: deriveSujet(tier),
    audienceSizes: tier.audienceSizes,
    urlFR: resolveOfferUrl(tier.id),
  };
}

/**
 * Catalogue plat de toutes les offres requêtables (toutes verticales).
 * Construit une seule fois à l'import (dérivation pure, déterministe).
 */
export const OFFERS: ReadonlyArray<Offer> = (() => {
  const out: Offer[] = [];
  for (const [key, tiers] of Object.entries(PRICING_CATEGORIES) as Array<
    [keyof typeof PRICING_CATEGORIES, ReadonlyArray<PricingTier>]
  >) {
    for (const tier of tiers) {
      const offer = toOffer(tier, key);
      if (offer) out.push(offer);
    }
  }
  // Offre standalone (hors PRICING_CATEGORIES).
  const recurring = toOffer(UN_A_UN_RECURRING_TIER, "standalone");
  if (recurring) out.push(recurring);
  return out;
})();

/** Lookup par id. */
export function getOfferById(id: string): Offer | undefined {
  return OFFERS.find((o) => o.id === id);
}

/** Offres d'une vertical donnée. */
export function getOffersByVertical(vertical: OfferVertical): Offer[] {
  return OFFERS.filter((o) => o.vertical === vertical);
}
