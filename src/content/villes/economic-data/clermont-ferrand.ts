// Clermont-Ferrand (63113) — data économique enrichie sourcée V3 multi-taille.
//
// Sprint City Quality V3 ville #22 (2026-05-18).
// Contrat zéro invention : chaque champ a un `source` vérifiable.
//
// Sources canoniques utilisées :
//   - INSEE dossier complet commune 63113 (2011101)
//   - competitivite.gouv.fr / CIMES (ex-Viaméca) mécanique Auvergne-Rhône-Alpes
//   - Sites officiels écoles (uca.fr, sigma-clermont.fr, esc-clermont.fr,
//     vetagro-sup.fr, isima.fr)
//   - SNCF Connect (gare de Clermont-Ferrand — Intercités vers Paris-Bercy
//     ~3 h, PAS de TGV direct) + aeroport-clermont-ferrand.com (CFE)
//   - Wikipédia articles Michelin (siège mondial 1889), Limagrain (siège
//     Saint-Beauzire), Casino-Auvergne Aéronautique, Volcan de Lemptégy,
//     Groupe Centre France La Montagne
//   - UNESCO Centre du patrimoine mondial — Haut lieu tectonique Chaîne
//     des Puys-Faille de Limagne (whc.unesco.org/en/list/1434, inscrit 2018)
//   - UNESCO — Chemins de Saint-Jacques-de-Compostelle (1998) inclut
//     Basilique Notre-Dame-du-Port (whc.unesco.org/en/list/868)
//   - INAO (Bleu d'Auvergne AOP 1996, Cantal AOP, Fourme d'Ambert AOP,
//     Saint-Nectaire AOP 1996, Salers AOP, Côtes d'Auvergne AOC 2011)
//   - Site officiel Festival international du court métrage Clermont
//     (clermont-filmfest.org) — 2e festival cinéma France après Cannes
//   - La French Tech Clermont Auvergne (communauté, pas capitale)
//
// Spécificité Clermont-Ferrand : siège mondial Michelin depuis 1889 (l'une
// des deux seules villes françaises hors Île-de-France à héberger un siège
// CAC 40). Ville géologique unique au monde (Chaîne des Puys-Faille de
// Limagne UNESCO 2018, à l'ouest immédiat). 2e festival cinéma de France
// après Cannes (court métrage). Capitale historique de l'Auvergne, héritage
// pneumatique-céréales-volcanisme.
//
// ⚠️ Clermont-Ferrand n'a PAS de TGV direct (Intercités Paris-Bercy ~3 h).
// French Tech = Communauté (pas Capitale) selon lafrenchtech.gouv.fr 2023-2025.
//
// Reviewer : Claude Code Opus 4.7 (sprint City Quality V3 ville #22).

import type { VilleEconomicData } from "./types";

export const CLERMONT_FERRAND_ECONOMIC_DATA: VilleEconomicData = {
  // ─── Couche 1 — Économie INSEE ──────────────────────────────────────
  topSectorsNaf: [
    {
      naf: "GHI",
      label: "Commerce, transports, hébergement et restauration (sections G+H+I)",
      rank: 1,
      etablissementsCount: 3_738,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-63113",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "MN",
      label:
        "Activités spécialisées, scientifiques et techniques + services administratifs (sections M+N)",
      rank: 2,
      etablissementsCount: 2_635,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-63113",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "OPQ",
      label: "Administration publique, enseignement, santé, action sociale (sections O+P+Q)",
      rank: 3,
      etablissementsCount: 2_266,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-63113",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "F",
      label: "Construction",
      rank: 4,
      etablissementsCount: 1_036,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-63113",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "BCDE",
      label:
        "Industrie (sections B+C+D+E — héritage pneumatique Michelin / agroalimentaire / aéronautique)",
      rank: 5,
      etablissementsCount: 613,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-63113",
      verifiedOn: "2026-05-18",
    },
  ],

  polesCompetitivite: [
    {
      nom: "CIMES (ex-Viaméca)",
      secteur: "Mécanique / fabrication avancée / matériaux Auvergne-Rhône-Alpes",
      type: "rayonnement",
      source: "https://www.cimes-hub.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Céréales Vallée — Nutravita",
      secteur: "Agroalimentaire / céréales / nutrition / biotechnologies végétales",
      type: "siege",
      source: "https://fr.wikipedia.org/wiki/Clermont-Ferrand",
      verifiedOn: "2026-05-18",
    },
  ],

  distances: {
    // ⚠️ Clermont-Ferrand n'a PAS de gare TGV. Liaisons Intercités
    // Paris-Bercy ~3 h. Mention explicite pour respecter zéro invention.
    gareTgv: {
      nom: "Gare de Clermont-Ferrand (Intercités Paris-Bercy ~3 h — PAS de TGV direct, projet LGV POCL non réalisé)",
      distanceKm: 0,
      source: "https://fr.wikipedia.org/wiki/Gare_de_Clermont-Ferrand",
    },
    aeroportPrincipal: {
      nom: "Aéroport Clermont-Ferrand Auvergne (CFE) — Aulnat, 6 km à l'est du centre-ville",
      distanceKm: 6,
      source: "https://fr.wikipedia.org/wiki/A%C3%A9roport_de_Clermont-Ferrand-Auvergne",
    },
    metroOuTram: {
      lignes: 1,
      source: "https://fr.wikipedia.org/wiki/Tramway_de_Clermont-Ferrand",
    },
    verifiedOn: "2026-05-18",
  },

  statsInsee: {
    etablissementsActifs: 13_722,
    creationsEntreprises: 2_597,
    densiteEtablissementsPour1000: 94,
    anneeReference: 2023,
    source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-63113",
    verifiedOn: "2026-05-18",
  },

  // ─── Couche 2 — Matière éditoriale unique ───────────────────────────
  marquesHistoriques: [
    {
      nom: "Michelin",
      secteur: "Pneumatiques / mobilité / l'un des deux leaders mondiaux",
      lienVille: "fondation",
      source: "https://fr.wikipedia.org/wiki/Michelin",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Limagrain",
      secteur: "Semences / coopérative agricole / produits céréaliers (4e semencier mondial)",
      lienVille: "siege",
      source: "https://fr.wikipedia.org/wiki/Limagrain",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Auvergne Aéronautique",
      secteur: "Aéronautique / sous-traitance Airbus-Safran",
      lienVille: "production",
      source: "https://fr.wikipedia.org/wiki/Clermont-Ferrand",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Groupe Centre France — La Montagne",
      secteur: "Presse quotidienne régionale / média",
      lienVille: "siege",
      source: "https://fr.wikipedia.org/wiki/La_Montagne_(journal)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Volvic (eau minérale)",
      secteur: "Eaux minérales (groupe Danone, source à Volvic ~15 km)",
      lienVille: "production",
      source: "https://fr.wikipedia.org/wiki/Volvic_(eau)",
      verifiedOn: "2026-05-18",
    },
  ],

  produitsIgpAop: [
    {
      nom: "Saint-Nectaire",
      categorie: "Fromage (pâte pressée non cuite, lait de vache)",
      signe: "AOP",
      source: "https://fr.wikipedia.org/wiki/Saint-nectaire_(fromage)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Bleu d'Auvergne",
      categorie: "Fromage (pâte persillée)",
      signe: "AOP",
      source: "https://fr.wikipedia.org/wiki/Bleu_d%27Auvergne",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Fourme d'Ambert",
      categorie: "Fromage (pâte persillée)",
      signe: "AOP",
      source:
        "https://www.inao.gouv.fr/Espace-professionnel-et-outils/Rechercher-un-signe-officiel",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Cantal",
      categorie: "Fromage (pâte pressée non cuite)",
      signe: "AOP",
      source:
        "https://www.inao.gouv.fr/Espace-professionnel-et-outils/Rechercher-un-signe-officiel",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Salers",
      categorie: "Fromage (pâte pressée non cuite, fermier estive)",
      signe: "AOP",
      source:
        "https://www.inao.gouv.fr/Espace-professionnel-et-outils/Rechercher-un-signe-officiel",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Lentille verte du Puy",
      categorie: "Agroalimentaire (légume sec)",
      signe: "AOP",
      source:
        "https://www.inao.gouv.fr/Espace-professionnel-et-outils/Rechercher-un-signe-officiel",
      verifiedOn: "2026-05-18",
    },
  ],

  salonsSectoriels: [
    {
      nom: "Festival International du Court Métrage de Clermont-Ferrand",
      secteur:
        "Cinéma / court métrage (référence mondiale — 2e festival cinéma France après Cannes par fréquentation)",
      localisation: "Clermont-Ferrand (multiples salles, Polydome, Maison de la Culture)",
      lienVille: "accueille",
      source: "https://www.clermont-filmfest.org/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Sommet de l'Élevage",
      secteur:
        "Élevage / agriculture / 2e salon professionnel élevage mondial (Cournon-d'Auvergne, bassin Clermont)",
      localisation: "Grande Halle d'Auvergne, Cournon-d'Auvergne (10 km de Clermont)",
      lienVille: "accueille",
      source: "https://www.sommet-elevage.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  patrimoineNotable: [
    {
      nom: "Haut lieu tectonique Chaîne des Puys — Faille de Limagne (UNESCO 2018, à l'ouest immédiat de Clermont)",
      type: "unesco",
      source: "https://fr.wikipedia.org/wiki/Cha%C3%AEne_des_Puys",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Basilique Notre-Dame-du-Port (UNESCO 1998 — Chemins de Saint-Jacques-de-Compostelle, art roman auvergnat)",
      type: "unesco",
      source: "https://fr.wikipedia.org/wiki/Basilique_Notre-Dame-du-Port",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Cathédrale Notre-Dame-de-l'Assomption (1248-1902, pierre de Volvic — 1er édifice utilisant la lave de Volvic)",
      type: "monument",
      source:
        "https://fr.wikipedia.org/wiki/Cath%C3%A9drale_Notre-Dame-de-l%27Assomption_de_Clermont-Ferrand",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Plateau de Gergovie (site bataille Vercingétorix vs César 52 av. J.-C., 10 km au sud)",
      type: "site_archeologique",
      source: "https://fr.wikipedia.org/wiki/Plateau_de_Gergovie",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Puy de Dôme (volcan emblématique, 1465 m, panorama Chaîne des Puys, sommet à 15 km)",
      type: "parc",
      source: "https://fr.wikipedia.org/wiki/Puy_de_D%C3%B4me",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Vulcania (parc européen du volcanisme, à 15 km au nord-ouest, Saint-Ours-les-Roches)",
      type: "autre",
      source: "https://fr.wikipedia.org/wiki/Vulcania",
      verifiedOn: "2026-05-18",
    },
  ],

  communesBassin: [
    {
      slug: "chamalieres",
      nameFr: "Chamalières",
      distanceKm: 3,
      source: "https://fr.wikipedia.org/wiki/Chamali%C3%A8res",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "aubiere",
      nameFr: "Aubière",
      distanceKm: 4,
      source: "https://fr.wikipedia.org/wiki/Aubi%C3%A8re",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "cournon-d-auvergne",
      nameFr: "Cournon-d'Auvergne",
      distanceKm: 8,
      source: "https://fr.wikipedia.org/wiki/Cournon-d%27Auvergne",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "beaumont",
      nameFr: "Beaumont",
      distanceKm: 4,
      source: "https://fr.wikipedia.org/wiki/Beaumont_(Puy-de-D%C3%B4me)",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "riom",
      nameFr: "Riom",
      distanceKm: 15,
      source: "https://fr.wikipedia.org/wiki/Riom",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "royat",
      nameFr: "Royat",
      distanceKm: 4,
      source: "https://fr.wikipedia.org/wiki/Royat",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "issoire",
      nameFr: "Issoire",
      distanceKm: 36,
      source: "https://fr.wikipedia.org/wiki/Issoire",
      verifiedOn: "2026-05-18",
    },
  ],

  vignoblesProches: [
    {
      aoc: "Côtes d'Auvergne (AOC depuis 25 oct. 2011, traverse Clermont-Ferrand de Riom à Issoire)",
      distanceKm: 0,
      source: "https://fr.wikipedia.org/wiki/C%C3%B4tes_d%27Auvergne",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Couche 3 — Multi-taille PME/ETI/GE ─────────────────────────

  // Label EPV : sans source individuelle confirmée par entreprise clermontoise,
  // champ vide pour respecter zéro invention. À compléter en cross-référençant
  // l'annuaire officiel data.economie.gouv.fr/explore/dataset/entreprises-du-patrimoine-vivant-epv
  // (Phase 2 du sprint).
  labelsEpvEtArtisanat: [],

  zonesActivitesParcs: [
    {
      nom: "Technopôle Clermont-Ferrand La Pardieu (zone d'activités majeure pôle tertiaire-recherche)",
      type: "technopole",
      secteurDominant: "Tertiaire / R&D / services",
      source: "https://fr.wikipedia.org/wiki/Clermont-Ferrand",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Campus universitaire des Cézeaux (Aubière — cluster sciences-ingénierie)",
      type: "parc_tech",
      secteurDominant: "Recherche / ingénierie / informatique / chimie",
      source: "https://www.uca.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Biopôle Clermont-Limagne (Saint-Beauzire — pôle biotech/agro)",
      type: "parc_tech",
      secteurDominant: "Biotechnologies / santé / agroalimentaire",
      source: "https://fr.wikipedia.org/wiki/Saint-Beauzire_(Puy-de-D%C3%B4me)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Zone industrielle des Gravanches (nord Clermont-Ferrand, logistique-distribution)",
      type: "zac",
      secteurDominant: "Logistique / distribution / industrie légère",
      source: "https://fr.wikipedia.org/wiki/Clermont-Ferrand",
      verifiedOn: "2026-05-18",
    },
  ],

  grandesEcolesEtUniversites: [
    {
      nom: "Université Clermont Auvergne (UCA — fusion 2017 Auvergne + Blaise-Pascal, ~37 000 étudiants)",
      type: "universite",
      specialites: [
        "Droit-Économie-Gestion",
        "Sciences",
        "Santé",
        "Lettres-Humanités-Sciences sociales",
        "Sciences de la vie / agriculture / environnement",
      ],
      source: "https://www.uca.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Sigma Clermont (Clermont Auvergne INP — école d'ingénieurs)",
      type: "ecole_ingenieur",
      specialites: ["Génie chimique", "Génie mécanique", "Génie industriel"],
      source: "https://fr.wikipedia.org/wiki/Sigma_Clermont",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ISIMA — Institut Supérieur d'Informatique, de Modélisation et de leurs Applications",
      type: "ecole_ingenieur",
      specialites: ["Informatique", "Modélisation", "Génie logiciel", "Data Science", "IA"],
      source: "https://www.isima.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ESC Clermont Business School",
      type: "ecole_commerce",
      specialites: ["Management", "Finance", "Marketing", "Entrepreneuriat"],
      source: "https://www.esc-clermont.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "VetAgro Sup (campus vétérinaire de Lyon — antenne agronomique Marmilhat près Clermont)",
      type: "autre",
      specialites: ["Médecine vétérinaire", "Agronomie", "Sciences animales"],
      source: "https://www.vetagro-sup.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "École Supérieure d'Art de Clermont Métropole (ESACM)",
      type: "autre",
      specialites: ["Art", "Arts plastiques", "Création contemporaine"],
      source: "https://www.esacm.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  polesRechercheRD: [
    {
      nom: "INRAE Clermont-Auvergne-Rhône-Alpes (recherche agronomique, Centre de Crouël)",
      organisme: "inrae",
      domaine: "Agronomie / nutrition humaine / herbivores / sols",
      source: "https://www.inrae.fr/centres/clermont-auvergne-rhone-alpes",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "CNRS Centre Auvergne-Rhône-Alpes (délégation 07)",
      organisme: "cnrs",
      domaine: "Recherche multidisciplinaire / volcanologie / chimie / mathématiques",
      source: "https://www.cnrs.fr/fr/delegation/centre-est-auvergne",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Laboratoire de Physique de Clermont (LPC, UMR CNRS 6533)",
      organisme: "cnrs",
      domaine: "Physique des particules / cosmologie / instrumentation",
      source: "https://clrwww.in2p3.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Observatoire de Physique du Globe de Clermont-Ferrand (OPGC, UAR 833)",
      organisme: "cnrs",
      domaine: "Volcanologie / atmosphère / sismologie",
      source: "https://opgc.uca.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  grandsGroupesImplantes: [
    {
      nom: "Michelin",
      secteur: "Pneumatiques / mobilité (CAC 40, siège mondial depuis 1889)",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/Michelin",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Limagrain (siège Saint-Beauzire — bassin Clermont)",
      secteur: "Semences / coopérative agricole / 4e semencier mondial",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/Limagrain",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Centre Jean Perrin (CLCC — Centre de Lutte Contre le Cancer Auvergne)",
      secteur: "Santé / oncologie / recherche médicale",
      typeImplantation: "site_majeur",
      source: "https://www.cjp.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Groupe Centre France — La Montagne (siège média)",
      secteur: "Presse quotidienne régionale / média",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/La_Montagne_(journal)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Auvergne Aéronautique",
      secteur: "Aéronautique / sous-traitance Airbus-Safran",
      typeImplantation: "site_majeur",
      source: "https://fr.wikipedia.org/wiki/Clermont-Ferrand",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Couche 2bis — tags KB sectorielles ─────────────────────────────
  // Volontairement vide en V1 : la KB Prisma ne contient pas encore
  // d'entries sectorielles dédiées (Phase B du sprint).
  kbSectorTags: [
    "industrie-manufacturiere",
    "automobile-mobilite",
    "agroalimentaire-igp",
    "enseignement-recherche",
  ],

  // ─── Optionnels (hors scoring dashboard) ────────────────────────────
  capitaleFrenchTech: {
    // ⚠️ French Tech Clermont Auvergne = Communauté (pas Capitale).
    // Source officielle lafrenchtech.gouv.fr labellisation 2023-2025.
    statut: "communaute",
    nomChapitre: "La French Tech Clermont Auvergne (Communauté French Tech labellisée)",
    source: "https://lafrenchtech-clermont-auvergne.com/",
    verifiedOn: "2026-05-18",
  },

  cciCompetente: {
    nom: "CCI Puy-de-Dôme",
    source: "https://www.puy-de-dome.cci.fr/",
    verifiedOn: "2026-05-18",
  },

  distancesGrandesMetropoles: [
    {
      metropole: "Lyon",
      distanceKm: 175,
      tempsMnRoute: 110,
      source: "https://www.sncf-connect.com/",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Paris",
      distanceKm: 425,
      tempsMnTgv: 180,
      source: "https://fr.wikipedia.org/wiki/Gare_de_Clermont-Ferrand",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Bordeaux",
      distanceKm: 380,
      tempsMnRoute: 260,
      source: "https://fr.wikipedia.org/wiki/Clermont-Ferrand",
      verifiedOn: "2026-05-18",
    },
  ],

  incubateursAccelerateurs: [
    {
      nom: "Pépinière d'entreprises Pascalis (Clermont Auvergne Métropole)",
      focus: "Généraliste / innovation / numérique",
      source: "https://www.clermontmetropole.eu/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "BUSI — Incubateur régional Auvergne-Rhône-Alpes (antenne Clermont)",
      focus: "Deep tech / projets issus de la recherche publique",
      source: "https://www.busi.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Spécificités locales hors grille standard ──────────────────────
  specificitesLocales: [
    {
      theme: "siege_mondial_michelin_cac40",
      description:
        "Siège mondial Michelin depuis 1889. L'une des deux seules villes françaises hors Île-de-France à héberger un siège social CAC 40. Industrie pneumatique structurante du bassin.",
      source: "https://fr.wikipedia.org/wiki/Michelin",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "geologie_unesco_chaine_puys",
      description:
        "Ville géologique unique : Chaîne des Puys-Faille de Limagne inscrite UNESCO 2018 (haut lieu tectonique mondial — rifting continental). Puy de Dôme à 15 km. Vulcania à 15 km.",
      source: "https://whc.unesco.org/en/list/1434",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "court_metrage_2e_festival_france",
      description:
        "Festival international du court métrage de Clermont-Ferrand (depuis 1979) : 2e festival cinéma de France après Cannes par fréquentation (~165 000-173 000 spectateurs/an, 7000 films soumis).",
      source: "https://www.clermont-filmfest.org/",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "absence_tgv_intercites_3h_paris",
      description:
        "Absence de TGV direct (projet LGV POCL non réalisé). Liaisons Intercités vers Paris-Bercy ~3 h, 8 allers-retours/jour. Limitation structurelle d'accessibilité ferroviaire grande vitesse.",
      source: "https://fr.wikipedia.org/wiki/Gare_de_Clermont-Ferrand",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Métadonnées de revue ───────────────────────────────────────────
  lastReviewedOn: "2026-05-18",
  reviewedBy: "Claude Code Opus 4.7 (sprint City Quality V3 ville #22)",
};
