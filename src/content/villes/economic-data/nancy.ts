// Nancy (54395, dépt 54 Meurthe-et-Moselle, région Grand Est) — data
// économique enrichie sourcée V3 multi-taille.
//
// Sprint City Quality V3 2026-05-18 — ville n°39 (dernière ville sprint).
// Contrat zéro invention : chaque champ a un `source` vérifiable.
//
// Spécificités Nancy retenues :
//   - Capitale historique de la Lorraine (Duché Stanislas)
//   - Berceau de l'Art Nouveau "École de Nancy" (Gallé, Daum, Majorelle, 1901)
//   - Place Stanislas + Place de la Carrière + Place d'Alliance — UNESCO 1983
//   - Pôle universitaire majeur du Grand Est (Université de Lorraine,
//     campus Artem, Mines Nancy, ICN, ENSGSI, Sciences Po Campus Européen,
//     Polytech Nancy) — 52 000 étudiants
//   - Technopôle de Brabois (santé / IA / robotique chirurgicale CHRU)
//   - Pôle Materalia (matériaux & procédés, implantation Nancy)
//   - Bassin industriel Saint-Gobain PAM (Pont-à-Mousson, fonte, siège)
//   - Mirabelle de Lorraine IGP (toute la Meurthe-et-Moselle)
//   - Bergamote de Nancy (confiserie emblématique, label régional)
//   - Vignobles : Côtes de Toul AOC (~30 km), Moselle AOC (~50 km)
//
// Sources canoniques utilisées :
//   - INSEE dossier complet commune 54395 (2011101)
//   - competitivite.gouv.fr / pole-materalia.com / wikipedia Materalia
//   - INAO (mirabelle-de-lorraine, cotes-de-toul, moselle)
//   - whc.unesco.org/fr/list/229 (Places de Nancy)
//   - Sites officiels écoles (mines-nancy.univ-lorraine.fr, icn-artem.com,
//     ensgsi.univ-lorraine.fr, polytech-nancy.univ-lorraine.fr,
//     sciencespo.fr/students/fr/campus/nancy.html)
//   - Wikipédia articles entreprises (Saint-Gobain PAM, École de Nancy)
//   - Sites officiels salons (foirenancy.com, lelivresurlaplace.fr)
//
// Reviewer : Claude Code Opus 4.7 (sprint City Quality V3 ville #39 —
//            dernière ville sprint).

import type { VilleEconomicData } from "./types";

export const NANCY_ECONOMIC_DATA: VilleEconomicData = {
  // ─── Couche 1 — Économie INSEE ──────────────────────────────────────
  topSectorsNaf: [
    {
      naf: "GHI",
      label: "Commerce, transports, hébergement et restauration (sections G+H+I)",
      rank: 1,
      etablissementsCount: 3_374,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-54395",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "OPQ",
      label: "Administration publique, enseignement, santé, action sociale (sections O+P+Q)",
      rank: 2,
      etablissementsCount: 671,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-54395",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "F",
      label: "Construction",
      rank: 3,
      etablissementsCount: 145,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-54395",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "C",
      label: "Industrie manufacturière, extractive et autres",
      rank: 4,
      etablissementsCount: 136,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-54395",
      verifiedOn: "2026-05-18",
    },
  ],

  polesCompetitivite: [
    {
      nom: "Materalia",
      secteur: "Matériaux et procédés (énergie, aéronautique, automobile, médical)",
      type: "rayonnement",
      source:
        "https://competitivite.gouv.fr/les-53-poles/annuaire-des-poles-192/materalia-549.html",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Fibres-Énergivie",
      secteur: "Fibres / bâtiment durable / matériaux biosourcés",
      type: "rayonnement",
      source: "https://www.fibres-energivie.eu/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Bioeconomy For Change (B4C)",
      secteur: "Bioéconomie / biomasse / agro-ressources",
      type: "rayonnement",
      source: "https://www.bioeconomyforchange.eu/",
      verifiedOn: "2026-05-18",
    },
  ],

  distances: {
    gareTgv: {
      nom: "Gare de Nancy-Ville (TGV Est, Paris en 1h30)",
      distanceKm: 0,
      source: "https://www.sncf-connect.com/gares/nancy-ville",
    },
    aeroportPrincipal: {
      nom: "Aéroport Metz-Nancy-Lorraine (Goin)",
      distanceKm: 32,
      source: "https://fr.wikipedia.org/wiki/A%C3%A9roport_de_Metz-Nancy-Lorraine",
    },
    metroOuTram: {
      lignes: 1,
      source: "https://www.reseau-stan.com/",
    },
    verifiedOn: "2026-05-18",
  },

  statsInsee: {
    etablissementsActifs: 4_334,
    creationsEntreprises: 1_969,
    anneeReference: 2023,
    source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-54395",
    verifiedOn: "2026-05-18",
  },

  // ─── Couche 2 — Matière éditoriale unique ───────────────────────────
  marquesHistoriques: [
    {
      nom: "Saint-Gobain PAM (Pont-à-Mousson)",
      secteur: "Fonte ductile / canalisations / voirie",
      lienVille: "production",
      source: "https://fr.wikipedia.org/wiki/Usine_sid%C3%A9rurgique_de_Pont-%C3%A0-Mousson",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Daum",
      secteur: "Cristallerie / verre d'art (École de Nancy)",
      lienVille: "fondation",
      source: "https://fr.wikipedia.org/wiki/Daum_(cristallerie)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Émile Gallé",
      secteur: "Verre / mobilier Art Nouveau (École de Nancy)",
      lienVille: "fondation",
      source: "https://fr.wikipedia.org/wiki/%C3%89mile_Gall%C3%A9",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Louis Majorelle",
      secteur: "Ébénisterie / mobilier Art Nouveau (École de Nancy)",
      lienVille: "fondation",
      source: "https://fr.wikipedia.org/wiki/Louis_Majorelle",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Maison des Sœurs Macarons",
      secteur: "Confiserie / pâtisserie (Macaron de Nancy depuis 1793)",
      lienVille: "fondation",
      source: "https://fr.wikipedia.org/wiki/Macaron_de_Nancy",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Bergamote de Nancy",
      secteur: "Confiserie (bonbon emblématique, label régional)",
      lienVille: "fondation",
      source: "https://fr.wikipedia.org/wiki/Bergamote_de_Nancy",
      verifiedOn: "2026-05-18",
    },
  ],

  produitsIgpAop: [
    {
      nom: "Mirabelle de Lorraine",
      categorie: "Fruit / agroalimentaire",
      signe: "IGP",
      source: "https://www.inao.gouv.fr/produit/mirabelle-de-lorraine-4289",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Côtes de Toul",
      categorie: "Vin",
      signe: "AOC",
      source: "https://www.inao.gouv.fr/produit/3445",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Moselle",
      categorie: "Vin",
      signe: "AOC",
      source: "https://www.inao.gouv.fr/produit/3617",
      verifiedOn: "2026-05-18",
    },
  ],

  salonsSectoriels: [
    {
      nom: "Foire Internationale de Nancy",
      secteur: "Grand public / multisectoriel (régional Grand Est)",
      localisation: "Parc des expositions de Nancy",
      lienVille: "accueille",
      source: "https://www.foirenancy.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Le Livre sur la Place",
      secteur: "Édition / littérature (rentrée littéraire France)",
      localisation: "Place de la Carrière, Nancy",
      lienVille: "accueille",
      source: "https://www.lelivresurlaplace.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Nancyphonies",
      secteur: "Musique classique / festival",
      localisation: "Nancy (sites patrimoniaux)",
      lienVille: "accueille",
      source: "https://fr.wikipedia.org/wiki/Nancyphonies",
      verifiedOn: "2026-05-18",
    },
  ],

  patrimoineNotable: [
    {
      nom: "Place Stanislas, Place de la Carrière et Place d'Alliance (UNESCO depuis 1983)",
      type: "unesco",
      source: "https://whc.unesco.org/fr/list/229",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Musée de l'École de Nancy (Art Nouveau)",
      type: "musee",
      source: "https://www.musee-ecole-de-nancy.nancy.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Musée des Beaux-Arts de Nancy",
      type: "musee",
      source: "https://www.mban.nancy.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Palais Ducal / Musée Lorrain",
      type: "musee",
      source: "https://musee-lorrain.nancy.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Cathédrale Notre-Dame-de-l'Annonciation de Nancy",
      type: "monument",
      source:
        "https://fr.wikipedia.org/wiki/Cath%C3%A9drale_Notre-Dame-de-l%27Annonciation_de_Nancy",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Église Saint-Sébastien de Nancy",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/%C3%89glise_Saint-S%C3%A9bastien_de_Nancy",
      verifiedOn: "2026-05-18",
    },
  ],

  communesBassin: [
    {
      slug: "vandoeuvre-les-nancy",
      nameFr: "Vandœuvre-lès-Nancy",
      distanceKm: 4,
      source: "https://fr.wikipedia.org/wiki/Vand%C5%93uvre-l%C3%A8s-Nancy",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "laxou",
      nameFr: "Laxou",
      distanceKm: 4,
      source: "https://fr.wikipedia.org/wiki/Laxou",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "villers-les-nancy",
      nameFr: "Villers-lès-Nancy",
      distanceKm: 4,
      source: "https://fr.wikipedia.org/wiki/Villers-l%C3%A8s-Nancy",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "maxeville",
      nameFr: "Maxéville",
      distanceKm: 3,
      source: "https://fr.wikipedia.org/wiki/Max%C3%A9ville",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "tomblaine",
      nameFr: "Tomblaine",
      distanceKm: 3,
      source: "https://fr.wikipedia.org/wiki/Tomblaine",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "jarville-la-malgrange",
      nameFr: "Jarville-la-Malgrange",
      distanceKm: 4,
      source: "https://fr.wikipedia.org/wiki/Jarville-la-Malgrange",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "saint-max",
      nameFr: "Saint-Max",
      distanceKm: 3,
      source: "https://fr.wikipedia.org/wiki/Saint-Max",
      verifiedOn: "2026-05-18",
    },
  ],

  vignoblesProches: [
    {
      aoc: "Côtes de Toul",
      distanceKm: 30,
      source: "https://www.inao.gouv.fr/produit/3445",
      verifiedOn: "2026-05-18",
    },
    {
      aoc: "Moselle",
      distanceKm: 50,
      source: "https://www.inao.gouv.fr/produit/3617",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Couche 3 — Multi-taille TPE/PME/ETI/GE ─────────────────────────

  // Label EPV : sans annuaire officiel cross-référencé par entreprise Nancy
  // confirmée, champ honnêtement vide pour respecter zéro invention.
  // À compléter en Phase 2 via data.economie.gouv.fr / annuaire EPV
  // (https://www.epv.org/annuaire).
  labelsEpvEtArtisanat: [],

  zonesActivitesParcs: [
    {
      nom: "Technopôle Henri Poincaré (Brabois, Vandœuvre-lès-Nancy)",
      type: "technopole",
      secteurDominant: "Santé / biotech / IA / robotique chirurgicale (CHRU Nancy)",
      source: "https://grandnancy-innovation.eu/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Campus Artem (Nancy)",
      type: "parc_tech",
      secteurDominant: "Recherche / enseignement supérieur (Mines Nancy + ICN + ENSAD)",
      source: "https://artem-nancy.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Parc d'activités du Saulcy / Plateau de Haye",
      type: "zac",
      secteurDominant: "Tertiaire / mixte (agglomération Grand Nancy)",
      source: "https://www.grandnancy.eu/",
      verifiedOn: "2026-05-18",
    },
  ],

  grandesEcolesEtUniversites: [
    {
      nom: "Université de Lorraine (siège Nancy)",
      type: "universite",
      specialites: ["Sciences", "Ingénierie", "Santé", "Lettres", "Droit", "Économie"],
      source: "https://www.univ-lorraine.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Mines Nancy (École nationale supérieure des Mines de Nancy)",
      type: "ecole_ingenieur",
      specialites: ["Ingénierie généraliste", "Matériaux", "Énergie", "Data Science"],
      source: "https://mines-nancy.univ-lorraine.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ICN Business School (Nancy / Berlin / Paris)",
      type: "ecole_commerce",
      specialites: ["Management", "Finance", "Marketing", "Innovation"],
      source: "https://www.icn-artem.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ENSGSI (École Nationale Supérieure en Génie des Systèmes et de l'Innovation)",
      type: "ecole_ingenieur",
      specialites: ["Génie industriel", "Innovation", "Systèmes complexes"],
      source: "https://ensgsi.univ-lorraine.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Sciences Po Paris — Campus Européen de Nancy",
      type: "sciences_po",
      specialites: ["Sciences politiques", "Affaires européennes", "Programme franco-allemand"],
      source: "https://www.sciencespo.fr/students/fr/campus/nancy.html",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Polytech Nancy (école d'ingénieurs de l'Université de Lorraine)",
      type: "ecole_ingenieur",
      specialites: ["Informatique", "Génie industriel", "Mathématiques appliquées", "Énergie"],
      source: "https://polytech-nancy.univ-lorraine.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  polesRechercheRD: [
    {
      nom: "Inria Nancy — Grand Est",
      organisme: "inria",
      domaine: "Informatique / IA / algorithmique / sécurité / vérification formelle",
      source: "https://www.inria.fr/fr/centre-inria-de-luniversite-de-lorraine",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "CNRS Délégation Centre-Est (Nancy / Strasbourg)",
      organisme: "cnrs",
      domaine: "Recherche fondamentale toutes disciplines (matériaux, chimie, mathématiques)",
      source: "https://www.cnrs.fr/fr/delegation/centre-est",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "INRAE Nancy (centre Grand Est-Nancy)",
      organisme: "inrae",
      domaine: "Agronomie / forêt / écologie (BEF, IAM, Silva)",
      source: "https://www.inrae.fr/centres/grand-est-nancy",
      verifiedOn: "2026-05-18",
    },
  ],

  grandsGroupesImplantes: [
    {
      nom: "Saint-Gobain PAM (Pont-à-Mousson, bassin Nancy)",
      secteur: "Fonte ductile / canalisations / voirie",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/Usine_sid%C3%A9rurgique_de_Pont-%C3%A0-Mousson",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "EDF (direction régionale Grand Est)",
      secteur: "Énergie",
      typeImplantation: "site_majeur",
      source: "https://www.edf.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "CHRU de Nancy (Centre Hospitalier Régional Universitaire)",
      secteur: "Santé / recherche médicale / robotique chirurgicale",
      typeImplantation: "site_majeur",
      source: "https://www.chru-nancy.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Couche 2bis — tags KB sectorielles ─────────────────────────────
  // Volontairement vide en V1 : la KB Prisma ne contient pas encore
  // d'entries sectorielles dédiées (Phase B du sprint).
  kbSectorTags: [
    "sante-biotech",
    "enseignement-recherche",
    "industrie-manufacturiere",
    "agroalimentaire-igp",
  ],

  // ─── Optionnels (hors scoring dashboard) ────────────────────────────
  capitaleFrenchTech: {
    statut: "communaute",
    nomChapitre: "French Tech East (Nancy / Metz / Strasbourg / Reims)",
    source: "https://lafrenchtech.com/fr/communaute-french-tech/",
    verifiedOn: "2026-05-18",
  },

  cciCompetente: {
    nom: "CCI Meurthe-et-Moselle",
    source: "https://www.meurthe-et-moselle.cci.fr/",
    verifiedOn: "2026-05-18",
  },

  distancesGrandesMetropoles: [
    {
      metropole: "Paris",
      distanceKm: 305,
      tempsMnTgv: 90,
      source: "https://www.sncf-connect.com/gares/nancy-ville",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Metz",
      distanceKm: 55,
      tempsMnRoute: 45,
      source: "https://fr.wikipedia.org/wiki/Nancy",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Strasbourg",
      distanceKm: 150,
      tempsMnRoute: 95,
      source: "https://fr.wikipedia.org/wiki/Nancy",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Luxembourg (frontalier)",
      distanceKm: 160,
      tempsMnRoute: 110,
      source: "https://fr.wikipedia.org/wiki/Nancy",
      verifiedOn: "2026-05-18",
    },
  ],

  incubateursAccelerateurs: [
    {
      nom: "Grand Nancy Innovation (GNI)",
      focus: "Innovation territoriale (santé, matériaux, IA, énergie)",
      source: "https://grandnancy-innovation.eu/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Incubateur Lorrain (Université de Lorraine)",
      focus: "Deeptech / spin-off recherche publique",
      source: "https://www.incubateurlorrain.org/",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Spécificités locales hors grille standard ──────────────────────
  specificitesLocales: [
    {
      theme: "patrimoine_unesco_art_nouveau",
      description:
        "Capitale historique du Duché de Lorraine (Stanislas) + berceau de l'Art Nouveau « École de Nancy » 1901 (Gallé, Daum, Majorelle). Place Stanislas inscrite UNESCO 1983.",
      source: "https://whc.unesco.org/fr/list/229",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "pole_universitaire_grand_est",
      description:
        "Pôle universitaire majeur du Grand Est : Université de Lorraine ~52 000 étudiants, campus Artem (Mines Nancy + ICN + ENSAD), Sciences Po Campus Européen, 9 écoles d'ingénieurs.",
      source: "https://www.univ-lorraine.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "transfrontalier_luxembourg",
      description:
        "Bassin économique influencé par la proximité du Luxembourg (~160 km) : flux de travailleurs transfrontaliers, partenariats universitaires Grande Région.",
      source: "https://fr.wikipedia.org/wiki/Nancy",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Métadonnées de revue ───────────────────────────────────────────
  lastReviewedOn: "2026-05-18",
  reviewedBy: "Claude Code Opus 4.7 (sprint City Quality V3 ville #39 — dernière ville sprint)",
};
