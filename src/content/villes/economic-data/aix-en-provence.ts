// Aix-en-Provence (13001) — data économique enrichie sourcée V3.
// Sprint City Quality V3 ville #21.
// Contrat zéro invention : chaque champ a un `source` vérifiable.
//
// Sources canoniques utilisées :
//   - INSEE dossier complet commune 13001 (2011101)
//   - competitivite.gouv.fr / entreprises.gouv.fr — Pôle SAFE (siège Aix-en-Provence)
//   - INAO — AOP Huile d'olive d'Aix-en-Provence + AOC Coteaux-d'Aix-en-Provence
//   - Sites officiels (sciencespo-aix.fr, artsetmetiers.fr, univ-amu.fr,
//     centrale-mediterranee.fr, amse-aixmarseille.fr, festival-aix.com, etc.)
//   - Wikipédia pour patrimoine, communes bassin, vignobles
//   - ITER (iter.org) + CEA Cadarache (cadarache.cea.fr)
//   - CCI métropolitaine Aix-Marseille-Provence (cciamp.com)
//
// Reviewer : Claude Code Opus 4.7 (sprint City Quality V3 ville #21).

import type { VilleEconomicData } from "./types";

export const AIX_EN_PROVENCE_ECONOMIC_DATA: VilleEconomicData = {
  // ─── Couche 1 — Économie INSEE ──────────────────────────────────────
  topSectorsNaf: [
    {
      naf: "MN",
      label: "Activités spécialisées, scientifiques et techniques (section M)",
      rank: 1,
      etablissementsCount: 6_242,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-13001",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "GHI",
      label: "Commerce, transports, hébergement et restauration (sections G+H+I)",
      rank: 2,
      etablissementsCount: 5_075,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-13001",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "OPQ",
      label: "Administration publique, enseignement, santé, action sociale (sections O+P+Q)",
      rank: 3,
      etablissementsCount: 3_979,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-13001",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "F",
      label: "Construction",
      rank: 4,
      etablissementsCount: 1_791,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-13001",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "BCDE",
      label: "Industrie (sections B+C+D+E)",
      rank: 5,
      etablissementsCount: 830,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-13001",
      verifiedOn: "2026-05-18",
    },
  ],

  polesCompetitivite: [
    {
      nom: "Pôle SAFE (Security, Aerospace, Fire & Environment)",
      secteur:
        "Aérospatial / sécurité / défense / gestion des risques (issu de la fusion Pégase + Risques)",
      type: "siege",
      source: "https://www.safecluster.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Pôle Mer Méditerranée",
      secteur: "Économie maritime / nautisme / énergie marine",
      type: "rayonnement",
      source: "https://www.polemermediterranee.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Capenergies",
      secteur: "Énergie / transition énergétique / nucléaire",
      type: "rayonnement",
      source: "https://www.capenergies.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Eurobiomed",
      secteur: "Santé / biotechnologie / dispositifs médicaux",
      type: "rayonnement",
      source: "https://www.eurobiomed.org/",
      verifiedOn: "2026-05-18",
    },
  ],

  distances: {
    gareTgv: {
      nom: "Aix-en-Provence TGV (gare des Milles, à 15 km du centre) — LGV Méditerranée",
      distanceKm: 15,
      source: "https://www.garesetconnexions.sncf/fr/gare/frxrs/aix-provence",
    },
    aeroportPrincipal: {
      nom: "Marseille Provence (Marignane)",
      distanceKm: 25,
      source: "https://www.marseille.aeroport.fr/",
    },
    // Aix-en-Provence n'a pas de métro/tramway en service (réseau Aix-en-Bus
    // composé de lignes de bus uniquement). Champ omis volontairement.
    verifiedOn: "2026-05-18",
  },

  statsInsee: {
    etablissementsActifs: 24_056,
    creationsEntreprises: 3_702,
    densiteEtablissementsPour1000: 161,
    anneeReference: 2024,
    source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-13001",
    verifiedOn: "2026-05-18",
  },

  // ─── Couche 2 — Matière éditoriale unique ───────────────────────────
  marquesHistoriques: [
    {
      nom: "Calissons d'Aix (Maison Bremond 1830, Confiserie du Roy René, Léonard Parli)",
      secteur:
        "Confiserie / patrimoine gastronomique provençal (spécialité Aix depuis XVIème siècle)",
      lienVille: "fondation",
      source: "https://fr.wikipedia.org/wiki/Calisson",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Confiserie du Roy René",
      secteur: "Confiserie / calissons d'Aix (fondée 1920 à Aix-en-Provence)",
      lienVille: "fondation",
      source: "https://www.calisson.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Maison Béchard",
      secteur: "Pâtisserie / confiserie (fondée 1870 sur le Cours Mirabeau)",
      lienVille: "fondation",
      source: "https://fr.wikipedia.org/wiki/Cours_Mirabeau",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Brasserie Les Deux Garçons (Les 2G)",
      secteur:
        "Restauration historique / patrimoine Cours Mirabeau (fondée 1792, lieu fréquenté par Cézanne et Zola)",
      lienVille: "fondation",
      source: "https://fr.wikipedia.org/wiki/Les_Deux_Gar%C3%A7ons",
      verifiedOn: "2026-05-18",
    },
  ],

  produitsIgpAop: [
    {
      nom: "Huile d'olive d'Aix-en-Provence",
      categorie: "Huile / agroalimentaire",
      signe: "AOP",
      source: "https://www.inao.gouv.fr/produit/huile-dolive-daix-en-provence-4509",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Coteaux d'Aix-en-Provence",
      categorie: "Vin",
      signe: "AOC",
      source: "https://fr.wikipedia.org/wiki/Coteaux-d%27aix-en-provence",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Huile d'olive de Provence",
      categorie: "Huile / agroalimentaire",
      signe: "AOP",
      source: "https://www.inao.gouv.fr/en/cp-huile-olive-provence-reconnue-aop",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Côtes-de-Provence",
      categorie: "Vin",
      signe: "AOC",
      source: "https://fr.wikipedia.org/wiki/C%C3%B4tes-de-provence_(AOC)",
      verifiedOn: "2026-05-18",
    },
  ],

  salonsSectoriels: [
    {
      nom: "Festival international d'Art Lyrique d'Aix-en-Provence",
      secteur: "Opéra / musique classique / culture (festival majeur depuis 1948)",
      localisation: "Théâtre de l'Archevêché + Grand Théâtre de Provence, Aix-en-Provence",
      lienVille: "accueille",
      source:
        "https://fr.wikipedia.org/wiki/Festival_international_d%27art_lyrique_d%27Aix-en-Provence",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Rencontres Économiques d'Aix-en-Provence (Cercle des économistes)",
      secteur: "Économie / think tank / B2B (équivalent Davos français annuel juillet)",
      localisation: "Université Aix-Marseille / centre-ville Aix",
      lienVille: "accueille",
      source: "https://lesrencontreseconomiques.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  patrimoineNotable: [
    {
      nom: "Atelier Cézanne (Les Lauves, construit 1901)",
      type: "musee",
      source: "https://www.cezanne-en-provence.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Cours Mirabeau (promenade aristocratique XVIIème, fontaines + plane-trees)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Cours_Mirabeau",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Cathédrale Saint-Sauveur d'Aix (XIIème siècle, roman/gothique)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Cath%C3%A9drale_Saint-Sauveur_d%27Aix-en-Provence",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Pavillon Vendôme (XVIIème siècle, hôtel particulier transformé en musée)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Pavillon_de_Vend%C3%B4me_(Aix-en-Provence)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Musée Granet (beaux-arts, collections Cézanne + Picasso + Giacometti)",
      type: "musee",
      source: "https://www.museegranet-aixenprovence.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  communesBassin: [
    {
      slug: "vitrolles",
      nameFr: "Vitrolles",
      distanceKm: 18,
      source: "https://fr.wikipedia.org/wiki/Vitrolles_(Bouches-du-Rh%C3%B4ne)",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "les-pennes-mirabeau",
      nameFr: "Les Pennes-Mirabeau",
      distanceKm: 15,
      source: "https://fr.wikipedia.org/wiki/Les_Pennes-Mirabeau",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "bouc-bel-air",
      nameFr: "Bouc-Bel-Air",
      distanceKm: 12,
      source: "https://fr.wikipedia.org/wiki/Bouc-Bel-Air",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "cabries",
      nameFr: "Cabriès",
      distanceKm: 10,
      source: "https://fr.wikipedia.org/wiki/Cabri%C3%A8s",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "venelles",
      nameFr: "Venelles",
      distanceKm: 8,
      source: "https://fr.wikipedia.org/wiki/Venelles",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "eguilles",
      nameFr: "Éguilles",
      distanceKm: 10,
      source: "https://fr.wikipedia.org/wiki/%C3%89guilles",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "marignane",
      nameFr: "Marignane",
      distanceKm: 25,
      source: "https://fr.wikipedia.org/wiki/Marignane",
      verifiedOn: "2026-05-18",
    },
  ],

  vignoblesProches: [
    {
      aoc: "Coteaux d'Aix-en-Provence",
      distanceKm: 0,
      source: "https://fr.wikipedia.org/wiki/Coteaux-d%27aix-en-provence",
      verifiedOn: "2026-05-18",
    },
    {
      aoc: "Côtes-de-Provence",
      distanceKm: 15,
      source: "https://fr.wikipedia.org/wiki/C%C3%B4tes-de-provence_(AOC)",
      verifiedOn: "2026-05-18",
    },
    {
      aoc: "Palette",
      distanceKm: 5,
      source: "https://fr.wikipedia.org/wiki/Palette_(AOC)",
      verifiedOn: "2026-05-18",
    },
    {
      aoc: "Cassis (vin)",
      distanceKm: 40,
      source: "https://www.inao.gouv.fr/produit/3309",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Couche 3 — Multi-taille TPE/PME/ETI/GE ─────────────────────────

  // Pas de label EPV individuellement sourcé pour Aix-en-Provence en V1
  // (à compléter via annuaire data.economie.gouv.fr/explore/dataset/entreprises-du-patrimoine-vivant-epv).
  labelsEpvEtArtisanat: [],

  zonesActivitesParcs: [
    {
      nom: "Europôle Méditerranéen de l'Arbois (Technopôle Arbois-Méditerranée)",
      type: "technopole",
      secteurDominant:
        "Environnement / énergies renouvelables / Green IT (1er technopole français dédié à l'environnement, 79 ha)",
      source: "https://www.arbois-med.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Pôle d'Activités d'Aix-en-Provence (Les Milles)",
      type: "district_eco",
      secteurDominant:
        "Tertiaire / industrie légère / services (plus grande zone d'activités du sud-est)",
      source: "https://www.investinprovence.com/sites/default/files/9-aix-en-provence-fr.pdf",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Technopôle de l'Environnement Arbois (Pépinière Greentech)",
      type: "technopole",
      secteurDominant: "Cleantech / greentech / incubation",
      source:
        "https://innovation.ampmetropole.fr/structure-accompagnement/43/1-pepiniere-greentech-de-l-arbois.htm",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Zone industrielle de Rousset (proche bassin, 20 km est)",
      type: "parc_tech",
      secteurDominant: "Microélectronique / semi-conducteurs (STMicroelectronics historique)",
      source: "https://fr.wikipedia.org/wiki/Rousset_(Bouches-du-Rh%C3%B4ne)",
      verifiedOn: "2026-05-18",
    },
  ],

  grandesEcolesEtUniversites: [
    {
      nom: "Aix-Marseille Université (AMU) — campus Aix",
      type: "universite",
      specialites: ["Droit", "Économie", "Lettres", "Sciences politiques", "Arts"],
      source: "https://www.univ-amu.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Sciences Po Aix (IEP d'Aix-en-Provence, fondé 1956)",
      type: "sciences_po",
      specialites: ["Sciences politiques", "Affaires publiques", "Relations internationales"],
      source: "https://www.sciencespo-aix.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Arts et Métiers ParisTech — campus Aix-en-Provence (ENSAM, fondé 1843)",
      type: "ecole_ingenieur",
      specialites: [
        "Aéronautique",
        "Énergies décarbonées",
        "Numérique",
        "Génie industriel",
        "Cyber-Physical Systems",
      ],
      source: "https://artsetmetiers.fr/fr/campus/aix-en-provence",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "IAE Aix (Institut d'Administration des Entreprises)",
      type: "ecole_commerce",
      specialites: ["Management", "Sciences de gestion", "Finance", "Marketing"],
      source: "https://www.iae-aix.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Aix-Marseille School of Economics (AMSE) — campus Aix",
      type: "universite",
      specialites: ["Économie", "Data Science", "Finance quantitative", "Recherche en économie"],
      source: "https://www.amse-aixmarseille.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Centrale Méditerranée — campus partenaire Aix (via AMSE)",
      type: "ecole_ingenieur",
      specialites: ["Ingénierie généraliste", "Énergie", "Numérique"],
      source: "https://www.centrale-mediterranee.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  polesRechercheRD: [
    {
      nom: "CEA Cadarache (Saint-Paul-lez-Durance, 35-40 km nord d'Aix)",
      organisme: "cea",
      domaine: "Énergie nucléaire / fusion / fission / nouvelles technologies de l'énergie",
      source: "https://www.cadarache.cea.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "CNRS Délégation Provence-Corse — laboratoires Aix-en-Provence",
      organisme: "cnrs",
      domaine: "Sciences sociales (LEST, AMSE), mécanique, environnement",
      source: "https://www.dr12.cnrs.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "INRAE Aix-en-Provence (campus Vauclin)",
      organisme: "inrae",
      domaine: "Agronomie / écologie / forêt méditerranéenne",
      source: "https://www.inrae.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  grandsGroupesImplantes: [
    {
      nom: "Airbus Helicopters (ex-Eurocopter, siège mondial à Marignane à 25 km)",
      secteur: "Aéronautique / hélicoptères (1er employeur du bassin)",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/Airbus_Helicopters",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ITER Organization (Saint-Paul-lez-Durance, 40 km nord)",
      secteur: "Recherche / fusion thermonucléaire (35 nations partenaires)",
      typeImplantation: "siege_social",
      source: "https://www.iter.org/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Daher Aerospace (site Marignane + opérations Aix-en-Provence)",
      secteur: "Aéronautique / défense / logistique industrielle",
      typeImplantation: "site_majeur",
      source: "https://us.kompass.com/c/daher-aerospace/fr8598034/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "STMicroelectronics (site Rousset à 20 km, microélectronique)",
      secteur: "Semi-conducteurs / microélectronique",
      typeImplantation: "site_majeur",
      source: "https://fr.wikipedia.org/wiki/STMicroelectronics",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Couche 2bis — tags KB sectorielles ─────────────────────────────
  // Volontairement vide en V1 : la KB Prisma ne contient pas encore
  // d'entries sectorielles dédiées (Phase B du sprint).
  kbSectorTags: [
    "aerospatial-defense",
    "energie-cleantech",
    "enseignement-recherche",
    "agroalimentaire-igp",
  ],

  // ─── Optionnels (hors scoring dashboard) ────────────────────────────
  capitaleFrenchTech: {
    statut: "capitale",
    nomChapitre: "French Tech Aix-Marseille Région Sud",
    source: "https://lafrenchtech-aixmarseille.fr/",
    verifiedOn: "2026-05-18",
  },

  cciCompetente: {
    nom: "CCI métropolitaine Aix-Marseille-Provence",
    source: "https://www.cciamp.com/",
    verifiedOn: "2026-05-18",
  },

  distancesGrandesMetropoles: [
    {
      metropole: "Marseille",
      distanceKm: 30,
      tempsMnRoute: 30,
      source: "https://fr.wikipedia.org/wiki/Aix-en-Provence",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Avignon",
      distanceKm: 85,
      tempsMnRoute: 60,
      source: "https://fr.wikipedia.org/wiki/Aix-en-Provence",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Nice",
      distanceKm: 170,
      tempsMnTgv: 120,
      tempsMnRoute: 150,
      source: "https://fr.wikipedia.org/wiki/Aix-en-Provence",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Lyon",
      distanceKm: 295,
      tempsMnTgv: 110,
      source: "https://fr.wikipedia.org/wiki/Aix-en-Provence",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Paris",
      distanceKm: 760,
      tempsMnTgv: 180,
      source: "https://fr.wikipedia.org/wiki/Aix-en-Provence",
      verifiedOn: "2026-05-18",
    },
  ],

  incubateursAccelerateurs: [
    {
      nom: "Pépinière Greentech de l'Arbois (Métropole AMP)",
      focus: "Cleantech / greentech / environnement / énergies renouvelables",
      source:
        "https://innovation.ampmetropole.fr/structure-accompagnement/43/1-pepiniere-greentech-de-l-arbois.htm",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "thecamp (Aix-en-Provence — fermé 2023, ex hub innovation)",
      focus: "Tech / innovation (clôture activités opérationnelles 2023)",
      source: "https://fr.wikipedia.org/wiki/Thecamp",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Marseille Innovation — antenne Aix / Arbois",
      focus: "Incubation / pépinière (cleantech, numérique)",
      source: "https://www.marseille-innov.org/",
      verifiedOn: "2026-05-18",
    },
  ],

  specificitesLocales: [
    {
      theme: "ville_de_cezanne",
      description:
        "Ville natale et de création de Paul Cézanne (1839-1906). Atelier des Lauves préservé, parcours Cézanne urbain, exposition mondiale Cézanne 2025 (200 ans).",
      source: "https://cezanne2025.com/",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "fusion_thermonucleaire_iter",
      description:
        "Bassin d'emploi de l'ITER (40 km nord) : projet mondial de fusion thermonucléaire civile, 35 nations partenaires, ~3000 emplois directs au pic.",
      source: "https://www.iter.org/about/iter-france",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "capitale_culturelle_provence",
      description:
        "Festival international d'Art Lyrique depuis 1948, l'un des grands festivals d'opéra européens. Sous-préfecture historique des Bouches-du-Rhône.",
      source: "https://festival-aix.com/",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "rencontres_economiques",
      description:
        "Rencontres Économiques d'Aix-en-Provence (Cercle des économistes) : équivalent français du forum de Davos, annuel en juillet depuis 2001.",
      source: "https://lesrencontreseconomiques.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Métadonnées de revue ───────────────────────────────────────────
  lastReviewedOn: "2026-05-18",
  reviewedBy: "Claude Code Opus 4.7 (sprint City Quality V3 ville #21)",
};
