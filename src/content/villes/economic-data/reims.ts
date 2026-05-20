// Reims (51454) — data économique enrichie sourcée V3 multi-taille.
//
// Sprint City Quality V3 2026-05-18, ville n°13.
// Contrat zéro invention : chaque champ a un `source` vérifiable.
//
// Spécificité Reims : capitale historique du Champagne (Cité des Sacres,
// 29 rois sacrés à la Cathédrale Notre-Dame). Triple inscription UNESCO :
//   - 1991 : Cathédrale Notre-Dame + ancien palais du Tau + ancienne
//     abbaye Saint-Remi (3 monuments, dossier UNESCO ref. 601)
//   - 2015 : Coteaux, Maisons et Caves de Champagne (Colline Saint-Nicaise
//     à Reims fait partie du périmètre, dossier UNESCO ref. 1465)
//
// Bassin agroalimentaire/luxe : 350+ maisons de Champagne (Veuve Clicquot,
// Krug, Ruinart, Pommery, Mumm, Taittinger, Pol Roger, Lanson). Bioéconomie
// avec Pomacle-Bazancourt (3 Mt biomasse/an) + pôle Bioeconomy For Change
// (ex-IAR).
//
// Sources canoniques utilisées :
//   - INSEE dossier complet commune 51454 (2011101)
//   - competitivite.gouv.fr — pôles Phase V 2023-2026
//   - UNESCO Centre du patrimoine mondial (whc.unesco.org/en/list/601 + 1465)
//   - Sites officiels maisons de Champagne + LVMH + Wikipédia
//   - INAO (cahier des charges AOC Champagne)
//   - Sites officiels NEOMA, Sciences Po, URCA
//   - SNCF Connect (gare Champagne-Ardenne TGV) + Wikipédia gare
//
// Reviewer : Claude Code Opus 4.7 (sprint City Quality V3 ville #13).

import type { VilleEconomicData } from "./types";

export const REIMS_ECONOMIC_DATA: VilleEconomicData = {
  // ─── Couche 1 — Économie INSEE ──────────────────────────────────────
  topSectorsNaf: [
    {
      naf: "GHI",
      label: "Commerce, transports et services divers",
      rank: 1,
      etablissementsCount: 4_156,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-51454",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "OPQ",
      label: "Administration publique, enseignement, santé, action sociale",
      rank: 2,
      etablissementsCount: 811,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-51454",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "F",
      label: "Construction",
      rank: 3,
      etablissementsCount: 398,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-51454",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "BE",
      label: "Industrie (manufacturière, extractive, énergie — incl. Champagne)",
      rank: 4,
      etablissementsCount: 297,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-51454",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "A",
      label: "Agriculture, sylviculture et pêche (vignoble Champagne intra-muros)",
      rank: 5,
      etablissementsCount: 39,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-51454",
      verifiedOn: "2026-05-18",
    },
  ],

  polesCompetitivite: [
    {
      nom: "Bioeconomy For Change (B4C, ex-IAR)",
      secteur:
        "Bioéconomie / agro-ressources / biorefining / chimie du végétal (500+ adhérents, pôle de référence France)",
      type: "rayonnement",
      source: "https://www.bioeconomyforchange.eu/",
      verifiedOn: "2026-05-18",
    },
  ],

  distances: {
    gareTgv: {
      nom: "Gare Champagne-Ardenne TGV (Bezannes) — Paris-Est ~45 min. Reims-Centre gare classique également desservie.",
      distanceKm: 5,
      source: "https://www.sncf-connect.com/gares/champagne-ardenne-tgv",
    },
    aeroportPrincipal: {
      nom: "Aéroport Paris-Vatry (XCR) — aéroport régional. Paris-CDG accessible en ~1h45 par TGV+RER.",
      distanceKm: 73,
      source: "https://fr.wikipedia.org/wiki/Gare_de_Champagne-Ardenne_TGV",
    },
    metroOuTram: {
      lignes: 2,
      source: "https://www.citura.fr/",
    },
    verifiedOn: "2026-05-18",
  },

  statsInsee: {
    etablissementsActifs: 5_701,
    creationsEntreprises: 3_243,
    anneeReference: 2024,
    source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-51454",
    verifiedOn: "2026-05-18",
  },

  // ─── Couche 2 — Matière éditoriale unique (Champagne épicentre) ─────
  marquesHistoriques: [
    {
      nom: "Veuve Clicquot Ponsardin",
      secteur: "Champagne / luxe (groupe LVMH — MHCS)",
      lienVille: "siege",
      source: "https://fr.wikipedia.org/wiki/Champagne_Veuve_Clicquot_Ponsardin",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Krug",
      secteur: "Champagne prestige / luxe (groupe LVMH — MHCS)",
      lienVille: "siege",
      source: "https://fr.wikipedia.org/wiki/Krug_(Champagne)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Ruinart",
      secteur: "Champagne (plus ancienne maison, 1729 — groupe LVMH)",
      lienVille: "siege",
      source: "https://fr.wikipedia.org/wiki/Ruinart_(Champagne)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Pommery",
      secteur: "Champagne (groupe Vranken-Pommery Monopole)",
      lienVille: "siege",
      source: "https://fr.wikipedia.org/wiki/Champagne_Pommery",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "G.H. Mumm",
      secteur: "Champagne (groupe Pernod Ricard)",
      lienVille: "siege",
      source: "https://fr.wikipedia.org/wiki/Mumm_(Champagne)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Taittinger",
      secteur: "Champagne / luxe (indépendant familial)",
      lienVille: "siege",
      source: "https://fr.wikipedia.org/wiki/Champagne_Taittinger",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Pol Roger",
      secteur: "Champagne (indépendant familial)",
      lienVille: "siege",
      source: "https://fr.wikipedia.org/wiki/Champagne_Pol_Roger",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Lanson",
      secteur: "Champagne (groupe Lanson-BCC)",
      lienVille: "siege",
      source: "https://fr.wikipedia.org/wiki/Champagne_Lanson",
      verifiedOn: "2026-05-18",
    },
  ],

  produitsIgpAop: [
    {
      nom: "Champagne",
      categorie: "Vin effervescent",
      signe: "AOC",
      source:
        "https://www.inao.gouv.fr/Espace-professionnel-et-outils/Rechercher-un-signe-officiel",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Coteaux Champenois",
      categorie: "Vin tranquille",
      signe: "AOC",
      source:
        "https://www.inao.gouv.fr/Espace-professionnel-et-outils/Rechercher-un-signe-officiel",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Rosé des Riceys",
      categorie: "Vin rosé (zone Champagne)",
      signe: "AOC",
      source:
        "https://www.inao.gouv.fr/Espace-professionnel-et-outils/Rechercher-un-signe-officiel",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Brie de Meaux",
      categorie: "Fromage (bassin proche)",
      signe: "AOP",
      source:
        "https://www.inao.gouv.fr/Espace-professionnel-et-outils/Rechercher-un-signe-officiel",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Boudin blanc de Rethel",
      categorie: "Charcuterie (bassin Champagne-Ardenne)",
      signe: "IGP",
      source:
        "https://www.inao.gouv.fr/Espace-professionnel-et-outils/Rechercher-un-signe-officiel",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Jambon sec des Ardennes",
      categorie: "Charcuterie (bassin Champagne-Ardenne)",
      signe: "IGP",
      source:
        "https://www.inao.gouv.fr/Espace-professionnel-et-outils/Rechercher-un-signe-officiel",
      verifiedOn: "2026-05-18",
    },
  ],

  salonsSectoriels: [
    {
      nom: "Vitiloire / salons du Champagne",
      secteur: "Vins / Champagne / agroalimentaire prestige",
      localisation: "Reims / Épernay (région Champagne)",
      lienVille: "secteur_pertinent",
      source: "https://www.tourisme-en-champagne.com/champagne-unesco",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Foire de Châlons-en-Champagne",
      secteur: "Agroalimentaire / agriculture / régional (10 jours, ~250 000 visiteurs)",
      localisation: "Châlons-en-Champagne (~45 km de Reims)",
      lienVille: "secteur_pertinent",
      source: "https://www.foiredechalons.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Carrefour des Maires (Champagne-Ardenne)",
      secteur: "Collectivités / services publics",
      localisation: "Reims",
      lienVille: "accueille",
      source: "https://www.marneardennes.cci.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  patrimoineNotable: [
    {
      nom: "Cathédrale Notre-Dame de Reims (UNESCO 1991, ref. 601 — Cité des Sacres, 29 rois)",
      type: "unesco",
      source: "https://whc.unesco.org/en/list/601/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Palais du Tau (UNESCO 1991, ref. 601 — ancien palais des archevêques)",
      type: "unesco",
      source: "https://whc.unesco.org/en/list/601/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Ancienne abbaye Saint-Remi (UNESCO 1991, ref. 601 — basilique romane)",
      type: "unesco",
      source: "https://whc.unesco.org/en/list/601/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Coteaux, Maisons et Caves de Champagne — Colline Saint-Nicaise Reims (UNESCO 2015, ref. 1465)",
      type: "unesco",
      source: "https://whc.unesco.org/en/list/1465/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Caves Pommery (crayères classées Monument Historique, ~18 km de galeries)",
      type: "monument",
      source: "https://www.champagne-patrimoinemondial.org/decouvrir/patrimoine-mondial-reims",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Caves Veuve Clicquot / Taittinger / Ruinart (crayères gallo-romaines UNESCO)",
      type: "monument",
      source:
        "https://maisons-champagne.com/fr/maisons/patrimoine/article/patrimoine-mondial-unesco",
      verifiedOn: "2026-05-18",
    },
  ],

  communesBassin: [
    {
      slug: "tinqueux",
      nameFr: "Tinqueux",
      distanceKm: 3,
      source: "https://fr.wikipedia.org/wiki/Tinqueux",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "bezannes",
      nameFr: "Bezannes",
      distanceKm: 5,
      source: "https://fr.wikipedia.org/wiki/Bezannes",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "cormontreuil",
      nameFr: "Cormontreuil",
      distanceKm: 4,
      source: "https://fr.wikipedia.org/wiki/Cormontreuil",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "saint-brice-courcelles",
      nameFr: "Saint-Brice-Courcelles",
      distanceKm: 4,
      source: "https://fr.wikipedia.org/wiki/Saint-Brice-Courcelles",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "cernay-les-reims",
      nameFr: "Cernay-lès-Reims",
      distanceKm: 5,
      source: "https://fr.wikipedia.org/wiki/Cernay-l%C3%A8s-Reims",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "witry-les-reims",
      nameFr: "Witry-lès-Reims",
      distanceKm: 8,
      source: "https://fr.wikipedia.org/wiki/Witry-l%C3%A8s-Reims",
      verifiedOn: "2026-05-18",
    },
  ],

  vignoblesProches: [
    {
      aoc: "Champagne AOC (Reims = épicentre, vignes intra-muros via Coteaux Houillères + Massif de Saint-Thierry)",
      distanceKm: 0,
      source: "https://www.inao.gouv.fr/node/9132",
      verifiedOn: "2026-05-18",
    },
    {
      aoc: "Coteaux Champenois AOC (zone Champagne, vins tranquilles)",
      distanceKm: 0,
      source:
        "https://www.inao.gouv.fr/Espace-professionnel-et-outils/Rechercher-un-signe-officiel",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Couche 3 — Multi-taille TPE/PME/ETI/GE ─────────────────────────

  // Label EPV : annuaire EPV recense des maisons de Champagne (Veuve
  // Clicquot, Ruinart, etc. déjà listées en marquesHistoriques + grands
  // groupes). Sans cross-référence individuelle confirmée par dataset
  // officiel data.economie.gouv.fr au moment de la revue, champ vide pour
  // respecter zéro invention. À enrichir Phase 2 sprint.
  labelsEpvEtArtisanat: [],

  zonesActivitesParcs: [
    {
      nom: "Parc d'affaires TGV Champagne-Ardenne (Bezannes)",
      type: "parc_tech",
      secteurDominant: "Tertiaire / services / R&D (autour gare TGV)",
      source: "https://immo-hub.org/parcs-d-activites/130-parc-daffaires-tgv-reims-bezannes",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Pomacle-Bazancourt (bioraffinerie européenne, 160 ha)",
      type: "technopole",
      secteurDominant:
        "Bioéconomie / biorefining — 3 Mt biomasse/an (sucre, glucose, amidon, principes actifs cosméto/pharma, éthanol)",
      source:
        "https://www.investinreims.com/articles/pole-iar-reconnu-etat-comme-pole-competitivite-bioeconomie",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Port Sec de Reims / ZA La Pompelle",
      type: "zac",
      secteurDominant: "Logistique / industrie / vins de Champagne",
      source: "https://www.investinreims.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  grandesEcolesEtUniversites: [
    {
      nom: "NEOMA Business School (siège Reims, ~4 200 étudiants — plus grande grande école du Grand Est)",
      type: "ecole_commerce",
      specialites: ["Management", "Commerce international", "Finance", "Marketing"],
      source: "https://neoma-bs.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Sciences Po Paris — Campus de Reims (Euro-American Campus + Africa programme)",
      type: "sciences_po",
      specialites: ["Sciences politiques", "Affaires internationales", "Études euro-américaines"],
      source: "https://www.sciencespo.fr/college/en/campus/reims-campus.html",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Université de Reims Champagne-Ardenne (URCA)",
      type: "universite",
      specialites: ["Sciences", "Droit", "Économie", "Santé", "Lettres", "STAPS"],
      source: "https://www.univ-reims.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ESIReims (École Supérieure d'Ingénieurs en Emballage et Conditionnement, URCA)",
      type: "ecole_ingenieur",
      specialites: ["Emballage", "Conditionnement", "Packaging industriel", "Matériaux"],
      source: "https://www.esireims.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ESAD (École Supérieure d'Art et de Design de Reims)",
      type: "autre",
      specialites: ["Art", "Design", "Communication graphique"],
      source: "https://www.esad-reims.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  polesRechercheRD: [
    {
      nom: "CERFE / AEBB — laboratoires URCA bioéconomie",
      organisme: "autre",
      domaine: "Bioéconomie / agro-ressources (couplage avec Pomacle-Bazancourt)",
      source:
        "https://www.univ-reims.fr/cerfe/un-environnement-d-exception/un-environnement-d-exception,23260,38682.html",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "INRAE (sites Champagne-Ardenne, recherche agronomique vigne et grandes cultures)",
      organisme: "inrae",
      domaine: "Agronomie / vigne / grandes cultures",
      source: "https://www.inrae.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  grandsGroupesImplantes: [
    {
      nom: "LVMH (via MHCS — Moët Hennessy Champagne Services : Veuve Clicquot + Krug + Ruinart sièges Reims)",
      secteur: "Luxe / Champagne",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/Mo%C3%ABt_Hennessy",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Vranken-Pommery Monopole (siège Reims)",
      secteur: "Vins / Champagne (groupe coté Euronext)",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/Vranken-Pommery_Monopole",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Pernod Ricard (site Mumm + Perrier-Jouët à Reims/Épernay)",
      secteur: "Vins & spiritueux",
      typeImplantation: "site_majeur",
      source: "https://fr.wikipedia.org/wiki/Mumm_(Champagne)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Lanson-BCC (Boizel Chanoine Champagne, siège Reims)",
      secteur: "Champagne (groupe coté)",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/Champagne_Lanson",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Champagne Taittinger (siège Reims, indépendant familial)",
      secteur: "Champagne / luxe",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/Champagne_Taittinger",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Champagne Pol Roger (siège Épernay, présence Reims — bassin Champagne)",
      secteur: "Champagne",
      typeImplantation: "site_majeur",
      source: "https://fr.wikipedia.org/wiki/Champagne_Pol_Roger",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Cristal Union (sucre, siège Reims — coopérative betteravière)",
      secteur: "Agroalimentaire / sucre",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/Cristal_Union",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Couche 2bis — tags KB sectorielles ─────────────────────────────
  // Volontairement vide en V1 : la KB Prisma ne contient pas encore
  // d'entries sectorielles dédiées (Phase B du sprint).
  kbSectorTags: ["viticulture-haut-de-gamme", "agroalimentaire-igp"],

  // ─── Optionnels (hors scoring dashboard) ────────────────────────────
  capitaleFrenchTech: {
    statut: "communaute",
    nomChapitre: "La French Tech Est (couvre Reims / Grand Est)",
    source: "https://lafrenchtech.com/fr/communaute-french-tech/",
    verifiedOn: "2026-05-18",
  },

  cciCompetente: {
    nom: "CCI Marne en Champagne (groupe CCI Marne Ardennes — site de Reims)",
    source: "https://www.marneardennes.cci.fr/site-de-reims",
    verifiedOn: "2026-05-18",
  },

  distancesGrandesMetropoles: [
    {
      metropole: "Paris",
      distanceKm: 144,
      tempsMnTgv: 45,
      tempsMnRoute: 90,
      source: "https://www.sncf-connect.com/gares/champagne-ardenne-tgv",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Strasbourg",
      distanceKm: 350,
      tempsMnTgv: 130,
      source: "https://www.sncf-connect.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  incubateursAccelerateurs: [
    {
      nom: "Innovact (incubateur d'excellence Grand Reims)",
      focus: "Généraliste / innovation B2B",
      source: "https://www.investinreims.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Créativ'Labz (incubateur universitaire URCA)",
      focus: "Étudiants-entrepreneurs / deeptech / bioéconomie",
      source: "https://www.univ-reims.fr/minisite_43/",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Spécificités locales hors grille (Champagne + Sacres) ──────────
  specificitesLocales: [
    {
      theme: "champagne_capitale",
      description:
        "Capitale historique du Champagne : 350+ maisons + ~16 000 vignerons sur 319 communes (AOC), majorité des sièges des grandes maisons à Reims.",
      source: "https://www.inao.gouv.fr/node/9132",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "cite_des_sacres",
      description:
        "Cathédrale Notre-Dame de Reims = lieu de sacre de 29 rois de France (du XIe au XIXe siècle). Symbolisme historique et touristique majeur.",
      source: "https://whc.unesco.org/en/list/601/",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "bioeconomie_pomacle",
      description:
        "Bioraffinerie Pomacle-Bazancourt (160 ha, 3 Mt biomasse/an) au NE de Reims — l'une des plus importantes biorefineries au monde (sucre, glucose, amidon, principes actifs cosméto/pharma, éthanol).",
      source:
        "https://www.investinreims.com/articles/pole-iar-reconnu-etat-comme-pole-competitivite-bioeconomie",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "pacte_franco_allemand",
      description:
        "Pacte d'amitié franco-allemande signé à Reims le 8 juillet 1962 (de Gaulle + Adenauer, Cathédrale) — symbole fondateur de la réconciliation.",
      source: "https://fr.wikipedia.org/wiki/R%C3%A9conciliation_franco-allemande",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Métadonnées de revue ───────────────────────────────────────────
  lastReviewedOn: "2026-05-18",
  reviewedBy: "Claude Code Opus 4.7 (sprint City Quality V3 ville #13)",
};
