// Phase Frontend Final pSEO Villes/Régions — Sprint 14.9 (2026-05-08).
// 13 régions métropole France listées ici pour les pages SEO dédiées
// (`/implantations/[region]`). Données INSEE. Slugs FR canoniques.
//
// Couverture réelle Axion-IA (Will 2026-05-26, MAJ décision DROM) :
//   - 13 régions métropolitaines (Corse comprise) : pages dédiées ci-dessous
//   - 5 DROM (Guadeloupe, Martinique, Guyane, La Réunion, Mayotte) : couverts
//     mais pas de page dédiée V1 → accessibles via /contact
//   - Entreprises francophones à l'étranger (Belgique, Suisse, Luxembourg,
//     Monaco, Maghreb, Afrique francophone, Québec) : sur devis via /contact
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
  /** Meta title FR hand-crafted ~70-84 chars (Will 2026-05-26).
   *  Format : « {Region} · Architectes IA seniors · Audit, Formation, Coaching, SaaS »
   *  Anti-duplicate-content cross-régions. */
  metaTitleFr: string;
  /** Meta title EN miroir. Optionnel (EN locale désactivé 2026-05-16, voir AGENTS.md). */
  metaTitleEn?: string;
  /** Meta description FR hand-crafted ~140-160 chars (Will 2026-05-26).
   *  Mentionne positionnement architecte + 5 services + ville/région. */
  metaDescFr: string;
  /** Meta description EN miroir. Optionnel. */
  metaDescEn?: string;
  /** Paragraphe « Nous accompagnons toutes les tailles » FR — contexte économique
   *  local, exemples concrets de tissus B2B. ~250-400 chars.
   *  Affiché sous le H2 de la section audience régionalisée. */
  audienceLocalFr: string;
  /** Miroir EN. Optionnel. */
  audienceLocalEn?: string;
  /** Section logistique DROM hand-crafted (Will 2026-05-26) — affichée
   *  uniquement si region.type === "drom" pour épaissir les pages DROM
   *  (qui n'ont pas de villes INSEE >5000 hab listées). Décrit la
   *  logistique d'intervention, les délais typiques, les modalités
   *  spécifiques au DROM. ~400-600 chars hand-crafted, anti-duplicate. */
  dromLogisticsFr?: string;
  /** Cas concret local hand-crafted (Will 2026-05-26 perfection 2026) —
   *  H3 « Cas concret local » ajouté en 5e card de RegionAudienceSection.
   *  Différenciation anti-duplicate cross-régions, signal AEO local fort.
   *  Mention typique : secteur + objectif + gain mesurable. ~200-300 chars. */
  audienceCaseStudyFr?: {
    /** Titre court H4 — ex « Distillerie de rhum AOC » (~40 chars). */
    titleFr: string;
    /** Lead italique terracotta sous le H4 — ex « Traçabilité export automatisée » (~60 chars). */
    leadFr: string;
    /** Détail prose ~150-200 chars : contexte secteur + gain concret. */
    detailFr: string;
  };
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
    metaTitleFr: "Île-de-France · Architectes IA seniors · Audit, Formation, Coaching, SaaS",
    metaTitleEn: "Île-de-France · Senior AI architects · Audit, Training, Coaching, SaaS",
    metaDescFr:
      "Architectes IA seniors en Île-de-France. 5 services pour TPE et PME franciliennes : audit IA, formation, implémentation, coaching 1-to-1 dirigeants, plateformes web/SaaS. ETI et grands comptes également. Paris, La Défense.",
    metaDescEn:
      "Senior AI architects in Île-de-France. 5 services for SMBs in the Paris region: AI audit, training, implementation, 1-to-1 executive coaching, AI web platforms/SaaS. Mid-caps and large accounts also covered. Paris, La Défense.",
    audienceLocalFr:
      "L'Île-de-France concentre 1,2 million de TPE-PME — artisans dans tous les arrondissements parisiens, commerçants de la petite couronne, PME tech à Boulogne-Billancourt et Saint-Denis, professions libérales du 16ᵉ et du 8ᵉ. Axion-IA accompagne ces dirigeants — un boulanger qui veut automatiser ses commandes, un cabinet d'avocats qui veut accélérer la rédaction, une PME e-commerce qui veut un agent IA produit — comme les ETI franciliennes et les sièges grand-compte à La Défense, avec le même standard premium senior.",
    audienceCaseStudyFr: {
      titleFr: "Cabinet d'avocats parisien",
      leadFr: "Rédaction d'actes accélérée par IA",
      detailFr:
        "Cabinet d'affaires du 8ᵉ : agent IA déployé sur leur base de modèles d'actes + jurisprudence interne. Premiers gains : ~1h30 économisée par avocat sur la rédaction d'un acte standard, validation finale toujours humaine.",
    },
    audienceLocalEn:
      "Île-de-France concentrates 1.2 million SMBs — craftsmen in every Paris arrondissement, retailers in the inner suburbs, tech SMBs in Boulogne-Billancourt and Saint-Denis, professional services in the 16th and 8th. Axion-IA serves these executives first: a baker automating orders, a law firm accelerating drafting, an e-commerce SMB launching a product AI agent. Mid-caps and large headquarters in La Défense are also supported.",
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
    metaTitleFr: "Auvergne-Rhône-Alpes · Architectes IA seniors · Audit, Formation, Coaching, SaaS",
    metaTitleEn: "Auvergne-Rhône-Alpes · Senior AI architects · Audit, Training, Coaching, SaaS",
    metaDescFr:
      "Architectes IA seniors en Auvergne-Rhône-Alpes. 5 services pour TPE et PME : audit IA, formation entreprise, implémentation, coaching 1-to-1, plateformes web/SaaS. ETI deep-tech également. Lyon, Grenoble, Annecy, Clermont.",
    metaDescEn:
      "Senior AI architects in Auvergne-Rhône-Alpes. 5 services for SMBs: AI audit, corporate training, implementation, 1-to-1 coaching, AI web platforms/SaaS. Deep-tech mid-caps also covered. Lyon, Grenoble, Annecy, Clermont.",
    audienceLocalFr:
      "L'Auvergne-Rhône-Alpes compte plus de 700 000 TPE-PME, du Pays roannais aux vallées alpines. Restaurateurs et hôteliers à Annecy et Chamonix, artisans bouchers à Lyon Confluence, PME mécaniques de la Loire et de la plasturgie d'Oyonnax, cabinets de conseil sur Part-Dieu, e-commerces grenoblois. Axion-IA accompagne ces dirigeants TPE-PME comme les ETI industrielles deep-tech (Grenoble, Saint-Étienne), les sièges DSI lyonnais et les groupes deep-tech (CEA, ST Microelectronics, Schneider), avec le même standard premium senior.",
    audienceCaseStudyFr: {
      titleFr: "PME mécanique de la Loire",
      leadFr: "Devis chiffré en 12 min vs 2 h avant",
      detailFr:
        "Sous-traitant Tier 2 automobile près de Roanne : agent IA RAG sur leur catalogue de pièces + historique devis. Réponse client passée de 2 h à 12 min en moyenne, taux de transformation devis × 1,6 mesuré sur trimestre.",
    },
    audienceLocalEn:
      "Auvergne-Rhône-Alpes counts over 700,000 SMBs, from the Roanne area to the Alpine valleys. Restaurateurs and hoteliers in Annecy and Chamonix, butchers in Lyon Confluence, mechanical SMBs in the Loire and Oyonnax plastics cluster, consulting firms on Part-Dieu, Grenoble e-commerces. Axion-IA serves these SMB executives first. Industrial deep-tech mid-caps (Grenoble, Saint-Étienne) are also supported.",
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
    metaTitleFr: "PACA · Architectes IA seniors · Audit, Formation, Coaching, SaaS",
    metaTitleEn: "PACA · Senior AI architects · Audit, Training, Coaching, SaaS · Axion-IA",
    metaDescFr:
      "Architectes IA seniors en Provence-Alpes-Côte d'Azur. 5 services pour TPE et PME : audit IA, formation, implémentation, coaching 1-to-1, plateformes web/SaaS. ETI et tech également. Marseille, Aix, Nice, Toulon, Cannes.",
    metaDescEn:
      "Senior AI architects in Provence-Alpes-Côte d'Azur. 5 services for SMBs: AI audit, training, implementation, 1-to-1 coaching, AI web platforms/SaaS. Mid-caps and tech also covered. Marseille, Aix, Nice, Toulon, Cannes.",
    audienceLocalFr:
      "Provence-Alpes-Côte d'Azur abrite plus de 500 000 TPE-PME ancrées dans le tissu local — hôteliers et restaurateurs azuréens, viticulteurs varois, négociants marseillais, cabinets d'avocats à Aix, agences immobilières cannoises, artisans du Var et des Alpes. Axion-IA accompagne ces dirigeants TPE-PME comme les ETI tech de Sophia-Antipolis et les sièges aéronautiques (Eurocopter, Airbus Marignane), avec le même standard premium senior.",
    audienceCaseStudyFr: {
      titleFr: "Hôtelier de la côte azuréenne",
      leadFr: "Upsell personnalisé multilingue",
      detailFr:
        "Hôtel 4★ à Saint-Tropez : agent IA conversationnel multilingue (FR, EN, IT, DE, RU) connecté à leur PMS. Recommandations spa/excursions personnalisées avant arrivée — taux d'upsell augmenté de 18 % sur la saison.",
    },
    audienceLocalEn:
      "Provence-Alpes-Côte d'Azur hosts over 500,000 SMBs rooted in local fabric — Riviera hoteliers and restaurateurs, Var winemakers, Marseille traders, Aix law firms, Cannes real-estate agencies, Var and Alpine craftsmen. Axion-IA serves these SMB executives first. Sophia-Antipolis tech mid-caps and aerospace HQs (Eurocopter, Airbus Marignane) are also covered.",
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
    metaTitleFr: "Occitanie · Architectes IA seniors · Audit, Formation, Coaching, SaaS",
    metaDescFr:
      "Architectes IA seniors en Occitanie. 5 services pour TPE et PME : audit IA, formation, implémentation, coaching 1-to-1, plateformes web/SaaS. ETI aéronautiques et santé également. Toulouse, Montpellier, Perpignan, Nîmes.",
    audienceLocalFr:
      "L'Occitanie compte près de 600 000 TPE-PME — vignerons du Languedoc, restaurateurs et hôteliers de la Méditerranée, artisans toulousains, PME viticoles (Corbières, Minervois), cabinets médicaux à Montpellier, cabinets d'experts-comptables, agences de tourisme. Axion-IA accompagne ces dirigeants TPE-PME comme les ETI aéronautiques sous-traitantes d'Airbus et les laboratoires de recherche santé de Montpellier, avec le même standard premium senior.",
    audienceCaseStudyFr: {
      titleFr: "Domaine viticole du Languedoc",
      leadFr: "Export USA + Asie automatisé",
      detailFr:
        "Domaine en Corbières (200 000 bouteilles/an) : agent IA bilingue qui répond aux importateurs US/JP sur cuvées + millésimes + logistique douane. Délai de réponse passé de 48 h à 30 min, +3 marchés conclus en 6 mois.",
    },
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
    metaTitleFr: "Nouvelle-Aquitaine · Architectes IA seniors · Audit, Formation, Coaching, SaaS",
    metaDescFr:
      "Architectes IA seniors en Nouvelle-Aquitaine. 5 services pour TPE et PME : audit IA, formation, implémentation, coaching 1-to-1, plateformes web/SaaS. ETI viticoles et tech également. Bordeaux, Pau, La Rochelle, Limoges.",
    audienceLocalFr:
      "La Nouvelle-Aquitaine, plus grande région française, fédère plus de 550 000 TPE-PME. Domaines viticoles familiaux de Saint-Émilion à Médoc, restaurateurs et hôteliers du Bassin d'Arcachon, ostréiculteurs de Marennes, artisans bordelais, PME tech de Bordeaux Métropole, ETP du bois landais. Axion-IA accompagne ces dirigeants TPE-PME comme les ETI agro-industrielles et tech (Dassault Aviation Mérignac, Thales), avec le même standard premium senior.",
    audienceCaseStudyFr: {
      titleFr: "Château de Saint-Émilion grand cru",
      leadFr: "Allocation export pilotée par IA",
      detailFr:
        "Château grand cru classé : agent IA qui croise historique d'allocation, scores critiques internationaux, demandes importateurs et stock millésime. Décisions d'allocation accélérées de 60 %, équité fidélité maintenue.",
    },
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
    metaTitleFr: "Hauts-de-France · Architectes IA seniors · Audit, Formation, Coaching, SaaS",
    metaDescFr:
      "Architectes IA seniors en Hauts-de-France. 5 services pour TPE et PME : audit IA, formation, implémentation, coaching 1-to-1, plateformes web/SaaS. ETI distribution et industrie également. Lille, Amiens, Roubaix, Dunkerque.",
    audienceLocalFr:
      "Les Hauts-de-France comptent plus de 460 000 TPE-PME. Estaminets et brasseries lilloises, artisans textiles roubaisiens, PME logistiques de Dunkerque et Calais, négoces agro-alimentaires de la Somme, cabinets dentaires d'Amiens, agences de voyages, fleuristes, traiteurs. Axion-IA accompagne ces dirigeants TPE-PME comme les sièges grand-compte régionaux (Auchan, Decathlon, Bonduelle, Boulanger), avec le même standard premium senior.",
    audienceCaseStudyFr: {
      titleFr: "PME logistique Dunkerque-Calais",
      leadFr: "Suivi conteneurs UK/EU en temps réel",
      detailFr:
        "Transitaire portuaire 35 salariés : agent IA qui ingère AIS maritime, douane CDS UK, mails clients pour produire un statut conteneur unifié. Mails clients chiffés / explications passé de 4 h à 25 min par jour.",
    },
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
    metaTitleFr: "Grand Est · Architectes IA seniors · Audit, Formation, Coaching, SaaS",
    metaDescFr:
      "Architectes IA seniors en Grand Est. 5 services pour TPE et PME : audit IA, formation, implémentation, coaching 1-to-1, plateformes web/SaaS. ETI cross-border DE/FR également. Strasbourg, Reims, Metz, Nancy, Mulhouse.",
    audienceLocalFr:
      "Le Grand Est rassemble plus de 410 000 TPE-PME entre la Champagne et les frontières germaniques. Viticulteurs et caves de champagne (Reims, Épernay), winstubs alsaciennes, artisans strasbourgeois, restaurateurs lorrains, PME industrielles de Mulhouse, négoces transfrontaliers, professions libérales messines. Axion-IA accompagne ces dirigeants TPE-PME comme les ETI exportatrices automobile et pharma cross-border DE/FR, avec le même standard premium senior.",
    audienceCaseStudyFr: {
      titleFr: "Maison de champagne familiale",
      leadFr: "Allocation cuvées + traçabilité export",
      detailFr:
        "Maison de champagne 12ᵉ génération à Épernay : agent IA qui croise stock cuvée, allocations historiques, dégorgements et demandes importateurs. Préparation campagne export passée de 3 semaines à 4 jours.",
    },
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
    metaTitleFr: "Pays de la Loire · Architectes IA seniors · Audit, Formation, Coaching, SaaS",
    metaDescFr:
      "Architectes IA seniors en Pays de la Loire. 5 services pour TPE et PME : audit IA, formation, implémentation, coaching 1-to-1, plateformes web/SaaS. ETI familiales industrielles également. Nantes, Angers, Le Mans, La Roche.",
    audienceLocalFr:
      "Les Pays de la Loire abritent près de 300 000 TPE-PME au tissu artisanal dense. Boulangers angevins, restaurateurs nantais, hôteliers de l'île de Ré et de la côte vendéenne, artisans choletais, PME agro de la Sarthe, ostréiculteurs de la Vendée maritime, cabinets de notaires. Axion-IA accompagne ces dirigeants TPE-PME comme les ETI familiales industrielles (Mulliez, Pasquier, Beneteau, STX), avec le même standard premium senior.",
    audienceCaseStudyFr: {
      titleFr: "PME agro-industrielle de la Sarthe",
      leadFr: "Cahier des charges fournisseurs auto",
      detailFr:
        "Charcutier industriel : agent IA RAG sur leur référentiel qualité + normes HACCP + fiches fournisseurs. Création d'un cahier des charges fournisseur passée de 2 jours à 3 heures, conformité auto-vérifiée.",
    },
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
    metaTitleFr: "Bretagne · Architectes IA seniors · Audit, Formation, Coaching, SaaS",
    metaDescFr:
      "Architectes IA seniors en Bretagne. 5 services pour TPE et PME : audit IA, formation, implémentation, coaching 1-to-1, plateformes web/SaaS. ETI agro et tech également. Rennes, Brest, Quimper, Vannes, Saint-Brieuc.",
    audienceLocalFr:
      "La Bretagne compte près de 260 000 TPE-PME ancrées dans le terroir. Crêperies et restaurateurs de la côte d'Émeraude, ostréiculteurs de Cancale, artisans cidriers, négoces de poissons et fruits de mer, PME maritimes brestoises, cabinets vétérinaires, hôteliers du Morbihan, agriculteurs et coopératives. Axion-IA accompagne ces dirigeants TPE-PME comme les ETI agro (Sodiaal, Triskalia, Even) et l'écosystème tech rennais (b<>com), avec le même standard premium senior.",
    audienceCaseStudyFr: {
      titleFr: "Ostréiculteur de Cancale",
      leadFr: "Suivi élevage + commandes B2B en 1 outil",
      detailFr:
        "Producteur 8 ha de parc : agent IA qui regroupe données capteurs (température, salinité), calendrier élevage et commandes restaurateurs. Réponse commande professionnels passée de 24 h à temps réel.",
    },
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
    metaTitleFr: "Normandie · Architectes IA seniors · Audit, Formation, Coaching, SaaS",
    metaDescFr:
      "Architectes IA seniors en Normandie. 5 services pour TPE et PME : audit IA, formation, implémentation, coaching 1-to-1, plateformes web/SaaS. ETI portuaires et industrielles également. Rouen, Caen, Le Havre, Cherbourg.",
    audienceLocalFr:
      "La Normandie fédère plus de 240 000 TPE-PME. Restaurateurs et hôteliers de la côte fleurie (Deauville, Honfleur), artisans rouennais, négoces du port du Havre, cabinets dentaires de Caen, éleveurs et producteurs cidricoles, fromagers (Camembert, Livarot, Pont-l'Évêque), agences immobilières. Axion-IA accompagne ces dirigeants TPE-PME comme les ETI industrielles de l'axe Seine (pétrochimie, automobile, logistique portuaire), avec le même standard premium senior.",
    audienceCaseStudyFr: {
      titleFr: "Fromagerie AOP du Pays d'Auge",
      leadFr: "Réponse export caves affineurs auto",
      detailFr:
        "Producteur Camembert / Pont-l'Évêque AOP : agent IA qui qualifie demandes caves affineurs UK/JP, retourne calibres + DLC + logistique chaîne du froid. Délai de réponse passé de 36 h à 20 min.",
    },
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
    metaTitleFr: "Bourgogne-Franche-Comté · Architectes IA seniors · Audit, Formation, Coaching",
    metaDescFr:
      "Architectes IA seniors en Bourgogne-Franche-Comté. 5 services pour TPE et PME : audit IA, formation, implémentation, coaching 1-to-1, plateformes web/SaaS. ETI auto et viticoles également. Dijon, Besançon, Belfort.",
    audienceLocalFr:
      "Bourgogne-Franche-Comté abrite plus de 200 000 TPE-PME. Domaines viticoles familiaux (Côte d'Or, Mâconnais), restaurateurs étoilés bourguignons, artisans dijonnais, PME de la microtechnique du Doubs, négoces de fromages (Comté, Époisses), cabinets de comptables, hôteliers de Beaune. Axion-IA accompagne ces dirigeants TPE-PME comme les ETI sous-traitantes automobile (PSA Sochaux, Alstom Belfort), avec le même standard premium senior.",
    audienceCaseStudyFr: {
      titleFr: "Microtechnique du Doubs",
      leadFr: "Devis horlogerie suisse en direct",
      detailFr:
        "Sous-traitant horlogerie haut-doubs : agent IA RAG sur tolérances ISO + références matières + historique. Devis pour donneur d'ordre suisse passé de 5 jours ouvrés à 1 jour, taux de gain × 1,4.",
    },
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
    metaTitleFr: "Centre-Val de Loire · Architectes IA seniors · Audit, Formation, Coaching, SaaS",
    metaDescFr:
      "Architectes IA seniors en Centre-Val de Loire. 5 services pour TPE et PME : audit IA, formation, implémentation, coaching 1-to-1, plateformes web/SaaS. ETI cosmétique et pharma également. Orléans, Tours, Blois, Chartres.",
    audienceLocalFr:
      "Le Centre-Val de Loire compte près de 180 000 TPE-PME. Viticulteurs du Val de Loire (Sancerre, Vouvray, Chinon), restaurateurs tourangeaux, hôteliers des châteaux, artisans orléanais, PME logistiques, négoces de produits du terroir, fromagers (Sainte-Maure), cabinets vétérinaires ruraux. Axion-IA accompagne ces dirigeants TPE-PME comme les ETI de la Cosmetic Valley (LVMH, Shiseido) et la pharma touraine, avec le même standard premium senior.",
    audienceCaseStudyFr: {
      titleFr: "PME Cosmetic Valley",
      leadFr: "Fiches MSDS/CSR multilingues",
      detailFr:
        "Sous-traitant flaconnage à Chartres : agent IA produit fiches MSDS et dossiers REACH multilingues à partir du référentiel chimie interne. Délai préparation dossier nouveau client passé de 2 semaines à 3 jours.",
    },
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
    publicationPhase: 1,
    noindex: false,
    pitchFr:
      "PIB 10 Md€, tourisme premium, vins, agro-alimentaire (clémentines, charcuterie). Axion-IA intervient sur site à Ajaccio, Bastia, Porto-Vecchio et Calvi auprès des PME insulaires — périmètre et durée d'intervention adaptés à chaque entreprise et à ses objectifs.",
    pitchEn:
      "GDP €10 B, premium tourism, wines, agri-food (clementines, charcuterie). Axion-IA delivers on-site engagements in Ajaccio, Bastia, Porto-Vecchio and Calvi for island SMEs — scope and duration tailored to each company and its goals.",
    metaTitleFr: "Corse · Architectes IA seniors · Audit, Formation, Coaching, SaaS",
    metaDescFr:
      "Architectes IA seniors en Corse. 5 services pour TPE et PME insulaires : audit IA, formation, implémentation, coaching 1-to-1 dirigeants, plateformes web/SaaS IA. Ajaccio, Bastia, Porto-Vecchio, Calvi.",
    audienceLocalFr:
      "La Corse compte près de 40 000 TPE-PME insulaires au tissu artisanal et touristique dense. Hôteliers et restaurateurs d'Ajaccio, Bonifacio, Porto-Vecchio, Calvi, viticulteurs des AOC corses (Patrimonio, Ajaccio, Sartène), charcutiers de Niolu, agences immobilières, négociants en clémentines, artisans bastiais. Axion-IA accompagne ces dirigeants TPE-PME insulaires sur site — chaque intervention est cadrée en fonction de votre entreprise, de vos objectifs et de votre périmètre métier, avec le même standard premium senior.",
    audienceCaseStudyFr: {
      titleFr: "Domaine viticole de Patrimonio",
      leadFr: "Conciergerie vente directe œnotouristes",
      detailFr:
        "Domaine AOC Patrimonio : agent IA bilingue (FR, EN, IT) qui répond aux œnotouristes sur cuvées, accord mets/vins et réservations dégustation. Conversion visites → achats × 2,1 sur saison estivale.",
    },
  },

  // === 5 DROM (Will 2026-05-26 — pages SEO dédiées) ===
  // Décision Will MAJ : Axion-IA COUVRE Guadeloupe / Martinique / Guyane /
  // La Réunion / Mayotte avec pages SEO dédiées et contenu hand-crafted
  // niveau perfection (parité avec les 13 régions métropolitaines).
  // Entreprises francophones à l'étranger (Belgique, Suisse, Luxembourg,
  // Monaco, Maghreb, Afrique francophone, Québec) : sur devis via /contact
  // (pas de page SEO dédiée V1).
  {
    slug: "guadeloupe",
    nameFr: "Guadeloupe",
    nameEn: "Guadeloupe",
    prefecture: "Basse-Terre",
    inseeCode: "01",
    departements: ["971"],
    population: 378561,
    geo: { lat: 16.265, lon: -61.551 },
    type: "drom",
    pibBillionsEur: 9,
    publicationPhase: 1,
    noindex: false,
    pitchFr:
      "PIB 9 Md€, archipel des Caraïbes — tourisme premium, banane d'export, rhum agricole AOC, services. Axion-IA accompagne sur site les hôteliers, restaurateurs, distillateurs, exportateurs agro et PME de Basse-Terre, Pointe-à-Pitre, Sainte-Anne, Le Gosier.",
    pitchEn:
      "PIB 9 Md€, archipel des Caraïbes — tourisme premium, banane d'export, rhum agricole AOC, services. Axion-IA accompagne sur site les hôteliers, restaurateurs, distillateurs, exportateurs agro et PME de Basse-Terre, Pointe-à-Pitre, Sainte-Anne, Le Gosier.",
    metaTitleFr: "Guadeloupe · Architectes IA seniors · Audit, Formation, Coaching, SaaS",
    metaDescFr:
      "Architectes IA seniors en Guadeloupe. 5 services pour TPE et PME insulaires : audit IA, formation, implémentation, coaching 1-to-1, plateformes web/SaaS. Basse-Terre, Pointe-à-Pitre, Sainte-Anne, Le Gosier.",
    audienceLocalFr:
      "La Guadeloupe abrite plus de 35 000 TPE-PME insulaires. Hôteliers et restaurateurs de Sainte-Anne et Saint-François, distillateurs de rhum agricole (Damoiseau, Bologne, Longueteau, Bellevue), exportateurs de banane et de melon, négociants en café et cacao, agences de tourisme caribéen, artisans pointois et basse-terriens, cabinets médicaux. Axion-IA accompagne ces dirigeants TPE-PME comme les ETI agro-industrielles et touristiques antillaises, avec le même standard premium senior — mission cadrée selon votre entreprise, vos objectifs et votre périmètre métier.",
    dromLogisticsFr:
      "Intervenir en Guadeloupe demande une logistique cadrée : aéroport Pôle Caraïbes (Pointe-à-Pitre), accès à Basse-Terre par la côte sous-le-vent ou la traversée centrale, archipel des Saintes / Marie-Galante / La Désirade accessibles en ferry. Axion-IA structure les missions en blocs cohérents (audit Flash + atelier ; ou implementation sprint), avec sessions distancielles en complément pour limiter les déplacements. Devis transparent intégrant les frais de voyage et hébergement, validé avant signature.",
    audienceCaseStudyFr: {
      titleFr: "Distillerie de rhum agricole AOC",
      leadFr: "Traçabilité export + storytelling marque",
      detailFr:
        "Distillerie familiale en Basse-Terre : agent IA qui croise lots de canne, fermentation, distillation et fiches dégustation pour produire fiches export multilingues. Délai préparation salons œnologiques internationaux passé de 3 semaines à 4 jours.",
    },
  },
  {
    slug: "martinique",
    nameFr: "Martinique",
    nameEn: "Martinique",
    prefecture: "Fort-de-France",
    inseeCode: "02",
    departements: ["972"],
    population: 360749,
    geo: { lat: 14.6415, lon: -61.0242 },
    type: "drom",
    pibBillionsEur: 9,
    publicationPhase: 1,
    noindex: false,
    pitchFr:
      "PIB 9 Md€, Petites Antilles françaises — tourisme, banane, rhum agricole AOC, distribution. Axion-IA accompagne sur site hôteliers créoles, distillateurs, exportateurs et PME de Fort-de-France au Lamentin, jusqu'à Sainte-Marie et Le François.",
    pitchEn:
      "PIB 9 Md€, Petites Antilles françaises — tourisme, banane, rhum agricole AOC, distribution. Axion-IA accompagne sur site hôteliers créoles, distillateurs, exportateurs et PME de Fort-de-France au Lamentin, jusqu'à Sainte-Marie et Le François.",
    metaTitleFr: "Martinique · Architectes IA seniors · Audit, Formation, Coaching, SaaS",
    metaDescFr:
      "Architectes IA seniors en Martinique. 5 services pour TPE et PME : audit IA, formation, implémentation, coaching 1-to-1, plateformes web/SaaS. Fort-de-France, Lamentin, Schœlcher, Sainte-Marie.",
    audienceLocalFr:
      "La Martinique compte près de 32 000 TPE-PME ancrées dans le tissu créole. Hôteliers et restaurateurs des Trois-Îlets et de Sainte-Anne, distillateurs de rhum agricole AOC (Saint-James, Trois-Rivières, La Mauny, Clément, Depaz, JM), exportateurs de banane et fruits tropicaux, négociants foyalais, cabinets médicaux, agences immobilières, artisans pêcheurs du François. Axion-IA accompagne ces dirigeants TPE-PME comme les ETI agro-industrielles antillaises, avec le même standard premium senior — mission cadrée selon votre entreprise, vos objectifs et votre périmètre.",
    dromLogisticsFr:
      "Intervenir en Martinique se cadre autour de l'aéroport Aimé-Césaire (Le Lamentin) et de l'agglomération foyalaise. Distance utile : Fort-de-France → Sainte-Marie 35 min, → Trois-Îlets 20 min de ferry. Axion-IA regroupe les missions par campagnes (audit sur 2-3 jours, atelier dirigeant + équipe, livrables sous 5 jours), avec suivi distanciel sur 30-60 jours. Devis transparent incluant transport et hébergement, sans surprise.",
    audienceCaseStudyFr: {
      titleFr: "Hôtel 4★ Trois-Îlets",
      leadFr: "Concierge IA croisières + clients USA",
      detailFr:
        "Resort balnéaire 80 chambres : agent IA bilingue qui gère demandes croisiéristes (1-2 nuits) + clientèle USA (séjours longs), avec recommandations spa/excursions. Taux de réservation directe passée de 35 à 52 %.",
    },
  },
  {
    slug: "guyane",
    nameFr: "Guyane",
    nameEn: "French Guiana",
    prefecture: "Cayenne",
    inseeCode: "03",
    departements: ["973"],
    population: 290691,
    geo: { lat: 4.9333, lon: -52.3333 },
    type: "drom",
    pibBillionsEur: 4,
    publicationPhase: 1,
    noindex: false,
    pitchFr:
      "PIB 4 Md€, Amazonie française — aérospatial (Centre spatial guyanais, Arianespace), or, bois précieux, agriculture tropicale. Axion-IA intervient sur site auprès des PME et sous-traitants aérospatiaux de Cayenne à Kourou, jusqu'à Saint-Laurent-du-Maroni.",
    pitchEn:
      "PIB 4 Md€, Amazonie française — aérospatial (Centre spatial guyanais, Arianespace), or, bois précieux, agriculture tropicale. Axion-IA intervient sur site auprès des PME et sous-traitants aérospatiaux de Cayenne à Kourou, jusqu'à Saint-Laurent-du-Maroni.",
    metaTitleFr: "Guyane · Architectes IA seniors · Audit, Formation, Coaching, SaaS",
    metaDescFr:
      "Architectes IA seniors en Guyane. 5 services pour TPE et PME : audit IA, formation, implémentation, coaching 1-to-1, plateformes web/SaaS. Cayenne, Kourou, Saint-Laurent-du-Maroni, Matoury.",
    audienceLocalFr:
      "La Guyane fédère près de 15 000 TPE-PME amazoniennes. Restaurateurs et hôteliers de Cayenne et Rémire-Montjoly, sous-traitants aérospatiaux du Centre spatial guyanais à Kourou (logistique, ingénierie, maintenance), entreprises forestières et exploitants aurifères, négociants en bois précieux, artisans amérindiens, cabinets médicaux. Axion-IA accompagne ces dirigeants TPE-PME comme les ETI aérospatiales et minières guyanaises, avec le même standard premium senior — mission cadrée selon votre entreprise et vos contraintes logistiques amazoniennes.",
    dromLogisticsFr:
      "Intervenir en Guyane se cadre autour de l'aéroport Félix-Eboué (Cayenne) et de l'axe Cayenne → Kourou (60 km, 45 min). Saint-Laurent-du-Maroni accessible par RN1 (250 km). Axion-IA regroupe les missions par campagnes denses (2-4 jours sur place + livrables sous 5 jours), avec suivi distanciel pour limiter les déplacements transatlantiques. Devis transparent incluant transport, hébergement et frais spécifiques amazoniens (autorisations Kourou si zone spatiale).",
    audienceCaseStudyFr: {
      titleFr: "Sous-traitant aérospatial Kourou",
      leadFr: "Conformité agence spatiale + traçabilité pièces",
      detailFr:
        "PME logistique 25 salariés (Kourou) : agent IA RAG sur référentiel pièces + procédures agence spatiale européenne + historique campagnes de lancement. Préparation dossiers de conformité passée de 5 jours à 1 jour.",
    },
  },
  {
    slug: "la-reunion",
    nameFr: "La Réunion",
    nameEn: "Réunion",
    prefecture: "Saint-Denis",
    inseeCode: "04",
    departements: ["974"],
    population: 862814,
    geo: { lat: -21.1151, lon: 55.5364 },
    type: "drom",
    pibBillionsEur: 21,
    publicationPhase: 1,
    noindex: false,
    pitchFr:
      "PIB 21 Md€, océan Indien — tourisme volcanique, canne à sucre, géranium, vanille Bourbon, tertiaire dynamique. Axion-IA accompagne sur site hôteliers, planteurs, exportateurs et PME tech de Saint-Denis à Saint-Pierre, en passant par Saint-Paul et Le Tampon.",
    pitchEn:
      "PIB 21 Md€, océan Indien — tourisme volcanique, canne à sucre, géranium, vanille Bourbon, tertiaire dynamique. Axion-IA accompagne sur site hôteliers, planteurs, exportateurs et PME tech de Saint-Denis à Saint-Pierre, en passant par Saint-Paul et Le Tampon.",
    metaTitleFr: "La Réunion · Architectes IA seniors · Audit, Formation, Coaching, SaaS",
    metaDescFr:
      "Architectes IA seniors à La Réunion. 5 services pour TPE et PME : audit IA, formation, implémentation, coaching 1-to-1, plateformes web/SaaS. Saint-Denis, Saint-Paul, Saint-Pierre, Le Tampon.",
    audienceLocalFr:
      "La Réunion compte plus de 75 000 TPE-PME insulaires au tissu dense. Hôteliers et restaurateurs des cirques (Cilaos, Salazie, Mafate) et de la côte ouest, planteurs et industriels de la canne à sucre (Tereos Océan Indien), exportateurs de vanille Bourbon et de géranium rosat, PME tech de Saint-Denis et Sainte-Marie, agences de voyage volcanique (piton de la Fournaise), artisans dionysiens, cabinets médicaux. Axion-IA accompagne ces dirigeants TPE-PME comme les ETI agro-industrielles et tertiaires réunionnaises, avec le même standard premium senior.",
    dromLogisticsFr:
      "Intervenir à La Réunion se cadre autour de l'aéroport Roland-Garros (Saint-Denis) ou Pierrefonds (Saint-Pierre). Axe Nord-Sud : Saint-Denis → Saint-Pierre 1h30 (route des Tamarins). Axion-IA structure les missions en campagnes longues (4-7 jours sur place) pour amortir le voyage et couvrir Nord-Ouest-Sud, avec suivi distanciel ensuite. Devis transparent incluant vol, hébergement, location véhicule et déplacements inter-cirques si nécessaire.",
    audienceCaseStudyFr: {
      titleFr: "Exportateur de vanille Bourbon",
      leadFr: "Lots traçables blockchain + IA",
      detailFr:
        "Coopérative vanille Saint-André : agent IA qui croise lots récolte, certifications bio + équitable, demandes acheteurs (chefs étoilés, parfumeurs). Réponse devis professionnels passée de 72 h à 4 h, traçabilité lot complète.",
    },
  },
  {
    slug: "mayotte",
    nameFr: "Mayotte",
    nameEn: "Mayotte",
    prefecture: "Mamoudzou",
    inseeCode: "06",
    departements: ["976"],
    population: 320901,
    geo: { lat: -12.7864, lon: 45.275 },
    type: "drom",
    pibBillionsEur: 2.7,
    publicationPhase: 1,
    noindex: false,
    pitchFr:
      "PIB 2,7 Md€, océan Indien (101ᵉ département depuis 2011) — agriculture tropicale (vanille, ylang-ylang), pêche, jeune économie en structuration. Axion-IA intervient sur site auprès des TPE-PME mahoraises en croissance, de Mamoudzou à Dzaoudzi et Koungou.",
    pitchEn:
      "PIB 2,7 Md€, océan Indien (101ᵉ département depuis 2011) — agriculture tropicale (vanille, ylang-ylang), pêche, jeune économie en structuration. Axion-IA intervient sur site auprès des TPE-PME mahoraises en croissance, de Mamoudzou à Dzaoudzi et Koungou.",
    metaTitleFr: "Mayotte · Architectes IA seniors · Audit, Formation, Coaching, SaaS",
    metaDescFr:
      "Architectes IA seniors à Mayotte. 5 services pour TPE et PME : audit IA, formation, implémentation, coaching 1-to-1, plateformes web/SaaS. Mamoudzou, Dzaoudzi, Koungou, Sada.",
    audienceLocalFr:
      "Mayotte fédère plus de 10 000 TPE-PME mahoraises au sein du plus jeune département français (101ᵉ depuis 2011). Producteurs de vanille Bourbon et d'ylang-ylang, pêcheurs artisanaux du lagon, commerçants mamoudziens et de Koungou, restaurateurs créoles et comoriens, cabinets médicaux du Centre hospitalier de Mayotte, négociants en produits tropicaux, artisans. Axion-IA accompagne ces dirigeants TPE-PME mahoraises comme les ETI agro-industrielles et de pêche, avec le même standard premium senior — mission cadrée selon votre entreprise et votre périmètre métier.",
    dromLogisticsFr:
      "Intervenir à Mayotte se cadre autour de l'aéroport de Dzaoudzi-Pamandzi (Petite-Terre), accessible depuis Mamoudzou via la barge maritime (~30 min). Axion-IA organise les missions en blocs denses (3-5 jours sur place + livrables sous 5 jours), avec suivi distanciel sur 30-60 jours pour limiter les rotations longue distance. Devis transparent incluant vol, hébergement, navette barge et déplacements Grande-Terre / Petite-Terre selon le périmètre.",
    audienceCaseStudyFr: {
      titleFr: "Producteur d'ylang-ylang",
      leadFr: "Vente parfumeurs Grasse en direct",
      detailFr:
        "Distillerie ylang-ylang artisanale (Grande-Terre) : agent IA qui qualifie demandes parfumeurs (Grasse, Genève, NYC), retourne lots disponibles + huiles essentielles + certificats GC-MS. Délai réponse passé de 5 jours à 6 h.",
    },
  },
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
