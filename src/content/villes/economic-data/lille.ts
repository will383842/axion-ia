// Lille (59350) — data économique enrichie sourcée V3 multi-taille.
//
// Sprint City Quality V3 2026-05-18, ville n°10.
// Contrat zéro invention : chaque champ a un `source` vérifiable.
//
// Sources canoniques utilisées :
//   - INSEE dossier complet commune 59350 (2011101)
//   - competitivite.gouv.fr — pôles Phase V 2023-2026 (EuraMaterials =
//     fusion 2019 Up-Tex + Matikem, ex-MAUD ; I-Trans Valenciennes ;
//     Aquimer Boulogne-sur-Mer ; NSL santé Lille ; Picom Lille)
//   - INAO base produits IGP/AOP (Maroilles AOP Avesnois, Genièvre
//     Flandre-Artois IGP, Ail fumé d'Arleux IGP)
//   - UNESCO Centre du patrimoine mondial (whc.unesco.org/en/list/943
//     Beffrois de Belgique et France inscrits 2005)
//   - SNCF Connect (Lille-Europe + Lille-Flandres) + Ilévia (métro 2 lignes)
//   - Sites officiels écoles (centralelille.fr, edhec.edu, ieseg.fr,
//     ensait.fr, univ-lille.fr)
//   - Sites officiels groupes (auchan.fr, decathlon.fr, ovhcloud.com,
//     bonduelle.com, laredoute.fr)
//   - Inria centre Université de Lille (Villeneuve-d'Ascq / EuraTechnologies)
//   - lafrenchtech.com (Lille labellisée Capitale French Tech avril 2019)
//   - CCI Grand Lille Hauts-de-France
//
// Note B2B Axion-IA : Lille = capitale retail/e-commerce France (Auchan,
// Decathlon, La Redoute, Boulanger, Kiabi), hub cloud (OVH Roubaix), hub
// ferroviaire international (Eurostar Londres + Thalys Bruxelles/Amsterdam),
// 3e quartier d'affaires France après La Défense et Lyon Part-Dieu.
//
// Reviewer : Claude Code Opus 4.7 (sprint City Quality V3 ville #10).

import type { VilleEconomicData } from "./types";

export const LILLE_ECONOMIC_DATA: VilleEconomicData = {
  // ─── Couche 1 — Économie INSEE ──────────────────────────────────────
  topSectorsNaf: [
    {
      naf: "GHI",
      label: "Commerce, transports, hébergement et restauration (sections G+H+I)",
      rank: 1,
      etablissementsCount: 7_372,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-59350",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "MN",
      label:
        "Activités spécialisées, scientifiques et techniques + services administratifs (sections M+N)",
      rank: 2,
      etablissementsCount: 6_750,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-59350",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "OPQ",
      label: "Administration publique, enseignement, santé, action sociale (sections O+P+Q)",
      rank: 3,
      etablissementsCount: 4_577,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-59350",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "J",
      label: "Information et communication (édition, logiciels, IT, médias)",
      rank: 4,
      etablissementsCount: 2_062,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-59350",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "F",
      label: "Construction",
      rank: 5,
      etablissementsCount: 2_001,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-59350",
      verifiedOn: "2026-05-18",
    },
  ],

  polesCompetitivite: [
    {
      nom: "EuraMaterials (fusion 2019 Up-Tex + Matikem, ex-MAUD)",
      secteur: "Matériaux innovants / textile technique / chimie durable",
      type: "siege",
      source: "https://www.euramaterials.eu/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "NSL (Nutrition-Santé-Longévité)",
      secteur: "Santé / nutrition / vieillissement / e-santé",
      type: "siege",
      source: "https://www.pole-nsl.org/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Picom (Pôle Industries du Commerce)",
      secteur: "Retail / e-commerce / supply chain / phygital",
      type: "siege",
      source: "https://www.picom.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "I-Trans (siège Valenciennes, rayonnement métropolitain Lille)",
      secteur: "Transports terrestres durables / ferroviaire / automobile",
      type: "rayonnement",
      source: "https://www.i-trans.org/",
      verifiedOn: "2026-05-18",
    },
  ],

  distances: {
    gareTgv: {
      nom: "Lille-Europe (Eurostar Londres + Thalys Bruxelles/Amsterdam + TGV) + Lille-Flandres à 500 m",
      distanceKm: 0,
      source: "https://www.sncf-connect.com/gares/lille/lille-europe",
    },
    aeroportPrincipal: {
      nom: "Aéroport de Lille-Lesquin (LIL)",
      distanceKm: 11,
      source: "https://en.wikipedia.org/wiki/Lille-Europe_station",
    },
    metroOuTram: {
      lignes: 2,
      source: "https://www.ilevia.fr/",
    },
    verifiedOn: "2026-05-18",
  },

  statsInsee: {
    etablissementsActifs: 28_814,
    creationsEntreprises: 7_060,
    anneeReference: 2023,
    source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-59350",
    verifiedOn: "2026-05-18",
  },

  // ─── Couche 2 — Matière éditoriale unique ───────────────────────────
  marquesHistoriques: [
    {
      nom: "Auchan",
      secteur: "Grande distribution / retail",
      lienVille: "siege",
      source: "https://fr.wikipedia.org/wiki/Auchan",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Decathlon",
      secteur: "Distribution sport / retail",
      lienVille: "siege",
      source: "https://fr.wikipedia.org/wiki/Decathlon",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "La Redoute",
      secteur: "E-commerce / vente à distance / mode",
      lienVille: "siege",
      source: "https://fr.wikipedia.org/wiki/La_Redoute",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "OVHcloud",
      secteur: "Cloud computing / hébergement / IaaS",
      lienVille: "siege",
      source: "https://fr.wikipedia.org/wiki/OVHcloud",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Bonduelle",
      secteur: "Agroalimentaire / légumes transformés",
      lienVille: "siege",
      source: "https://fr.wikipedia.org/wiki/Bonduelle",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Boulanger",
      secteur: "Distribution électroménager / multimédia",
      lienVille: "siege",
      source: "https://fr.wikipedia.org/wiki/Boulanger_(entreprise)",
      verifiedOn: "2026-05-18",
    },
  ],

  produitsIgpAop: [
    {
      nom: "Maroilles (ou Marolles)",
      categorie: "Fromage à pâte molle à croûte lavée",
      signe: "AOP",
      source: "https://www.inao.gouv.fr/produit/maroilles-ou-marolles-13200",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Genièvre Flandre-Artois",
      categorie: "Spiritueux (eau-de-vie de céréales aux baies de genièvre)",
      signe: "IGP",
      source: "https://www.inao.gouv.fr/produit/genievre-flandre-artois-10442",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Ail fumé d'Arleux",
      categorie: "Légume / ail rose fumé tressé",
      signe: "IGP",
      source: "https://www.inao.gouv.fr/produit/ail-fume-darleux-14228",
      verifiedOn: "2026-05-18",
    },
  ],

  salonsSectoriels: [
    {
      nom: "Forum Made in France Première Vision",
      secteur: "Textile / mode / sourcing fabricants français",
      localisation: "Lille Grand Palais",
      lienVille: "accueille",
      source: "https://www.premierevision.com/fr/salons/made-in-france-premiere-vision/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Salon Créer (Hauts-de-France)",
      secteur: "Création / reprise / transmission entreprise",
      localisation: "Lille Grand Palais",
      lienVille: "accueille",
      source: "https://www.saloncreer.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  patrimoineNotable: [
    {
      nom: "Beffroi de l'Hôtel de Ville de Lille (UNESCO depuis 2005)",
      type: "unesco",
      source: "https://whc.unesco.org/en/list/943",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Vieux-Lille (secteur sauvegardé 170 ha)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Vieux-Lille",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Grand'Place (Place du Général de Gaulle) et Vieille Bourse",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Grand%27Place_(Lille)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Palais des Beaux-Arts de Lille",
      type: "musee",
      source: "https://www.pba.lille.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Citadelle de Lille (Vauban, 1667-1670)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Citadelle_de_Lille",
      verifiedOn: "2026-05-18",
    },
  ],

  communesBassin: [
    {
      slug: "villeneuve-d-ascq",
      nameFr: "Villeneuve-d'Ascq",
      distanceKm: 8,
      source: "https://fr.wikipedia.org/wiki/Villeneuve-d%27Ascq",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "roubaix",
      nameFr: "Roubaix",
      distanceKm: 12,
      source: "https://fr.wikipedia.org/wiki/Roubaix",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "tourcoing",
      nameFr: "Tourcoing",
      distanceKm: 14,
      source: "https://fr.wikipedia.org/wiki/Tourcoing",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "marcq-en-baroeul",
      nameFr: "Marcq-en-Barœul",
      distanceKm: 5,
      source: "https://fr.wikipedia.org/wiki/Marcq-en-Bar%C5%93ul",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "wattignies",
      nameFr: "Wattignies",
      distanceKm: 6,
      source: "https://fr.wikipedia.org/wiki/Wattignies",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "croix",
      nameFr: "Croix",
      distanceKm: 9,
      source: "https://fr.wikipedia.org/wiki/Croix_(Nord)",
      verifiedOn: "2026-05-18",
    },
  ],

  // Lille n'a pas de vignoble AOC à ≤ 50 km (Champagne à ~180 km).
  // Champ honnêtement vide pour respecter zéro invention.
  vignoblesProches: [],

  // ─── Couche 3 — Multi-taille TPE/PME/ETI/GE ─────────────────────────

  // Label EPV à compléter Phase 2 du sprint (extraction CSV
  // data.economie.gouv.fr/explore/dataset/entreprises-du-patrimoine-vivant-epv).
  labelsEpvEtArtisanat: [],

  zonesActivitesParcs: [
    {
      nom: "EuraTechnologies (Lille — Le Blan-Lafont, ex-usine textile)",
      type: "parc_tech",
      secteurDominant: "Numérique / IA / SaaS / FrenchTech",
      source: "https://www.euratechnologies.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Euralille (quartier d'affaires central)",
      type: "district_eco",
      secteurDominant: "Tertiaire supérieur / banque / assurance / services",
      source: "https://fr.wikipedia.org/wiki/Euralille_(quartier)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Parc scientifique de la Haute-Borne (Villeneuve-d'Ascq)",
      type: "parc_tech",
      secteurDominant: "Recherche / IT / sciences / Inria",
      source:
        "https://www.lillemetropole.fr/votre-metropole/competences/economie/parcs-dactivites/parc-scientifique-de-la",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Euralimentaire (Marché d'Intérêt National Lomme)",
      type: "parc_tech",
      secteurDominant: "Agroalimentaire frais / supply chain alimentaire",
      source: "https://www.euralimentaire.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  grandesEcolesEtUniversites: [
    {
      nom: "Université de Lille",
      type: "universite",
      specialites: ["Sciences", "Lettres", "Droit", "Santé", "Sciences humaines", "IA"],
      source: "https://www.univ-lille.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "EDHEC Business School (campus Roubaix)",
      type: "ecole_commerce",
      specialites: ["Finance", "Management", "Data Science for Business", "Entrepreneuriat"],
      source: "https://www.edhec.edu/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "IÉSEG School of Management (campus Lille centre)",
      type: "ecole_commerce",
      specialites: ["Management international", "Data Analytics", "Marketing", "Finance"],
      source: "https://www.ieseg.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Centrale Lille Institut (Villeneuve-d'Ascq)",
      type: "ecole_ingenieur",
      specialites: ["Génie informatique", "IA", "Énergie", "Systèmes industriels"],
      source: "https://centralelille.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ENSAIT (École Nationale Supérieure des Arts et Industries Textiles, Roubaix)",
      type: "ecole_ingenieur",
      specialites: ["Textile technique", "Matériaux fibreux", "Mode innovante"],
      source: "https://www.ensait.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "SKEMA Business School (campus Lille)",
      type: "ecole_commerce",
      specialites: ["Management international", "Finance", "Stratégie digitale"],
      source: "https://www.skema-bs.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  polesRechercheRD: [
    {
      nom: "Centre Inria de l'Université de Lille (Villeneuve-d'Ascq + EuraTechnologies)",
      organisme: "inria",
      domaine: "Informatique / IA / data science (15 équipes-projets)",
      source: "https://www.inria.fr/en/inria-centre-university-lille",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "CNRS Délégation Hauts-de-France",
      organisme: "cnrs",
      domaine: "Recherche fondamentale toutes disciplines (CRIStAL, Painlevé)",
      source: "https://www.cnrs.fr/fr/delegation/hauts-de-france",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Inserm Délégation Nord-Ouest (site Lille)",
      organisme: "inserm",
      domaine: "Santé / sciences biomédicales / cancérologie / neurosciences",
      source: "https://www.inserm.fr/delegation/nord-ouest/",
      verifiedOn: "2026-05-18",
    },
  ],

  grandsGroupesImplantes: [
    {
      nom: "Auchan Retail (Groupe Mulliez, siège Croix)",
      secteur: "Grande distribution / retail",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/Auchan",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Decathlon (siège Villeneuve-d'Ascq)",
      secteur: "Distribution articles de sport",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/Decathlon",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "OVHcloud (siège Roubaix)",
      secteur: "Cloud computing / hébergement",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/OVHcloud",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "La Redoute (siège Roubaix)",
      secteur: "E-commerce / mode / maison",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/La_Redoute",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Bonduelle (siège Villeneuve-d'Ascq)",
      secteur: "Agroalimentaire / légumes transformés",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/Bonduelle",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Boulanger (siège Lesquin / métropole lilloise)",
      secteur: "Distribution électroménager / multimédia",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/Boulanger_(entreprise)",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Couche 2bis — tags KB sectorielles ─────────────────────────────
  // Volontairement vide en V1 (Phase B du sprint, alimentation KB Prisma).
  kbSectorTags: ["retail-e-commerce", "logistique-supply-chain", "it-numerique"],

  // ─── Optionnels (hors scoring dashboard) ────────────────────────────
  capitaleFrenchTech: {
    statut: "capitale",
    nomChapitre: "French Tech Lille (labellisation Capitale avril 2019)",
    source: "https://lafrenchtech.com/fr/communaute-french-tech/",
    verifiedOn: "2026-05-18",
  },

  cciCompetente: {
    nom: "CCI Grand Lille (Hauts-de-France)",
    source: "https://www.grand-lille.cci.fr/",
    verifiedOn: "2026-05-18",
  },

  distancesGrandesMetropoles: [
    {
      metropole: "Paris",
      distanceKm: 220,
      tempsMnTgv: 62,
      source: "https://www.sncf-connect.com/gares/lille/lille-europe",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Bruxelles",
      distanceKm: 115,
      tempsMnTgv: 38,
      source: "https://www.sncf-connect.com/gares/lille/lille-europe",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Londres (via Eurostar)",
      distanceKm: 290,
      tempsMnTgv: 82,
      source: "https://www.eurostar.com/us-en/travel-info/your-trip/stations/lille-europe",
      verifiedOn: "2026-05-18",
    },
  ],

  incubateursAccelerateurs: [
    {
      nom: "EuraTechnologies",
      focus:
        "Généraliste tech (1300+ projets, 466 entreprises créées, 5 campus Lille/Roubaix/Saint-Quentin/Willems)",
      source: "https://www.euratechnologies.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Plaine Images (Tourcoing)",
      focus: "Industries créatives / image / jeu vidéo / XR",
      source: "https://www.plaine-images.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Eurasanté (Loos)",
      focus: "Santé / biotech / dispositifs médicaux / e-santé",
      source: "https://www.eurasante.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Spécificités locales hors grille standard ──────────────────────
  specificitesLocales: [
    {
      theme: "hub_ferroviaire_international",
      description:
        "Lille-Europe = unique gare française connectée directement Londres (Eurostar) + Bruxelles + Amsterdam (Thalys). 3e quartier d'affaires France.",
      source: "https://en.wikipedia.org/wiki/Lille-Europe_station",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "capitale_europeenne_culture",
      description:
        "Capitale Européenne de la Culture 2004. Événement bisannuel lille3000 prolonge l'héritage culturel-économique de cette désignation.",
      source: "https://fr.wikipedia.org/wiki/Lille_2004,_Capitale_europ%C3%A9enne_de_la_culture",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Adaptations Lille (zéro invention) ─────────────────────────────
  // Lille n'a pas de vignoble AOC à ≤ 50 km (Champagne à ~180 km, plus
  // proche AOC viticole). Champ structurellement non applicable, exempté
  // du scoring pour ne pas pénaliser injustement la ville.
  notApplicableFields: ["vignoblesProches"],

  // ─── Métadonnées de revue ───────────────────────────────────────────
  lastReviewedOn: "2026-05-18",
  reviewedBy: "Claude Code Opus 4.7 (sprint City Quality V3 ville #10)",
};
