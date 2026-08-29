// Limoges (87085) — data économique enrichie sourcée V3 multi-taille.
//
// Sprint City Quality V3 — ville n°28.
// Contrat zéro invention : chaque champ a un `source` vérifiable.
//
// Spécificité Limoges : capitale mondiale de la porcelaine (héritage 1771
// avec la découverte du kaolin de Saint-Yrieix-la-Perche), siège mondial
// de Legrand (CAC 40, équipements électriques), pôle de compétitivité
// Céramique (siège national à Limoges). Bassin industriel céramique,
// élevage Limousin AOP (bœuf, veau, pomme), patrimoine UNESCO via
// chemins de Compostelle.
//
// Sources canoniques utilisées :
//   - INSEE dossier complet commune 87085 (2011101)
//   - competitivite.gouv.fr — Pôle Céramique Phase V 2023-2026
//   - Sites officiels pôles (poleceramique.com, elastopole.com)
//   - SNCF Connect (gare Bénédictins) + aéroport Limoges Bellegarde
//   - Wikipédia articles entreprises/écoles/patrimoine
//   - INAO (inao.gouv.fr) pour AOP/Label Rouge Limousin
//   - Sites officiels marques porcelaine (bernardaud.com, royal-limoges.fr,
//     haviland.fr)
//   - lafrenchtech.com pour communauté French Tech Limoges
//
// Reviewer : Claude Code Opus 4.7 (sprint City Quality V3 ville #28).

import type { VilleEconomicData } from "./types";

export const LIMOGES_ECONOMIC_DATA: VilleEconomicData = {
  // ─── Couche 1 — Économie INSEE ──────────────────────────────────────
  topSectorsNaf: [
    {
      naf: "GHI",
      label: "Commerce, transports, hébergement et restauration (sections G+H+I)",
      rank: 1,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-87085",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "MN",
      label:
        "Activités spécialisées, scientifiques et techniques + services administratifs (sections M+N)",
      rank: 2,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-87085",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "OPQ",
      label: "Administration publique, enseignement, santé, action sociale (sections O+P+Q)",
      rank: 3,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-87085",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "C",
      label:
        "Industrie manufacturière (céramique/porcelaine, équipements électriques Legrand, agroalimentaire)",
      rank: 4,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-87085",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "F",
      label: "Construction",
      rank: 5,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-87085",
      verifiedOn: "2026-05-18",
    },
  ],

  polesCompetitivite: [
    {
      nom: "Pôle Européen de la Céramique",
      secteur: "Céramique technique / matériaux avancés / porcelaine industrielle",
      type: "siege",
      source: "https://www.cerameurop.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Elastopôle",
      secteur: "Caoutchouc / polymères / élastomères",
      type: "rayonnement",
      source: "https://www.elastopole.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  distances: {
    gareTgv: {
      nom: "Gare de Limoges-Bénédictins (POLT Paris-Orléans-Limoges-Toulouse, classée MH Art déco)",
      distanceKm: 0,
      source: "https://www.sncf-connect.com/gares/limoges-benedictins",
    },
    aeroportPrincipal: {
      nom: "Aéroport de Limoges-Bellegarde (LIG)",
      distanceKm: 10,
      source: "https://www.aeroportlimoges.com/",
    },
    verifiedOn: "2026-05-18",
  },

  statsInsee: {
    anneeReference: 2023,
    source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-87085",
    verifiedOn: "2026-05-18",
  },

  // ─── Couche 2 — Matière éditoriale unique ───────────────────────────
  marquesHistoriques: [
    {
      nom: "Legrand",
      secteur: "Équipements électriques / domotique / infrastructure numérique (CAC 40)",
      lienVille: "siege",
      source: "https://fr.wikipedia.org/wiki/Legrand_(entreprise)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Bernardaud",
      secteur: "Porcelaine de Limoges (haut de gamme, fondée 1863)",
      lienVille: "siege",
      source: "https://fr.wikipedia.org/wiki/Bernardaud",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Haviland",
      secteur: "Porcelaine de Limoges (fondée 1842 par David Haviland)",
      lienVille: "production",
      source: "https://fr.wikipedia.org/wiki/Haviland_%26_Co.",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Royal Limoges",
      secteur: "Porcelaine de Limoges (1797, plus ancienne manufacture de porcelaine de France)",
      lienVille: "production",
      source: "https://fr.wikipedia.org/wiki/Royal_Limoges",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Madrange",
      secteur: "Charcuterie industrielle (jambon, fondée à Limoges en 1924)",
      lienVille: "fondation",
      source: "https://fr.wikipedia.org/wiki/Madrange",
      verifiedOn: "2026-05-18",
    },
  ],

  produitsIgpAop: [
    {
      nom: "Pomme du Limousin",
      categorie: "agroalimentaire / fruit",
      signe: "AOP",
      source:
        "https://www.inao.gouv.fr/Espace-professionnel-et-outils/Rechercher-un-signe-officiel",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Veau du Limousin",
      categorie: "agroalimentaire / viande",
      signe: "Label Rouge",
      source: "https://fr.wikipedia.org/wiki/Veau_du_Limousin",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Bœuf Limousin",
      categorie: "agroalimentaire / viande",
      signe: "Label Rouge",
      source: "https://fr.wikipedia.org/wiki/Limousine_(race_bovine)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Agneau du Limousin",
      categorie: "agroalimentaire / viande",
      signe: "IGP",
      source:
        "https://www.inao.gouv.fr/Espace-professionnel-et-outils/Rechercher-un-signe-officiel",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Porcelaine de Limoges",
      categorie: "artisanat / arts de la table",
      signe: "IGP",
      source: "https://fr.wikipedia.org/wiki/Porcelaine_de_Limoges",
      verifiedOn: "2026-05-18",
    },
  ],

  salonsSectoriels: [
    {
      nom: "Foire de Limoges (Foire Exposition Internationale)",
      secteur: "Multi-sectoriel / grand public / B2B régional",
      localisation: "Parc des Expositions de Limoges",
      lienVille: "accueille",
      source: "https://www.foiredelimoges.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Biennale Internationale de la Céramique",
      secteur: "Céramique / arts décoratifs / porcelaine",
      localisation: "Limoges (Musée Adrien Dubouché et Cité de la Céramique)",
      lienVille: "accueille",
      source: "https://www.musee-adriendubouche.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  patrimoineNotable: [
    {
      nom: "Cathédrale Saint-Étienne de Limoges (XIIIe-XVIe, gothique rayonnant)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Cath%C3%A9drale_Saint-%C3%89tienne_de_Limoges",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Musée National Adrien Dubouché (référence mondiale de la porcelaine)",
      type: "musee",
      source: "https://www.musee-adriendubouche.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Gare de Limoges-Bénédictins (1929, Art déco, classée Monument Historique)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Gare_de_Limoges-B%C3%A9n%C3%A9dictins",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Quartier de la Boucherie (rue médiévale des bouchers de Limoges)",
      type: "cite_metier",
      source: "https://fr.wikipedia.org/wiki/Quartier_de_la_Boucherie_(Limoges)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Chemins de Saint-Jacques-de-Compostelle en France (UNESCO 1998 — Limoges via Lemovicensis)",
      type: "unesco",
      source: "https://whc.unesco.org/fr/list/868",
      verifiedOn: "2026-05-18",
    },
  ],

  communesBassin: [
    {
      slug: "couzeix",
      nameFr: "Couzeix",
      distanceKm: 7,
      source: "https://fr.wikipedia.org/wiki/Couzeix",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "panazol",
      nameFr: "Panazol",
      distanceKm: 5,
      source: "https://fr.wikipedia.org/wiki/Panazol",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "le-palais-sur-vienne",
      nameFr: "Le Palais-sur-Vienne",
      distanceKm: 6,
      source: "https://fr.wikipedia.org/wiki/Le_Palais-sur-Vienne",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "isle",
      nameFr: "Isle",
      distanceKm: 6,
      source: "https://fr.wikipedia.org/wiki/Isle_(Haute-Vienne)",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "condat-sur-vienne",
      nameFr: "Condat-sur-Vienne",
      distanceKm: 6,
      source: "https://fr.wikipedia.org/wiki/Condat-sur-Vienne",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "aixe-sur-vienne",
      nameFr: "Aixe-sur-Vienne",
      distanceKm: 14,
      source: "https://fr.wikipedia.org/wiki/Aixe-sur-Vienne",
      verifiedOn: "2026-05-18",
    },
  ],

  // Limoges n'a pas de vignoble AOC à ≤ 50 km. Bordeaux à ~220 km,
  // Cognac à ~135 km, Saint-Pourçain à ~150 km. Champ honnêtement vide.
  vignoblesProches: [],

  // ─── Couche 3 — Multi-taille PME/ETI/GE ─────────────────────────

  // EPV : Bernardaud, Haviland et Royal Limoges sont notoirement
  // labellisés EPV (porcelaine de Limoges = savoir-faire d'excellence).
  // Sans confirmation individuelle de l'annuaire officiel epv.org,
  // champ honnêtement vide pour respecter zéro invention. À compléter
  // Phase 2 via extraction CSV data.economie.gouv.fr.
  labelsEpvEtArtisanat: [],

  zonesActivitesParcs: [
    {
      nom: "Ester Technopole (parc technologique Limoges)",
      type: "technopole",
      secteurDominant: "Céramique technique / électronique / sciences du vivant",
      source: "https://www.ester-technopole.org/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ZAC Romanet (Limoges Sud)",
      type: "zac",
      secteurDominant: "Activités commerciales et tertiaires",
      source: "https://www.limoges.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Zone d'activité de Magré (Limoges Sud)",
      type: "zac",
      secteurDominant: "Industrie / logistique",
      source: "https://www.limoges-metropole.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  grandesEcolesEtUniversites: [
    {
      nom: "Université de Limoges",
      type: "universite",
      specialites: ["Droit", "Sciences", "Lettres", "Médecine", "IUT"],
      source: "https://www.unilim.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ENSIL-ENSCI (École Nationale Supérieure d'Ingénieurs de Limoges)",
      type: "ecole_ingenieur",
      specialites: [
        "Céramique industrielle",
        "Électronique / télécommunications",
        "Eau et environnement",
        "Matériaux",
      ],
      source: "https://www.ensil-ensci.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "3iL Ingénieurs (École d'ingénieurs informatique et management)",
      type: "ecole_ingenieur",
      specialites: ["Informatique", "Cybersécurité", "IA / data", "Management des SI"],
      source: "https://www.3il-ingenieurs.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ESCEM Limoges (École Supérieure de Commerce et Management)",
      type: "ecole_commerce",
      specialites: ["Management", "Marketing", "Finance"],
      source: "https://fr.wikipedia.org/wiki/Groupe_ESCEM",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "IUT du Limousin (Université de Limoges)",
      type: "iut",
      source: "https://www.iut.unilim.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  polesRechercheRD: [
    {
      nom: "IRCER (Institut de Recherche sur les Céramiques) — UMR CNRS 7315",
      organisme: "cnrs",
      domaine: "Céramiques techniques / matériaux avancés",
      source: "https://www.ircer.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "XLIM (Institut de recherche en sciences et technologies de l'information) — UMR CNRS 7252",
      organisme: "cnrs",
      domaine: "Photonique / électromagnétisme / mathématiques / informatique / image / réseaux",
      source: "https://www.xlim.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Inserm U1248 Limoges (Pharmacologie et transplantation)",
      organisme: "inserm",
      domaine: "Pharmacologie / immuno-transplantation",
      source: "https://www.inserm.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  grandsGroupesImplantes: [
    {
      nom: "Legrand",
      secteur: "Équipements électriques / domotique / infrastructure numérique (CAC 40)",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/Legrand_(entreprise)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Bernardaud",
      secteur: "Porcelaine haut de gamme",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/Bernardaud",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Madrange",
      secteur: "Charcuterie industrielle (groupe Aoste / Campofrío)",
      typeImplantation: "site_majeur",
      source: "https://fr.wikipedia.org/wiki/Madrange",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Haviland",
      secteur: "Porcelaine de Limoges",
      typeImplantation: "site_majeur",
      source: "https://fr.wikipedia.org/wiki/Haviland_%26_Co.",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Royal Limoges",
      secteur: "Porcelaine de Limoges",
      typeImplantation: "site_majeur",
      source: "https://fr.wikipedia.org/wiki/Royal_Limoges",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Texelis",
      secteur:
        "Systèmes de mobilité / véhicules militaires et industriels (anciennement Renault Trucks Defense Limoges)",
      typeImplantation: "site_majeur",
      source: "https://fr.wikipedia.org/wiki/Texelis",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Couche 2bis — tags KB sectorielles ─────────────────────────────
  // Volontairement vide en V1 : la KB Prisma ne contient pas encore
  // d'entries sectorielles dédiées (Phase B du sprint).
  kbSectorTags: [
    "industrie-manufacturiere",
    "agroalimentaire-igp",
    "enseignement-recherche",
    "arts-creatif-design",
  ],

  // ─── Optionnels (hors scoring dashboard) ────────────────────────────
  capitaleFrenchTech: {
    statut: "communaute",
    nomChapitre: "French Tech Limoges",
    source: "https://lafrenchtech.com/fr/communaute-french-tech/",
    verifiedOn: "2026-05-18",
  },

  cciCompetente: {
    nom: "CCI Limoges et Haute-Vienne",
    source: "https://www.limoges.cci.fr/",
    verifiedOn: "2026-05-18",
  },

  distancesGrandesMetropoles: [
    {
      metropole: "Bordeaux",
      distanceKm: 220,
      tempsMnRoute: 150,
      source: "https://fr.wikipedia.org/wiki/Limoges",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Paris",
      distanceKm: 400,
      tempsMnTgv: 190,
      tempsMnRoute: 240,
      source: "https://www.sncf-connect.com/gares/limoges-benedictins",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Toulouse",
      distanceKm: 290,
      tempsMnRoute: 195,
      source: "https://fr.wikipedia.org/wiki/Limoges",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Clermont-Ferrand",
      distanceKm: 175,
      tempsMnRoute: 140,
      source: "https://fr.wikipedia.org/wiki/Limoges",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Spécificités locales hors grille standard ──────────────────────
  specificitesLocales: [
    {
      theme: "capitale_mondiale_porcelaine",
      description:
        "Capitale mondiale de la porcelaine depuis la découverte du kaolin de Saint-Yrieix-la-Perche en 1768. IGP Porcelaine de Limoges protégée.",
      source: "https://fr.wikipedia.org/wiki/Porcelaine_de_Limoges",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "siege_cac40_legrand",
      description:
        "Siège mondial de Legrand (CAC 40, ~36 000 salariés, leader mondial des infrastructures électriques et numériques du bâtiment, fondé à Limoges en 1860).",
      source: "https://fr.wikipedia.org/wiki/Legrand_(entreprise)",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "bassin_elevage_limousin",
      description:
        "Capitale du bassin d'élevage Limousin (race bovine Limousine de réputation mondiale, agneau IGP, veau et bœuf Label Rouge).",
      source: "https://fr.wikipedia.org/wiki/Limousine_(race_bovine)",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Adaptations Limoges (zéro invention) ───────────────────────────
  // Limoges n'a pas de vignoble AOC à ≤ 50 km (région d'élevage, pas
  // viticole — Bordeaux à ~220 km, Cognac à ~135 km). Champ structurellement
  // non applicable, exempté du scoring.
  notApplicableFields: ["vignoblesProches"],

  // ─── Métadonnées de revue ───────────────────────────────────────────
  lastReviewedOn: "2026-05-18",
  reviewedBy: "Claude Code Opus 4.7 (sprint City Quality V3 ville #28)",
};
