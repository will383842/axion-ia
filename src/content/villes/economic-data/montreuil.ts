// Montreuil (93048) — data économique enrichie sourcée V3 multi-taille.
//
// Sprint City Quality 6 pilote 2026-05-18, ville n°35.
// Contrat zéro invention : chaque champ a un `source` vérifiable.
//
// Sources canoniques utilisées :
//   - INSEE dossier complet commune 93048 (2011101)
//   - competitivite.gouv.fr — pôles Phase V 2023-2026
//   - Sites officiels (capdigital.com, ubisoft.com, afd.fr, bnpparibas.fr…)
//   - SNCF/RATP/IDFM (métro + RER)
//   - Wikipédia articles entreprises/écoles/patrimoine
//   - cci-paris-idf.fr (CCI Seine-Saint-Denis)
//
// Profil ville : 4e ville d'Île-de-France par la population (~111 000 hab),
// limitrophe Paris 20e (Porte de Bagnolet, Porte de Montreuil). Connue
// pour le siège mondial d'Ubisoft (jeu vidéo), le siège AFD (Agence
// Française de Développement), BNP Paribas Personal Finance, et le
// patrimoine maraîcher des Murs à pêches. Pas d'IGP/AOP propre ni de
// vignoble AOC ≤ 50 km — exempté du scoring via notApplicableFields.
//
// Reviewer : Claude Code Opus 4.7 (sprint City Quality V3 ville #35).

import type { VilleEconomicData } from "./types";

export const MONTREUIL_ECONOMIC_DATA: VilleEconomicData = {
  // ─── Couche 1 — Économie INSEE ──────────────────────────────────────
  topSectorsNaf: [
    {
      naf: "MN",
      label:
        "Activités spécialisées, scientifiques et techniques + services administratifs (sections M+N)",
      rank: 1,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-93048",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "GHI",
      label: "Commerce, transports, hébergement et restauration (sections G+H+I)",
      rank: 2,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-93048",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "J",
      label:
        "Information et communication (édition logicielle, jeu vidéo, médias) — Ubisoft siège mondial",
      rank: 3,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-93048",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "OPQ",
      label: "Administration publique, enseignement, santé, action sociale (sections O+P+Q)",
      rank: 4,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-93048",
      verifiedOn: "2026-05-18",
    },
  ],

  polesCompetitivite: [
    {
      nom: "Cap Digital Paris-Région",
      secteur: "Numérique / IA / jeu vidéo / transformation digitale",
      type: "rayonnement",
      source: "https://www.capdigital.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  distances: {
    gareTgv: {
      nom: "Gare de Lyon (Paris) — TGV Sud-Est, accessible via métro ligne 1+14 (~25 min)",
      distanceKm: 6,
      source: "https://www.sncf-connect.com/gares/paris-gare-de-lyon",
    },
    aeroportPrincipal: {
      nom: "Paris-Charles de Gaulle (CDG)",
      distanceKm: 22,
      source: "https://www.parisaeroport.fr/",
    },
    metroOuTram: {
      // Métro ligne 9 (Mairie de Montreuil, Robespierre, Croix de Chavaux)
      // + ligne 11 (étendue 2024 jusqu'à Rosny-Bois-Perrier, dessert Romainville) effleure Montreuil
      // + tramway T1 (limite Bagnolet) — comptage strict des lignes à l'intérieur de la commune.
      lignes: 2,
      source: "https://www.ratp.fr/plan-metro",
    },
    verifiedOn: "2026-05-18",
  },

  // ─── Couche 2 — Matière éditoriale unique ───────────────────────────
  marquesHistoriques: [
    {
      nom: "Ubisoft",
      secteur: "Jeu vidéo / édition logicielle",
      lienVille: "siege",
      source: "https://fr.wikipedia.org/wiki/Ubisoft",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "AFD — Agence Française de Développement",
      secteur: "Banque publique de développement / coopération internationale",
      lienVille: "siege",
      source: "https://www.afd.fr/fr/page-region-pays/siege",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "BNP Paribas Personal Finance",
      secteur: "Banque / crédit à la consommation",
      lienVille: "siege",
      source: "https://fr.wikipedia.org/wiki/BNP_Paribas_Personal_Finance",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Pêche de Montreuil (Murs à pêches)",
      secteur: "Patrimoine maraîcher / arboriculture",
      lienVille: "heritage",
      source: "https://fr.wikipedia.org/wiki/Murs_%C3%A0_p%C3%AAches",
      verifiedOn: "2026-05-18",
    },
  ],

  // Montreuil n'a pas d'IGP/AOP propre. La "Pêche de Montreuil" est un
  // héritage maraîcher historique (Murs à pêches) sans signe officiel de
  // qualité INAO actif. Champ honnêtement vide. Vérification :
  // https://www.inao.gouv.fr/Espace-professionnel-et-outils/Rechercher-un-signe-officiel
  produitsIgpAop: [],

  salonsSectoriels: [
    {
      nom: "Paris Games Week",
      secteur: "Jeu vidéo (Ubisoft siège à Montreuil — exposant historique)",
      localisation: "Paris Expo Porte de Versailles",
      lienVille: "secteur_pertinent",
      source: "https://www.parisgamesweek.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "VivaTech",
      secteur: "Innovation / tech / startups (écosystème Cap Digital Paris-Région)",
      localisation: "Paris Expo Porte de Versailles",
      lienVille: "secteur_pertinent",
      source: "https://vivatechnology.com/",
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
      nom: "Murs à pêches (site patrimonial — héritage maraîcher XVIIe-XIXe)",
      type: "site_archeologique",
      source: "https://fr.wikipedia.org/wiki/Murs_%C3%A0_p%C3%AAches",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Cinéma Le Méliès",
      type: "autre",
      source: "https://www.cinema-meliesmontreuil.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Église Saint-Pierre-Saint-Paul de Montreuil",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/%C3%89glise_Saint-Pierre-Saint-Paul_de_Montreuil",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Musée de l'Histoire vivante",
      type: "musee",
      source: "https://www.museehistoirevivante.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  communesBassin: [
    {
      slug: "paris",
      nameFr: "Paris (limitrophe 20e arr.)",
      distanceKm: 0,
      source: "https://fr.wikipedia.org/wiki/Montreuil_(Seine-Saint-Denis)",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "bagnolet",
      nameFr: "Bagnolet",
      distanceKm: 2,
      source: "https://fr.wikipedia.org/wiki/Bagnolet",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "vincennes",
      nameFr: "Vincennes",
      distanceKm: 3,
      source: "https://fr.wikipedia.org/wiki/Vincennes",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "romainville",
      nameFr: "Romainville",
      distanceKm: 3,
      source: "https://fr.wikipedia.org/wiki/Romainville",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "rosny-sous-bois",
      nameFr: "Rosny-sous-Bois",
      distanceKm: 3,
      source: "https://fr.wikipedia.org/wiki/Rosny-sous-Bois",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "fontenay-sous-bois",
      nameFr: "Fontenay-sous-Bois",
      distanceKm: 4,
      source: "https://fr.wikipedia.org/wiki/Fontenay-sous-Bois",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "le-pre-saint-gervais",
      nameFr: "Le Pré-Saint-Gervais",
      distanceKm: 4,
      source: "https://fr.wikipedia.org/wiki/Le_Pr%C3%A9-Saint-Gervais",
      verifiedOn: "2026-05-18",
    },
  ],

  // Montreuil (banlieue est de Paris) n'a pas de vignoble AOC à ≤ 50 km.
  // Champagne ~140 km, Chablis ~170 km, Sancerre ~200 km. Vignoble de
  // Montmartre confidentiel (hors AOC). Champ honnêtement vide.
  vignoblesProches: [],

  // ─── Couche 3 — Multi-taille TPE/PME/ETI/GE ─────────────────────────

  // Annuaire EPV national consultable :
  // https://data.economie.gouv.fr/explore/dataset/entreprises-du-patrimoine-vivant-epv
  // Aucune entreprise EPV Montreuil source-vérifiée à ce jour — champ vide
  // pour respecter zéro invention. À compléter par extraction CSV ciblée.
  labelsEpvEtArtisanat: [],

  zonesActivitesParcs: [
    {
      nom: "ZAC Boissière-Acacia",
      type: "zac",
      secteurDominant: "Tertiaire / logement / mixte",
      source: "https://www.montreuil.fr/cadre-de-vie/projets-urbains/la-zac-boissiere-acacia",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Quartier Bas-Montreuil (siège Ubisoft, BNP PF — pôle tertiaire)",
      type: "district_eco",
      secteurDominant: "Numérique / banque / services",
      source: "https://fr.wikipedia.org/wiki/Montreuil_(Seine-Saint-Denis)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ZAC Fraternité (Mairie de Montreuil — éco-quartier)",
      type: "zac",
      secteurDominant: "Mixte / tertiaire / logement",
      source: "https://www.montreuil.fr/cadre-de-vie/projets-urbains",
      verifiedOn: "2026-05-18",
    },
  ],

  grandesEcolesEtUniversites: [
    {
      nom: "Université Sorbonne Paris Nord — antenne Montreuil (IUT)",
      type: "iut",
      specialites: ["Gestion", "Information-communication", "Carrières sociales"],
      source: "https://www.iutmontreuil.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Universcience / Cnam — proximité Paris",
      type: "universite",
      specialites: ["Formation continue", "Sciences industrielles"],
      source: "https://www.cnam.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  // Pas de centre Inria/CEA/CNRS implanté directement à Montreuil source-
  // vérifié. Inria Paris Centre (75013, ~10 km) et Inria Saclay (~25 km)
  // rayonnent sur le bassin. Champ honnêtement vide.
  polesRechercheRD: [],

  grandsGroupesImplantes: [
    {
      nom: "Ubisoft (siège mondial — 2 200+ employés)",
      secteur: "Jeu vidéo / édition logicielle",
      typeImplantation: "siege_social",
      source: "https://www.ubisoft.com/fr-fr/company/about-us/locations/paris",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "AFD — Agence Française de Développement (siège)",
      secteur: "Banque publique de développement",
      typeImplantation: "siege_social",
      source: "https://www.afd.fr/fr/page-region-pays/siege",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "BNP Paribas Personal Finance (siège)",
      secteur: "Banque / crédit à la consommation",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/BNP_Paribas_Personal_Finance",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Capgemini (site majeur Montreuil)",
      secteur: "Services numériques / conseil IT",
      typeImplantation: "site_majeur",
      source: "https://www.capgemini.com/fr-fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Couche 2bis — tags KB sectorielles ─────────────────────────────
  // Volontairement vide en V1 : la KB Prisma ne contient pas encore
  // d'entries sectorielles dédiées (Phase B du sprint).
  kbSectorTags: ["arts-creatif-design", "it-numerique", "banque-finance"],

  // ─── Optionnels (hors scoring dashboard) ────────────────────────────
  // Pas de chapitre French Tech autonome pour Montreuil ; rattachement
  // implicite à French Tech Paris / Grand Paris.
  capitaleFrenchTech: {
    statut: "communaute",
    nomChapitre: "French Tech Paris (rayonnement Grand Paris, Cap Digital)",
    source: "https://lafrenchtech.com/",
    verifiedOn: "2026-05-18",
  },

  cciCompetente: {
    nom: "CCI Seine-Saint-Denis (délégation territoriale CCI Paris Île-de-France)",
    source: "https://www.cci-paris-idf.fr/fr/cci/cci-seine-saint-denis",
    verifiedOn: "2026-05-18",
  },

  // Montreuil est dans le Grand Paris — distancesGrandesMetropoles N/A
  // (Paris EST la métropole, déjà couverte via communesBassin).

  incubateursAccelerateurs: [
    {
      nom: "La Pousse (incubateur Montreuil)",
      focus: "Économie sociale et solidaire (ESS) / entrepreneuriat local",
      source: "https://www.montreuil.fr/economie/createurs-dentreprise",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Adaptations Montreuil (zéro invention) ─────────────────────────
  // Montreuil (banlieue est Paris) n'a pas d'IGP/AOP propre (héritage
  // maraîcher Murs à pêches sans signe INAO actif) ni de vignoble AOC
  // à ≤ 50 km (Champagne ~140 km). Ces champs sont structurellement non
  // applicables, exemptés du scoring pour ne pas pénaliser la ville.
  notApplicableFields: ["produitsIgpAop", "vignoblesProches"],

  specificitesLocales: [
    {
      theme: "capitale_jeu_video_france",
      description:
        "Siège mondial d'Ubisoft (1986) — 2 200+ employés, 1er employeur jeu vidéo France et premier studio AAA européen.",
      source: "https://www.ubisoft.com/fr-fr/company/about-us/locations/paris",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "patrimoine_maraicher_murs_a_peches",
      description:
        "Murs à pêches (XVIIe-XIXe siècles) — site patrimonial unique d'arboriculture intensive, héritage maraîcher de la « pêche de Montreuil ».",
      source: "https://fr.wikipedia.org/wiki/Murs_%C3%A0_p%C3%AAches",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "ville_limitrophe_paris_grand_paris",
      description:
        "4e ville d'Île-de-France par la population (~111 000 hab), limitrophe Paris 20e (Portes de Bagnolet et Montreuil), intégrée à la Métropole du Grand Paris (EPT Est Ensemble).",
      source: "https://fr.wikipedia.org/wiki/Montreuil_(Seine-Saint-Denis)",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Métadonnées de revue ───────────────────────────────────────────
  lastReviewedOn: "2026-05-18",
  reviewedBy: "Claude Code Opus 4.7 (sprint City Quality V3 ville #35)",
};
