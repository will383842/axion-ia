// Toulouse (31555) — data économique enrichie sourcée V3.
// Sprint City Quality 39 villes pilote, ville #4.

import type { VilleEconomicData } from "./types";

export const TOULOUSE_ECONOMIC_DATA: VilleEconomicData = {
  topSectorsNaf: [
    {
      naf: "GHI",
      label: "Commerce, transports et services divers",
      rank: 1,
      etablissementsCount: 15_062,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-31555",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "OPQ",
      label: "Administration publique, enseignement, santé, action sociale",
      rank: 2,
      etablissementsCount: 2_295,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-31555",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "F",
      label: "Construction",
      rank: 3,
      etablissementsCount: 1_432,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-31555",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "BCDE",
      label: "Industrie",
      rank: 4,
      etablissementsCount: 804,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-31555",
      verifiedOn: "2026-05-18",
    },
  ],

  polesCompetitivite: [
    {
      nom: "Aerospace Valley",
      secteur: "Aéronautique / spatial / drones / systèmes embarqués",
      type: "siege",
      source: "https://www.aerospace-valley.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Agri Sud-Ouest Innovation",
      secteur: "Agriculture / agroalimentaire / agro-ressources",
      type: "siege",
      source: "https://www.agrisudouest.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  distances: {
    gareTgv: {
      nom: "Toulouse Matabiau (intra-muros) — LGV Bordeaux-Toulouse en projet 2032",
      distanceKm: 0,
      source: "https://www.sncf-connect.com/gares/toulouse-matabiau",
    },
    aeroportPrincipal: {
      nom: "Toulouse Blagnac",
      distanceKm: 8,
      source: "https://www.toulouse.aeroport.fr/",
    },
    metroOuTram: {
      lignes: 2,
      source: "https://www.tisseo.fr/",
    },
    verifiedOn: "2026-05-18",
  },

  statsInsee: {
    etablissementsActifs: 19_612,
    creationsEntreprises: 13_817,
    densiteEtablissementsPour1000: 38,
    anneeReference: 2024,
    source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-31555",
    verifiedOn: "2026-05-18",
  },

  marquesHistoriques: [
    {
      nom: "Airbus",
      secteur: "Aéronautique (siège mondial Toulouse)",
      lienVille: "siege",
      source: "https://fr.wikipedia.org/wiki/Airbus",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ATR (Avions de Transport Régional)",
      secteur: "Aéronautique (siège Toulouse, JV Airbus-Leonardo)",
      lienVille: "siege",
      source: "https://fr.wikipedia.org/wiki/ATR_(constructeur_a%C3%A9ronautique)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Thales Alenia Space",
      secteur: "Satellites / spatial (site majeur Toulouse, 2000 employés)",
      lienVille: "production",
      source: "https://fr.wikipedia.org/wiki/Thales_Alenia_Space",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Pierre Fabre (laboratoires)",
      secteur: "Pharmacie / cosmétique (siège Castres, sites Toulouse)",
      lienVille: "production",
      source: "https://fr.wikipedia.org/wiki/Groupe_Pierre_Fabre",
      verifiedOn: "2026-05-18",
    },
  ],

  produitsIgpAop: [
    {
      nom: "Saucisse de Toulouse",
      categorie: "Charcuterie",
      signe: "IGP",
      source: "https://www.inao.gouv.fr/produit/3331",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Ail violet de Cadours",
      categorie: "Légume / condiment (Haute-Garonne)",
      signe: "AOP",
      source: "https://www.inao.gouv.fr/produit/8013",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Haricot tarbais",
      categorie: "Légume (zone Sud-Ouest proche)",
      signe: "IGP",
      source: "https://www.inao.gouv.fr/produit/3373",
      verifiedOn: "2026-05-18",
    },
  ],

  salonsSectoriels: [
    {
      nom: "Salon International de l'Aéronautique (rayonnement, Le Bourget)",
      secteur: "Aéronautique / spatial",
      localisation: "Paris Le Bourget (mais exposants Toulouse majoritaires)",
      lienVille: "secteur_pertinent",
      source: "https://www.siae.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Printemps d'Agri Sud-Ouest Innovation",
      secteur: "Agroalimentaire / agro-ressources",
      localisation: "Espace Vanel Toulouse",
      lienVille: "accueille",
      source: "https://www.agrisudouest.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Toulouse Space Show (TSS)",
      secteur: "Spatial / satellites / astronomie",
      localisation: "Toulouse",
      lienVille: "accueille",
      source: "https://www.toulousespaceshow.eu/",
      verifiedOn: "2026-05-18",
    },
  ],

  patrimoineNotable: [
    {
      nom: "Basilique Saint-Sernin (UNESCO Chemins de Saint-Jacques 1998)",
      type: "unesco",
      source: "https://whc.unesco.org/en/list/868",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Canal du Midi (UNESCO 1996, traverse Toulouse)",
      type: "unesco",
      source: "https://whc.unesco.org/en/list/770",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Capitole de Toulouse (hôtel de ville XVIIIème)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Capitole_de_Toulouse",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Cité de l'Espace (musée scientifique)",
      type: "musee",
      source: "https://www.cite-espace.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Musée des Augustins (beaux-arts)",
      type: "musee",
      source: "https://www.augustins.org/",
      verifiedOn: "2026-05-18",
    },
  ],

  communesBassin: [
    {
      slug: "blagnac",
      nameFr: "Blagnac",
      distanceKm: 7,
      source: "https://fr.wikipedia.org/wiki/Blagnac",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "colomiers",
      nameFr: "Colomiers",
      distanceKm: 10,
      source: "https://fr.wikipedia.org/wiki/Colomiers",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "tournefeuille",
      nameFr: "Tournefeuille",
      distanceKm: 10,
      source: "https://fr.wikipedia.org/wiki/Tournefeuille",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "muret",
      nameFr: "Muret",
      distanceKm: 22,
      source: "https://fr.wikipedia.org/wiki/Muret",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "balma",
      nameFr: "Balma",
      distanceKm: 7,
      source: "https://fr.wikipedia.org/wiki/Balma",
      verifiedOn: "2026-05-18",
    },
  ],

  vignoblesProches: [
    {
      aoc: "Fronton AOC",
      distanceKm: 30,
      source: "https://www.inao.gouv.fr/produit/3375",
      verifiedOn: "2026-05-18",
    },
    {
      aoc: "Gaillac AOC",
      distanceKm: 50,
      source: "https://www.inao.gouv.fr/produit/3376",
      verifiedOn: "2026-05-18",
    },
  ],

  labelsEpvEtArtisanat: [],

  zonesActivitesParcs: [
    {
      nom: "Toulouse Aerospace (campus innovation aérospatiale)",
      type: "technopole",
      secteurDominant: "Aérospatial / IA / objets connectés",
      source: "https://www.toulouse-aerospace.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Labège-Innopole",
      type: "technopole",
      secteurDominant: "Tertiaire / numérique / R&D",
      source: "https://www.sicoval.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Basso-Cambo",
      type: "district_eco",
      secteurDominant: "Tertiaire / services",
      source: "https://fr.wikipedia.org/wiki/Basso_Cambo",
      verifiedOn: "2026-05-18",
    },
  ],

  grandesEcolesEtUniversites: [
    {
      nom: "ISAE-SUPAERO (1909, 1er institut aérospatial mondial)",
      type: "ecole_ingenieur",
      specialites: ["Aéronautique", "Spatial", "Systèmes embarqués"],
      source: "https://www.isae-supaero.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "TBS Education (Toulouse Business School, triple accrédité)",
      type: "ecole_commerce",
      specialites: ["Management", "Finance", "Aerospace MBA"],
      source: "https://www.tbs-education.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Toulouse INP (Institut National Polytechnique)",
      type: "ecole_ingenieur",
      specialites: [
        "ENSEEIHT (informatique/élec/hydraulique)",
        "ENSIACET (chimie)",
        "ENSAT (agro)",
      ],
      source: "https://www.inp-toulouse.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "INSA Toulouse",
      type: "ecole_ingenieur",
      specialites: ["Génie civil", "Mécanique", "Informatique", "Génie biologique"],
      source: "https://www.insa-toulouse.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Université Toulouse 1 Capitole",
      type: "universite",
      specialites: ["Droit", "Économie", "Gestion"],
      source: "https://www.ut-capitole.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Université Paul Sabatier (Toulouse 3)",
      type: "universite",
      specialites: ["Sciences", "Santé", "Ingénierie"],
      source: "https://www.univ-tlse3.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ENAC (École Nationale de l'Aviation Civile)",
      type: "ecole_ingenieur",
      specialites: ["Aviation civile", "Trafic aérien", "Drones"],
      source: "https://www.enac.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  polesRechercheRD: [
    {
      nom: "CNES — Centre Spatial de Toulouse (siège des programmes)",
      organisme: "autre",
      domaine: "Spatial / observation Terre / télécommunications",
      source: "https://www.cnes.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "CNRS Délégation Occitanie Ouest (Toulouse)",
      organisme: "cnrs",
      domaine: "Recherche multidisciplinaire",
      source: "https://www.cnrs.fr/fr/delegation/dr14",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "INRAE Centre Occitanie-Toulouse",
      organisme: "inrae",
      domaine: "Agriculture / alimentation / environnement",
      source: "https://www.inrae.fr/centres/occitanie-toulouse",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ONERA (Office national d'études et de recherches aérospatiales)",
      organisme: "autre",
      domaine: "Recherche aérospatiale / défense",
      source: "https://www.onera.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  grandsGroupesImplantes: [
    {
      nom: "Airbus (siège mondial Toulouse, 5000+ employés)",
      secteur: "Aéronautique / défense / spatial",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/Airbus",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "CNES Toulouse Space Centre",
      secteur: "Spatial / agence spatiale",
      typeImplantation: "site_majeur",
      source: "https://www.cnes.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Thales Alenia Space (2000 employés Toulouse)",
      secteur: "Satellites / spatial",
      typeImplantation: "site_majeur",
      source: "https://www.thalesaleniaspace.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ATR (siège Blagnac)",
      secteur: "Aéronautique régionale",
      typeImplantation: "siege_social",
      source: "https://www.atr-aircraft.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Continental Automotive France (Toulouse)",
      secteur: "Automobile / électronique embarquée",
      typeImplantation: "site_majeur",
      source: "https://www.continental.com/fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  kbSectorTags: ["aerospatial-defense", "it-numerique", "agroalimentaire-igp", "construction-btp"],

  capitaleFrenchTech: {
    statut: "capitale",
    nomChapitre: "French Tech Toulouse",
    source: "https://www.lafrenchtechtoulouse.com/",
    verifiedOn: "2026-05-18",
  },

  cciCompetente: {
    nom: "CCI Toulouse Haute-Garonne",
    source: "https://www.toulouse.cci.fr/",
    verifiedOn: "2026-05-18",
  },

  incubateursAccelerateurs: [
    {
      nom: "IoT Valley (Labège)",
      focus: "Internet des objets / IoT industriel",
      source: "https://iot-valley.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ESA BIC Sud France (Toulouse)",
      focus: "Spatial / startups satellite",
      source: "https://www.esa-bic.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  specificitesLocales: [
    {
      theme: "capitale_europeenne_aerospatiale",
      description:
        "Capitale européenne de l'aéronautique et du spatial : siège Airbus, CNES, Thales Alenia Space, ATR, ONERA réunis dans le bassin toulousain (40 000+ emplois aéronautiques).",
      source: "https://www.invest-in-toulouse.fr/poles-excellence/spatial/",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "alliance_satellite_2026",
      description:
        "Hub du nouveau géant européen du spatial : alliance Airbus-Thales-Leonardo signée 2026 pour fusion activités satellites (25 000 employés, 6,5 Md€ CA, basée Toulouse).",
      source: "https://econostrum.info/airbus-thales-leonardo-geant-spatial-toulouse/",
      verifiedOn: "2026-05-18",
    },
  ],

  lastReviewedOn: "2026-05-18",
  reviewedBy: "Claude Code Opus 4.7 (sprint City Quality V3 ville #4)",
};
