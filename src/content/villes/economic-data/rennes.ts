// Rennes (35238) — data économique enrichie sourcée V3 multi-taille.
//
// Sprint City Quality V3 2026-05-18, ville n°11.
// Contrat zéro invention : chaque champ a un `source` vérifiable.
//
// Sources canoniques utilisées :
//   - INSEE dossier complet commune 35238 (2011101)
//   - competitivite.gouv.fr — pôles Phase V 2023-2026
//   - Sites officiels pôles (images-et-reseaux.com, pole-valorial.fr, …)
//   - Wikipédia articles gare/aéroport/entreprises/écoles/monuments
//   - inria.fr, irisa.fr, sites officiels écoles (insa-rennes.fr, etc.)
//   - INAO + nosproduitsdequalite.fr (volailles IGP Bretagne / Janzé)
//   - space.fr (SPACE) + tourisme-rennes.com (patrimoine)
//   - Sites officiels Stellantis / Canon CRF / Orange Lab
//
// Doctrine Rennes : capitale historique du numérique français (CNET puis
// Orange Labs Lannion → Cesson-Sévigné), agroalimentaire (Valorial, SPACE),
// automobile (Stellantis La Janais à Chartres-de-Bretagne), recherche IA
// (Inria + IRISA UMR 6074, ~850 chercheurs).
//
// Reviewer : Claude Code Opus 4.7 (sprint City Quality V3 ville #11).

import type { VilleEconomicData } from "./types";

export const RENNES_ECONOMIC_DATA: VilleEconomicData = {
  // ─── Couche 1 — Économie INSEE ──────────────────────────────────────
  topSectorsNaf: [
    {
      naf: "MN",
      label:
        "Activités spécialisées, scientifiques et techniques + services administratifs (sections M+N)",
      rank: 1,
      etablissementsCount: 4_894,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-35238",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "GHI",
      label: "Commerce, transports, hébergement et restauration (sections G+H+I)",
      rank: 2,
      etablissementsCount: 3_827,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-35238",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "OPQ",
      label: "Administration publique, enseignement, santé, action sociale (sections O+P+Q)",
      rank: 3,
      etablissementsCount: 3_647,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-35238",
      verifiedOn: "2026-05-18",
    },
  ],

  polesCompetitivite: [
    {
      nom: "Images & Réseaux",
      secteur: "Numérique / IA / contenus / réseaux télécoms / 5G / cybersécurité",
      // Siège statutaire à Lannion (Côtes-d'Armor), mais bureau Rennes
      // historique majeur — l'écosystème numérique est trans-bassin
      // Rennes-Lannion-Brest-Nantes.
      type: "rayonnement",
      source: "https://www.images-et-reseaux.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Valorial",
      secteur: "Agroalimentaire / bioéconomie / innovation collaborative",
      // Siège à Rennes, labellisé pôle de compétitivité Phase V 2023-2026,
      // projet stratégique "Roots & Stars Season #2".
      type: "siege",
      source: "https://www.pole-valorial.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Pôle Mer Bretagne Atlantique",
      secteur: "Économie maritime / ressources marines / défense / sécurité",
      type: "rayonnement",
      source: "https://www.pole-mer-bretagne-atlantique.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  distances: {
    gareTgv: {
      // LGV Bretagne-Pays de la Loire mise en service juillet 2017,
      // Paris-Montparnasse → Rennes en 1h25-1h30 sans arrêt.
      nom: "Gare de Rennes — TGV Atlantique / LGV Bretagne-Pays de la Loire (Paris-Montparnasse 1h25)",
      distanceKm: 0,
      source: "https://fr.wikipedia.org/wiki/Gare_de_Rennes",
    },
    aeroportPrincipal: {
      nom: "Aéroport Rennes-Saint-Jacques (RNS) à Saint-Jacques-de-la-Lande",
      distanceKm: 8,
      source: "https://fr.wikipedia.org/wiki/A%C3%A9roport_de_Rennes-Bretagne",
    },
    metroOuTram: {
      // Ligne A (1ère métro VAL nord-sud depuis 2002) + Ligne B (automatique
      // est-ouest depuis sept. 2022, Saint-Jacques ↔ Cesson-Sévigné).
      lignes: 2,
      source: "https://fr.wikipedia.org/wiki/M%C3%A9tro_de_Rennes",
    },
    verifiedOn: "2026-05-18",
  },

  statsInsee: {
    // Source INSEE 35238 fin 2024 : 8 482 établissements employeurs,
    // 146 203 salariés, 4 679 créations 2025. Population 2022 = 227 830.
    etablissementsActifs: 8_482,
    creationsEntreprises: 4_679,
    densiteEtablissementsPour1000: 37,
    anneeReference: 2024,
    source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-35238",
    verifiedOn: "2026-05-18",
  },

  // ─── Couche 2 — Matière éditoriale unique ───────────────────────────
  marquesHistoriques: [
    {
      nom: "Stellantis (ex-PSA Citroën La Janais)",
      secteur: "Automobile — assemblage Citroën C5 Aircross + Peugeot 5008 II",
      // Usine ouverte 1961 pour Citroën, plus gros employeur privé du bassin
      // rennais (~4 830 salariés en 2014). Située Chartres-de-Bretagne sud
      // de Rennes.
      lienVille: "production",
      source: "https://fr.wikipedia.org/wiki/Usine_PSA_de_Rennes",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Canon Research Centre France (CRF)",
      secteur: "Numérique / imagerie / R&D",
      // Centre R&D européen Canon Group créé 1990, implanté Rennes Atalante
      // Cesson-Sévigné rue de La Touche Lambert.
      lienVille: "siege",
      source: "https://www.crf.canon.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Orange Innovation (ex-Orange Labs Cesson + Rennes Clos Courtel)",
      secteur: "Télécoms / R&D / IA / 5G",
      // Héritage du CNET (Centre National d'Études des Télécommunications)
      // qui a fait de Rennes-Lannion la capitale historique du numérique
      // français. Sites Lannion + Cesson-Sévigné + Caen.
      lienVille: "production",
      source: "https://fr.wikipedia.org/wiki/Orange_Labs",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Crédit Mutuel Arkéa",
      secteur: "Banque mutualiste / assurance",
      // Siège statutaire Le Relecq-Kerhuon (29), mais antenne historique
      // majeure 30 bd de la Tour d'Auvergne à Rennes.
      lienVille: "production",
      source: "https://fr.wikipedia.org/wiki/Cr%C3%A9dit_mutuel_Ark%C3%A9a",
      verifiedOn: "2026-05-18",
    },
  ],

  produitsIgpAop: [
    {
      nom: "Volaille de Bretagne (IGP)",
      categorie: "agroalimentaire / volailles",
      signe: "IGP",
      source: "https://www.nosproduitsdequalite.fr/labels/522",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Volaille de Janzé (IGP)",
      categorie: "agroalimentaire / volailles fermières",
      // Janzé = commune Ille-et-Vilaine à ~30 km au sud-est de Rennes,
      // berceau de la volaille fermière de Janzé IGP.
      signe: "IGP",
      source: "https://www.nosproduitsdequalite.fr/labels/522",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Cidre de Bretagne / Cidre breton (IGP)",
      categorie: "boissons / cidre",
      signe: "IGP",
      source: "https://lambig.bzh/siqo-bretons/",
      verifiedOn: "2026-05-18",
    },
  ],

  salonsSectoriels: [
    {
      nom: "SPACE — Salon International de l'Élevage",
      secteur: "Élevage / agroalimentaire / agri-tech",
      localisation: "Parc Expo Rennes Aéroport (Saint-Jacques-de-la-Lande)",
      // Édition 39 en sept. 2025 : 1 230 exposants 40 pays, 102 528
      // visiteurs dont 14 011 internationaux. Prochaine édition
      // 15-17 sept. 2026.
      lienVille: "accueille",
      source: "https://www.space.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Carrefour des Fournisseurs de l'Industrie Agroalimentaire (CFIA Rennes)",
      secteur: "Agroalimentaire / fournisseurs IAA",
      localisation: "Parc Expo Rennes Aéroport",
      lienVille: "accueille",
      source: "https://www.cfiaexpo.com/fr/cfia-rennes/",
      verifiedOn: "2026-05-18",
    },
  ],

  patrimoineNotable: [
    {
      nom: "Parlement de Bretagne (1618-1655, Salomon de Brosse)",
      type: "monument",
      // Cour souveraine de justice de l'Ancien Régime, incendié 1994,
      // restauré, classé Monument Historique.
      source: "https://www.tourisme-rennes.com/decouvrir-rennes/histoire/visiter-rennes-bretagne/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Place des Lices (champ clos médiéval, halles Martenot 1869)",
      type: "monument",
      source: "https://www.tourisme-rennes.com/decouvrir-rennes/histoire/visiter-rennes-bretagne/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Couvent des Jacobins (XIVe s.) — Centre des Congrès Rennes Métropole",
      type: "monument",
      // Couvent fondé 1369, transformé en centre des congrès, ouvert 2018.
      source: "https://fr.wikipedia.org/wiki/Couvent_des_Jacobins_(Rennes)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Musée des Beaux-Arts de Rennes",
      type: "musee",
      source: "https://mba.rennes.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  communesBassin: [
    {
      slug: "cesson-sevigne",
      nameFr: "Cesson-Sévigné",
      // Siège Atalante Beaulieu / ViaSilva, Canon CRF, Orange Innovation.
      distanceKm: 6,
      source: "https://fr.wikipedia.org/wiki/Cesson-S%C3%A9vign%C3%A9",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "saint-gregoire",
      nameFr: "Saint-Grégoire",
      distanceKm: 5,
      source: "https://fr.wikipedia.org/wiki/Saint-Gr%C3%A9goire_(Ille-et-Vilaine)",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "bruz",
      nameFr: "Bruz",
      // Atalante Ker-Lann (campus universitaire & tech).
      distanceKm: 12,
      source: "https://fr.wikipedia.org/wiki/Bruz",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "pace",
      nameFr: "Pacé",
      distanceKm: 10,
      source: "https://fr.wikipedia.org/wiki/Pac%C3%A9_(Ille-et-Vilaine)",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "chantepie",
      nameFr: "Chantepie",
      distanceKm: 5,
      source: "https://fr.wikipedia.org/wiki/Chantepie",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "chartres-de-bretagne",
      nameFr: "Chartres-de-Bretagne",
      // Site Stellantis La Janais (ex-PSA Citroën), plus gros employeur
      // privé du bassin rennais.
      distanceKm: 10,
      source: "https://fr.wikipedia.org/wiki/Chartres-de-Bretagne",
      verifiedOn: "2026-05-18",
    },
  ],

  // Pas de vignoble AOC à ≤ 50 km de Rennes (Muscadet à ~80 km au sud
  // près de Nantes, Anjou à ~120 km). Champ honnêtement vide.
  vignoblesProches: [],

  // ─── Couche 3 — Multi-taille PME/ETI/GE ─────────────────────────

  // Label EPV : pas d'extraction CSV par ville faite en V1 du sprint.
  // À compléter Phase 2 via data.economie.gouv.fr/explore/dataset/
  // entreprises-du-patrimoine-vivant-epv.
  labelsEpvEtArtisanat: [],

  zonesActivitesParcs: [
    {
      nom: "Rennes Atalante Beaulieu (270 ha, ~120 entreprises, 10 000 emplois)",
      type: "technopole",
      secteurDominant: "Numérique / TIC / IA / cybersécurité",
      source: "https://fr.wikipedia.org/wiki/Rennes_Atalante",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Rennes Atalante Champeaux",
      type: "technopole",
      secteurDominant: "Agronomie / agroalimentaire / environnement",
      source: "https://fr.wikipedia.org/wiki/Rennes_Atalante",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ZAC Atalante ViaSilva (Rennes / Cesson-Sévigné)",
      type: "zac",
      secteurDominant: "Tertiaire / numérique / écoquartier mixte",
      source: "https://www.territoires-rennes.fr/les-projets/viasilva-atalante",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Rennes Atalante Ker-Lann (Bruz)",
      type: "technopole",
      secteurDominant: "Enseignement supérieur / R&D / tertiaire",
      source: "https://fr.wikipedia.org/wiki/Rennes_Atalante",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Pôle d'Excellence Industrielle La Janais (Chartres-de-Bretagne)",
      type: "district_eco",
      // Reconversion site Stellantis : activités décarbonées + Safran
      // (6 ha, 500 emplois annoncés).
      secteurDominant: "Industrie décarbonée / transition écologique / aéronautique",
      source: "https://metropole.rennes.fr/la-janais-en-route-vers-le-futur",
      verifiedOn: "2026-05-18",
    },
  ],

  grandesEcolesEtUniversites: [
    {
      nom: "INSA Rennes — Institut National des Sciences Appliquées",
      type: "ecole_ingenieur",
      specialites: ["Ingénierie", "Informatique", "Mathématiques", "Génie civil", "EII"],
      source: "https://www.insa-rennes.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "CentraleSupélec — Campus de Rennes",
      type: "ecole_ingenieur",
      specialites: ["Systèmes / signaux", "Cybersécurité", "IA", "Télécoms"],
      source: "https://www.centralesupelec.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Rennes School of Business (Rennes SB)",
      type: "ecole_commerce",
      specialites: ["Management international", "Digital", "Finance", "Supply Chain"],
      source: "https://www.rennes-sb.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Sciences Po Rennes (IEP)",
      type: "sciences_po",
      specialites: ["Sciences politiques", "Affaires publiques", "Sécurité défense"],
      source: "https://www.sciencespo-rennes.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Université de Rennes (Rennes 1 + ENS Rennes consolidées)",
      type: "universite",
      specialites: ["Sciences", "Santé", "Droit", "Économie", "Numérique"],
      source: "https://www.univ-rennes.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Université Rennes 2 (lettres, sciences humaines, sociales)",
      type: "universite",
      specialites: ["Lettres", "Sciences humaines et sociales", "Arts", "Langues"],
      source: "https://www.univ-rennes2.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ENSAI — École Nationale de la Statistique et de l'Analyse de l'Information (Bruz)",
      type: "ecole_ingenieur",
      specialites: ["Statistique", "Data Science", "Économétrie", "IA"],
      source: "https://ensai.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ENSCR — École Nationale Supérieure de Chimie de Rennes",
      type: "ecole_ingenieur",
      specialites: ["Chimie", "Matériaux", "Procédés"],
      source: "https://www.ensc-rennes.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  polesRechercheRD: [
    {
      nom: "Centre Inria Rennes — Université de Rennes (28 équipes-projets)",
      organisme: "inria",
      domaine: "Informatique / IA / sciences du numérique / cybersécurité",
      // ~600 personnes, 50 nationalités, 24 équipes communes avec IRISA.
      source: "https://www.inria.fr/en/inria-centre-rennes-university",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "IRISA — UMR 6074 (CentraleSupélec + CNRS + ENS Rennes + IMT Atlantique + Inria + INSA + Inserm + UBS + Univ. Rennes)",
      organisme: "cnrs",
      // 850+ personnes, l'un des plus gros labos d'info de France.
      // Tutelle multi-organismes mais le CNRS y est partie prenante.
      domaine: "Informatique / IA / cybersécurité / santé / robotique",
      source: "https://www.irisa.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "INRAE — Centre Bretagne-Normandie (campus Rennes)",
      organisme: "inrae",
      domaine: "Agronomie / agroalimentaire / environnement / écologie",
      source: "https://www.inrae.fr/centres/bretagne-normandie",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "INSERM — Délégation régionale Grand Ouest (sites Rennes)",
      organisme: "inserm",
      domaine: "Santé / neurosciences / nutrition / cancérologie",
      source: "https://www.inserm.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  grandsGroupesImplantes: [
    {
      nom: "Stellantis Rennes — La Janais (Chartres-de-Bretagne)",
      secteur: "Automobile — assemblage SUV",
      typeImplantation: "usine_principale",
      source: "https://fr.wikipedia.org/wiki/Usine_PSA_de_Rennes",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Canon Research Centre France (CRF)",
      secteur: "Numérique / imagerie / R&D européenne du Canon Group",
      typeImplantation: "centre_rd",
      source: "https://www.crf.canon.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Orange Innovation (sites Cesson-Sévigné + Rennes Clos Courtel)",
      secteur: "Télécoms / R&D / IA",
      typeImplantation: "centre_rd",
      source: "https://fr.wikipedia.org/wiki/Orange_Labs",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Safran — Pôle d'Excellence Industrielle La Janais (6 ha, 500 emplois annoncés)",
      secteur: "Aéronautique / défense / industrie décarbonée",
      typeImplantation: "site_majeur",
      source: "https://metropole.rennes.fr/la-janais-en-route-vers-le-futur",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Crédit Mutuel Arkéa — site Rennes (30 bd Tour d'Auvergne)",
      secteur: "Banque mutualiste / assurance",
      typeImplantation: "site_majeur",
      source: "https://annuaire-entreprises.data.gouv.fr/etablissement/77557701803303",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Couche 2bis — tags KB sectorielles ─────────────────────────────
  // Volontairement vide en V1 : la KB Prisma ne contient pas encore
  // d'entries sectorielles dédiées (Phase B du sprint).
  kbSectorTags: ["it-numerique", "automobile-mobilite", "agroalimentaire-igp"],

  // ─── Optionnels (hors scoring dashboard) ────────────────────────────
  capitaleFrenchTech: {
    statut: "capitale",
    nomChapitre: "French Tech Rennes Saint-Malo",
    source: "https://lafrenchtech.com/fr/communaute-french-tech/",
    verifiedOn: "2026-05-18",
  },

  cciCompetente: {
    nom: "CCI Ille-et-Vilaine (CCI métropolitaine de Bretagne)",
    source: "https://www.ille-et-vilaine.cci.fr/",
    verifiedOn: "2026-05-18",
  },

  distancesGrandesMetropoles: [
    {
      metropole: "Paris",
      distanceKm: 350,
      // LGV BPL 2017 : Paris-Montparnasse → Rennes 1h25 (non-stop).
      tempsMnTgv: 85,
      source: "https://fr.wikipedia.org/wiki/Gare_de_Rennes",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Nantes",
      distanceKm: 110,
      tempsMnTgv: 75,
      source: "https://fr.wikipedia.org/wiki/Gare_de_Rennes",
      verifiedOn: "2026-05-18",
    },
  ],

  incubateursAccelerateurs: [
    {
      nom: "Le Poool (ex-Rennes Atalante)",
      focus: "Communauté innovation Rennes Saint-Malo, numérique / tech",
      source: "https://lepoool.tech/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Station B (incubateur étudiants inter-établissements)",
      // 10 écoles rennaises : Rennes SB, INSA, CentraleSupélec, Sciences Po,
      // ENS Rennes, ENSAI, etc.
      focus: "Incubateur étudiants entrepreneuriat multi-écoles",
      source:
        "https://www.centralesupelec.fr/lancement-officiel-du-projet-dincubateur-etudiants-rennais-inter-etablissements",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Spécificités locales hors grille standard ──────────────────────
  specificitesLocales: [
    {
      theme: "capitale_historique_numerique_francais",
      description:
        "Bassin Rennes-Lannion = héritage du CNET (1944) puis France Télécom R&D, aujourd'hui Orange Innovation. Tissu télécoms/numérique unique en France.",
      source: "https://fr.wikipedia.org/wiki/Orange_Labs",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "ecosysteme_recherche_ia_dense",
      description:
        "IRISA (850 pers., UMR 6074) + Inria Rennes (600 pers., 28 équipes) = un des plus gros pôles publics IA / sciences du numérique en France hors Île-de-France.",
      source: "https://www.irisa.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Adaptations Rennes (zéro invention) ────────────────────────────
  // Rennes n'a pas de vignoble AOC à ≤ 50 km (Muscadet ~80 km vers Nantes,
  // Anjou ~120 km). Exempté du scoring pour ne pas pénaliser injustement
  // la ville.
  notApplicableFields: ["vignoblesProches"],

  // ─── Métadonnées de revue ───────────────────────────────────────────
  lastReviewedOn: "2026-05-18",
  reviewedBy: "Claude Code Opus 4.7 (sprint City Quality V3 ville #11)",
};
