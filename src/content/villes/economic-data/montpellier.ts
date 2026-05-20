// Montpellier (34172) — data économique enrichie sourcée V3.
// Sprint City Quality 39 villes pilote, ville #7.

import type { VilleEconomicData } from "./types";

export const MONTPELLIER_ECONOMIC_DATA: VilleEconomicData = {
  topSectorsNaf: [
    {
      naf: "GHI",
      label: "Commerce, transports, hébergement et restauration (sections G+H+I)",
      rank: 1,
      etablissementsCount: 12_840,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-34172",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "MN",
      label:
        "Activités spécialisées, scientifiques et techniques + services administratifs (sections M+N)",
      rank: 2,
      etablissementsCount: 11_520,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-34172",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "OPQ",
      label: "Administration publique, enseignement, santé, action sociale",
      rank: 3,
      etablissementsCount: 6_710,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-34172",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "J",
      label: "Information et communication",
      rank: 4,
      etablissementsCount: 2_980,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-34172",
      verifiedOn: "2026-05-18",
    },
  ],

  polesCompetitivite: [
    {
      nom: "Eurobiomed",
      secteur: "Santé / biotech / dispositifs médicaux / diagnostic",
      type: "siege",
      source: "https://www.eurobiomed.org/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Qualiméditerranée",
      secteur: "Agroalimentaire / qualité / agro-ressources méditerranéennes",
      type: "siege",
      source: "https://www.qualimediterranee.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Optitec",
      secteur: "Photonique / optique / imagerie",
      type: "rayonnement",
      source: "https://www.pole-optitec.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Aqua-Valley",
      secteur: "Eau / gestion durable des ressources hydriques",
      type: "siege",
      source: "https://www.aqua-valley.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  distances: {
    gareTgv: {
      nom: "Montpellier Sud-de-France (LGV) + Montpellier Saint-Roch (intra-muros)",
      distanceKm: 0,
      source: "https://www.sncf-connect.com/gares/montpellier-sud-de-france",
    },
    aeroportPrincipal: {
      nom: "Aéroport Montpellier Méditerranée (MPL)",
      distanceKm: 8,
      source: "https://www.montpellier.aeroport.fr/",
    },
    metroOuTram: {
      lignes: 4,
      source: "https://www.tam-voyages.com/",
    },
    verifiedOn: "2026-05-18",
  },

  statsInsee: {
    etablissementsActifs: 36_590,
    creationsEntreprises: 9_240,
    densiteEtablissementsPour1000: 121,
    anneeReference: 2024,
    source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-34172",
    verifiedOn: "2026-05-18",
  },

  marquesHistoriques: [
    {
      nom: "Dell France",
      secteur: "Informatique / IT (siège France Montpellier depuis 1989)",
      lienVille: "siege",
      source: "https://fr.wikipedia.org/wiki/Dell",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "IBM Montpellier (Client Center)",
      secteur: "Informatique / cloud / IA (site depuis 1965)",
      lienVille: "production",
      source: "https://www.ibm.com/fr-fr/about/montpellier",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Ubisoft Montpellier",
      secteur: "Jeux vidéo (studio fondé 1994, Rayman, Beyond Good & Evil)",
      lienVille: "fondation",
      source: "https://fr.wikipedia.org/wiki/Ubisoft_Montpellier",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Sanofi (site R&D Montpellier)",
      secteur: "Pharmaceutique (centre R&D historique)",
      lienVille: "production",
      source: "https://fr.wikipedia.org/wiki/Sanofi",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Faculté de Médecine de Montpellier (1220)",
      secteur: "Enseignement médical — plus ancienne faculté en activité d'Europe",
      lienVille: "fondation",
      source: "https://fr.wikipedia.org/wiki/Facult%C3%A9_de_m%C3%A9decine_de_Montpellier",
      verifiedOn: "2026-05-18",
    },
  ],

  produitsIgpAop: [
    {
      nom: "Pélardon",
      categorie: "Fromage de chèvre",
      signe: "AOP",
      source: "https://www.inao.gouv.fr/produit/3404",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Picpoul de Pinet",
      categorie: "Vin blanc",
      signe: "AOC",
      source: "https://www.inao.gouv.fr/produit/6388",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Languedoc AOC",
      categorie: "Vin",
      signe: "AOC",
      source: "https://www.inao.gouv.fr/produit/6371",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Oignon doux des Cévennes",
      categorie: "Légume",
      signe: "AOP",
      source: "https://www.inao.gouv.fr/produit/6396",
      verifiedOn: "2026-05-18",
    },
  ],

  salonsSectoriels: [
    {
      nom: "EnerGaïa (Forum européen des énergies renouvelables)",
      secteur: "Énergies renouvelables / transition énergétique",
      localisation: "Parc des Expositions Montpellier",
      lienVille: "accueille",
      source: "https://www.energaia.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "SITEVI (vigne, vin, olive, fruits et légumes)",
      secteur: "Agroéquipement viticole et arboricole",
      localisation: "Parc des Expositions Montpellier",
      lienVille: "accueille",
      source: "https://www.sitevi.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "MEDPI",
      secteur: "Distribution IT / high-tech / électronique",
      localisation: "Monaco / Cap d'Agde (exposants IT Montpellier)",
      lienVille: "secteur_pertinent",
      source: "https://www.medpi.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  patrimoineNotable: [
    {
      nom: "Place de la Comédie (cœur historique XIXème)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Place_de_la_Com%C3%A9die_(Montpellier)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Promenade du Peyrou et Arc de Triomphe (XVIIème)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Promenade_du_Peyrou",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Faculté de Médecine de Montpellier (1220)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Facult%C3%A9_de_m%C3%A9decine_de_Montpellier",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Aqueduc Saint-Clément (XVIIIème, dit Arceaux)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Aqueduc_Saint-Cl%C3%A9ment",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Musée Fabre (beaux-arts)",
      type: "musee",
      source: "https://museefabre.montpellier3m.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Jardin des Plantes de Montpellier (1593, plus ancien jardin botanique de France)",
      type: "parc",
      source: "https://fr.wikipedia.org/wiki/Jardin_des_plantes_de_Montpellier",
      verifiedOn: "2026-05-18",
    },
  ],

  communesBassin: [
    {
      slug: "castelnau-le-lez",
      nameFr: "Castelnau-le-Lez",
      distanceKm: 4,
      source: "https://fr.wikipedia.org/wiki/Castelnau-le-Lez",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "lattes",
      nameFr: "Lattes",
      distanceKm: 5,
      source: "https://fr.wikipedia.org/wiki/Lattes_(H%C3%A9rault)",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "perols",
      nameFr: "Pérols",
      distanceKm: 7,
      source: "https://fr.wikipedia.org/wiki/P%C3%A9rols",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "mauguio",
      nameFr: "Mauguio",
      distanceKm: 10,
      source: "https://fr.wikipedia.org/wiki/Mauguio",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "saint-jean-de-vedas",
      nameFr: "Saint-Jean-de-Védas",
      distanceKm: 6,
      source: "https://fr.wikipedia.org/wiki/Saint-Jean-de-V%C3%A9das",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "sete",
      nameFr: "Sète",
      distanceKm: 35,
      source: "https://fr.wikipedia.org/wiki/S%C3%A8te",
      verifiedOn: "2026-05-18",
    },
  ],

  vignoblesProches: [
    {
      aoc: "Languedoc AOC (bassin montpelliérain)",
      distanceKm: 5,
      source: "https://www.inao.gouv.fr/produit/6371",
      verifiedOn: "2026-05-18",
    },
    {
      aoc: "Picpoul de Pinet AOC",
      distanceKm: 30,
      source: "https://www.inao.gouv.fr/produit/6388",
      verifiedOn: "2026-05-18",
    },
    {
      aoc: "Pic Saint-Loup AOC",
      distanceKm: 25,
      source: "https://www.inao.gouv.fr/produit/6406",
      verifiedOn: "2026-05-18",
    },
    {
      aoc: "Saint-Chinian AOC",
      distanceKm: 50,
      source: "https://www.inao.gouv.fr/produit/6395",
      verifiedOn: "2026-05-18",
    },
  ],

  labelsEpvEtArtisanat: [],

  zonesActivitesParcs: [
    {
      nom: "Parc Euromédecine",
      type: "technopole",
      secteurDominant: "Santé / biotech / dispositifs médicaux",
      source: "https://www.montpellier.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Cap Omega (technopôle numérique)",
      type: "technopole",
      secteurDominant: "Numérique / startups / IT",
      source: "https://www.bic-montpellier.com/cap-omega/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Parc Millénaire",
      type: "district_eco",
      secteurDominant: "Tertiaire / services",
      source: "https://fr.wikipedia.org/wiki/Le_Mill%C3%A9naire_(Montpellier)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Parc Agropolis (agronomie)",
      type: "technopole",
      secteurDominant: "Agronomie / agroalimentaire / R&D",
      source: "https://www.agropolis.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  grandesEcolesEtUniversites: [
    {
      nom: "Université de Montpellier (UM)",
      type: "universite",
      specialites: ["Sciences", "Médecine", "Pharmacie", "Droit", "Économie"],
      source: "https://www.umontpellier.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Université Paul-Valéry Montpellier 3",
      type: "universite",
      specialites: ["Lettres", "Sciences humaines", "Arts"],
      source: "https://www.univ-montp3.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Montpellier Business School (MBS, triple accréditation)",
      type: "ecole_commerce",
      specialites: ["Management", "Marketing", "Finance"],
      source: "https://www.montpellier-bs.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Polytech Montpellier",
      type: "ecole_ingenieur",
      specialites: ["Informatique", "Eau", "Matériaux", "Microélectronique"],
      source: "https://www.polytech.umontpellier.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Institut Agro Montpellier",
      type: "ecole_ingenieur",
      specialites: ["Agronomie", "Agroalimentaire", "Vigne et œnologie"],
      source: "https://www.institut-agro-montpellier.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ENSCM (École Nationale Supérieure de Chimie de Montpellier)",
      type: "ecole_ingenieur",
      specialites: ["Chimie", "Matériaux"],
      source: "https://www.enscm.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  polesRechercheRD: [
    {
      nom: "CIRAD (recherche agronomique tropicale, siège Montpellier)",
      organisme: "autre",
      domaine: "Agronomie tropicale / développement / sécurité alimentaire mondiale",
      source: "https://www.cirad.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "INRAE Centre Occitanie-Montpellier",
      organisme: "inrae",
      domaine: "Agriculture / alimentation / environnement / vigne",
      source: "https://www.inrae.fr/centres/occitanie-montpellier",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "IRD (Institut de Recherche pour le Développement, siège Montpellier)",
      organisme: "autre",
      domaine: "Recherche pour le développement / Sud global / climat",
      source: "https://www.ird.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "CNRS Délégation Occitanie Est (Montpellier)",
      organisme: "cnrs",
      domaine: "Recherche multidisciplinaire",
      source: "https://www.cnrs.fr/fr/delegation/dr13",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Inria Antenne Montpellier",
      organisme: "inria",
      domaine: "Informatique / data science / IA",
      source: "https://www.inria.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  grandsGroupesImplantes: [
    {
      nom: "Dell France (siège France, ~1500 employés)",
      secteur: "Informatique / IT / serveurs / cloud",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/Dell",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "IBM Montpellier (Client Center)",
      secteur: "Informatique / cloud / IA / mainframes",
      typeImplantation: "site_majeur",
      source: "https://www.ibm.com/fr-fr/about/montpellier",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Ubisoft Montpellier (studio AAA)",
      secteur: "Jeux vidéo",
      typeImplantation: "site_majeur",
      source: "https://fr.wikipedia.org/wiki/Ubisoft_Montpellier",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Sanofi (centre R&D Montpellier)",
      secteur: "Pharmaceutique",
      typeImplantation: "centre_rd",
      source: "https://fr.wikipedia.org/wiki/Sanofi",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "BRL (Compagnie d'aménagement Bas-Rhône Languedoc)",
      secteur: "Eau / aménagement hydraulique / ingénierie",
      typeImplantation: "siege_social",
      source: "https://www.brl.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  kbSectorTags: ["sante-biotech", "it-numerique", "agroalimentaire-igp"],

  capitaleFrenchTech: {
    statut: "capitale",
    nomChapitre: "French Tech Méditerranée",
    source: "https://lafrenchtech-mediterranee.com/",
    verifiedOn: "2026-05-18",
  },

  cciCompetente: {
    nom: "CCI Hérault",
    source: "https://www.herault.cci.fr/",
    verifiedOn: "2026-05-18",
  },

  distancesGrandesMetropoles: [
    {
      metropole: "Marseille",
      distanceKm: 170,
      tempsMnTgv: 95,
      source: "https://www.sncf-connect.com/",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Toulouse",
      distanceKm: 240,
      tempsMnTgv: 130,
      source: "https://www.sncf-connect.com/",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Paris",
      distanceKm: 750,
      tempsMnTgv: 195,
      source: "https://www.sncf-connect.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  incubateursAccelerateurs: [
    {
      nom: "BIC Montpellier Méditerranée Métropole",
      focus: "Généraliste / tech / santé / numérique (Cap Omega + Cap Alpha)",
      source: "https://www.bic-montpellier.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "MIBI (Montpellier International Business Incubator)",
      focus: "International / soft-landing startups étrangères",
      source: "https://www.bic-montpellier.com/mibi/",
      verifiedOn: "2026-05-18",
    },
  ],

  specificitesLocales: [
    {
      theme: "cluster_agro_sante",
      description:
        "Montpellier concentre le plus grand cluster mondial agronomie-développement (Agropolis : CIRAD, INRAE, IRD, Institut Agro) + écosystème santé (CHU + Eurobiomed + faculté médecine 1220).",
      source: "https://www.agropolis.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "hub_jeu_video",
      description:
        "2e pôle français du jeu vidéo après Paris : Ubisoft Montpellier, studios indépendants, formations dédiées (ArtFX, ESMA).",
      source: "https://fr.wikipedia.org/wiki/Ubisoft_Montpellier",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "metropole_dynamique",
      description:
        "7e ville de France par population intra-muros et 1ère pour la croissance démographique des grandes métropoles, ~75 000 étudiants.",
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-34172",
      verifiedOn: "2026-05-18",
    },
  ],

  lastReviewedOn: "2026-05-18",
  reviewedBy: "Claude Code Opus 4.7 (sprint City Quality V3 ville #7)",
};
