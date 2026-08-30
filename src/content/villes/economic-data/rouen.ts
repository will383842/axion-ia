// Rouen (76540) — data économique enrichie sourcée V3 multi-taille.
//
// Sprint City Quality V3 2026-05-18, ville n°34.
// Contrat zéro invention : chaque champ a un `source` vérifiable.
//
// Sources canoniques utilisées :
//   - INSEE dossier complet commune 76540 (2011101)
//   - competitivite.gouv.fr — pôles Phase V 2023-2026 (Mov'eo, Nov@log,
//     Cosmetic Valley rayonnement Normandie)
//   - Sites officiels pôles (pole-moveo.org, novalog.eu, cosmetic-valley.com)
//   - HAROPA PORT (port fluvial-maritime axe Seine Le Havre-Rouen-Paris)
//   - SNCF Connect (gare Rouen-Rive-Droite) + Aéroport Rouen-Vallée de Seine
//   - Wikipédia articles entreprises/écoles/patrimoine
//   - INAO (Camembert de Normandie AOP, Pont-l'Évêque AOP, Livarot AOP,
//     Neufchâtel AOP — produit emblématique pays de Bray à 40 km Rouen,
//     Calvados AOC, Cidre Pays d'Auge AOP, Andouille de Vire IGP)
//   - Sites officiels écoles (univ-rouen.fr, neoma-bs.fr, insa-rouen.fr,
//     esigelec.fr)
//   - Sites officiels salons (armada.org, foiredelange-rouen.fr)
//   - Site French Tech Normandie (frenchtech-normandie.fr)
//
// Reviewer : Claude Code Opus 4.7 (sprint City Quality V3 ville #34).

import type { VilleEconomicData } from "./types";

export const ROUEN_ECONOMIC_DATA: VilleEconomicData = {
  // ─── Couche 1 — Économie INSEE ──────────────────────────────────────
  topSectorsNaf: [
    {
      naf: "GHI",
      label: "Commerce, transports, hébergement et restauration (sections G+H+I)",
      rank: 1,
      etablissementsCount: 3394,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-76540",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "MN",
      label:
        "Activités spécialisées, scientifiques et techniques + services administratifs (sections M+N)",
      rank: 2,
      etablissementsCount: 2666,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-76540",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "OPQ",
      label: "Administration publique, enseignement, santé, action sociale (sections O+P+Q)",
      rank: 3,
      etablissementsCount: 2357,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-76540",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "RU",
      label: "Autres activités de services (sections R+S+T+U)",
      rank: 4,
      etablissementsCount: 1255,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-76540",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "F",
      label: "Construction",
      rank: 5,
      etablissementsCount: 622,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-76540",
      verifiedOn: "2026-05-18",
    },
  ],

  polesCompetitivite: [
    {
      nom: "Mov'eo",
      secteur:
        "Mobilité automobile / véhicule du futur / R&D collaborative Normandie + Île-de-France",
      type: "rayonnement",
      source: "https://pole-moveo.org/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Nov@log (rayonnement Normandie axe Seine)",
      secteur:
        "Logistique / supply chain (unique pôle de compétitivité français dédié à l'innovation logistique)",
      type: "rayonnement",
      source: "https://www.novalog.eu/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Cosmetic Valley (rayonnement Normandie)",
      secteur:
        "Cosmétique / parfumerie / dermo-cosmétique (siège Chartres, antennes régionales Caen + Bordeaux)",
      type: "rayonnement",
      source: "https://www.cosmetic-valley.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  distances: {
    gareTgv: {
      nom: "Gare de Rouen-Rive-Droite (Intercités Normandie, non-TGV — Intercités Normandie + TER, ~1h Paris Saint-Lazare)",
      distanceKm: 0,
      source: "https://www.sncf-connect.com/gares/rouen-rive-droite",
    },
    aeroportPrincipal: {
      nom: "Aéroport Rouen-Vallée de Seine (Boos, 9 km est) — Paris-CDG hub principal",
      distanceKm: 9,
      source: "https://www.rouen.aeroport.fr/",
    },
    metroOuTram: {
      // 2 lignes tramway (axe nord-sud) + 5 lignes TEOR (BRT bus rapide).
      lignes: 2,
      source: "https://reseau-astuce.fr/",
    },
    verifiedOn: "2026-05-18",
  },

  statsInsee: {
    etablissementsActifs: 12_648,
    creationsEntreprises: 2258,
    anneeReference: 2023,
    source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-76540",
    verifiedOn: "2026-05-18",
  },

  // ─── Couche 2 — Matière éditoriale unique ───────────────────────────
  marquesHistoriques: [
    {
      nom: "Faïence de Rouen",
      secteur: "Céramique / art décoratif (héritage XVIIe-XVIIIe siècle, manufactures Poterat)",
      lienVille: "heritage",
      source: "https://fr.wikipedia.org/wiki/Fa%C3%AFence_de_Rouen",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Renault — Usine Ampère de Cléon (depuis 1958)",
      secteur:
        "Automobile / moteurs thermiques et électriques / boîtes de vitesses (~3200 salariés)",
      lienVille: "production",
      source: "https://fr.wikipedia.org/wiki/Usine_Renault_de_Cl%C3%A9on",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Lubrizol Rouen (usine chimique site Petit-Quevilly, catastrophe industrielle 26 sept. 2019)",
      secteur: "Chimie / additifs lubrifiants / pétrochimie",
      lienVille: "production",
      source: "https://fr.wikipedia.org/wiki/Incendie_de_l%27usine_Lubrizol_de_Rouen",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Janssen-Cilag (sites Val-de-Reuil / Rouen, groupe Johnson & Johnson)",
      secteur: "Pharmaceutique / production médicaments",
      lienVille: "production",
      source: "https://fr.wikipedia.org/wiki/Janssen-Cilag",
      verifiedOn: "2026-05-18",
    },
  ],

  produitsIgpAop: [
    {
      nom: "Neufchâtel (AOP)",
      categorie: "fromage",
      signe: "AOP",
      source: "https://www.inao.gouv.fr/produit/3501",
      verifiedOn: "2026-05-18",
    },
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
    {
      nom: "Andouille de Vire (IGP)",
      categorie: "charcuterie",
      signe: "IGP",
      source: "https://www.inao.gouv.fr/produit/8553",
      verifiedOn: "2026-05-18",
    },
  ],

  salonsSectoriels: [
    {
      nom: "Armada de Rouen",
      secteur:
        "Vol historique / grands voiliers / patrimoine maritime (référence mondiale, tous les 4-6 ans, dernier 2023, plus de 6 M visiteurs)",
      localisation: "Quais de Seine, Rouen",
      lienVille: "accueille",
      source: "https://www.armada.org/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Foire Internationale de Rouen",
      secteur:
        "Généraliste / habitat / artisanat / loisirs (annuelle, Parc des expositions Grand Quevilly)",
      localisation: "Parc des expositions Grand Quevilly, Rouen",
      lienVille: "accueille",
      source: "https://foiredelange-rouen.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Transat Jacques Vabre",
      secteur:
        "Voile / course transatlantique (route du café Le Havre → Martinique, biennale — secteur pertinent maritime axe Seine)",
      localisation:
        "Bassin Paul Vatine, Le Havre (secteur pertinent pour cluster maritime Seine Rouen)",
      lienVille: "secteur_pertinent",
      source: "https://www.transatjacquesvabre.org/",
      verifiedOn: "2026-05-18",
    },
  ],

  patrimoineNotable: [
    {
      nom: "Cathédrale Notre-Dame de Rouen (XIIe-XVIe siècles, façade peinte par Monet en série)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Cath%C3%A9drale_Notre-Dame_de_Rouen",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Gros-Horloge (horloge astronomique XIVe siècle, arche Renaissance XVIe)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Gros-Horloge",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Aître Saint-Maclou (ossuaire XIVe-XVIe siècle, unique en France)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/A%C3%AEtre_Saint-Maclou",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Place du Vieux-Marché (lieu du bûcher de Jeanne d'Arc, 30 mai 1431, église Sainte-Jeanne-d'Arc 1979)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Place_du_Vieux-March%C3%A9_(Rouen)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Musée des Beaux-Arts de Rouen (collection Monet, Géricault, Caravage)",
      type: "musee",
      source: "https://mbarouen.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Palais de Justice de Rouen (gothique flamboyant XVe-XVIe, ancien Parlement de Normandie)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Palais_de_justice_de_Rouen",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Historial Jeanne d'Arc (musée immersif, ancien archevêché)",
      type: "musee",
      source: "https://www.historial-jeannedarc.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  communesBassin: [
    {
      slug: "sotteville-les-rouen",
      nameFr: "Sotteville-lès-Rouen",
      distanceKm: 3,
      source: "https://fr.wikipedia.org/wiki/Sotteville-l%C3%A8s-Rouen",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "le-petit-quevilly",
      nameFr: "Le Petit-Quevilly",
      distanceKm: 3,
      source: "https://fr.wikipedia.org/wiki/Le_Petit-Quevilly",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "mont-saint-aignan",
      nameFr: "Mont-Saint-Aignan",
      distanceKm: 3,
      source: "https://fr.wikipedia.org/wiki/Mont-Saint-Aignan",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "bois-guillaume",
      nameFr: "Bois-Guillaume",
      distanceKm: 4,
      source: "https://fr.wikipedia.org/wiki/Bois-Guillaume",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "bihorel",
      nameFr: "Bihorel",
      distanceKm: 3,
      source: "https://fr.wikipedia.org/wiki/Bihorel",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "canteleu",
      nameFr: "Canteleu",
      distanceKm: 5,
      source: "https://fr.wikipedia.org/wiki/Canteleu",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "saint-etienne-du-rouvray",
      nameFr: "Saint-Étienne-du-Rouvray",
      distanceKm: 6,
      source: "https://fr.wikipedia.org/wiki/Saint-%C3%89tienne-du-Rouvray",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "le-grand-quevilly",
      nameFr: "Le Grand-Quevilly",
      distanceKm: 5,
      source: "https://fr.wikipedia.org/wiki/Le_Grand-Quevilly",
      verifiedOn: "2026-05-18",
    },
  ],

  // Pas de vignoble AOC viticole ≤ 50 km de Rouen — la Normandie n'est pas
  // une région viticole (région cidricole + calvados, déjà capturés dans
  // produitsIgpAop). Les AOC viticoles les plus proches (Vins de Pays de la
  // Loire, Champagne) sont à >150 km. Champ honnêtement vide.
  vignoblesProches: [],

  // ─── Couche 3 — Multi-taille PME/ETI/GE ─────────────────────────

  // Label EPV : sans source individuelle confirmée par entreprise de Rouen,
  // champ honnêtement vide pour respecter zéro invention. Annuaire officiel :
  // https://www.epv.org/annuaire
  labelsEpvEtArtisanat: [],

  zonesActivitesParcs: [
    {
      nom: "Technopôle du Madrillet (Saint-Étienne-du-Rouvray)",
      type: "technopole",
      secteurDominant:
        "Énergie / matériaux / mécanique / IT — campus universitaire (INSA, ESIGELEC, CNRS)",
      source: "https://fr.wikipedia.org/wiki/Technop%C3%B4le_du_Madrillet",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Zone Portuaire de Rouen (HAROPA Port axe Seine)",
      type: "autre",
      secteurDominant:
        "Logistique fluviale-maritime / céréales (1er port céréalier européen) / agro / chimie",
      source: "https://www.haropaport.com/fr/rouen",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Parc d'activités Seine Sud (Saint-Étienne-du-Rouvray / Oissel)",
      type: "district_eco",
      secteurDominant: "Industrie / logistique / artisanat (rive gauche métropole Rouen)",
      source: "https://www.metropole-rouen-normandie.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Plateau de la Vatine (Mont-Saint-Aignan)",
      type: "parc_tech",
      secteurDominant: "Tertiaire / numérique / siège régionaux / PME services",
      source: "https://fr.wikipedia.org/wiki/Mont-Saint-Aignan",
      verifiedOn: "2026-05-18",
    },
  ],

  grandesEcolesEtUniversites: [
    {
      nom: "Université de Rouen Normandie (URN)",
      type: "universite",
      specialites: [
        "Sciences et techniques",
        "Lettres et sciences humaines",
        "Droit, économie, gestion",
        "Médecine et pharmacie",
        "STAPS",
      ],
      source: "https://www.univ-rouen.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "NEOMA Business School (campus Rouen — Mont-Saint-Aignan, fusion Reims+Rouen 2013)",
      type: "ecole_commerce",
      specialites: [
        "Management",
        "Finance",
        "Marketing",
        "Supply chain",
        "Entrepreneuriat",
        "Programme Grande École",
      ],
      source: "https://www.neoma-bs.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "INSA Rouen Normandie (école ingénieur publique, Technopôle Madrillet)",
      type: "ecole_ingenieur",
      specialites: [
        "Génie civil et urbanisme",
        "Génie chimique",
        "Génie énergétique et environnement",
        "Génie industriel",
        "Génie mathématique (data/IA)",
        "Mécanique",
        "Sciences et techniques de l'ingénieur",
      ],
      source: "https://www.insa-rouen.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ESIGELEC (école ingénieurs électronique et numérique, Technopôle Madrillet)",
      type: "ecole_ingenieur",
      specialites: [
        "Électronique et systèmes embarqués",
        "Énergie et développement durable",
        "Communication numérique",
        "Ingénierie d'affaires",
        "Big data et data science",
      ],
      source: "https://www.esigelec.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ESITech (école ingénieur biotech / technologies de l'information, partenariat URN+INSA)",
      type: "ecole_ingenieur",
      specialites: ["Technologies de l'information", "Génie biologique", "Génie civil"],
      source: "https://esitech.univ-rouen.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ESADHaR (École supérieure d'art et design Le Havre-Rouen)",
      type: "autre",
      specialites: ["Art", "Design graphique", "Création littéraire"],
      source: "https://www.esadhar.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  polesRechercheRD: [
    {
      nom: "CNRS — délégation Normandie (laboratoires Université Rouen / INSA / ESIGELEC)",
      organisme: "cnrs",
      domaine:
        "Chimie / matériaux / mathématiques / mécanique / informatique (laboratoires COBRA, LITIS, LMRS)",
      source: "https://www.cnrs.fr/normandie/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "INSERM — sites Rouen (CHU + Université)",
      organisme: "inserm",
      domaine: "Santé / recherche biomédicale / cancérologie / neurosciences",
      source: "https://www.inserm.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "INRAE — sites Normandie",
      organisme: "inrae",
      domaine: "Agronomie / alimentation / environnement",
      source: "https://www.inrae.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "CRIANN — Centre Régional Informatique et d'Applications Numériques de Normandie",
      organisme: "autre",
      domaine: "Calcul haute performance / IA / data science (siège Saint-Étienne-du-Rouvray)",
      source: "https://www.criann.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  grandsGroupesImplantes: [
    {
      nom: "Renault — Usine Ampère de Cléon (depuis 1958, ~3200 salariés)",
      secteur:
        "Automobile / moteurs thermiques et électriques / boîtes de vitesses (Alliance Renault-Nissan-Mitsubishi)",
      typeImplantation: "usine_principale",
      source: "https://fr.wikipedia.org/wiki/Usine_Renault_de_Cl%C3%A9on",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Lubrizol (usine site Petit-Quevilly, groupe Berkshire Hathaway)",
      secteur: "Chimie / additifs lubrifiants pétroliers",
      typeImplantation: "site_majeur",
      source: "https://fr.wikipedia.org/wiki/Lubrizol",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Janssen-Cilag (groupe Johnson & Johnson, sites Val-de-Reuil / proche Rouen)",
      secteur: "Pharmaceutique / production médicaments",
      typeImplantation: "usine_principale",
      source: "https://fr.wikipedia.org/wiki/Janssen-Cilag",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Aircelle / Safran Nacelles (site Petit-Quevilly + siège Gonfreville-l'Orcher)",
      secteur: "Aéronautique / nacelles de moteurs d'avion",
      typeImplantation: "site_majeur",
      source: "https://fr.wikipedia.org/wiki/Safran_Nacelles",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "HAROPA PORT (port fluvial-maritime Rouen — 1er port céréalier européen)",
      secteur: "Autorité portuaire / logistique fluviale-maritime / céréales / agro / chimie",
      typeImplantation: "site_majeur",
      source: "https://www.haropaport.com/fr/rouen",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Matmut (siège social Rouen, mutuelle d'assurance)",
      secteur: "Assurance / mutuelle",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/Matmut",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Crédit Agricole Normandie-Seine (siège régional Bois-Guillaume)",
      secteur: "Banque / finance",
      typeImplantation: "siege_social",
      source: "https://www.ca-normandie-seine.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "TotalEnergies (dépôt pétrolier Petit-Couronne, ancienne raffinerie Petroplus)",
      secteur: "Énergie / stockage pétrolier",
      typeImplantation: "site_majeur",
      source: "https://fr.wikipedia.org/wiki/Raffinerie_de_Petit-Couronne",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Couche 2bis — tags KB sectorielles ─────────────────────────────
  // Volontairement vide en V1 : la KB Prisma ne contient pas encore
  // d'entries sectorielles dédiées (Phase B du sprint).
  kbSectorTags: [
    "automobile-mobilite",
    "chimie-pharma",
    "logistique-supply-chain",
    "maritime-portuaire",
  ],

  // ─── Optionnels (hors scoring dashboard) ────────────────────────────
  capitaleFrenchTech: {
    statut: "communaute",
    nomChapitre: "French Tech Normandie (communauté labellisée incluant Rouen + Caen + Le Havre)",
    source: "https://www.frenchtech-normandie.fr/",
    verifiedOn: "2026-05-18",
  },

  cciCompetente: {
    nom: "CCI Rouen Métropole (rattachée CCI Normandie)",
    source: "https://www.rouen.cci.fr/",
    verifiedOn: "2026-05-18",
  },

  distancesGrandesMetropoles: [
    {
      metropole: "Paris",
      distanceKm: 135,
      tempsMnTgv: 75,
      tempsMnRoute: 90,
      source: "https://www.sncf-connect.com/",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Le Havre",
      distanceKm: 90,
      tempsMnRoute: 60,
      source: "https://fr.wikipedia.org/wiki/Rouen",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Caen",
      distanceKm: 125,
      tempsMnRoute: 90,
      source: "https://fr.wikipedia.org/wiki/Rouen",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Lille",
      distanceKm: 230,
      tempsMnRoute: 150,
      source: "https://fr.wikipedia.org/wiki/Rouen",
      verifiedOn: "2026-05-18",
    },
  ],

  incubateursAccelerateurs: [
    {
      nom: "Seinari (incubateur régional Normandie, antenne Rouen)",
      focus: "Deeptech / numérique / industrie / biotech",
      source: "https://www.seinari.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Normandie Web Xperts / NWX (siège Rouen)",
      focus: "Numérique / web / startups tech régionales",
      source: "https://www.nwx.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Village by CA Normandie-Seine (Rouen, accélérateur Crédit Agricole)",
      focus: "Startups / scale-up / écosystème entrepreneurial régional",
      source: "https://levillagebyca.com/villages/normandie-seine/",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Spécificités locales ───────────────────────────────────────────
  specificitesLocales: [
    {
      theme: "capitale_historique_normandie",
      description:
        "Rouen = capitale historique du duché de Normandie (Xe-XVe siècle), siège ducal et archiépiscopal, ancien Parlement de Normandie (Palais de Justice gothique flamboyant).",
      source: "https://fr.wikipedia.org/wiki/Rouen",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "ville_jeanne_d_arc",
      description:
        "Rouen = lieu du procès et du bûcher de Jeanne d'Arc (30 mai 1431, place du Vieux-Marché). Église Sainte-Jeanne-d'Arc 1979 + Historial Jeanne d'Arc inauguré 2015.",
      source: "https://www.historial-jeannedarc.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "port_fluvial_maritime_seine",
      description:
        "HAROPA Port Rouen = 1er port céréalier européen (~7 Mt/an), port fluvial-maritime axe Seine (Le Havre + Rouen + Paris fusionnés HAROPA 2021), trafic conteneurs + vrac.",
      source: "https://www.haropaport.com/fr/rouen",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "armada_de_rouen_reference_mondiale",
      description:
        "Armada de Rouen : rassemblement mondial de grands voiliers et navires de guerre sur les quais de Seine, tous les 4-6 ans, dernier 2023 (6 M+ visiteurs sur 10 jours).",
      source: "https://www.armada.org/",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "monet_cathedrales_serie",
      description:
        "Claude Monet a peint sa série emblématique des « Cathédrales de Rouen » (1892-1894, ~30 toiles) depuis la place de la Cathédrale — manifeste de l'impressionnisme tardif.",
      source: "https://mbarouen.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "catastrophe_industrielle_lubrizol_2019",
      description:
        "Incendie industriel Lubrizol/Normandie Logistique le 26 septembre 2019 (~9500 t produits chimiques brûlés) — catastrophe Seveso seuil haut majeure, classée 2e plus grave de France post-AZF.",
      source: "https://fr.wikipedia.org/wiki/Incendie_de_l%27usine_Lubrizol_de_Rouen",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Métadonnées de revue ───────────────────────────────────────────
  lastReviewedOn: "2026-05-18",
  reviewedBy: "Claude Code Opus 4.7 (sprint City Quality V3 ville #34)",
};
