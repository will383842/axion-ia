// Mulhouse (68224) — data économique enrichie sourcée V3.
// Sprint City Quality 39 villes, ville #38.
// Spécificités majeures : Cité de l'Automobile — collection Schlumpf
// (plus grand musée auto du monde, dont la plus grande collection Bugatti),
// capitale française des musées techniques (auto + train + textile),
// tradition industrielle textile DMC, capitale alsacienne sud,
// transfrontalier Suisse/Allemagne (EuroAirport Bâle-Mulhouse-Freiburg
// à 25 km), siège Pôle Véhicule du Futur.

import type { VilleEconomicData } from "./types";

export const MULHOUSE_ECONOMIC_DATA: VilleEconomicData = {
  topSectorsNaf: [
    {
      naf: "GHI",
      label: "Commerce, transports, hébergement et restauration (72,1 % des établissements)",
      rank: 1,
      etablissementsCount: 2_684,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-68224",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "OPQ",
      label:
        "Administration publique, enseignement, santé, action sociale (16,4 % éta. / 47,9 % salariés)",
      rank: 2,
      etablissementsCount: 609,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-68224",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "F",
      label: "Construction (8,1 % des établissements)",
      rank: 3,
      etablissementsCount: 301,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-68224",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "C",
      label:
        "Industrie manufacturière (3,5 % des établissements — automobile Stellantis, textile, mécanique)",
      rank: 4,
      etablissementsCount: 129,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-68224",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "MN",
      label: "Activités spécialisées, scientifiques et techniques + services administratifs",
      rank: 5,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-68224",
      verifiedOn: "2026-05-18",
    },
  ],

  polesCompetitivite: [
    {
      nom: "Pôle Véhicule du Futur",
      secteur: "Automobile / mobilité décarbonée / hydrogène (siège Mulhouse-Bourtzwiller)",
      type: "siege",
      source: "https://www.vehiculedufutur.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Alsace BioValley",
      secteur: "Sciences de la vie / biotech / dispositifs médicaux",
      type: "rayonnement",
      source: "https://www.alsace-biovalley.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Bioeconomy For Change (ex-IAR)",
      secteur: "Bioéconomie / chimie verte / agro-ressources",
      type: "rayonnement",
      source: "https://www.bioeconomyforchange.eu/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Fibres-Energivie",
      secteur: "Matériaux composites / fibres / efficacité énergétique bâtiment",
      type: "rayonnement",
      source: "https://www.pole-fibres-energivie.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  distances: {
    gareTgv: {
      nom: "Gare de Mulhouse-Ville — TGV Rhin-Rhône (Paris ~2h40), TER 200, ICE Allemagne",
      distanceKm: 0,
      source: "https://www.sncf-connect.com/gares/mulhouse-ville",
    },
    aeroportPrincipal: {
      nom: "EuroAirport Bâle-Mulhouse-Freiburg (BSL/MLH/EAP) — aéroport trinational",
      distanceKm: 25,
      source: "https://www.euroairport.com/fr/",
    },
    metroOuTram: {
      lignes: 3,
      source: "https://www.solea.info/fr/se-deplacer-sur-le-reseau/plan-tram-bus",
    },
    verifiedOn: "2026-05-18",
  },

  statsInsee: {
    etablissementsActifs: 3_724,
    creationsEntreprises: 1_872,
    anneeReference: 2024,
    source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-68224",
    verifiedOn: "2026-05-18",
  },

  marquesHistoriques: [
    {
      nom: "DMC (Dollfus-Mieg et Compagnie)",
      secteur: "Textile / fils à coudre / broderie (fondée 1746)",
      lienVille: "fondation",
      source: "https://fr.wikipedia.org/wiki/Dollfus-Mieg_et_Compagnie",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Caddie (chariots de supermarché)",
      secteur: "Équipement commercial / métallurgie (fondée 1928)",
      lienVille: "fondation",
      source: "https://fr.wikipedia.org/wiki/Caddie_(entreprise)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Stellantis Mulhouse (ex-PSA, ex-Peugeot)",
      secteur: "Automobile (usine historique depuis 1962)",
      lienVille: "production",
      source: "https://fr.wikipedia.org/wiki/Usine_Stellantis_de_Mulhouse",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Clemessy (groupe Eiffage Énergie Systèmes)",
      secteur: "Ingénierie électrique / industrielle / maintenance (fondée 1908)",
      lienVille: "siege",
      source: "https://fr.wikipedia.org/wiki/Clemessy",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "SACM (Société Alsacienne de Constructions Mécaniques)",
      secteur: "Mécanique lourde / locomotives / héritage industriel",
      lienVille: "heritage",
      source:
        "https://fr.wikipedia.org/wiki/Soci%C3%A9t%C3%A9_alsacienne_de_constructions_m%C3%A9caniques",
      verifiedOn: "2026-05-18",
    },
  ],

  produitsIgpAop: [
    {
      nom: "Alsace AOC (vins)",
      categorie: "Vin",
      signe: "AOC",
      source: "https://www.inao.gouv.fr/produit/3290",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Crémant d'Alsace",
      categorie: "Vin effervescent",
      signe: "AOC",
      source: "https://www.inao.gouv.fr/produit/3292",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Choucroute d'Alsace",
      categorie: "Agroalimentaire",
      signe: "IGP",
      source: "https://fr.wikipedia.org/wiki/Choucroute_d%27Alsace",
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
      nom: "Miel d'Alsace",
      categorie: "Agroalimentaire",
      signe: "IGP",
      source: "https://fr.wikipedia.org/wiki/Miel_d%27Alsace",
      verifiedOn: "2026-05-18",
    },
  ],

  salonsSectoriels: [
    {
      nom: "Foire Internationale de Mulhouse (FIM)",
      secteur: "Salon généraliste régional / grand public et B2B",
      localisation: "Parc Expo Mulhouse",
      lienVille: "accueille",
      source: "https://www.foire-mulhouse.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Folie's (Salon de la mariée et de l'événement)",
      secteur: "Événementiel / mariage / lifestyle",
      localisation: "Parc Expo Mulhouse",
      lienVille: "accueille",
      source: "https://www.parcexpo.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Carrefour Européen du Patchwork (Sainte-Marie-aux-Mines)",
      secteur: "Textile / patchwork / artisanat européen (référence mondiale)",
      localisation: "Sainte-Marie-aux-Mines (Haut-Rhin, proche Mulhouse)",
      lienVille: "secteur_pertinent",
      source: "https://www.patchwork-europe.eu/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Foire Européenne de Strasbourg",
      secteur: "Salon généraliste référence Grand Est",
      localisation: "Strasbourg (~110 km)",
      lienVille: "secteur_pertinent",
      source: "https://www.foireurop.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  patrimoineNotable: [
    {
      nom: "Cité de l'Automobile — Musée National (collection Schlumpf, plus grand musée auto du monde)",
      type: "musee",
      source: "https://www.citedelautomobile.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Cité du Train — Patrimoine SNCF (plus grand musée ferroviaire d'Europe)",
      type: "musee",
      source: "https://www.citedutrain.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Musée de l'Impression sur Étoffes (héritage textile DMC)",
      type: "musee",
      source: "https://www.musee-impression.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Temple Saint-Étienne (plus haut édifice protestant de France, 97 m)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Temple_Saint-%C3%89tienne_de_Mulhouse",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Hôtel de Ville de Mulhouse (Renaissance rhénane, 1552)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/H%C3%B4tel_de_ville_de_Mulhouse",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Parc Zoologique et Botanique de Mulhouse",
      type: "parc",
      source: "https://www.zoo-mulhouse.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Musée EDF Électropolis (musée de l'électricité)",
      type: "musee",
      source: "https://www.musee-electropolis.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  communesBassin: [
    {
      slug: "riedisheim",
      nameFr: "Riedisheim",
      distanceKm: 2,
      source: "https://fr.wikipedia.org/wiki/Riedisheim",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "kingersheim",
      nameFr: "Kingersheim",
      distanceKm: 3,
      source: "https://fr.wikipedia.org/wiki/Kingersheim",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "illzach",
      nameFr: "Illzach",
      distanceKm: 4,
      source: "https://fr.wikipedia.org/wiki/Illzach",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "pfastatt",
      nameFr: "Pfastatt",
      distanceKm: 5,
      source: "https://fr.wikipedia.org/wiki/Pfastatt",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "lutterbach",
      nameFr: "Lutterbach",
      distanceKm: 6,
      source: "https://fr.wikipedia.org/wiki/Lutterbach",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "brunstatt-didenheim",
      nameFr: "Brunstatt-Didenheim",
      distanceKm: 7,
      source: "https://fr.wikipedia.org/wiki/Brunstatt-Didenheim",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "rixheim",
      nameFr: "Rixheim",
      distanceKm: 8,
      source: "https://fr.wikipedia.org/wiki/Rixheim",
      verifiedOn: "2026-05-18",
    },
  ],

  vignoblesProches: [
    {
      aoc: "Alsace AOC — Route des Vins d'Alsace (Sud-Alsace)",
      distanceKm: 15,
      source: "https://fr.wikipedia.org/wiki/Vignoble_d%27Alsace",
      verifiedOn: "2026-05-18",
    },
    {
      aoc: "Crémant d'Alsace",
      distanceKm: 15,
      source: "https://fr.wikipedia.org/wiki/Cr%C3%A9mant_d%27Alsace",
      verifiedOn: "2026-05-18",
    },
    {
      aoc: "Alsace Grand Cru (51 lieux-dits classés, dont plusieurs Haut-Rhin)",
      distanceKm: 25,
      source: "https://fr.wikipedia.org/wiki/Alsace_grand_cru",
      verifiedOn: "2026-05-18",
    },
  ],

  labelsEpvEtArtisanat: [],

  zonesActivitesParcs: [
    {
      nom: "Parc des Collines (technopôle Mulhouse)",
      type: "parc_tech",
      secteurDominant: "Tertiaire supérieur / R&D / formation",
      source: "https://fr.wikipedia.org/wiki/Mulhouse",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Zone Industrielle Mulhouse-Île Napoléon (Illzach/Sausheim)",
      type: "district_eco",
      secteurDominant: "Automobile (usine Stellantis) / industrie lourde / logistique",
      source: "https://fr.wikipedia.org/wiki/Sausheim",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Technoparc de Mulhouse-Bourtzwiller (siège Pôle Véhicule du Futur)",
      type: "technopole",
      secteurDominant: "Automobile / mobilité du futur / hydrogène",
      source: "https://www.vehiculedufutur.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Quartier DMC (reconversion friche textile en quartier mixte créatif)",
      type: "district_eco",
      secteurDominant: "Économie créative / artisanat / tertiaire culturel",
      source: "https://www.motoco.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Port Rhénan de Mulhouse-Île Napoléon (PortAlsace)",
      type: "district_eco",
      secteurDominant: "Logistique fluviale Rhin / industrie",
      source: "https://www.portalsace.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  grandesEcolesEtUniversites: [
    {
      nom: "Université de Haute-Alsace (UHA)",
      type: "universite",
      specialites: [
        "Sciences",
        "Lettres et sciences humaines",
        "Sciences économiques, sociales et juridiques",
        "Formation par apprentissage (précurseur)",
      ],
      source: "https://www.uha.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ENSISA (École Nationale Supérieure d'Ingénieurs Sud-Alsace)",
      type: "ecole_ingenieur",
      specialites: [
        "Mécanique",
        "Informatique et réseaux",
        "Systèmes embarqués",
        "Textile et fibres",
      ],
      source: "https://www.ensisa.uha.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ENSCMu (École Nationale Supérieure de Chimie de Mulhouse, fondée 1822)",
      type: "ecole_ingenieur",
      specialites: ["Chimie", "Génie des procédés", "Matériaux", "Chimie verte"],
      source: "https://www.enscmu.uha.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "IUT de Mulhouse",
      type: "iut",
      specialites: [
        "Génie mécanique",
        "Génie électrique",
        "Informatique",
        "GEA",
        "Métiers du multimédia",
      ],
      source: "https://www.iutmulhouse.uha.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "EM Strasbourg Business School — antenne Colmar (proximité)",
      type: "ecole_commerce",
      specialites: ["Management", "Affaires européennes"],
      source: "https://www.em-strasbourg.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  polesRechercheRD: [
    {
      nom: "IS2M (Institut de Science des Matériaux de Mulhouse, UMR CNRS 7361)",
      organisme: "cnrs",
      domaine: "Science des matériaux / polymères / surfaces / nano",
      source: "https://www.is2m.uha.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "IRIMAS (Institut de Recherche en Informatique, Mathématiques, Automatique et Signal)",
      organisme: "autre",
      domaine: "Informatique / IA / automatique / signal (UHA, équipe d'accueil)",
      source: "https://www.irimas.uha.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "LPIM (Laboratoire de Photochimie et d'Ingénierie Macromoléculaires)",
      organisme: "autre",
      domaine: "Photochimie / polymères / matériaux fonctionnels (UHA)",
      source: "https://www.lpim.uha.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "CNRS Délégation Alsace (rayonnement Mulhouse via UMR)",
      organisme: "cnrs",
      domaine: "Recherche fondamentale toutes disciplines",
      source: "https://www.alsace.cnrs.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  grandsGroupesImplantes: [
    {
      nom: "Stellantis Mulhouse (ex-PSA Peugeot Citroën)",
      secteur: "Automobile (production Peugeot 308/3008, DS7) — usine historique depuis 1962",
      typeImplantation: "usine_principale",
      source: "https://fr.wikipedia.org/wiki/Usine_Stellantis_de_Mulhouse",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Clemessy (groupe Eiffage Énergie Systèmes)",
      secteur: "Ingénierie électrique / industrielle / maintenance",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/Clemessy",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Wärtsilä France",
      secteur: "Énergie / moteurs marins / centrales électriques",
      typeImplantation: "site_majeur",
      source: "https://www.wartsila.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Sew-Usocome (Haguenau/Mulhouse — moteurs et réducteurs)",
      secteur: "Mécatronique / motoréducteurs industriels",
      typeImplantation: "site_majeur",
      source: "https://fr.wikipedia.org/wiki/Sew-Usocome",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Mars Wrigley France (Steinbourg / bassin Alsace)",
      secteur: "Agroalimentaire / confiserie",
      typeImplantation: "usine_principale",
      source: "https://fr.wikipedia.org/wiki/Mars_(entreprise)",
      verifiedOn: "2026-05-18",
    },
  ],

  kbSectorTags: [
    "automobile-mobilite",
    "industrie-manufacturiere",
    "chimie-pharma",
    "enseignement-recherche",
  ],

  capitaleFrenchTech: {
    statut: "communaute",
    nomChapitre: "French Tech Alsace (communauté couvrant Strasbourg/Mulhouse/Colmar)",
    source: "https://lafrenchtech-alsace.eu/",
    verifiedOn: "2026-05-18",
  },

  cciCompetente: {
    nom: "CCI Alsace Eurométropole (antenne Mulhouse Sud-Alsace)",
    source: "https://www.alsace-eurometropole.cci.fr/",
    verifiedOn: "2026-05-18",
  },

  distancesGrandesMetropoles: [
    {
      metropole: "Bâle (Suisse)",
      distanceKm: 30,
      tempsMnRoute: 30,
      source: "https://www.euroairport.com/fr/",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Strasbourg",
      distanceKm: 110,
      tempsMnTgv: 50,
      tempsMnRoute: 70,
      source: "https://www.sncf-connect.com/",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Paris",
      distanceKm: 460,
      tempsMnTgv: 165,
      source: "https://www.sncf-connect.com/",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Fribourg-en-Brisgau (Allemagne)",
      distanceKm: 60,
      tempsMnRoute: 60,
      source: "https://fr.wikipedia.org/wiki/Mulhouse",
      verifiedOn: "2026-05-18",
    },
  ],

  incubateursAccelerateurs: [
    {
      nom: "SEMIA (Incubateur Grand Est — antenne Mulhouse)",
      focus: "Deeptech / biotech / numérique",
      source: "https://www.semia.inc/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "KMØ (Campus connecté Mulhouse — numérique et industrie 4.0)",
      focus: "Numérique / industrie 4.0 / startups B2B",
      source: "https://www.kmo.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Technopole de la Région Mulhousienne",
      focus: "Pépinière généraliste / accompagnement entreprises innovantes",
      source: "https://www.technopole-mulhouse.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  specificitesLocales: [
    {
      theme: "cite_automobile_schlumpf",
      description:
        "Cité de l'Automobile — Musée National (collection Schlumpf) : plus grand musée automobile du monde, abritant la plus grande collection de Bugatti au monde. Bugatti a été fondée et a son siège à Molsheim (Alsace, ~90 km), mais Mulhouse conserve le fonds Schlumpf, collection privée rachetée par l'État.",
      source: "https://www.citedelautomobile.com/",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "capitale_musees_techniques",
      description:
        "Capitale française des musées techniques : Cité de l'Automobile (1er mondial auto) + Cité du Train (1er européen ferroviaire) + Musée Impression sur Étoffes + Électropolis (EDF).",
      source: "https://www.mulhouse.fr/decouvrir/musees/",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "heritage_textile_dmc",
      description:
        "Berceau de l'industrie textile alsacienne — DMC (Dollfus-Mieg) fondée 1746, capitale française de l'impression sur étoffes au XIXe siècle.",
      source: "https://fr.wikipedia.org/wiki/Dollfus-Mieg_et_Compagnie",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "transfrontalier_trinational",
      description:
        "Position trinationale France-Suisse-Allemagne — EuroAirport Bâle-Mulhouse-Freiburg à 25 km, Bâle 30 km, Fribourg-en-Brisgau 60 km.",
      source: "https://www.euroairport.com/fr/",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "automobile_stellantis",
      description:
        "Usine Stellantis Mulhouse (Île Napoléon) — site historique Peugeot depuis 1962, production Peugeot 308/3008 et DS7, ~6 000 salariés.",
      source: "https://fr.wikipedia.org/wiki/Usine_Stellantis_de_Mulhouse",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "republique_mulhouse",
      description:
        "Ancienne République indépendante de Mulhouse (1515-1798) — alliée des cantons suisses avant rattachement volontaire à la France révolutionnaire.",
      source: "https://fr.wikipedia.org/wiki/R%C3%A9publique_de_Mulhouse",
      verifiedOn: "2026-05-18",
    },
  ],

  notApplicableFields: ["labelsEpvEtArtisanat"],

  lastReviewedOn: "2026-05-18",
  reviewedBy: "Claude Code Opus 4.7 (sprint City Quality V3 ville #38)",
};
