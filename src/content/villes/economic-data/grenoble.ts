// Grenoble (38185) — data économique enrichie sourcée V3 multi-taille.
//
// Sprint City Quality V3 ville #19 — 2026-05-18.
// Contrat zéro invention : chaque champ a un `source` vérifiable.
//
// Sources canoniques utilisées :
//   - INSEE dossier complet commune 38185 (2011101)
//   - competitivite.gouv.fr + sites officiels pôles (minalogic.com, tenerrdis.fr)
//   - INAO (Noix de Grenoble AOP, Bleu Vercors-Sassenage AOP, Saint-Marcellin IGP)
//   - Sites officiels écoles (grenoble-inp.fr, grenoble-em.com, univ-grenoble-alpes.fr)
//   - Sites officiels organismes recherche (cea.fr, esrf.fr, ill.eu, inria.fr)
//   - Sites officiels grands groupes (st.com, soitec.com, se.com, atos.net)
//   - Wikipédia (téléphérique Bastille, Minatec, Pomagalski/Poma, communes Métro)
//   - Salons : mountain-planet.com (Alpexpo Grenoble)
//   - lafrenchtech.com (chapitre French Tech in the Alps - Grenoble)
//   - SNCF Connect (gare Grenoble) + lyonaeroports.com (Saint-Exupéry)
//
// Direction : capitale française nano/microélectronique + Silicon Valley
// européenne. R&D mondiale (CEA-Leti, ESRF, ILL), semi-conducteurs (ST Micro
// Crolles, Soitec), cleantech (Tenerrdis, Schneider Electric), montagne
// (Mountain Planet, Poma téléphériques), agroalimentaire AOP (Noix, Bleu
// Vercors-Sassenage). B2B-pertinent fort.
//
// Reviewer : Claude Code Opus 4.7 (sprint City Quality V3 ville #19).

import type { VilleEconomicData } from "./types";

export const GRENOBLE_ECONOMIC_DATA: VilleEconomicData = {
  // ─── Couche 1 — Économie INSEE ──────────────────────────────────────
  topSectorsNaf: [
    {
      naf: "GHI",
      label: "Commerce, transports, hébergement et restauration (sections G+H+I)",
      rank: 1,
      etablissementsCount: 4929,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-38185",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "OPQ",
      label: "Administration publique, enseignement, santé, action sociale (sections O+P+Q)",
      rank: 2,
      etablissementsCount: 825,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-38185",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "F",
      label: "Construction (section F)",
      rank: 3,
      etablissementsCount: 412,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-38185",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "BCDE",
      label: "Industrie (sections B+C+D+E — manufacturière, énergie, eau, déchets)",
      rank: 4,
      etablissementsCount: 258,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-38185",
      verifiedOn: "2026-05-18",
    },
  ],

  polesCompetitivite: [
    {
      nom: "Minalogic",
      secteur:
        "Micro-nanoélectronique / logiciel / IA embarquée / transformation numérique (siège Grenoble — CEA campus)",
      type: "siege",
      source: "https://www.minalogic.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Tenerrdis",
      secteur:
        "Énergies nouvelles et renouvelables (solaire, éolien, hydrogène, hydroélectricité, batteries, bâtiment) — siège Grenoble",
      type: "siege",
      source: "https://www.tenerrdis.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Lyonbiopôle (Auvergne-Rhône-Alpes)",
      secteur: "Santé / biotech / dispositifs médicaux / vaccins (rayonnement régional)",
      type: "rayonnement",
      source: "https://www.lyonbiopole.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  distances: {
    gareTgv: {
      nom: "Gare de Grenoble (TGV direct Paris ~3 h, Marseille, Lille, Bruxelles)",
      distanceKm: 0,
      source: "https://www.sncf-connect.com/gares/grenoble",
    },
    aeroportPrincipal: {
      nom: "Lyon-Saint-Exupéry (LYS) — Grenoble-Isère (GNB) en complément à 40 km",
      distanceKm: 100,
      source: "https://www.lyonaeroports.com/en/bus-lyon-airport-grenoble-shuttle-bus",
    },
    metroOuTram: {
      lignes: 5,
      source: "https://www.tag.fr/",
    },
    verifiedOn: "2026-05-18",
  },

  statsInsee: {
    etablissementsActifs: 6428,
    creationsEntreprises: 3274,
    anneeReference: 2024,
    source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-38185",
    verifiedOn: "2026-05-18",
  },

  // ─── Couche 2 — Matière éditoriale unique ───────────────────────────
  marquesHistoriques: [
    {
      nom: "STMicroelectronics",
      secteur: "Micro-électronique / semi-conducteurs (>6500 emplois bassin Grenoble-Crolles)",
      lienVille: "fondation",
      source: "https://fr.wikipedia.org/wiki/STMicroelectronics",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Soitec",
      secteur: "Matériaux semi-conducteurs innovants (SOI) — fondée à Grenoble",
      lienVille: "fondation",
      source: "https://fr.wikipedia.org/wiki/Soitec",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Schneider Electric",
      secteur:
        "Gestion de l'énergie / automatismes (site historique majeur Grenoble — projet GreenOValley)",
      lienVille: "production",
      source:
        "https://www.se.com/fr/fr/about-us/newsroom/news/press-releases/a-travers-le-projet-greenovalley-schneider-electric-affirme-son-ancrage-en-france-en-investissant-dans-de-nouveaux-b%C3%A2timents-%C3%A0-grenoble-561521859b3e9d32e38b4578/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Poma (Pomagalski)",
      secteur:
        "Téléphériques / remontées mécaniques (siège bassin grenoblois — inventeur 'bulles' 1976)",
      lienVille: "siege",
      source: "https://fr.wikipedia.org/wiki/Poma_(entreprise)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Petzl",
      secteur:
        "Équipement alpinisme / spéléologie / travail en hauteur (siège Crolles, bassin Grenoble)",
      lienVille: "siege",
      source: "https://fr.wikipedia.org/wiki/Petzl",
      verifiedOn: "2026-05-18",
    },
  ],

  produitsIgpAop: [
    {
      nom: "Noix de Grenoble",
      categorie: "fruits / agroalimentaire",
      signe: "AOP",
      source: "https://www.inao.gouv.fr/produit/3414",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Bleu du Vercors-Sassenage",
      categorie: "fromage",
      signe: "AOP",
      source: "https://www.inao.gouv.fr/produit/127",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Saint-Marcellin",
      categorie: "fromage",
      signe: "IGP",
      source: "https://www.inao.gouv.fr/produit/9817",
      verifiedOn: "2026-05-18",
    },
  ],

  salonsSectoriels: [
    {
      nom: "Mountain Planet",
      secteur: "Aménagement en montagne / ski / outdoor (référence mondiale, biennal depuis 1974)",
      localisation: "Grenoble — Alpexpo",
      lienVille: "accueille",
      source: "https://www.mountain-planet.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  patrimoineNotable: [
    {
      nom: "Fort de la Bastille + téléphérique 'Les Bulles' (1934, premier téléphérique urbain de France)",
      type: "monument",
      source: "https://bastille-grenoble.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Musée de Grenoble (l'une des plus grandes collections de beaux-arts en province)",
      type: "musee",
      source: "https://www.museedegrenoble.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Musée des Troupes de montagne (Fort de la Bastille)",
      type: "musee",
      source: "https://www.defense.gouv.fr/art-patrimoine-terre/musees/musee-troupes-montagne",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Minatec Campus (cité européenne des micro-nanotechnologies)",
      type: "cite_metier",
      source: "https://www.minatec.org/",
      verifiedOn: "2026-05-18",
    },
  ],

  communesBassin: [
    {
      slug: "saint-martin-d-heres",
      nameFr: "Saint-Martin-d'Hères",
      distanceKm: 3,
      source: "https://fr.wikipedia.org/wiki/Saint-Martin-d%27H%C3%A8res",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "echirolles",
      nameFr: "Échirolles",
      distanceKm: 4,
      source: "https://fr.wikipedia.org/wiki/%C3%89chirolles",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "fontaine",
      nameFr: "Fontaine",
      distanceKm: 4,
      source: "https://fr.wikipedia.org/wiki/Fontaine_(Is%C3%A8re)",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "meylan",
      nameFr: "Meylan",
      distanceKm: 5,
      source: "https://fr.wikipedia.org/wiki/Meylan_(Is%C3%A8re)",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "saint-egreve",
      nameFr: "Saint-Égrève",
      distanceKm: 6,
      source: "https://fr.wikipedia.org/wiki/Saint-%C3%89gr%C3%A8ve",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "eybens",
      nameFr: "Eybens",
      distanceKm: 4,
      source: "https://fr.wikipedia.org/wiki/Eybens",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "la-tronche",
      nameFr: "La Tronche",
      distanceKm: 2,
      source: "https://fr.wikipedia.org/wiki/La_Tronche",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "sassenage",
      nameFr: "Sassenage",
      distanceKm: 6,
      source: "https://fr.wikipedia.org/wiki/Sassenage",
      verifiedOn: "2026-05-18",
    },
  ],

  vignoblesProches: [
    {
      aoc: "Vins du Grésivaudan (IGP Isère)",
      distanceKm: 15,
      source: "https://www.inao.gouv.fr/produit/9824",
      verifiedOn: "2026-05-18",
    },
    {
      aoc: "Clairette de Die AOP (Diois)",
      distanceKm: 60,
      source: "https://www.inao.gouv.fr/produit/3360",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Couche 3 — Multi-taille PME/ETI/GE ─────────────────────────

  // EPV Grenoble : pas d'extraction CSV individuelle confirmée à ce jour
  // (annuaire data.economie.gouv.fr/entreprises-du-patrimoine-vivant-epv à
  // requêter Phase 2). Champ vide pour zéro invention.
  labelsEpvEtArtisanat: [],

  zonesActivitesParcs: [
    {
      nom: "Minatec Campus (Presqu'île scientifique)",
      type: "technopole",
      secteurDominant: "Micro-nanoélectronique / R&D / industrie pilote",
      source: "https://www.minatec.org/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Presqu'île scientifique (GIANT — Grenoble Innovation for Advanced New Technologies)",
      type: "technopole",
      secteurDominant: "Recherche multidisciplinaire (CEA, ESRF, ILL, EMBL, UGA, Grenoble INP)",
      source: "https://www.giant-grenoble.org/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Inovallée (Meylan / Montbonnot)",
      type: "technopole",
      secteurDominant: "Logiciel / IT / électronique / 350+ entreprises tech",
      source: "https://www.inovallee.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Domaine universitaire (Saint-Martin-d'Hères / Gières)",
      type: "district_eco",
      secteurDominant: "Université Grenoble Alpes / écoles ingénieur / recherche",
      source: "https://www.univ-grenoble-alpes.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  grandesEcolesEtUniversites: [
    {
      nom: "Grenoble INP — UGA (institut polytechnique, 8 écoles dont Ensimag, Phelma, Ense3)",
      type: "ecole_ingenieur",
      specialites: [
        "Informatique / mathématiques appliquées (Ensimag)",
        "Physique / électronique / matériaux (Phelma)",
        "Énergie / eau / environnement (Ense3)",
        "Génie industriel",
      ],
      source: "https://www.grenoble-inp.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Grenoble École de Management (GEM)",
      type: "ecole_commerce",
      specialites: ["Management de la tech", "Innovation", "Finance", "Géopolitique"],
      source: "https://www.grenoble-em.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Université Grenoble Alpes (UGA)",
      type: "universite",
      specialites: ["Sciences", "Médecine", "Droit", "Lettres", "IDEX"],
      source: "https://www.univ-grenoble-alpes.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Sciences Po Grenoble — UGA",
      type: "sciences_po",
      specialites: ["Sciences politiques", "Affaires publiques", "Relations internationales"],
      source: "https://www.sciencespo-grenoble.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Grenoble INP - Ensimag (informatique / maths appliquées)",
      type: "ecole_ingenieur",
      specialites: ["Informatique", "Mathématiques appliquées", "Data Science", "IA"],
      source: "https://ensimag.grenoble-inp.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Grenoble INP - Phelma (physique / électronique / matériaux)",
      type: "ecole_ingenieur",
      specialites: ["Physique", "Électronique", "Matériaux avancés", "Nano-technologies"],
      source: "https://phelma.grenoble-inp.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  polesRechercheRD: [
    {
      nom: "CEA Grenoble — Leti (Laboratoire d'électronique et de technologie de l'information)",
      organisme: "cea",
      domaine: "Micro-nanoélectronique / capteurs / IoT / silicium-photonique (acteur clé Minatec)",
      source: "https://www.leti-cea.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ESRF — European Synchrotron Radiation Facility (Presqu'île)",
      organisme: "autre",
      domaine: "Synchrotron européen de 4e génération — rayons X de haute brillance",
      source: "https://www.esrf.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ILL — Institut Laue-Langevin (Presqu'île)",
      organisme: "autre",
      domaine: "Source de neutrons la plus intense au monde — recherche fondamentale matière",
      source: "https://www.ill.eu/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Inria Centre Grenoble Rhône-Alpes (Montbonnot)",
      organisme: "inria",
      domaine: "Informatique / sciences du numérique / IA / systèmes distribués",
      source: "https://www.inria.fr/fr/inria-centre-universite-grenoble-alpes",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "CNRS — Délégation Alpes (Grenoble)",
      organisme: "cnrs",
      domaine: "Recherche fondamentale multidisciplinaire — partenaire UGA",
      source: "https://www.alpes.cnrs.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "INSERM (sites Grenoble — CHU et campus santé La Tronche)",
      organisme: "inserm",
      domaine: "Santé / sciences biomédicales / cancérologie / neurosciences",
      source: "https://www.inserm.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  grandsGroupesImplantes: [
    {
      nom: "STMicroelectronics (Grenoble + Crolles)",
      secteur: "Micro-électronique / semi-conducteurs",
      typeImplantation: "centre_rd",
      source: "https://www.st.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Soitec",
      secteur: "Matériaux semi-conducteurs innovants (SOI, GaN, InP)",
      typeImplantation: "siege_social",
      source: "https://www.soitec.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Schneider Electric (site historique Grenoble — projet GreenOValley)",
      secteur: "Gestion de l'énergie / automatismes industriels",
      typeImplantation: "site_majeur",
      source: "https://www.se.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Atos (centre R&D IA Grenoble)",
      secteur: "Services numériques / cybersécurité / IA / HPC",
      typeImplantation: "centre_rd",
      source: "https://atos.net/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "HPE — Hewlett Packard Enterprise (Eybens)",
      secteur: "Infrastructure IT / HPC / cloud",
      typeImplantation: "site_majeur",
      source: "https://www.hpe.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Naver Labs Europe (ex Xerox Research Centre Europe — Meylan)",
      secteur: "Recherche IA / NLP / vision par ordinateur / robotique",
      typeImplantation: "centre_rd",
      source: "https://europe.naverlabs.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Couche 2bis — tags KB sectorielles ─────────────────────────────
  // Volontairement vide en V1 : KB Prisma ne contient pas encore d'entries
  // sectorielles dédiées (Phase B du sprint).
  kbSectorTags: ["it-numerique", "mecanique-precision", "enseignement-recherche"],

  // ─── Optionnels (hors scoring dashboard) ────────────────────────────
  capitaleFrenchTech: {
    statut: "capitale",
    nomChapitre: "French Tech in the Alps — Grenoble (SCIC, ~450 membres)",
    source: "https://www.ftalps.com/territoires/grenoble/",
    verifiedOn: "2026-05-18",
  },

  cciCompetente: {
    nom: "CCI de Grenoble (Isère)",
    source: "https://grenoble.cci.fr/",
    verifiedOn: "2026-05-18",
  },

  distancesGrandesMetropoles: [
    {
      metropole: "Lyon",
      distanceKm: 110,
      tempsMnTgv: 80,
      tempsMnRoute: 75,
      source: "https://www.sncf-connect.com/gares/grenoble",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Paris",
      distanceKm: 570,
      tempsMnTgv: 180,
      source: "https://www.sncf-connect.com/gares/grenoble",
      verifiedOn: "2026-05-18",
    },
  ],

  incubateursAccelerateurs: [
    {
      nom: "GIANT Campus (Grenoble Innovation for Advanced New Technologies)",
      focus: "Deep tech / R&D / spin-offs CEA-Leti / ESRF / ILL",
      source: "https://www.giant-grenoble.org/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "GATE 1 (Grenoble Alpes Tech & Entrepreneurship)",
      focus: "Incubateur deeptech UGA / Grenoble INP",
      source: "https://www.gate1.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Linksium SATT Grenoble Alpes",
      focus: "Maturation / transfert techno / deeptech (CEA, CNRS, UGA, Grenoble INP)",
      source: "https://linksium.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Spécificités locales (hors grille standard) ────────────────────
  specificitesLocales: [
    {
      theme: "capitale_nanotechnologies",
      description:
        "Capitale française des nanotechnologies (Minatec, CEA-Leti) et 'Silicon Valley européenne' — densité unique en Europe de R&D micro-électronique avec ESRF + ILL + EMBL + CEA + CNRS + Inria + UGA + Grenoble INP sur la Presqu'île scientifique.",
      source: "https://www.minatec.org/",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "capitale_alpine",
      description:
        "Capitale alpine — JO d'hiver 1968 — pôle mondial industrie montagne (Poma téléphériques, Petzl alpinisme, MND, Salon Mountain Planet Alpexpo).",
      source: "https://www.mountain-planet.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Métadonnées de revue ───────────────────────────────────────────
  lastReviewedOn: "2026-05-18",
  reviewedBy: "Claude Code Opus 4.7 (sprint City Quality V3 ville #19)",
};
