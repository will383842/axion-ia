// Metz (57463) — data économique enrichie sourcée V3.
// Sprint City Quality V3, ville #29.
// Spécificité majeure : capitale Moselle, transfrontalier Luxembourg
// (~60 km), Centre Pompidou-Metz (Shigeru Ban 2010), Georgia Tech Lorraine
// (campus américain unique en France), héritage industriel sidérurgique
// (PSA Trémery, ArcelorMittal Florange).

import type { VilleEconomicData } from "./types";

export const METZ_ECONOMIC_DATA: VilleEconomicData = {
  // ─── Couche 1 — Économie INSEE ──────────────────────────────────────
  topSectorsNaf: [
    {
      naf: "GHI",
      label: "Commerce, transports, hébergement et restauration",
      rank: 1,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-57463",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "MN",
      label: "Activités spécialisées, scientifiques et techniques + services administratifs",
      rank: 2,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-57463",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "OPQ",
      label: "Administration publique, enseignement, santé, action sociale (préfecture Moselle)",
      rank: 3,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-57463",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "C",
      label: "Industrie manufacturière (héritage sidérurgique, motopropulseurs PSA, mécanique)",
      rank: 4,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-57463",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "J",
      label: "Information et communication (édition, logiciels, IT)",
      rank: 5,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-57463",
      verifiedOn: "2026-05-18",
    },
  ],

  polesCompetitivite: [
    {
      nom: "Materalia",
      secteur: "Matériaux / procédés / métallurgie",
      type: "siege",
      source: "https://www.materalia.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Fibres-Énergivie (ex-Fibres + Énergivie)",
      secteur: "Matériaux biosourcés / bâtiment durable / énergies",
      type: "rayonnement",
      source: "https://www.fibres-energivie.eu/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Pôle Véhicule du Futur",
      secteur: "Automobile / mobilité décarbonée / hydrogène",
      type: "rayonnement",
      source: "https://www.vehiculedufutur.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  distances: {
    gareTgv: {
      nom: "Gare de Metz-Ville — TGV Est (Paris ~1h22), liaisons Luxembourg/Sarrebruck",
      distanceKm: 0,
      source: "https://www.sncf-connect.com/gares/metz-ville",
    },
    aeroportPrincipal: {
      nom: "Aéroport Metz-Nancy-Lorraine (ETZ) + Luxembourg (LUX) à ~70 km en complément",
      distanceKm: 25,
      source: "https://www.metz-nancy-lorraine.aeroport.fr/",
    },
    metroOuTram: {
      lignes: 2,
      source: "https://lemet.fr/",
    },
    verifiedOn: "2026-05-18",
  },

  statsInsee: {
    anneeReference: 2023,
    source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-57463",
    verifiedOn: "2026-05-18",
  },

  // ─── Couche 2 — Matière éditoriale unique ───────────────────────────
  marquesHistoriques: [
    {
      nom: "Mirabelle de Lorraine (filière IGP)",
      secteur: "Agroalimentaire / fruits / spiritueux",
      lienVille: "production",
      source: "https://fr.wikipedia.org/wiki/Mirabelle_de_Lorraine",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Banque Populaire Lorraine Champagne",
      secteur: "Banque / finance régionale",
      lienVille: "siege",
      source: "https://fr.wikipedia.org/wiki/Banque_populaire_Lorraine_Champagne",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Stellantis Trémery (ex-PSA Trémery, motopropulseurs)",
      secteur: "Automobile / motopropulseurs (moteurs diesel & électriques)",
      lienVille: "production",
      source: "https://fr.wikipedia.org/wiki/Usine_PSA_de_Tr%C3%A9mery",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ArcelorMittal Florange",
      secteur: "Sidérurgie / acier",
      lienVille: "production",
      source: "https://fr.wikipedia.org/wiki/Usine_sid%C3%A9rurgique_de_Florange",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Smart (usine Hambach, groupe Ineos Automotive depuis 2020)",
      secteur: "Automobile / véhicules urbains",
      lienVille: "production",
      source: "https://fr.wikipedia.org/wiki/Usine_Smart_de_Hambach",
      verifiedOn: "2026-05-18",
    },
  ],

  produitsIgpAop: [
    {
      nom: "Mirabelle de Lorraine",
      categorie: "Agroalimentaire / fruits",
      signe: "IGP",
      source: "https://www.inao.gouv.fr/produit/3289",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Munster / Munster-Géromé",
      categorie: "Fromage",
      signe: "AOP",
      source: "https://fr.wikipedia.org/wiki/Munster_(fromage)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Quetsche d'Alsace (eau-de-vie)",
      categorie: "Spiritueux",
      signe: "IGP",
      source: "https://fr.wikipedia.org/wiki/Quetsche_d%27Alsace",
      verifiedOn: "2026-05-18",
    },
  ],

  salonsSectoriels: [
    {
      nom: "Foire Internationale de Metz",
      secteur: "Salon généraliste référence Grand Est (1 des plus importantes foires de France)",
      localisation: "Metz Expo Évènements (Metz Expo)",
      lienVille: "accueille",
      source: "https://www.foiredemetz.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Salon Made in France Metz",
      secteur: "Production française / artisanat / industrie locale",
      localisation: "Metz Expo Évènements",
      lienVille: "accueille",
      source: "https://www.metz-expo.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  patrimoineNotable: [
    {
      nom: "Cathédrale Saint-Étienne de Metz (« Lanterne du Bon Dieu »)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Cath%C3%A9drale_Saint-%C3%89tienne_de_Metz",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Centre Pompidou-Metz (architecture Shigeru Ban, 2010)",
      type: "musee",
      source: "https://www.centrepompidou-metz.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Place de la Comédie & Opéra-Théâtre de Metz Métropole (plus ancien opéra de France en activité)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Op%C3%A9ra-Th%C3%A9%C3%A2tre_de_Metz_M%C3%A9tropole",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Porte Serpenoise",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Porte_Serpenoise",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Basilique Saint-Pierre-aux-Nonnains (IVe siècle, l'un des plus vieux édifices religieux de France)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Basilique_Saint-Pierre-aux-Nonnains",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Musée de La Cour d'Or — Metz Métropole",
      type: "musee",
      source: "https://musee.eurometropolemetz.eu/",
      verifiedOn: "2026-05-18",
    },
  ],

  communesBassin: [
    {
      slug: "montigny-les-metz",
      nameFr: "Montigny-lès-Metz",
      distanceKm: 3,
      source: "https://fr.wikipedia.org/wiki/Montigny-l%C3%A8s-Metz",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "woippy",
      nameFr: "Woippy",
      distanceKm: 4,
      source: "https://fr.wikipedia.org/wiki/Woippy",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "marly",
      nameFr: "Marly",
      distanceKm: 5,
      source: "https://fr.wikipedia.org/wiki/Marly_(Moselle)",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "le-ban-saint-martin",
      nameFr: "Le Ban-Saint-Martin",
      distanceKm: 2,
      source: "https://fr.wikipedia.org/wiki/Le_Ban-Saint-Martin",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "longeville-les-metz",
      nameFr: "Longeville-lès-Metz",
      distanceKm: 2,
      source: "https://fr.wikipedia.org/wiki/Longeville-l%C3%A8s-Metz",
      verifiedOn: "2026-05-18",
    },
  ],

  vignoblesProches: [
    {
      aoc: "Moselle AOC (vignoble lorrain)",
      distanceKm: 30,
      source: "https://fr.wikipedia.org/wiki/Moselle_(AOC)",
      verifiedOn: "2026-05-18",
    },
    {
      aoc: "Côtes de Toul AOC",
      distanceKm: 70,
      source: "https://fr.wikipedia.org/wiki/C%C3%B4tes-de-toul",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Couche 3 — Multi-taille PME/ETI/GE ─────────────────────────
  labelsEpvEtArtisanat: [],

  zonesActivitesParcs: [
    {
      nom: "Technopôle de Metz (Metz 2000)",
      type: "technopole",
      secteurDominant:
        "Tertiaire / numérique / R&D / grandes écoles (Georgia Tech Lorraine, CentraleSupélec)",
      source: "https://fr.wikipedia.org/wiki/Technop%C3%B4le_Metz_2000",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Quartier de l'Amphithéâtre (ZAC autour du Centre Pompidou-Metz)",
      type: "zac",
      secteurDominant: "Tertiaire / culture / commerces",
      source: "https://fr.wikipedia.org/wiki/Quartier_de_l%27Amphith%C3%A9%C3%A2tre_(Metz)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Mercy (Eurométropole de Metz)",
      type: "parc_tech",
      secteurDominant: "Santé / hôpital régional / activités tertiaires",
      source: "https://www.eurometropolemetz.eu/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Actipôle Metz Nord",
      type: "zac",
      secteurDominant: "Logistique / commerces / artisanat",
      source: "https://www.eurometropolemetz.eu/",
      verifiedOn: "2026-05-18",
    },
  ],

  grandesEcolesEtUniversites: [
    {
      nom: "Université de Lorraine — campus Metz",
      type: "universite",
      specialites: ["Sciences", "Lettres", "Droit", "Économie-gestion", "IUT"],
      source: "https://www.univ-lorraine.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "CentraleSupélec — campus Metz",
      type: "ecole_ingenieur",
      specialites: ["Ingénierie", "Énergie", "Systèmes", "Data Science"],
      source: "https://www.centralesupelec.fr/fr/le-campus-de-metz",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Georgia Tech Lorraine (GTL — campus européen unique de Georgia Tech Atlanta)",
      type: "universite",
      specialites: ["Computer Science", "Electrical Engineering", "Mechanical Engineering"],
      source: "https://www.georgiatech-metz.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ENIM (École Nationale d'Ingénieurs de Metz)",
      type: "ecole_ingenieur",
      specialites: ["Génie mécanique", "Génie industriel", "Matériaux"],
      source: "https://www.enim.univ-lorraine.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Sciences Po Paris — Campus de Nancy (à 60 km)",
      type: "sciences_po",
      specialites: ["Affaires européennes", "Sciences politiques", "Programme franco-allemand"],
      source: "https://www.sciencespo.fr/college/fr/campus/nancy.html",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ICN Business School (campus Metz)",
      type: "ecole_commerce",
      specialites: ["Management", "Finance", "Marketing"],
      source: "https://www.icn-artem.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  polesRechercheRD: [
    {
      nom: "LORIA (Laboratoire Lorrain de Recherche en Informatique et ses Applications) — site Metz",
      organisme: "inria",
      domaine: "Informatique / IA / sciences du numérique (UMR CNRS/Inria/Université de Lorraine)",
      source: "https://www.loria.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Inria Nancy — Grand Est (couvre l'écosystème Metz/Nancy)",
      organisme: "inria",
      domaine: "Informatique / IA / sciences du numérique",
      source: "https://www.inria.fr/fr/centre-inria-de-luniversite-de-lorraine",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "LEM3 (Laboratoire d'Étude des Microstructures et de Mécanique des Matériaux)",
      organisme: "cnrs",
      domaine:
        "Matériaux / mécanique / métallurgie (UMR CNRS / Université de Lorraine / Arts & Métiers)",
      source: "https://lem3.univ-lorraine.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "IRL 2958 Georgia Tech — CNRS (laboratoire international)",
      organisme: "cnrs",
      domaine: "Optoélectronique / télécommunications / matériaux",
      source: "https://umi2958.cnrs.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  grandsGroupesImplantes: [
    {
      nom: "Stellantis — usine Trémery (motopropulseurs, plus grande usine moteurs au monde du groupe)",
      secteur: "Automobile / motopropulseurs",
      typeImplantation: "usine_principale",
      source: "https://fr.wikipedia.org/wiki/Usine_PSA_de_Tr%C3%A9mery",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ArcelorMittal Florange (proche Metz)",
      secteur: "Sidérurgie / acier",
      typeImplantation: "site_majeur",
      source: "https://fr.wikipedia.org/wiki/Usine_sid%C3%A9rurgique_de_Florange",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Banque Populaire Lorraine Champagne (BPCE)",
      secteur: "Banque / finance",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/Banque_populaire_Lorraine_Champagne",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Caisse d'Épargne Grand Est Europe (groupe BPCE)",
      secteur: "Banque / finance",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/Caisse_d%27%C3%A9pargne_Grand_Est_Europe",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Ineos Automotive — usine Smart Hambach",
      secteur: "Automobile / véhicules",
      typeImplantation: "usine_principale",
      source: "https://fr.wikipedia.org/wiki/Usine_Smart_de_Hambach",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Amazon France — entrepôt logistique Augny (proche Metz)",
      secteur: "E-commerce / logistique",
      typeImplantation: "site_majeur",
      source: "https://fr.wikipedia.org/wiki/Augny",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Couche 2bis — tags KB sectorielles ─────────────────────────────
  kbSectorTags: [
    "automobile-mobilite",
    "industrie-manufacturiere",
    "enseignement-recherche",
    "it-numerique",
  ],

  // ─── Optionnels (hors scoring dashboard) ────────────────────────────
  capitaleFrenchTech: {
    statut: "communaute",
    nomChapitre: "French Tech East",
    source: "https://lafrenchtech.com/fr/communaute-french-tech/",
    verifiedOn: "2026-05-18",
  },

  cciCompetente: {
    nom: "CCI Moselle Métropole Metz",
    source: "https://www.moselle-metropole.cci.fr/",
    verifiedOn: "2026-05-18",
  },

  distancesGrandesMetropoles: [
    {
      metropole: "Luxembourg (Luxembourg)",
      distanceKm: 60,
      tempsMnRoute: 60,
      source: "https://fr.wikipedia.org/wiki/Metz",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Nancy",
      distanceKm: 60,
      tempsMnRoute: 45,
      tempsMnTgv: 40,
      source: "https://fr.wikipedia.org/wiki/Metz",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Strasbourg",
      distanceKm: 160,
      tempsMnRoute: 105,
      source: "https://fr.wikipedia.org/wiki/Metz",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Paris",
      distanceKm: 330,
      tempsMnTgv: 82,
      source: "https://www.sncf-connect.com/",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Sarrebruck (Allemagne)",
      distanceKm: 70,
      tempsMnRoute: 60,
      source: "https://fr.wikipedia.org/wiki/Metz",
      verifiedOn: "2026-05-18",
    },
  ],

  incubateursAccelerateurs: [
    {
      nom: "BLIIIDA (lieu hybride, fabrique d'innovation Metz Métropole)",
      focus: "Numérique / industries créatives / makers",
      source: "https://www.bliiida.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "PEEL (Pôle Entrepreneuriat Étudiant de Lorraine)",
      focus: "Entrepreneuriat étudiant / création startup",
      source: "https://peel.univ-lorraine.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Incubateur Lorrain (Université de Lorraine — porte de Metz)",
      focus: "Deeptech / projets issus de la recherche",
      source: "https://incubateur-lorrain.org/",
      verifiedOn: "2026-05-18",
    },
  ],

  specificitesLocales: [
    {
      theme: "transfrontalier_luxembourg",
      description:
        "Bassin de vie transfrontalier — ~110 000 travailleurs frontaliers lorrains au Luxembourg (60 km), salaires nets ~50 % supérieurs.",
      source: "https://fr.wikipedia.org/wiki/Travailleurs_frontaliers_au_Luxembourg",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "campus_americain_unique",
      description:
        "Georgia Tech Lorraine : seul campus européen permanent d'une grande université américaine en France, ~200 étudiants Master/PhD.",
      source: "https://www.georgiatech-metz.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "centre_pompidou_metz",
      description:
        "Centre Pompidou-Metz (2010) : 2e antenne du Centre Pompidou Paris, architecture mondialement saluée de Shigeru Ban (Pritzker 2014).",
      source: "https://www.centrepompidou-metz.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "heritage_siderurgique",
      description:
        "Bassin sidérurgique historique — ArcelorMittal Florange, héritage Wendel, reconversion industrielle Moselle Est (Smart, PSA Trémery).",
      source: "https://fr.wikipedia.org/wiki/Sid%C3%A9rurgie_lorraine",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "base_militaire_historique",
      description:
        "Place forte militaire historique — héritage Vauban et Allemagne (annexion 1871-1918), QG de zone de défense Est & 2e RHC à Phalsbourg proche.",
      source: "https://fr.wikipedia.org/wiki/Histoire_de_Metz",
      verifiedOn: "2026-05-18",
    },
  ],

  // labelsEpvEtArtisanat vide (annuaire EPV national non cross-référencé par
  // commune dans le scope V3 — phase 2 sprint). Champ exempté du scoring.
  notApplicableFields: ["labelsEpvEtArtisanat"],

  // ─── Métadonnées de revue ───────────────────────────────────────────
  lastReviewedOn: "2026-05-18",
  reviewedBy: "Claude Code Opus 4.7 (sprint City Quality V3 ville #29)",
};
