// Source de vérité unique des tarifs publics Axion-IA — Sprint 14.10.2 (2026-05-08).
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
  /**
   * Variante sur site quand un tier offre un split distance/présentiel
   * (ex Audit Flash : 490 € à distance, 890 € sur site). Si présent,
   * `priceFlat` reste le prix d'entrée (à distance).
   */
  priceFlatOnsite?: number;
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
  /**
   * Périodicité du prix (ex « /mois » pour la maintenance). Quand présent,
   * `formatPrice()` suffixe automatiquement la chaîne (« 290 € HT/mois »).
   */
  recurrenceFr?: string;
  /** Périodicité EN (ex « /month »). */
  recurrenceEn?: string;
  /** Description courte FR (1-2 phrases). */
  descriptionFr: string;
  /** Description courte EN. */
  descriptionEn: string;
  /** Tailles INSEE ciblées (TPE/PME/ETI/grande-entreprise). Optionnel. */
  audienceSizes?: ReadonlyArray<"tpe" | "pme" | "eti" | "grande-entreprise">;
  /** Effectif visé (ex « 2 à 20 personnes »). Optionnel. */
  groupSizeFr?: string;
  /** Effectif EN. */
  groupSizeEn?: string;
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

/** Sous-tiers Audit Flash — split distance / sur site (Sprint 14.10.5). */
export const AUDIT_FLASH_SUB_TIERS: ReadonlyArray<PricingSubTier> = [
  {
    id: "audit-flash-distance",
    labelFr: "Flash distance",
    labelEn: "Flash remote",
    rangeFr: "1 zone d'usage · à distance",
    rangeEn: "1 area · remote",
    priceFlat: 490,
    isFeatured: true,
  },
  {
    id: "audit-flash-onsite",
    labelFr: "Flash terrain",
    labelEn: "Flash on site",
    rangeFr: "Sur site · 1 jour",
    rangeEn: "On site · 1 day",
    priceFlat: 890,
  },
];

/** Sous-tiers Audit Ciblé (PME) — Solo / Standard / Avancé. */
export const AUDIT_CIBLE_SUB_TIERS: ReadonlyArray<PricingSubTier> = [
  {
    id: "audit-cible-solo",
    labelFr: "Ciblé Solo",
    labelEn: "Targeted Solo",
    rangeFr: "À distance · périmètre simple",
    rangeEn: "Remote · simple scope",
    priceFlat: 1900,
  },
  {
    id: "audit-cible-standard",
    labelFr: "Ciblé Standard",
    labelEn: "Targeted Standard",
    rangeFr: "Mix site + visio",
    rangeEn: "Mix on-site + remote",
    priceFlat: 2900,
    isFeatured: true,
  },
  {
    id: "audit-cible-avance",
    labelFr: "Ciblé Avancé",
    labelEn: "Targeted Advanced",
    rangeFr: "Service complexe, multi-acteurs",
    rangeEn: "Complex, multi-stakeholder",
    priceFlat: 3900,
  },
];

/** Sous-tiers Audit Stratégique PME — 20-50 / 50-250 salariés. */
export const AUDIT_STRATEGIQUE_PME_SUB_TIERS: ReadonlyArray<PricingSubTier> = [
  {
    id: "audit-strategique-pme-20-50",
    labelFr: "PME 20-50 salariés",
    labelEn: "SMB 20-50 staff",
    rangeFr: "2 services majeurs",
    rangeEn: "2 major services",
    priceFlat: 4900,
  },
  {
    id: "audit-strategique-pme-50-250",
    labelFr: "PME 50-250 salariés",
    labelEn: "SMB 50-250 staff",
    rangeFr: "3-4 services majeurs",
    rangeEn: "3-4 major services",
    priceFlat: 9900,
    isFeatured: true,
  },
];

/** Sous-tiers Audit Stratégique ETI — 1-2 BU vs multi-BU. */
export const AUDIT_STRATEGIQUE_ETI_SUB_TIERS: ReadonlyArray<PricingSubTier> = [
  {
    id: "audit-strategique-eti-base",
    labelFr: "1-2 BU · 1-2 sites",
    labelEn: "1-2 BU · 1-2 sites",
    rangeFr: "3-4 services",
    rangeEn: "3-4 services",
    priceFlat: 12000,
    isFeatured: true,
  },
];

export const AUDIT_TIERS: ReadonlyArray<PricingTier> = [
  {
    id: "audit-flash",
    labelFr: "Audit Flash",
    labelEn: "Flash audit",
    priceFlat: 490,
    // Sprint 14.10.5 — split distance / sur site (Will 2026-05-08).
    // 490 € à distance · 890 € sur site (jour terrain).
    priceFlatOnsite: 890,
    subTiers: AUDIT_FLASH_SUB_TIERS,
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
    subTiers: AUDIT_CIBLE_SUB_TIERS,
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
    subTiers: AUDIT_STRATEGIQUE_PME_SUB_TIERS,
    descriptionFr: "Audit complet multi-départements pour PME ambitieuses.",
    descriptionEn: "Full multi-department audit for ambitious SMEs.",
    audienceSizes: ["pme"],
  },
  {
    id: "audit-strategique-eti",
    labelFr: "Audit Stratégique ETI",
    labelEn: "Mid-cap Strategic audit",
    priceMin: 12000,
    subTiers: AUDIT_STRATEGIQUE_ETI_SUB_TIERS,
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
 * Sous-tiers Essentielle (1 jour) — Sprint 14.10.5c (Will 2026-05-08).
 *
 * Brackets canoniques imposés par Will : 2-8 / 9-15 / 16-30 personnes.
 * Identiques à Approfondie (même grille pour tous les formats).
 *
 *   2-8 pers   :   490 € HT (prix d'entrée flagship)
 *   9-15 pers  :   790 € HT (recommandé · effectif moyen)
 *   16-30 pers : 1 190 € HT (grande équipe)
 *
 * Dégressivité €/pers (au pire de chaque bracket) :
 *     61 € → 53 € → 40 €/pers ✅ vraiment dégressif
 *
 * Au-delà de 30 personnes : Conférence (Sur devis) ou Sur demande.
 *
 * IDs `essentielle-intimiste/standard/complete` conservés pour compat
 * avec les URLs `?tier=intimiste` du BookingCalendar (les LABELS décrivent
 * le type de groupe — petit / moyen / grand — pas la fourchette précise).
 */
export const ESSENTIELLE_SUB_TIERS: ReadonlyArray<PricingSubTier> = [
  {
    id: "essentielle-intimiste",
    labelFr: "Intimiste",
    labelEn: "Intimate",
    rangeFr: "2 à 8 personnes",
    rangeEn: "2 to 8 people",
    priceFlat: 490,
  },
  {
    id: "essentielle-standard",
    labelFr: "Standard",
    labelEn: "Standard",
    rangeFr: "9 à 15 personnes",
    rangeEn: "9 to 15 people",
    priceFlat: 790,
    isFeatured: true,
  },
  {
    id: "essentielle-complete",
    labelFr: "Complète",
    labelEn: "Complete",
    rangeFr: "16 à 30 personnes",
    rangeEn: "16 to 30 people",
    priceFlat: 1190,
  },
];

/**
 * Sous-tiers Approfondie (2 jours) — Sprint 14.10.5c (Will 2026-05-08).
 *
 * Brackets identiques à Essentielle (Will : « pas 2-4 mais 2-8, pas 5-6
 * mais 9-15, pas 7-8 mais 16-30 »). Cohérence stricte avec Essentielle :
 *   Approfondie N pers (2j) = Essentielle N pers (1j) × 1.8
 *   Le coefficient 1.8 reflète le coût marginal du 2e jour (~80 % du 1er :
 *   prof déjà mobilisé, logement+repas déjà payés, pas doublement strict).
 *
 *   2-8 pers   :   880 € HT (=  490 × 1.8 arrondi)
 *   9-15 pers  : 1 420 € HT (=  790 × 1.8 arrondi)
 *   16-30 pers : 2 140 € HT (= 1190 × 1.8 arrondi)
 *
 * Dégressivité €/pers (au pire de chaque bracket) :
 *     110 € → 95 € → 71 €/pers ✅ vraiment dégressif
 *
 * Au-delà de 30 personnes : Conférence (Sur devis) ou Sur demande.
 */
export const APPROFONDIE_SUB_TIERS: ReadonlyArray<PricingSubTier> = [
  {
    id: "approfondie-intimiste",
    labelFr: "Intimiste",
    labelEn: "Intimate",
    rangeFr: "2 à 8 personnes",
    rangeEn: "2 to 8 people",
    priceFlat: 880,
  },
  {
    id: "approfondie-standard",
    labelFr: "Standard",
    labelEn: "Standard",
    rangeFr: "9 à 15 personnes",
    rangeEn: "9 to 15 people",
    priceFlat: 1420,
    isFeatured: true,
  },
  {
    id: "approfondie-complete",
    labelFr: "Complète",
    labelEn: "Complete",
    rangeFr: "16 à 30 personnes",
    rangeEn: "16 to 30 people",
    priceFlat: 2140,
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
    groupSizeFr: "2 à 30 personnes",
    groupSizeEn: "2 to 30 people",
    subTiers: ESSENTIELLE_SUB_TIERS,
    descriptionFr: "Format de découverte de l'IA opérationnelle en une journée sur site.",
    descriptionEn: "Discovery format for operational AI in a single on-site day.",
  },
  {
    id: "intervention-temps",
    labelFr: "Gagner du temps",
    labelEn: "Save Time",
    priceFlat: 990,
    durationFr: "1 journée",
    durationEn: "1 day",
    groupSizeFr: "2 à 20 personnes",
    groupSizeEn: "2 to 20 people",
    descriptionFr:
      "Une journée pour gagner du temps concrètement : automatisations IA sur les tâches récurrentes et intégration dans le flux de travail quotidien.",
    descriptionEn:
      "One day to save time concretely: AI automations on recurring tasks integrated into the daily workflow.",
    audienceSizes: ["tpe", "pme", "eti"],
  },
  {
    id: "intervention-approfondie",
    labelFr: "Approfondie",
    labelEn: "Deep dive",
    priceFlat: 880,
    durationFr: "2 jours",
    durationEn: "2 days",
    groupSizeFr: "2 à 30 personnes",
    groupSizeEn: "2 to 30 people",
    subTiers: APPROFONDIE_SUB_TIERS,
    descriptionFr:
      "Approfondissement IA sur deux journées consécutives — même grille d'effectif qu'Essentielle (2-8 / 9-15 / 16-30 personnes), tarif × 1.8 pour le 2e jour.",
    descriptionEn:
      "Two-day AI deep dive — same headcount grid as Essential (2-8 / 9-15 / 16-30 people), price × 1.8 for the 2nd day.",
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
    // Sprint 14.10.7 (Will 2026-05-11) — recentrage sur LE dirigeant (singulier).
    // Plus de CODIR/COMEX : c'est une journée 1-to-1 avec le dirigeant pour
    // structurer l'entreprise et chiffrer précisément les gains d'implémentation IA.
    id: "intervention-dirigeants",
    labelFr: "Dirigeants",
    labelEn: "Executives",
    priceFlat: 990,
    durationFr: "1 journée",
    durationEn: "1 day",
    groupSizeFr: "1 dirigeant (1-to-1)",
    groupSizeEn: "1 executive (1-on-1)",
    descriptionFr:
      "Journée 1-to-1 avec le dirigeant pour structurer l'entreprise et chiffrer les gains d'implémentation IA.",
    descriptionEn:
      "1-on-1 day with the executive to structure the company and quantify AI implementation gains.",
    audienceSizes: ["tpe", "pme", "eti", "grande-entreprise"],
  },
  {
    id: "intervention-claude",
    labelFr: "Intervention Claude",
    labelEn: "Claude intervention",
    onQuote: true,
    durationFr: "1 journée",
    durationEn: "1 day",
    descriptionFr:
      "Une journée 100 % dédiée à Claude (Anthropic) : Chat · Cowork · Code. Tarif sur devis.",
    descriptionEn:
      "A full day 100 % focused on Claude (Anthropic): Chat · Cowork · Code. Quoted on demand.",
  },
  {
    id: "intervention-sur-demande",
    labelFr: "Sur demande",
    labelEn: "On request",
    onQuote: true,
    descriptionFr:
      "Configurations hors-cadre : multi-sites, multi-jours, offsite, contenus ultra-spécifiques. Cadrage et devis personnalisés.",
    descriptionEn:
      "Non-standard setups: multi-site, multi-day, offsite, ultra-specific content. Custom framing and quote.",
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
  // Sprint 14.10.5 — IA custom d'entreprise (offre tech-spécifique).
  // Orthogonale aux tiers par taille (POC/PME/ETI/grand-programme) ;
  // s'applique aux clients qui veulent un projet sur mesure indépendamment
  // de la taille. `IMPLEMENTATIONS::ia-custom` (content/implementation.ts)
  // dérive son prix de ce tier.
  {
    id: "impl-ia-custom",
    labelFr: "IA custom d'entreprise",
    labelEn: "Custom enterprise AI",
    priceMin: 8000,
    priceMax: 50000,
    durationFr: "4 à 12 semaines",
    durationEn: "4 to 12 weeks",
    descriptionFr:
      "Implémentation IA sur mesure pour grands comptes : modèles fine-tuned, intégration profonde, équipe dédiée.",
    descriptionEn:
      "Tailor-made AI implementation for large accounts: fine-tuned models, deep integration, dedicated team.",
    audienceSizes: ["pme", "eti", "grande-entreprise"],
  },
];

// ============================================================================
// MAINTENANCE — support post-livraison récurrent
// Sprint 14.10.5 (Will 2026-05-08) — Toute prestation inclut 30 jours de
// support corrigé gratuit. Au-delà, contrat optionnel `maintenance-standard`.
// ============================================================================

export const MAINTENANCE_TIERS: ReadonlyArray<PricingTier> = [
  {
    id: "maintenance-standard",
    labelFr: "Maintenance standard",
    labelEn: "Standard maintenance",
    priceFlat: 290,
    recurrenceFr: "/mois",
    recurrenceEn: "/month",
    durationFr: "4 h/mois forfait",
    durationEn: "4 h/month flat",
    descriptionFr:
      "Contrat de maintenance optionnel après les 30 jours de support post-livraison inclus. Forfait 4 h/mois.",
    descriptionEn:
      "Optional maintenance contract after the 30-day included post-delivery support. 4 h/month flat.",
  },
];

/** Catalogue complet des prestations Axion-IA — facilite la dérivation et la
 *  recherche par id depuis n'importe quel consommateur. */
export const PRICING_CATEGORIES = {
  audit: AUDIT_TIERS,
  interventions: INTERVENTION_TIERS,
  implementation: IMPLEMENTATION_TIERS,
  maintenance: MAINTENANCE_TIERS,
} as const;

// ============================================================================
// Helpers
// ============================================================================

import { fmtNumber } from "@/lib/intl";

export interface FormatAmountOptions {
  /**
   * Si `true`, omet le suffixe « HT » / « (excl. VAT) ». Utile pour les
   * titres, badges, hero et tout endroit où la mention HT est implicite.
   * Défaut : `false` (canonical, affiche « HT »).
   */
  compact?: boolean;
}

/**
 * Formate un montant brut en € HT — « 490 € HT » (FR) / « €490 (excl. VAT) » (EN).
 * Avec `{ compact: true }` : « 490 € » / « €490 ».
 * Utile quand le montant n'est pas un PricingTier (homepage messages, copy
 * SEO, etc.).
 */
export function formatAmount(
  amount: number,
  locale: "fr" | "en" = "fr",
  opts: FormatAmountOptions = {},
): string {
  const compact = opts.compact === true;
  if (locale === "fr") {
    return compact ? `${fmtNumber(amount, "fr")} €` : `${fmtNumber(amount, "fr")} € HT`;
  }
  return compact ? `€${fmtNumber(amount, "en")}` : `€${fmtNumber(amount, "en")} (excl. VAT)`;
}

/**
 * Formate un range « min → max » (en € HT). Utilisé pour les audit `priceFrom`.
 * `1900, 3900, "fr"` → « 1 900 € → 3 900 € HT ».
 * Avec `{ compact: true }` : « 1 900 € → 3 900 € ».
 */
export function formatAmountRange(
  min: number,
  max: number,
  locale: "fr" | "en" = "fr",
  opts: FormatAmountOptions = {},
): string {
  const compact = opts.compact === true;
  if (locale === "fr") {
    return compact
      ? `${fmtNumber(min, "fr")} € → ${fmtNumber(max, "fr")} €`
      : `${fmtNumber(min, "fr")} € → ${fmtNumber(max, "fr")} € HT`;
  }
  return compact
    ? `€${fmtNumber(min, "en")} → €${fmtNumber(max, "en")}`
    : `€${fmtNumber(min, "en")} → €${fmtNumber(max, "en")} (excl. VAT)`;
}

/**
 * Préfixe « À partir de » / « Starting at » suivi du prix d'entrée. Utile
 * pour les CTA et labels prix. Sprint 14.10.7 (Will 2026-05-11) — harmonisé
 * sur « À partir de » (au lieu de « dès ») pour cohérence end-to-end sur
 * tout le site. Comportement aligné sur `getFromLabel`.
 * `getEntryLabel(AUDIT_TIERS, "fr")` → « À partir de 490 € HT ».
 */
export function getEntryLabel(
  tiers: ReadonlyArray<PricingTier>,
  locale: "fr" | "en" = "fr",
  opts: FormatAmountOptions = {},
): string {
  const price = getEntryPriceEur(tiers);
  if (price == null) return locale === "fr" ? "Sur devis" : "On request";
  return locale === "fr"
    ? `À partir de ${formatAmount(price, "fr", opts)}`
    : `Starting at ${formatAmount(price, "en", opts)}`;
}

/**
 * Préfixe « À partir de » / « From » suivi du prix d'entrée. Variante longue
 * de `getEntryLabel`, utilisée dans les meta SEO.
 */
export function getFromLabel(
  tiers: ReadonlyArray<PricingTier>,
  locale: "fr" | "en" = "fr",
  opts: FormatAmountOptions = {},
): string {
  const price = getEntryPriceEur(tiers);
  if (price == null) return locale === "fr" ? "Sur devis" : "On request";
  return locale === "fr"
    ? `À partir de ${formatAmount(price, "fr", opts)}`
    : `From ${formatAmount(price, "en", opts)}`;
}

/**
 * Lookup type-safe d'un tier par id. Throw si introuvable — c'est intentionnel :
 * un id manquant indique une erreur de migration et doit casser tôt.
 */
export function getTierById<T extends PricingTier>(tiers: ReadonlyArray<T>, id: string): T {
  const tier = tiers.find((t) => t.id === id);
  if (!tier) {
    throw new Error(`[pricing] tier introuvable : "${id}"`);
  }
  return tier;
}

/**
 * Variante du label pour Audit Flash — gère le split distance/sur-site
 * « 490 € à distance · 890 € sur site ». Si le tier n'a pas de
 * `priceFlatOnsite`, retombe sur le format `formatPrice` standard.
 */
export function formatPriceWithOnsite(
  tier: PricingTier,
  locale: "fr" | "en" = "fr",
  opts: FormatAmountOptions = {},
): string {
  if (typeof tier.priceFlat === "number" && typeof tier.priceFlatOnsite === "number") {
    if (locale === "fr") {
      return `${formatAmount(tier.priceFlat, "fr", opts)} (à distance) · ${formatAmount(tier.priceFlatOnsite, "fr", opts)} (sur site)`;
    }
    return `${formatAmount(tier.priceFlat, "en", opts)} (remote) · ${formatAmount(tier.priceFlatOnsite, "en", opts)} (on site)`;
  }
  return formatPrice(tier, locale);
}

/**
 * Formate un tier pour affichage. Retourne « 490 € HT », « 1 900 - 3 900 € HT »,
 * « À partir de 12 000 € HT » ou « Sur devis » selon les bornes définies.
 * Suffixe automatiquement la périodicité quand `recurrenceFr/En` est défini
 * (ex « 290 € HT/mois »). Sprint 14.10.7 — « À partir de » harmonisé.
 */
export function formatPrice(tier: PricingTier, locale: "fr" | "en" = "fr"): string {
  const fmt = (n: number): string => fmtNumber(n, locale);
  const currency = locale === "fr" ? " € HT" : " (excl. VAT) €";
  const recurrence = locale === "fr" ? (tier.recurrenceFr ?? "") : (tier.recurrenceEn ?? "");

  if (tier.onQuote && !tier.priceMin && !tier.priceMax && !tier.priceFlat) {
    return locale === "fr" ? "Sur devis" : "On quote";
  }
  if (typeof tier.priceFlat === "number") {
    return `${fmt(tier.priceFlat)}${currency}${recurrence}`;
  }
  if (typeof tier.priceMin === "number" && typeof tier.priceMax === "number") {
    return `${fmt(tier.priceMin)} - ${fmt(tier.priceMax)}${currency}${recurrence}`;
  }
  if (typeof tier.priceMin === "number") {
    return `${locale === "fr" ? "À partir de" : "Starting at"} ${fmt(tier.priceMin)}${currency}${recurrence}`;
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
  maintenance: MAINTENANCE_TIERS,
} as const;
