// Nîmes (30189) — data économique enrichie sourcée V3.
// Sprint City Quality V3, ville #20.
//
// Sources canoniques utilisées :
//   - INSEE dossier complet commune 30189 (2011101)
//   - INAO (signes officiels de qualité)
//   - competitivite.gouv.fr — Qualiméditerranée
//   - UNESCO Centre du patrimoine mondial (Maison Carrée 2023 ref. 1569,
//     Pont du Gard 1985 ref. 344)
//   - Wikipédia articles entreprises/écoles/monuments
//   - Sites officiels (BRL, UNIMES, IMT Mines Alès, Royal Canin, Perrier)
//
// Contrat zéro invention : chaque champ a un `source` vérifiable.

import type { VilleEconomicData } from "./types";

export const NIMES_ECONOMIC_DATA: VilleEconomicData = {
  // ─── Couche 1 — Économie INSEE ──────────────────────────────────────
  topSectorsNaf: [
    {
      naf: "GHI",
      label: "Commerce, transports, hébergement et restauration (sections G+H+I)",
      rank: 1,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-30189",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "MN",
      label:
        "Activités spécialisées, scientifiques et techniques + services administratifs (sections M+N)",
      rank: 2,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-30189",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "OPQ",
      label:
        "Administration publique, enseignement, santé, action sociale (sections O+P+Q) — préfecture du Gard + CHU Carémeau",
      rank: 3,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-30189",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "F",
      label: "Construction (section F) — bassin BTP Gard",
      rank: 4,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-30189",
      verifiedOn: "2026-05-18",
    },
  ],

  polesCompetitivite: [
    {
      nom: "Qualiméditerranée (Q@LI-MEDiterranée)",
      secteur:
        "Agroalimentaire / qualité / agro-ressources méditerranéennes (rayonnement sur le bassin Gard-Hérault)",
      type: "rayonnement",
      source: "https://www.qalimediterranee.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  distances: {
    gareTgv: {
      nom: "Gare de Nîmes-Pont-du-Gard (LGV, Manduel-Redessan) + Gare de Nîmes-Centre (intra-muros)",
      distanceKm: 0,
      source: "https://www.sncf-connect.com/gares/nimes-pont-du-gard",
    },
    aeroportPrincipal: {
      nom: "Aéroport de Nîmes-Alès-Camargue-Cévennes (FNI, commune de Garons)",
      distanceKm: 10,
      source: "https://www.nimes-aeroport.fr/",
    },
    metroOuTram: {
      // Nîmes n'a ni métro ni tramway — BHNS (bus à haut niveau de service
      // TramBus T1/T2) uniquement. Lignes = 0 pour éviter un scoring trompeur.
      lignes: 0,
      source: "https://www.tangobus.fr/",
    },
    verifiedOn: "2026-05-18",
  },

  statsInsee: {
    anneeReference: 2024,
    source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-30189",
    verifiedOn: "2026-05-18",
  },

  // ─── Couche 2 — Matière éditoriale unique ───────────────────────────
  marquesHistoriques: [
    {
      nom: "Denim (étoffe « de Nîmes »)",
      secteur:
        "Textile — la toile robuste « serge de Nîmes » exportée au XVIIᵉ-XVIIIᵉ siècle est à l'origine étymologique du mot anglais denim",
      lienVille: "heritage",
      source: "https://fr.wikipedia.org/wiki/Denim",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "BRL (ex-Compagnie Nationale d'Aménagement du Bas-Rhône et du Languedoc)",
      secteur: "Ingénierie / gestion de l'eau / aménagement hydraulique (fondée 1955, siège Nîmes)",
      lienVille: "siege",
      source: "https://fr.wikipedia.org/wiki/Groupe_BRL",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Maison Villaret (biscuiterie)",
      secteur:
        "Agroalimentaire / confiserie — créatrice du « Croquant Villaret » (1775, plus ancienne biscuiterie de Nîmes en activité)",
      lienVille: "fondation",
      source: "https://fr.wikipedia.org/wiki/Croquant_Villaret",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Perrier (Source Perrier)",
      secteur:
        "Eau minérale gazeuse — site historique à Vergèze (15 km) depuis 1903, marque mondiale Nestlé Waters",
      lienVille: "production",
      source: "https://fr.wikipedia.org/wiki/Perrier_(eau_min%C3%A9rale)",
      verifiedOn: "2026-05-18",
    },
  ],

  produitsIgpAop: [
    {
      nom: "Costières de Nîmes rouge",
      categorie: "Vin rouge",
      signe: "AOC",
      source: "https://www.inao.gouv.fr/produit/costieres-de-nimes-rouge-21030",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Costières de Nîmes blanc",
      categorie: "Vin blanc",
      signe: "AOC",
      source: "https://www.inao.gouv.fr/produit/costieres-de-nimes-blanc-21028",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Olive de Nîmes / Huile d'olive de Nîmes",
      categorie: "Olive de table et huile d'olive",
      signe: "AOP",
      source: "https://www.inao.gouv.fr/produit/3452",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Oignon doux des Cévennes",
      categorie: "Légume (oignon)",
      signe: "AOP",
      source: "https://www.inao.gouv.fr/produit/oignon-doux-des-cevennes-14074",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Taureau de Camargue",
      categorie: "Viande bovine (race de Camargue)",
      signe: "AOP",
      source: "https://www.inao.gouv.fr/produit/3450",
      verifiedOn: "2026-05-18",
    },
  ],

  salonsSectoriels: [
    {
      nom: "Féria de Nîmes (Pentecôte + Vendanges)",
      secteur:
        "Tauromachie / culture / tourisme — 1ᵉʳ événement économique de la ville (~1M visiteurs/an cumulé)",
      localisation: "Arènes de Nîmes + centre-ville",
      lienVille: "accueille",
      source: "https://fr.wikipedia.org/wiki/F%C3%A9ria_de_N%C3%AEmes",
      verifiedOn: "2026-05-18",
    },
  ],

  patrimoineNotable: [
    {
      nom: "Maison Carrée de Nîmes (UNESCO 2023, ref. 1569) — temple romain le mieux conservé au monde",
      type: "unesco",
      source: "https://whc.unesco.org/en/list/1569/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Pont du Gard (UNESCO 1985, ref. 344) — aqueduc romain à 25 km, alimentait Nemausus",
      type: "unesco",
      source: "https://whc.unesco.org/en/list/344/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Arènes de Nîmes (amphithéâtre romain, Iᵉʳ siècle) — l'un des mieux conservés au monde",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Ar%C3%A8nes_de_N%C3%AEmes",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Tour Magne (Iᵉʳ siècle av. J.-C.) — vestige de l'enceinte romaine, sommet du Mont Cavalier",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Tour_Magne",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Jardins de la Fontaine (XVIIIᵉ siècle, premier jardin public d'Europe avec Tuileries)",
      type: "parc",
      source: "https://fr.wikipedia.org/wiki/Jardins_de_la_Fontaine",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Musée de la Romanité (2018, en face des Arènes)",
      type: "musee",
      source: "https://museedelaromanite.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Temple de Diane (Iᵉʳ-IIᵉ siècle, dans les Jardins de la Fontaine)",
      type: "site_archeologique",
      source: "https://fr.wikipedia.org/wiki/Temple_de_Diane_(N%C3%AEmes)",
      verifiedOn: "2026-05-18",
    },
  ],

  communesBassin: [
    {
      slug: "marguerittes",
      nameFr: "Marguerittes",
      distanceKm: 6,
      source: "https://fr.wikipedia.org/wiki/Marguerittes",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "bouillargues",
      nameFr: "Bouillargues",
      distanceKm: 5,
      source: "https://fr.wikipedia.org/wiki/Bouillargues",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "caissargues",
      nameFr: "Caissargues",
      distanceKm: 4,
      source: "https://fr.wikipedia.org/wiki/Caissargues",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "manduel",
      nameFr: "Manduel",
      distanceKm: 10,
      source: "https://fr.wikipedia.org/wiki/Manduel",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "garons",
      nameFr: "Garons",
      distanceKm: 9,
      source: "https://fr.wikipedia.org/wiki/Garons",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "vauvert",
      nameFr: "Vauvert",
      distanceKm: 22,
      source: "https://fr.wikipedia.org/wiki/Vauvert_(Gard)",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "beaucaire",
      nameFr: "Beaucaire",
      distanceKm: 25,
      source: "https://fr.wikipedia.org/wiki/Beaucaire_(Gard)",
      verifiedOn: "2026-05-18",
    },
  ],

  vignoblesProches: [
    {
      aoc: "Costières de Nîmes AOC (vignoble enserrant la ville sud)",
      distanceKm: 5,
      source: "https://www.inao.gouv.fr/produit/costieres-de-nimes-rouge-21030",
      verifiedOn: "2026-05-18",
    },
    {
      aoc: "Tavel AOC (rosé exclusif, premier rosé de France classé Cru des Côtes du Rhône)",
      distanceKm: 25,
      source: "https://www.vins-rhone.com/en/cotes-du-rhone-cru-aoc-tavel",
      verifiedOn: "2026-05-18",
    },
    {
      aoc: "Lirac AOC (Côtes du Rhône méridionales, rouge/rosé/blanc)",
      distanceKm: 28,
      source: "https://www.inao.gouv.fr/produit/3414",
      verifiedOn: "2026-05-18",
    },
    {
      aoc: "Châteauneuf-du-Pape AOC (Cru emblématique du Rhône Sud)",
      distanceKm: 45,
      source: "https://www.vins-rhone.com/en/aoc-chateauneuf-du-pape",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Couche 3 — Multi-taille TPE/PME/ETI/GE ─────────────────────────

  // Annuaire EPV non extrait à la commune en V1 — champ vide pour
  // respecter zéro invention. À compléter Phase 2 du sprint via le
  // jeu de données data.economie.gouv.fr.
  labelsEpvEtArtisanat: [],

  zonesActivitesParcs: [
    {
      nom: "Parc Georges Besse (technopôle Nîmes-Ouest)",
      type: "parc_tech",
      secteurDominant: "Tertiaire / R&D / numérique / formation supérieure",
      source: "https://fr.wikipedia.org/wiki/Parc_scientifique_Georges-Besse",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Parc Mitra (commune de Garons, à 9 km — aéropôle Nîmes-Garons)",
      type: "parc_tech",
      secteurDominant: "Aéronautique / défense / logistique",
      source: "https://www.nimes-metropole.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Pôle d'activités Grézan (Nîmes-Ouest)",
      type: "zac",
      secteurDominant: "Tertiaire / commerces / services",
      source: "https://www.nimes-metropole.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  grandesEcolesEtUniversites: [
    {
      nom: "Université de Nîmes (UNIMES) — campus Vauban, Carmes, Hoche",
      type: "universite",
      specialites: [
        "Sciences",
        "Droit-Économie-Gestion",
        "Lettres-Langues-Histoire",
        "Design",
        "Psychologie",
      ],
      source: "https://www.unimes.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "IMT Mines Alès (école d'ingénieurs, à 45 km — rayonnement Gard)",
      type: "ecole_ingenieur",
      specialites: ["Mécanique", "Matériaux", "Environnement", "Informatique", "Risques"],
      source: "https://www.imt-mines-ales.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ISG Nîmes (campus délocalisé, école de commerce)",
      type: "ecole_commerce",
      specialites: ["Management", "Marketing", "Finance"],
      source: "https://www.isg.fr/campus-nimes",
      verifiedOn: "2026-05-18",
    },
  ],

  // Pas de centre Inria/CEA/CNRS/INSERM/INRAE majeur déclaré à Nîmes
  // commune (les pôles de recherche publique du Gard sont à Montpellier
  // et Alès). Champ vide pour respecter zéro invention.
  polesRechercheRD: [],

  grandsGroupesImplantes: [
    {
      nom: "BRL Groupe (siège social Nîmes — eau, ingénierie, aménagement)",
      secteur: "Ingénierie eau / environnement / aménagement hydraulique",
      typeImplantation: "siege_social",
      source: "https://www.brl.fr/fr/nous-contacter",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Royal Canin (siège mondial à Aimargues, 25 km — Mars Petcare)",
      secteur: "Agroalimentaire / nutrition animale",
      typeImplantation: "siege_social",
      source: "https://en.wikipedia.org/wiki/Royal_Canin",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Nestlé Waters Supply Sud — Source Perrier (Vergèze, 15 km)",
      secteur: "Eaux minérales / agroalimentaire (~1000 employés site)",
      typeImplantation: "usine_principale",
      source: "https://fr.wikipedia.org/wiki/Perrier_(eau_min%C3%A9rale)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "CHU de Nîmes (Carémeau) — établissement public, plus gros employeur du Gard",
      secteur: "Santé / hôpital universitaire",
      typeImplantation: "site_majeur",
      source: "https://www.chu-nimes.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  kbSectorTags: ["tourisme-affaires", "agroalimentaire-igp", "industrie-manufacturiere"],

  // ─── Optionnels (hors scoring dashboard) ────────────────────────────
  cciCompetente: {
    nom: "CCI Gard",
    source: "https://www.gard.cci.fr/",
    verifiedOn: "2026-05-18",
  },

  distancesGrandesMetropoles: [
    {
      metropole: "Montpellier",
      distanceKm: 55,
      tempsMnTgv: 25,
      tempsMnRoute: 50,
      source: "https://www.sncf-connect.com/",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Marseille",
      distanceKm: 125,
      tempsMnTgv: 75,
      source: "https://www.sncf-connect.com/",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Lyon",
      distanceKm: 250,
      tempsMnTgv: 105,
      source: "https://www.sncf-connect.com/",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Paris",
      distanceKm: 715,
      tempsMnTgv: 175,
      source: "https://www.sncf-connect.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  specificitesLocales: [
    {
      theme: "patrimoine_romain_unesco_double",
      description:
        "Nîmes cumule 2 inscriptions UNESCO : Maison Carrée (2023, dernière inscription française) + Pont du Gard à 25 km (1985). Concentration romaine la plus dense hors Italie.",
      source: "https://whc.unesco.org/en/list/1569/",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "origine_denim_textile",
      description:
        "La « serge de Nîmes » (toile robuste exportée dès le XVIIᵉ siècle) est à l'origine étymologique du mot anglais denim — héritage textile mondial.",
      source: "https://fr.wikipedia.org/wiki/Denim",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "porte_camargue_taurine",
      description:
        "Nîmes est la principale ville taurine de France (corrida + course camarguaise) — Féria de Pentecôte et des Vendanges, ~1M visiteurs/an cumulé, économie locale structurante.",
      source: "https://fr.wikipedia.org/wiki/F%C3%A9ria_de_N%C3%AEmes",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Adaptations Nîmes (zéro invention) ─────────────────────────────
  // Pas de pôle de recherche publique majeur (Inria/CEA/CNRS/INSERM/INRAE)
  // déclaré à Nîmes commune : les centres régionaux sont à Montpellier
  // (CIRAD, INRAE, IRD, Inria antenne) et Alès (IMT Mines). Champ
  // structurellement non applicable, exempté du scoring.
  // Pas de chapitre French Tech rattaché à Nîmes (rattachement French
  // Tech Méditerranée centré Montpellier).
  notApplicableFields: ["polesRechercheRD"],

  // ─── Métadonnées de revue ───────────────────────────────────────────
  lastReviewedOn: "2026-05-18",
  reviewedBy: "Claude Code Opus 4.7 (sprint City Quality V3 ville #20)",
};
