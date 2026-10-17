// Annecy (74010) — data économique enrichie sourcée V3 multi-taille.
//
// Sprint City Quality V3 ville #27 — 2026-05-18.
// Contrat zéro invention : chaque champ a un `source` vérifiable.
//
// Sources canoniques utilisées :
//   - INSEE dossier complet commune 74010 (2011101)
//   - competitivite.gouv.fr + sites officiels pôles (mont-blanc-industries.com,
//     outdoorsportsvalley.org)
//   - INAO (Reblochon AOP, Tomme de Savoie IGP, Abondance AOP, Beaufort AOP,
//     Chevrotin AOP)
//   - Sites officiels écoles (univ-smb.fr, polytech.univ-smb.fr,
//     sciencespo-grenoble.fr/antenne-annecy, iut-annecy.univ-smb.fr)
//   - Sites officiels groupes (salomon.com, mavic.com, se.com/fr,
//     groupeseb.com/fr, amer-sports.com)
//   - Wikipédia (Palais de l'Île, Château d'Annecy, communes fusionnées 2017,
//     marques Mavic/Salomon/Fournier/Dynastar)
//   - Salons : annecyfestival.com (Festival international du film d'animation)
//   - lafrenchtech.com (chapitre French Tech in The Alps - Annecy)
//   - SNCF Connect (gare Annecy) + geneveaeroport.ch (GVA) + lyonaeroports.com
//
// Direction : bassin outdoor/montagne (Salomon, Mavic, Fournier, Dynastar),
// transfrontalier Suisse (Genève 40 km), capitale mondiale animation (Festival
// référence), mécanique de précision (Mont-Blanc Industries siège), AOP/IGP
// fromages savoyards (Reblochon, Tomme, Abondance, Beaufort, Chevrotin),
// French Tech in The Alps, JO Alpes 2030 retenue. B2B-pertinent fort.
//
// Reviewer : Claude Code Opus 4.7 (sprint City Quality V3 ville #27).

import type { VilleEconomicData } from "./types";

export const ANNECY_ECONOMIC_DATA: VilleEconomicData = {
  // ─── Couche 1 — Économie INSEE ──────────────────────────────────────
  topSectorsNaf: [
    {
      naf: "GHIJKLMN",
      label: "Commerce, transports, services divers (sections G+H+I+J+K+L+M+N)",
      rank: 1,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-74010",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "OPQ",
      label: "Administration publique, enseignement, santé, action sociale (sections O+P+Q)",
      rank: 2,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-74010",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "F",
      label: "Construction (section F)",
      rank: 3,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-74010",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "BCDE",
      label: "Industrie (sections B+C+D+E — manufacturière, énergie, eau, déchets)",
      rank: 4,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-74010",
      verifiedOn: "2026-05-18",
    },
  ],

  polesCompetitivite: [
    {
      nom: "Mont-Blanc Industries",
      secteur:
        "Mécanique de précision / décolletage / mécatronique / fabrication additive (siège Annecy — bassin Vallée de l'Arve)",
      type: "siege",
      source: "https://www.mont-blanc-industries.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Outdoor Sports Valley (OSV)",
      secteur:
        "Sports outdoor / montagne / équipementiers / cluster industries du sport (siège Annecy)",
      type: "siege",
      source: "https://www.outdoorsportsvalley.org/",
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
      nom: "Gare d'Annecy (TGV direct Paris ~3 h 45 via Bellegarde, liaisons Lyon, Genève, Saint-Gervais)",
      distanceKm: 0,
      source: "https://www.sncf-connect.com/gares/annecy",
    },
    aeroportPrincipal: {
      nom: "Genève-Cointrin (GVA) — Lyon-Saint-Exupéry (LYS) en complément à 140 km, Annecy-Mont-Blanc (NCY) aviation d'affaires uniquement",
      distanceKm: 40,
      source: "https://www.gva.ch/en/Site/Aeroport/Liaisons/Liaisons-routieres",
    },
    verifiedOn: "2026-05-18",
  },

  statsInsee: {
    anneeReference: 2023,
    source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-74010",
    verifiedOn: "2026-05-18",
  },

  // ─── Couche 2 — Matière éditoriale unique ───────────────────────────
  marquesHistoriques: [
    {
      nom: "Salomon",
      secteur: "Sports outdoor / ski / chaussures / textile montagne",
      lienVille: "fondation",
      source: "https://fr.wikipedia.org/wiki/Salomon_(entreprise)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Mavic",
      secteur: "Cyclisme / roues et composants haut de gamme",
      lienVille: "siege",
      source: "https://fr.wikipedia.org/wiki/Mavic",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Fournier (Skis Fournier / Rossignol-Fournier)",
      secteur: "Skis / sports d'hiver (héritage Annecy / Haute-Savoie)",
      lienVille: "heritage",
      source: "https://fr.wikipedia.org/wiki/Skis_Fournier",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Dynastar",
      secteur: "Skis / sports d'hiver (bassin Sallanches 70 km, écosystème Annecy)",
      lienVille: "production",
      source: "https://fr.wikipedia.org/wiki/Dynastar",
      verifiedOn: "2026-05-18",
    },
  ],

  produitsIgpAop: [
    {
      nom: "Reblochon",
      categorie: "fromage",
      signe: "AOP",
      source: "https://www.inao.gouv.fr/produit/3268",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Tomme de Savoie",
      categorie: "fromage",
      signe: "IGP",
      source: "https://www.inao.gouv.fr/produit/6595",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Abondance",
      categorie: "fromage",
      signe: "AOP",
      source: "https://www.inao.gouv.fr/produit/3186",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Beaufort",
      categorie: "fromage",
      signe: "AOP",
      source: "https://www.inao.gouv.fr/produit/3198",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Chevrotin",
      categorie: "fromage",
      signe: "AOP",
      source: "https://www.inao.gouv.fr/produit/3209",
      verifiedOn: "2026-05-18",
    },
  ],

  salonsSectoriels: [
    {
      nom: "Festival international du film d'animation d'Annecy",
      secteur: "Animation / audiovisuel / industries créatives (référence mondiale)",
      localisation: "Annecy (Bonlieu + Impérial Palace)",
      lienVille: "accueille",
      source: "https://www.annecyfestival.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Mifa (Marché international du film d'animation)",
      secteur: "Marché B2B animation / production / distribution",
      localisation: "Annecy (couplé au Festival)",
      lienVille: "accueille",
      source: "https://www.annecyfestival.com/mifa",
      verifiedOn: "2026-05-18",
    },
  ],

  patrimoineNotable: [
    {
      nom: "Palais de l'Île (XIIème siècle, emblème d'Annecy)",
      type: "monument",
      source: "https://musees.annecy.fr/Musee-Chateau-Palais-de-l-Ile",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Château d'Annecy (Musée-Château)",
      type: "musee",
      source: "https://musees.annecy.fr/Musee-Chateau-Palais-de-l-Ile",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Vieille Ville d'Annecy (canaux du Thiou, secteur sauvegardé)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Annecy",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Pont des Amours (passerelle Belle Époque, jardin de l'Europe)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Pont_des_Amours",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Cathédrale Saint-Pierre d'Annecy",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Cath%C3%A9drale_Saint-Pierre_d%27Annecy",
      verifiedOn: "2026-05-18",
    },
  ],

  communesBassin: [
    {
      slug: "annecy-le-vieux",
      nameFr: "Annecy-le-Vieux (commune déléguée — fusionnée 2017)",
      distanceKm: 3,
      source: "https://fr.wikipedia.org/wiki/Annecy-le-Vieux",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "cran-gevrier",
      nameFr: "Cran-Gevrier (commune déléguée — fusionnée 2017)",
      distanceKm: 3,
      source: "https://fr.wikipedia.org/wiki/Cran-Gevrier",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "meythet",
      nameFr: "Meythet (commune déléguée — fusionnée 2017)",
      distanceKm: 4,
      source: "https://fr.wikipedia.org/wiki/Meythet",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "pringy",
      nameFr: "Pringy (commune déléguée — fusionnée 2017)",
      distanceKm: 6,
      source: "https://fr.wikipedia.org/wiki/Pringy_(Haute-Savoie)",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "seynod",
      nameFr: "Seynod (commune déléguée — fusionnée 2017)",
      distanceKm: 4,
      source: "https://fr.wikipedia.org/wiki/Seynod",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "rumilly",
      nameFr: "Rumilly (Tefal / Groupe SEB)",
      distanceKm: 20,
      source: "https://fr.wikipedia.org/wiki/Rumilly_(Haute-Savoie)",
      verifiedOn: "2026-05-18",
    },
  ],

  vignoblesProches: [
    {
      aoc: "Vin de Savoie AOC (cépages Jacquère, Mondeuse — crus Apremont, Abymes, Chignin)",
      distanceKm: 40,
      source: "https://www.inao.gouv.fr/produit/3478",
      verifiedOn: "2026-05-18",
    },
    {
      aoc: "Roussette de Savoie AOC",
      distanceKm: 40,
      source: "https://www.inao.gouv.fr/produit/3477",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Couche 3 — Multi-taille TPE/PME/ETI/GE ─────────────────────────

  // Label EPV : pas de liste consolidée publique par ville sans extraction
  // dataset officiel. Champ vide en V1 pour respecter zéro invention. À
  // compléter Phase 2 du sprint via data.economie.gouv.fr.
  labelsEpvEtArtisanat: [],

  zonesActivitesParcs: [
    {
      nom: "Parc d'activités des Glaisins (Annecy-le-Vieux)",
      type: "parc_tech",
      secteurDominant: "Tertiaire / tech / R&D (siège Salomon, Mavic historique)",
      source: "https://fr.wikipedia.org/wiki/Annecy-le-Vieux",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Zone d'activités Altaïs (Chavanod, Grand Annecy)",
      type: "parc_tech",
      secteurDominant: "Industrie / services / tertiaire supérieur",
      source: "https://fr.wikipedia.org/wiki/Chavanod",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Zone industrielle de Vovray (Annecy sud)",
      type: "zac",
      secteurDominant: "Industrie / artisanat / logistique",
      source: "https://fr.wikipedia.org/wiki/Annecy",
      verifiedOn: "2026-05-18",
    },
  ],

  grandesEcolesEtUniversites: [
    {
      nom: "Université Savoie Mont-Blanc (USMB) — campus Annecy-le-Vieux",
      type: "universite",
      specialites: ["Sciences", "Lettres", "Droit", "STAPS", "Économie-gestion"],
      source: "https://www.univ-smb.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Polytech Annecy-Chambéry (école d'ingénieurs USMB)",
      type: "ecole_ingenieur",
      specialites: [
        "Mécanique-matériaux",
        "Mécatronique",
        "Énergie-bâtiment",
        "Informatique / instrumentation",
      ],
      source: "https://www.polytech.univ-smb.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "IUT d'Annecy (USMB)",
      type: "iut",
      specialites: ["GEII", "GMP", "QLIO", "TC", "MMI"],
      source: "https://www.iut-annecy.univ-smb.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Sciences Po Grenoble — Antenne d'Annecy",
      type: "sciences_po",
      specialites: ["Sciences politiques", "Affaires publiques", "Études européennes"],
      source: "https://www.sciencespo-grenoble.fr/formations/antenne-dannecy/",
      verifiedOn: "2026-05-18",
    },
  ],

  polesRechercheRD: [
    {
      nom: "LISTIC (Laboratoire d'Informatique, Systèmes, Traitement de l'Information et de la Connaissance — USMB Annecy)",
      organisme: "autre",
      domaine: "Informatique / IA / vision / traitement d'images / fusion d'information",
      source: "https://www.univ-smb.fr/listic/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "SYMME (Systèmes et Matériaux pour la Mécatronique — USMB Annecy)",
      organisme: "autre",
      domaine: "Mécatronique / matériaux / mécanique de précision",
      source: "https://www.univ-smb.fr/symme/",
      verifiedOn: "2026-05-18",
    },
  ],

  grandsGroupesImplantes: [
    {
      nom: "Salomon (groupe Amer Sports / Anta)",
      secteur: "Sports outdoor / ski / chaussures (siège historique Annecy-le-Vieux)",
      typeImplantation: "siege_social",
      source: "https://www.salomon.com/fr-fr",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Mavic",
      secteur: "Cyclisme / roues haut de gamme (siège Annecy)",
      typeImplantation: "siege_social",
      source: "https://www.mavic.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Schneider Electric (site Le Fayet / bassin annécien)",
      secteur: "Gestion de l'énergie / automatisation industrielle",
      typeImplantation: "site_majeur",
      source: "https://www.se.com/fr/fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Tefal (Groupe SEB) — Rumilly à 20 km",
      secteur: "Petit électroménager / articles culinaires",
      typeImplantation: "usine_principale",
      source: "https://www.groupeseb.com/fr",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Amer Sports (groupe propriétaire Salomon)",
      secteur: "Sports outdoor / multi-marques",
      typeImplantation: "site_majeur",
      source: "https://www.amer-sports.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Couche 2bis — tags KB sectorielles ─────────────────────────────
  // Volontairement vide en V1 : la KB Prisma ne contient pas encore
  // d'entries sectorielles dédiées (Phase B du sprint).
  kbSectorTags: [
    "mecanique-precision",
    "industrie-manufacturiere",
    "arts-creatif-design",
    "agroalimentaire-igp",
  ],

  // ─── Optionnels (hors scoring dashboard) ────────────────────────────
  capitaleFrenchTech: {
    statut: "communaute",
    nomChapitre: "French Tech in The Alps - Annecy",
    source: "https://lafrenchtech.com/fr/communaute-french-tech/french-tech-in-the-alps/",
    verifiedOn: "2026-05-18",
  },

  cciCompetente: {
    nom: "CCI Haute-Savoie",
    source: "https://www.haute-savoie.cci.fr/",
    verifiedOn: "2026-05-18",
  },

  distancesGrandesMetropoles: [
    {
      metropole: "Genève (Suisse)",
      distanceKm: 40,
      tempsMnRoute: 45,
      source: "https://www.geneve-tourisme.ch/fr/",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Lyon",
      distanceKm: 140,
      tempsMnTgv: 120,
      tempsMnRoute: 110,
      source: "https://www.sncf-connect.com/gares/annecy",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Chambéry",
      distanceKm: 50,
      tempsMnTgv: 30,
      tempsMnRoute: 45,
      source: "https://www.sncf-connect.com/gares/annecy",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Paris",
      distanceKm: 540,
      tempsMnTgv: 225,
      source: "https://www.sncf-connect.com/gares/annecy",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Spécificités locales hors grille standard ──────────────────────
  specificitesLocales: [
    {
      theme: "transfrontalier_suisse",
      description:
        "Bassin transfrontalier Suisse : Genève à 40 km, ~30 000 travailleurs frontaliers du bassin annécien, accord franco-suisse fiscalité et sécurité sociale.",
      source: "https://www.geneve-tourisme.ch/fr/",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "capitale_mondiale_animation",
      description:
        "Capitale mondiale du film d'animation : Festival international d'Annecy (créé 1960) + Mifa, première foire mondiale du secteur animation/VFX.",
      source: "https://www.annecyfestival.com/",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "candidature_jo_alpes_2030",
      description:
        "Alpes françaises retenues pour les Jeux Olympiques d'hiver 2030 (CIO juillet 2024) — Annecy et bassin Haute-Savoie partie prenante.",
      source: "https://fr.wikipedia.org/wiki/Jeux_olympiques_d%27hiver_de_2030",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "fusion_communes_2017",
      description:
        "Commune nouvelle d'Annecy créée 1er janvier 2017 par fusion d'Annecy + Annecy-le-Vieux + Cran-Gevrier + Meythet + Pringy + Seynod (~130 000 habitants).",
      source: "https://fr.wikipedia.org/wiki/Annecy",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Métadonnées de revue ───────────────────────────────────────────
  lastReviewedOn: "2026-05-18",
  reviewedBy: "Claude Code Opus 4.7 (sprint City Quality V3 ville #27)",
};
