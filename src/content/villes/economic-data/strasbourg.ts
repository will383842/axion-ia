// Strasbourg (67482) — data économique enrichie sourcée V3.
// Sprint City Quality 39 villes pilote, ville #8.
// Spécificité majeure : capitale européenne (Parlement, CoE, CEDH).

import type { VilleEconomicData } from "./types";

export const STRASBOURG_ECONOMIC_DATA: VilleEconomicData = {
  topSectorsNaf: [
    {
      naf: "MN",
      label: "Activités spécialisées, scientifiques et techniques + services administratifs",
      rank: 1,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-67482",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "GHI",
      label: "Commerce, transports, hébergement et restauration",
      rank: 2,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-67482",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "OPQ",
      label:
        "Administration publique, enseignement, santé, action sociale (surreprésenté à Strasbourg)",
      rank: 3,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-67482",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "J",
      label: "Information et communication (édition, logiciels, IT, médias — ARTE)",
      rank: 4,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-67482",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "C",
      label: "Industrie manufacturière (Kronenbourg brasserie, Lilly pharma, mécanique)",
      rank: 5,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-67482",
      verifiedOn: "2026-05-18",
    },
  ],

  polesCompetitivite: [
    {
      nom: "Alsace BioValley",
      secteur: "Sciences de la vie / biotech / dispositifs médicaux",
      type: "siege",
      source: "https://www.alsace-biovalley.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Hydreos",
      secteur: "Filière eau / gestion ressources hydriques",
      type: "siege",
      source: "https://www.hydreos.fr/",
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
      nom: "Pôle Véhicule du Futur",
      secteur: "Automobile / mobilité décarbonée / hydrogène",
      type: "rayonnement",
      source: "https://www.vehiculedufutur.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  distances: {
    gareTgv: {
      nom: "Gare de Strasbourg — TGV Est (Paris ~1h46), Rhin-Rhône, ICE Allemagne",
      distanceKm: 0,
      source: "https://www.sncf-connect.com/gares/strasbourg",
    },
    aeroportPrincipal: {
      nom: "Aéroport Strasbourg-Entzheim (SXB) + EuroAirport Bâle-Mulhouse à 130 km",
      distanceKm: 12,
      source: "https://www.strasbourg.aeroport.fr/",
    },
    metroOuTram: {
      lignes: 6,
      source: "https://www.cts-strasbourg.eu/fr/se-deplacer/tram-bus/plans-reseau/",
    },
    verifiedOn: "2026-05-18",
  },

  statsInsee: {
    anneeReference: 2023,
    source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-67482",
    verifiedOn: "2026-05-18",
  },

  marquesHistoriques: [
    {
      nom: "Kronenbourg (Brasseries Kronenbourg)",
      secteur: "Brasserie / agroalimentaire",
      lienVille: "fondation",
      source: "https://fr.wikipedia.org/wiki/Brasseries_Kronenbourg",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Schmidt Groupe (cuisines & rangements)",
      secteur: "Mobilier / agencement intérieur",
      lienVille: "siege",
      source: "https://fr.wikipedia.org/wiki/Schmidt_Groupe",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Port Autonome de Strasbourg",
      secteur: "Logistique fluviale / 2e port fluvial français",
      lienVille: "siege",
      source: "https://fr.wikipedia.org/wiki/Port_autonome_de_Strasbourg",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ARTE GEIE (chaîne franco-allemande)",
      secteur: "Médias / audiovisuel public européen",
      lienVille: "siege",
      source: "https://fr.wikipedia.org/wiki/Arte",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Eli Lilly France (site Fegersheim, Eurométropole)",
      secteur: "Pharmaceutique / biotechnologie",
      lienVille: "production",
      source: "https://fr.wikipedia.org/wiki/Eli_Lilly_and_Company",
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
      nom: "Crème fraîche fluide d'Alsace",
      categorie: "Agroalimentaire",
      signe: "IGP",
      source: "https://fr.wikipedia.org/wiki/Cr%C3%A8me_fra%C3%AEche_fluide_d%27Alsace",
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
      nom: "Foire Européenne de Strasbourg",
      secteur: "Salon généraliste référence Grand Est",
      localisation: "Parc des Expositions du Wacken, Strasbourg",
      lienVille: "accueille",
      source: "https://www.foireurop.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "BIOBAT (construction biosourcée)",
      secteur: "Construction durable / matériaux biosourcés",
      localisation: "Parc Expo Strasbourg",
      lienVille: "accueille",
      source: "https://www.salon-biobat.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Egast (Salon CHR Grand Est)",
      secteur: "CHR / gastronomie / équipements pro",
      localisation: "Parc Expo Strasbourg",
      lienVille: "accueille",
      source: "https://www.egast.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ST'ART (Foire européenne d'art contemporain)",
      secteur: "Art contemporain / marché de l'art",
      localisation: "Parc Expo Strasbourg",
      lienVille: "accueille",
      source: "https://www.start-strasbourg.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  patrimoineNotable: [
    {
      nom: "Strasbourg, Grande-Île et Neustadt (UNESCO 1988, étendu 2017)",
      type: "unesco",
      source: "https://whc.unesco.org/en/list/495",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Cathédrale Notre-Dame de Strasbourg",
      type: "monument",
      source: "https://www.cathedrale-strasbourg.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Palais Rohan (Musées de Strasbourg)",
      type: "musee",
      source: "https://www.musees.strasbourg.eu/palais-rohan",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Quartier de la Petite France",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Petite_France_(Strasbourg)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "MAMCS (Musée d'Art moderne et contemporain de Strasbourg)",
      type: "musee",
      source: "https://www.musees.strasbourg.eu/musee-d-art-moderne-et-contemporain",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Palais de l'Europe (siège Conseil de l'Europe)",
      type: "monument",
      source: "https://www.coe.int/fr/web/about-us/our-buildings",
      verifiedOn: "2026-05-18",
    },
  ],

  communesBassin: [
    {
      slug: "schiltigheim",
      nameFr: "Schiltigheim",
      distanceKm: 4,
      source: "https://fr.wikipedia.org/wiki/Schiltigheim",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "bischheim",
      nameFr: "Bischheim",
      distanceKm: 5,
      source: "https://fr.wikipedia.org/wiki/Bischheim",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "illkirch-graffenstaden",
      nameFr: "Illkirch-Graffenstaden",
      distanceKm: 7,
      source: "https://fr.wikipedia.org/wiki/Illkirch-Graffenstaden",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "ostwald",
      nameFr: "Ostwald",
      distanceKm: 6,
      source: "https://fr.wikipedia.org/wiki/Ostwald",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "lingolsheim",
      nameFr: "Lingolsheim",
      distanceKm: 5,
      source: "https://fr.wikipedia.org/wiki/Lingolsheim",
      verifiedOn: "2026-05-18",
    },
  ],

  vignoblesProches: [
    {
      aoc: "Alsace AOC — Route des Vins d'Alsace",
      distanceKm: 20,
      source: "https://fr.wikipedia.org/wiki/Vignoble_d%27Alsace",
      verifiedOn: "2026-05-18",
    },
    {
      aoc: "Crémant d'Alsace",
      distanceKm: 20,
      source: "https://fr.wikipedia.org/wiki/Cr%C3%A9mant_d%27Alsace",
      verifiedOn: "2026-05-18",
    },
    {
      aoc: "Alsace Grand Cru (51 lieux-dits classés)",
      distanceKm: 25,
      source: "https://fr.wikipedia.org/wiki/Alsace_grand_cru",
      verifiedOn: "2026-05-18",
    },
  ],

  labelsEpvEtArtisanat: [],

  zonesActivitesParcs: [
    {
      nom: "Parc d'Innovation d'Illkirch (PII)",
      type: "parc_tech",
      secteurDominant: "Biotech / sciences de la vie / R&D pharma",
      source: "https://fr.wikipedia.org/wiki/Parc_d%27innovation_d%27Illkirch",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Espace Européen de l'Entreprise (E3, Schiltigheim)",
      type: "parc_tech",
      secteurDominant: "Tertiaire / services aux entreprises",
      source: "https://fr.wikipedia.org/wiki/Espace_europ%C3%A9en_de_l%27entreprise",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Quartier d'Affaires Wacken-Europe",
      type: "district_eco",
      secteurDominant: "Tertiaire / institutions européennes / sièges",
      source: "https://fr.wikipedia.org/wiki/Wacken_(Strasbourg)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Port du Rhin (zone industrialo-portuaire)",
      type: "district_eco",
      secteurDominant: "Logistique fluviale / industrie / agro",
      source: "https://fr.wikipedia.org/wiki/Port_autonome_de_Strasbourg",
      verifiedOn: "2026-05-18",
    },
  ],

  grandesEcolesEtUniversites: [
    {
      nom: "Université de Strasbourg (Unistra, 4 Prix Nobel)",
      type: "universite",
      specialites: ["Sciences", "Médecine", "Droit", "Sciences humaines", "Chimie"],
      source: "https://www.unistra.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "EM Strasbourg Business School",
      type: "ecole_commerce",
      specialites: ["Management", "Finance", "Affaires européennes"],
      source: "https://www.em-strasbourg.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "INSA Strasbourg",
      type: "ecole_ingenieur",
      specialites: ["Génie civil", "Génie climatique", "Mécanique", "Architecture"],
      source: "https://www.insa-strasbourg.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "INSP (Institut National du Service Public, ex-ENA)",
      type: "autre",
      specialites: ["Haute fonction publique", "Administration"],
      source: "https://www.insp.gouv.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Sciences Po Strasbourg (IEP)",
      type: "sciences_po",
      specialites: ["Sciences politiques", "Affaires européennes"],
      source: "https://www.sciencespo-strasbourg.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ENGEES (École Nationale du Génie de l'Eau et de l'Environnement)",
      type: "ecole_ingenieur",
      specialites: ["Génie de l'eau", "Environnement"],
      source: "https://engees.unistra.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ESBS (Biotechnologie de Strasbourg)",
      type: "ecole_ingenieur",
      specialites: ["Biotechnologie", "Bio-ingénierie"],
      source: "https://esbs.unistra.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  polesRechercheRD: [
    {
      nom: "IGBMC (Génétique et Biologie Moléculaire et Cellulaire)",
      organisme: "cnrs",
      domaine: "Biologie moléculaire / génétique / biomédecine (UMR CNRS/INSERM/Unistra)",
      source: "https://www.igbmc.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "CNRS Délégation Alsace",
      organisme: "cnrs",
      domaine: "Recherche fondamentale toutes disciplines",
      source: "https://www.alsace.cnrs.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "INSERM Délégation Grand Est",
      organisme: "inserm",
      domaine: "Santé / sciences biomédicales",
      source: "https://www.inserm.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "IRCAD (Recherche Cancers Appareil Digestif)",
      organisme: "autre",
      domaine: "Cancer digestif / chirurgie mini-invasive",
      source: "https://www.ircad.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ICube (sciences ingénieur, informatique, imagerie)",
      organisme: "cnrs",
      domaine: "Informatique / IA / robotique / imagerie médicale",
      source: "https://icube.unistra.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  grandsGroupesImplantes: [
    {
      nom: "Brasseries Kronenbourg (groupe Carlsberg)",
      secteur: "Brasserie / agroalimentaire",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/Brasseries_Kronenbourg",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Eli Lilly France (site Fegersheim)",
      secteur: "Pharmaceutique / biotechnologie",
      typeImplantation: "usine_principale",
      source: "https://fr.wikipedia.org/wiki/Eli_Lilly_and_Company",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ARTE GEIE",
      secteur: "Médias / audiovisuel public européen",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/Arte",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Schmidt Groupe",
      secteur: "Cuisines / mobilier",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/Schmidt_Groupe",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Hager Group",
      secteur: "Équipements électriques / domotique",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/Hager_Group",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Crédit Mutuel Alliance Fédérale",
      secteur: "Banque / assurance / finance mutualiste",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/Cr%C3%A9dit_mutuel",
      verifiedOn: "2026-05-18",
    },
  ],

  kbSectorTags: ["sante-biotech", "agroalimentaire-igp", "administration-publique"],

  capitaleFrenchTech: {
    statut: "capitale",
    nomChapitre: "French Tech Alsace",
    source: "https://lafrenchtech-alsace.eu/",
    verifiedOn: "2026-05-18",
  },

  cciCompetente: {
    nom: "CCI Alsace Eurométropole",
    source: "https://www.alsace-eurometropole.cci.fr/",
    verifiedOn: "2026-05-18",
  },

  distancesGrandesMetropoles: [
    {
      metropole: "Paris",
      distanceKm: 490,
      tempsMnTgv: 106,
      source: "https://www.sncf-connect.com/",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Francfort (Allemagne)",
      distanceKm: 220,
      tempsMnRoute: 150,
      source: "https://fr.wikipedia.org/wiki/Strasbourg",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Bâle (Suisse)",
      distanceKm: 130,
      tempsMnRoute: 90,
      source: "https://fr.wikipedia.org/wiki/Strasbourg",
      verifiedOn: "2026-05-18",
    },
  ],

  incubateursAccelerateurs: [
    {
      nom: "SEMIA (Incubateur Grand Est)",
      focus: "Deeptech / biotech / numérique",
      source: "https://www.semia.inc/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Quest for change",
      focus: "Tech / startups Alsace",
      source: "https://www.questforchange.eu/",
      verifiedOn: "2026-05-18",
    },
  ],

  specificitesLocales: [
    {
      theme: "institutions_europeennes",
      description:
        "Siège officiel du Parlement européen (12 sessions plénières/an) — valeur juridique inscrite aux traités UE.",
      source: "https://www.europarl.europa.eu/visiting/fr/article/45/strasbourg",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "conseil_europe",
      description:
        "Siège du Conseil de l'Europe (46 États membres) — distinct de l'UE, organisation paneuropéenne droits humains.",
      source: "https://www.coe.int/fr/web/portal/strasbourg",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "cour_europeenne_droits_homme",
      description:
        "Siège de la Cour Européenne des Droits de l'Homme (CEDH) — juridiction de la Convention européenne des droits de l'homme.",
      source: "https://www.echr.coe.int/",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "transfrontalier",
      description:
        "Eurodistrict Strasbourg-Ortenau — coopération transfrontalière France/Allemagne, ~960 000 habitants.",
      source: "https://www.eurodistrict.eu/",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "port_fluvial",
      description:
        "Port Autonome de Strasbourg : 2e port fluvial français après Paris, hub logistique Rhin (~8 Mt/an).",
      source: "https://www.strasbourg.port.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  notApplicableFields: ["labelsEpvEtArtisanat"],

  lastReviewedOn: "2026-05-18",
  reviewedBy: "Claude Code Opus 4.7 (sprint City Quality V3 ville #8)",
};
