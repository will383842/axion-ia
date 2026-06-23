// Lyon (69123) — data économique enrichie sourcée V3.
// Sprint City Quality 39 villes pilote, ville #3.

import type { VilleEconomicData } from "./types";

export const LYON_ECONOMIC_DATA: VilleEconomicData = {
  topSectorsNaf: [
    {
      naf: "GHI",
      label: "Commerce, transports et services divers",
      rank: 1,
      etablissementsCount: 22_485,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-69123",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "OPQ",
      label: "Administration publique, enseignement, santé, action sociale",
      rank: 2,
      etablissementsCount: 2_787,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-69123",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "F",
      label: "Construction",
      rank: 3,
      etablissementsCount: 1_093,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-69123",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "BCDE",
      label: "Industrie",
      rank: 4,
      etablissementsCount: 929,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-69123",
      verifiedOn: "2026-05-18",
    },
  ],

  polesCompetitivite: [
    {
      nom: "Axelera",
      secteur: "Chimie / environnement / écologie industrielle",
      type: "rayonnement",
      source: "https://www.axelera.org/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Lyonbiopôle Auvergne-Rhône-Alpes",
      secteur: "Santé / biotech / dispositifs médicaux / vaccins",
      type: "siege",
      source: "https://www.lyonbiopole.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Techtera",
      secteur: "Textiles techniques",
      type: "siege",
      source: "https://www.techtera.org/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "CARA Auvergne-Rhône-Alpes",
      secteur: "Mobilité / systèmes de transport",
      type: "siege",
      source: "https://www.pole-cara.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  distances: {
    gareTgv: {
      nom: "Lyon Part-Dieu (intra-muros) — TGV Sud-Est, Méditerranée. Lyon Perrache aussi TGV.",
      distanceKm: 0,
      source: "https://www.sncf-connect.com/gares/lyon-part-dieu",
    },
    aeroportPrincipal: {
      nom: "Lyon Saint-Exupéry",
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
    etablissementsActifs: 27_316,
    creationsEntreprises: 14_675,
    densiteEtablissementsPour1000: 52,
    anneeReference: 2024,
    source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-69123",
    verifiedOn: "2026-05-18",
  },

  marquesHistoriques: [
    {
      nom: "Crédit Lyonnais (LCL)",
      secteur: "Banque (fondation Lyon 1863)",
      lienVille: "fondation",
      source: "https://fr.wikipedia.org/wiki/Cr%C3%A9dit_lyonnais",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Bocuse (gastronomie)",
      secteur: "Gastronomie / restauration (Paul Bocuse, Collonges-au-Mont-d'Or)",
      lienVille: "heritage",
      source: "https://fr.wikipedia.org/wiki/Paul_Bocuse",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Boiron",
      secteur: "Homéopathie / pharmacie (siège Sainte-Foy-lès-Lyon)",
      lienVille: "siege",
      source: "https://fr.wikipedia.org/wiki/Boiron_(entreprise)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Aldes Aéraulique",
      secteur: "Ventilation / qualité de l'air",
      lienVille: "siege",
      source: "https://fr.wikipedia.org/wiki/Aldes_A%C3%A9raulique",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "April",
      secteur: "Assurance / courtage (groupe coté CAC Mid 60)",
      lienVille: "siege",
      source: "https://fr.wikipedia.org/wiki/April_(entreprise)",
      verifiedOn: "2026-05-18",
    },
  ],

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
      nom: "Sirha (Salon international de la restauration, hôtellerie, alimentation)",
      secteur: "Gastronomie / hôtellerie / restauration",
      localisation: "Eurexpo Lyon",
      lienVille: "accueille",
      source: "https://www.sirha-lyon.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Pollutec",
      secteur: "Environnement / énergies / déchets / eau",
      localisation: "Eurexpo Lyon",
      lienVille: "accueille",
      source: "https://www.pollutec.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "BePositive",
      secteur: "Construction durable / énergies bas-carbone",
      localisation: "Eurexpo Lyon",
      lienVille: "accueille",
      source: "https://www.bepositive-events.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Global Industrie",
      secteur: "Industrie 4.0 (alternance Paris / Lyon)",
      localisation: "Eurexpo Lyon (édition Lyon)",
      lienVille: "accueille",
      source: "https://www.global-industrie.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  patrimoineNotable: [
    {
      nom: "Site historique de Lyon (UNESCO 1998)",
      type: "unesco",
      source: "https://whc.unesco.org/en/list/872/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Vieux Lyon (quartier Renaissance)",
      type: "monument",
      source: "https://www.visiterlyon.com/decouvrir/sites-et-monuments",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Basilique Notre-Dame de Fourvière",
      type: "monument",
      source: "https://www.fourviere.org/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Musée des Confluences",
      type: "musee",
      source: "https://www.museedesconfluences.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Théâtres antiques de Fourvière (site archéologique)",
      type: "site_archeologique",
      source: "https://lugdunum.grandlyon.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  communesBassin: [
    {
      slug: "villeurbanne",
      nameFr: "Villeurbanne",
      distanceKm: 3,
      source: "https://fr.wikipedia.org/wiki/Villeurbanne",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "venissieux",
      nameFr: "Vénissieux",
      distanceKm: 8,
      source: "https://fr.wikipedia.org/wiki/V%C3%A9nissieux",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "caluire-et-cuire",
      nameFr: "Caluire-et-Cuire",
      distanceKm: 5,
      source: "https://fr.wikipedia.org/wiki/Caluire-et-Cuire",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "bron",
      nameFr: "Bron",
      distanceKm: 8,
      source: "https://fr.wikipedia.org/wiki/Bron",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "ecully",
      nameFr: "Écully",
      distanceKm: 6,
      source: "https://fr.wikipedia.org/wiki/%C3%89cully",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "saint-priest",
      nameFr: "Saint-Priest",
      distanceKm: 12,
      source: "https://fr.wikipedia.org/wiki/Saint-Priest_(M%C3%A9tropole_de_Lyon)",
      verifiedOn: "2026-05-18",
    },
  ],

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

  labelsEpvEtArtisanat: [],

  zonesActivitesParcs: [
    {
      nom: "Lyon Confluence (ZAC)",
      type: "zac",
      secteurDominant: "Tertiaire / éco-quartier / innovation",
      source: "https://www.lyon-confluence.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Part-Dieu (quartier d'affaires)",
      type: "district_eco",
      secteurDominant: "Tertiaire / siège sociaux / banque",
      source: "https://www.lyon-partdieu.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Lyon Gerland (technopole bio)",
      type: "technopole",
      secteurDominant: "Biotech / santé / pharmacie",
      source: "https://fr.wikipedia.org/wiki/Gerland",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Vaise (technopole numérique)",
      type: "technopole",
      secteurDominant: "Numérique / IT / médias",
      source: "https://fr.wikipedia.org/wiki/Vaise",
      verifiedOn: "2026-05-18",
    },
  ],

  grandesEcolesEtUniversites: [
    {
      nom: "INSA Lyon (Villeurbanne)",
      type: "ecole_ingenieur",
      specialites: ["Ingénierie généraliste", "Énergie", "Bio-ingénierie", "Génie civil"],
      source: "https://www.insa-lyon.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "École Centrale Lyon (Écully)",
      type: "ecole_ingenieur",
      specialites: ["Ingénierie généraliste", "Mécanique", "Énergie"],
      source: "https://www.ec-lyon.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ENS de Lyon",
      type: "ens",
      specialites: ["Sciences fondamentales", "Lettres", "Sciences sociales"],
      source: "https://www.ens-lyon.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "EM Lyon Business School (Écully)",
      type: "ecole_commerce",
      specialites: ["Management", "Entrepreneuriat", "Finance"],
      source: "https://em-lyon.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Sciences Po Lyon",
      type: "sciences_po",
      specialites: ["Sciences politiques", "Affaires publiques", "Relations internationales"],
      source: "https://www.sciencespo-lyon.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Université Claude Bernard Lyon 1",
      type: "universite",
      specialites: ["Sciences", "Santé", "Sport"],
      source: "https://www.univ-lyon1.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Université Lumière Lyon 2",
      type: "universite",
      specialites: ["Lettres", "Sciences humaines", "Sciences économiques"],
      source: "https://www.univ-lyon2.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  polesRechercheRD: [
    {
      nom: "CNRS Délégation Rhône Auvergne (Lyon)",
      organisme: "cnrs",
      domaine: "Recherche multidisciplinaire",
      source: "https://www.cnrs.fr/fr/delegation/dr07",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "INSERM Délégation régionale Auvergne-Rhône-Alpes",
      organisme: "inserm",
      domaine: "Santé / sciences biomédicales",
      source: "https://www.inserm.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "INRAE Centre Lyon-Grenoble Auvergne-Rhône-Alpes",
      organisme: "inrae",
      domaine: "Agriculture / alimentation / environnement",
      source: "https://www.inrae.fr/centres/lyon-grenoble-auvergne-rhone-alpes",
      verifiedOn: "2026-05-18",
    },
  ],

  grandsGroupesImplantes: [
    {
      nom: "Sanofi (site Lyon Gerland, vaccins)",
      secteur: "Pharmaceutique / vaccins",
      typeImplantation: "site_majeur",
      source: "https://fr.wikipedia.org/wiki/Sanofi",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "bioMérieux (siège Marcy-l'Étoile)",
      secteur: "Diagnostic in vitro / biotech",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/BioM%C3%A9rieux",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Groupe SEB (Écully)",
      secteur: "Petit électroménager",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/Groupe_SEB",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Renault Trucks (Saint-Priest)",
      secteur: "Industrie / véhicules industriels",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/Renault_Trucks",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Norauto / Mobivia (Lyon)",
      secteur: "Distribution automobile / services",
      typeImplantation: "site_majeur",
      source: "https://fr.wikipedia.org/wiki/Mobivia",
      verifiedOn: "2026-05-18",
    },
  ],

  kbSectorTags: [
    "chimie-pharma",
    "banque-finance",
    "sante-biotech",
    "tourisme-affaires",
    "juridique",
  ],

  capitaleFrenchTech: {
    statut: "capitale",
    nomChapitre: "French Tech One Lyon-St-Étienne",
    source: "https://lafrenchtech-one.com/",
    verifiedOn: "2026-05-18",
  },

  cciCompetente: {
    nom: "CCI Lyon Métropole Saint-Étienne Roanne",
    source: "https://www.lyon-metropole.cci.fr/",
    verifiedOn: "2026-05-18",
  },

  incubateursAccelerateurs: [
    {
      nom: "H7 (incubateur Confluence)",
      focus: "Numérique / startup tech",
      source: "https://www.h-sept.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Pulsalys (SATT)",
      focus: "Transfert de technologies recherche publique",
      source: "https://www.pulsalys.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  specificitesLocales: [
    {
      theme: "capitale_gastronomie",
      description:
        "Lyon est reconnue capitale mondiale de la gastronomie (UNESCO 2010 Repas gastronomique français + heritage Bocuse + bouchons lyonnais).",
      source: "https://www.unesco.org/fr/list/00437",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "tradition_soierie",
      description:
        "Tradition soyeuse historique des Canuts (XIXème siècle), source de l'industrie textile française.",
      source: "https://fr.wikipedia.org/wiki/Canut",
      verifiedOn: "2026-05-18",
    },
  ],

  lastReviewedOn: "2026-05-18",
  reviewedBy: "Claude Code Opus 4.7 (sprint City Quality V3 ville #3)",
};
