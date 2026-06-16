/**
 * AXION-IA — Phased Coverage Campaign
 *
 * Extension de CoverageCampaign pour gérer :
 * - La profondeur par ville (phases 1→5 avec dépendances)
 * - La priorité sectorielle par ville (tous les secteurs ne sont pas égaux partout)
 * - L'ordre de publication anti-cannibalization
 *
 * À ajouter dans prisma/schema.prisma + migrations
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES & ENUMS
// ─────────────────────────────────────────────────────────────────────────────

export type CoveragePhase =
  | "PHASE_1_HUB" // Hub ville (fondation)
  | "PHASE_2_PILIERS" // Guides piliers sectoriels
  | "PHASE_3_DOULEURS" // Pain points + blog articles
  | "PHASE_4_CONVERSION" // Comparatifs, ROI, cas clients
  | "PHASE_5_LONGTAIL"; // FAQ, QA, what_is, voice search

export type CityTier =
  | "TIER_1_METROPOLE" // Paris, Lyon, Marseille, Toulouse, Nice, Bordeaux, Nantes, Strasbourg
  | "TIER_2_GRANDE_VILLE" // 100k-500k hab
  | "TIER_3_VILLE_MOYENNE" // 20k-100k hab
  | "TIER_4_BASSIN"; // <20k mais bassin économique identifié

// ─────────────────────────────────────────────────────────────────────────────
// MATRICE DE PROFONDEUR PAR PHASE
// Définit quels types de contenu appartiennent à quelle phase
// et quelles sont les dépendances (phase X doit être complète avant phase Y)
// ─────────────────────────────────────────────────────────────────────────────

export interface PhaseDefinition {
  phase: CoveragePhase;
  label: string;
  contentTypes: string[]; // ContentType[] de ton système
  dependsOnPhase: CoveragePhase | null;
  minArticlesInDepPhase: number; // Minimum d'articles publiés dans la phase précédente
  dailyCapPerCity: number; // Articles/jour max pour cette phase × ville
  indexationTier: "tier_1" | "tier_2" | "tier_3";
  targetIntents: string[]; // SearchIntent[]
}

export const PHASE_DEFINITIONS: PhaseDefinition[] = [
  {
    phase: "PHASE_1_HUB",
    label: "Hub ville — fondation",
    contentTypes: [
      "ville-hub-copy",
      "landing-ville-economic-data",
      "landing-ville-cas-usage",
      "landing-ville-ecosystem",
      "landing-ville-faq-extended",
      "landing-ville-secteurs",
    ],
    dependsOnPhase: null,
    minArticlesInDepPhase: 0,
    dailyCapPerCity: 6, // Les 6 sections du hub, générées en 1 jour
    indexationTier: "tier_1",
    targetIntents: ["local", "navigational"],
  },
  {
    phase: "PHASE_2_PILIERS",
    label: "Guides piliers sectoriels",
    contentTypes: ["guide_pilier"],
    dependsOnPhase: "PHASE_1_HUB",
    minArticlesInDepPhase: 4, // Au moins 4 sections hub publiées
    dailyCapPerCity: 2, // 1-2 guides piliers par jour
    indexationTier: "tier_1",
    targetIntents: ["informational", "commercial_investigation"],
  },
  {
    phase: "PHASE_3_DOULEURS",
    label: "Contenus douleur + blog",
    contentTypes: [
      "pain_point_solution",
      "blog_article",
      "blog_from_title",
      "blog_from_keywords",
      "how_to_x_in_y",
      "long_tail_keyword",
    ],
    dependsOnPhase: "PHASE_2_PILIERS",
    minArticlesInDepPhase: 3, // Au moins 3 piliers publiés
    dailyCapPerCity: 5,
    indexationTier: "tier_1",
    targetIntents: ["informational", "local", "featured_snippet"],
  },
  {
    phase: "PHASE_4_CONVERSION",
    label: "Contenus de conversion",
    contentTypes: [
      "comparison",
      "vs_comparator",
      "calculator_roi",
      "case_study_local",
      "best_for_x_in_y",
      "top_x_in_y",
      "alternative_to",
    ],
    dependsOnPhase: "PHASE_3_DOULEURS",
    minArticlesInDepPhase: 8,
    dailyCapPerCity: 3,
    indexationTier: "tier_1",
    targetIntents: ["commercial_investigation", "transactional"],
  },
  {
    phase: "PHASE_5_LONGTAIL",
    label: "Long-tail et AEO",
    contentTypes: [
      "qa_derived",
      "faq_standalone",
      "faq_geo",
      "what_is_x",
      "glossary_term",
      "blog_from_rss",
    ],
    dependsOnPhase: "PHASE_4_CONVERSION",
    minArticlesInDepPhase: 5,
    dailyCapPerCity: 10, // Volume maximal, contenu court
    indexationTier: "tier_1",
    targetIntents: ["voice_search", "ai_overview", "featured_snippet", "informational"],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// PRIORITÉ SECTORIELLE PAR VILLE
// Tous les secteurs ne sont pas également pertinents dans chaque ville.
// Cette table guide l'ordre de génération des piliers (Phase 2).
// ─────────────────────────────────────────────────────────────────────────────

export interface CitySectorPriority {
  villeSlug: string;
  cityTier: CityTier;
  secteursPrioritaires: string[]; // Secteur[], dans l'ordre de priorité
  verticalesPrioritaires: string[]; // Verticale[], dans l'ordre
  notes: string;
}

export const CITY_SECTOR_PRIORITIES: CitySectorPriority[] = [
  {
    villeSlug: "grenoble",
    cityTier: "TIER_2_GRANDE_VILLE",
    secteursPrioritaires: [
      "industrie_logistique",
      "sante_medecine",
      "juridique",
      "comptabilite_finance",
      "rh_recrutement",
    ],
    verticalesPrioritaires: ["audits", "implementations", "interventions_formations"],
    notes:
      "Grenoble = tissu industriel (Schneider, STMicro) + pôle santé + universités. Secteur public secondaire.",
  },
  {
    villeSlug: "lyon",
    cityTier: "TIER_1_METROPOLE",
    secteursPrioritaires: [
      "comptabilite_finance",
      "rh_recrutement",
      "sante_medecine",
      "industrie_logistique",
      "commerce_retail",
      "juridique",
    ],
    verticalesPrioritaires: [
      "audits",
      "implementations",
      "interventions_formations",
      "sites_web_augmentes",
    ],
    notes:
      "Lyon = 1er pôle tertiaire hors Paris. Finance, pharma (Sanofi, bioMérieux), logistique (hub A6/A7). Toutes verticales pertinentes.",
  },
  {
    villeSlug: "paris",
    cityTier: "TIER_1_METROPOLE",
    secteursPrioritaires: [
      "juridique",
      "comptabilite_finance",
      "rh_recrutement",
      "commerce_retail",
      "collectivites_public",
    ],
    verticalesPrioritaires: ["audits", "un_a_un", "implementations"],
    notes:
      "Paris = concentrations de cabinets (compta, avocats), grands comptes RH, retail premium. Concurrence SEO maximale — différenciation sectorielle obligatoire.",
  },
  {
    villeSlug: "bordeaux",
    cityTier: "TIER_1_METROPOLE",
    secteursPrioritaires: [
      "restauration_hotellerie",
      "btp_immobilier",
      "commerce_retail",
      "artisanat_services",
      "comptabilite_finance",
    ],
    verticalesPrioritaires: ["audits", "sites_web_augmentes", "implementations"],
    notes:
      "Bordeaux = économie mixte tourisme/viticulture/BTP + croissance démographique forte. Artisanat en tension.",
  },
  {
    villeSlug: "marseille",
    cityTier: "TIER_1_METROPOLE",
    secteursPrioritaires: [
      "industrie_logistique",
      "commerce_retail",
      "artisanat_services",
      "btp_immobilier",
      "restauration_hotellerie",
    ],
    verticalesPrioritaires: ["audits", "interventions_formations", "implementations"],
    notes:
      "Marseille = port (logistique dominante), BTP en rénovation urbaine massive, secteur informel fort → formation pertinente.",
  },
  {
    villeSlug: "toulouse",
    cityTier: "TIER_1_METROPOLE",
    secteursPrioritaires: [
      "industrie_logistique",
      "rh_recrutement",
      "sante_medecine",
      "juridique",
      "comptabilite_finance",
    ],
    verticalesPrioritaires: ["audits", "implementations", "un_a_un"],
    notes:
      "Toulouse = aéronautique (Airbus, supply chain), IHU cancer, croissance soutenue. Profils ingénieurs → formations techniques bien reçues.",
  },
  {
    villeSlug: "nantes",
    cityTier: "TIER_1_METROPOLE",
    secteursPrioritaires: [
      "btp_immobilier",
      "commerce_retail",
      "rh_recrutement",
      "artisanat_services",
      "comptabilite_finance",
    ],
    verticalesPrioritaires: ["audits", "sites_web_augmentes", "interventions_formations"],
    notes:
      "Nantes = croissance urbaine rapide, secteur numérique émergent, PME industrielles. BTP en tension de main d'œuvre.",
  },
  {
    villeSlug: "strasbourg",
    cityTier: "TIER_1_METROPOLE",
    secteursPrioritaires: [
      "juridique",
      "collectivites_public",
      "sante_medecine",
      "industrie_logistique",
      "comptabilite_finance",
    ],
    verticalesPrioritaires: ["audits", "interventions_formations", "implementations"],
    notes:
      "Strasbourg = institutions européennes (dimension juridique/public forte), pôle santé (CHU), logistique Rhin.",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// CALCUL DE LA MATRICE COMPLÈTE PAR VILLE
// Retourne le nombre d'URLs uniques générables et l'ordre recommandé
// ─────────────────────────────────────────────────────────────────────────────

export interface CityContentPlan {
  villeSlug: string;
  totalUrlsPlanned: number;
  phases: {
    phase: CoveragePhase;
    urlCount: number;
    estimatedDays: number;
    contentBreakdown: { contentType: string; secteur?: string; count: number }[];
  }[];
}

/**
 * Calcule le plan de contenu complet pour une ville
 *
 * Exemple pour Lyon (Tier 1, 6 secteurs prioritaires) :
 * Phase 1 : 6 sections hub = 6 URLs
 * Phase 2 : 6 secteurs × 5 verticales = 30 guides piliers
 * Phase 3 : 6 secteurs × 5 verticales × 3 douleurs = 90 pain_point_solution
 *           + 6 × 5 × 2 blog_article = 60 articles
 * Phase 4 : 6 × 5 × 2 types conversion = 60 contenus
 * Phase 5 : 6 × 5 × 5 long-tail = 150 contenus
 * TOTAL : ~396 URLs pour Lyon
 */
export function computeCityContentPlan(cityPriority: CitySectorPriority): CityContentPlan {
  const nbSecteurs = cityPriority.secteursPrioritaires.length;
  const nbVerticales = cityPriority.verticalesPrioritaires.length;

  const phases = [
    {
      phase: "PHASE_1_HUB" as CoveragePhase,
      urlCount: 6,
      estimatedDays: 1,
      contentBreakdown: [{ contentType: "hub-sections", count: 6 }],
    },
    {
      phase: "PHASE_2_PILIERS" as CoveragePhase,
      urlCount: nbSecteurs * nbVerticales,
      estimatedDays: Math.ceil((nbSecteurs * nbVerticales) / 2),
      contentBreakdown: [{ contentType: "guide_pilier", count: nbSecteurs * nbVerticales }],
    },
    {
      phase: "PHASE_3_DOULEURS" as CoveragePhase,
      urlCount: nbSecteurs * nbVerticales * 3 + nbSecteurs * nbVerticales * 2,
      estimatedDays: Math.ceil((nbSecteurs * nbVerticales * 5) / 5),
      contentBreakdown: [
        { contentType: "pain_point_solution", count: nbSecteurs * nbVerticales * 3 },
        { contentType: "blog_article", count: nbSecteurs * nbVerticales * 2 },
      ],
    },
    {
      phase: "PHASE_4_CONVERSION" as CoveragePhase,
      urlCount: nbSecteurs * nbVerticales * 2,
      estimatedDays: Math.ceil((nbSecteurs * nbVerticales * 2) / 3),
      contentBreakdown: [
        { contentType: "comparison", count: nbSecteurs * nbVerticales },
        { contentType: "calculator_roi", count: nbSecteurs * nbVerticales },
      ],
    },
    {
      phase: "PHASE_5_LONGTAIL" as CoveragePhase,
      urlCount: nbSecteurs * nbVerticales * 5,
      estimatedDays: Math.ceil((nbSecteurs * nbVerticales * 5) / 10),
      contentBreakdown: [
        { contentType: "qa_derived", count: nbSecteurs * nbVerticales * 2 },
        { contentType: "faq_geo", count: nbSecteurs * nbVerticales * 2 },
        { contentType: "what_is_x", count: nbSecteurs * nbVerticales },
      ],
    },
  ];

  return {
    villeSlug: cityPriority.villeSlug,
    totalUrlsPlanned: phases.reduce((sum, p) => sum + p.urlCount, 0),
    phases,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXTENSION DU GeneratorBaseInput
// Ajouter ces champs à ton type existant dans generators/types.ts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * À merger dans GeneratorBaseInput existant
 * import { SectorPainContext } from './sector-pain-matrix';
 */
export interface GeneratorBaseInputExtension {
  // Nouveau — Phase de couverture ville
  coveragePhase?: CoveragePhase;

  // Nouveau — Secteur client (pour la pain matrix)
  targetSecteur?: string; // Secteur

  // Nouveau — Contexte douleur injecté avant le prompt
  // Récupéré via getSectorPainContext(secteur, verticale)
  sectorPainContext?: {
    painStatement: string;
    benefitMeasured: string;
    beforeScenario: string;
    afterScenario: string;
    sectorLexicon: string[];
    objection: string;
    objectionReply: string;
    kpiLabel: string;
  };

  // Nouveau — ID de la campagne phasée parente
  phasedCampaignId?: string;

  // Nouveau — Dépendances satisfaites (checké par le worker avant génération)
  phaseDepsSatisfied?: boolean;
}
