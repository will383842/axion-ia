// Le Havre (76351) — data économique enrichie sourcée V3 multi-taille.
//
// Sprint City Quality V3 2026-05-18, ville n°15.
// Contrat zéro invention : chaque champ a un `source` vérifiable.
//
// Sources canoniques utilisées :
//   - INSEE dossier complet commune 76351 (2011101)
//   - competitivite.gouv.fr — pôles Phase V 2023-2026 (Nov@log, Mov'eo)
//   - Sites officiels pôles (novalog.eu, pole-moveo.org)
//   - HAROPA PORT (1er port français à conteneurs, axe Seine)
//   - UNESCO whc.unesco.org/en/list/1181 (centre-ville reconstruit Perret 2005)
//   - SNCF Connect (gare Le Havre) + Aéroport Le Havre-Octeville
//   - Wikipédia articles entreprises/écoles/patrimoine
//   - INAO (Camembert de Normandie AOP, Pont-l'Évêque AOP, Livarot AOP,
//     Calvados AOC, Cidre Pays d'Auge AOP, Neufchâtel AOP)
//   - Sites officiels salons (transatjacquesvabre.org, foiredelange-le-havre)
//   - Sites officiels écoles (univ-lehavre.fr, isel.univ-lehavre.fr,
//     em-normandie.com, sciencespo.fr/college/le-havre)
//
// Reviewer : Claude Code Opus 4.7 (sprint City Quality V3 ville #15).

import type { VilleEconomicData } from "./types";

export const LE_HAVRE_ECONOMIC_DATA: VilleEconomicData = {
  // ─── Couche 1 — Économie INSEE ──────────────────────────────────────
  topSectorsNaf: [
    {
      naf: "GHI",
      label: "Commerce, transports, hébergement et restauration (sections G+H+I)",
      rank: 1,
      etablissementsCount: 3278,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-76351",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "OPQ",
      label: "Administration publique, enseignement, santé, action sociale (sections O+P+Q)",
      rank: 2,
      etablissementsCount: 1953,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-76351",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "MN",
      label:
        "Activités spécialisées, scientifiques et techniques + services administratifs (sections M+N)",
      rank: 3,
      etablissementsCount: 1951,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-76351",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "RU",
      label: "Autres activités de services (sections R+S+T+U)",
      rank: 4,
      etablissementsCount: 1178,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-76351",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "F",
      label: "Construction",
      rank: 5,
      etablissementsCount: 661,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-76351",
      verifiedOn: "2026-05-18",
    },
  ],

  polesCompetitivite: [
    {
      nom: "Nov@log",
      secteur:
        "Logistique / supply chain (unique pôle de compétitivité français dédié à l'innovation logistique)",
      type: "siege",
      source: "https://www.novalog.eu/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Mov'eo",
      secteur: "Mobilité automobile / véhicule du futur / R&D collaborative",
      type: "rayonnement",
      source: "https://pole-moveo.org/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Cosmetic Valley (rayonnement Normandie)",
      secteur: "Cosmétique / parfumerie / dermo-cosmétique",
      type: "rayonnement",
      source: "https://www.cosmetic-valley.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  distances: {
    gareTgv: {
      nom: "Gare du Havre (intercité Paris Saint-Lazare ~2h, pas de TGV direct)",
      distanceKm: 0,
      source: "https://www.sncf-connect.com/gares/le-havre",
    },
    aeroportPrincipal: {
      nom: "Aéroport du Havre-Octeville",
      distanceKm: 7,
      source: "https://www.lehavre.aeroport.fr/",
    },
    metroOuTram: {
      lignes: 2,
      source: "https://www.transports-lia.fr/",
    },
    verifiedOn: "2026-05-18",
  },

  statsInsee: {
    etablissementsActifs: 10_876,
    creationsEntreprises: 2212,
    anneeReference: 2023,
    source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-76351",
    verifiedOn: "2026-05-18",
  },

  // ─── Couche 2 — Matière éditoriale unique ───────────────────────────
  marquesHistoriques: [
    {
      nom: "Compagnie Générale Transatlantique (« Transat »)",
      secteur: "Transport maritime / paquebots transatlantiques (héritage XIXe-XXe)",
      lienVille: "heritage",
      source: "https://fr.wikipedia.org/wiki/Compagnie_g%C3%A9n%C3%A9rale_transatlantique",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Raffinerie de Normandie (TotalEnergies, héritage CFR puis Total)",
      secteur: "Raffinage / pétrochimie",
      lienVille: "production",
      source: "https://fr.wikipedia.org/wiki/Raffinerie_de_Normandie",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Renault (usine Sandouville depuis 1964)",
      secteur: "Automobile / véhicules utilitaires et premium",
      lienVille: "production",
      source: "https://fr.wikipedia.org/wiki/Usine_Renault_de_Sandouville",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Safran Nacelles (ex-Hurel-Hispano, siège Gonfreville-l'Orcher)",
      secteur: "Aéronautique / nacelles de moteurs d'avion",
      lienVille: "siege",
      source: "https://fr.wikipedia.org/wiki/Safran_Nacelles",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Café Jacques Vabre",
      secteur: "Café / agroalimentaire (Le Havre = 1er port caféier français historique)",
      lienVille: "heritage",
      source: "https://fr.wikipedia.org/wiki/Jacques_Vabre",
      verifiedOn: "2026-05-18",
    },
  ],

  produitsIgpAop: [
    {
      nom: "Camembert de Normandie (AOP)",
      categorie: "fromage",
      signe: "AOP",
      source: "https://www.inao.gouv.fr/produit/3499",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Pont-l'Évêque (AOP)",
      categorie: "fromage",
      signe: "AOP",
      source: "https://www.inao.gouv.fr/produit/3500",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Livarot (AOP)",
      categorie: "fromage",
      signe: "AOP",
      source: "https://www.inao.gouv.fr/produit/3502",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Neufchâtel (AOP)",
      categorie: "fromage",
      signe: "AOP",
      source: "https://www.inao.gouv.fr/produit/3501",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Calvados (AOC)",
      categorie: "spiritueux",
      signe: "AOC",
      source: "https://www.inao.gouv.fr/produit/3475",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Cidre Pays d'Auge (AOP)",
      categorie: "boissons",
      signe: "AOP",
      source: "https://www.inao.gouv.fr/produit/3476",
      verifiedOn: "2026-05-18",
    },
  ],

  salonsSectoriels: [
    {
      nom: "Transat Jacques Vabre",
      secteur:
        "Voile / course transatlantique (route du café Le Havre → Martinique, biennale depuis 1993)",
      localisation: "Bassin Paul Vatine, Le Havre (départ historique)",
      lienVille: "accueille",
      source: "https://www.transatjacquesvabre.org/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Foire Internationale du Havre",
      secteur: "Généraliste / habitat / artisanat / loisirs",
      localisation: "Docks Café, Le Havre",
      lienVille: "accueille",
      source: "https://www.docks-cafe.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "SITL (Semaine Internationale du Transport et de la Logistique)",
      secteur: "Logistique / transport / supply chain (secteur pertinent pour Nov@log)",
      localisation: "Paris (secteur pertinent pour cluster maritime/logistique Le Havre)",
      lienVille: "secteur_pertinent",
      source: "https://www.sitl.eu/",
      verifiedOn: "2026-05-18",
    },
  ],

  patrimoineNotable: [
    {
      nom: "Le Havre, la ville reconstruite par Auguste Perret (UNESCO depuis 2005)",
      type: "unesco",
      source: "https://whc.unesco.org/en/list/1181/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Église Saint-Joseph (Auguste Perret, tour-lanterne 107 m)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/%C3%89glise_Saint-Joseph_du_Havre",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Le Volcan (Oscar Niemeyer, 1982 — scène nationale et bibliothèque)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Le_Volcan_(architecture)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "MuMa — Musée d'art moderne André Malraux",
      type: "musee",
      source: "https://www.muma-lehavre.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Appartement témoin Perret (immeubles sans affectation individuelle, ISAI)",
      type: "musee",
      source: "https://fr.wikipedia.org/wiki/Appartement_t%C3%A9moin_Perret",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Cathédrale Notre-Dame du Havre (XVIe-XVIIe, classée MH)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Cath%C3%A9drale_Notre-Dame_du_Havre",
      verifiedOn: "2026-05-18",
    },
  ],

  communesBassin: [
    {
      slug: "gonfreville-l-orcher",
      nameFr: "Gonfreville-l'Orcher",
      distanceKm: 7,
      source: "https://fr.wikipedia.org/wiki/Gonfreville-l%27Orcher",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "montivilliers",
      nameFr: "Montivilliers",
      distanceKm: 8,
      source: "https://fr.wikipedia.org/wiki/Montivilliers",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "harfleur",
      nameFr: "Harfleur",
      distanceKm: 6,
      source: "https://fr.wikipedia.org/wiki/Harfleur",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "octeville-sur-mer",
      nameFr: "Octeville-sur-Mer",
      distanceKm: 7,
      source: "https://fr.wikipedia.org/wiki/Octeville-sur-Mer",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "sainte-adresse",
      nameFr: "Sainte-Adresse",
      distanceKm: 3,
      source: "https://fr.wikipedia.org/wiki/Sainte-Adresse",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "saint-romain-de-colbosc",
      nameFr: "Saint-Romain-de-Colbosc",
      distanceKm: 18,
      source: "https://fr.wikipedia.org/wiki/Saint-Romain-de-Colbosc",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "fecamp",
      nameFr: "Fécamp",
      distanceKm: 40,
      source: "https://fr.wikipedia.org/wiki/F%C3%A9camp",
      verifiedOn: "2026-05-18",
    },
  ],

  // Pas de vignoble AOC viticole ≤ 50 km du Havre (la Normandie n'est pas
  // une région viticole — c'est une région cidricole + calvados). Les AOC
  // viticoles les plus proches (Vins de Pays de la Loire) sont à >150 km.
  // Le Calvados AOC et le Cidre Pays d'Auge AOP sont déjà capturés dans
  // produitsIgpAop. Champ honnêtement vide.
  vignoblesProches: [],

  // ─── Couche 3 — Multi-taille PME/ETI/GE ─────────────────────────

  // Label EPV : sans source individuelle confirmée par entreprise du Havre,
  // champ honnêtement vide pour respecter zéro invention. Annuaire officiel :
  // https://www.epv.org/annuaire
  labelsEpvEtArtisanat: [],

  zonesActivitesParcs: [
    {
      nom: "Zone Industrialo-Portuaire du Havre (ZIP — HAROPA Port)",
      type: "autre",
      secteurDominant:
        "Logistique conteneurs / raffinage / pétrochimie / agroalimentaire / automobile",
      source: "https://www.haropaport.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Synerzip-LH (Synergie Zone Industrialo-Portuaire Le Havre)",
      type: "district_eco",
      secteurDominant: "Industrie lourde / énergie / chimie (association d'industriels)",
      source: "https://www.synerzip-lh.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Plateau Dollemard / Frileuse (parc d'activités nord Le Havre)",
      type: "autre",
      secteurDominant: "Industrie / logistique / PME",
      source: "https://www.lehavreseinemetropole.fr/laissez-vous-inspirer-par-nos-leaders-mondiaux",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Parc Logistique du Pont de Normandie",
      type: "parc_tech",
      secteurDominant: "Logistique / supply chain / e-commerce",
      source: "https://www.haropaport.com/fr/le-havre/zones-industrielles-portuaires",
      verifiedOn: "2026-05-18",
    },
  ],

  grandesEcolesEtUniversites: [
    {
      nom: "Université Le Havre Normandie (ULHN)",
      type: "universite",
      specialites: [
        "Sciences",
        "Lettres et langues",
        "Droit et économie",
        "Sciences humaines",
        "STAPS",
      ],
      source: "https://www.univ-lehavre.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ISEL — Institut Supérieur d'Études Logistiques (école ingénieur publique, ULHN)",
      type: "ecole_ingenieur",
      specialites: [
        "Ingénieur généraliste en logistique (unique en France)",
        "Mécanique et production",
        "Logistique industrielle",
        "Mix énergétique et réseaux intelligents",
      ],
      source: "https://isel.univ-lehavre.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "EM Normandie (École de Management de Normandie, fondée 1871 au Havre)",
      type: "ecole_commerce",
      specialites: ["Management", "Finance", "Marketing", "Supply chain", "International business"],
      source: "https://www.em-normandie.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Sciences Po Le Havre (Campus Euro-Asiatique du Collège universitaire)",
      type: "sciences_po",
      specialites: [
        "Sciences politiques",
        "Affaires publiques",
        "Études européennes et asiatiques",
      ],
      source: "https://www.sciencespo.fr/college/fr/page/le-campus-du-havre",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ENSM — École Nationale Supérieure Maritime (site Le Havre)",
      type: "ecole_ingenieur",
      specialites: ["Officiers marine marchande", "Génie maritime", "Sécurité maritime"],
      source: "https://www.supmaritime.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  polesRechercheRD: [
    {
      nom: "CNRS — sites Le Havre (laboratoires LMAH, LMN, etc.)",
      organisme: "cnrs",
      domaine: "Mathématiques appliquées / mécanique / informatique",
      source: "https://www.univ-lehavre.fr/recherche/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "CERTAM (Centre d'Études et de Recherches Technologiques en Aérothermique et Moteurs)",
      organisme: "autre",
      domaine: "Aéronautique / motorisation / aérothermique (proche Rouen, bassin Normandie)",
      source: "https://www.certam.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "CRIANN — Centre Régional Informatique et d'Applications Numériques de Normandie",
      organisme: "autre",
      domaine: "Calcul haute performance / IA / data science",
      source: "https://www.criann.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  grandsGroupesImplantes: [
    {
      nom: "TotalEnergies — Raffinerie de Normandie (Gonfreville-l'Orcher, ~1500 salariés)",
      secteur: "Raffinage / pétrochimie (plus grande raffinerie de France, 12 Mt/an)",
      typeImplantation: "site_majeur",
      source: "https://fr.wikipedia.org/wiki/Raffinerie_de_Normandie",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Renault — Usine de Sandouville (depuis 1964)",
      secteur: "Automobile / véhicules utilitaires et premium",
      typeImplantation: "usine_principale",
      source: "https://fr.wikipedia.org/wiki/Usine_Renault_de_Sandouville",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Safran Nacelles (siège social Gonfreville-l'Orcher)",
      secteur: "Aéronautique / nacelles de moteurs d'avion (~4000 salariés monde)",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/Safran_Nacelles",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Yara France (usine Le Havre)",
      secteur: "Engrais azotés / chimie agro",
      typeImplantation: "usine_principale",
      source: "https://www.yara.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Sidel (siège Octeville-sur-Mer)",
      secteur: "Équipements d'emballage / lignes PET / packaging boissons",
      typeImplantation: "siege_social",
      source: "https://www.sidel.com/fr",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "CMA CGM (Terminal de France Le Havre — base hub Atlantique)",
      secteur: "Transport maritime / armateur conteneurs",
      typeImplantation: "site_majeur",
      source: "https://www.cma-cgm.com/local/france/agencies/le-havre",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "HAROPA PORT (siège axe Seine Le Havre + Rouen + Paris)",
      secteur: "Autorité portuaire / logistique maritime",
      typeImplantation: "siege_social",
      source: "https://www.haropaport.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Chevron Oronite (additifs lubrifiants, site Gonfreville-l'Orcher)",
      secteur: "Chimie / additifs pétroliers",
      typeImplantation: "site_majeur",
      source: "https://www.chevronoronite.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Couche 2bis — tags KB sectorielles ─────────────────────────────
  // Volontairement vide en V1 : la KB Prisma ne contient pas encore
  // d'entries sectorielles dédiées (Phase B du sprint).
  kbSectorTags: ["maritime-portuaire", "logistique-supply-chain", "energie-cleantech"],

  // ─── Optionnels (hors scoring dashboard) ────────────────────────────
  capitaleFrenchTech: {
    statut: "communaute",
    nomChapitre: "French Tech Normandie (communauté labellisée incluant Le Havre)",
    source: "https://www.frenchtech-normandie.fr/",
    verifiedOn: "2026-05-18",
  },

  cciCompetente: {
    nom: "CCI Seine Estuaire (Le Havre + Fécamp-Bolbec)",
    source: "https://www.seine-estuaire.cci.fr/",
    verifiedOn: "2026-05-18",
  },

  distancesGrandesMetropoles: [
    {
      metropole: "Paris",
      distanceKm: 200,
      tempsMnTgv: 130,
      tempsMnRoute: 130,
      source: "https://www.sncf-connect.com/",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Rouen",
      distanceKm: 90,
      tempsMnRoute: 60,
      source: "https://fr.wikipedia.org/wiki/Le_Havre",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Caen",
      distanceKm: 90,
      tempsMnRoute: 70,
      source: "https://fr.wikipedia.org/wiki/Le_Havre",
      verifiedOn: "2026-05-18",
    },
  ],

  incubateursAccelerateurs: [
    {
      nom: "Seinari (incubateur régional Normandie, antenne Le Havre)",
      focus: "Deeptech / numérique / industrie / biotech",
      source: "https://www.seinari.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Le 144 (pépinière d'entreprises Le Havre Seine Métropole)",
      focus: "Startups / numérique / création d'entreprise",
      source: "https://www.lehavreseinemetropole.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Normandie Web Xperts / NWX",
      focus: "Numérique / web / startups tech régionales",
      source: "https://www.nwx.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Spécificités locales ───────────────────────────────────────────
  specificitesLocales: [
    {
      theme: "port_maritime_premier_conteneurs",
      description:
        "HAROPA Port Le Havre : 1er port français à conteneurs, 3,1 M EVP en 2024 (+19 % vs 2023), 2e port français en tonnage global, hub Atlantique de CMA CGM.",
      source: "https://www.haropaport.com/",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "patrimoine_unesco_perret_2005",
      description:
        "Centre-ville reconstruit par Auguste Perret (1945-1964) inscrit UNESCO depuis 2005 — 150 hectares, unique exemple d'urbanisme XXe siècle reconnu patrimoine mondial.",
      source: "https://whc.unesco.org/en/list/1181/",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "hub_petrochimie_nord_europe",
      description:
        "Plateforme TotalEnergies Gonfreville-l'Orcher = plus grande raffinerie de France (12 Mt/an), cluster pétrochimique majeur Nord Europe (Yara, Chevron Oronite, Air Liquide).",
      source: "https://fr.wikipedia.org/wiki/Raffinerie_de_Normandie",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "cluster_logistique_unique",
      description:
        "Nov@log = unique pôle de compétitivité français 100 % dédié à l'innovation logistique et supply chain (152 membres Normandie + Île-de-France), siège Le Havre.",
      source: "https://www.novalog.eu/",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Métadonnées de revue ───────────────────────────────────────────
  lastReviewedOn: "2026-05-18",
  reviewedBy: "Claude Code Opus 4.7 (sprint City Quality V3 ville #15)",
};
