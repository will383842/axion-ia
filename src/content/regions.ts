// Phase Frontend Final pSEO Villes/Régions — Sprint 14.9 (2026-05-08).
// 13 régions métropole France (DROM + COM/TAAF volontairement exclus 2026-05-08
// décision Will, cf. ADR 0006). Données INSEE. Slugs FR canoniques.
//
// Architecture pSEO (cf. axionia/docs/adr/0006-pseo-villes.md) :
//   /implantations/[region]            → page région (top villes + maillage)
//   /implantations/[region]/[ville]    → page ville (template unique SSG)
//
// Anti-doorway HCU 2024 : pages régions = data différenciée (PIB, secteurs,
// villes principales, écosystème). Pages villes = data ville-spécifique
// (population, distances, FAQ géolocalisée, cas concrets proches Haversine).

export interface Region {
  /** FR-canonical slug (kebab-case ASCII, jamais accentué). */
  slug: string;
  nameFr: string;
  nameEn: string;
  /** Préfecture / chef-lieu. */
  prefecture: string;
  /** Code INSEE région (2 ou 3 chiffres). */
  inseeCode: string;
  /** Codes département inclus dans la région (numériques ou alphanum Corse 2A/2B). */
  departements: ReadonlyArray<string>;
  /** Population légale (recensement INSEE 2024). */
  population: number;
  /** Coordonnées du chef-lieu (lat/lon WGS84). */
  geo: { lat: number; lon: number };
  /**
   * Type juridique. Seul `metropole` est utilisé V1 (DROM exclus 2026-05-08).
   * L'union conserve `drom` pour faciliter une éventuelle ré-extension future.
   */
  type: "metropole" | "drom";
  /** PIB régional (Md€, Eurostat 2023). Optionnel — métropoles surtout. */
  pibBillionsEur?: number;
  /** Phase de publication (1 = top 50 + métropoles, 2 = +200, 3 = exhaustif). */
  publicationPhase: 1 | 2 | 3;
  /** Si true, page existe physiquement mais `noindex` actif (gating SEO). */
  noindex: boolean;
  /** Pitch région 30-50 mots FR (sera affiché en hero région). */
  pitchFr: string;
  /** Pitch région 30-50 mots EN. */
  pitchEn: string;
}

// Phase 1 = chefs-lieux indexable immédiatement après dépôt sitemap.
// Phase 2/3 = restent `noindex: true` jusqu'à lever flag dans cette table
// (1 commit config + build 60s, cf. mémoire monitoring).
export const REGIONS: ReadonlyArray<Region> = [
  // === Métropole (13) ===
  {
    slug: "ile-de-france",
    nameFr: "Île-de-France",
    nameEn: "Île-de-France",
    prefecture: "Paris",
    inseeCode: "11",
    departements: ["75", "77", "78", "91", "92", "93", "94", "95"],
    population: 12317279,
    geo: { lat: 48.8566, lon: 2.3522 },
    type: "metropole",
    pibBillionsEur: 838,
    publicationPhase: 1,
    noindex: false,
    pitchFr:
      "Première région économique européenne (838 Md€ PIB), berceau de l'écosystème IA français — Mistral, Hugging Face, Station F. Axion-IA y intervient sur site dans toute la couronne francilienne, des sièges grand-compte de La Défense aux PME parisiennes intra-muros.",
    pitchEn:
      "Europe's leading economic region (€838 B GDP), home to the French AI ecosystem — Mistral, Hugging Face, Station F. Axion-IA intervenes on site across Greater Paris, from La Défense headquarters to inner-Paris SMEs.",
  },
  {
    slug: "auvergne-rhone-alpes",
    nameFr: "Auvergne-Rhône-Alpes",
    nameEn: "Auvergne-Rhône-Alpes",
    prefecture: "Lyon",
    inseeCode: "84",
    departements: ["01", "03", "07", "15", "26", "38", "42", "43", "63", "69", "73", "74"],
    population: 8197000,
    geo: { lat: 45.764, lon: 4.8357 },
    type: "metropole",
    pibBillionsEur: 274,
    publicationPhase: 1,
    noindex: false,
    pitchFr:
      "2e région française par le PIB (274 Md€), dense en industrie, tech et conseil — Lyon, Grenoble, Clermont-Ferrand, Annecy. Axion-IA y déploie ses interventions IA sur site auprès des ETI industrielles et des écosystèmes deep-tech.",
    pitchEn:
      "France's 2nd region by GDP (€274 B), dense in industry, tech and consulting — Lyon, Grenoble, Clermont-Ferrand, Annecy. Axion-IA delivers on-site AI engagements to industrial mid-caps and deep-tech ecosystems.",
  },
  {
    slug: "provence-alpes-cote-d-azur",
    nameFr: "Provence-Alpes-Côte d'Azur",
    nameEn: "Provence-Alpes-Côte d'Azur",
    prefecture: "Marseille",
    inseeCode: "93",
    departements: ["04", "05", "06", "13", "83", "84"],
    population: 5089000,
    geo: { lat: 43.2965, lon: 5.3698 },
    type: "metropole",
    pibBillionsEur: 173,
    publicationPhase: 1,
    noindex: false,
    pitchFr:
      "PIB 173 Md€, écosystème PME diversifié — tourisme premium, maritime, aérospatial, tech (Sophia-Antipolis). Axion-IA accompagne dirigeants et DAF de Marseille, Aix-en-Provence, Nice, Toulon, Cannes sur leurs déploiements IA opérationnels.",
    pitchEn:
      "GDP €173 B, diversified SME ecosystem — premium tourism, maritime, aerospace, tech (Sophia-Antipolis). Axion-IA supports leaders and CFOs in Marseille, Aix-en-Provence, Nice, Toulon, Cannes on their operational AI deployments.",
  },
  {
    slug: "occitanie",
    nameFr: "Occitanie",
    nameEn: "Occitanie",
    prefecture: "Toulouse",
    inseeCode: "76",
    departements: ["09", "11", "12", "30", "31", "32", "34", "46", "48", "65", "66", "81", "82"],
    population: 6049000,
    geo: { lat: 43.6047, lon: 1.4442 },
    type: "metropole",
    pibBillionsEur: 178,
    publicationPhase: 1,
    noindex: false,
    pitchFr:
      "PIB 178 Md€, capitale aéronautique européenne (Airbus, ATR), filière santé (Montpellier), agro-alimentaire dense. Axion-IA y intervient auprès des ETI sous-traitantes et des laboratoires recherche.",
    pitchEn:
      "GDP €178 B, European aerospace capital (Airbus, ATR), health sector (Montpellier), dense agri-food. Axion-IA serves sub-contracting mid-caps and research labs.",
  },
  {
    slug: "nouvelle-aquitaine",
    nameFr: "Nouvelle-Aquitaine",
    nameEn: "Nouvelle-Aquitaine",
    prefecture: "Bordeaux",
    inseeCode: "75",
    departements: ["16", "17", "19", "23", "24", "33", "40", "47", "64", "79", "86", "87"],
    population: 6042000,
    geo: { lat: 44.8378, lon: -0.5792 },
    type: "metropole",
    pibBillionsEur: 178,
    publicationPhase: 1,
    noindex: false,
    pitchFr:
      "PIB 178 Md€, plus grande région française par superficie. Vins (Bordeaux), aéronautique, agro-tourisme, énergie. Axion-IA accompagne les domaines viticoles, ETI agro et PME tech de Bordeaux à Pau.",
    pitchEn:
      "GDP €178 B, France's largest region by area. Wines (Bordeaux), aerospace, agri-tourism, energy. Axion-IA supports wineries, agri mid-caps and tech SMEs from Bordeaux to Pau.",
  },
  {
    slug: "hauts-de-france",
    nameFr: "Hauts-de-France",
    nameEn: "Hauts-de-France",
    prefecture: "Lille",
    inseeCode: "32",
    departements: ["02", "59", "60", "62", "80"],
    population: 5963000,
    geo: { lat: 50.6292, lon: 3.0573 },
    type: "metropole",
    pibBillionsEur: 167,
    publicationPhase: 1,
    noindex: false,
    pitchFr:
      "PIB 167 Md€, hub logistique européen (port de Dunkerque, Eurotunnel), industrie automobile, distribution. Axion-IA intervient auprès des sièges Auchan, Decathlon, Bonduelle et de l'écosystème industriel régional.",
    pitchEn:
      "GDP €167 B, European logistics hub (Dunkirk port, Eurotunnel), automotive industry, retail. Axion-IA serves Auchan, Decathlon, Bonduelle headquarters and the regional industrial ecosystem.",
  },
  {
    slug: "grand-est",
    nameFr: "Grand Est",
    nameEn: "Grand Est",
    prefecture: "Strasbourg",
    inseeCode: "44",
    departements: ["08", "10", "51", "52", "54", "55", "57", "67", "68", "88"],
    population: 5546000,
    geo: { lat: 48.5734, lon: 7.7521 },
    type: "metropole",
    pibBillionsEur: 165,
    publicationPhase: 1,
    noindex: false,
    pitchFr:
      "PIB 165 Md€, frontière Allemagne–Suisse–Belgique–Luxembourg. Champagne, automobile (Peugeot, Smart), pharma. Axion-IA y déploie des interventions cross-border DE/FR pour ETI exportatrices.",
    pitchEn:
      "GDP €165 B, German–Swiss–Belgian–Luxembourg border. Champagne, automotive (Peugeot, Smart), pharma. Axion-IA delivers cross-border DE/FR engagements for exporting mid-caps.",
  },
  {
    slug: "pays-de-la-loire",
    nameFr: "Pays de la Loire",
    nameEn: "Pays de la Loire",
    prefecture: "Nantes",
    inseeCode: "52",
    departements: ["44", "49", "53", "72", "85"],
    population: 3870000,
    geo: { lat: 47.2184, lon: -1.5536 },
    type: "metropole",
    pibBillionsEur: 122,
    publicationPhase: 1,
    noindex: false,
    pitchFr:
      "PIB 122 Md€, ETI industrielles familiales (Le Mans, Cholet, Vendée), naval (STX Saint-Nazaire), agro-alimentaire. Axion-IA accompagne les transmissions et les pivots IA des dirigeants de la Vendée à la Loire-Atlantique.",
    pitchEn:
      "GDP €122 B, family industrial mid-caps (Le Mans, Cholet, Vendée), naval (STX Saint-Nazaire), agri-food. Axion-IA supports successions and AI pivots from Vendée to Loire-Atlantique.",
  },
  {
    slug: "bretagne",
    nameFr: "Bretagne",
    nameEn: "Brittany",
    prefecture: "Rennes",
    inseeCode: "53",
    departements: ["22", "29", "35", "56"],
    population: 3393000,
    geo: { lat: 48.1173, lon: -1.6778 },
    type: "metropole",
    pibBillionsEur: 102,
    publicationPhase: 1,
    noindex: false,
    pitchFr:
      "PIB 102 Md€, agro-alimentaire (1ère région de France), tech (Rennes), maritime. Axion-IA intervient auprès des coopératives agricoles, des ETI agro-industrielles et de l'écosystème b<>com de Rennes.",
    pitchEn:
      "GDP €102 B, agri-food (France's #1 region), tech (Rennes), maritime. Axion-IA serves agricultural cooperatives, agri-industrial mid-caps and Rennes' b<>com ecosystem.",
  },
  {
    slug: "normandie",
    nameFr: "Normandie",
    nameEn: "Normandy",
    prefecture: "Rouen",
    inseeCode: "28",
    departements: ["14", "27", "50", "61", "76"],
    population: 3303000,
    geo: { lat: 49.4432, lon: 1.0993 },
    type: "metropole",
    pibBillionsEur: 95,
    publicationPhase: 1,
    noindex: false,
    pitchFr:
      "PIB 95 Md€, Le Havre (1er port français en valeur), pétrochimie, automobile, élevage. Axion-IA accompagne les industriels de Rouen, Caen et l'axe Seine sur des cas IA opérationnels logistique et qualité.",
    pitchEn:
      "GDP €95 B, Le Havre (France's #1 port by value), petrochemical, automotive, livestock. Axion-IA supports industrial operators in Rouen, Caen and the Seine corridor on operational AI cases — logistics and quality.",
  },
  {
    slug: "bourgogne-franche-comte",
    nameFr: "Bourgogne-Franche-Comté",
    nameEn: "Bourgogne-Franche-Comté",
    prefecture: "Dijon",
    inseeCode: "27",
    departements: ["21", "25", "39", "58", "70", "71", "89", "90"],
    population: 2796000,
    geo: { lat: 47.322, lon: 5.0415 },
    type: "metropole",
    pibBillionsEur: 81,
    publicationPhase: 1,
    noindex: false,
    pitchFr:
      "PIB 81 Md€, vins (Bourgogne), automobile (PSA Sochaux, Alstom Belfort), microtechnique. Axion-IA intervient auprès des sous-traitants Tier 1 automobile et des domaines viticoles familiaux.",
    pitchEn:
      "GDP €81 B, wines (Burgundy), automotive (PSA Sochaux, Alstom Belfort), microtechnology. Axion-IA serves Tier 1 automotive sub-contractors and family wineries.",
  },
  {
    slug: "centre-val-de-loire",
    nameFr: "Centre-Val de Loire",
    nameEn: "Centre-Val de Loire",
    prefecture: "Orléans",
    inseeCode: "24",
    departements: ["18", "28", "36", "37", "41", "45"],
    population: 2566000,
    geo: { lat: 47.9027, lon: 1.9094 },
    type: "metropole",
    pibBillionsEur: 76,
    publicationPhase: 1,
    noindex: false,
    pitchFr:
      "PIB 76 Md€, cosmétique (vallée des parfums), pharma (Tours), logistique (Orléans, plateforme nord-Loire). Axion-IA accompagne les ETI de la Cosmetic Valley et de la pharma touraine.",
    pitchEn:
      "GDP €76 B, cosmetics (perfume valley), pharma (Tours), logistics (Orléans, north-Loire hub). Axion-IA supports Cosmetic Valley mid-caps and Tours' pharma cluster.",
  },
  {
    slug: "corse",
    nameFr: "Corse",
    nameEn: "Corsica",
    prefecture: "Ajaccio",
    inseeCode: "94",
    departements: ["2A", "2B"],
    population: 348000,
    geo: { lat: 41.9192, lon: 8.7386 },
    type: "metropole",
    pibBillionsEur: 10,
    publicationPhase: 2,
    noindex: true,
    pitchFr:
      "PIB 10 Md€, tourisme premium, vins, agro-alimentaire (clémentines, charcuterie). Axion-IA intervient ponctuellement à Ajaccio et Bastia sur des missions courtes (2-3 jours) auprès des PME insulaires.",
    pitchEn:
      "GDP €10 B, premium tourism, wines, agri-food (clementines, charcuterie). Axion-IA delivers occasional short engagements (2-3 days) in Ajaccio and Bastia for island SMEs.",
  },

  // === DROM volontairement exclus 2026-05-08 ===
  // Décision Will : Axion-IA ne couvre pas Guadeloupe / Martinique / Guyane /
  // La Réunion / Mayotte (pas d'intervention ni à distance V1, anti-doorway
  // codebase). Si l'expansion est un jour décidée, ré-ajouter les blocs
  // DROM ci-dessous + relancer `pnpm villes:import`. Voir aussi les
  // 29 communes COM/TAAF déjà skippées par le script (Polynésie, Wallis,
  // St-Barth, St-Martin, St-Pierre-et-Miquelon, Nouvelle-Calédonie).
];

const SLUG_INDEX = new Map(REGIONS.map((r) => [r.slug, r] as const));

export function getRegion(slug: string): Region | undefined {
  return SLUG_INDEX.get(slug);
}

export function getAllRegionSlugs(): ReadonlyArray<string> {
  return REGIONS.map((r) => r.slug);
}

/** Régions visibles dans les sitemaps (phase active + noindex=false). */
export function getIndexableRegions(): ReadonlyArray<Region> {
  return REGIONS.filter((r) => !r.noindex);
}

/** Pour Header mega-menu / Footer 5e zone : top 6 régions par PIB. */
export function getTopRegionsByPib(n: number): ReadonlyArray<Region> {
  return [...REGIONS]
    .filter((r) => typeof r.pibBillionsEur === "number")
    .sort((a, b) => (b.pibBillionsEur ?? 0) - (a.pibBillionsEur ?? 0))
    .slice(0, n);
}
