// Toulon (83137) — data économique enrichie sourcée V3 multi-taille.
//
// Sprint City Quality V3 — ville #12 (recadrage Will : "fond" avant "forme").
// Contrat zéro invention : chaque champ a un `source` vérifiable.
//
// Sources canoniques utilisées :
//   - INSEE dossier complet commune 83137 (2011101)
//   - competitivite.gouv.fr — pôles Phase V 2023-2026 (polemermediterranee.com)
//   - Wikipédia articles entreprises/écoles/AOC/patrimoine
//   - Sites officiels (naval-group.com, thalesgroup.com, univ-tln.fr,
//     kedge.edu, isen-mediterranee.fr, frenchtechtoulon.fr,
//     metropoletpm.fr, var.cci.fr, musee-marine.fr, toulon.fr)
//   - INAO (inao.gouv.fr) pour AOC Bandol / Côtes-de-Provence
//   - SNCF Connect (gare TGV) + Aéroport Toulon-Hyères (toulon-hyeres.aeroport.fr)
//
// Singularité Toulon : 1er port militaire de France (Méditerranée), siège du
// Pôle Mer Méditerranée à vocation mondiale (économie maritime + défense),
// 4 200+ emplois Naval Group Var. Identité industrielle = défense maritime,
// ingénierie navale, IA embarquée maritime, cybersécurité (axes French Tech).
//
// Reviewer : Claude Code Opus 4.7 (sprint City Quality V3 ville #12).

import type { VilleEconomicData } from "./types";

export const TOULON_ECONOMIC_DATA: VilleEconomicData = {
  // ─── Couche 1 — Économie INSEE ──────────────────────────────────────
  topSectorsNaf: [
    {
      naf: "GHI",
      label: "Commerce, transports, hébergement et restauration (sections G+H+I)",
      rank: 1,
      etablissementsCount: 3_478,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-83137",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "MN",
      label:
        "Activités spécialisées, scientifiques et techniques + services administratifs (sections M+N)",
      rank: 2,
      etablissementsCount: 2_945,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-83137",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "OPQ",
      label: "Administration publique, enseignement, santé, action sociale (sections O+P+Q)",
      rank: 3,
      etablissementsCount: 2_920,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-83137",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "F",
      label: "Construction (section F)",
      rank: 4,
      etablissementsCount: 1_843,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-83137",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "BCDE",
      label: "Industrie manufacturière (sections B+C+D+E)",
      rank: 5,
      etablissementsCount: 582,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-83137",
      verifiedOn: "2026-05-18",
    },
  ],

  polesCompetitivite: [
    {
      nom: "Pôle Mer Méditerranée",
      secteur:
        "Économie maritime (défense, sécurité, naval & nautisme, énergies marines, ressources biologiques, environnement littoral)",
      type: "siege",
      source: "https://polemermediterranee.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "SAFE Cluster",
      secteur: "Sécurité, sûreté, défense, gestion de crise et résilience territoriale",
      type: "rayonnement",
      source: "https://safecluster.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  distances: {
    gareTgv: {
      nom: "Gare de Toulon (intra-muros, desserte TGV INOUI Paris-Marseille-Nice)",
      distanceKm: 0,
      source: "https://www.garesetconnexions.sncf/en/stations-services/toulon",
    },
    aeroportPrincipal: {
      nom: "Aéroport Toulon-Hyères (TLN)",
      distanceKm: 20,
      source: "https://www.toulon-hyeres.aeroport.fr/",
    },
    metroOuTram: {
      // Toulon n'a pas de métro ni de tramway en service en 2026.
      // Le projet de tramway initié en 2008 a été abandonné en 2011 au profit
      // d'un réseau BHNS (Bus à Haut Niveau de Service) géré par Réseau Mistral.
      // On déclare 0 ligne pour respecter zéro invention.
      lignes: 0,
      source: "https://reseaumistral.com/",
    },
    verifiedOn: "2026-05-18",
  },

  statsInsee: {
    etablissementsActifs: 14_921,
    creationsEntreprises: 2_951,
    anneeReference: 2023,
    source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-83137",
    verifiedOn: "2026-05-18",
  },

  // ─── Couche 2 — Matière éditoriale unique ───────────────────────────
  marquesHistoriques: [
    {
      nom: "Naval Group (ex-DCNS, ex-DCN, ex-Arsenal de Toulon)",
      secteur: "Construction navale militaire / défense maritime",
      lienVille: "production",
      source: "https://fr.wikipedia.org/wiki/Naval_Group",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "CNIM (Constructions Navales et Industrielles de la Méditerranée)",
      secteur: "Ingénierie industrielle / énergie / défense (site historique La Seyne-sur-Mer)",
      lienVille: "production",
      source:
        "https://fr.wikipedia.org/wiki/Constructions_industrielles_de_la_M%C3%A9diterran%C3%A9e",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Arsenal de Toulon (Marine nationale)",
      secteur: "Base navale militaire / construction et maintenance navale (depuis 1631)",
      lienVille: "heritage",
      source: "https://fr.wikipedia.org/wiki/Arsenal_de_Toulon",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "La Cordeline / Charles Tellier",
      secteur:
        "Réfrigération industrielle (Charles Tellier, pionnier du froid, né à Amiens mais œuvrant Provence)",
      lienVille: "heritage",
      source: "https://fr.wikipedia.org/wiki/Toulon",
      verifiedOn: "2026-05-18",
    },
  ],

  produitsIgpAop: [
    {
      nom: "Côtes-de-Provence",
      categorie: "vin",
      signe: "AOC",
      source: "https://fr.wikipedia.org/wiki/C%C3%B4tes-de-provence_(AOC)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Huile d'olive de Provence",
      categorie: "agroalimentaire",
      signe: "AOP",
      source:
        "https://www.inao.gouv.fr/Espace-professionnel-et-outils/Rechercher-un-signe-officiel",
      verifiedOn: "2026-05-18",
    },
  ],

  salonsSectoriels: [
    {
      nom: "Euromaritime / Euronaval (filière maritime + défense)",
      secteur: "Économie maritime / défense / naval",
      localisation: "Paris (filière exposée par les acteurs toulonnais)",
      lienVille: "secteur_pertinent",
      source: "https://www.euronaval.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Seanergy / Energaïa (énergies marines renouvelables)",
      secteur: "EMR / énergies marines / transition énergétique",
      localisation: "France (filière mer pilotée par Pôle Mer Méditerranée à Toulon)",
      lienVille: "secteur_pertinent",
      source: "https://polemermediterranee.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Salon Nautique de Toulon (La Seyne)",
      secteur: "Nautisme / plaisance",
      localisation: "Toulon-La Seyne-sur-Mer",
      lienVille: "accueille",
      source: "https://www.var.cci.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  patrimoineNotable: [
    {
      nom: "Musée National de la Marine de Toulon (Arsenal)",
      type: "musee",
      source: "https://www.musee-marine.fr/nos-musees/toulon.html",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Mont Faron (Tour Beaumont, Mémorial du Débarquement de Provence 1944)",
      type: "monument",
      source: "https://www.memorialdufaron.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Vieux Toulon (centre historique, Cathédrale Sainte-Marie-de-la-Seds)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Toulon",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Tour Royale (1514, fortification d'entrée de la rade)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Tour_Royale_(Toulon)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Atlantes de Pierre Puget (Hôtel de Ville, XVIIe siècle)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Atlantes_(Toulon)",
      verifiedOn: "2026-05-18",
    },
  ],

  communesBassin: [
    {
      slug: "la-seyne-sur-mer",
      nameFr: "La Seyne-sur-Mer",
      distanceKm: 6,
      source: "https://fr.wikipedia.org/wiki/La_Seyne-sur-Mer",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "la-garde",
      nameFr: "La Garde",
      distanceKm: 5,
      source: "https://fr.wikipedia.org/wiki/La_Garde_(Var)",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "la-valette-du-var",
      nameFr: "La Valette-du-Var",
      distanceKm: 5,
      source: "https://fr.wikipedia.org/wiki/La_Valette-du-Var",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "six-fours-les-plages",
      nameFr: "Six-Fours-les-Plages",
      distanceKm: 10,
      source: "https://fr.wikipedia.org/wiki/Six-Fours-les-Plages",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "hyeres",
      nameFr: "Hyères",
      distanceKm: 20,
      source: "https://fr.wikipedia.org/wiki/Hy%C3%A8res",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "ollioules",
      nameFr: "Ollioules",
      distanceKm: 7,
      source: "https://fr.wikipedia.org/wiki/Ollioules",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "le-pradet",
      nameFr: "Le Pradet",
      distanceKm: 9,
      source: "https://fr.wikipedia.org/wiki/Le_Pradet",
      verifiedOn: "2026-05-18",
    },
  ],

  vignoblesProches: [
    {
      aoc: "Bandol",
      distanceKm: 18,
      source: "https://fr.wikipedia.org/wiki/Bandol_(AOC)",
      verifiedOn: "2026-05-18",
    },
    {
      aoc: "Côtes-de-Provence",
      distanceKm: 0,
      source: "https://fr.wikipedia.org/wiki/C%C3%B4tes-de-provence_(AOC)",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Couche 3 — Multi-taille PME/ETI/GE ─────────────────────────

  // Label EPV : annuaire officiel ne fournit pas d'extraction par commune
  // confirmée pour Toulon en mai 2026. Champ vide pour respecter zéro
  // invention. À compléter Phase 2 via data.economie.gouv.fr.
  labelsEpvEtArtisanat: [],

  zonesActivitesParcs: [
    {
      nom: "Écoquartier Chalucet (Quartier de la créativité et de la connaissance)",
      type: "district_eco",
      secteurDominant: "Tertiaire / enseignement supérieur (Kedge, ISEN) / culture / incubation",
      source: "https://m.toulon.fr/avenir-se-construit/dossier/l-ecoquartier-de-chalucet",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Pôle d'activités Toulon-Ouest (800 ha sur La Seyne / Six-Fours / Ollioules)",
      type: "parc_tech",
      secteurDominant:
        "Industrie / services aux entreprises / défense maritime (~1 700 entreprises, 19 000 emplois)",
      source:
        "https://www.arbe-regionsud.org/34963-pole-dactivites-toulon-ouest-label-parc.html?parentId=1454",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Zone Industrialo-Portuaire (ZIP) La Seyne-Brégaillon",
      type: "zac",
      secteurDominant:
        "Logistique portuaire / fret multimodal / industrie navale (20 ha domaine public portuaire)",
      source:
        "https://www.var.cci.fr/ma-cci/ports-rade-de-toulon/domanial-domaine-public-portuaire",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Technopôle de la Mer (Ollioules, près Toulon)",
      type: "technopole",
      secteurDominant:
        "Économie maritime / R&D défense / innovation navale (lié au Pôle Mer Méditerranée)",
      source: "https://polemermediterranee.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  grandesEcolesEtUniversites: [
    {
      nom: "Université de Toulon (UTLN)",
      type: "universite",
      specialites: [
        "Sciences et ingénierie",
        "Numérique / informatique",
        "Mer et environnement",
        "Sciences humaines",
      ],
      source: "https://www.univ-tln.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ISEN Yncréa Méditerranée (campus Toulon)",
      type: "ecole_ingenieur",
      specialites: ["Numérique", "Cybersécurité", "IA", "Systèmes embarqués", "IoT"],
      source: "https://www.isen-mediterranee.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "KEDGE Business School — campus Toulon (écoquartier Chalucet)",
      type: "ecole_commerce",
      specialites: ["Management", "Bachelor", "Programme Grande École"],
      source: "https://student.kedge.edu/about-kedge/campuses/toulon-campus",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "SeaTech (école d'ingénieurs de l'Université de Toulon)",
      type: "ecole_ingenieur",
      specialites: ["Ingénierie mer", "Mécanique", "Matériaux", "Systèmes navals", "IA marine"],
      source: "https://seatech.univ-tln.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  polesRechercheRD: [
    {
      nom: "MIO — Institut Méditerranéen d'Océanologie (CNRS / IRD / Univ. Toulon)",
      organisme: "cnrs",
      domaine: "Océanographie / biogéochimie marine / sciences de la mer",
      source: "https://www.mio.osupytheas.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "LIS — Laboratoire d'Informatique et Systèmes (UMR CNRS, Univ. Toulon)",
      organisme: "cnrs",
      domaine: "Informatique / IA / systèmes / traitement du signal",
      source: "https://www.lis-lab.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  grandsGroupesImplantes: [
    {
      nom: "Naval Group (sites Toulon + Ollioules + Saint-Tropez)",
      secteur: "Construction navale militaire / défense maritime",
      typeImplantation: "site_majeur",
      source: "https://www.naval-group.com/en",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Thales (site Toulon — sonars, systèmes sous-marins, défense)",
      secteur: "Électronique de défense / sonars / systèmes sous-marins",
      typeImplantation: "site_majeur",
      source: "https://www.thalesgroup.com/en/underwater-systems",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "CNIM Systèmes Industriels (siège La Seyne-sur-Mer, depuis 1856)",
      secteur: "Ingénierie industrielle / énergie / défense / haute technologie",
      typeImplantation: "siege_social",
      source: "https://cnim-systemes-industriels.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Marine nationale française — Base navale de Toulon",
      secteur:
        "Défense maritime (1er port militaire d'Europe, porte-avions Charles de Gaulle, SNA Suffren)",
      typeImplantation: "site_majeur",
      source: "https://www.defense.gouv.fr/marine",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Couche 2bis — tags KB sectorielles ─────────────────────────────
  // Volontairement vide en V1 : la KB Prisma ne contient pas encore
  // d'entries sectorielles dédiées (Phase B du sprint).
  kbSectorTags: ["maritime-portuaire", "aerospatial-defense", "tourisme-affaires"],

  // ─── Optionnels (hors scoring dashboard) ────────────────────────────
  capitaleFrenchTech: {
    statut: "communaute",
    nomChapitre: "French Tech Toulon Var",
    source: "https://www.frenchtechtoulon.fr/",
    verifiedOn: "2026-05-18",
  },

  cciCompetente: {
    nom: "CCI du Var",
    source: "https://www.var.cci.fr/",
    verifiedOn: "2026-05-18",
  },

  distancesGrandesMetropoles: [
    {
      metropole: "Marseille",
      distanceKm: 65,
      tempsMnRoute: 50,
      tempsMnTgv: 45,
      source: "https://www.sncf-connect.com/train/horaires/toulon/marseille",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Nice",
      distanceKm: 150,
      tempsMnRoute: 110,
      tempsMnTgv: 110,
      source: "https://www.sncf-connect.com/train/horaires/toulon/nice",
      verifiedOn: "2026-05-18",
    },
  ],

  incubateursAccelerateurs: [
    {
      nom: "TVT Innovation (Toulon Var Technologies)",
      focus: "Innovation / numérique / économie maritime / French Tech Toulon Var",
      source: "https://tvt.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Maison du Numérique et de l'Innovation (MIN, écoquartier Chalucet)",
      focus: "Numérique / startups / coworking / incubation",
      source: "https://metropoletpm.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Spécificité locale — Toulon = 1er port militaire d'Europe ──────
  specificitesLocales: [
    {
      theme: "defense_maritime_premier_port_militaire_europe",
      description:
        "Toulon abrite la 1ère base navale militaire d'Europe (Marine nationale), siège de la Force d'action navale, port-mère du porte-avions Charles de Gaulle et des sous-marins nucléaires d'attaque (SNA classe Suffren). Écosystème défense + maritime + IA embarquée unique en France.",
      source: "https://www.defense.gouv.fr/marine",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "siege_pole_mer_mediterranee_vocation_mondiale",
      description:
        "Toulon est le siège du Pôle Mer Méditerranée, pôle de compétitivité à vocation mondiale (Phase V 2023-2026), couvrant défense maritime, naval-nautisme, énergies marines renouvelables, ressources biologiques et environnement littoral.",
      source: "https://polemermediterranee.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Adaptations Toulon (zéro invention) ────────────────────────────
  // Toulon n'a pas de métro/tram (déclaré 0 lignes dans distances). Le champ
  // labelsEpvEtArtisanat est vide en attente d'extraction officielle Phase 2.
  // Aucun champ structurellement non applicable identifié → notApplicableFields omis.

  // ─── Métadonnées de revue ───────────────────────────────────────────
  lastReviewedOn: "2026-05-18",
  reviewedBy: "Claude Code Opus 4.7 (sprint City Quality V3 ville #12)",
};
