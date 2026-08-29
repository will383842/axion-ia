// Saint-Étienne (42218) — data économique enrichie sourcée V3 multi-taille.
//
// Sprint City Quality V3 ville #14 (2026-05-18).
// Contrat zéro invention : chaque champ a un `source` vérifiable.
//
// Sources canoniques utilisées :
//   - INSEE dossier complet commune 42218 (2011101)
//   - competitivite.gouv.fr / Techtera (textile soft materials)
//   - Sites officiels écoles (mines-stetienne.fr, univ-st-etienne.fr, enise)
//   - SNCF Connect (Saint-Étienne-Châteaucreux) + Rome2Rio (LYS Lyon-Exupéry)
//   - Wikipédia articles Casino Guichard-Perrachon, Thuasne, Manufrance,
//     Aubert & Duval, Site Le Corbusier Firminy
//   - UNESCO Creative Cities Network (unesco.org/en/creative-cities/saint-etienne)
//   - UNESCO Centre du patrimoine mondial (whc.unesco.org — Œuvre Le Corbusier 2016)
//   - Sites officiels Cité du Design (citedudesign.com) + Biennale Design
//   - Sites officiels Saint-Étienne Métropole + French Tech One Lyon St-Étienne
//   - INAO (Lentille verte du Puy AOP, Fourme de Montbrison AOP)
//
// Spécificité Saint-Étienne : seule ville française du réseau UNESCO Creative
// Cities en design (depuis 22 nov. 2010). Capitale française du design,
// héritage industriel armement / cycles (Manufrance) / textile / mécanique
// de précision. Bassin minier Loire reconverti en pôle design + santé textile.
//
// Reviewer : Claude Code Opus 4.7 (sprint City Quality V3 ville #14).

import type { VilleEconomicData } from "./types";

export const SAINT_ETIENNE_ECONOMIC_DATA: VilleEconomicData = {
  // ─── Couche 1 — Économie INSEE ──────────────────────────────────────
  topSectorsNaf: [
    {
      naf: "GHI",
      label: "Commerce, transports, hébergement et restauration (sections G+H+I)",
      rank: 1,
      etablissementsCount: 4_351,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-42218",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "OPQ",
      label: "Administration publique, enseignement, santé, action sociale (sections O+P+Q)",
      rank: 2,
      etablissementsCount: 818,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-42218",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "F",
      label: "Construction",
      rank: 3,
      etablissementsCount: 551,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-42218",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "BCDE",
      label: "Industrie (sections B+C+D+E — héritage mécanique / textile médical / armement)",
      rank: 4,
      etablissementsCount: 413,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-42218",
      verifiedOn: "2026-05-18",
    },
  ],

  polesCompetitivite: [
    {
      nom: "Techtera",
      secteur: "Textile / matériaux souples / textiles techniques",
      type: "rayonnement",
      source: "https://www.techtera.org/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Viaméca",
      secteur: "Mécanique / fabrication avancée / matériaux",
      type: "rayonnement",
      source:
        "https://www.saint-etienne-metropole.fr/projets/succes-du-territoire/un-territoire-dexcellence",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "LUTB Transport & Mobility Systems",
      secteur: "Transports terrestres / mobilité / véhicules industriels",
      type: "rayonnement",
      source:
        "https://www.saint-etienne-metropole.fr/projets/succes-du-territoire/un-territoire-dexcellence",
      verifiedOn: "2026-05-18",
    },
  ],

  distances: {
    gareTgv: {
      nom: "Gare de Saint-Étienne-Châteaucreux (TGV directs Paris-Gare-de-Lyon en ~2h45)",
      distanceKm: 0,
      source: "https://www.sncf-connect.com/gares/saint-etienne-chateaucreux",
    },
    aeroportPrincipal: {
      nom: "Aéroport Lyon-Saint-Exupéry (LYS) — aéroport international de référence du bassin",
      distanceKm: 75,
      source:
        "https://www.rome2rio.com/fr/s/Gare-de-Saint-%C3%89tienne-Ch%C3%A2teaucreux/A%C3%A9roport-De-Lyon-Saint-Exup%C3%A9ry-LYS",
    },
    metroOuTram: {
      lignes: 3,
      source: "https://www.reseau-stas.fr/",
    },
    verifiedOn: "2026-05-18",
  },

  statsInsee: {
    etablissementsActifs: 6_140,
    creationsEntreprises: 3_031,
    densiteEtablissementsPour1000: 36,
    anneeReference: 2024,
    source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-42218",
    verifiedOn: "2026-05-18",
  },

  // ─── Couche 2 — Matière éditoriale unique ───────────────────────────
  marquesHistoriques: [
    {
      nom: "Casino (Groupe Casino Guichard-Perrachon)",
      secteur: "Distribution / grande distribution alimentaire",
      lienVille: "fondation",
      source: "https://fr.wikipedia.org/wiki/Groupe_Casino",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Manufrance",
      secteur: "Cycles / armes de chasse / vente par correspondance (héritage)",
      lienVille: "heritage",
      source: "https://fr.wikipedia.org/wiki/Manufrance",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Thuasne",
      secteur: "Textile médical / orthopédie / contention élastique",
      lienVille: "siege",
      source: "https://fr.wikipedia.org/wiki/Thuasne_(entreprise)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Aubert & Duval",
      secteur: "Métallurgie / aciers spéciaux / aéronautique-défense",
      lienVille: "production",
      source: "https://fr.wikipedia.org/wiki/Aubert_%26_Duval",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ASSE (AS Saint-Étienne)",
      secteur: "Football professionnel / club historique",
      lienVille: "siege",
      source: "https://fr.wikipedia.org/wiki/Association_sportive_de_Saint-%C3%89tienne",
      verifiedOn: "2026-05-18",
    },
  ],

  produitsIgpAop: [
    {
      nom: "Fourme de Montbrison",
      categorie: "Fromage",
      signe: "AOP",
      source:
        "https://www.inao.gouv.fr/Espace-professionnel-et-outils/Rechercher-un-signe-officiel",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Lentille verte du Puy",
      categorie: "Agroalimentaire (légume sec)",
      signe: "AOP",
      source:
        "https://www.inao.gouv.fr/Espace-professionnel-et-outils/Rechercher-un-signe-officiel",
      verifiedOn: "2026-05-18",
    },
  ],

  salonsSectoriels: [
    {
      nom: "Biennale Internationale Design Saint-Étienne",
      secteur: "Design (référence mondiale) / créativité / industries culturelles",
      localisation: "Cité du Design + Halles Barrouin, Saint-Étienne",
      lienVille: "accueille",
      source: "https://www.biennale-design.com/saint-etienne/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Salon EPHJ-EPMT-SMT (microtechniques)",
      secteur: "Microtechniques / mécanique de précision / horlogerie / médical",
      localisation: "Genève (écosystème transfrontalier — exposants Saint-Étienne)",
      lienVille: "secteur_pertinent",
      source: "https://www.ephj.ch/",
      verifiedOn: "2026-05-18",
    },
  ],

  patrimoineNotable: [
    {
      nom: "Saint-Étienne — Ville Créative UNESCO de Design (depuis 22 nov. 2010, seule ville française du réseau)",
      type: "unesco",
      source: "https://www.unesco.org/en/creative-cities/saint-etienne",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Site Le Corbusier de Firminy (UNESCO 2016 — Œuvre architecturale de Le Corbusier, 2e ensemble mondial après Chandigarh)",
      type: "unesco",
      source: "https://whc.unesco.org/en/list/1321",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Cité du Design (ancienne Manufacture d'Armes)",
      type: "cite_metier",
      source: "https://www.citedudesign.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Musée de la Mine — Puits Couriot",
      type: "musee",
      source: "https://www.musee-mine.saint-etienne.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Musée d'Art Moderne et Contemporain de Saint-Étienne Métropole (MAMC+)",
      type: "musee",
      source: "https://mamc.saint-etienne.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  communesBassin: [
    {
      slug: "saint-chamond",
      nameFr: "Saint-Chamond",
      distanceKm: 11,
      source: "https://fr.wikipedia.org/wiki/Saint-Chamond_(Loire)",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "firminy",
      nameFr: "Firminy",
      distanceKm: 12,
      source: "https://fr.wikipedia.org/wiki/Firminy",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "le-chambon-feugerolles",
      nameFr: "Le Chambon-Feugerolles",
      distanceKm: 9,
      source: "https://fr.wikipedia.org/wiki/Le_Chambon-Feugerolles",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "roche-la-moliere",
      nameFr: "Roche-la-Molière",
      distanceKm: 6,
      source: "https://fr.wikipedia.org/wiki/Roche-la-Moli%C3%A8re",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "la-ricamarie",
      nameFr: "La Ricamarie",
      distanceKm: 5,
      source: "https://fr.wikipedia.org/wiki/La_Ricamarie",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "andrezieux-boutheon",
      nameFr: "Andrézieux-Bouthéon",
      distanceKm: 14,
      source: "https://fr.wikipedia.org/wiki/Andr%C3%A9zieux-Bouth%C3%A9on",
      verifiedOn: "2026-05-18",
    },
  ],

  // Saint-Étienne (Loire, 42) hors zones AOC viticoles principales :
  // Côtes du Forez (IGP, sur la plaine du Forez à ~25-40 km au nord) est
  // l'AOC viticole la plus proche. Côtes du Rhône Septentrional (Condrieu,
  // Côte-Rôtie) à ~55-70 km côté Rhône (au-delà du seuil 50 km strict).
  vignoblesProches: [
    {
      aoc: "Côtes du Forez",
      distanceKm: 35,
      source:
        "https://www.inao.gouv.fr/Espace-professionnel-et-outils/Rechercher-un-signe-officiel",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Couche 3 — Multi-taille PME/ETI/GE ─────────────────────────

  // Label EPV : sans source individuelle confirmée par entreprise stéphanoise,
  // champ vide pour respecter zéro invention. À compléter en cross-référençant
  // l'annuaire officiel data.economie.gouv.fr/explore/dataset/entreprises-du-patrimoine-vivant-epv
  // (Phase 2 du sprint, demande extraction CSV).
  labelsEpvEtArtisanat: [],

  zonesActivitesParcs: [
    {
      nom: "Technopôle de Saint-Étienne (campus Manufacture / Cité du Design)",
      type: "technopole",
      secteurDominant: "Design / numérique / industries créatives",
      source:
        "https://www.saint-etienne-metropole.fr/projets/succes-du-territoire/un-territoire-dexcellence",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Quartier Châteaucreux (pôle tertiaire gare TGV)",
      type: "district_eco",
      secteurDominant: "Tertiaire / sièges sociaux / services",
      source: "https://www.saint-etienne-metropole.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Zone d'activités Molina-La-Chazotte",
      type: "zac",
      secteurDominant: "Mixte / PME industrielles",
      source: "https://www.saint-etienne-metropole.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  grandesEcolesEtUniversites: [
    {
      nom: "Mines Saint-Étienne (École nationale supérieure des Mines, Institut Mines-Télécom)",
      type: "ecole_ingenieur",
      specialites: [
        "Génie industriel",
        "Microélectronique",
        "Matériaux",
        "Informatique / IA",
        "Santé",
      ],
      source: "https://www.mines-stetienne.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ENISE — École nationale d'ingénieurs de Saint-Étienne (école interne de Centrale Lyon)",
      type: "ecole_ingenieur",
      specialites: ["Génie mécanique", "Génie civil", "Génie sensoriel"],
      source: "https://www.enise.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Université Jean Monnet (UJM) Saint-Étienne",
      type: "universite",
      specialites: [
        "Santé",
        "Sciences",
        "Droit-Économie-Gestion",
        "Lettres-Langues-Sciences humaines",
      ],
      source: "https://www.univ-st-etienne.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "EM Lyon Business School — Campus Saint-Étienne",
      type: "ecole_commerce",
      specialites: ["Management", "Entrepreneuriat", "Design + Business"],
      source: "https://em-lyon.com/fr/campus/saint-etienne",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ESADSE — École supérieure d'art et design de Saint-Étienne",
      type: "autre",
      specialites: ["Design", "Art", "Design d'espace", "Communication visuelle"],
      source: "https://www.esadse.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  polesRechercheRD: [
    {
      nom: "Laboratoire Hubert Curien (UMR CNRS 5516) — UJM / Institut d'Optique / Mines Saint-Étienne",
      organisme: "cnrs",
      domaine: "Optique / photonique / vision par ordinateur / IA appliquée",
      source: "https://laboratoirehubertcurien.univ-st-etienne.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Centre Ingénierie et Santé (CIS) — Mines Saint-Étienne (campus dédié santé / dispositifs médicaux)",
      organisme: "autre",
      domaine: "Ingénierie biomédicale / dispositifs médicaux / textiles santé",
      source:
        "https://www.mines-stetienne.fr/recherche/centres-de-formation-et-de-recherche/centre-cis/",
      verifiedOn: "2026-05-18",
    },
  ],

  grandsGroupesImplantes: [
    {
      nom: "Casino Guichard-Perrachon",
      secteur: "Distribution / grande distribution alimentaire",
      typeImplantation: "siege_social",
      source:
        "https://annuaire-entreprises.data.gouv.fr/entreprise/casino-guichard-perrachon-554501171",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Thuasne",
      secteur: "Textile médical / orthopédie",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/Thuasne_(entreprise)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Aubert & Duval (groupe Eramet)",
      secteur: "Métallurgie / aciers spéciaux / aéronautique-défense",
      typeImplantation: "site_majeur",
      source: "https://fr.wikipedia.org/wiki/Aubert_%26_Duval",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Couche 2bis — tags KB sectorielles ─────────────────────────────
  // Volontairement vide en V1 : la KB Prisma ne contient pas encore
  // d'entries sectorielles dédiées (Phase B du sprint).
  kbSectorTags: ["industrie-manufacturiere", "mecanique-precision", "arts-creatif-design"],

  // ─── Optionnels (hors scoring dashboard) ────────────────────────────
  capitaleFrenchTech: {
    statut: "capitale",
    nomChapitre: "French Tech One Lyon Saint-Étienne (Capitale French Tech reconduite 2026-2028)",
    source: "https://www.lafrenchtech-stl.com/",
    verifiedOn: "2026-05-18",
  },

  cciCompetente: {
    nom: "CCI Lyon Métropole Saint-Étienne Roanne",
    source: "https://www.lyon-metropole.cci.fr/",
    verifiedOn: "2026-05-18",
  },

  distancesGrandesMetropoles: [
    {
      metropole: "Lyon",
      distanceKm: 60,
      tempsMnTgv: 45,
      tempsMnRoute: 55,
      source: "https://www.sncf-connect.com/",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Paris",
      distanceKm: 460,
      tempsMnTgv: 165,
      source: "https://www.sncf-connect.com/gares/saint-etienne-chateaucreux",
      verifiedOn: "2026-05-18",
    },
  ],

  incubateursAccelerateurs: [
    {
      nom: "Cité du Design — incubateur Design",
      focus: "Design / industries créatives / matériaux",
      source: "https://www.citedudesign.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Mines Saint-Étienne — incubateur étudiants-chercheurs",
      focus: "Deep tech / industrie / santé / matériaux",
      source: "https://www.mines-stetienne.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Spécificités locales hors grille standard ──────────────────────
  specificitesLocales: [
    {
      theme: "unesco_creative_design",
      description:
        "Seule ville française du réseau UNESCO Creative Cities en design (depuis 22 nov. 2010). Capitale française du design — Berlin/Bilbao/Kobe/Montréal/Pékin/Turin pairs européens-mondiaux.",
      source: "https://www.unesco.org/en/creative-cities/saint-etienne",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "heritage_industriel_armement_cycles",
      description:
        "Héritage industriel triple : armement (Manufacture d'Armes — devenue Cité du Design), cycles (Manufrance), textile médical (Thuasne 1847). Reconversion design + santé textile.",
      source: "https://fr.wikipedia.org/wiki/Manufrance",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Métadonnées de revue ───────────────────────────────────────────
  lastReviewedOn: "2026-05-18",
  reviewedBy: "Claude Code Opus 4.7 (sprint City Quality V3 ville #14)",
};
