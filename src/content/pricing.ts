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
// - `formatPrice()` retourne la chaîne d'affichage cohérente (« 1 190 € HT »,
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
   * (legacy : split distance/site, désormais inutilisé côté audit). Si présent,
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

/** Audit TPE présentiel — 1 journée complète sur site (Will 2026-05-31 :
    suppression du 490 € distanciel, prix de référence unique 1190 € HT). */
export const AUDIT_FLASH_SUB_TIERS: ReadonlyArray<PricingSubTier> = [
  {
    id: "audit-flash-onsite",
    labelFr: "Audit sur place · 1 journée",
    labelEn: "On-site audit · 1 day",
    rangeFr: "Toute l'entreprise · sur site",
    rangeEn: "Whole company · on site",
    priceFlat: 1190,
    isFeatured: true,
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
    labelFr: "Audit sur place",
    labelEn: "On-site audit",
    // Will 2026-05-31 — présentiel uniquement, 1 journée complète sur site.
    // Suppression du 490 € distanciel ; 1190 € HT devient le prix de référence.
    priceFlat: 1190,
    subTiers: AUDIT_FLASH_SUB_TIERS,
    descriptionFr: "Audit complet de l'entreprise en une journée sur place.",
    descriptionEn: "Complete on-site company audit in one day.",
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
 *   2-8 pers   :   690 € HT (prix d'entrée flagship)
 *   9-15 pers  :   890 € HT (recommandé · effectif moyen)
 *   16-30 pers : 1 490 € HT (grande équipe)
 *
 * Dégressivité €/pers (au pire de chaque bracket) :
 *     86 € → 59 € → 50 €/pers ✅ vraiment dégressif
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
    priceFlat: 690,
  },
  {
    id: "essentielle-standard",
    labelFr: "Standard",
    labelEn: "Standard",
    rangeFr: "9 à 15 personnes",
    rangeEn: "9 to 15 people",
    priceFlat: 890,
    isFeatured: true,
  },
  {
    id: "essentielle-complete",
    labelFr: "Complète",
    labelEn: "Complete",
    rangeFr: "16 à 30 personnes",
    rangeEn: "16 to 30 people",
    priceFlat: 1490,
  },
];

/**
 * Sous-tiers Approfondie (2 jours) — Sprint 14.10.5c (Will 2026-05-08).
 *
 * Brackets identiques à Essentielle (Will : « pas 2-4 mais 2-8, pas 5-6
 * mais 9-15, pas 7-8 mais 16-30 »). Cohérence stricte avec Essentielle —
 * le 2e jour reflète le coût marginal (prof déjà mobilisé, logement+repas
 * déjà payés, pas doublement strict).
 *
 *   2-8 pers   : 1 190 € HT
 *   9-15 pers  : 1 590 € HT
 *   16-30 pers : 2 490 € HT
 *
 * Dégressivité €/pers (au pire de chaque bracket) :
 *     149 € → 106 € → 83 €/pers ✅ vraiment dégressif
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
    priceFlat: 1190,
  },
  {
    id: "approfondie-standard",
    labelFr: "Standard",
    labelEn: "Standard",
    rangeFr: "9 à 15 personnes",
    rangeEn: "9 to 15 people",
    priceFlat: 1590,
    isFeatured: true,
  },
  {
    id: "approfondie-complete",
    labelFr: "Complète",
    labelEn: "Complete",
    rangeFr: "16 à 30 personnes",
    rangeEn: "16 to 30 people",
    priceFlat: 2490,
  },
];

export const INTERVENTION_TIERS: ReadonlyArray<PricingTier> = [
  {
    // Sprint 14.10.7 (Will 2026-05-11) — palier 4 h Collectives. Prix
    // unique partagé par les 2 formations 4 h actuelles (Démarrage IA
    // Express + Atelier IA ciblé). Si plus tard Will différencie les
    // tarifs, splitter en 2 tiers distincts.
    id: "intervention-4h",
    labelFr: "Formation 4 heures",
    labelEn: "4-hour training",
    priceFlat: 590,
    durationFr: "Demi-journée (4 h)",
    durationEn: "Half-day (4 h)",
    groupSizeFr: "2 à 20 personnes",
    groupSizeEn: "2 to 20 people",
    descriptionFr:
      "Format express demi-journée pour découvrir l'IA ou cadrer un cas d'usage métier précis.",
    descriptionEn: "Half-day express format to discover AI or frame a specific business use case.",
    audienceSizes: ["tpe", "pme"],
  },
  {
    id: "intervention-essentielle",
    labelFr: "Essentielle",
    labelEn: "Essential",
    priceFlat: 690,
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
    priceFlat: 1190,
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
    // Will 2026-05-24 — variante 1-to-1 pour collaborateur clé (non-dirigeant).
    // Même format journée 1-to-1 que `intervention-dirigeants`, prix d'entrée
    // 890 € HT (différenciation tarifaire vs 990 € dirigeant).
    id: "intervention-membre-equipe",
    labelFr: "Membre équipe",
    labelEn: "Team member",
    priceFlat: 890,
    durationFr: "1 journée",
    durationEn: "1 day",
    groupSizeFr: "1 collaborateur (1-to-1)",
    groupSizeEn: "1 employee (1-on-1)",
    descriptionFr:
      "Journée 1-to-1 avec un collaborateur clé pour monter en compétence sur ses propres cas (IA opérationnelle, automatisations métier).",
    descriptionEn:
      "1-on-1 day with a key team member to upskill on their own real cases (operational AI, business automations).",
    audienceSizes: ["tpe", "pme", "eti", "grande-entreprise"],
  },
  {
    // Will (audit /interventions 2026-05-12) — passage de Sur devis à prix
    // fixe pour groupe 2 à 8 personnes. Bookable direct calendrier.
    // 2026-05-24 (Will) : alignement à 990 € HT (parité avec Gagner du
    // temps / Dirigeants, journée flagship 1-to-many sur Claude).
    id: "intervention-claude",
    labelFr: "Intervention Claude",
    labelEn: "Claude intervention",
    priceFlat: 990,
    durationFr: "1 journée",
    durationEn: "1 day",
    groupSizeFr: "2 à 8 personnes",
    groupSizeEn: "2 to 8 people",
    descriptionFr:
      "Une journée 100 % dédiée à Claude (Anthropic) : Chat · Cowork · Code. Petit groupe pour profondeur maximale.",
    descriptionEn:
      "A full day 100 % focused on Claude (Anthropic): Chat · Cowork · Code. Small group for maximum depth.",
    audienceSizes: ["tpe", "pme"],
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
// UN-A-UN (coaching 1-to-1) — Sprint S+2 City Domination Phase 1
// ============================================================================
//
// Décision Will Option A 2026-05-18 : naming brand canonique `un-a-un` (URL +
// breadcrumb) mais sémantique "coaching dirigeant 1-to-1" cohérente avec le
// tier existant `intervention-dirigeants` (déjà 990 € HT). On EXPOSE ce tier
// sous le nom `UN_A_UN_TIERS` pour qu'il alimente la 4e card hub ville +
// VilleServicePageTemplate sans dupliquer la définition.
//
// V1 : 1 seul palier (990 € HT, 1 journée 1-to-1 avec le dirigeant). Sprint
// S+3 pourra étendre avec d'autres formats (½ journée, journée + suivi 1 mois,
// programme 3 mois multi-sessions) sans casser la signature `Service` JSON-LD.

const INTERVENTION_DIRIGEANTS_TIER = INTERVENTION_TIERS.find(
  (t) => t.id === "intervention-dirigeants",
);

if (!INTERVENTION_DIRIGEANTS_TIER) {
  throw new Error(
    "pricing.ts invariant violation: intervention-dirigeants tier missing in INTERVENTION_TIERS",
  );
}

export const UN_A_UN_TIERS: ReadonlyArray<PricingTier> = [INTERVENTION_DIRIGEANTS_TIER];

/**
 * Coaching 1-to-1 récurrent (contrat 6/12/24 mois) — Refonte un-a-un 2026-05-30
 * (Will). Palier d'abonnement coaching individuel régulier, distinct de la
 * journée one-shot (`intervention-dirigeants` / `intervention-membre-equipe`).
 * Exposé séparément (pas dans PRICING_CATEGORIES) car c'est une formule
 * d'accompagnement continu, consommée uniquement par la page `/un-a-un`.
 */
export const UN_A_UN_RECURRING_TIER: PricingTier = {
  id: "un-a-un-recurrent",
  labelFr: "Coaching régulier 1-to-1",
  labelEn: "Recurring 1-to-1 coaching",
  priceFlat: 790,
  recurrenceFr: "/session",
  recurrenceEn: "/session",
  durationFr: "1 session/mois ou /2 mois · contrat 6, 12 ou 24 mois",
  durationEn: "1 session/month or /2 months · 6, 12 or 24-month contract",
  groupSizeFr: "1 personne (1-to-1)",
  groupSizeEn: "1 person (1-on-1)",
  descriptionFr:
    "Stratégie d'évolution IA de bout en bout : sessions régulières et outils personnels pour votre activité, pour faire sauter les tâches répétitives et alléger la charge mentale.",
  descriptionEn:
    "End-to-end AI evolution strategy: regular sessions and personal tools for your activity, to eliminate repetitive tasks and lighten mental load.",
  audienceSizes: ["tpe", "pme", "eti", "grande-entreprise"],
};

// ============================================================================
// IMPLÉMENTATION IA — paliers
// ============================================================================

export const IMPLEMENTATION_TIERS: ReadonlyArray<PricingTier> = [
  {
    // 2026-05-24 (Will) — rebrand « POC » → « Pilote IA » (mot simple,
    // compréhensible sans jargon tech). L'id `impl-poc` reste stable
    // (URLs, JSON-LD, intégrations DB inchangés). Prix d'entrée conservé.
    id: "impl-poc",
    labelFr: "Pilote IA",
    labelEn: "AI Pilot",
    priceMin: 990,
    priceMax: 4900,
    descriptionFr: "Pilote ciblé sur un cas d'usage prioritaire — preuve de valeur rapide.",
    descriptionEn: "Pilot targeting one priority use case — quick proof of value.",
    audienceSizes: ["tpe"],
  },
  {
    // 2026-05-24 (Will) — passage en Sur devis (périmètre trop variable
    // pour publier un range pertinent : nombre de cas d'usage, intégrations,
    // formation interne ajustent fortement le chiffrage).
    id: "impl-mission-pme",
    labelFr: "Mission PME",
    labelEn: "SME mission",
    onQuote: true,
    descriptionFr: "Déploiement multi-cas + formation des équipes en interne.",
    descriptionEn: "Multi-case deployment + internal team training.",
    audienceSizes: ["pme"],
  },
  {
    // 2026-05-24 (Will) — passage en Sur devis (gouvernance + intégrations
    // avancées trop variables pour publier un range).
    id: "impl-mission-eti",
    labelFr: "Mission ETI",
    labelEn: "Mid-cap mission",
    onQuote: true,
    descriptionFr: "Déploiement transverse + gouvernance IA + intégrations avancées.",
    descriptionEn: "Transverse deployment + AI governance + advanced integrations.",
    audienceSizes: ["eti"],
  },
  {
    // 2026-05-24 (Will) — sur devis pur (pas de floor publié).
    id: "impl-grand-programme",
    labelFr: "Grand programme",
    labelEn: "Large program",
    onQuote: true,
    descriptionFr: "Programmes annuels pour grandes entreprises et grands comptes.",
    descriptionEn: "Annual programs for large enterprises and key accounts.",
    audienceSizes: ["grande-entreprise"],
  },
  // Sprint 14.10.5 — IA custom d'entreprise (offre tech-spécifique).
  // Orthogonale aux tiers par taille (Pilote/PME/ETI/grand-programme) ;
  // s'applique aux clients qui veulent un projet sur mesure indépendamment
  // de la taille. `IMPLEMENTATIONS::ia-custom` (content/implementation.ts)
  // dérive son prix de ce tier.
  // 2026-05-24 (Will) — passage en Sur devis.
  {
    id: "impl-ia-custom",
    labelFr: "IA custom d'entreprise",
    labelEn: "Custom enterprise AI",
    onQuote: true,
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

// ============================================================================
// CODAGE & DÉVELOPPEMENT WEB — plateformes / SaaS sur mesure avec IA intégrée
// 2026-05-29 (Will) — tier ajouté pour que les pages /codage-developpement
// dérivent leurs prix de la SSOT (avant : 2 000–30 000 € en dur). Ajuster les
// bornes ici les propage partout (pages + tokens prose).
// ============================================================================

export const CODAGE_TIERS: ReadonlyArray<PricingTier> = [
  {
    id: "codage-web",
    labelFr: "Codage & développement web",
    labelEn: "Web coding & development",
    // Du chatbot RAG greffé (entrée) à la plateforme sur mesure complète.
    priceMin: 2000,
    priceMax: 30000,
    descriptionFr:
      "Développement web sur mesure avec IA intégrée — du chatbot RAG à la plateforme SaaS complète. Forfait fixe, devis ferme avant démarrage.",
    descriptionEn:
      "Custom web development with integrated AI — from RAG chatbot to full SaaS platform. Fixed fee, firm quote before kick-off.",
    audienceSizes: ["tpe", "pme", "eti", "grande-entreprise"],
  },
];

/** Catalogue complet des prestations Axion-IA — facilite la dérivation et la
 *  recherche par id depuis n'importe quel consommateur. */
export const PRICING_CATEGORIES = {
  audit: AUDIT_TIERS,
  interventions: INTERVENTION_TIERS,
  implementation: IMPLEMENTATION_TIERS,
  maintenance: MAINTENANCE_TIERS,
  codage: CODAGE_TIERS,
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
  codage: CODAGE_TIERS,
} as const;
