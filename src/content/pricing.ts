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
  /** Prix HT en EUR. Plancher (« à partir de ») si `isFromPrice` est true. */
  priceFlat: number;
  /**
   * Si `true`, `priceFlat` est un **plancher** et non un prix ferme : l'UI doit
   * afficher « À partir de X € HT » (cf. `formatAmount(..., { from: true })`).
   * Le champ reste `priceFlat` — `PricingSubTier` n'a volontairement pas de
   * `priceMin` : le montant reste un scalaire unique, seule sa présentation
   * change. Défaut : `false` (prix ferme).
   */
  isFromPrice?: boolean;
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
   * Si `true`, `priceFlat` est un **plancher** et non un prix ferme : l'UI
   * affiche « À partir de X € HT ». Miroir d'`isFromPrice` sur `PricingSubTier`.
   *
   * Décision Will 2026-07-17 : les audits s'annoncent TOUJOURS en « à partir
   * de » (TPE dès 1 190 €, PME/ETI/grandes entreprises dès 1 900 €) — le
   * chiffrage réel se fait au cas par cas.
   *
   * Opt-in par tier, volontairement : `priceFlat` reste un prix FERME pour les
   * interventions, le 1-to-1 et la maintenance (« 290 € HT/mois » ne doit pas
   * devenir « À partir de 290 € HT/mois »). Lu par `formatPrice()` et par
   * `formatTierPrice()` — jamais par les usages transactionnels (booking,
   * JSON-LD `lowPrice`), qui ont besoin du montant ferme réellement débité.
   * Défaut : `false`.
   */
  isFromPrice?: boolean;
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
    // Will 2026-07-17 — « toujours à partir de » : la carte marketing s'aligne
    // sur l'en-tête du tier (« À partir de 1 190 € »). Le montant est inchangé
    // et reste FERME côté transaction : `booking-catalog.ts` / `intervention-
    // type.ts` lisent `priceFlat` en tant que NOMBRE (cents débités au slot) et
    // n'ont pas connaissance de ce flag d'affichage.
    priceFlat: 1190,
    isFromPrice: true,
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
    // Will 2026-07-17 — « de partout à partir de » : aucun prix d'audit ne
    // s'affiche en ferme, le chiffrage se fait au cas par cas selon le
    // périmètre réel. Montant inchangé, seule la présentation change.
    priceFlat: 1900,
    isFromPrice: true,
  },
  {
    id: "audit-cible-standard",
    labelFr: "Ciblé Standard",
    labelEn: "Targeted Standard",
    rangeFr: "Mix site + visio",
    rangeEn: "Mix on-site + remote",
    // Will 2026-07-17 — « de partout à partir de » : aucun prix d'audit ne
    // s'affiche en ferme, le chiffrage se fait au cas par cas selon le
    // périmètre réel. Montant inchangé, seule la présentation change.
    priceFlat: 2900,
    isFromPrice: true,
    isFeatured: true,
  },
  {
    id: "audit-cible-avance",
    labelFr: "Ciblé Avancé",
    labelEn: "Targeted Advanced",
    rangeFr: "Service complexe, multi-acteurs",
    rangeEn: "Complex, multi-stakeholder",
    // Will 2026-07-17 — « de partout à partir de » : aucun prix d'audit ne
    // s'affiche en ferme, le chiffrage se fait au cas par cas selon le
    // périmètre réel. Montant inchangé, seule la présentation change.
    priceFlat: 3900,
    isFromPrice: true,
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
    // Will 2026-07-17 — « de partout à partir de » : aucun prix d'audit ne
    // s'affiche en ferme, le chiffrage se fait au cas par cas selon le
    // périmètre réel. Montant inchangé, seule la présentation change.
    priceFlat: 4900,
    isFromPrice: true,
  },
  {
    id: "audit-strategique-pme-50-250",
    labelFr: "PME 50-250 salariés",
    labelEn: "SMB 50-250 staff",
    rangeFr: "3-4 services majeurs",
    rangeEn: "3-4 major services",
    // Will 2026-07-17 — « de partout à partir de » : aucun prix d'audit ne
    // s'affiche en ferme, le chiffrage se fait au cas par cas selon le
    // périmètre réel. Montant inchangé, seule la présentation change.
    priceFlat: 9900,
    isFromPrice: true,
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
    // Will 2026-06-03 — l'ETI n'est plus un prix ferme : « à partir de 1 900 € ·
    // sur devis » (le chiffrage réel se fait au cas par cas).
    // Will 2026-07-17 — `isFromPrice` ajouté : jusqu'ici l'intention ci-dessus
    // n'était pas implémentée et la carte détail rendait « 1 900 € HT » en prix
    // FERME, sous le tier ETI dont l'en-tête annonçait « À partir de 1 900 € ».
    // Le montant est inchangé (le test D-ETI-PRIX 🔒 le verrouille) : seule la
    // présentation devient un plancher, conforme à la décision du 2026-06-03.
    priceFlat: 1900,
    isFromPrice: true,
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
    // Will 2026-07-17 — seul niveau d'audit encore annoncé en prix FERME alors
    // que Ciblé/PME/ETI sont tous en « À partir de 1 900 € ». Décision : les
    // audits s'annoncent TOUJOURS en « à partir de » — TPE dès 1 190 €.
    // Montant inchangé, seule la présentation devient un plancher.
    priceFlat: 1190,
    isFromPrice: true,
    subTiers: AUDIT_FLASH_SUB_TIERS,
    descriptionFr: "Audit complet de l'entreprise en une journée sur place.",
    descriptionEn: "Complete on-site company audit in one day.",
    audienceSizes: ["tpe"],
  },
  {
    id: "audit-cible",
    labelFr: "Audit Ciblé",
    labelEn: "Targeted audit",
    // Will 2026-06-03 — affichage « À partir de 1 900 € · sur devis » (suppression
    // de la borne haute ; les sous-tiers Solo/Standard/Avancé restent détaillés).
    priceMin: 1900,
    subTiers: AUDIT_CIBLE_SUB_TIERS,
    descriptionFr: "Audit focalisé sur un département ou une fonction.",
    descriptionEn: "Audit focused on one department or function.",
    audienceSizes: ["pme"],
  },
  {
    id: "audit-strategique-pme",
    labelFr: "Audit Stratégique PME",
    labelEn: "SME Strategic audit",
    // Will 2026-06-03 — en-tête uniforme « À partir de 1 900 € · sur devis »
    // (comme Ciblé et ETI). Les sous-tiers détaillés 20-50 (4 900 €) / 50-250
    // (9 900 €) restent visibles sur la page détail.
    priceMin: 1900,
    subTiers: AUDIT_STRATEGIQUE_PME_SUB_TIERS,
    descriptionFr: "Audit complet multi-départements pour PME ambitieuses.",
    descriptionEn: "Full multi-department audit for ambitious SMEs.",
    audienceSizes: ["pme"],
  },
  {
    id: "audit-strategique-eti",
    labelFr: "Audit Stratégique ETI",
    labelEn: "Mid-cap Strategic audit",
    // Will 2026-06-03 — passage de 12 000 € à « À partir de 1 900 € · sur devis ».
    priceMin: 1900,
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
 * Sous-tiers Essentielle (1 jour) — refonte tarifaire Will 2026-06-03.
 *
 * Nouveaux brackets canoniques : 2 paliers identiques pour tous les formats
 * collectifs (Essentielle, Gagner du temps, Intervention Claude, Approfondie) :
 *   2 à 15 personnes  : 2 450 € HT (prix d'entrée)
 *   16 à 30 personnes : 3 950 € HT (grande équipe)
 *
 * IDs `essentielle-standard` (2-15) / `essentielle-complete` (16-30) conservés
 * pour compat avec le shortId du BookingCalendar (`standard` / `complete`) et
 * les URLs `?tier=`. Le palier `intimiste` (3e bracket) est supprimé.
 */
export const ESSENTIELLE_SUB_TIERS: ReadonlyArray<PricingSubTier> = [
  {
    id: "essentielle-standard",
    labelFr: "Petit groupe",
    labelEn: "Small group",
    rangeFr: "2 à 15 personnes",
    rangeEn: "2 to 15 people",
    priceFlat: 2450,
    isFeatured: true,
  },
  {
    id: "essentielle-complete",
    labelFr: "Grand groupe",
    labelEn: "Large group",
    rangeFr: "16 à 30 personnes",
    rangeEn: "16 to 30 people",
    priceFlat: 3950,
  },
];

/**
 * Sous-tiers Approfondie (2 jours) — refonte tarifaire Will 2026-06-03.
 * Mêmes 2 brackets que les autres formats collectifs :
 *   2 à 15 personnes  : 3 250 € HT
 *   16 à 30 personnes : 4 850 € HT
 */
export const APPROFONDIE_SUB_TIERS: ReadonlyArray<PricingSubTier> = [
  {
    id: "approfondie-standard",
    labelFr: "Petit groupe",
    labelEn: "Small group",
    rangeFr: "2 à 15 personnes",
    rangeEn: "2 to 15 people",
    priceFlat: 3250,
    isFeatured: true,
  },
  {
    id: "approfondie-complete",
    labelFr: "Grand groupe",
    labelEn: "Large group",
    rangeFr: "16 à 30 personnes",
    rangeEn: "16 to 30 people",
    priceFlat: 4850,
  },
];

/**
 * Sous-tiers Gagner du temps (1 jour) — refonte tarifaire Will 2026-06-03.
 * Format passé d'un prix unique à 2 paliers (mêmes brackets que les autres).
 *   2 à 15 personnes  : 2 450 € HT
 *   16 à 30 personnes : 3 950 € HT
 */
export const TEMPS_SUB_TIERS: ReadonlyArray<PricingSubTier> = [
  {
    id: "temps-standard",
    labelFr: "Petit groupe",
    labelEn: "Small group",
    rangeFr: "2 à 15 personnes",
    rangeEn: "2 to 15 people",
    priceFlat: 2450,
    isFeatured: true,
  },
  {
    id: "temps-complete",
    labelFr: "Grand groupe",
    labelEn: "Large group",
    rangeFr: "16 à 30 personnes",
    rangeEn: "16 to 30 people",
    priceFlat: 3950,
  },
];

/**
 * Sous-tiers Intervention Claude (1 jour) — refonte tarifaire Will 2026-06-03.
 * Format passé d'un prix unique (2-8 pers) à 2 paliers jusqu'à 30 personnes.
 *   2 à 15 personnes  : 2 650 € HT
 *   16 à 30 personnes : 4 250 € HT
 */
export const CLAUDE_SUB_TIERS: ReadonlyArray<PricingSubTier> = [
  {
    id: "claude-standard",
    labelFr: "Petit groupe",
    labelEn: "Small group",
    rangeFr: "2 à 15 personnes",
    rangeEn: "2 to 15 people",
    priceFlat: 2650,
    isFeatured: true,
  },
  {
    id: "claude-complete",
    labelFr: "Grand groupe",
    labelEn: "Large group",
    rangeFr: "16 à 30 personnes",
    rangeEn: "16 to 30 people",
    priceFlat: 4250,
  },
];

export const INTERVENTION_TIERS: ReadonlyArray<PricingTier> = [
  {
    // Sprint 14.10.7 (Will 2026-05-11) — palier 4 h Collectives. Tier porté
    // par l'unique formation 4 h restante (Démarrage IA Express).
    // Will 2026-07-06 — alignement sur le vrai catalogue V2 : le format 4 h
    // (gamme IA standard, cf. FORMATION_PRICE_MATRIX["ia-standard"]["4h"]) démarre
    // à 1 200 € HT pour 2 à 30 personnes. Ce tier legacy porte le prix d'entrée
    // « à partir de » consommé par la home, les ~400 villes, /tarifs et llms.txt :
    // il passe donc à 1 200 € / 2-30 pour ne plus propager l'ancien 690 € (ex-590)
    // fantôme, qui ne correspondait à aucune formation réellement proposée.
    id: "intervention-4h",
    labelFr: "Formation 4 heures",
    labelEn: "4-hour training",
    priceFlat: 1200,
    durationFr: "Demi-journée (4 h)",
    durationEn: "Half-day (4 h)",
    groupSizeFr: "2 à 30 personnes",
    groupSizeEn: "2 to 30 people",
    descriptionFr:
      "Format express demi-journée pour découvrir l'IA ou cadrer un cas d'usage métier précis.",
    descriptionEn: "Half-day express format to discover AI or frame a specific business use case.",
    audienceSizes: ["tpe", "pme"],
  },
  {
    id: "intervention-essentielle",
    labelFr: "Essentielle",
    labelEn: "Essential",
    // Will 2026-06-03 — prix d'entrée = palier 2-15 pers (2 450 €).
    priceFlat: 2450,
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
    // Will 2026-06-03 — passage à 2 paliers (prix d'entrée 2-15 pers = 2 450 €),
    // effectif élargi à 30 personnes.
    priceFlat: 2450,
    durationFr: "1 journée",
    durationEn: "1 day",
    groupSizeFr: "2 à 30 personnes",
    groupSizeEn: "2 to 30 people",
    subTiers: TEMPS_SUB_TIERS,
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
    // Will 2026-06-03 — prix d'entrée = palier 2-15 pers (3 250 €).
    priceFlat: 3250,
    durationFr: "2 jours",
    durationEn: "2 days",
    groupSizeFr: "2 à 30 personnes",
    groupSizeEn: "2 to 30 people",
    subTiers: APPROFONDIE_SUB_TIERS,
    descriptionFr:
      "Approfondissement IA sur deux journées consécutives — même grille d'effectif qu'Essentielle (2-15 / 16-30 personnes).",
    descriptionEn: "Two-day AI deep dive — same headcount grid as Essential (2-15 / 16-30 people).",
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
    // Will 2026-06-23 — label SSOT « Public · Durée » (aligné sur booking-catalog
    // qui utilise déjà « Dirigeant · 1 jour »). FR uniquement (EN désactivé).
    labelFr: "Dirigeant · 1 jour",
    labelEn: "Executives",
    // Will 2026-06-03 — journée 1-to-1 dirigeant portée de 990 à 1 190 € HT.
    // Will 2026-06-13 — harmonisation 1-to-1 (AFEST) : Dirigeant 1 jour fixé à
    // 1 390 € HT (fin de la dérive 1 190/1 390 vs intervention-dirigeant-vision ;
    // 393 villes + /reserver + tarifs s'alignent via les tokens de prix).
    priceFlat: 1390,
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
    // Même format journée 1-to-1 que `intervention-dirigeants`.
    // Will 2026-06-13 — « Optimisation du poste » (AFEST) : 1 jour fixé à
    // 990 € HT (nouveau prix collaborateur ; propagé aux 393 villes + /un-a-un
    // via les tokens de prix).
    id: "intervention-membre-equipe",
    // Will 2026-06-23 — label SSOT « Public · Durée » (FR only, EN désactivé).
    labelFr: "Collaborateur · 1 jour",
    labelEn: "Team member",
    priceFlat: 990,
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
    // Will 2026-06-03 — passage à 2 paliers (prix d'entrée 2-15 pers = 2 650 €),
    // effectif élargi à 30 personnes.
    priceFlat: 2650,
    durationFr: "1 journée",
    durationEn: "1 day",
    groupSizeFr: "2 à 30 personnes",
    groupSizeEn: "2 to 30 people",
    subTiers: CLAUDE_SUB_TIERS,
    descriptionFr: "Une journée 100 % dédiée à Claude (Anthropic) : Chat · Cowork · Code.",
    descriptionEn: "A full day 100 % focused on Claude (Anthropic): Chat · Cowork · Code.",
    audienceSizes: ["tpe", "pme"],
  },
  {
    // Will 2026-06-03 — 1-to-1 dirigeant « Vision IA stratégique », prix fixe.
    id: "intervention-dirigeant-vision",
    labelFr: "Vision IA stratégique",
    labelEn: "Strategic AI vision",
    priceFlat: 1390,
    durationFr: "1 journée",
    durationEn: "1 day",
    groupSizeFr: "1 dirigeant (1-to-1)",
    groupSizeEn: "1 executive (1-on-1)",
    descriptionFr:
      "Journée 1-to-1 pour ouvrir les yeux du dirigeant sur les opportunités IA de son secteur.",
    descriptionEn: "1-on-1 day to open the executive's eyes to AI opportunities in their sector.",
    audienceSizes: ["tpe", "pme", "eti", "grande-entreprise"],
  },
  {
    // Will 2026-06-13 — 1-to-1 dirigeant « 2 jours » (AFEST). Prix = 1 390 × ~1,85
    // (règle 1j→2j de la grille formations). HT.
    id: "intervention-dirigeant-vision-2j",
    labelFr: "Dirigeant · 2 jours",
    labelEn: "Executive · 2 days",
    priceFlat: 2590,
    durationFr: "2 jours",
    durationEn: "2 days",
    groupSizeFr: "1 dirigeant (1-to-1)",
    groupSizeEn: "1 executive (1-on-1)",
    descriptionFr:
      "Accompagnement 1-to-1 sur 2 jours : cartographie approfondie, mises en situation et feuille de route d'optimisation (temps & coûts).",
    descriptionEn:
      "2-day 1-on-1: in-depth mapping, hands-on situations and an optimization roadmap (time & cost).",
    audienceSizes: ["tpe", "pme", "eti", "grande-entreprise"],
  },
  {
    // Will 2026-06-13 — collaborateur « Optimisation du poste · 2 jours » (AFEST).
    // Prix = 990 × ~1,85. HT.
    id: "intervention-membre-equipe-2j",
    // Will 2026-06-23 — label SSOT « Public · Durée » (FR only, EN désactivé).
    labelFr: "Collaborateur · 2 jours",
    labelEn: "Team member · 2 days",
    priceFlat: 1830,
    durationFr: "2 jours",
    durationEn: "2 days",
    groupSizeFr: "1 collaborateur (1-to-1)",
    groupSizeEn: "1 employee (1-on-1)",
    descriptionFr:
      "Optimisation du poste sur 2 jours : cartographie du fonctionnement, irritants, et plan d'automatisation pour gagner du temps.",
    descriptionEn:
      "2-day workstation optimization: workflow mapping, pain points, and an automation plan to save time.",
    audienceSizes: ["tpe", "pme", "eti", "grande-entreprise"],
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
// breadcrumb) mais sémantique "coaching 1-to-1" cohérente avec les tiers
// existants `intervention-membre-equipe` (Collaborateur, 990 € HT) et
// `intervention-dirigeants` (Dirigeant, 1 390 € HT). On EXPOSE ces tiers sous
// le nom `UN_A_UN_TIERS` pour qu'ils alimentent la 4e card hub ville +
// VilleServicePageTemplate sans dupliquer la définition.
//
// Le prix d'entrée du 1-to-1 = 990 € HT (Collaborateur, premier de la liste).
// Sprint S+3 pourra étendre avec d'autres formats (½ journée, journée + suivi
// 1 mois, programme 3 mois) sans casser la signature `Service` JSON-LD.

const INTERVENTION_DIRIGEANTS_TIER = INTERVENTION_TIERS.find(
  (t) => t.id === "intervention-dirigeants",
);
const INTERVENTION_MEMBRE_EQUIPE_TIER = INTERVENTION_TIERS.find(
  (t) => t.id === "intervention-membre-equipe",
);

if (!INTERVENTION_DIRIGEANTS_TIER || !INTERVENTION_MEMBRE_EQUIPE_TIER) {
  throw new Error(
    "pricing.ts invariant violation: intervention-dirigeants / intervention-membre-equipe tier missing in INTERVENTION_TIERS",
  );
}

// Will 2026-06-23 — le 1-to-1 expose DEUX formules : Collaborateur (990 € HT)
// et Dirigeant (1 390 € HT). Le tier Collaborateur vient EN PREMIER pour que le
// prix d'entrée (`getEntryTier` / `getEntryPriceEur` = premier tier chiffré)
// soit 990 € → « À partir de 990 € » sur la home, les ~400 pages ville, /tarifs
// et llms.txt. Avant : seul le Dirigeant était exposé, donc depuis que celui-ci
// est passé de 990 → 1 390 € le 2026-06-13, la home affichait à tort « à partir
// de 1 390 € » alors que 990 € est le vrai ticket d'entrée du 1-to-1.
export const UN_A_UN_TIERS: ReadonlyArray<PricingTier> = [
  INTERVENTION_MEMBRE_EQUIPE_TIER,
  INTERVENTION_DIRIGEANTS_TIER,
];

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

// ============================================================================
// COMMISSIONS COMMERCIAUX — rémunération du réseau de vente indépendant
// (pages /devenir-commercial-ia). SSOT : aucun montant de commission hardcodé
// dans les pages ou la copy ville. La commission ≠ le prix de la prestation :
// `basisTierId` pointe vers le PricingTier vendu (join avec OFFERS) pour
// afficher « vends X (prix SSOT) → tu touches Y ». Quand un barème change,
// on le modifie ICI et il se propage sur les ~400 pages ville.
// ============================================================================

export interface CommercialCommission {
  /** id stable. */
  readonly id: string;
  /** Libellé FR (produit vendu, ex « Formation 1 jour »). */
  readonly labelFr: string;
  /** Libellé EN. */
  readonly labelEn: string;
  /**
   * Type de rémunération :
   * - `flat`    : montant fixe HT en € par vente (`flatEur`).
   * - `percent` : pourcentage de la facture (`percent`).
   * - `scale`   : sur barème, pas de montant public (détaillé après candidature).
   */
  readonly kind: "flat" | "percent" | "scale";
  /** Commission fixe HT en € par vente (requis si `kind === "flat"`). */
  readonly flatEur?: number;
  /** Pourcentage de la facture (requis si `kind === "percent"`). */
  readonly percent?: number;
  /**
   * id du PricingTier vendu — join avec `OFFERS` (offers-catalog.ts) pour
   * afficher un exemple chiffré « sur une prestation à {prix SSOT} ». Optionnel
   * (certains produits, ex « 3 jours+ », n'ont pas de tier fixe publié).
   */
  readonly basisTierId?: string;
  /** Description courte FR (1 phrase). */
  readonly descriptionFr: string;
  /** Description courte EN. */
  readonly descriptionEn: string;
}

/**
 * Barème de commissions du réseau commercial Axion-IA. Décision Will 2026-06-08 :
 * formations = commission fixe par vente ; audit/implémentation = % de la
 * facture ; 1-to-1 = sur barème (montant non public). Affiché en clair sur les
 * pages publiques /devenir-commercial-ia (transparence = conversion candidats).
 */
export const COMMERCIAL_COMMISSIONS: ReadonlyArray<CommercialCommission> = [
  {
    id: "com-formation-1j",
    labelFr: "Formation 1 jour",
    labelEn: "1-day training",
    kind: "flat",
    flatEur: 350,
    basisTierId: "intervention-essentielle",
    descriptionFr: "Commission fixe pour chaque formation collective d'une journée vendue.",
    descriptionEn: "Flat commission for each one-day group training sold.",
  },
  {
    id: "com-formation-2j",
    labelFr: "Formation 2 jours",
    labelEn: "2-day training",
    kind: "flat",
    flatEur: 800,
    basisTierId: "intervention-approfondie",
    descriptionFr: "Commission fixe pour chaque formation approfondie de deux jours vendue.",
    descriptionEn: "Flat commission for each two-day deep-dive training sold.",
  },
  {
    id: "com-formation-3j",
    labelFr: "Formation 3 jours et +",
    labelEn: "3-day+ training",
    kind: "flat",
    flatEur: 1350,
    descriptionFr: "Commission fixe pour chaque format long (3 jours ou plus) vendu.",
    descriptionEn: "Flat commission for each long format (3 days or more) sold.",
  },
  {
    id: "com-un-a-un",
    labelFr: "Intervention 1-to-1 (dirigeant ou collaborateur)",
    labelEn: "1-on-1 session (executive or team member)",
    kind: "scale",
    basisTierId: "intervention-dirigeants",
    descriptionFr: "Commission sur barème, détaillée après candidature.",
    descriptionEn: "Commission on scale, detailed after application.",
  },
  {
    id: "com-audit",
    labelFr: "Audit en entreprise",
    labelEn: "Company audit",
    kind: "percent",
    percent: 30,
    basisTierId: "audit-cible",
    descriptionFr: "30 % de la facture pour chaque mission d'audit signée.",
    descriptionEn: "30% of the invoice for each signed audit engagement.",
  },
  {
    id: "com-integration",
    labelFr: "Intégration & automatisation IA",
    labelEn: "AI integration & automation",
    kind: "percent",
    percent: 15,
    basisTierId: "impl-poc",
    descriptionFr: "15 % de la facture pour chaque projet d'intégration ou d'automatisation.",
    descriptionEn: "15% of the invoice for each integration or automation project.",
  },
] as const;

/** Lookup type-safe d'une commission par id. Throw si introuvable (erreur de migration). */
export function getCommissionById(id: string): CommercialCommission {
  const found = COMMERCIAL_COMMISSIONS.find((c) => c.id === id);
  if (!found) {
    throw new Error(`[pricing] commission introuvable : "${id}"`);
  }
  return found;
}

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
  /**
   * Si `true`, préfixe « À partir de » / « Starting at » — le montant est un
   * plancher, pas un prix ferme. Formulation alignée sur `formatPrice()` (la
   * branche `priceMin`) pour un rendu identique entre en-tête de tier et carte
   * de sous-tier. Opt-in par call-site : plusieurs copies écrivent déjà « À
   * partir de » à la main autour de `formatAmount()` (ex `promiseFr` ETI) et ne
   * doivent PAS recevoir un second préfixe. Sans effet sur le repli « sur
   * devis » du filet anti-NaN ci-dessous. Défaut : `false`.
   */
  from?: boolean;
}

/**
 * Formate un montant brut en € HT — « 490 € HT » (FR) / « €490 (excl. VAT) » (EN).
 * Avec `{ compact: true }` : « 490 € » / « €490 ».
 * Avec `{ from: true }` : « À partir de 490 € HT » / « Starting at €490 (excl. VAT) ».
 * Utile quand le montant n'est pas un PricingTier (homepage messages, copy
 * SEO, etc.).
 */
export function formatAmount(
  amount: number,
  locale: "fr" | "en" = "fr",
  opts: FormatAmountOptions = {},
): string {
  // Filet anti-`NaN` (2026-07-11) : plusieurs tiers sont passés en `onQuote`
  // ou `priceMin`-only (décision Will 2026-06-03), et du code appelant assume
  // encore un montant présent via `.priceMin!/.priceMax!`. À l'exécution ce
  // `!` devient `undefined` → `fmtNumber(undefined)` affichait « NaN € » sur
  // la FAQ, les pages Audit/Implémentation, la presse et llms-full.txt. On
  // dégrade proprement en « sur devis » plutôt que de laisser fuir un NaN.
  if (!Number.isFinite(amount)) {
    return locale === "fr" ? "sur devis" : "on request";
  }
  const compact = opts.compact === true;
  const base =
    locale === "fr"
      ? compact
        ? `${fmtNumber(amount, "fr")} €`
        : `${fmtNumber(amount, "fr")} € HT`
      : compact
        ? `€${fmtNumber(amount, "en")}`
        : `€${fmtNumber(amount, "en")} (excl. VAT)`;
  if (opts.from !== true) return base;
  return locale === "fr" ? `À partir de ${base}` : `Starting at ${base}`;
}

/**
 * Formate le prix d'entrée d'un tier en respectant son `isFromPrice`.
 *
 * À utiliser partout où l'on affiche `formatAmount(tier.priceFlat!, …)` en dur :
 * ces call-sites court-circuitent `formatPrice()` et ne verraient donc jamais le
 * flag (bug 2026-07-17 — le TPE restait « 1 190 € » ferme sur /audit, /tarifs,
 * les cards format et les pages ville, alors que les 3 autres niveaux d'audit
 * annonçaient « À partir de … »).
 *
 * Retombe sur `priceMin` si le tier n'a pas de `priceFlat`, et sur « Sur devis »
 * si aucun montant n'est défini — jamais de `NaN` (cf. filet dans `formatAmount`).
 *
 * ⚠️ NE PAS utiliser pour un usage transactionnel (booking, JSON-LD `lowPrice`,
 * cents débités) : là, c'est le NOMBRE `priceFlat` qu'il faut, ferme.
 */
export function formatTierPrice(
  tier: PricingTier,
  locale: "fr" | "en" = "fr",
  opts: FormatAmountOptions = {},
): string {
  const amount = tier.priceFlat ?? tier.priceMin;
  if (amount == null) return locale === "fr" ? "Sur devis" : "On request";
  // Un tier sans `priceFlat` mais avec `priceMin` est un plancher par nature
  // (c'est la sémantique de `formatPrice`) : le préfixer aussi, sinon
  // `formatTierPrice(audit-cible)` rendrait « 1 900 € » FERME là où
  // `formatPrice(audit-cible)` rend « À partir de 1 900 € HT ». Les deux
  // helpers doivent rester d'accord.
  const isFrom = tier.isFromPrice === true || (tier.priceFlat == null && tier.priceMin != null);
  return formatAmount(amount, locale, { ...opts, from: isFrom });
}

/**
 * Formate le prix d'un SOUS-tier en respectant son `isFromPrice`.
 *
 * Pendant de `formatTierPrice()` pour les cartes de sous-tiers. À utiliser
 * partout où l'on affichait `formatAmount(sub.priceFlat, …)` : sans ça, la
 * carte ignore le flag et rend un prix FERME sous un en-tête « à partir de »
 * (le bug corrigé pour l'ETI en #337, puis pour Ciblé/PME ici).
 *
 * ⚠️ NE PAS utiliser pour un usage transactionnel (booking, cents débités) :
 * là, c'est le NOMBRE `priceFlat` qu'il faut, ferme.
 */
export function formatSubTierPrice(
  sub: PricingSubTier,
  locale: "fr" | "en" = "fr",
  opts: FormatAmountOptions = {},
): string {
  return formatAmount(sub.priceFlat, locale, { ...opts, from: sub.isFromPrice === true });
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
  // Filet anti-`NaN` (2026-07-11) : une borne peut être `undefined` (tiers
  // `priceMin`-only comme audit-cible / audit-strategique-pme, ou `onQuote`
  // pur comme impl-ia-custom). On dégrade selon les bornes disponibles au lieu
  // d'émettre « NaN → NaN ». Cf. `formatAmount`.
  const hasMin = Number.isFinite(min);
  const hasMax = Number.isFinite(max);
  if (!hasMin && !hasMax) {
    return locale === "fr" ? "sur devis" : "on request";
  }
  if (hasMin && !hasMax) {
    return locale === "fr"
      ? `à partir de ${formatAmount(min, "fr", opts)}`
      : `from ${formatAmount(min, "en", opts)}`;
  }
  if (!hasMin && hasMax) {
    return locale === "fr"
      ? `jusqu'à ${formatAmount(max, "fr", opts)}`
      : `up to ${formatAmount(max, "en", opts)}`;
  }
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
    // `isFromPrice` — plancher et non prix ferme (audits, Will 2026-07-17).
    // Même formulation que la branche `priceMin` plus bas.
    const from =
      tier.isFromPrice === true ? (locale === "fr" ? "À partir de " : "Starting at ") : "";
    return `${from}${fmt(tier.priceFlat)}${currency}${recurrence}`;
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

// ============================================================================
// CATALOGUE FORMATIONS — matrice de prix (catégorie × durée).
//
// ⚠️ ADDITIF STRICT : ne remplace PAS `INTERVENTION_TIERS` (consommé par les
// 445 pages villes, offers-catalog, chatbot — tous LIVE). Cette matrice est lue
// UNIQUEMENT par le catalogue formations (catalog-v2.ts). SSOT du prix : ici.
//
// Refonte 2026-07-19 (décision Will) : le catalogue est réorganisé en
// 3 CATÉGORIES (offres générales / par métier / par secteur d'activité) et les
// PRIX SONT PUBLICS — prix fixe HT par groupe (2 à 15 participants), identique
// pour toutes les formations d'une même case (catégorie × durée). Fin de l'axe
// gamme (IA/Claude) et des tranches 16-30 / 2-12. Intra-entreprise, hors frais
// de déplacement. Source : `Downloads/Titres_Formations_Axion-IA.md`.
// ============================================================================

/**
 * Gammes historiques (axe thématique de l'ancien catalogue V2). Conservé car
 * la colonne `OffreSite.gamme` (DB) et les défauts visuels/outils
 * (catalog-v2-facts.ts) le référencent encore pour les fiches archivées.
 */
export type FormationGamme = "ia-standard" | "agents-automatisations" | "claude";

/** Catégories du catalogue (refonte 2026-07-19) — axe principal de navigation. */
export type FormationCategorie = "generale" | "metier" | "secteur";

/** Durées catalogue (axe durée). `sur-mesure` = devis, hors matrice. */
export type FormationDuree = "4h" | "1j" | "2j" | "3j";

/** Tranche d'effectif unique : prix par groupe, jusqu'à 15 participants. */
export type FormationBracket = "2-15";

/**
 * Matrice prix HT par groupe. `catégorie → durée → prix €`.
 * Une case absente = combinaison non proposée (ex. métier en 4h).
 */
export const FORMATION_PRICE_MATRIX: Record<
  FormationCategorie,
  Partial<Record<FormationDuree, number>>
> = {
  generale: { "4h": 1200, "1j": 1900, "2j": 3600 },
  metier: { "1j": 1900, "2j": 3600 },
  secteur: { "1j": 2200, "2j": 3900 },
};

/** Prix HT (€) d'une case, ou `undefined` si la combinaison n'existe pas. */
export function getFormationPrice(
  categorie: FormationCategorie,
  duree: FormationDuree,
): number | undefined {
  return FORMATION_PRICE_MATRIX[categorie]?.[duree];
}

/**
 * Tranches d'effectif disponibles pour une (catégorie, durée). Tranche unique
 * `2-15` depuis la refonte 2026-07-19 — conservé en tableau pour les rendus
 * tabulaires (fiche, tarifs) qui itèrent sur les tranches.
 */
export function getFormationBrackets(
  categorie: FormationCategorie,
  duree: FormationDuree,
): ReadonlyArray<FormationBracket> {
  return typeof FORMATION_PRICE_MATRIX[categorie]?.[duree] === "number" ? ["2-15"] : [];
}

/** Prix d'entrée d'une (catégorie, durée) — tranche unique : le prix lui-même. */
export function getFormationEntryPrice(
  categorie: FormationCategorie,
  duree: FormationDuree,
): number | undefined {
  return FORMATION_PRICE_MATRIX[categorie]?.[duree];
}

/** Prix formaté d'une case (réutilise `formatAmount`). */
export function formatFormationPrice(
  categorie: FormationCategorie,
  duree: FormationDuree,
  locale: "fr" | "en" = "fr",
): string {
  const p = getFormationPrice(categorie, duree);
  if (p === undefined) return locale === "fr" ? "Sur devis" : "On quote";
  return formatAmount(p, locale);
}

/**
 * Fourchette de prix du catalogue formations (min/max sur toute la matrice).
 * Pour les accroches « de X à Y » / « dès X » — SANS jamais hardcoder le montant.
 */
export function getFormationCatalogPriceRange(): { minEur: number; maxEur: number } {
  let minEur = Number.POSITIVE_INFINITY;
  let maxEur = 0;
  for (const categorie of Object.values(FORMATION_PRICE_MATRIX)) {
    for (const v of Object.values(categorie)) {
      if (typeof v === "number") {
        if (v < minEur) minEur = v;
        if (v > maxEur) maxEur = v;
      }
    }
  }
  return { minEur, maxEur };
}
