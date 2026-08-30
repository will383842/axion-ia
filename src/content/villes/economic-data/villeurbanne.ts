// Villeurbanne (69266) — data économique enrichie sourcée V3 multi-taille.
//
// Sprint City Quality V3 ville #16 (2026-05-18).
// Contrat zéro invention : chaque champ a un `source` vérifiable.
//
// Sources canoniques utilisées :
//   - INSEE dossier complet commune 69266 (2011101)
//   - competitivite.gouv.fr — pôles Phase V 2023-2026 (rayonnement Métropole de Lyon)
//   - Sites officiels écoles (insa-lyon.fr, cpe.fr, enssib.fr, univ-lyon1.fr, itech.fr)
//   - SNCF Connect (Lyon Part-Dieu à ~3 km, gare TGV de rattachement) + TCL (métro/tram)
//   - Aéroport Lyon-Saint-Exupéry (LYS) à ~25 km
//   - Wikipédia articles TNP, Gratte-Ciel, Lazare Goujon, Môrice Leroux,
//     ENSSIB, INSA Lyon, CPE Lyon, ITECH Lyon, Forvia, Renault Trucks
//   - Sites officiels patrimoine (citedelarchitecture.fr — Gratte-Ciel,
//     tnp-villeurbanne.com — Théâtre National Populaire, lerize.villeurbanne.fr)
//   - Sites officiels acteurs économiques (forvia.com, materiact.com — siège
//     monde et centre R&D Villeurbanne inauguré 13 nov. 2023)
//   - INAO (Rosette de Lyon IGP, Saucisson de Lyon IGP — bassin Lyon partagé)
//   - business.onlylyon.com (Bel Air Camp incubateur industriel Villeurbanne)
//
// Spécificité Villeurbanne : 2e ville du Rhône (~162 000 hab), accolée à Lyon
// (limitrophe est). Bassin économique partagé avec la Métropole de Lyon
// (mêmes pôles compétitivité, même CCI, même French Tech). Singularité propre
// = campus LyonTech-La Doua (100 ha, 25 000 étudiants — INSA Lyon, CPE Lyon,
// Université Claude Bernard Lyon 1, ENSSIB, CNRS, INRAE, Inria locaux) +
// patrimoine architectural moderniste Gratte-Ciel années 1930 (Môrice Leroux,
// 1927-1934) + Théâtre National Populaire (Roger Planchon / Patrice Chéreau)
// + héritage industriel reconverti (FORVIA MATERI'ACT siège mondial 2023).
//
// Reviewer : Claude Code Opus 4.7 (sprint City Quality V3 ville #16).

import type { VilleEconomicData } from "./types";

export const VILLEURBANNE_ECONOMIC_DATA: VilleEconomicData = {
  // ─── Couche 1 — Économie INSEE ──────────────────────────────────────
  topSectorsNaf: [
    {
      naf: "MN",
      label: "Activités spécialisées, scientifiques et techniques (sections M+N)",
      rank: 1,
      etablissementsCount: 4_172,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-69266",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "GHI",
      label: "Commerce, transports, hébergement et restauration (sections G+H+I)",
      rank: 2,
      etablissementsCount: 3_057,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-69266",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "OPQ",
      label: "Administration publique, enseignement, santé, action sociale (sections O+P+Q)",
      rank: 3,
      etablissementsCount: 2_150,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-69266",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "F",
      label: "Construction",
      rank: 4,
      etablissementsCount: 1_324,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-69266",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "J",
      label: "Information et communication (édition, logiciels, IT, médias)",
      rank: 5,
      etablissementsCount: 993,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-69266",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "K",
      label: "Activités financières et d'assurance / immobilier",
      rank: 6,
      etablissementsCount: 515,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-69266",
      verifiedOn: "2026-05-18",
    },
  ],

  // Villeurbanne mutualise les pôles de compétitivité de la Métropole de Lyon
  // (rayonnement, pas siège, sauf cas labellisé Auvergne-Rhône-Alpes).
  polesCompetitivite: [
    {
      nom: "Lyonbiopôle Auvergne-Rhône-Alpes",
      secteur: "Santé / biotech / dispositifs médicaux / vaccins",
      type: "rayonnement",
      source: "https://www.lyonbiopole.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Axelera",
      secteur: "Chimie / environnement / écologie industrielle",
      type: "rayonnement",
      source: "https://www.axelera.org/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Techtera",
      secteur: "Textiles techniques / matériaux souples",
      type: "rayonnement",
      source: "https://www.techtera.org/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "CARA Auvergne-Rhône-Alpes",
      secteur: "Mobilité / systèmes de transport / véhicules industriels",
      type: "rayonnement",
      source: "https://www.pole-cara.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  distances: {
    gareTgv: {
      nom: "Lyon Part-Dieu (TGV Sud-Est / Méditerranée — gare TGV de rattachement, ~3 km du centre Villeurbanne)",
      distanceKm: 3,
      source: "https://www.sncf-connect.com/gares/lyon-part-dieu",
    },
    aeroportPrincipal: {
      nom: "Lyon Saint-Exupéry (LYS) — aéroport international du bassin lyonnais",
      distanceKm: 25,
      source: "https://www.lyonaeroports.com/",
    },
    metroOuTram: {
      lignes: 4,
      source: "https://www.tcl.fr/decouvrir/le-reseau",
    },
    verifiedOn: "2026-05-18",
  },

  statsInsee: {
    etablissementsActifs: 13_426,
    creationsEntreprises: 3_978,
    densiteEtablissementsPour1000: 83,
    anneeReference: 2023,
    source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-69266",
    verifiedOn: "2026-05-18",
  },

  // ─── Couche 2 — Matière éditoriale unique ───────────────────────────
  marquesHistoriques: [
    {
      nom: "FORVIA MATERI'ACT",
      secteur: "Équipementier automobile / matériaux durables / R&D recyclage",
      lienVille: "siege",
      source:
        "https://www.forvia.com/en/press/materiact-inaugurates-its-world-class-rd-center-develop-materials-tomorrow",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "TNP — Théâtre National Populaire",
      secteur: "Théâtre / institution culturelle nationale (décentralisation Roger Planchon 1972)",
      lienVille: "siege",
      source: "https://www.tnp-villeurbanne.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  // Bassin de Lyon : Villeurbanne partage les IGP charcuterie historiques
  // (Rosette de Lyon, Saucisson de Lyon — zone géographique IGP couvre l'aire
  // urbaine lyonnaise). Pas d'AOP propre à Villeurbanne commune.
  produitsIgpAop: [
    {
      nom: "Rosette de Lyon",
      categorie: "Charcuterie",
      signe: "IGP",
      source: "https://www.inao.gouv.fr/produit/3329",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Saucisson de Lyon",
      categorie: "Charcuterie",
      signe: "IGP",
      source: "https://fr.wikipedia.org/wiki/Saucisson_de_Lyon",
      verifiedOn: "2026-05-18",
    },
  ],

  salonsSectoriels: [
    {
      nom: "Sirha (Salon international restauration, hôtellerie, alimentation)",
      secteur: "Gastronomie / hôtellerie / restauration",
      localisation: "Eurexpo Lyon (limitrophe — bassin Villeurbanne)",
      lienVille: "secteur_pertinent",
      source: "https://www.sirha-lyon.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Pollutec",
      secteur: "Environnement / énergies / déchets / eau",
      localisation: "Eurexpo Lyon (bassin Villeurbanne)",
      lienVille: "secteur_pertinent",
      source: "https://www.pollutec.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Global Industrie (édition Lyon)",
      secteur: "Industrie 4.0 / fabrication avancée (alternance Paris/Lyon)",
      localisation: "Eurexpo Lyon",
      lienVille: "secteur_pertinent",
      source: "https://www.global-industrie.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  patrimoineNotable: [
    {
      nom: "Quartier des Gratte-Ciel (1927-1934, Môrice Leroux — utopie urbaine moderniste, premiers gratte-ciel de France)",
      type: "monument",
      source:
        "https://www.citedelarchitecture.fr/fr/evenement/villeurbanne-lextension-du-quartier-des-gratte-ciel-des-annees-1930",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Théâtre National Populaire (TNP) — installé à Villeurbanne en 1972 (décentralisation Planchon/Chéreau)",
      type: "monument",
      source: "https://www.tnp-villeurbanne.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Palais du Travail (1931-1934, Môrice Leroux) — devenu salle Roger-Planchon du TNP",
      type: "monument",
      source:
        "http://www2.culture.gouv.fr/culture/dp/patrimoine-xx/pages/res_gratteciel_villeurbanne.html",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Le Rize — centre mémoires, cultures et échanges (archives municipales + médiation patrimoine)",
      type: "cite_metier",
      source: "https://lerize.villeurbanne.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Hôtel de Ville de Villeurbanne (1934, Robert Giroud — beffroi central, ensemble moderniste Gratte-Ciel)",
      type: "monument",
      source:
        "https://www.villeurbanne.fr/ma-ville/histoire-et-patrimoine/le-patrimoine-de-ma-ville",
      verifiedOn: "2026-05-18",
    },
  ],

  communesBassin: [
    {
      slug: "lyon",
      nameFr: "Lyon",
      distanceKm: 3,
      source: "https://fr.wikipedia.org/wiki/Villeurbanne",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "vaulx-en-velin",
      nameFr: "Vaulx-en-Velin",
      distanceKm: 4,
      source: "https://fr.wikipedia.org/wiki/Vaulx-en-Velin",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "bron",
      nameFr: "Bron",
      distanceKm: 5,
      source: "https://fr.wikipedia.org/wiki/Bron",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "caluire-et-cuire",
      nameFr: "Caluire-et-Cuire",
      distanceKm: 4,
      source: "https://fr.wikipedia.org/wiki/Caluire-et-Cuire",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "saint-priest",
      nameFr: "Saint-Priest",
      distanceKm: 9,
      source: "https://fr.wikipedia.org/wiki/Saint-Priest_(M%C3%A9tropole_de_Lyon)",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "venissieux",
      nameFr: "Vénissieux",
      distanceKm: 7,
      source: "https://fr.wikipedia.org/wiki/V%C3%A9nissieux",
      verifiedOn: "2026-05-18",
    },
  ],

  // Villeurbanne partage avec Lyon les vignobles AOC proches.
  vignoblesProches: [
    {
      aoc: "Beaujolais AOC",
      distanceKm: 30,
      source: "https://www.inao.gouv.fr/produit/4022",
      verifiedOn: "2026-05-18",
    },
    {
      aoc: "Côte-Rôtie AOC",
      distanceKm: 40,
      source: "https://www.inao.gouv.fr/produit/4029",
      verifiedOn: "2026-05-18",
    },
    {
      aoc: "Condrieu AOC",
      distanceKm: 40,
      source: "https://www.inao.gouv.fr/produit/4030",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Couche 3 — Multi-taille PME/ETI/GE ─────────────────────────

  // Label EPV : sans source individuelle confirmée par entreprise villeurbannaise,
  // champ vide pour respecter zéro invention. À compléter en cross-référençant
  // l'annuaire officiel data.economie.gouv.fr/explore/dataset/entreprises-du-patrimoine-vivant-epv
  // (Phase 2 du sprint).
  labelsEpvEtArtisanat: [],

  zonesActivitesParcs: [
    {
      nom: "Campus LyonTech-La Doua (100 ha, 25 000 étudiants — INSA Lyon, CPE Lyon, UCBL, ENSSIB, CNRS, INRAE, Inria)",
      type: "technopole",
      secteurDominant: "R&D / sciences appliquées / chimie / informatique / IA / matériaux",
      source:
        "https://www.universite-lyon.fr/vie-des-campus/fin-de-l-operation-lyon-cite-campus-livraison-du-chantier-campus-lyontech-la-doua-universite-claude-bernard-lyon-1-insa-lyon-cpe-lyon--316149.kjsp",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Bel Air Camp — hub industriel innovant Métropole de Lyon (3 000 m² ateliers couverts, co-working industriel)",
      type: "parc_tech",
      secteurDominant: "Industrie / hardware / fabrication avancée / startups industrielles",
      source: "https://business.onlylyon.com/en/discover-lyon/business-sectors/industry",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Carré de Soie (ZAC mixte Vaulx-en-Velin / Villeurbanne)",
      type: "zac",
      secteurDominant: "Tertiaire / mixte / éco-quartier",
      source: "https://www.grandlyon.com/projets/carre-de-soie",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Quartier Gratte-Ciel (centre urbain — extension Gratte-Ciel Nord 2020+)",
      type: "district_eco",
      secteurDominant: "Tertiaire / commerces / services",
      source: "https://www.villeurbanne.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  grandesEcolesEtUniversites: [
    {
      nom: "INSA Lyon — Institut National des Sciences Appliquées (campus LyonTech-La Doua, ~5 400 étudiants ingénieurs)",
      type: "ecole_ingenieur",
      specialites: [
        "Ingénierie généraliste",
        "Informatique / IA",
        "Mécanique",
        "Génie civil",
        "Génie électrique",
        "Bio-ingénierie",
        "Télécommunications",
      ],
      source: "https://www.insa-lyon.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "CPE Lyon — École supérieure de Chimie Physique Électronique (campus LyonTech-La Doua)",
      type: "ecole_ingenieur",
      specialites: ["Chimie", "Physique", "Électronique", "Informatique", "Sciences du numérique"],
      source: "https://www.cpe.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Université Claude Bernard Lyon 1 (UCBL) — campus LyonTech-La Doua (sciences + santé + sport)",
      type: "universite",
      specialites: ["Sciences", "Santé", "Sport", "Mathématiques", "Informatique"],
      source: "https://www.univ-lyon1.fr/campus/plan-des-campus/campus-lyontech-la-doua",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ENSSIB — École nationale supérieure des sciences de l'information et des bibliothèques (siège unique national)",
      type: "autre",
      specialites: [
        "Sciences de l'information",
        "Bibliothèques",
        "Documentation",
        "Édition numérique",
      ],
      source: "https://www.enssib.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ITECH Lyon — Institut Textile et Chimique de Lyon (campus Écully — proche Villeurbanne)",
      type: "ecole_ingenieur",
      specialites: ["Textile", "Chimie formulation", "Cuir", "Matériaux plastiques"],
      source: "https://www.itech.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "IUT Lyon 1 — site de Villeurbanne Doua (technologique, ~3 300 étudiants)",
      type: "iut",
      specialites: [
        "Génie biologique",
        "Génie chimique",
        "Génie civil",
        "Génie électrique",
        "Informatique",
      ],
      source: "https://www.univ-lyon1.fr/campus/plan-des-campus/iut-site-de-villeurbanne-doua",
      verifiedOn: "2026-05-18",
    },
  ],

  polesRechercheRD: [
    {
      nom: "CNRS — sites campus LyonTech-La Doua (laboratoires mixtes UCBL/INSA/CPE)",
      organisme: "cnrs",
      domaine: "Chimie / physique / matériaux / informatique / IA",
      source: "https://www.cnrs.fr/fr/delegation/dr07",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "INRAE — antenne campus LyonTech-La Doua",
      organisme: "inrae",
      domaine: "Agriculture / alimentation / environnement",
      source: "https://www.inrae.fr/centres/lyon-grenoble-auvergne-rhone-alpes",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Inria — antenne Lyon (présence campus LyonTech-La Doua)",
      organisme: "inria",
      domaine: "Informatique / sciences du numérique / IA",
      source: "https://www.inria.fr/fr",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "MATERI'ACT R&D Center (Forvia) — centre R&D mondial matériaux durables (7 500 m², ouvert 13 nov. 2023)",
      organisme: "autre",
      domaine: "Matériaux durables / polymères recyclés / biosourcés / fibres carbone bas-carbone",
      source:
        "https://www.forvia.com/en/press/materiact-inaugurates-its-world-class-rd-center-develop-materials-tomorrow",
      verifiedOn: "2026-05-18",
    },
  ],

  grandsGroupesImplantes: [
    {
      nom: "FORVIA MATERI'ACT",
      secteur:
        "Équipementier automobile / matériaux durables (filiale FORVIA — 7e équipementier auto mondial)",
      typeImplantation: "siege_social",
      source:
        "https://business.onlylyon.com/en/news/article/business-set-up-forvia-materi-act-head-office-research-development-center-sustainable-materials-villeurbanne-lyon-metropole-aderly",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "TVH Consulting (intégrateur ERP SAP / Microsoft Dynamics — siège historique)",
      secteur: "Conseil / intégration ERP / services numériques",
      typeImplantation: "site_majeur",
      source: "https://fr.wikipedia.org/wiki/TVH_Consulting",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Couche 2bis — tags KB sectorielles ─────────────────────────────
  // Volontairement vide en V1 : la KB Prisma ne contient pas encore
  // d'entries sectorielles dédiées (Phase B du sprint).
  kbSectorTags: ["it-numerique", "chimie-pharma", "enseignement-recherche"],

  // ─── Optionnels (hors scoring dashboard) ────────────────────────────
  capitaleFrenchTech: {
    statut: "capitale",
    nomChapitre:
      "French Tech One Lyon-St-Étienne (Villeurbanne intégrée — bassin Métropole de Lyon)",
    source: "https://lafrenchtech-one.com/",
    verifiedOn: "2026-05-18",
  },

  cciCompetente: {
    nom: "CCI Lyon Métropole Saint-Étienne Roanne",
    source: "https://www.lyon-metropole.cci.fr/",
    verifiedOn: "2026-05-18",
  },

  // distancesGrandesMetropoles : Villeurbanne est intra-Métropole de Lyon
  // (limitrophe — 3 km), elle EST la métropole lyonnaise. Champ omis.

  incubateursAccelerateurs: [
    {
      nom: "Bel Air Camp — incubateur industriel Métropole de Lyon (Villeurbanne)",
      focus: "Industrie / hardware / fabrication avancée / startups industrielles",
      source: "https://business.onlylyon.com/en/discover-lyon/business-sectors/industry",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "INSA Lyon Booster (incubateur étudiant-chercheur INSA Lyon)",
      focus: "Deep tech / ingénierie / IA / industrie",
      source: "https://www.insa-lyon.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Pulsalys (SATT Lyon — transfert techno UCBL/INSA/CPE)",
      focus: "Transfert technologies recherche publique (chimie, matériaux, santé, IA)",
      source: "https://www.pulsalys.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "MATERI'ACT incubateur startups matériaux durables (hub 2 000 m² intégré au centre R&D)",
      focus: "Cleantech / matériaux durables / économie circulaire",
      source:
        "https://www.forvia.com/en/press/materiact-inaugurates-its-world-class-rd-center-develop-materials-tomorrow",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Spécificités locales hors grille standard ──────────────────────
  specificitesLocales: [
    {
      theme: "campus_universitaire_majeur",
      description:
        "Campus LyonTech-La Doua (100 ha, 25 000 étudiants — INSA Lyon, CPE Lyon, UCBL, ENSSIB, IUT Lyon 1) : 1er pôle universitaire scientifique de la Métropole de Lyon, ancré à Villeurbanne.",
      source:
        "https://www.universite-lyon.fr/vie-des-campus/fin-de-l-operation-lyon-cite-campus-livraison-du-chantier-campus-lyontech-la-doua-universite-claude-bernard-lyon-1-insa-lyon-cpe-lyon--316149.kjsp",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "patrimoine_moderniste_gratte_ciel",
      description:
        "Quartier des Gratte-Ciel (1927-1934, Môrice Leroux) : premiers gratte-ciel de France, utopie urbaine moderniste sous mandat Lazare Goujon — patrimoine XXe protégé, identité architecturale unique.",
      source:
        "https://www.citedelarchitecture.fr/fr/evenement/villeurbanne-lextension-du-quartier-des-gratte-ciel-des-annees-1930",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "decentralisation_culturelle_tnp",
      description:
        "Théâtre National Populaire (TNP) décentralisé à Villeurbanne en 1972 (ministère Duhamel) — direction historique Roger Planchon / Patrice Chéreau / Robert Gilbert, rupture avec la centralisation parisienne.",
      source: "https://www.tnp-villeurbanne.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Métadonnées de revue ───────────────────────────────────────────
  lastReviewedOn: "2026-05-18",
  reviewedBy: "Claude Code Opus 4.7 (sprint City Quality V3 ville #16)",
};
