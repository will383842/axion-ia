// Argenteuil (95018) — data économique enrichie sourcée V3 multi-taille.
//
// Sprint City Quality V3 2026-05-18, ville n°37.
// Contrat zéro invention : chaque champ a un `source` vérifiable.
//
// Sources canoniques utilisées :
//   - INSEE dossier complet commune 95018 (2011101)
//   - competitivite.gouv.fr — pôles Phase V 2023-2026
//   - dassault-aviation.com (histoire site Argenteuil)
//   - Wikipédia articles (Tunique d'Argenteuil, Asperge d'Argenteuil, Basilique
//     Saint-Denys, Argenteuil commune, Louis Lhérault)
//   - valdoise-tourisme.com (Maison Impressionniste Claude Monet)
//   - cci-paris-idf.fr (CCI Val-d'Oise)
//   - SNCF Transilien (gare Argenteuil ligne J)
//
// Profil ville : 3e ville d'Île-de-France hors Paris (~107 000 hab, RP 2022),
// préfecture du Val-d'Oise rayonnante en boucle de Seine. Berceau de
// l'Impressionnisme (Claude Monet y peint 156 toiles entre 1871-1878,
// Renoir/Manet/Caillebotte/Morisot y séjournent), site historique Dassault
// Aviation (1952-2025, fabrication des fuselages Mystère, Mirage, Rafale,
// Falcon, relocalisé à Cergy-Pontoise en 2025), basilique Saint-Denys qui
// conserve la Sainte Tunique du Christ (relique selon tradition offerte par
// Charlemagne). Héritage horticole "Asperge d'Argenteuil" (variété créée
// par Louis Lhérault en 1860, renommée internationale). Pas de pôle propre,
// rattachement aux pôles francilians Cap Digital + Mov'eo. Pas de grande
// école intra-muros (proximité Paris). Pas d'IGP/AOP propre ni de vignoble
// AOC ≤ 50 km — exempté du scoring via notApplicableFields.
//
// Reviewer : Claude Code Opus 4.7 (sprint City Quality V3 ville #37).

import type { VilleEconomicData } from "./types";

export const ARGENTEUIL_ECONOMIC_DATA: VilleEconomicData = {
  // ─── Couche 1 — Économie INSEE ──────────────────────────────────────
  topSectorsNaf: [
    {
      naf: "GHI",
      label:
        "Commerce, transports, hébergement et restauration (sections G+H+I) — 61,9 % des établissements",
      rank: 1,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-95018",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "F",
      label: "Construction (section F) — 23,6 % des établissements",
      rank: 2,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-95018",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "OPQ",
      label:
        "Administration publique, enseignement, santé, action sociale (sections O+P+Q) — 8,8 % des établissements",
      rank: 3,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-95018",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "BCDE",
      label:
        "Industrie manufacturière + énergie + eau (sections B+C+D+E) — 5,4 % des établissements (héritage Dassault Aviation jusqu'en 2025)",
      rank: 4,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-95018",
      verifiedOn: "2026-05-18",
    },
  ],

  polesCompetitivite: [
    {
      nom: "Cap Digital Paris-Région",
      secteur: "Numérique / IA / transformation digitale (rayonnement Île-de-France)",
      type: "rayonnement",
      source: "https://www.capdigital.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Mov'eo",
      secteur: "Mobilité / automobile / aéronautique (rayonnement Île-de-France/Normandie)",
      type: "rayonnement",
      source: "https://pole-moveo.org/",
      verifiedOn: "2026-05-18",
    },
  ],

  distances: {
    gareTgv: {
      nom: "Gare Saint-Lazare (Paris) — TGV Normandie ; depuis gare d'Argenteuil ligne J Transilien ~12 min",
      distanceKm: 11,
      source: "https://www.sncf-connect.com/gares/paris-saint-lazare",
    },
    aeroportPrincipal: {
      nom: "Paris-Charles de Gaulle (CDG)",
      distanceKm: 30,
      source: "https://www.parisaeroport.fr/",
    },
    metroOuTram: {
      // Pas de métro intra-muros. Gare d'Argenteuil = Transilien ligne J
      // (Paris Saint-Lazare ↔ Mantes-la-Jolie / Pontoise / Ermont-Eaubonne) +
      // tramway T11 dessert Épinay-sur-Seine voisine. Comptage strict des
      // lignes ferroviaires lourdes intra-commune.
      lignes: 1,
      source: "https://www.transilien.com/fr/page-lignes/ligne-j",
    },
    verifiedOn: "2026-05-18",
  },

  statsInsee: {
    etablissementsActifs: 9_045,
    creationsEntreprises: 2_690,
    densiteEtablissementsPour1000: 82,
    anneeReference: 2024,
    source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-95018",
    verifiedOn: "2026-05-18",
  },

  // ─── Couche 2 — Matière éditoriale unique ───────────────────────────
  marquesHistoriques: [
    {
      nom: "Dassault Aviation — site historique Argenteuil (1952-2025)",
      secteur: "Aéronautique / fabrication de fuselages militaires et civils",
      lienVille: "production",
      source: "https://www.dassault-aviation.com/en/passion/history/sites/argenteuil/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Asperge d'Argenteuil (variété Louis Lhérault, 1860)",
      secteur: "Horticulture / patrimoine maraîcher",
      lienVille: "fondation",
      source: "https://fr.wikipedia.org/wiki/Asperge_d%27Argenteuil",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Lorraine-Dietrich (usine automobile historique, 1907-1951)",
      secteur: "Automobile / moteurs d'aviation (héritage industriel)",
      lienVille: "heritage",
      source: "https://www.dassault-aviation.com/en/passion/history/sites/argenteuil/",
      verifiedOn: "2026-05-18",
    },
  ],

  // Argenteuil n'a pas d'IGP/AOP propre actif. L'Asperge d'Argenteuil est
  // une variété historique horticole (1860) mais ne dispose pas d'un signe
  // officiel de qualité INAO. Champ honnêtement vide. Vérification :
  // https://www.inao.gouv.fr/Espace-professionnel-et-outils/Rechercher-un-signe-officiel
  produitsIgpAop: [],

  salonsSectoriels: [
    {
      nom: "VivaTech",
      secteur: "Innovation / tech / startups (écosystème Cap Digital Paris-Région)",
      localisation: "Paris Expo Porte de Versailles",
      lienVille: "secteur_pertinent",
      source: "https://vivatechnology.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Salon du Bourget (Paris Air Show)",
      secteur: "Aéronautique / défense (héritage Dassault Aviation Argenteuil)",
      localisation: "Le Bourget (Seine-Saint-Denis)",
      lienVille: "secteur_pertinent",
      source: "https://www.siae.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Salon des Maires et des Collectivités Locales",
      secteur: "Secteur public local / collectivités",
      localisation: "Paris Expo Porte de Versailles",
      lienVille: "secteur_pertinent",
      source: "https://www.salondesmaires.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  patrimoineNotable: [
    {
      nom: "Basilique Saint-Denys d'Argenteuil (Sainte Tunique du Christ)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Basilique_Saint-Denys_d%27Argenteuil",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Maison Impressionniste Claude Monet (Monet y vécut 1871-1878, 156 toiles peintes)",
      type: "musee",
      source:
        "https://www.valdoise-tourisme.com/les-incontournables/la-maison-impressionniste-claude-monet-a-argenteuil/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Tunique d'Argenteuil (relique conservée — tradition Charlemagne)",
      type: "autre",
      source: "https://fr.wikipedia.org/wiki/Tunique_d%27Argenteuil",
      verifiedOn: "2026-05-18",
    },
  ],

  communesBassin: [
    {
      slug: "cormeilles-en-parisis",
      nameFr: "Cormeilles-en-Parisis",
      distanceKm: 4,
      source: "https://fr.wikipedia.org/wiki/Cormeilles-en-Parisis",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "bezons",
      nameFr: "Bezons",
      distanceKm: 3,
      source: "https://fr.wikipedia.org/wiki/Bezons",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "sannois",
      nameFr: "Sannois",
      distanceKm: 3,
      source: "https://fr.wikipedia.org/wiki/Sannois",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "sartrouville",
      nameFr: "Sartrouville",
      distanceKm: 5,
      source: "https://fr.wikipedia.org/wiki/Sartrouville",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "houilles",
      nameFr: "Houilles",
      distanceKm: 4,
      source: "https://fr.wikipedia.org/wiki/Houilles",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "colombes",
      nameFr: "Colombes",
      distanceKm: 5,
      source: "https://fr.wikipedia.org/wiki/Colombes",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "bois-colombes",
      nameFr: "Bois-Colombes",
      distanceKm: 6,
      source: "https://fr.wikipedia.org/wiki/Bois-Colombes",
      verifiedOn: "2026-05-18",
    },
  ],

  // Argenteuil (banlieue nord-ouest Paris, boucle de Seine) n'a pas de
  // vignoble AOC à ≤ 50 km. Champagne ~140 km, Sancerre ~200 km, Chablis
  // ~180 km. Vignobles historiques d'Argenteuil disparus au XIXe (phylloxéra
  // + urbanisation), hors AOC. Champ honnêtement vide.
  vignoblesProches: [],

  // ─── Couche 3 — Multi-taille PME/ETI/GE ─────────────────────────

  // Annuaire EPV national consultable :
  // https://data.economie.gouv.fr/explore/dataset/entreprises-du-patrimoine-vivant-epv
  // Aucune entreprise EPV Argenteuil source-vérifiée à ce jour — champ vide
  // pour respecter zéro invention. À compléter par extraction CSV ciblée.
  labelsEpvEtArtisanat: [],

  zonesActivitesParcs: [
    {
      nom: "Parc d'activités du Val d'Argent (Argenteuil)",
      type: "parc_tech",
      secteurDominant: "Industrie / logistique / services tertiaires",
      source: "https://fr.wikipedia.org/wiki/Argenteuil_(Val-d%27Oise)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Site historique Dassault Aviation (1 avenue du Parc — relocalisé Cergy 2025)",
      type: "district_eco",
      secteurDominant: "Aéronautique / industrie (reconversion urbaine en cours)",
      source: "https://www.dassault-aviation.com/en/passion/history/sites/argenteuil/",
      verifiedOn: "2026-05-18",
    },
  ],

  // Pas de grande école ni d'université majeure intra-muros à Argenteuil
  // (proximité Paris ~10 km absorbe l'offre — Sorbonne, Cnam, Paris-Dauphine).
  // Antennes IUT ou CFA non source-vérifiées. Champ honnêtement vide.
  grandesEcolesEtUniversites: [],

  // Pas de centre Inria/CEA/CNRS implanté directement à Argenteuil source-
  // vérifié. Inria Paris Centre (75013, ~15 km) et CEA Saclay (~35 km)
  // rayonnent sur le bassin. Champ honnêtement vide.
  polesRechercheRD: [],

  grandsGroupesImplantes: [
    {
      nom: "(Site historique, fermé 2025) Dassault Aviation — site historique Argenteuil (1952-2025, fuselages Mystère/Mirage/Rafale/Falcon, relocalisé Cergy-Pontoise 2025)",
      secteur: "Aéronautique / défense",
      typeImplantation: "heritage",
      source: "https://www.dassault-aviation.com/en/passion/history/sites/argenteuil/",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Couche 2bis — tags KB sectorielles ─────────────────────────────
  // Volontairement vide en V1 : la KB Prisma ne contient pas encore
  // d'entries sectorielles dédiées (Phase B du sprint).
  kbSectorTags: ["construction-btp", "automobile-mobilite", "it-numerique"],

  // ─── Optionnels (hors scoring dashboard) ────────────────────────────
  // Pas de chapitre French Tech autonome pour Argenteuil ; rattachement
  // implicite à French Tech Paris / Grand Paris.
  capitaleFrenchTech: {
    statut: "communaute",
    nomChapitre: "French Tech Paris (rayonnement Grand Paris, Cap Digital)",
    source: "https://lafrenchtech.com/",
    verifiedOn: "2026-05-18",
  },

  cciCompetente: {
    nom: "CCI Val-d'Oise (délégation territoriale CCI Paris Île-de-France)",
    source: "https://www.cci-paris-idf.fr/fr/cci/cci-val-doise",
    verifiedOn: "2026-05-18",
  },

  // Argenteuil est dans la Métropole du Grand Paris — distancesGrandesMetropoles
  // N/A (Paris EST la métropole, ~11 km, déjà couverte via gareTgv/aéroport).

  incubateursAccelerateurs: [],

  // ─── Adaptations Argenteuil (zéro invention) ────────────────────────
  // Argenteuil (banlieue nord-ouest Paris, Val-d'Oise) n'a pas d'IGP/AOP
  // propre actif (l'Asperge d'Argenteuil est une variété historique sans
  // signe INAO) ni de vignoble AOC à ≤ 50 km (Champagne ~140 km). Ces
  // champs sont structurellement non applicables, exemptés du scoring
  // pour ne pas pénaliser la ville.
  notApplicableFields: ["produitsIgpAop", "vignoblesProches"],

  specificitesLocales: [
    {
      theme: "berceau_impressionnisme",
      description:
        "Claude Monet y vécut 1871-1878 et y peignit 156 toiles (sur 256 de la période) ; Manet, Renoir, Caillebotte et Morisot y séjournèrent. Héritage culturel majeur.",
      source:
        "https://www.valdoise-tourisme.com/les-incontournables/la-maison-impressionniste-claude-monet-a-argenteuil/",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "relique_sainte_tunique_christ",
      description:
        "La Basilique Saint-Denys conserve la Tunique d'Argenteuil, relique de la tunique sans couture du Christ selon tradition (offerte par Charlemagne à l'abbaye, première mention 1156, ostentations périodiques).",
      source: "https://fr.wikipedia.org/wiki/Tunique_d%27Argenteuil",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "site_industriel_dassault_aviation",
      description:
        "Site historique Dassault Aviation (1952-2025) — fabrication fuselages Mystère IV, Mirage III/IV/F-1/2000, Rafale, Falcon 900 ; 7 000e fuselage en 1996. Relocalisation à Cergy-Pontoise en 2025.",
      source: "https://www.dassault-aviation.com/en/passion/history/sites/argenteuil/",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "3e_ville_idf_hors_paris",
      description:
        "3e ville d'Île-de-France hors Paris (~107 135 hab RP 2022), commune principale de la communauté d'agglomération Argenteuil-Bezons puis intégrée à la Métropole du Grand Paris.",
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-95018",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "patrimoine_horticole_asperge",
      description:
        "Variété « Asperge d'Argenteuil » créée par Louis Lhérault en 1860, renommée internationale (médailles aux Expositions universelles), souche d'origine des variétés américaines « Mary Washington » et « Martha Washington ».",
      source: "https://fr.wikipedia.org/wiki/Asperge_d%27Argenteuil",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Métadonnées de revue ───────────────────────────────────────────
  lastReviewedOn: "2026-05-18",
  reviewedBy: "Claude Code Opus 4.7 (sprint City Quality V3 ville #37)",
};
