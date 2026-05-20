// Boulogne-Billancourt (92012) — data économique enrichie sourcée V3 multi-taille.
//
// Sprint City Quality V3 ville #31 (2026-05-18).
// Contrat zéro invention : chaque champ a un `source` vérifiable.
//
// Sources canoniques utilisées :
//   - INSEE dossier complet commune 92012 (2011101)
//   - competitivite.gouv.fr — pôles Phase V 2023-2026 (rayonnement Paris-Région)
//   - Sites officiels pôles (capdigital.com, systematic-paris-region.org)
//   - SNCF Connect (Paris-Montparnasse à ~5 km, Paris gare de Lyon à ~10 km
//     gare TGV de rattachement) + RATP (métro 9, 10, T2)
//   - Aéroports Paris-Orly (ORY) ~13 km + Paris-Charles-de-Gaulle (CDG) ~30 km
//   - Wikipédia articles Boulogne-Billancourt, Renault, TF1, Île Seguin,
//     Musée Albert-Kahn, Musée des Années 30, Boursorama, Métropole Télévision,
//     Bouygues Telecom, Pôle universitaire Léonard-de-Vinci
//   - Site officiel La Seine Musicale (laseinemusicale.com)
//   - INAO (vérification : pas d'IGP/AOP propre à Boulogne-Billancourt)
//
// Spécificité Boulogne-Billancourt : 1re commune des Hauts-de-Seine
// (~120 000 hab) et 1re commune de France hors Paris par population.
// Berceau historique de Renault depuis 1898 (Louis Renault y fonde sa
// première voiturette, puis la Société Renault Frères en 1899). Siège
// mondial Renault toujours à Boulogne-Billancourt. Hub audiovisuel
// majeur avec siège TF1 (Tour TF1, 1 quai du Point-du-Jour). Île Seguin
// = patrimoine industriel reconverti (usine Renault 1929-1992,
// La Seine Musicale ouverte avril 2017). Musée départemental Albert-Kahn
// = collection autochromes mondiale (UNESCO Mémoire du monde 2025).
//
// Note grands groupes : Bouygues SA holding est à Paris 8e (32 av Hoche),
// Bouygues Construction à Guyancourt (Challenger), Bouygues Telecom à Meudon,
// M6/Métropole Télévision à Neuilly-sur-Seine. Donc malgré la culture
// "siège Bouygues à Boulogne", seules entreprises dont le siège est
// effectivement à Boulogne-Billancourt et confirmé Wikipédia : Renault,
// TF1, Boursorama. Contrat zéro invention respecté.
//
// Reviewer : Claude Code Opus 4.7 (sprint City Quality V3 ville #31).

import type { VilleEconomicData } from "./types";

export const BOULOGNE_BILLANCOURT_ECONOMIC_DATA: VilleEconomicData = {
  // ─── Couche 1 — Économie INSEE ──────────────────────────────────────
  topSectorsNaf: [
    {
      naf: "MN",
      label:
        "Activités spécialisées, scientifiques et techniques + services administratifs (sections M+N)",
      rank: 1,
      etablissementsCount: 5_882,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-92012",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "GHI",
      label: "Commerce, transports, hébergement et restauration (sections G+H+I)",
      rank: 2,
      etablissementsCount: 2_572,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-92012",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "OPQ",
      label: "Administration publique, enseignement, santé, action sociale (sections O+P+Q)",
      rank: 3,
      etablissementsCount: 2_450,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-92012",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "J",
      label: "Information et communication (édition, logiciels, IT, médias — hub TF1/M6 proche)",
      rank: 4,
      etablissementsCount: 1_948,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-92012",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "K",
      label: "Activités financières et d'assurance (siège Boursorama)",
      rank: 5,
      etablissementsCount: 1_392,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-92012",
      verifiedOn: "2026-05-18",
    },
  ],

  // Boulogne-Billancourt mutualise les pôles de compétitivité Paris-Région
  // (rayonnement, pas siège — sièges sont à Paris commune).
  polesCompetitivite: [
    {
      nom: "Cap Digital Paris-Région",
      secteur: "Numérique / IA / transformation digitale",
      type: "rayonnement",
      source: "https://www.capdigital.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Systematic Paris-Region",
      secteur: "Logiciels critiques / cybersécurité / IA / systèmes complexes",
      type: "rayonnement",
      source: "https://systematic-paris-region.org/",
      verifiedOn: "2026-05-18",
    },
  ],

  distances: {
    gareTgv: {
      nom: "Paris-Montparnasse (TGV Atlantique / Sud-Ouest) — gare TGV la plus proche, ~5 km du centre Boulogne-Billancourt",
      distanceKm: 5,
      source: "https://www.sncf-connect.com/gares/paris-montparnasse",
    },
    aeroportPrincipal: {
      nom: "Paris-Orly (ORY) — aéroport le plus proche, ~13 km du centre Boulogne-Billancourt (CDG en complément à ~30 km)",
      distanceKm: 13,
      source: "https://www.parisaeroport.fr/orly",
    },
    metroOuTram: {
      lignes: 3,
      source: "https://www.ratp.fr/en/plan-metro",
    },
    verifiedOn: "2026-05-18",
  },

  statsInsee: {
    etablissementsActifs: 21_158,
    creationsEntreprises: 3_317,
    densiteEtablissementsPour1000: 176,
    anneeReference: 2023,
    source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-92012",
    verifiedOn: "2026-05-18",
  },

  // ─── Couche 2 — Matière éditoriale unique ───────────────────────────
  marquesHistoriques: [
    {
      nom: "Renault",
      secteur:
        "Automobile / mobilité (fondée à Boulogne-Billancourt en 1898 par Louis Renault, Société Renault Frères 25 février 1899)",
      lienVille: "fondation",
      source: "https://fr.wikipedia.org/wiki/Renault",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "TF1",
      secteur: "Média audiovisuel / chaîne TV — siège Tour TF1, 1 quai du Point-du-Jour",
      lienVille: "siege",
      source: "https://fr.wikipedia.org/wiki/TF1_(cha%C3%AEne_de_t%C3%A9l%C3%A9vision)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Boursorama",
      secteur: "Banque en ligne / fintech — siège quai du Point-du-Jour",
      lienVille: "siege",
      source: "https://fr.wikipedia.org/wiki/Boursorama",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Île Seguin — usines Renault (1929-1992)",
      secteur:
        "Patrimoine industriel automobile (plus grande usine de France, >30 000 salariés au pic)",
      lienVille: "heritage",
      source: "https://fr.wikipedia.org/wiki/%C3%8Ele_Seguin",
      verifiedOn: "2026-05-18",
    },
  ],

  // Boulogne-Billancourt : commune ouest Paris, pas d'IGP/AOP propre.
  // Champ honnêtement vide pour respecter zéro invention. Vérification :
  // https://www.inao.gouv.fr/Espace-professionnel-et-outils/Rechercher-un-signe-officiel
  produitsIgpAop: [],

  salonsSectoriels: [
    {
      nom: "VivaTech",
      secteur: "Innovation / tech / startups (bassin Paris)",
      localisation: "Paris Expo Porte de Versailles (~5 km de Boulogne-Billancourt)",
      lienVille: "secteur_pertinent",
      source: "https://vivatechnology.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Mondial de l'Auto",
      secteur: "Automobile / mobilité (pertinent siège Renault Boulogne)",
      localisation: "Paris Expo Porte de Versailles (~5 km de Boulogne-Billancourt)",
      lienVille: "secteur_pertinent",
      source: "https://www.mondial-paris.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Salon Equip'Auto",
      secteur: "Équipementiers automobile / aftermarket (pertinent écosystème Renault)",
      localisation: "Paris Expo Porte de Versailles (~5 km de Boulogne-Billancourt)",
      lienVille: "secteur_pertinent",
      source: "https://www.equipauto.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  patrimoineNotable: [
    {
      nom: "La Seine Musicale — île Seguin (ouverte avril 2017, ex-emprise usines Renault 1929-1992)",
      type: "monument",
      source: "https://www.laseinemusicale.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Musée départemental Albert-Kahn (Archives de la Planète : 72 000 autochromes + 100h de film 1909-1931, UNESCO Mémoire du monde 2025, rénovation Kengo Kuma 2016-2022)",
      type: "musee",
      source: "https://albert-kahn.hauts-de-seine.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Musée des Années 30 (M-A30, espace Paul-Landowski — 800 peintures + 1 500 sculptures + 20 000 dessins, Art Déco, label Musée de France)",
      type: "musee",
      source: "https://www.boulognebillancourt.com/culture/musee-des-annees-30",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Île Seguin (12,3 ha — patrimoine industriel Renault reconverti, projet culturel mixte en développement 2020-2027)",
      type: "autre",
      source: "https://fr.wikipedia.org/wiki/%C3%8Ele_Seguin",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Parc Edmond-de-Rothschild (ex-domaine famille Rothschild, parc urbain Boulogne-Billancourt)",
      type: "parc",
      source: "https://fr.wikipedia.org/wiki/Parc_Edmond-de-Rothschild",
      verifiedOn: "2026-05-18",
    },
  ],

  communesBassin: [
    {
      slug: "paris",
      nameFr: "Paris",
      distanceKm: 4,
      source: "https://fr.wikipedia.org/wiki/Boulogne-Billancourt",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "issy-les-moulineaux",
      nameFr: "Issy-les-Moulineaux",
      distanceKm: 2,
      source: "https://fr.wikipedia.org/wiki/Issy-les-Moulineaux",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "sevres",
      nameFr: "Sèvres",
      distanceKm: 3,
      source: "https://fr.wikipedia.org/wiki/S%C3%A8vres",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "meudon",
      nameFr: "Meudon",
      distanceKm: 4,
      source: "https://fr.wikipedia.org/wiki/Meudon",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "saint-cloud",
      nameFr: "Saint-Cloud",
      distanceKm: 3,
      source: "https://fr.wikipedia.org/wiki/Saint-Cloud",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "vanves",
      nameFr: "Vanves",
      distanceKm: 3,
      source: "https://fr.wikipedia.org/wiki/Vanves",
      verifiedOn: "2026-05-18",
    },
  ],

  // Boulogne-Billancourt : proche couronne Paris, aucun vignoble AOC à
  // ≤ 50 km (Champagne ~150 km). Champ honnêtement vide.
  vignoblesProches: [],

  // ─── Couche 3 — Multi-taille TPE/PME/ETI/GE ─────────────────────────

  // Label EPV : sans source individuelle confirmée par entreprise
  // boulonnaise, champ vide pour respecter zéro invention. À compléter
  // en cross-référençant l'annuaire officiel data.economie.gouv.fr
  // (Phase 2 du sprint).
  labelsEpvEtArtisanat: [],

  zonesActivitesParcs: [
    {
      nom: "ZAC Île Seguin — Rives de Seine (12,3 ha ex-usines Renault, projet mixte culture/tertiaire/logement)",
      type: "zac",
      secteurDominant: "Culture / tertiaire / mixte",
      source: "https://fr.wikipedia.org/wiki/%C3%8Ele_Seguin",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Quartier du Pont-de-Sèvres / Trapèze (ZAC Renault Trapèze, 74 ha — quartier d'affaires nouvelle génération)",
      type: "zac",
      secteurDominant: "Tertiaire / siège Renault / mixte",
      source: "https://fr.wikipedia.org/wiki/Trap%C3%A8ze_(quartier)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Quai du Point-du-Jour (district média/finance — Tour TF1, Boursorama)",
      type: "district_eco",
      secteurDominant: "Audiovisuel / finance / médias",
      source: "https://fr.wikipedia.org/wiki/Boulogne-Billancourt",
      verifiedOn: "2026-05-18",
    },
  ],

  grandesEcolesEtUniversites: [
    {
      nom: "Pôle universitaire Léonard-de-Vinci (Léo-Da-Vinci) — Courbevoie/La Défense (~10 km, dans bassin Hauts-de-Seine) : EMLV (commerce), ESILV (ingénieur), IIM (numérique), ILV (formation continue) — ~10 000 étudiants",
      type: "autre",
      specialites: ["Commerce / management", "Ingénierie", "Numérique / digital", "Data / IA"],
      source: "https://fr.wikipedia.org/wiki/P%C3%B4le_universitaire_L%C3%A9onard-de-Vinci",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Université Paris Nanterre (~8 km, bassin Hauts-de-Seine)",
      type: "universite",
      specialites: ["Sciences humaines", "Droit", "Économie", "Sciences sociales"],
      source: "https://www.parisnanterre.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Université Paris-Dauphine PSL (Paris 16e, ~3 km — limitrophe Boulogne-Billancourt)",
      type: "universite",
      specialites: ["Économie", "Gestion", "Mathématiques de la décision", "Sciences sociales"],
      source: "https://dauphine.psl.eu/",
      verifiedOn: "2026-05-18",
    },
  ],

  // Pas d'antenne Inria/CEA/CNRS confirmée siège Boulogne-Billancourt.
  // Les centres parisiens proches (Inria Paris à 75013, CNRS siège 75016)
  // rayonnent sur le bassin mais ne sont pas à Boulogne. Champ omis
  // pour respecter zéro invention.

  grandsGroupesImplantes: [
    {
      nom: "Renault Group",
      secteur:
        "Automobile / mobilité (siège mondial historique depuis 1898 — Louis Renault y fonde l'entreprise)",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/Renault",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "TF1 Group (Groupe TF1)",
      secteur: "Média / audiovisuel / production",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/TF1_(cha%C3%AEne_de_t%C3%A9l%C3%A9vision)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Boursorama",
      secteur: "Banque en ligne / fintech (filiale Société Générale)",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/Boursorama",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Couche 2bis — tags KB sectorielles ─────────────────────────────
  // Volontairement vide en V1 : la KB Prisma ne contient pas encore
  // d'entries sectorielles dédiées (Phase B du sprint).
  kbSectorTags: ["automobile-mobilite", "communication-medias", "banque-finance"],

  // ─── Optionnels (hors scoring dashboard) ────────────────────────────
  capitaleFrenchTech: {
    statut: "communaute",
    nomChapitre: "French Tech Paris (Boulogne-Billancourt intégrée — bassin Paris-Région)",
    source: "https://lafrenchtech.com/",
    verifiedOn: "2026-05-18",
  },

  cciCompetente: {
    nom: "CCI Paris Île-de-France (délégation Hauts-de-Seine)",
    source: "https://www.cci-paris-idf.fr/",
    verifiedOn: "2026-05-18",
  },

  // distancesGrandesMetropoles : Boulogne-Billancourt est intra-Métropole
  // du Grand Paris (limitrophe Paris 16e — 4 km du centre). Elle EST la
  // métropole francilienne. Champ omis.

  // incubateursAccelerateurs : pas d'incubateur majeur confirmé avec
  // siège Boulogne-Billancourt (Station F est à Paris 13e, ~8 km).
  // Champ omis pour respecter zéro invention.

  // ─── Spécificités locales hors grille standard ──────────────────────
  specificitesLocales: [
    {
      theme: "berceau_renault_1898",
      description:
        "Berceau historique mondial de Renault : Louis Renault y conçoit sa première voiturette en 1898, fonde la Société Renault Frères le 25 février 1899 sur l'île Seguin — siège mondial Renault toujours à Boulogne-Billancourt.",
      source: "https://fr.wikipedia.org/wiki/Renault",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "hub_audiovisuel_majeur",
      description:
        "Hub audiovisuel majeur français : siège TF1 (Tour TF1, 1 quai du Point-du-Jour) — 1re chaîne privée française. Bassin médiatique élargi avec M6 limitrophe Neuilly et écosystème production/post-production quai du Point-du-Jour.",
      source: "https://fr.wikipedia.org/wiki/TF1_(cha%C3%AEne_de_t%C3%A9l%C3%A9vision)",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "patrimoine_industriel_ile_seguin",
      description:
        "Île Seguin (12,3 ha) : usines Renault de 1929 à 1992, plus grande usine automobile de France (>30 000 salariés au pic). Reconvertie depuis 2017 (La Seine Musicale), reste du site en projet culturel mixte 2025-2027.",
      source: "https://fr.wikipedia.org/wiki/%C3%8Ele_Seguin",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "musee_albert_kahn_unesco_2025",
      description:
        "Musée départemental Albert-Kahn : Archives de la Planète (72 000 autochromes + ~100h de film, 1909-1931) inscrites au Registre Mémoire du monde UNESCO en 2025 — plus grande collection d'autochromes au monde.",
      source: "https://albert-kahn.hauts-de-seine.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "1re_commune_france_hors_paris",
      description:
        "1re commune de France hors Paris par population (~120 000 hab) et 1re ville des Hauts-de-Seine. Densité d'établissements exceptionnelle (176 ‰), indice de concentration d'emploi 148,6 — pôle économique majeur de l'ouest parisien.",
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-92012",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Adaptations Boulogne-Billancourt (zéro invention) ──────────────
  // Commune ouest Paris en proche couronne : pas d'IGP/AOP propre
  // (commune urbaine sans production agricole) ni de vignoble AOC à
  // ≤ 50 km (Champagne ~150 km). Ces champs sont structurellement non
  // applicables, exemptés du scoring pour ne pas pénaliser injustement.
  notApplicableFields: ["produitsIgpAop", "vignoblesProches"],

  // ─── Métadonnées de revue ───────────────────────────────────────────
  lastReviewedOn: "2026-05-18",
  reviewedBy: "Claude Code Opus 4.7 (sprint City Quality V3 ville #31)",
};
