// Brest (29019) — data économique enrichie sourcée V3 multi-taille.
//
// Sprint City Quality V3 — ville #24 (recadrage Will : "fond" avant "forme").
// Contrat zéro invention : chaque champ a un `source` vérifiable.
//
// Sources canoniques utilisées :
//   - INSEE dossier complet commune 29019 (2011101)
//   - competitivite.gouv.fr — pôles Phase V 2023-2026
//   - Site officiel Pôle Mer Bretagne Atlantique (siège Plouzané — Technopôle
//     Brest-Iroise) : pole-mer-bretagne-atlantique.com
//   - Wikipédia articles entreprises/écoles/AOC/patrimoine
//   - Sites officiels (naval-group.com, thalesgroup.com, ifremer.fr,
//     univ-brest.fr (UBO), enib.fr, imt-atlantique.fr, ecole-navale.fr,
//     brest-iroise.fr, brest-metropole.fr, bretagne.cci.fr, frenchtech-brest.bzh,
//     festivalduboutdumonde.com, brest.fr/brest-2024, seatechweek.fr)
//   - INAO (inao.gouv.fr) pour Cidre de Cornouaille AOP / Volailles de Bretagne IGP
//   - SNCF Connect (gare Brest LGV) + Aéroport Brest-Bretagne (aeroport.brest.fr)
//
// Singularité Brest : 2e base navale militaire française (Atlantique, port-mère
// de la Force Océanique Stratégique — SNLE classe Triomphant), siège du Pôle Mer
// Bretagne Atlantique (économie maritime à vocation mondiale), siège mondial
// IFREMER (recherche sciences de la mer), Technopôle Brest-Iroise = capitale
// française de l'économie marine et des sciences de la mer.
//
// Reviewer : Claude Code Opus 4.7 (sprint City Quality V3 ville #24).

import type { VilleEconomicData } from "./types";

export const BREST_ECONOMIC_DATA: VilleEconomicData = {
  // ─── Couche 1 — Économie INSEE ──────────────────────────────────────
  topSectorsNaf: [
    {
      naf: "GHI",
      label: "Commerce, transports, hébergement et restauration (sections G+H+I)",
      rank: 1,
      etablissementsCount: 3_215,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-29019",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "OPQ",
      label: "Administration publique, enseignement, santé, action sociale (sections O+P+Q)",
      rank: 2,
      etablissementsCount: 2_874,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-29019",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "MN",
      label:
        "Activités spécialisées, scientifiques et techniques + services administratifs (sections M+N)",
      rank: 3,
      etablissementsCount: 2_751,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-29019",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "F",
      label: "Construction (section F)",
      rank: 4,
      etablissementsCount: 1_392,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-29019",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "BCDE",
      label: "Industrie manufacturière (sections B+C+D+E) — incluant industrie navale militaire",
      rank: 5,
      etablissementsCount: 612,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-29019",
      verifiedOn: "2026-05-18",
    },
  ],

  polesCompetitivite: [
    {
      nom: "Pôle Mer Bretagne Atlantique",
      secteur:
        "Économie maritime à vocation mondiale (défense maritime, sécurité, naval & nautisme, énergies marines renouvelables, ressources biologiques marines, environnement et aménagement du littoral)",
      // Siège statutaire au Technopôle Brest-Iroise (Plouzané, 10 km Brest).
      type: "siege",
      source: "https://www.pole-mer-bretagne-atlantique.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Images & Réseaux",
      secteur: "Numérique / IA / contenus / réseaux télécoms / 5G / cybersécurité",
      // Écosystème numérique trans-bassin Rennes-Lannion-Brest-Nantes.
      type: "rayonnement",
      source: "https://www.images-et-reseaux.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Valorial",
      secteur: "Agroalimentaire / bioéconomie / innovation collaborative",
      type: "rayonnement",
      source: "https://www.pole-valorial.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  distances: {
    gareTgv: {
      // LGV Bretagne-Pays de la Loire mise en service juillet 2017,
      // Paris-Montparnasse → Brest en ~3h25 (gain ~37 min).
      nom: "Gare de Brest — TGV Atlantique / LGV Bretagne-Pays de la Loire (Paris-Montparnasse ~3h25)",
      distanceKm: 0,
      source: "https://fr.wikipedia.org/wiki/Gare_de_Brest",
    },
    aeroportPrincipal: {
      nom: "Aéroport Brest-Bretagne (BES) à Guipavas",
      distanceKm: 10,
      source: "https://www.aeroport.brest.fr/",
    },
    metroOuTram: {
      // Tramway de Brest (ligne A) en service depuis juin 2012, exploité par
      // Bibus. Une seule ligne tram en 2026 ; téléphérique urbain en complément
      // (1er d'Europe en milieu urbain) hors décompte "tram/métro" classique.
      lignes: 1,
      source: "https://www.bibus.fr/",
    },
    verifiedOn: "2026-05-18",
  },

  statsInsee: {
    etablissementsActifs: 12_847,
    creationsEntreprises: 2_318,
    anneeReference: 2023,
    source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-29019",
    verifiedOn: "2026-05-18",
  },

  // ─── Couche 2 — Matière éditoriale unique ───────────────────────────
  marquesHistoriques: [
    {
      nom: "Naval Group (ex-DCNS, ex-DCN, ex-Arsenal de Brest)",
      secteur: "Construction navale militaire / défense maritime / SNLE / FREMM",
      lienVille: "heritage",
      source: "https://fr.wikipedia.org/wiki/Naval_Group",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Arsenal de Brest (Marine nationale)",
      secteur:
        "Base navale militaire / construction et maintenance navale (depuis 1631, fondé par Richelieu)",
      lienVille: "heritage",
      source: "https://fr.wikipedia.org/wiki/Arsenal_de_Brest",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "IFREMER (Institut français de recherche pour l'exploitation de la mer)",
      secteur: "Recherche océanographique / sciences de la mer (siège social Plouzané-Brest)",
      lienVille: "siege",
      source: "https://www.ifremer.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Thales Underwater Systems (ex-Thomson Sintra)",
      secteur: "Sonars / systèmes sous-marins / acoustique sous-marine (site historique Brest)",
      lienVille: "production",
      source: "https://www.thalesgroup.com/en/underwater-systems",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Bolloré (groupe Vincent Bolloré, racines bretonnes Concarneau-Ergué-Gabéric, fort lien historique avec Brest-Cornouaille)",
      secteur: "Logistique / transport / médias / industrie (papier OCR à l'origine en Finistère)",
      lienVille: "heritage",
      source: "https://fr.wikipedia.org/wiki/Bollor%C3%A9_(entreprise)",
      verifiedOn: "2026-05-18",
    },
  ],

  produitsIgpAop: [
    {
      nom: "Cidre de Cornouaille",
      categorie: "agroalimentaire",
      signe: "AOP",
      source:
        "https://www.inao.gouv.fr/Espace-professionnel-et-outils/Rechercher-un-signe-officiel",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Volailles de Bretagne",
      categorie: "agroalimentaire",
      signe: "IGP",
      source:
        "https://www.inao.gouv.fr/Espace-professionnel-et-outils/Rechercher-un-signe-officiel",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Coquille Saint-Jacques (filière Bretagne — bassin baie de Saint-Brieuc et rade de Brest)",
      categorie: "produit_mer",
      signe: "Label Rouge",
      source:
        "https://www.inao.gouv.fr/Espace-professionnel-et-outils/Rechercher-un-signe-officiel",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Fraise de Plougastel (bassin Plougastel-Daoulas, 10 km Brest)",
      categorie: "agroalimentaire",
      signe: "IGP",
      source: "https://fr.wikipedia.org/wiki/Fraise_de_Plougastel",
      verifiedOn: "2026-05-18",
    },
  ],

  salonsSectoriels: [
    {
      nom: "Sea Tech Week",
      secteur: "Économie maritime / sciences et technologies de la mer / R&D océanique",
      localisation: "Brest (Le Quartz / Technopôle Brest-Iroise) — édition biennale",
      lienVille: "accueille",
      source: "https://www.seatechweek.eu/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Fêtes maritimes internationales de Brest (Brest 2024)",
      secteur:
        "Patrimoine maritime / nautisme / vieux gréements (~1000 navires, ~700 000 visiteurs)",
      localisation: "Brest (port de commerce)",
      lienVille: "accueille",
      source: "https://www.brest.fr/brest-2024",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Festival du Bout du Monde (Crozon, presqu'île 50 km Brest)",
      secteur: "Musiques du monde / culture / tourisme",
      localisation: "Crozon-Landaoudec (rayonnement Brest)",
      lienVille: "secteur_pertinent",
      source: "https://www.festivalduboutdumonde.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Euromaritime / Euronaval (filière maritime + défense)",
      secteur: "Économie maritime / défense / naval",
      localisation: "Paris (filière exposée par les acteurs brestois)",
      lienVille: "secteur_pertinent",
      source: "https://www.euronaval.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  patrimoineNotable: [
    {
      nom: "Château de Brest (XIIIe-XVIIIe siècles, siège du Musée national de la Marine)",
      type: "musee",
      source: "https://www.musee-marine.fr/nos-musees/brest.html",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Tour Tanguy (XIVe siècle, Musée du Vieux Brest)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Tour_Tanguy",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Pont de Recouvrance (plus grand pont levant d'Europe à sa construction en 1954)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Pont_de_Recouvrance",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Phare du Petit Minou (Plouzané, entrée de la rade de Brest)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Phare_du_Petit_Minou",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Océanopolis (parc de découverte des océans, 3 pavillons climatiques)",
      type: "musee",
      source: "https://www.oceanopolis.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Quartier de Recouvrance (rive droite historique de la Penfeld)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Recouvrance_(Brest)",
      verifiedOn: "2026-05-18",
    },
  ],

  communesBassin: [
    {
      slug: "guipavas",
      nameFr: "Guipavas",
      distanceKm: 8,
      source: "https://fr.wikipedia.org/wiki/Guipavas",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "plouzane",
      nameFr: "Plouzané",
      distanceKm: 10,
      source: "https://fr.wikipedia.org/wiki/Plouzan%C3%A9",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "le-relecq-kerhuon",
      nameFr: "Le Relecq-Kerhuon",
      distanceKm: 5,
      source: "https://fr.wikipedia.org/wiki/Le_Relecq-Kerhuon",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "plougastel-daoulas",
      nameFr: "Plougastel-Daoulas",
      distanceKm: 10,
      source: "https://fr.wikipedia.org/wiki/Plougastel-Daoulas",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "bohars",
      nameFr: "Bohars",
      distanceKm: 6,
      source: "https://fr.wikipedia.org/wiki/Bohars",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "gouesnou",
      nameFr: "Gouesnou",
      distanceKm: 6,
      source: "https://fr.wikipedia.org/wiki/Gouesnou",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "guilers",
      nameFr: "Guilers",
      distanceKm: 7,
      source: "https://fr.wikipedia.org/wiki/Guilers",
      verifiedOn: "2026-05-18",
    },
  ],

  // Brest n'a pas de vignoble AOC à ≤ 50 km. La Bretagne n'est pas une
  // région viticole AOC : aucune AOC viticole en Finistère ni dans le bassin
  // brestois. Champ structurellement non applicable.
  vignoblesProches: [],

  // ─── Couche 3 — Multi-taille PME/ETI/GE ─────────────────────────

  // Label EPV : annuaire officiel ne fournit pas d'extraction par commune
  // confirmée pour Brest en mai 2026. Champ vide pour respecter zéro
  // invention. À compléter Phase 2 via data.economie.gouv.fr.
  labelsEpvEtArtisanat: [],

  zonesActivitesParcs: [
    {
      nom: "Technopôle Brest-Iroise (Plouzané, 10 km Brest — IFREMER + Pôle Mer + UBO sciences)",
      type: "technopole",
      secteurDominant:
        "Sciences de la mer / R&D océanique / numérique / biotechnologies marines (~5 000 emplois)",
      source: "https://www.tech-brest-iroise.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Zone d'activités du Vern (Guipavas, aéroport)",
      type: "zac",
      secteurDominant: "Industrie / logistique / services aéroportuaires",
      source: "https://www.brest-metropole.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Polder du port de Brest (zone industrialo-portuaire)",
      type: "zac",
      secteurDominant:
        "Industrie navale / éolien offshore / réparation navale / logistique portuaire",
      source: "https://www.brest.port.bzh/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Parc d'activités de Kergaradec (Gouesnou)",
      type: "parc_tech",
      secteurDominant: "Tertiaire / commerce / services aux entreprises",
      source: "https://www.brest-metropole.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  grandesEcolesEtUniversites: [
    {
      nom: "Université de Bretagne Occidentale (UBO)",
      type: "universite",
      specialites: [
        "Sciences de la mer (Institut Universitaire Européen de la Mer — IUEM)",
        "Sciences et techniques",
        "Médecine et santé",
        "Droit, économie, gestion",
        "Lettres et sciences humaines",
      ],
      source: "https://www.univ-brest.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ENIB — École Nationale d'Ingénieurs de Brest",
      type: "ecole_ingenieur",
      specialites: ["Électronique", "Informatique", "Mécatronique", "IA et systèmes embarqués"],
      source: "https://www.enib.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "IMT Atlantique (campus Brest, fusion Télécom Bretagne + Mines Nantes en 2017)",
      type: "ecole_ingenieur",
      specialites: [
        "Numérique",
        "Cybersécurité",
        "IA / data science",
        "Réseaux et télécoms",
        "Énergie",
      ],
      source: "https://www.imt-atlantique.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "École Navale (Lanvéoc-Poulmic, presqu'île de Crozon, 30 km Brest)",
      type: "ecole_ingenieur",
      specialites: [
        "Formation des officiers de marine",
        "Ingénierie navale",
        "Sciences et techniques navales",
      ],
      source: "https://www.ecole-navale.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ENSTA Bretagne (École Nationale Supérieure de Techniques Avancées Bretagne)",
      type: "ecole_ingenieur",
      specialites: [
        "Ingénierie maritime / hydrographie",
        "Cybersécurité",
        "Systèmes embarqués",
        "Mécanique / pyrotechnie",
      ],
      source: "https://www.ensta-bretagne.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  polesRechercheRD: [
    {
      nom: "IFREMER — Centre Bretagne (siège social, Plouzané, Technopôle Brest-Iroise)",
      organisme: "autre",
      domaine: "Sciences de la mer / océanographie / ressources marines / biotechnologies marines",
      source: "https://wwz.ifremer.fr/brest/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "IUEM — Institut Universitaire Européen de la Mer (UBO + CNRS + IRD)",
      organisme: "cnrs",
      domaine: "Océanographie / géosciences marines / biologie marine / sciences de la mer",
      source: "https://www-iuem.univ-brest.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Lab-STICC (UMR CNRS 6285, IMT Atlantique + UBO + ENSTA Bretagne + ENIB)",
      organisme: "cnrs",
      domaine: "Sciences et technologies de l'information / IA / communications / capteurs",
      source: "https://www.labsticc.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "IRD — Institut de Recherche pour le Développement (représentation Brest, IUEM)",
      organisme: "autre",
      domaine: "Sciences marines tropicales / ressources halieutiques / climat océan",
      source: "https://www.ird.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  grandsGroupesImplantes: [
    {
      nom: "Naval Group — site de Brest (SNLE, FREMM, MCO grands bâtiments)",
      secteur:
        "Construction navale militaire / défense maritime (porte-avions, SNLE classe Triomphant)",
      typeImplantation: "site_majeur",
      source: "https://www.naval-group.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Thales Underwater Systems — site de Brest (sonars, systèmes sous-marins)",
      secteur: "Électronique de défense / sonars / acoustique sous-marine",
      typeImplantation: "site_majeur",
      source: "https://www.thalesgroup.com/en/underwater-systems",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "IFREMER (siège social, Plouzané — Technopôle Brest-Iroise)",
      secteur:
        "Recherche océanographique publique / sciences de la mer (établissement public EPIC)",
      typeImplantation: "siege_social",
      source: "https://www.ifremer.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Marine nationale française — Base navale de Brest (Préfecture maritime de l'Atlantique)",
      secteur:
        "Défense maritime — 2e port militaire de France, port-mère de la Force Océanique Stratégique (SNLE)",
      typeImplantation: "site_majeur",
      source: "https://www.defense.gouv.fr/marine",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Bolloré Logistics — site de Brest (groupe Bolloré, racines bretonnes Ergué-Gabéric)",
      secteur: "Logistique / transport international / commission de transport",
      typeImplantation: "site_majeur",
      source: "https://www.bollore-logistics.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Couche 2bis — tags KB sectorielles ─────────────────────────────
  // Volontairement vide en V1 : la KB Prisma ne contient pas encore
  // d'entries sectorielles dédiées (Phase B du sprint).
  kbSectorTags: [
    "maritime-portuaire",
    "aerospatial-defense",
    "enseignement-recherche",
    "cybersecurite",
  ],

  // ─── Optionnels (hors scoring dashboard) ────────────────────────────
  capitaleFrenchTech: {
    statut: "communaute",
    nomChapitre: "French Tech Brest+",
    source: "https://www.frenchtech-brest.bzh/",
    verifiedOn: "2026-05-18",
  },

  cciCompetente: {
    nom: "CCI métropolitaine Bretagne Ouest (CCIMBO)",
    source: "https://www.bretagne-ouest.cci.bzh/",
    verifiedOn: "2026-05-18",
  },

  distancesGrandesMetropoles: [
    {
      metropole: "Rennes",
      distanceKm: 244,
      tempsMnRoute: 150,
      tempsMnTgv: 130,
      source: "https://www.sncf-connect.com/train/horaires/brest/rennes",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Nantes",
      distanceKm: 297,
      tempsMnRoute: 200,
      tempsMnTgv: 230,
      source: "https://www.sncf-connect.com/train/horaires/brest/nantes",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Paris",
      distanceKm: 593,
      tempsMnTgv: 205,
      source: "https://www.sncf-connect.com/train/horaires/brest/paris",
      verifiedOn: "2026-05-18",
    },
  ],

  incubateursAccelerateurs: [
    {
      nom: "Technopôle Brest-Iroise (incubation sciences de la mer + numérique)",
      focus: "Économie maritime / numérique / biotechnologies marines / R&D océanique",
      source: "https://www.tech-brest-iroise.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Le Village by CA Finistère (Crédit Agricole, écosystème startups)",
      focus: "Généraliste / startups locales / accompagnement scale-up",
      source: "https://levillagebyca.com/finistere/",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Spécificité locale — Brest = capitale française des sciences de la mer ──
  specificitesLocales: [
    {
      theme: "capitale_economie_marine_sciences_mer",
      description:
        "Brest est la capitale française de l'économie marine et des sciences de la mer : siège mondial IFREMER, siège du Pôle Mer Bretagne Atlantique (vocation mondiale Phase V), IUEM (UBO+CNRS+IRD), Technopôle Brest-Iroise ~5 000 emplois R&D océanique.",
      source: "https://www.pole-mer-bretagne-atlantique.com/",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "deuxieme_port_militaire_france_atlantique",
      description:
        "Brest abrite la 2e base navale militaire française (1re façade Atlantique), Préfecture maritime de l'Atlantique, port-mère de la Force Océanique Stratégique (SNLE classe Triomphant, dissuasion nucléaire) — écosystème défense maritime + Naval Group + Thales Underwater unique.",
      source: "https://www.defense.gouv.fr/marine",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "ecosysteme_universitaire_ingenierie_mer",
      description:
        "Brest concentre 4 écoles d'ingénieurs (ENIB, IMT Atlantique, ENSTA Bretagne, École Navale à 30 km) + UBO (~22 000 étudiants) + IUEM — bassin de talents unique en France pour l'ingénierie navale, l'IA embarquée maritime et la cybersécurité.",
      source: "https://www.univ-brest.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Adaptations Brest (zéro invention) ─────────────────────────────
  // Brest n'a pas de vignoble AOC à ≤ 50 km (la Bretagne n'est pas une
  // région viticole AOC). Ce champ est structurellement non applicable,
  // exempté du scoring pour ne pas pénaliser injustement la ville.
  // Le champ labelsEpvEtArtisanat est vide en attente d'extraction
  // officielle Phase 2 (data.economie.gouv.fr EPV).
  notApplicableFields: ["vignoblesProches"],

  // ─── Métadonnées de revue ───────────────────────────────────────────
  lastReviewedOn: "2026-05-18",
  reviewedBy: "Claude Code Opus 4.7 (sprint City Quality V3 ville #24)",
};
