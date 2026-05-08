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

/**
 * Sous-tier d'un format intervention — variations tarifaires par nombre
 * de participants (ex Essentielle 2-4 pers / 5-6 pers / 7-8 pers).
 * Affiché en grille de prix sur la page format dédiée.
 */
export interface PricingSubTier {
  /** Identifiant stable. */
  id: string;
  /** Label FR (ex « 2 à 4 personnes », « Intimiste »). */
  labelFr: string;
  /** Label EN. */
  labelEn: string;
  /** Détail de la fourchette FR (ex « 2 à 4 participants »). */
  rangeFr: string;
  /** Détail EN. */
  rangeEn: string;
  /** Prix fixe HT en EUR. */
  priceFlat: number;
  /** Mis en avant dans l'UI (« ★ Recommandé »). */
  isFeatured?: boolean;
}

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
  /**
   * Sous-tiers tarifaires (variations par nombre de participants pour les
   * formats intervention multi-tarifs). Le `priceFlat` reste le prix
   * d'entrée (premier sous-tier). Optionnel.
   */
  subTiers?: ReadonlyArray<PricingSubTier>;
  /** Durée de la prestation FR (ex « 1 journée », « 2 jours »). */
  durationFr?: string;
  /** Durée EN. */
  durationEn?: string;
  /** Description courte FR (1-2 phrases). */
  descriptionFr: string;
  /** Description courte EN. */
  descriptionEn: string;
  /** Tailles INSEE ciblées (TPE/PME/ETI/grande-entreprise). Optionnel. */
  audienceSizes?: ReadonlyArray<"tpe" | "pme" | "eti" | "grande-entreprise">;
}

/**
 * Note universelle frais annexes pour les interventions et formations sur site.
 * Affichée systématiquement sous la grille tarifaire des formats interventions.
 * Décision Will 2026-05-08 : les frais de déplacement ne sont JAMAIS inclus
 * dans le forfait, ils sont facturés en sus selon la zone et la durée.
 */
export const INTERVENTION_FEES_NOTE = {
  fr: "Frais de logement, repas et forfait trajet en sus, facturés au cas par cas selon la distance et la durée. Devis transparent fourni avant signature.",
  en: "Lodging, meals and travel allowance billed separately, calculated case by case based on distance and duration. Transparent quote provided before signature.",
} as const;

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
// INTERVENTIONS IA — formats sur site
// Sprint 14.10.4 (Will 2026-05-08) :
//   - Aucune demi-journée : durée minimale = 1 jour.
//   - Sous-tiers tarifaires par nombre de participants.
//   - Conférence devient 1 jour (au lieu d'une ½ journée).
//   - Nouveau format « Approfondie » 2 jours avec 3 sous-tiers.
//   - Frais déplacement / hébergement / repas en sus systématiquement
//     (cf. INTERVENTION_FEES_NOTE).
// ============================================================================

/**
 * Sous-tiers Essentielle (1 jour) — variations selon nombre de participants.
 * Migré depuis `content/interventions.ts::ESSENTIELLE_TIERS`. Source unique.
 *
 * NOTE Will 2026-05-08 : tarifs actuels (490/790/1190) ne sont PAS dégressifs
 * par participant — à ajuster manuellement si besoin (cf. priceFlat).
 *   2-4 pers : 490 € → 122,5 €/pers
 *   5-6 pers : 790 € → 131,7 €/pers (hausse, à revoir)
 *   7-8 pers : 1 190 € → 148,8 €/pers (hausse, à revoir)
 */
const ESSENTIELLE_SUB_TIERS: ReadonlyArray<PricingSubTier> = [
  {
    id: "essentielle-intimiste",
    labelFr: "Intimiste",
    labelEn: "Intimate",
    rangeFr: "2 à 4 personnes",
    rangeEn: "2 to 4 people",
    priceFlat: 490,
  },
  {
    id: "essentielle-standard",
    labelFr: "Standard",
    labelEn: "Standard",
    rangeFr: "5 à 6 personnes",
    rangeEn: "5 to 6 people",
    priceFlat: 790,
    isFeatured: true,
  },
  {
    id: "essentielle-complete",
    labelFr: "Complète",
    labelEn: "Complete",
    rangeFr: "7 à 8 personnes",
    rangeEn: "7 to 8 people",
    priceFlat: 1190,
  },
];

/**
 * Sous-tiers Approfondie (2 jours) — nouveau format Sprint 14.10.4.
 * Tarifs proposés alignés sur Essentielle × 1.8 (proxy de 2 jours sans
 * doublement strict). Will à valider / ajuster.
 */
const APPROFONDIE_SUB_TIERS: ReadonlyArray<PricingSubTier> = [
  {
    id: "approfondie-intimiste",
    labelFr: "Intimiste",
    labelEn: "Intimate",
    rangeFr: "2 à 4 personnes",
    rangeEn: "2 to 4 people",
    priceFlat: 890,
  },
  {
    id: "approfondie-standard",
    labelFr: "Standard",
    labelEn: "Standard",
    rangeFr: "5 à 6 personnes",
    rangeEn: "5 to 6 people",
    priceFlat: 1390,
    isFeatured: true,
  },
  {
    id: "approfondie-complete",
    labelFr: "Complète",
    labelEn: "Complete",
    rangeFr: "7 à 8 personnes",
    rangeEn: "7 to 8 people",
    priceFlat: 1990,
  },
];

export const INTERVENTION_TIERS: ReadonlyArray<PricingTier> = [
  {
    id: "intervention-essentielle",
    labelFr: "Essentielle",
    labelEn: "Essential",
    priceFlat: 490,
    durationFr: "1 journée",
    durationEn: "1 day",
    subTiers: ESSENTIELLE_SUB_TIERS,
    descriptionFr: "Format de découverte de l'IA opérationnelle en une journée sur site.",
    descriptionEn: "Discovery format for operational AI in a single on-site day.",
  },
  {
    id: "intervention-approfondie",
    labelFr: "Approfondie",
    labelEn: "Deep dive",
    priceFlat: 890,
    durationFr: "2 jours",
    durationEn: "2 days",
    subTiers: APPROFONDIE_SUB_TIERS,
    descriptionFr:
      "Approfondissement IA sur deux journées consécutives, ateliers pratiques étendus.",
    descriptionEn: "Two consecutive days of AI deep dive with extended hands-on workshops.",
  },
  {
    id: "intervention-conference",
    labelFr: "Conférence",
    labelEn: "Talk",
    onQuote: true,
    durationFr: "1 journée",
    durationEn: "1 day",
    descriptionFr: "Plénière pour grands effectifs sur une journée (séminaires, kick-off annuels).",
    descriptionEn: "Plenary for large audiences on a single day (seminars, annual kick-offs).",
  },
  {
    id: "intervention-dirigeants",
    labelFr: "Dirigeants",
    labelEn: "Executives",
    onQuote: true,
    durationFr: "1 journée",
    durationEn: "1 day",
    descriptionFr: "Cadrage stratégique en huis-clos pour comités de direction sur une journée.",
    descriptionEn: "In-camera strategic framing for executive committees over one day.",
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
