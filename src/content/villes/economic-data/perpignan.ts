// Perpignan (66136) — data économique enrichie sourcée V3.
// Sprint City Quality V3, ville #30.
//
// Sources canoniques utilisées :
//   - INSEE dossier complet commune 66136 (2011101)
//   - INAO (signes officiels de qualité — Banyuls, Maury, Collioure,
//     Rivesaltes, Muscat de Rivesaltes, Côtes du Roussillon, Anchois
//     de Collioure)
//   - entreprises.gouv.fr / pole-derbi.com — pôle DERBI-CEMATER
//   - Wikipédia articles entreprises/écoles/monuments (Cémoi 1814,
//     Saint-Charles International 1970, Palais des Rois de Majorque
//     XIIIᵉ siècle, Castillet XIVᵉ siècle, Université Perpignan
//     Via Domitia)
//   - Sites officiels (cemoi.fr, saintcharlesinternational.com,
//     univ-perp.fr, perpignan.cci.fr, frenchtech-perpignan.fr,
//     congres-perpignan.com)
//
// Contrat zéro invention : chaque champ a un `source` vérifiable.

import type { VilleEconomicData } from "./types";

export const PERPIGNAN_ECONOMIC_DATA: VilleEconomicData = {
  // ─── Couche 1 — Économie INSEE ──────────────────────────────────────
  topSectorsNaf: [
    {
      naf: "GHI",
      label:
        "Commerce, transports, hébergement et restauration (sections G+H+I) — bassin Saint-Charles + tourisme catalan",
      rank: 1,
      etablissementsCount: 3866,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-66136",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "MN",
      label:
        "Activités spécialisées, scientifiques et techniques + services administratifs (sections M+N)",
      rank: 2,
      etablissementsCount: 2522,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-66136",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "OPQ",
      label:
        "Administration publique, enseignement, santé, action sociale (sections O+P+Q) — préfecture des Pyrénées-Orientales + CH Perpignan + UPVD",
      rank: 3,
      etablissementsCount: 2153,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-66136",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "F",
      label: "Construction (section F) — bassin BTP Pyrénées-Orientales",
      rank: 4,
      etablissementsCount: 1384,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-66136",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "BE",
      label:
        "Industrie (sections B+C+D+E) — agroalimentaire (Cémoi, Conserves France), énergies renouvelables",
      rank: 5,
      etablissementsCount: 548,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-66136",
      verifiedOn: "2026-05-18",
    },
  ],

  polesCompetitivite: [
    {
      nom: "DERBI-CEMATER (siège Perpignan)",
      secteur:
        "Énergies renouvelables / transition énergétique / réseaux intelligents / efficacité énergétique — 300 entreprises, R&D, formation. Pôle créé 2005, fusion DERBI+CEMATER juin 2025, labellisé Phase V 2023-2026",
      type: "siege",
      source: "https://pole-derbi.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Qualiméditerranée (Q@LI-MEDiterranée)",
      secteur:
        "Agroalimentaire / qualité / agro-ressources méditerranéennes — rayonnement sur le bassin Saint-Charles International",
      type: "rayonnement",
      source: "https://www.qalimediterranee.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Aqua-Valley",
      secteur: "Filière eau / gestion durable / hydraulique — rayonnement Occitanie",
      type: "rayonnement",
      source: "https://www.aqua-valley.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  distances: {
    gareTgv: {
      nom: "Gare de Perpignan (intra-muros) — terminus LGV Sud-Europe-Atlantique côté espagnol, liaison Barcelone-Madrid",
      distanceKm: 0,
      source: "https://www.garesetconnexions.sncf/en/stations-services/perpignan",
    },
    aeroportPrincipal: {
      nom: "Aéroport de Perpignan-Rivesaltes (PGF) — Rivesaltes à ~10 km",
      distanceKm: 10,
      source: "https://www.aeroport-perpignan.com/",
    },
    metroOuTram: {
      // Perpignan n'a ni métro ni tramway — réseau bus Sankéo
      // (Perpignan Méditerranée Métropole).
      lignes: 0,
      source: "https://www.sankeo.com/",
    },
    verifiedOn: "2026-05-18",
  },

  statsInsee: {
    etablissementsActifs: 13_498,
    creationsEntreprises: 2512,
    anneeReference: 2023,
    source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-66136",
    verifiedOn: "2026-05-18",
  },

  // ─── Couche 2 — Matière éditoriale unique ───────────────────────────
  marquesHistoriques: [
    {
      nom: "Cémoi (Groupe Cémoi)",
      secteur:
        "Chocolat / cacao — fondé 1814 à Arles-sur-Tech (Pyrénées-Orientales), siège Perpignan depuis 1940 (2980 av. Julien Panchot). N°1 français du chocolat. ~3200 employés, 750 M€ CA. Racheté en 2021 par Sweet Products (Belgique)",
      lienVille: "siege",
      source: "https://fr.wikipedia.org/wiki/Groupe_C%C3%A9moi",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Saint-Charles International (Marché International Saint-Charles, MISC)",
      secteur:
        "1ᵉʳ centre européen de commercialisation, transport et logistique de fruits et légumes frais. Créé 1970 sur initiative des importateurs. 80 hectares, 150 entreprises, 2500 emplois directs, 2,3 Md€ de CA, 1 800 000 tonnes/an",
      lienVille: "fondation",
      source: "https://fr.wikipedia.org/wiki/Saint-Charles_International",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Conserves France",
      secteur:
        "Agroalimentaire / conserves de légumes (marques d'Aucy, Cassegrain en filiale) — site industriel majeur à Perpignan",
      lienVille: "production",
      source: "https://fr.wikipedia.org/wiki/Conserves_France",
      verifiedOn: "2026-05-18",
    },
  ],

  produitsIgpAop: [
    {
      nom: "Banyuls AOP (vin doux naturel, Côte Vermeille)",
      categorie: "Vin doux naturel (VDN) — Grenache",
      signe: "AOP",
      source: "https://www.inao.gouv.fr/produit/3398",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Banyuls Grand Cru AOP",
      categorie: "Vin doux naturel — Grenache, élevage long",
      signe: "AOP",
      source: "https://www.inao.gouv.fr/produit/3399",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Collioure AOP (vin sec, rouge/blanc/rosé)",
      categorie: "Vin sec — Côte Vermeille",
      signe: "AOP",
      source: "https://www.inao.gouv.fr/produit/3411",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Maury AOP (vin doux naturel, nord Roussillon)",
      categorie: "Vin doux naturel — Grenache",
      signe: "AOP",
      source: "https://www.inao.gouv.fr/produit/3431",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Rivesaltes AOP",
      categorie: "Vin doux naturel — Grenache, Macabeu",
      signe: "AOP",
      source: "https://www.inao.gouv.fr/produit/3446",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Muscat de Rivesaltes AOP",
      categorie: "Vin doux naturel — Muscat à petits grains, Muscat d'Alexandrie",
      signe: "AOP",
      source: "https://www.inao.gouv.fr/produit/3437",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Côtes du Roussillon AOC (rouge / blanc / rosé)",
      categorie: "Vin sec — appellation régionale Roussillon",
      signe: "AOC",
      source: "https://www.inao.gouv.fr/produit/3416",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Côtes du Roussillon Villages AOC",
      categorie: "Vin rouge — communes sélectionnées du Roussillon nord",
      signe: "AOC",
      source: "https://www.inao.gouv.fr/produit/3417",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Anchois de Collioure IGP",
      categorie: "Préparation à base de poisson (anchois salés, filets à l'huile)",
      signe: "IGP",
      source: "https://www.inao.gouv.fr/produit/6515",
      verifiedOn: "2026-05-18",
    },
  ],

  salonsSectoriels: [
    {
      nom: "Foir'Expo de Perpignan (41ᵉ édition 2026)",
      secteur:
        "Foire généraliste — habitat, énergies renouvelables, décoration, mode. ~28 000 visiteurs / 200 exposants / 22 000 m²",
      localisation: "Parc des Expositions de Perpignan",
      lienVille: "accueille",
      source: "https://www.congres-perpignan.com/events/foirexpo2026/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Marché Saint-Charles (négoce fruits et légumes — flux permanent)",
      secteur:
        "Agroalimentaire / négoce / logistique — 1ᵉʳ centre européen fruits-légumes frais (B2B, pas un salon ponctuel mais lieu de commerce permanent)",
      localisation: "Plateforme Saint-Charles, Perpignan",
      lienVille: "accueille",
      source: "https://public.saintcharlesinternational.com/saint-charles-international/",
      verifiedOn: "2026-05-18",
    },
  ],

  patrimoineNotable: [
    {
      nom: "Le Castillet (XIVᵉ siècle) — emblème de Perpignan, ancienne porte fortifiée, briques rouges et pierres blondes. Aujourd'hui musée Casa Pairal",
      type: "monument",
      source: "https://www.perpignantourisme.com/en/nos-incontournables/le-castillet/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Palais des Rois de Majorque (XIIIᵉ siècle) — édifié 1274 sur la butte du Puig del Rey par Jacques II de Majorque. Un des premiers palais forteresses d'Occident, antérieur au Palais des Papes d'Avignon. Inscrit Monuments Historiques 1935",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Palais_des_rois_de_Majorque",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Cathédrale Saint-Jean-Baptiste de Perpignan (XIVᵉ-XVᵉ siècle) — gothique méridional, classée Monument Historique",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Cath%C3%A9drale_Saint-Jean-Baptiste_de_Perpignan",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Loge de Mer (XIVᵉ siècle) — ancien tribunal de commerce maritime catalan, place de la Loge",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Loge_de_mer_de_Perpignan",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Musée Hyacinthe Rigaud — beaux-arts, collections catalanes, Picasso, Maillol, Dufy",
      type: "musee",
      source: "https://www.musee-rigaud.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Campo Santo (XIVᵉ siècle) — cloître funéraire gothique unique en France, attenant à la cathédrale",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Campo_Santo_(Perpignan)",
      verifiedOn: "2026-05-18",
    },
  ],

  communesBassin: [
    {
      slug: "saint-esteve",
      nameFr: "Saint-Estève",
      distanceKm: 5,
      source: "https://fr.wikipedia.org/wiki/Saint-Est%C3%A8ve_(Pyr%C3%A9n%C3%A9es-Orientales)",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "cabestany",
      nameFr: "Cabestany",
      distanceKm: 5,
      source: "https://fr.wikipedia.org/wiki/Cabestany",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "bompas",
      nameFr: "Bompas",
      distanceKm: 7,
      source: "https://fr.wikipedia.org/wiki/Bompas_(Pyr%C3%A9n%C3%A9es-Orientales)",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "le-soler",
      nameFr: "Le Soler",
      distanceKm: 7,
      source: "https://fr.wikipedia.org/wiki/Le_Soler",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "canet-en-roussillon",
      nameFr: "Canet-en-Roussillon",
      distanceKm: 12,
      source: "https://fr.wikipedia.org/wiki/Canet-en-Roussillon",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "saleilles",
      nameFr: "Saleilles",
      distanceKm: 6,
      source: "https://fr.wikipedia.org/wiki/Saleilles",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "rivesaltes",
      nameFr: "Rivesaltes",
      distanceKm: 10,
      source: "https://fr.wikipedia.org/wiki/Rivesaltes",
      verifiedOn: "2026-05-18",
    },
  ],

  vignoblesProches: [
    {
      aoc: "Côtes du Roussillon AOC (vignoble enserrant Perpignan, plaine du Roussillon)",
      distanceKm: 5,
      source: "https://www.inao.gouv.fr/produit/3416",
      verifiedOn: "2026-05-18",
    },
    {
      aoc: "Rivesaltes AOP / Muscat de Rivesaltes AOP",
      distanceKm: 10,
      source: "https://www.inao.gouv.fr/produit/3446",
      verifiedOn: "2026-05-18",
    },
    {
      aoc: "Collioure AOP / Banyuls AOP (Côte Vermeille)",
      distanceKm: 30,
      source: "https://www.inao.gouv.fr/produit/3398",
      verifiedOn: "2026-05-18",
    },
    {
      aoc: "Maury AOP (Fenouillèdes, nord Roussillon)",
      distanceKm: 30,
      source: "https://www.inao.gouv.fr/produit/3431",
      verifiedOn: "2026-05-18",
    },
    {
      aoc: "Côtes du Roussillon Villages AOC (zones nord Roussillon)",
      distanceKm: 20,
      source: "https://www.inao.gouv.fr/produit/3417",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Couche 3 — Multi-taille PME/ETI/GE ─────────────────────────

  // Annuaire EPV non extrait à la commune en V1 — champ vide pour
  // respecter zéro invention. À compléter Phase 2 du sprint via le
  // jeu de données data.economie.gouv.fr.
  labelsEpvEtArtisanat: [],

  zonesActivitesParcs: [
    {
      nom: "Marché International Saint-Charles (MISC) — 80 hectares, 150 entreprises",
      type: "district_eco",
      secteurDominant: "Négoce / logistique / fruits et légumes / transport",
      source: "https://public.saintcharlesinternational.com/saint-charles-international/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Tecnosud (technopôle Perpignan-sud, énergies renouvelables)",
      type: "technopole",
      secteurDominant: "Énergies renouvelables / R&D / pôle DERBI",
      source: "https://perpignanmediterraneemetropole.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Polygone Nord (zone d'activité tertiaire et commerciale)",
      type: "zac",
      secteurDominant: "Tertiaire / commerces / services",
      source: "https://perpignanmediterraneemetropole.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Agrosud (ZA agroalimentaire, sud de Perpignan)",
      type: "zac",
      secteurDominant: "Agroalimentaire / transformation",
      source: "https://perpignanmediterraneemetropole.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  grandesEcolesEtUniversites: [
    {
      nom: "Université de Perpignan Via Domitia (UPVD) — campus Moulin à Vent, Mailly, Carlit",
      type: "universite",
      specialites: [
        "Lettres et Sciences Humaines (LSH)",
        "Droit et Sciences Économiques",
        "Sciences Exactes et Expérimentales (SEE)",
        "STAPS",
        "~8945 étudiants",
      ],
      source: "https://www.univ-perp.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Sup'EnR (École d'ingénieurs — Énergies Renouvelables, UPVD)",
      type: "ecole_ingenieur",
      specialites: [
        "Énergies renouvelables",
        "Solaire",
        "Stockage énergie",
        "Réseaux intelligents",
      ],
      source: "https://supenr.univ-perp.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "IUT de Perpignan (UPVD) — campus Moulin à Vent, antennes Narbonne et Carcassonne",
      type: "iut",
      specialites: [
        "Gestion des entreprises et administrations",
        "Génie biologique",
        "Carrières juridiques",
        "Statistique et informatique décisionnelle",
      ],
      source: "https://iut.univ-perp.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Sup de Co Perpignan (école de commerce, groupe Sup de Co)",
      type: "ecole_commerce",
      specialites: ["Management", "Marketing", "Finance", "International business"],
      source: "https://www.supdeco-perpignan.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "IFCT (Institut Franco-Catalan Transfrontalier, UPVD)",
      type: "universite",
      specialites: ["Études catalanes", "Coopération transfrontalière France-Espagne"],
      source: "https://ifct.univ-perp.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  // Pas de centre Inria/CEA/CNRS/INSERM/INRAE majeur déclaré à Perpignan
  // commune en tant que site principal. UPVD héberge des unités mixtes
  // de recherche avec le CNRS (ex PROMES, IMAGES, CRESEM) mais pas un
  // centre Inria/CEA distinct. Champ avec entrée prudente sourçable.
  polesRechercheRD: [
    {
      nom: "PROMES (CNRS UPR 8521, Procédés, Matériaux et Énergie Solaire) — site annexe Perpignan (siège Odeillo-Font-Romeu, à 90 km)",
      organisme: "cnrs",
      domaine: "Énergie solaire concentrée / matériaux haute température / hydrogène solaire",
      source: "https://www.promes.cnrs.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  grandsGroupesImplantes: [
    {
      nom: "Cémoi (Groupe Cémoi) — siège social Perpignan, chocolaterie Torremilla 2008",
      secteur: "Agroalimentaire / chocolat (n°1 français)",
      typeImplantation: "siege_social",
      source: "https://www.cemoi.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Saint-Charles International (groupement 150 entreprises)",
      secteur: "Négoce fruits-légumes / logistique / transport (1ᵉʳ centre européen)",
      typeImplantation: "site_majeur",
      source: "https://public.saintcharlesinternational.com/saint-charles-international/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Conserves France — site industriel Perpignan",
      secteur: "Agroalimentaire / conserves de légumes (d'Aucy, Cassegrain)",
      typeImplantation: "usine_principale",
      source: "https://fr.wikipedia.org/wiki/Conserves_France",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Centre Hospitalier de Perpignan (Saint-Jean) — établissement public, plus gros employeur public du département",
      secteur: "Santé / hôpital",
      typeImplantation: "site_majeur",
      source: "https://www.ch-perpignan.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  kbSectorTags: [
    "agroalimentaire-igp",
    "logistique-supply-chain",
    "energie-cleantech",
    "viticulture-haut-de-gamme",
  ],

  // ─── Optionnels (hors scoring dashboard) ────────────────────────────
  capitaleFrenchTech: {
    statut: "communaute",
    nomChapitre:
      "French Tech Perpignan (en transition 2026-2028 vers French Tech Pyrénées-Méditerranée — fédère Pyrénées-Orientales + Ariège + Aude)",
    source: "https://frenchtech-perpignan.fr/",
    verifiedOn: "2026-05-18",
  },

  cciCompetente: {
    nom: "CCI Pyrénées-Orientales",
    source: "https://www.perpignan.cci.fr/",
    verifiedOn: "2026-05-18",
  },

  distancesGrandesMetropoles: [
    {
      metropole: "Montpellier",
      distanceKm: 155,
      tempsMnTgv: 95,
      tempsMnRoute: 100,
      source: "https://www.sncf-connect.com/",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Toulouse",
      distanceKm: 200,
      tempsMnRoute: 130,
      source: "https://www.sncf-connect.com/",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Barcelone (Espagne)",
      distanceKm: 190,
      tempsMnTgv: 80,
      tempsMnRoute: 130,
      source: "https://www.sncf-connect.com/",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Paris",
      distanceKm: 850,
      tempsMnTgv: 305,
      source: "https://www.sncf-connect.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  specificitesLocales: [
    {
      theme: "transfrontalier_catalogne_espagne",
      description:
        "Perpignan est à 30 km de la frontière espagnole et 190 km de Barcelone. Capitale historique du Roussillon, héritière du Royaume de Majorque (XIIIᵉ-XIVᵉ), elle est officiellement « ville catalane » avec un double héritage culturel France-Catalogne. Coopérations transfrontalières actives (Eurorégion Pyrénées-Méditerranée).",
      source: "https://fr.wikipedia.org/wiki/Perpignan",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "1er_centre_europeen_fruits_legumes",
      description:
        "Saint-Charles International (Perpignan) est depuis 1970 le 1ᵉʳ centre européen de commercialisation, transport et logistique de fruits et légumes frais. 80 hectares, 150 entreprises, 2500 emplois directs, 2,3 Md€ CA, 1 800 000 tonnes/an. Premier bassin d'emploi des Pyrénées-Orientales.",
      source: "https://fr.wikipedia.org/wiki/Saint-Charles_International",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "capitale_chocolat_france",
      description:
        "Cémoi, n°1 français du chocolat (CA 750 M€, 3200 employés), a son siège à Perpignan depuis 1940 (origines 1814 à Arles-sur-Tech). Chocolaterie industrielle Torremilla 2008. Racheté en 2021 par Sweet Products (Belgique) mais siège opérationnel maintenu.",
      source: "https://fr.wikipedia.org/wiki/Groupe_C%C3%A9moi",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "vignoble_roussillon_dense",
      description:
        "Perpignan est encerclée par 9 AOP/AOC viticoles dans un rayon de 30 km (Banyuls, Banyuls Grand Cru, Collioure, Maury, Rivesaltes, Muscat de Rivesaltes, Côtes du Roussillon, Côtes du Roussillon Villages, et IGP Anchois de Collioure). Densité d'appellations exceptionnelle, spécialité unique des vins doux naturels (VDN).",
      source: "https://www.inao.gouv.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Adaptations Perpignan (zéro invention) ─────────────────────────
  // Perpignan n'a pas de centre de recherche publique majeur (Inria/CEA
  // dédié) en propre — seuls des UMR CNRS rattachées à l'UPVD existent
  // (PROMES site annexe, etc.). Le champ `polesRechercheRD` est donc
  // partiellement renseigné mais reste honnêtement faible vs métropoles.
  // Pas de tram/métro (réseau Sankéo bus uniquement). Pas d'inscription
  // UNESCO ni de site archéologique majeur (le patrimoine médiéval
  // catalan est dense mais hors liste UNESCO).

  // ─── Métadonnées de revue ───────────────────────────────────────────
  lastReviewedOn: "2026-05-18",
  reviewedBy: "Claude Code Opus 4.7 (sprint City Quality V3 ville #30)",
};
