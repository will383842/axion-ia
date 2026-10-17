// Paris (75056) — data économique enrichie sourcée V3 multi-taille.
//
// Sprint City Quality 6 pilote 2026-05-18, ville n°1.
// Contrat zéro invention : chaque champ a un `source` vérifiable.
//
// Sources canoniques utilisées :
//   - INSEE dossier complet commune 75056 (2011101)
//   - competitivite.gouv.fr — pôles Phase V 2023-2026
//   - Sites officiels pôles (capdigital.com, finance-innovation.org, …)
//   - SNCF Connect (gares + CDG) + RATP (métro) + distance.to (Orly)
//   - Wikipédia articles entreprises/écoles/UNESCO
//   - inria.fr (centres Inria) + cnrs.fr (siège)
//   - UNESCO Centre du patrimoine mondial (whc.unesco.org/en/list/600)
//   - Sites officiels salons (vivatechnology.com, sialparis.fr, etc.)
//
// Reviewer : Claude Code Opus 4.7 (session autopilote 2026-05-18 soir).

import type { VilleEconomicData } from "./types";

export const PARIS_ECONOMIC_DATA: VilleEconomicData = {
  // ─── Couche 1 — Économie INSEE ──────────────────────────────────────
  topSectorsNaf: [
    {
      naf: "MN",
      label:
        "Activités spécialisées, scientifiques et techniques + services administratifs (sections M+N)",
      rank: 1,
      etablissementsCount: 187_690,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-75056",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "GHI",
      label: "Commerce, transports, hébergement et restauration (sections G+H+I)",
      rank: 2,
      etablissementsCount: 96_592,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-75056",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "OPQ",
      label: "Administration publique, enseignement, santé, action sociale (sections O+P+Q)",
      rank: 3,
      etablissementsCount: 52_460,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-75056",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "J",
      label: "Information et communication (édition, logiciels, IT, médias)",
      rank: 4,
      etablissementsCount: 47_408,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-75056",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "K",
      label: "Activités financières et d'assurance",
      rank: 5,
      etablissementsCount: 39_339,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-75056",
      verifiedOn: "2026-05-18",
    },
  ],

  polesCompetitivite: [
    {
      nom: "Cap Digital Paris-Région",
      secteur: "Numérique / IA / transformation digitale",
      type: "rayonnement",
      source: "https://www.capdigital.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Finance Innovation",
      secteur: "FinTech / InsurTech / RegTech / Asset Management",
      type: "rayonnement",
      source: "https://finance-innovation.org/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Systematic Paris-Region",
      secteur: "Logiciels critiques / cybersécurité / IA / systèmes complexes",
      type: "rayonnement",
      source: "https://systematic-paris-region.org/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Medicen Paris Region",
      secteur: "Santé / biotech / dispositifs médicaux / e-santé",
      type: "rayonnement",
      source: "https://www.medicen.org/",
      verifiedOn: "2026-05-18",
    },
  ],

  distances: {
    gareTgv: {
      nom: "Gare de Lyon (Paris 12e) — TGV Sud-Est/Méditerranée. Paris compte 6 gares TGV intra-muros.",
      distanceKm: 0,
      source: "https://www.sncf-connect.com/gares/paris-gare-de-lyon",
    },
    aeroportPrincipal: {
      nom: "Paris-Charles de Gaulle (CDG) — Orly à 14 km en complément",
      distanceKm: 25,
      source: "https://www.sncf-connect.com/gares/aeroport-charles-de-gaulle-2-tgv",
    },
    metroOuTram: {
      lignes: 16,
      source: "https://www.ratp.fr/en/plan-metro",
    },
    verifiedOn: "2026-05-18",
  },

  statsInsee: {
    etablissementsActifs: 531_999,
    creationsEntreprises: 119_767,
    densiteEtablissementsPour1000: 253,
    anneeReference: 2023,
    source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-75056",
    verifiedOn: "2026-05-18",
  },

  // ─── Couche 2 — Matière éditoriale unique ───────────────────────────
  marquesHistoriques: [
    {
      nom: "Hermès",
      secteur: "Maroquinerie / mode / luxe",
      lienVille: "fondation",
      source: "https://fr.wikipedia.org/wiki/Herm%C3%A8s_(entreprise)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Louis Vuitton",
      secteur: "Maroquinerie / mode / luxe",
      lienVille: "fondation",
      source: "https://fr.wikipedia.org/wiki/Louis_Vuitton_(entreprise)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Cartier",
      secteur: "Joaillerie / horlogerie",
      lienVille: "fondation",
      source: "https://fr.wikipedia.org/wiki/Cartier_(entreprise)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Chanel",
      secteur: "Mode / parfumerie / luxe",
      lienVille: "fondation",
      source: "https://fr.wikipedia.org/wiki/Chanel",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "L'Oréal",
      secteur: "Cosmétiques / beauté",
      lienVille: "fondation",
      source: "https://fr.wikipedia.org/wiki/L%27Or%C3%A9al",
      verifiedOn: "2026-05-18",
    },
  ],

  // Paris commune n'a pas d'IGP/AOP propre. L'IGP "Île-de-France"
  // (vin) couvre la région large, pas la commune. Champ honnêtement vide
  // pour respecter zéro invention. Source pour vérification :
  // https://www.inao.gouv.fr/Espace-professionnel-et-outils/Rechercher-un-signe-officiel
  produitsIgpAop: [],

  salonsSectoriels: [
    {
      nom: "VivaTech",
      secteur: "Innovation / tech / startups",
      localisation: "Paris Expo Porte de Versailles",
      lienVille: "accueille",
      source: "https://vivatechnology.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "SIAL Paris",
      secteur: "Agroalimentaire (référence mondiale)",
      localisation: "Paris Nord Villepinte",
      lienVille: "accueille",
      source: "https://www.sialparis.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Maison&Objet",
      secteur: "Design / décoration / art de vivre",
      localisation: "Paris Nord Villepinte",
      lienVille: "accueille",
      source: "https://www.maison-objet.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Mondial de l'Auto",
      secteur: "Automobile / mobilité",
      localisation: "Paris Expo Porte de Versailles",
      lienVille: "accueille",
      source: "https://www.mondial-paris.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Salon International de l'Agriculture",
      secteur: "Agriculture / agroalimentaire",
      localisation: "Paris Expo Porte de Versailles",
      lienVille: "accueille",
      source: "https://www.salon-agriculture.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  patrimoineNotable: [
    {
      nom: "Paris, Rives de la Seine (UNESCO depuis 1991)",
      type: "unesco",
      source: "https://whc.unesco.org/en/list/600",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Cathédrale Notre-Dame de Paris",
      type: "monument",
      source: "https://www.notredamedeparis.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Musée du Louvre",
      type: "musee",
      source: "https://www.louvre.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Tour Eiffel",
      type: "monument",
      source: "https://www.toureiffel.paris/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Hôtel des Invalides",
      type: "monument",
      source: "https://www.musee-armee.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  communesBassin: [
    {
      slug: "boulogne-billancourt",
      nameFr: "Boulogne-Billancourt",
      distanceKm: 4,
      source: "https://fr.wikipedia.org/wiki/Boulogne-Billancourt",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "saint-denis",
      nameFr: "Saint-Denis",
      distanceKm: 6,
      source: "https://fr.wikipedia.org/wiki/Saint-Denis_(Seine-Saint-Denis)",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "neuilly-sur-seine",
      nameFr: "Neuilly-sur-Seine",
      distanceKm: 5,
      source: "https://fr.wikipedia.org/wiki/Neuilly-sur-Seine",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "vincennes",
      nameFr: "Vincennes",
      distanceKm: 4,
      source: "https://fr.wikipedia.org/wiki/Vincennes",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "levallois-perret",
      nameFr: "Levallois-Perret",
      distanceKm: 6,
      source: "https://fr.wikipedia.org/wiki/Levallois-Perret",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "issy-les-moulineaux",
      nameFr: "Issy-les-Moulineaux",
      distanceKm: 6,
      source: "https://fr.wikipedia.org/wiki/Issy-les-Moulineaux",
      verifiedOn: "2026-05-18",
    },
  ],

  // Paris n'a pas de vignoble AOC à ≤50 km (Champagne à ~150 km, Chablis
  // à ~180 km). Vignoble symbolique de Montmartre confidentiel, hors AOC.
  // Champ honnêtement vide.
  vignoblesProches: [],

  // ─── Couche 3 — Multi-taille TPE/PME/ETI/GE ─────────────────────────

  // Label EPV : 1300 entreprises labellisées en France, beaucoup à Paris.
  // Sans source individuelle confirmée par entreprise, champ vide pour
  // respecter zéro invention. À compléter en cross-référençant l'annuaire
  // officiel data.economie.gouv.fr/explore/dataset/entreprises-du-patrimoine-vivant-epv
  // (Phase 2 du sprint, demande extraction CSV du jeu de données).
  labelsEpvEtArtisanat: [],

  zonesActivitesParcs: [
    {
      nom: "Paris Rive Gauche (ZAC 75013)",
      type: "zac",
      secteurDominant: "Tertiaire / université / recherche",
      source: "https://www.semapa.fr/paris-rive-gauche",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Clichy-Batignolles (75017)",
      type: "zac",
      secteurDominant: "Tertiaire / mixte",
      source: "https://www.parisetmetropole-amenagement.fr/clichy-batignolles",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Bercy / Bercy-Charenton (75012)",
      type: "zac",
      secteurDominant: "Tertiaire / finance",
      source: "https://fr.wikipedia.org/wiki/Quartier_de_Bercy",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Quartier Central des Affaires Opéra-Madeleine-Vendôme",
      type: "district_eco",
      secteurDominant: "Finance / siège sociaux / luxe",
      source: "https://fr.wikipedia.org/wiki/Quartier_central_des_affaires_de_Paris",
      verifiedOn: "2026-05-18",
    },
  ],

  grandesEcolesEtUniversites: [
    {
      nom: "École Normale Supérieure (ENS Ulm, 75005)",
      type: "ens",
      specialites: ["Sciences fondamentales", "IA", "Lettres", "Sciences sociales"],
      source: "https://www.ens.psl.eu/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Sciences Po (75007)",
      type: "sciences_po",
      specialites: ["Sciences politiques", "Affaires publiques", "Économie"],
      source: "https://www.sciencespo.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Sorbonne Université (75005)",
      type: "universite",
      specialites: ["Sciences", "Lettres", "Médecine", "Ingénierie"],
      source: "https://www.sorbonne-universite.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Université Paris-Dauphine PSL (75016)",
      type: "universite",
      specialites: ["Économie", "Gestion", "Mathématiques de la décision"],
      source: "https://dauphine.psl.eu/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Mines Paris — PSL (75006)",
      type: "ecole_ingenieur",
      specialites: ["Ingénierie", "Énergie", "Matériaux", "Data Science"],
      source: "https://www.minesparis.psl.eu/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Conservatoire National des Arts et Métiers (Cnam, 75003)",
      type: "universite",
      specialites: ["Formation continue", "Ingénierie", "Sciences industrielles"],
      source: "https://www.cnam.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  polesRechercheRD: [
    {
      nom: "Inria Paris Centre (75013, rue Barrault)",
      organisme: "inria",
      domaine: "Informatique / IA / sciences du numérique",
      source: "https://www.inria.fr/en/inria-paris-centre",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "CNRS Siège (75016, campus Gérard-Mégie)",
      organisme: "cnrs",
      domaine: "Recherche fondamentale toutes disciplines",
      source: "https://www.cnrs.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "INSERM (sites Paris)",
      organisme: "inserm",
      domaine: "Santé / sciences biomédicales",
      source: "https://www.inserm.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  grandsGroupesImplantes: [
    {
      nom: "LVMH",
      secteur: "Luxe / mode / cosmétiques",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/LVMH",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "BNP Paribas",
      secteur: "Banque / finance",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/BNP_Paribas",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Hermès International",
      secteur: "Luxe / maroquinerie / mode",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/Herm%C3%A8s_(entreprise)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Sanofi",
      secteur: "Pharmaceutique / santé",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/Sanofi",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "AXA",
      secteur: "Assurance",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/Axa",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "L'Oréal",
      secteur: "Cosmétiques",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/L%27Or%C3%A9al",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Couche 2bis — tags KB sectorielles ─────────────────────────────
  // Volontairement vide en V1 : la KB Prisma ne contient pas encore
  // d'entries sectorielles dédiées (Phase B du sprint).
  kbSectorTags: [
    "conseil-affaires",
    "banque-finance",
    "it-numerique",
    "mode-luxe-maroquinerie",
    "immobilier-pro",
    "juridique",
    "communication-medias",
    "administration-publique",
  ],

  // ─── Optionnels (hors scoring dashboard) ────────────────────────────
  capitaleFrenchTech: {
    statut: "siege_national",
    nomChapitre: "French Tech Paris (Station F + écosystème national)",
    source: "https://lafrenchtech.com/",
    verifiedOn: "2026-05-18",
  },

  cciCompetente: {
    nom: "CCI Paris Île-de-France",
    source: "https://www.cci-paris-idf.fr/",
    verifiedOn: "2026-05-18",
  },

  // distancesGrandesMetropoles : N/A pour Paris (Paris EST la métropole).

  incubateursAccelerateurs: [
    {
      nom: "Station F",
      focus: "Généraliste (1000+ startups), plus grand campus startups au monde",
      source: "https://stationf.co/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Wilco",
      focus: "Accélération / scale-up tech",
      source: "https://www.wilco-startup.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "NUMA Paris",
      focus: "Tech / startups B2B",
      source: "https://numa.co/",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Adaptations Paris (zéro invention) ─────────────────────────────
  // Paris commune n'a pas d'IGP/AOP propre (l'IGP Vin de Pays Île-de-France
  // 2020 couvre la région large) ni de vignoble AOC à ≤ 50 km (Champagne
  // à ~150 km). Ces champs sont structurellement non applicables, exemptés
  // du scoring pour ne pas pénaliser injustement la ville.
  notApplicableFields: ["produitsIgpAop", "vignoblesProches"],

  // ─── Métadonnées de revue ───────────────────────────────────────────
  lastReviewedOn: "2026-05-18",
  reviewedBy: "Claude Code Opus 4.7 (session autopilote sprint City Quality V3)",
};
