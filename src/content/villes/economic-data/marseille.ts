// Marseille (13055) — data économique enrichie sourcée V3.
// Sprint City Quality 39 villes pilote, ville #2.
// Contrat zéro invention.

import type { VilleEconomicData } from "./types";

export const MARSEILLE_ECONOMIC_DATA: VilleEconomicData = {
  topSectorsNaf: [
    {
      naf: "GHI",
      label: "Commerce, transports et services divers",
      rank: 1,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-13055",
      verifiedOn: "2026-05-18",
      etablissementsCount: 22_817,
    },
    {
      naf: "OPQ",
      label: "Administration publique, enseignement, santé, action sociale",
      rank: 2,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-13055",
      verifiedOn: "2026-05-18",
      etablissementsCount: 4_177,
    },
    {
      naf: "F",
      label: "Construction",
      rank: 3,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-13055",
      verifiedOn: "2026-05-18",
      etablissementsCount: 3_291,
    },
    {
      naf: "BCDE",
      label: "Industrie",
      rank: 4,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-13055",
      verifiedOn: "2026-05-18",
      etablissementsCount: 1_329,
    },
  ],

  polesCompetitivite: [
    {
      nom: "Optitec",
      secteur: "Imagerie / photonique (Technopole Château-Gombert)",
      type: "siege",
      source: "https://pole-optitec.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Eurobiomed",
      secteur: "Santé / biotechnologie / dispositifs médicaux",
      type: "siege",
      source: "https://www.eurobiomed.org/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Capenergies",
      secteur: "Énergie / transition énergétique",
      type: "rayonnement",
      source: "https://www.capenergies.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "SAFE Cluster",
      secteur: "Aérospatial / sécurité / défense / risques",
      type: "rayonnement",
      source: "https://www.safecluster.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Pôle Mer Méditerranée",
      secteur: "Économie maritime / nautisme / pêche",
      type: "rayonnement",
      source: "https://www.polemermediterranee.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  distances: {
    gareTgv: {
      nom: "Marseille Saint-Charles (intra-muros) — TGV Méditerranée",
      distanceKm: 0,
      source: "https://www.sncf-connect.com/gares/marseille-saint-charles",
    },
    aeroportPrincipal: {
      nom: "Marseille Provence (Marignane)",
      distanceKm: 27,
      source: "https://www.marseille.aeroport.fr/",
    },
    metroOuTram: {
      lignes: 2,
      source: "https://www.rtm.fr/plans",
    },
    verifiedOn: "2026-05-18",
  },

  statsInsee: {
    etablissementsActifs: 31_646,
    creationsEntreprises: 21_044,
    densiteEtablissementsPour1000: 36,
    anneeReference: 2024,
    source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-13055",
    verifiedOn: "2026-05-18",
  },

  marquesHistoriques: [
    {
      nom: "CMA CGM",
      secteur: "Transport maritime / logistique",
      lienVille: "siege",
      source:
        "https://fr.wikipedia.org/wiki/Compagnie_maritime_d%27affr%C3%A8tement_-_Compagnie_g%C3%A9n%C3%A9rale_maritime",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Savon de Marseille",
      secteur: "Cosmétique / artisanat (production historique XVIIème siècle)",
      lienVille: "heritage",
      source: "https://fr.wikipedia.org/wiki/Savon_de_Marseille",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Ricard",
      secteur: "Spiritueux / pastis (siège historique Marseille, fondation 1932)",
      lienVille: "fondation",
      source: "https://fr.wikipedia.org/wiki/Ricard_(soci%C3%A9t%C3%A9)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Le Petit Marseillais",
      secteur: "Cosmétique / hygiène",
      lienVille: "heritage",
      source: "https://fr.wikipedia.org/wiki/Le_Petit_Marseillais",
      verifiedOn: "2026-05-18",
    },
  ],

  produitsIgpAop: [
    {
      nom: "Huile d'olive de Provence",
      categorie: "Huile / agroalimentaire",
      signe: "AOP",
      source: "https://www.inao.gouv.fr/en/cp-huile-olive-provence-reconnue-aop",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Huile d'olive d'Aix-en-Provence",
      categorie: "Huile / agroalimentaire",
      signe: "AOP",
      source: "https://www.inao.gouv.fr/produit/huile-dolive-daix-en-provence-4509",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Huile d'olive de la Vallée des Baux-de-Provence",
      categorie: "Huile / agroalimentaire",
      signe: "AOP",
      source:
        "https://www.inao.gouv.fr/produit/huile-dolive-de-la-vallee-des-baux-de-provence-4511",
      verifiedOn: "2026-05-18",
    },
  ],

  salonsSectoriels: [
    {
      nom: "Euromaritime",
      secteur: "Économie maritime / nautisme / énergie marine",
      localisation: "Parc Chanot, Marseille",
      lienVille: "accueille",
      source: "https://www.euromaritime.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Salon Nautique de Marseille",
      secteur: "Nautisme",
      localisation: "Parc Chanot, Marseille",
      lienVille: "accueille",
      source: "https://www.salonnautiquemarseille.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Top Transport Europe",
      secteur: "Logistique / supply chain",
      localisation: "Parc Chanot, Marseille",
      lienVille: "accueille",
      source: "https://www.top-transport.net/",
      verifiedOn: "2026-05-18",
    },
  ],

  patrimoineNotable: [
    {
      nom: "MUCEM (Musée des civilisations de l'Europe et de la Méditerranée)",
      type: "musee",
      source: "https://www.mucem.org/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Basilique Notre-Dame de la Garde",
      type: "monument",
      source: "https://www.notredamedelagarde.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Vieux-Port + Forts Saint-Jean et Saint-Nicolas",
      type: "monument",
      source: "https://www.marseille-tourisme.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Cité Radieuse Le Corbusier (UNESCO 2016)",
      type: "unesco",
      source: "https://whc.unesco.org/en/list/1321",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Palais Longchamp",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Palais_Longchamp",
      verifiedOn: "2026-05-18",
    },
  ],

  communesBassin: [
    {
      slug: "aubagne",
      nameFr: "Aubagne",
      distanceKm: 17,
      source: "https://fr.wikipedia.org/wiki/Aubagne",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "la-ciotat",
      nameFr: "La Ciotat",
      distanceKm: 30,
      source: "https://fr.wikipedia.org/wiki/La_Ciotat",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "vitrolles",
      nameFr: "Vitrolles",
      distanceKm: 22,
      source: "https://fr.wikipedia.org/wiki/Vitrolles_(Bouches-du-Rh%C3%B4ne)",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "marignane",
      nameFr: "Marignane",
      distanceKm: 25,
      source: "https://fr.wikipedia.org/wiki/Marignane",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "aix-en-provence",
      nameFr: "Aix-en-Provence",
      distanceKm: 30,
      source: "https://fr.wikipedia.org/wiki/Aix-en-Provence",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "cassis",
      nameFr: "Cassis",
      distanceKm: 22,
      source: "https://fr.wikipedia.org/wiki/Cassis",
      verifiedOn: "2026-05-18",
    },
  ],

  vignoblesProches: [
    {
      aoc: "Cassis (vin)",
      distanceKm: 22,
      source: "https://www.inao.gouv.fr/produit/3309",
      verifiedOn: "2026-05-18",
    },
    {
      aoc: "Côtes-de-Provence",
      distanceKm: 30,
      source: "https://fr.wikipedia.org/wiki/C%C3%B4tes-de-provence_(AOC)",
      verifiedOn: "2026-05-18",
    },
    {
      aoc: "Coteaux d'Aix-en-Provence",
      distanceKm: 30,
      source: "https://fr.wikipedia.org/wiki/Coteaux-d%27aix-en-provence_(AOC)",
      verifiedOn: "2026-05-18",
    },
  ],

  // Pas de label EPV individuellement sourcé pour Marseille en V1 (à
  // compléter via annuaire data.economie.gouv.fr/explore/dataset/entreprises-du-patrimoine-vivant-epv).
  labelsEpvEtArtisanat: [],

  zonesActivitesParcs: [
    {
      nom: "Euroméditerranée (Opération d'Intérêt National)",
      type: "zac",
      secteurDominant: "Tertiaire / business district / logistique portuaire",
      source: "https://www.euromediterranee.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Technopole Château-Gombert",
      type: "technopole",
      secteurDominant: "Recherche / écoles ingénieurs / industrie de précision",
      source: "https://technopole-marseille.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Marseille Luminy (technopôle universitaire)",
      type: "technopole",
      secteurDominant: "Université / biotech / sciences",
      source: "https://www.grandluminy.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ZAC Joliette / Quartier des Affaires",
      type: "district_eco",
      secteurDominant: "Tertiaire / siège sociaux",
      source: "https://fr.wikipedia.org/wiki/La_Joliette",
      verifiedOn: "2026-05-18",
    },
  ],

  grandesEcolesEtUniversites: [
    {
      nom: "Aix-Marseille Université (AMU)",
      type: "universite",
      specialites: ["Sciences", "Lettres", "Droit", "Économie", "Médecine"],
      source: "https://www.univ-amu.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Centrale Méditerranée",
      type: "ecole_ingenieur",
      specialites: ["Ingénierie généraliste", "Énergie", "Numérique"],
      source: "https://www.centrale-mediterranee.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Kedge Business School (Marseille Luminy)",
      type: "ecole_commerce",
      specialites: ["Management", "Finance", "Supply Chain"],
      source: "https://kedge.edu/l-ecole/les-campus/marseille",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Polytech Marseille",
      type: "ecole_ingenieur",
      specialites: ["Génie civil", "Mécanique", "Informatique", "Microélectronique"],
      source: "https://polytech.univ-amu.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ENSM (École Nationale Supérieure Maritime, Marseille Luminy)",
      type: "ecole_ingenieur",
      specialites: ["Marine marchande", "Génie maritime"],
      source: "https://www.supmaritime.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  polesRechercheRD: [
    {
      nom: "CNRS Délégation Provence-Corse (Marseille)",
      organisme: "cnrs",
      domaine: "Recherche multidisciplinaire (matériaux, microbiologie, physique)",
      source: "https://www.dr12.cnrs.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "INSERM (sites Marseille)",
      organisme: "inserm",
      domaine: "Santé / sciences biomédicales",
      source: "https://www.inserm.fr/nos-recherches/structures-de-recherche/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "IFREMER Centre Méditerranée",
      organisme: "autre",
      domaine: "Recherche marine / océanographie",
      source: "https://wwz.ifremer.fr/centre-mediterranee",
      verifiedOn: "2026-05-18",
    },
  ],

  grandsGroupesImplantes: [
    {
      nom: "CMA CGM",
      secteur: "Transport maritime / logistique",
      typeImplantation: "siege_social",
      source:
        "https://fr.wikipedia.org/wiki/Compagnie_maritime_d%27affr%C3%A8tement_-_Compagnie_g%C3%A9n%C3%A9rale_maritime",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Onet",
      secteur: "Services / propreté / sécurité / nucléaire",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/Onet",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "La Provence (groupe média)",
      secteur: "Médias / presse régionale",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/La_Provence_(journal)",
      verifiedOn: "2026-05-18",
    },
  ],

  kbSectorTags: ["maritime-portuaire", "logistique-supply-chain", "sante-biotech"],

  capitaleFrenchTech: {
    statut: "capitale",
    nomChapitre: "French Tech Aix-Marseille Région Sud",
    source: "https://lafrenchtech-aixmarseille.fr/",
    verifiedOn: "2026-05-18",
  },

  cciCompetente: {
    nom: "CCI métropolitaine Aix-Marseille Provence",
    source: "https://www.ccimp.com/",
    verifiedOn: "2026-05-18",
  },

  incubateursAccelerateurs: [
    {
      nom: "thecamp (Aix-Marseille — fermé 2023, ex hub innovation)",
      focus: "Tech / innovation (clôture activités opérationnelles 2023)",
      source: "https://fr.wikipedia.org/wiki/Thecamp",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Marseille Innovation",
      focus: "Incubation / pépinières (Technopole Château-Gombert, Marseille Luminy)",
      source: "https://www.marseille-innov.org/",
      verifiedOn: "2026-05-18",
    },
  ],

  specificitesLocales: [
    {
      theme: "port_maritime_majeur",
      description:
        "Premier port français en tonnage et en passagers, 1er port à conteneurs Méditerranée. Le Grand Port Maritime de Marseille opère Marseille-Fos.",
      source: "https://www.marseille-port.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "operation_interet_national",
      description:
        "Euroméditerranée est l'OIN la plus grande d'Europe : 480 ha en restructuration urbaine et économique depuis 1995.",
      source: "https://www.euromediterranee.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  lastReviewedOn: "2026-05-18",
  reviewedBy: "Claude Code Opus 4.7 (sprint City Quality V3 ville #2)",
};
