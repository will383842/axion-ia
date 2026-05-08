// Source de vérité unique des tarifs publics AxionIA — Sprint 14.10.2 (2026-05-08).
//
// Décision Will 2026-05-08 : aucun prix hardcodé dans les pages ou copy ville.
// Tous les prix affichés (audit, interventions, implémentation) viennent de ce
// fichier. Quand un prix change, on le modifie ICI et il se propage partout.
//
// V1 : fichier TS exporté.
// V2 (Sprint 20+) : ce fichier deviendra une vue Prisma alimentée par la
// console admin `/admin/pricing`. L'API publique de ce module reste stable
// (mêmes types + helpers) → migration sans casse côté pages.
//
// Conventions :
// - Tous les montants en EUR HT.
// - `priceMin` et `priceMax` pour les ranges, `priceFlat` pour les fixes.
// - `formatPrice()` retourne la chaîne d'affichage cohérente (« 490 € HT »,
//   « 1 900 - 3 900 € HT », « dès 12 000 € HT »).

export interface PricingTier {
  /** Identifiant stable (clé d'admin futur). */
  id: string;
  /** Label affichable FR. */
  labelFr: string;
  /** Label affichable EN. */
  labelEn: string;
  /** Prix fixe (en € HT) si la prestation a un tarif unique. */
  priceFlat?: number;
  /** Borne basse d'un range (en € HT). */
  priceMin?: number;
  /** Borne haute d'un range (en € HT). */
  priceMax?: number;
  /** True si le tarif est sur devis (pas de prix public). */
  onQuote?: boolean;
  /** Description courte FR (1-2 phrases). */
  descriptionFr: string;
  /** Description courte EN. */
  descriptionEn: string;
  /** Tailles INSEE ciblées (TPE/PME/ETI/grande-entreprise). Optionnel. */
  audienceSizes?: ReadonlyArray<"tpe" | "pme" | "eti" | "grande-entreprise">;
}

// ============================================================================
// AUDIT IA — 4 niveaux pyramide
// ============================================================================

export const AUDIT_TIERS: ReadonlyArray<PricingTier> = [
  {
    id: "audit-flash",
    labelFr: "Audit Flash",
    labelEn: "Flash audit",
    priceFlat: 490,
    descriptionFr: "Diagnostic rapide adapté aux petites structures.",
    descriptionEn: "Quick diagnosis tailored to small structures.",
    audienceSizes: ["tpe"],
  },
  {
    id: "audit-cible",
    labelFr: "Audit Ciblé",
    labelEn: "Targeted audit",
    priceMin: 1900,
    priceMax: 3900,
    descriptionFr: "Audit focalisé sur un département ou une fonction.",
    descriptionEn: "Audit focused on one department or function.",
    audienceSizes: ["pme"],
  },
  {
    id: "audit-strategique-pme",
    labelFr: "Audit Stratégique PME",
    labelEn: "SME Strategic audit",
    priceMin: 4900,
    priceMax: 9900,
    descriptionFr: "Audit complet multi-départements pour PME ambitieuses.",
    descriptionEn: "Full multi-department audit for ambitious SMEs.",
    audienceSizes: ["pme"],
  },
  {
    id: "audit-strategique-eti",
    labelFr: "Audit Stratégique ETI",
    labelEn: "Mid-cap Strategic audit",
    priceMin: 12000,
    descriptionFr: "Audit transverse + gouvernance IA pour ETI et grandes entreprises.",
    descriptionEn: "Transverse audit + AI governance for mid-caps and large enterprises.",
    audienceSizes: ["eti", "grande-entreprise"],
  },
];

// ============================================================================
// INTERVENTIONS IA — 5 formats
// ============================================================================

export const INTERVENTION_TIERS: ReadonlyArray<PricingTier> = [
  {
    id: "intervention-essentielle",
    labelFr: "Essentielle",
    labelEn: "Essential",
    priceFlat: 490,
    descriptionFr: "Format pour découvrir l'IA opérationnelle en une session.",
    descriptionEn: "Format to discover operational AI in one session.",
  },
  {
    id: "intervention-equipes",
    labelFr: "Équipes",
    labelEn: "Teams",
    onQuote: true,
    descriptionFr: "Session focalisée sur un département (commercial, finance, RH, ops).",
    descriptionEn: "Session focused on one department (sales, finance, HR, ops).",
  },
  {
    id: "intervention-managers",
    labelFr: "Managers",
    labelEn: "Managers",
    onQuote: true,
    descriptionFr: "Cadrage destiné au middle management et aux directions opérationnelles.",
    descriptionEn: "Framing aimed at middle management and operational leadership.",
  },
  {
    id: "intervention-conference",
    labelFr: "Conférence",
    labelEn: "Talk",
    onQuote: true,
    descriptionFr: "Plénière pour grands effectifs (séminaires, kick-off annuels).",
    descriptionEn: "Plenary for large audiences (seminars, annual kick-offs).",
  },
  {
    id: "intervention-dirigeants",
    labelFr: "Dirigeants",
    labelEn: "Executives",
    onQuote: true,
    descriptionFr: "Cadrage stratégique en huis-clos pour comités de direction.",
    descriptionEn: "Strategic framing in camera for executive committees.",
    audienceSizes: ["pme", "eti", "grande-entreprise"],
  },
];

// ============================================================================
// IMPLÉMENTATION IA — paliers
// ============================================================================

export const IMPLEMENTATION_TIERS: ReadonlyArray<PricingTier> = [
  {
    id: "impl-poc",
    labelFr: "POC",
    labelEn: "POC",
    priceMin: 990,
    priceMax: 4900,
    descriptionFr: "Preuve de concept ciblée sur un cas d'usage prioritaire.",
    descriptionEn: "Proof of concept targeting one priority use case.",
    audienceSizes: ["tpe"],
  },
  {
    id: "impl-mission-pme",
    labelFr: "Mission PME",
    labelEn: "SME mission",
    priceMin: 8000,
    priceMax: 25000,
    descriptionFr: "Déploiement multi-cas + formation des équipes en interne.",
    descriptionEn: "Multi-case deployment + internal team training.",
    audienceSizes: ["pme"],
  },
  {
    id: "impl-mission-eti",
    labelFr: "Mission ETI",
    labelEn: "Mid-cap mission",
    priceMin: 25000,
    priceMax: 80000,
    descriptionFr: "Déploiement transverse + gouvernance IA + intégrations avancées.",
    descriptionEn: "Transverse deployment + AI governance + advanced integrations.",
    audienceSizes: ["eti"],
  },
  {
    id: "impl-grand-programme",
    labelFr: "Grand programme",
    labelEn: "Large program",
    priceMin: 80000,
    onQuote: true,
    descriptionFr: "Programmes annuels pour grandes entreprises et grands comptes.",
    descriptionEn: "Annual programs for large enterprises and key accounts.",
    audienceSizes: ["grande-entreprise"],
  },
];

// ============================================================================
// Helpers
// ============================================================================

/**
 * Formate un tier pour affichage. Retourne « 490 € HT », « 1 900 - 3 900 € HT »,
 * « dès 12 000 € HT » ou « Sur devis » selon les bornes définies.
 */
export function formatPrice(tier: PricingTier, locale: "fr" | "en" = "fr"): string {
  const fmt = (n: number): string =>
    new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", { maximumFractionDigits: 0 }).format(
      n,
    );
  const currency = locale === "fr" ? " € HT" : " (excl. VAT) €";

  if (tier.onQuote && !tier.priceMin && !tier.priceMax && !tier.priceFlat) {
    return locale === "fr" ? "Sur devis" : "On quote";
  }
  if (typeof tier.priceFlat === "number") {
    return `${fmt(tier.priceFlat)}${currency}`;
  }
  if (typeof tier.priceMin === "number" && typeof tier.priceMax === "number") {
    return `${fmt(tier.priceMin)} - ${fmt(tier.priceMax)}${currency}`;
  }
  if (typeof tier.priceMin === "number") {
    return `${locale === "fr" ? "dès" : "from"} ${fmt(tier.priceMin)}${currency}`;
  }
  return locale === "fr" ? "Sur devis" : "On quote";
}

/** Tier d'entrée d'une catégorie (le moins cher) — utile pour CTA prix. */
export function getEntryTier(tiers: ReadonlyArray<PricingTier>): PricingTier {
  const found = tiers.find(
    (t) => typeof t.priceFlat === "number" || typeof t.priceMin === "number",
  );
  return found ?? tiers[0]!;
}

/** Prix d'entrée d'une catégorie en chiffre brut (pour Service.priceEur JSON-LD). */
export function getEntryPriceEur(tiers: ReadonlyArray<PricingTier>): number | undefined {
  const tier = getEntryTier(tiers);
  return tier.priceFlat ?? tier.priceMin;
}

/** Helper de raccourci par catégorie. */
export const PRICING = {
  audit: AUDIT_TIERS,
  interventions: INTERVENTION_TIERS,
  implementation: IMPLEMENTATION_TIERS,
} as const;
