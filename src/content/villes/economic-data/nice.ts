// Nice (06088) — data économique enrichie sourcée V3 multi-taille.
//
// Sprint City Quality V3 2026-05-18, ville n°5.
// Contrat zéro invention : chaque champ a un `source` vérifiable.

import type { VilleEconomicData } from "./types";

export const NICE_ECONOMIC_DATA: VilleEconomicData = {
  topSectorsNaf: [
    {
      naf: "GHI",
      label:
        "Commerce, transports, services divers (sections G+H+I — incluant hébergement/restauration)",
      rank: 1,
      etablissementsCount: 12_087,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-06088",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "F",
      label: "Construction (section F)",
      rank: 2,
      etablissementsCount: 1_850,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-06088",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "OPQ",
      label: "Administration publique, enseignement, santé, action sociale (sections O+P+Q)",
      rank: 3,
      etablissementsCount: 1_826,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-06088",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "BCDE",
      label: "Industrie (sections B à E)",
      rank: 4,
      etablissementsCount: 537,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-06088",
      verifiedOn: "2026-05-18",
    },
  ],

  polesCompetitivite: [
    {
      nom: "SAFE Cluster",
      secteur: "Sécurité / défense / aéronautique / aérospatial",
      type: "rayonnement",
      source: "https://www.safecluster.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Pôle Mer Méditerranée",
      secteur: "Économie maritime / navigation / sûreté maritime / énergies marines",
      type: "rayonnement",
      source: "https://polemermediterranee.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Capénergies",
      secteur: "Énergies (renouvelables, nucléaire, efficacité énergétique)",
      type: "rayonnement",
      source: "https://www.capenergies.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Eurobiomed",
      secteur: "Santé / biotech / dispositifs médicaux / e-santé",
      type: "rayonnement",
      source: "https://www.eurobiomed.org/",
      verifiedOn: "2026-05-18",
    },
  ],

  distances: {
    gareTgv: {
      nom: "Gare de Nice-Ville (Gare Thiers) — TGV Paris/Lyon/Marseille",
      distanceKm: 0,
      source: "https://www.sncf-connect.com/gares/nice/nice",
    },
    aeroportPrincipal: {
      nom: "Aéroport Nice Côte d'Azur (NCE) — 2e aéroport de France",
      distanceKm: 7,
      source: "https://www.nice.aeroport.fr/",
    },
    metroOuTram: {
      lignes: 3,
      source: "https://www.lignesdazur.com/fr/plan-lignes-azur",
    },
    verifiedOn: "2026-05-18",
  },

  statsInsee: {
    etablissementsActifs: 16_327,
    creationsEntreprises: 10_892,
    densiteEtablissementsPour1000: 46,
    anneeReference: 2024,
    source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-06088",
    verifiedOn: "2026-05-18",
  },

  marquesHistoriques: [
    {
      nom: "Nicolas Alziari (huile d'olive depuis 1868)",
      secteur: "Agroalimentaire / huile d'olive (méthode génoise)",
      lienVille: "fondation",
      source: "https://www.alziari.com.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Amadeus IT Group",
      secteur: "Tech / GDS voyage / réservation aérienne (n°1 mondial)",
      lienVille: "production",
      source: "https://fr.wikipedia.org/wiki/Amadeus_IT_Group",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Maison Auer (chocolat / fruits confits depuis 1820)",
      secteur: "Agroalimentaire / confiserie / patrimoine niçois",
      lienVille: "fondation",
      source: "https://www.maison-auer.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  produitsIgpAop: [
    {
      nom: "Bellet (Vin AOC, blanc / rosé / rouge)",
      categorie: "Vin (vignoble urbain unique en France entièrement sur Nice)",
      signe: "AOC",
      source: "https://www.inao.gouv.fr/produit/bellet-ou-vin-de-bellet-blanc-9203",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Olive de Nice (AOP — fruit, huile, pâte)",
      categorie: "Oléiculture / olive Cailletier",
      signe: "AOP",
      source: "https://www.olivedenice-aop.com/l-olive-de-nice",
      verifiedOn: "2026-05-18",
    },
  ],

  salonsSectoriels: [
    {
      nom: "MIPIM (Marché International des Professionnels de l'Immobilier)",
      secteur: "Immobilier professionnel (référence mondiale)",
      localisation: "Cannes — bassin Nice/Côte d'Azur",
      lienVille: "secteur_pertinent",
      source: "https://www.mipim.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Cannes Lions International Festival of Creativity",
      secteur: "Communication / créativité / publicité",
      localisation: "Cannes — bassin Nice/Côte d'Azur",
      lienVille: "secteur_pertinent",
      source: "https://www.canneslions.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  patrimoineNotable: [
    {
      nom: "Nice, la ville de la villégiature d'hiver de riviera (UNESCO depuis 2021)",
      type: "unesco",
      source: "https://whc.unesco.org/en/list/1635",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Promenade des Anglais (7 km de front de mer, périmètre UNESCO)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Promenade_des_Anglais",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Hôtel Negresco (1913, monument historique)",
      type: "monument",
      source: "https://www.hotel-negresco-nice.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Musée Matisse",
      type: "musee",
      source: "https://www.musee-matisse-nice.org/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Musée national Marc Chagall",
      type: "musee",
      source: "https://musees-nationaux-alpesmaritimes.fr/chagall/",
      verifiedOn: "2026-05-18",
    },
  ],

  communesBassin: [
    {
      slug: "cannes",
      nameFr: "Cannes",
      distanceKm: 33,
      source: "https://fr.wikipedia.org/wiki/Cannes",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "antibes",
      nameFr: "Antibes",
      distanceKm: 21,
      source: "https://fr.wikipedia.org/wiki/Antibes",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "cagnes-sur-mer",
      nameFr: "Cagnes-sur-Mer",
      distanceKm: 13,
      source: "https://fr.wikipedia.org/wiki/Cagnes-sur-Mer",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "saint-laurent-du-var",
      nameFr: "Saint-Laurent-du-Var",
      distanceKm: 7,
      source: "https://fr.wikipedia.org/wiki/Saint-Laurent-du-Var",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "grasse",
      nameFr: "Grasse",
      distanceKm: 35,
      source: "https://fr.wikipedia.org/wiki/Grasse",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "menton",
      nameFr: "Menton",
      distanceKm: 30,
      source: "https://fr.wikipedia.org/wiki/Menton_(Alpes-Maritimes)",
      verifiedOn: "2026-05-18",
    },
  ],

  vignoblesProches: [
    {
      aoc: "Bellet (vignoble urbain entièrement situé sur la commune de Nice)",
      distanceKm: 0,
      source: "https://fr.wikipedia.org/wiki/Bellet_(AOC)",
      verifiedOn: "2026-05-18",
    },
    {
      aoc: "Côtes de Provence",
      distanceKm: 50,
      source: "https://www.inao.gouv.fr/produit/3411",
      verifiedOn: "2026-05-18",
    },
  ],

  labelsEpvEtArtisanat: [],

  zonesActivitesParcs: [
    {
      nom: "Nice Méridia (technopole urbaine, Eco-Vallée OIN)",
      type: "technopole",
      secteurDominant: "Santé / développement durable / formation-recherche-entreprise",
      source: "https://www.nicecotedazur.org/actualites/nice-ecovallee-nice-meridia/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Nice Eco-Vallée (OIN — Opération d'Intérêt National, 10 000 ha)",
      type: "district_eco",
      secteurDominant: "Tertiaire innovant / aménagement durable / 15 communes",
      source: "https://www.ecovallee-plaineduvar.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Grand Arénas (quartier d'affaires international Nice Eco-Vallée)",
      type: "zac",
      secteurDominant: "Affaires / tertiaire / hub multimodal aéroport",
      source: "https://www.nice-ecovallee.com/projets/grand-arenas/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Sophia Antipolis (technopole, 2 400 ha, à 20 km — bassin Nice)",
      type: "technopole",
      secteurDominant: "IT / télécoms / sciences de la vie / sciences de la terre",
      source: "https://www.sophia-antipolis.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  grandesEcolesEtUniversites: [
    {
      nom: "Université Côte d'Azur (UCA, IDEX)",
      type: "universite",
      specialites: ["Sciences", "Lettres", "Santé", "Droit", "Économie", "IA (3IA Côte d'Azur)"],
      source: "https://univ-cotedazur.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "EDHEC Business School — Campus Nice",
      type: "ecole_commerce",
      specialites: ["Finance (EDHEC-Risk Institute)", "Global MBA", "PhD Finance"],
      source: "https://www.edhec.edu/fr/campus/nice",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "SKEMA Business School (Campus Sophia, bassin Nice)",
      type: "ecole_commerce",
      specialites: ["Management", "Finance", "International Business"],
      source: "https://www.skema-bs.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Polytech Nice Sophia (école publique d'ingénieurs UCA)",
      type: "ecole_ingenieur",
      specialites: ["Informatique", "Électronique", "Mathématiques appliquées", "Robotique"],
      source: "https://polytech.univ-cotedazur.eu/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "EURECOM (Sophia Antipolis, bassin Nice)",
      type: "ecole_ingenieur",
      specialites: ["Réseaux", "Sécurité numérique", "Data science", "Communications"],
      source: "https://www.eurecom.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  polesRechercheRD: [
    {
      nom: "Centre Inria d'Université Côte d'Azur (Sophia + Nice)",
      organisme: "inria",
      domaine: "Informatique / IA / neurosciences computationnelles / robotique",
      source: "https://www.inria.fr/en/inria-centre-universite-cote-azur",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "I3S — Laboratoire d'Informatique, Signaux et Systèmes (UMR CNRS / UCA)",
      organisme: "cnrs",
      domaine: "Informatique / signaux / systèmes",
      source: "https://www.i3s.unice.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "3IA Côte d'Azur (Institut Interdisciplinaire d'Intelligence Artificielle)",
      organisme: "autre",
      domaine: "IA fondamentale et appliquée (santé, environnement, territoire)",
      source: "https://3ia.univ-cotedazur.eu/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "INSERM (sites Nice — UCA, biologie/santé)",
      organisme: "inserm",
      domaine: "Santé / sciences biomédicales / cancérologie",
      source: "https://www.inserm.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  grandsGroupesImplantes: [
    {
      nom: "Amadeus IT Group (R&D mondiale, ~3 000 salariés Sophia/Nice)",
      secteur: "Tech / GDS voyage / IT services",
      typeImplantation: "centre_rd",
      source: "https://fr.wikipedia.org/wiki/Amadeus_IT_Group",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "IBM (site La Gaude, bassin Nice)",
      secteur: "IT / cloud / services informatiques",
      typeImplantation: "site_majeur",
      source: "https://www.ibm.com/fr-fr",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "SAP Labs France (Sophia Antipolis, bassin Nice)",
      secteur: "Logiciels d'entreprise / ERP / IA business",
      typeImplantation: "centre_rd",
      source: "https://www.sap.com/france/about/office-locations.html",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Schneider Electric (site Carros, bassin Nice)",
      secteur: "Gestion énergie / automatisation industrielle",
      typeImplantation: "site_majeur",
      source: "https://www.se.com/fr/fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Thales Alenia Space (Cannes-Mandelieu, bassin Nice)",
      secteur: "Aérospatial / satellites",
      typeImplantation: "site_majeur",
      source: "https://www.thalesaleniaspace.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  kbSectorTags: ["it-numerique", "tourisme-affaires", "sante-biotech", "immobilier-pro"],

  capitaleFrenchTech: {
    statut: "capitale",
    nomChapitre: "French Tech Côte d'Azur",
    source: "https://www.frenchtechcotedazur.fr/",
    verifiedOn: "2026-05-18",
  },

  cciCompetente: {
    nom: "CCI Nice Côte d'Azur",
    source: "https://www.cote-azur.cci.fr/",
    verifiedOn: "2026-05-18",
  },

  incubateursAccelerateurs: [
    {
      nom: "CEEI Nice Côte d'Azur",
      focus: "Innovation / scale-up (Eco-Vallée)",
      source: "https://www.ceeinca.org/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Telecom Valley (Sophia, bassin Nice)",
      focus: "Cluster IT / télécoms / IoT (membre French Tech Capitale)",
      source: "https://telecom-valley.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  specificitesLocales: [
    {
      theme: "vignoble_urbain_aoc",
      description:
        "Nice est la seule grande ville française à abriter intégralement un vignoble AOC sur son territoire municipal (Bellet, 52 ha, décret du 11 novembre 1941).",
      source: "https://fr.wikipedia.org/wiki/Bellet_(AOC)",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "inscription_unesco_2021",
      description:
        "Nice a été inscrite au patrimoine mondial UNESCO le 27 juillet 2021 (44e session) comme ville de la villégiature d'hiver de riviera, 5e site UNESCO français, périmètre 500 ha incluant la Promenade des Anglais.",
      source: "https://whc.unesco.org/en/list/1635",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "bassin_tech_sophia",
      description:
        "Le bassin Nice/Sophia Antipolis (20 km) constitue le 1er technopôle européen, avec l'institut 3IA Côte d'Azur (1 des 4 instituts IA français du PIA) et Amadeus/IBM/SAP/Accenture/Thales implantés.",
      source: "https://www.sophia-antipolis.fr/en/history/",
      verifiedOn: "2026-05-18",
    },
  ],

  lastReviewedOn: "2026-05-18",
  reviewedBy: "Claude Code Opus 4.7 (sprint City Quality V3 ville #5)",
};
