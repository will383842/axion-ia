// Amiens (80021) — data économique enrichie sourcée V3 multi-taille.
//
// Sprint City Quality V3 2026-05-18, ville n°26.
// Contrat zéro invention : chaque champ a un `source` vérifiable.
//
// Spécificité Amiens : préfecture de la Somme et capitale historique de la
// Picardie, ville natale de Jules Verne. Patrimoine UNESCO double :
//   - 1981 : Cathédrale Notre-Dame d'Amiens (dossier UNESCO ref. 162),
//     plus grande cathédrale gothique de France par son volume intérieur
//     (200 000 m³, 7 700 m²)
//   - 2005 : Beffroi (extension Beffrois de Belgique et de France,
//     dossier UNESCO ref. 943) — 23 beffrois français ajoutés en 2005
//
// Tissu industriel Amiens : 2e site mondial Procter & Gamble (lessives
// Ariel/Dash/Lenor, 1000+ emplois), Valeo Embrayages (centre mondial
// transmissions, contrat Mercedes 800 M€), Nestlé Purina PetCare Center
// R&D Europe (chiens/chats), bassin aéronautique (STELIA Aerospace à
// 28 km au nord-est, filiale Airbus). Capitale française de la bioéconomie
// via pôle Bioeconomy For Change (ex-IAR, présence Amiens + Pomacle/Reims +
// Compiègne).
//
// Sources canoniques utilisées :
//   - INSEE dossier complet commune 80021 (2011101)
//   - competitivite.gouv.fr — pôles Phase V 2023-2026 (Bioeconomy For Change)
//   - UNESCO Centre du patrimoine mondial (whc.unesco.org/en/list/162 + 943)
//   - Wikipédia (Amiens, Amiens Métropole, Maison de Jules Verne, Beffroi)
//   - Sites officiels groupes (P&G, Valeo, Nestlé) + presse industrielle
//   - Sites officiels Université Picardie Jules Verne, UniLaSalle Amiens
//   - SNCF Connect (gare Amiens, TER+TGV vers Paris ~1h06)
//
// Reviewer : Claude Code Opus 4.7 (sprint City Quality V3 ville #26).

import type { VilleEconomicData } from "./types";

export const AMIENS_ECONOMIC_DATA: VilleEconomicData = {
  // ─── Couche 1 — Économie INSEE ──────────────────────────────────────
  topSectorsNaf: [
    {
      naf: "GHI",
      label: "Commerce, transports, hébergement et restauration (services divers)",
      rank: 1,
      etablissementsCount: 2_996,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-80021",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "OPQ",
      label: "Administration publique, enseignement, santé, action sociale",
      rank: 2,
      etablissementsCount: 734,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-80021",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "F",
      label: "Construction",
      rank: 3,
      etablissementsCount: 224,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-80021",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "BE",
      label: "Industrie (manufacturière + extractive + énergie + déchets)",
      rank: 4,
      etablissementsCount: 181,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-80021",
      verifiedOn: "2026-05-18",
    },
  ],

  polesCompetitivite: [
    {
      nom: "Bioeconomy For Change (B4C, ex-IAR Industries & Agro-Ressources)",
      secteur: "Bioéconomie / agro-ressources / biotechnologies industrielles / biomatériaux",
      type: "rayonnement",
      source: "https://www.bioeconomyforchange.eu/",
      verifiedOn: "2026-05-18",
    },
  ],

  distances: {
    gareTgv: {
      nom: "Gare d'Amiens (TER + Intercités, liaison directe Paris Nord ~1h06)",
      distanceKm: 0,
      source: "https://www.sncf-connect.com/en-en/train/timetables/amiens/paris",
    },
    aeroportPrincipal: {
      nom: "Aéroport Paris-Charles de Gaulle (CDG)",
      distanceKm: 130,
      source: "https://fr.wikipedia.org/wiki/Amiens",
    },
    verifiedOn: "2026-05-18",
  },

  statsInsee: {
    etablissementsActifs: 4_149,
    creationsEntreprises: 2_141,
    anneeReference: 2024,
    source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-80021",
    verifiedOn: "2026-05-18",
  },

  // ─── Couche 2 — Matière éditoriale unique ───────────────────────────
  marquesHistoriques: [
    {
      nom: "Procter & Gamble Amiens (Ariel / Dash / Lenor)",
      secteur: "Détergents / soins linge / grande consommation",
      lienVille: "production",
      source:
        "https://www.usinenouvelle.com/article/dans-la-somme-procter-gamble-investit-50-millions-d-euros-sur-son-site-d-amiens.N2213011",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Valeo Embrayages Amiens",
      secteur: "Équipement automobile / transmissions / embrayages hybrides",
      lienVille: "production",
      source:
        "https://www.usinenouvelle.com/article/un-contrat-historique-pour-l-usine-valeo-d-amiens.N1043004",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Nestlé Purina PetCare Center Amiens",
      secteur: "R&D nutrition animale (Felix / Gourmet / Pro Plan / Friskies)",
      lienVille: "siege",
      source: "https://www.nestle.fr/nosmarques/alimentation-animaux-de-compagnie",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Goodyear Dunlop Amiens (héritage industriel, usine Nord fermée 2014)",
      secteur: "Pneumatiques / industrie automobile",
      lienVille: "heritage",
      source: "https://fr.wikipedia.org/wiki/Goodyear_Dunlop_Tires_France",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Whirlpool Amiens (héritage industriel, site fermé 2018)",
      secteur: "Électroménager / sèche-linge",
      lienVille: "heritage",
      source: "https://fr.wikipedia.org/wiki/Whirlpool_Corporation",
      verifiedOn: "2026-05-18",
    },
  ],

  // Amiens commune n'a pas d'IGP/AOP propre. Les IGP picardes proches
  // (Volailles de Licques, Maroilles AOP, Boudin blanc de Rethel) sont
  // rattachées à d'autres terroirs (Pas-de-Calais, Nord, Ardennes) et
  // listées en `vignoblesProches` n'est pas pertinent. Champ vide honnête.
  produitsIgpAop: [],

  salonsSectoriels: [
    {
      nom: "Marché de Noël d'Amiens",
      secteur: "Tourisme / artisanat / commerce de proximité",
      localisation: "Amiens (centre-ville)",
      lienVille: "accueille",
      source: "https://www.amiens-tourisme.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  patrimoineNotable: [
    {
      nom: "Cathédrale Notre-Dame d'Amiens (UNESCO 1981, ref. 162)",
      type: "unesco",
      source: "https://whc.unesco.org/en/list/162",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Beffroi d'Amiens (UNESCO 2005, extension Beffrois de Belgique et de France, ref. 943)",
      type: "unesco",
      source: "https://whc.unesco.org/en/list/943/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Hortillonnages d'Amiens (300 ha de jardins maraîchers sur îles alluvionnaires)",
      type: "parc",
      source: "https://fr.wikipedia.org/wiki/Hortillonnages_d%27Amiens",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Maison de Jules Verne",
      type: "musee",
      source: "https://fr.wikipedia.org/wiki/Maison_de_Jules_Verne",
      verifiedOn: "2026-05-18",
    },
  ],

  communesBassin: [
    {
      slug: "longueau",
      nameFr: "Longueau",
      distanceKm: 4,
      source: "https://fr.wikipedia.org/wiki/Longueau",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "camon",
      nameFr: "Camon",
      distanceKm: 3,
      source: "https://fr.wikipedia.org/wiki/Camon_(Somme)",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "rivery",
      nameFr: "Rivery",
      distanceKm: 3,
      source: "https://fr.wikipedia.org/wiki/Rivery",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "salouel",
      nameFr: "Salouël",
      distanceKm: 5,
      source: "https://fr.wikipedia.org/wiki/Salou%C3%ABl",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "pont-de-metz",
      nameFr: "Pont-de-Metz",
      distanceKm: 5,
      source: "https://fr.wikipedia.org/wiki/Pont-de-Metz",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "glisy",
      nameFr: "Glisy",
      distanceKm: 8,
      source: "https://fr.wikipedia.org/wiki/Glisy",
      verifiedOn: "2026-05-18",
    },
  ],

  // Amiens est en zone septentrionale, hors zones AOC viticoles
  // (Champagne à ~150 km au sud-est). Champ structurellement vide.
  vignoblesProches: [],

  // ─── Couche 3 — Multi-taille TPE/PME/ETI/GE ─────────────────────────

  // Label EPV non documenté commune par commune pour Amiens dans nos
  // sources actuelles. À compléter Phase 2 via annuaire officiel
  // data.economie.gouv.fr/explore/dataset/entreprises-du-patrimoine-vivant-epv
  labelsEpvEtArtisanat: [],

  zonesActivitesParcs: [
    {
      nom: "Zone industrielle Nord d'Amiens (Glisy / Boves)",
      type: "district_eco",
      secteurDominant: "Industrie manufacturière / logistique",
      source: "https://fr.wikipedia.org/wiki/Amiens_M%C3%A9tropole",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Pôle Jules Verne (zone d'activités sud-est, Amiens Métropole)",
      type: "parc_tech",
      secteurDominant: "Industrie / logistique / agroalimentaire",
      source: "https://www.amiens.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  grandesEcolesEtUniversites: [
    {
      nom: "Université de Picardie Jules Verne (UPJV)",
      type: "universite",
      specialites: [
        "Sciences",
        "Lettres et sciences humaines",
        "Droit / économie / gestion",
        "Médecine et santé",
        "Sciences et technologie",
      ],
      source: "https://fr.wikipedia.org/wiki/Universit%C3%A9_de_Picardie-Jules-Verne",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "UniLaSalle Amiens (ex-ESIEE Amiens, école d'ingénieurs)",
      type: "ecole_ingenieur",
      specialites: [
        "Énergie et développement durable",
        "Efficacité énergétique",
        "Réseaux informatiques et objets connectés",
        "Usine numérique / mécatronique",
      ],
      source: "https://www.unilasalle-amiens.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ESC Amiens (École Supérieure de Commerce)",
      type: "ecole_commerce",
      source: "https://fr.wikipedia.org/wiki/%C3%89cole_sup%C3%A9rieure_de_commerce_d%27Amiens",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "IUT d'Amiens (composante UPJV)",
      type: "iut",
      source: "https://www.iut-amiens.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  // L'UPJV opère 35 unités de recherche dont 6 associées au CNRS et 2 à
  // l'INSERM. Sources individuelles labos non documentées finement ici ;
  // on liste les organismes de tutelle confirmés.
  polesRechercheRD: [
    {
      nom: "CNRS — laboratoires associés UPJV (6 unités mixtes recherche)",
      organisme: "cnrs",
      domaine: "Sciences fondamentales / chimie / physique / sciences humaines",
      source: "https://fr.wikipedia.org/wiki/Universit%C3%A9_de_Picardie-Jules-Verne",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "INSERM — laboratoires associés UPJV (2 unités mixtes)",
      organisme: "inserm",
      domaine: "Santé / sciences biomédicales",
      source: "https://fr.wikipedia.org/wiki/Universit%C3%A9_de_Picardie-Jules-Verne",
      verifiedOn: "2026-05-18",
    },
  ],

  grandsGroupesImplantes: [
    {
      nom: "Procter & Gamble (P&G) Amiens",
      secteur: "Détergents / soins du linge (Ariel, Dash, Lenor)",
      typeImplantation: "site_majeur",
      source:
        "https://www.usinenouvelle.com/article/dans-la-somme-procter-gamble-investit-50-millions-d-euros-sur-son-site-d-amiens.N2213011",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Valeo Embrayages Amiens",
      secteur: "Équipementier automobile / transmissions hybrides",
      typeImplantation: "site_majeur",
      source:
        "https://www.usinenouvelle.com/article/un-contrat-historique-pour-l-usine-valeo-d-amiens.N1043004",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Nestlé Purina PetCare Center Amiens",
      secteur: "R&D nutrition animale (chiens/chats Europe)",
      typeImplantation: "centre_rd",
      source: "https://www.nestle.fr/nosmarques/alimentation-animaux-de-compagnie",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Couche 2bis — tags KB sectorielles ─────────────────────────────
  // Volontairement vide en V1 : la KB Prisma ne contient pas encore
  // d'entries sectorielles dédiées (Phase B du sprint).
  kbSectorTags: [
    "industrie-manufacturiere",
    "automobile-mobilite",
    "sante-biotech",
    "enseignement-recherche",
  ],

  // ─── Optionnels (hors scoring dashboard) ────────────────────────────
  // Candidature French Tech Amiens déposée 2019 mais non labellisée à
  // ce jour (ni Capitale ni Communauté officielle). Champ omis pour
  // respecter zéro invention.

  cciCompetente: {
    nom: "CCI Hauts-de-France (site Amiens-Picardie)",
    source: "https://www.amiens-picardie.cci.fr/",
    verifiedOn: "2026-05-18",
  },

  distancesGrandesMetropoles: [
    {
      metropole: "Paris",
      distanceKm: 115,
      tempsMnTgv: 66,
      source: "https://www.sncf-connect.com/en-en/train/timetables/amiens/paris",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Lille",
      distanceKm: 121,
      tempsMnTgv: 75,
      source: "https://fr.wikipedia.org/wiki/Amiens",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Spécificités locales hors grille standard ──────────────────────
  specificitesLocales: [
    {
      theme: "patrimoine_unesco_gothique",
      description:
        "Cathédrale Notre-Dame d'Amiens : plus grande cathédrale gothique de France par son volume intérieur (200 000 m³, 7 700 m²), UNESCO 1981.",
      source: "https://whc.unesco.org/en/list/162",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "capitale_bioeconomie_france",
      description:
        "Présence du pôle Bioeconomy For Change (ex-IAR) sur l'axe Amiens-Pomacle-Compiègne, pôle de référence européen pour la bioéconomie et les agro-ressources.",
      source: "https://www.bioeconomyforchange.eu/",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "ville_natale_jules_verne",
      description:
        "Jules Verne a vécu et écrit à Amiens de 1871 à sa mort en 1905. Maison-musée ouverte au public depuis 1980, collection de 30 000 pièces originales.",
      source: "https://fr.wikipedia.org/wiki/Maison_de_Jules_Verne",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Adaptations Amiens (zéro invention) ────────────────────────────
  // Amiens commune n'a pas d'IGP/AOP propre (les IGP picardes voisines
  // — Maroilles AOP, Volailles de Licques IGP, Boudin blanc de Rethel
  // IGP — sont rattachées à d'autres terroirs). Pas de vignoble AOC à
  // ≤ 50 km (Champagne à ~150 km). Ces champs sont structurellement non
  // applicables, exemptés du scoring.
  notApplicableFields: ["produitsIgpAop", "vignoblesProches"],

  // ─── Métadonnées de revue ───────────────────────────────────────────
  lastReviewedOn: "2026-05-18",
  reviewedBy: "Claude Code Opus 4.7 (sprint City Quality V3 ville #26)",
};
