// Nantes (44109) — data économique enrichie sourcée V3 multi-taille.
//
// Sprint City Quality V3 2026-05-18, ville n°6.
// Contrat zéro invention : chaque champ a un `source` vérifiable.
//
// Sources canoniques utilisées :
//   - INSEE dossier complet commune 44109 (2011101)
//   - competitivite.gouv.fr — pôles Phase V 2023-2026
//   - Sites officiels pôles (pole-emc2.fr, atlanpole-biotherapies.com, images-et-reseaux.com)
//   - SNCF Connect (gare) + Aéroport Nantes Atlantique + Semitan (tram)
//   - Wikipédia articles entreprises/écoles/patrimoine
//   - inria.fr (centre Rennes - Bretagne Atlantique, antenne Nantes) + cnrs.fr
//   - INAO (Muscadet AOC, Gros Plant du Pays Nantais IGP)
//   - Sites officiels salons (foire-nantes.fr, sea-tech-week.com)
//   - Sites officiels écoles (audencia.com, ec-nantes.fr, imt-atlantique.fr, univ-nantes.fr)
//
// Reviewer : Claude Code Opus 4.7 (sprint City Quality V3 ville #6).

import type { VilleEconomicData } from "./types";

export const NANTES_ECONOMIC_DATA: VilleEconomicData = {
  // ─── Couche 1 — Économie INSEE ──────────────────────────────────────
  topSectorsNaf: [
    {
      naf: "GHI",
      label: "Commerce, transports, hébergement et restauration (sections G+H+I)",
      rank: 1,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-44109",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "MN",
      label:
        "Activités spécialisées, scientifiques et techniques + services administratifs (sections M+N)",
      rank: 2,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-44109",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "OPQ",
      label: "Administration publique, enseignement, santé, action sociale (sections O+P+Q)",
      rank: 3,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-44109",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "F",
      label: "Construction",
      rank: 4,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-44109",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "J",
      label: "Information et communication (édition, logiciels, IT, médias)",
      rank: 5,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-44109",
      verifiedOn: "2026-05-18",
    },
  ],

  polesCompetitivite: [
    {
      nom: "EMC2",
      secteur: "Manufacturing avancé / robotique / matériaux composites / procédés industriels",
      type: "siege",
      source: "https://www.pole-emc2.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Atlanpole Biotherapies",
      secteur: "Biothérapies / santé / immunothérapie / médecine régénérative",
      type: "siege",
      source: "https://www.atlanpolebiotherapies.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Images & Réseaux",
      secteur: "Numérique / IoT / réseaux / cybersécurité / image et son",
      type: "rayonnement",
      source: "https://www.images-et-reseaux.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Végépolys Valley",
      secteur: "Végétal / agriculture / horticulture / agroalimentaire",
      type: "rayonnement",
      source: "https://www.vegepolys-valley.eu/",
      verifiedOn: "2026-05-18",
    },
  ],

  distances: {
    gareTgv: {
      nom: "Gare de Nantes (intra-muros) — TGV Atlantique Paris-Montparnasse en 2h",
      distanceKm: 0,
      source: "https://www.sncf-connect.com/gares/nantes",
    },
    aeroportPrincipal: {
      nom: "Aéroport Nantes Atlantique (Bouguenais)",
      distanceKm: 8,
      source: "https://www.nantes.aeroport.fr/",
    },
    metroOuTram: {
      lignes: 3,
      source: "https://www.tan.fr/fr/plan-du-reseau",
    },
    verifiedOn: "2026-05-18",
  },

  statsInsee: {
    anneeReference: 2023,
    source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-44109",
    verifiedOn: "2026-05-18",
  },

  // ─── Couche 2 — Matière éditoriale unique ───────────────────────────
  marquesHistoriques: [
    {
      nom: "LU (Lefèvre-Utile)",
      secteur: "Biscuiterie / agroalimentaire",
      lienVille: "fondation",
      source: "https://fr.wikipedia.org/wiki/Lu_(entreprise)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Béghin-Say",
      secteur: "Sucrerie / agroalimentaire",
      lienVille: "production",
      source: "https://fr.wikipedia.org/wiki/B%C3%A9ghin-Say",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Brissonneau et Lotz",
      secteur: "Construction navale / ferroviaire (héritage industriel)",
      lienVille: "heritage",
      source: "https://fr.wikipedia.org/wiki/Brissonneau_et_Lotz",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Chantiers de l'Atlantique (héritage Nantes — siège Saint-Nazaire)",
      secteur: "Construction navale",
      lienVille: "heritage",
      source: "https://fr.wikipedia.org/wiki/Chantiers_de_l%27Atlantique",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Petit Navire",
      secteur: "Agroalimentaire / conserves de poisson",
      lienVille: "siege",
      source: "https://fr.wikipedia.org/wiki/Petit_Navire",
      verifiedOn: "2026-05-18",
    },
  ],

  produitsIgpAop: [
    {
      nom: "Muscadet (AOC) — Sèvre-et-Maine, Coteaux-de-la-Loire, Côtes-de-Grandlieu",
      categorie: "vin",
      signe: "AOC",
      source: "https://www.inao.gouv.fr/produit/3469",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Gros Plant du Pays Nantais (IGP)",
      categorie: "vin",
      signe: "IGP",
      source: "https://www.inao.gouv.fr/produit/3439",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Mâche Nantaise (IGP)",
      categorie: "agroalimentaire",
      signe: "IGP",
      source: "https://www.inao.gouv.fr/produit/2549",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Volailles de Loué — couvre Pays de la Loire (Label Rouge + IGP)",
      categorie: "agroalimentaire",
      signe: "IGP",
      source: "https://www.inao.gouv.fr/produit/3437",
      verifiedOn: "2026-05-18",
    },
  ],

  salonsSectoriels: [
    {
      nom: "Foire Internationale de Nantes",
      secteur: "Généraliste / habitat / loisirs / artisanat",
      localisation: "Parc des Expositions de la Beaujoire, Nantes",
      lienVille: "accueille",
      source: "https://www.foiredenantes.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Sea Tech Week",
      secteur: "Technologies marines / océanographie / EMR / naval",
      localisation: "Brest (secteur pertinent pour cluster maritime Nantes)",
      lienVille: "secteur_pertinent",
      source: "https://www.seatechweek-brest.org/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Web2Day",
      secteur: "Tech / digital / startups",
      localisation: "Cité des Congrès, Nantes",
      lienVille: "accueille",
      source: "https://web2day.co/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "SIVAL Angers",
      secteur: "Filière végétale / horticulture / arboriculture (secteur Pays de la Loire)",
      localisation: "Angers (secteur pertinent bassin Pays de la Loire)",
      lienVille: "secteur_pertinent",
      source: "https://www.sival-angers.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  patrimoineNotable: [
    {
      nom: "Château des Ducs de Bretagne",
      type: "monument",
      source: "https://www.chateaunantes.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Les Machines de l'Île (Grand Éléphant, Carrousel des Mondes Marins)",
      type: "autre",
      source: "https://www.lesmachines-nantes.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Cathédrale Saint-Pierre-et-Saint-Paul de Nantes",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Cath%C3%A9drale_Saint-Pierre-et-Saint-Paul_de_Nantes",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Musée d'arts de Nantes",
      type: "musee",
      source: "https://museedartsdenantes.nantesmetropole.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Passage Pommeraye (galerie marchande XIXe classée Monument historique)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Passage_Pommeraye",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Mémorial de l'abolition de l'esclavage",
      type: "monument",
      source: "https://memorial.nantes.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  communesBassin: [
    {
      slug: "saint-herblain",
      nameFr: "Saint-Herblain",
      distanceKm: 6,
      source: "https://fr.wikipedia.org/wiki/Saint-Herblain",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "reze",
      nameFr: "Rezé",
      distanceKm: 5,
      source: "https://fr.wikipedia.org/wiki/Rez%C3%A9",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "orvault",
      nameFr: "Orvault",
      distanceKm: 7,
      source: "https://fr.wikipedia.org/wiki/Orvault",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "saint-sebastien-sur-loire",
      nameFr: "Saint-Sébastien-sur-Loire",
      distanceKm: 5,
      source: "https://fr.wikipedia.org/wiki/Saint-S%C3%A9bastien-sur-Loire",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "vertou",
      nameFr: "Vertou",
      distanceKm: 9,
      source: "https://fr.wikipedia.org/wiki/Vertou",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "bouguenais",
      nameFr: "Bouguenais",
      distanceKm: 8,
      source: "https://fr.wikipedia.org/wiki/Bouguenais",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "carquefou",
      nameFr: "Carquefou",
      distanceKm: 10,
      source: "https://fr.wikipedia.org/wiki/Carquefou",
      verifiedOn: "2026-05-18",
    },
  ],

  vignoblesProches: [
    {
      aoc: "Muscadet Sèvre-et-Maine (vignoble nantais)",
      distanceKm: 15,
      source: "https://fr.wikipedia.org/wiki/Muscadet_s%C3%A8vre-et-maine",
      verifiedOn: "2026-05-18",
    },
    {
      aoc: "Muscadet Côtes-de-Grandlieu",
      distanceKm: 25,
      source: "https://fr.wikipedia.org/wiki/Muscadet_c%C3%B4tes-de-grandlieu",
      verifiedOn: "2026-05-18",
    },
    {
      aoc: "Muscadet Coteaux-de-la-Loire",
      distanceKm: 30,
      source: "https://fr.wikipedia.org/wiki/Muscadet_coteaux-de-la-loire",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Couche 3 — Multi-taille TPE/PME/ETI/GE ─────────────────────────

  // Label EPV : sans source individuelle confirmée par entreprise pour Nantes,
  // champ honnêtement vide pour respecter zéro invention. Annuaire officiel :
  // https://www.epv.org/annuaire
  labelsEpvEtArtisanat: [],

  zonesActivitesParcs: [
    {
      nom: "Atlanpole — technopôle de Nantes",
      type: "technopole",
      secteurDominant:
        "Biotech / numérique / mer / industrie avancée (5 sites dont Chantrerie, La Chantrerie)",
      source: "https://www.atlanpole.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Île de Nantes (quartier de la création + cluster numérique)",
      type: "district_eco",
      secteurDominant: "Industries culturelles et créatives / numérique / tertiaire",
      source: "https://www.iledenantes.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ZAC Euronantes Gare",
      type: "zac",
      secteurDominant: "Tertiaire supérieur / quartier d'affaires",
      source: "https://www.nantesmetropole.fr/grands-projets/euronantes",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Parc d'activités de la Chantrerie",
      type: "parc_tech",
      secteurDominant: "Enseignement supérieur / R&D / numérique",
      source: "https://fr.wikipedia.org/wiki/La_Chantrerie",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Zone Industrialo-Portuaire Nantes-Saint-Nazaire (GPMNSN)",
      type: "autre",
      secteurDominant: "Logistique / industrie / énergie / agroalimentaire",
      source: "https://www.nantes.port.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  grandesEcolesEtUniversites: [
    {
      nom: "Audencia Business School",
      type: "ecole_commerce",
      specialites: ["Management", "Finance", "Marketing", "RSE", "Data & IA"],
      source: "https://www.audencia.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Centrale Nantes (École Centrale de Nantes)",
      type: "ecole_ingenieur",
      specialites: [
        "Ingénierie généraliste",
        "Mécanique",
        "Énergies marines",
        "Robotique",
        "Data Science",
      ],
      source: "https://www.ec-nantes.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "IMT Atlantique (campus Nantes — fusion Mines Nantes + Télécom Bretagne)",
      type: "ecole_ingenieur",
      specialites: ["Numérique", "Énergie", "Environnement", "Cybersécurité", "IA"],
      source: "https://www.imt-atlantique.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Nantes Université",
      type: "universite",
      specialites: ["Sciences", "Médecine", "Droit", "Lettres", "IA & Data Science (Master)"],
      source: "https://www.univ-nantes.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Polytech Nantes",
      type: "ecole_ingenieur",
      specialites: ["Génie civil", "Informatique", "Électronique", "Thermique-Énergétique"],
      source: "https://polytech.univ-nantes.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ONIRIS (École nationale vétérinaire, agroalimentaire et de l'alimentation)",
      type: "ecole_ingenieur",
      specialites: ["Vétérinaire", "Agroalimentaire", "Sécurité sanitaire"],
      source: "https://www.oniris-nantes.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  polesRechercheRD: [
    {
      nom: "Inria — antenne Nantes (centre Rennes - Bretagne Atlantique)",
      organisme: "inria",
      domaine: "Informatique / IA / sciences du numérique / réalité virtuelle",
      source: "https://www.inria.fr/fr/centre-inria-rennes-bretagne-atlantique",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "CNRS — délégation Bretagne Pays de la Loire (sites Nantes)",
      organisme: "cnrs",
      domaine: "Recherche fondamentale multidisciplinaire",
      source: "https://www.bretagne-paysdelaloire.cnrs.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "INSERM — délégation régionale Grand Ouest (sites Nantes, CRTI)",
      organisme: "inserm",
      domaine: "Santé / immunologie / transplantation / cancérologie",
      source: "https://www.inserm.fr/nous-connaitre/implantations/grand-ouest/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "IRT Jules Verne",
      organisme: "autre",
      domaine: "Manufacturing avancé / composites / robotique industrielle",
      source: "https://www.irt-jules-verne.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  grandsGroupesImplantes: [
    {
      nom: "Airbus (site Bouguenais — composants A350, A320, A380)",
      secteur: "Aéronautique",
      typeImplantation: "site_majeur",
      source: "https://fr.wikipedia.org/wiki/Airbus#Sites_de_production",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Manitou Group",
      secteur: "Machines de manutention / BTP / agriculture (siège Ancenis ~40 km)",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/Manitou_(entreprise)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Bouygues Construction (Bouygues Bâtiment Grand Ouest — siège régional Nantes)",
      secteur: "BTP / construction",
      typeImplantation: "site_majeur",
      source: "https://www.bouygues-construction.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "STX France / Chantiers de l'Atlantique (Saint-Nazaire — bassin économique Nantes)",
      secteur: "Construction navale",
      typeImplantation: "site_majeur",
      source: "https://chantiers-atlantique.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Capgemini (site Nantes)",
      secteur: "Conseil / ESN / IT",
      typeImplantation: "site_majeur",
      source: "https://www.capgemini.com/fr-fr/nos-bureaux/nantes/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "BNP Paribas (siège régional Ouest Nantes)",
      secteur: "Banque",
      typeImplantation: "site_majeur",
      source: "https://group.bnpparibas/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Lactalis (siège Laval ~75 km, sites collecte Loire-Atlantique)",
      secteur: "Agroalimentaire / produits laitiers",
      typeImplantation: "site_majeur",
      source: "https://fr.wikipedia.org/wiki/Lactalis",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Couche 2bis — tags KB sectorielles ─────────────────────────────
  // Volontairement vide en V1 : la KB Prisma ne contient pas encore
  // d'entries sectorielles dédiées (Phase B du sprint).
  kbSectorTags: ["aerospatial-defense", "agroalimentaire-igp", "it-numerique"],

  // ─── Optionnels (hors scoring dashboard) ────────────────────────────
  capitaleFrenchTech: {
    statut: "capitale",
    nomChapitre: "French Tech Nantes",
    source: "https://lafrenchtech-nantes.com/",
    verifiedOn: "2026-05-18",
  },

  cciCompetente: {
    nom: "CCI Nantes Saint-Nazaire",
    source: "https://www.nantesstnazaire.cci.fr/",
    verifiedOn: "2026-05-18",
  },

  distancesGrandesMetropoles: [
    {
      metropole: "Paris",
      distanceKm: 385,
      tempsMnTgv: 120,
      source: "https://www.sncf-connect.com/",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Rennes",
      distanceKm: 110,
      tempsMnRoute: 75,
      source: "https://fr.wikipedia.org/wiki/Nantes",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Bordeaux",
      distanceKm: 350,
      tempsMnRoute: 230,
      source: "https://fr.wikipedia.org/wiki/Nantes",
      verifiedOn: "2026-05-18",
    },
  ],

  incubateursAccelerateurs: [
    {
      nom: "Atlanpole (incubateur technologique régional)",
      focus: "Deeptech / biotech / numérique / industrie",
      source: "https://www.atlanpole.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "La Cantine numérique de Nantes",
      focus: "Numérique / startups tech / coworking",
      source: "https://lacantine.co/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "IMT Starter (incubateur IMT Atlantique)",
      focus: "Deeptech / IA / cybersécurité / numérique",
      source: "https://www.imt-atlantique.fr/fr/entreprise/incubateur",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Spécificités locales ───────────────────────────────────────────
  specificitesLocales: [
    {
      theme: "industries_culturelles_creatives",
      description:
        "Quartier de la création sur l'Île de Nantes : ~500 entreprises ICC, écoles d'art et design, cluster numérique-culture unique en France.",
      source: "https://www.iledenantes.com/projets/quartier-de-la-creation/",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "energies_marines_renouvelables",
      description:
        "Pôle EMR Pays de la Loire : Chantiers de l'Atlantique (éolien offshore), Centrale Nantes (École), test-site SEM-REV au large du Croisic.",
      source: "https://www.weamec.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "port_grand_ouest",
      description:
        "Grand Port Maritime Nantes-Saint-Nazaire : 1er port de la façade atlantique française (~25 Mt/an), import GNL, agroalimentaire, bois.",
      source: "https://www.nantes.port.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Métadonnées de revue ───────────────────────────────────────────
  lastReviewedOn: "2026-05-18",
  reviewedBy: "Claude Code Opus 4.7 (sprint City Quality V3 ville #6)",
};
