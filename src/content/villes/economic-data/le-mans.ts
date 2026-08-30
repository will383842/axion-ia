// Le Mans (72181) — data économique enrichie sourcée V3 multi-taille.
//
// Sprint City Quality V3 2026-05-18, ville n°23.
// Contrat zéro invention : chaque champ a un `source` vérifiable.
//
// Sources canoniques utilisées :
//   - INSEE dossier complet commune 72181 (2011101)
//   - competitivite.gouv.fr Phase V 2023-2026 (pôles)
//   - Wikipédia articles ville/gare/écoles/entreprises/monuments
//   - INAO (IGP Rillettes du Mans, Volailles de Loué, AOP Maine-Anjou)
//   - Sites officiels (lemans.fr, lemansmetropole.fr, lemans-tourisme.com,
//     univ-lemans.fr, mma.fr, lemans.org pour ACO/24h)
//
// Doctrine Le Mans : capitale mondiale de l'endurance automobile (24 Heures
// du Mans depuis 1923, ACO Automobile Club de l'Ouest), siège historique
// MMA (Mutuelles du Mans Assurances, fondée 1828, groupe Covéa), héritage
// industriel automobile (site Renault ACI), patrimoine antique exceptionnel
// (muraille gallo-romaine 4e siècle — l'une des mieux conservées de l'ex
// Empire romain d'Occident, candidate UNESCO depuis 2016) + Cité Plantagenêt
// + Cathédrale Saint-Julien. Préfecture de la Sarthe, 3e ville Pays de la Loire.
//
// Reviewer : Claude Code Opus 4.7 (sprint City Quality V3 ville #23).

import type { VilleEconomicData } from "./types";

export const LE_MANS_ECONOMIC_DATA: VilleEconomicData = {
  // ─── Couche 1 — Économie INSEE ──────────────────────────────────────
  topSectorsNaf: [
    {
      naf: "GHI",
      label: "Commerce, transports, hébergement et restauration (sections G+H+I)",
      rank: 1,
      etablissementsCount: 2_949,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-72181",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "MN",
      label:
        "Activités spécialisées, scientifiques et techniques + services administratifs (sections M+N)",
      rank: 2,
      etablissementsCount: 2_169,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-72181",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "OPQ",
      label: "Administration publique, enseignement, santé, action sociale (sections O+P+Q)",
      rank: 3,
      etablissementsCount: 1_958,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-72181",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "RU",
      label: "Autres activités de services (sections R+S+T+U)",
      rank: 4,
      etablissementsCount: 1_260,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-72181",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "K",
      label: "Activités financières et d'assurance (poids MMA/Covéa local)",
      rank: 5,
      etablissementsCount: 715,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-72181",
      verifiedOn: "2026-05-18",
    },
  ],

  polesCompetitivite: [
    {
      nom: "iD4CAR (Mobilités véhicule du futur)",
      secteur: "Mobilité / véhicule du futur / automobile / poids lourds",
      type: "rayonnement",
      source: "https://www.id4car.org/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "EMC2 (Technologies de production performantes)",
      secteur: "Manufacturing avancé / composites / robotique / usinage grande dimension",
      type: "rayonnement",
      source: "https://www.pole-emc2.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Vegepolys Valley (ex-Plant'Inn / végétal)",
      secteur: "Filière végétale — semences / horticulture / agro (rayonnement Pays de la Loire)",
      type: "rayonnement",
      source: "https://www.vegepolysvalley.eu/",
      verifiedOn: "2026-05-18",
    },
  ],

  distances: {
    gareTgv: {
      nom: "Gare du Mans (TGV Atlantique depuis 1989, Paris-Montparnasse direct)",
      distanceKm: 0,
      source: "https://fr.wikipedia.org/wiki/Gare_du_Mans",
    },
    aeroportPrincipal: {
      nom: "Aéroport Le Mans-Arnage (vols loisirs / aviation d'affaires) ; CDG accessible via Paris TGV",
      distanceKm: 7,
      source: "https://fr.wikipedia.org/wiki/A%C3%A9roport_du_Mans-Arnage",
    },
    metroOuTram: {
      lignes: 2,
      source: "https://www.setram.fr/",
    },
    verifiedOn: "2026-05-18",
  },

  statsInsee: {
    etablissementsActifs: 11_301,
    creationsEntreprises: 1_944,
    anneeReference: 2023,
    source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-72181",
    verifiedOn: "2026-05-18",
  },

  // ─── Couche 2 — Matière éditoriale unique ───────────────────────────
  marquesHistoriques: [
    {
      nom: "MMA (Mutuelles du Mans Assurances)",
      secteur: "Assurance mutualiste (groupe Covéa avec MAAF et GMF)",
      lienVille: "fondation",
      source: "https://fr.wikipedia.org/wiki/Mutuelles_du_Mans_Assurances",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "MMA (siège social actuel — Quartier Californie / Novaxis Le Mans)",
      secteur: "Assurance — siège social maintenu au Mans depuis 1828",
      lienVille: "siege",
      source: "https://fr.wikipedia.org/wiki/Mutuelles_du_Mans_Assurances",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ACO — Automobile Club de l'Ouest (organisateur 24 Heures du Mans depuis 1923)",
      secteur: "Sport automobile / endurance / organisation événementielle",
      lienVille: "siege",
      source: "https://www.lemans.org/fr/aco",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Rillettes du Mans",
      secteur: "Charcuterie — spécialité historique sarthoise (IGP filière)",
      lienVille: "heritage",
      source: "https://fr.wikipedia.org/wiki/Rillettes_du_Mans",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Renault (site industriel Le Mans / Renault ACI)",
      secteur: "Industrie automobile — production pièces mécaniques (essieux, trains roulants)",
      lienVille: "production",
      source: "https://fr.wikipedia.org/wiki/Le_Mans",
      verifiedOn: "2026-05-18",
    },
  ],

  produitsIgpAop: [
    {
      nom: "Rillettes du Mans (IGP charcuterie cuite, bassin sarthois)",
      categorie: "charcuterie",
      signe: "IGP",
      source: "https://www.inao.gouv.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Volailles de Loué (IGP + Label Rouge, bassin Sarthe — Loué à 30 km ouest Le Mans)",
      categorie: "volaille",
      signe: "IGP",
      source: "https://fr.wikipedia.org/wiki/Volailles_de_Lou%C3%A9",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Maine-Anjou (AOP viande bovine race rouge des prés, bassin Sarthe-Mayenne-Maine-et-Loire)",
      categorie: "viande",
      signe: "AOP",
      source: "https://fr.wikipedia.org/wiki/Maine-Anjou_(AOP)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Jambon de Vendée (IGP — bassin élargi Pays de la Loire, lien régional)",
      categorie: "charcuterie",
      signe: "IGP",
      source: "https://www.inao.gouv.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  salonsSectoriels: [
    {
      nom: "24 Heures du Mans (course endurance FIA WEC, depuis 1923)",
      secteur: "Sport automobile / endurance / innovation technologique mobilité",
      localisation: "Circuit des 24 Heures (Le Mans sud)",
      lienVille: "accueille",
      source: "https://www.lemans.org/fr/24-heures-du-mans/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "24 Heures Motos",
      secteur: "Sport motocycliste endurance (organisé par ACO/FFM)",
      localisation: "Circuit Bugatti Le Mans",
      lienVille: "accueille",
      source: "https://www.lemans.org/fr/24-heures-motos/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Le Mans Classic (rétro-mobile biennal, ACO)",
      secteur: "Automobile de collection / patrimoine motorsport",
      localisation: "Circuit des 24 Heures",
      lienVille: "accueille",
      source: "https://www.lemansclassic.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  patrimoineNotable: [
    {
      nom: "Muraille gallo-romaine du Mans (IVe siècle, ~500 m préservés sur 1300 originels — candidate UNESCO depuis 2016, l'une des mieux conservées de l'ex-Empire romain d'Occident)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Enceinte_gallo-romaine_du_Mans",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Cathédrale Saint-Julien du Mans (XIe-XVe, gothique + roman, vitraux XIIe parmi les plus anciens de France)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Cath%C3%A9drale_Saint-Julien_du_Mans",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Cité Plantagenêt (Vieux Mans) — quartier historique intra-muros classé",
      type: "cite_metier",
      source: "https://www.lemans-tourisme.com/fr/decouvrir/cite-plantagenet",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Musée de Tessé (Beaux-Arts, collections antiques égyptiennes + peintures XIIe-XXe)",
      type: "musee",
      source:
        "https://www.lemans.fr/services/loisirs-et-decouvertes/decouvrir/musees/musee-de-tesse/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Musée des 24 Heures — Circuit de la Sarthe (ACO)",
      type: "musee",
      source: "https://www.lemans-musee24h.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  communesBassin: [
    {
      slug: "coulaines",
      nameFr: "Coulaines",
      distanceKm: 3,
      source: "https://fr.wikipedia.org/wiki/Coulaines",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "allonnes",
      nameFr: "Allonnes",
      distanceKm: 4,
      source: "https://fr.wikipedia.org/wiki/Allonnes_(Sarthe)",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "champagne",
      nameFr: "Champagné",
      distanceKm: 10,
      source: "https://fr.wikipedia.org/wiki/Champagn%C3%A9_(Sarthe)",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "mulsanne",
      nameFr: "Mulsanne",
      distanceKm: 12,
      source: "https://fr.wikipedia.org/wiki/Mulsanne",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "arnage",
      nameFr: "Arnage",
      distanceKm: 6,
      source: "https://fr.wikipedia.org/wiki/Arnage",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "yvre-l-eveque",
      nameFr: "Yvré-l'Évêque",
      distanceKm: 7,
      source: "https://fr.wikipedia.org/wiki/Yvr%C3%A9-l%27%C3%89v%C3%AAque",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "la-chapelle-saint-aubin",
      nameFr: "La Chapelle-Saint-Aubin",
      distanceKm: 5,
      source: "https://fr.wikipedia.org/wiki/La_Chapelle-Saint-Aubin",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "sarge-les-le-mans",
      nameFr: "Sargé-lès-le-Mans",
      distanceKm: 5,
      source: "https://fr.wikipedia.org/wiki/Sarg%C3%A9-l%C3%A8s-le-Mans",
      verifiedOn: "2026-05-18",
    },
  ],

  // Le Mans n'a pas de vignoble AOC ≤ 50 km strict. Jasnières et Coteaux du
  // Loir (AOC vins blancs/rouges Sarthe nord) sont à ~40-45 km (proche limite).
  // Anjou AOC à ~80 km via Saumur (au-delà du seuil). Champ marqué via
  // notApplicableFields pour exemption scoring (pas de vignoble structurant
  // pertinent ≤ 50 km cible B2B viti).
  vignoblesProches: [
    {
      aoc: "Jasnières (AOC vin blanc Chenin, Sarthe nord — limite ~45 km nord Le Mans)",
      distanceKm: 45,
      source: "https://fr.wikipedia.org/wiki/Jasni%C3%A8res_(AOC)",
      verifiedOn: "2026-05-18",
    },
    {
      aoc: "Coteaux du Loir (AOC vins, Sarthe nord-Indre-et-Loire — bassin proche Jasnières)",
      distanceKm: 45,
      source: "https://fr.wikipedia.org/wiki/Coteaux-du-loir_(AOC)",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Couche 3 — Multi-taille PME/ETI/GE ─────────────────────────

  // Annuaire EPV : entreprises labellisées en Sarthe (filières gastronomie,
  // bois, etc.). Sans extraction CSV vérifiée par entreprise, champ vide
  // pour respecter zéro invention.
  labelsEpvEtArtisanat: [],

  zonesActivitesParcs: [
    {
      nom: "Novaxis (centre d'affaires tertiaire Le Mans, siège MMA depuis 2006)",
      type: "district_eco",
      secteurDominant: "Tertiaire / assurance / services",
      source: "https://fr.wikipedia.org/wiki/Mutuelles_du_Mans_Assurances",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Zone d'activités Le Mans Sud / Arnage (industries automobile + endurance)",
      type: "zac",
      secteurDominant: "Industrie automobile / mobilité / motorsport",
      source: "https://www.lemansmetropole.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Technopôle Université du Maine (campus universitaire + R&D acoustique LAUM)",
      type: "technopole",
      secteurDominant: "Recherche acoustique / numérique / formation",
      source: "https://www.univ-lemans.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  grandesEcolesEtUniversites: [
    {
      nom: "Le Mans Université (~13 000 étudiants, 2 campus Le Mans + Laval)",
      type: "universite",
      specialites: [
        "Sciences",
        "Acoustique (LAUM centre d'excellence)",
        "Droit",
        "Lettres",
        "Management",
      ],
      source: "https://www.univ-lemans.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ENSIM — École Nationale Supérieure d'Ingénieurs du Mans (Le Mans Université)",
      type: "ecole_ingenieur",
      specialites: ["Acoustique", "Vibrations", "Informatique", "Capteurs", "IA appliquée"],
      source: "https://ensim.univ-lemans.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ISMANS CESI Le Mans (école d'ingénieurs généralistes)",
      type: "ecole_ingenieur",
      specialites: ["Mécanique", "Matériaux", "Informatique industrielle", "Procédés"],
      source: "https://ecole-ingenieurs.cesi.fr/campus/le-mans/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "IUT du Mans (Le Mans Université)",
      type: "iut",
      specialites: [
        "Mesures physiques",
        "GEII",
        "Techniques de commercialisation",
        "Carrières juridiques",
      ],
      source: "https://iut.univ-lemans.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ESCRA — École Supérieure de Commerce et de Restauration Appliquée",
      type: "ecole_commerce",
      specialites: ["Management hôtellerie-restauration", "Commerce", "Tourisme"],
      source: "https://www.escra.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  polesRechercheRD: [
    {
      nom: "LAUM — Laboratoire d'Acoustique de l'Université du Mans (UMR CNRS 6613, centre d'excellence)",
      organisme: "cnrs",
      domaine: "Acoustique / vibrations / matériaux acoustiques",
      source: "https://laum.univ-lemans.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  grandsGroupesImplantes: [
    {
      nom: "MMA (groupe Covéa)",
      secteur: "Assurance mutualiste — siège social historique depuis 1828",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/Mutuelles_du_Mans_Assurances",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Covéa (groupe mutualiste MMA + MAAF + GMF)",
      secteur: "Assurance — site majeur historique Le Mans (héritage MMA)",
      typeImplantation: "site_majeur",
      source: "https://www.covea.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Renault (site industriel ACI Le Mans)",
      secteur: "Industrie automobile — production essieux/trains roulants",
      typeImplantation: "usine_principale",
      source: "https://fr.wikipedia.org/wiki/Le_Mans",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ACO — Automobile Club de l'Ouest",
      secteur: "Sport automobile / organisation événementielle endurance",
      typeImplantation: "siege_social",
      source: "https://www.lemans.org/fr/aco",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Couche 2bis — tags KB sectorielles ─────────────────────────────
  kbSectorTags: [
    "automobile-mobilite",
    "assurance",
    "agroalimentaire-igp",
    "enseignement-recherche",
  ],

  // ─── Optionnels (hors scoring dashboard) ────────────────────────────
  cciCompetente: {
    nom: "CCI Le Mans Sarthe",
    source: "https://www.lemans.sarthe.cci.fr/",
    verifiedOn: "2026-05-18",
  },

  distancesGrandesMetropoles: [
    {
      metropole: "Paris",
      distanceKm: 210,
      tempsMnTgv: 55,
      source: "https://fr.wikipedia.org/wiki/Gare_du_Mans",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Nantes",
      distanceKm: 190,
      tempsMnRoute: 120,
      source: "https://fr.mappy.com/",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Rennes",
      distanceKm: 155,
      tempsMnRoute: 100,
      source: "https://fr.mappy.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Spécificités Le Mans ───────────────────────────────────────────
  specificitesLocales: [
    {
      theme: "capitale_mondiale_endurance_automobile",
      description:
        "Le Mans accueille depuis 1923 les 24 Heures du Mans, course d'endurance auto la plus prestigieuse au monde (FIA WEC), organisée par l'ACO. Écosystème mobilité/motorsport unique en France.",
      source: "https://www.lemans.org/fr/24-heures-du-mans/",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "siege_assurance_mutualiste_majeur",
      description:
        "Siège historique du groupe MMA (Covéa) depuis 1828. Le Mans est l'une des principales places de l'assurance mutualiste française, structurante pour l'économie locale tertiaire.",
      source: "https://fr.wikipedia.org/wiki/Mutuelles_du_Mans_Assurances",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "patrimoine_antique_remarquable",
      description:
        "Muraille gallo-romaine (IVe s.) du Mans est l'une des enceintes romaines tardives les mieux conservées de l'ex-Empire romain d'Occident. Candidate UNESCO depuis 2016, ornementations polychromes sans équivalent en France.",
      source: "https://fr.wikipedia.org/wiki/Enceinte_gallo-romaine_du_Mans",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "centre_excellence_acoustique",
      description:
        "Le Mans Université + LAUM (UMR CNRS) constituent le pôle français de référence en acoustique. ENSIM forme les ingénieurs acoustique/vibrations — niche R&D nationale.",
      source: "https://laum.univ-lemans.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Métadonnées de revue ───────────────────────────────────────────
  lastReviewedOn: "2026-05-18",
  reviewedBy: "Claude Code Opus 4.7 (sprint City Quality V3 ville #23)",
};
