// Tours (37261) — data économique enrichie sourcée V3 multi-taille.
//
// Sprint City Quality V3 2026-05-18, ville n°25.
// Contrat zéro invention : chaque champ a un `source` vérifiable.
//
// Spécificité Tours : capitale historique de la Touraine, « jardin de la
// France », au cœur du Val de Loire inscrit UNESCO 2000 (ref. 933). Pôle
// semi-conducteurs avec STMicroelectronics Tours (héritier SGS-Thomson),
// pôle pneumatique avec Michelin (proche Joué-lès-Tours) et SKF Tours
// (roulements). Bassin agroalimentaire & viticole exceptionnel : vignobles
// Vouvray (~10 km), Touraine, Bourgueil, Chinon ; AOP Sainte-Maure-de-
// Touraine (fromage de chèvre) ; IGP Volailles de Touraine ; AOC Vouvray
// (vin blanc effervescent / tranquille).
//
// Pôles compétitivité phase V : Cosmetic Valley (siège Chartres, rayonne
// sur Centre-Val de Loire dont Tours), DREAM (eau / réseaux, Orléans-Tours
// — rayonnement), S2E2 (Smart Electricity, siège Tours).
//
// Sources canoniques utilisées :
//   - INSEE dossier complet commune 37261 (2011101)
//   - competitivite.gouv.fr — pôles Phase V 2023-2026 (S2E2 siège Tours)
//   - UNESCO Centre du patrimoine mondial (whc.unesco.org/en/list/933)
//   - INAO (cahier des charges AOC/IGP, ref. produits Touraine)
//   - Sites officiels marques + écoles + groupes + Wikipédia
//   - SNCF Connect (Gare Tours / Saint-Pierre-des-Corps, LGV Atlantique)
//
// Reviewer : Claude Code Opus 4.7 (sprint City Quality V3 ville #25).

import type { VilleEconomicData } from "./types";

export const TOURS_ECONOMIC_DATA: VilleEconomicData = {
  // ─── Couche 1 — Économie INSEE ──────────────────────────────────────
  topSectorsNaf: [
    {
      naf: "GHI",
      label: "Commerce, transports, hébergement et restauration",
      rank: 1,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-37261",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "MN",
      label:
        "Activités spécialisées, scientifiques et techniques + services administratifs (sections M+N)",
      rank: 2,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-37261",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "OPQ",
      label: "Administration publique, enseignement, santé, action sociale",
      rank: 3,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-37261",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "RU",
      label: "Autres activités de services (sections R+S+T+U)",
      rank: 4,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-37261",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "F",
      label: "Construction",
      rank: 5,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-37261",
      verifiedOn: "2026-05-18",
    },
  ],

  polesCompetitivite: [
    {
      nom: "S2E2 (Sciences et Systèmes de l'Énergie Électrique)",
      secteur:
        "Smart Electricity / efficacité énergétique / réseaux intelligents / smart grids (siège Tours, labellisé pôle Phase V)",
      type: "siege",
      source: "https://www.s2e2.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Cosmetic Valley",
      secteur:
        "Cosmétique-parfumerie (siège Chartres — 1er pôle mondial de la filière, rayonnement sur Centre-Val de Loire incluant Tours)",
      type: "rayonnement",
      source: "https://www.cosmetic-valley.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "DREAM Eau & Milieux",
      secteur:
        "Gestion de l'eau / milieux aquatiques / réseaux (siège Orléans, rayonnement Centre-Val de Loire / Touraine)",
      type: "rayonnement",
      source: "https://www.poledream.org/",
      verifiedOn: "2026-05-18",
    },
  ],

  distances: {
    gareTgv: {
      nom: "Gare Tours-Saint-Pierre-des-Corps — LGV Atlantique, Paris-Montparnasse ~1h05 (~239 km), 1re gare TGV régionale Centre-Val de Loire",
      distanceKm: 3,
      source: "https://www.sncf-connect.com/gares/saint-pierre-des-corps",
    },
    aeroportPrincipal: {
      nom: "Aéroport Tours Val de Loire (TUF, Tours Métropole — vols saisonniers Marseille, Londres, Marrakech, etc.)",
      distanceKm: 6,
      source: "https://www.tours.aeroport.fr/",
    },
    metroOuTram: {
      lignes: 1,
      source: "https://www.filbleu.fr/",
    },
    verifiedOn: "2026-05-18",
  },

  statsInsee: {
    anneeReference: 2023,
    source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-37261",
    verifiedOn: "2026-05-18",
  },

  // ─── Couche 2 — Matière éditoriale unique (Touraine + Val de Loire) ─
  marquesHistoriques: [
    {
      nom: "STMicroelectronics Tours",
      secteur:
        "Semi-conducteurs / microélectronique (héritier de SGS-Thomson, site historique Tours — composants discrets, capteurs, microcontrôleurs)",
      lienVille: "production",
      source: "https://www.st.com/content/st_com/en/about/st_company_information/where-we-are.html",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "SKF Tours",
      secteur:
        "Roulements industriels (site historique SKF France — roulements à billes et à rouleaux, fabrication aéronautique/automobile)",
      lienVille: "production",
      source: "https://www.skf.com/group/our-company/contact-us/locations",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Michelin (Joué-lès-Tours)",
      secteur:
        "Pneumatique (usine historique Michelin Joué-lès-Tours, commune limitrophe sud de Tours)",
      lienVille: "production",
      source: "https://fr.wikipedia.org/wiki/Jou%C3%A9-l%C3%A8s-Tours",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Tupperware France (Joué-lès-Tours)",
      secteur:
        "Articles ménagers / plasturgie (siège France Tupperware historiquement implanté à Joué-lès-Tours)",
      lienVille: "siege",
      source: "https://fr.wikipedia.org/wiki/Tupperware",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Hutchinson",
      secteur:
        "Caoutchouc / élastomères / pièces automobile et aéronautique (groupe TotalEnergies — sites historiques Centre-Val de Loire / Touraine)",
      lienVille: "production",
      source: "https://fr.wikipedia.org/wiki/Hutchinson_(entreprise)",
      verifiedOn: "2026-05-18",
    },
  ],

  produitsIgpAop: [
    {
      nom: "Sainte-Maure-de-Touraine",
      categorie: "Fromage de chèvre à pâte molle à croûte naturelle (AOP depuis 1990)",
      signe: "AOP",
      source:
        "https://www.inao.gouv.fr/Espace-professionnel-et-outils/Rechercher-un-signe-officiel",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Touraine",
      categorie: "Vin (AOC régionale Val de Loire — blanc, rouge, rosé, effervescent)",
      signe: "AOC",
      source:
        "https://www.inao.gouv.fr/Espace-professionnel-et-outils/Rechercher-un-signe-officiel",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Vouvray",
      categorie:
        "Vin blanc (chenin — sec, demi-sec, moelleux, effervescent ; AOC depuis 1936 ; ~2 200 ha à 10 km de Tours)",
      signe: "AOC",
      source: "https://fr.wikipedia.org/wiki/Vouvray_(AOC)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Bourgueil",
      categorie: "Vin rouge (cabernet franc — AOC depuis 1937, ~1 400 ha)",
      signe: "AOC",
      source: "https://fr.wikipedia.org/wiki/Bourgueil_(AOC)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Chinon",
      categorie: "Vin rouge / rosé / blanc (cabernet franc / chenin — AOC depuis 1937)",
      signe: "AOC",
      source: "https://fr.wikipedia.org/wiki/Chinon_(AOC)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Volailles de Touraine",
      categorie: "Volailles fermières (poulets, chapons, pintades, dindes — IGP)",
      signe: "IGP",
      source:
        "https://www.inao.gouv.fr/Espace-professionnel-et-outils/Rechercher-un-signe-officiel",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Montlouis-sur-Loire",
      categorie:
        "Vin blanc (chenin — sec, demi-sec, moelleux, effervescent ; AOC depuis 1938, rive sud de la Loire face à Vouvray)",
      signe: "AOC",
      source: "https://fr.wikipedia.org/wiki/Montlouis_(AOC)",
      verifiedOn: "2026-05-18",
    },
  ],

  salonsSectoriels: [
    {
      nom: "Foire de Tours",
      secteur:
        "Habitat / artisanat / commerce / régional (foire historique Tours, parc des expositions Vinci)",
      localisation: "Parc des Expositions de Tours (Vinci)",
      lienVille: "accueille",
      source: "https://www.foiredetours.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Vitiloire",
      secteur:
        "Vins du Val de Loire / œnotourisme (rendez-vous annuel des vignerons et amateurs au cœur de Tours)",
      localisation: "Tours (centre-ville, mai)",
      lienVille: "accueille",
      source: "https://www.tours.fr/agenda/3024-vitiloire.htm",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Cosmetic Days (Cosmetic Valley)",
      secteur:
        "Cosmétique / parfumerie (rendez-vous BtoB international, organisé par Cosmetic Valley en région Centre-Val de Loire — Tours intégré au territoire d'accueil)",
      localisation: "Centre-Val de Loire (Cosmetic Valley)",
      lienVille: "secteur_pertinent",
      source: "https://www.cosmetic-valley.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  patrimoineNotable: [
    {
      nom: "Val de Loire entre Sully-sur-Loire et Chalonnes (UNESCO 2000, ref. 933) — Tours incluse dans le périmètre comme paysage culturel vivant",
      type: "unesco",
      source: "https://whc.unesco.org/en/list/933",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Cathédrale Saint-Gatien de Tours (gothique XIIIe-XVIe s. — façade flamboyante, vitraux XIIIe)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Cath%C3%A9drale_Saint-Gatien_de_Tours",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Vieux Tours / Place Plumereau (quartier historique médiéval — pans de bois, hôtels Renaissance)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Place_Plumereau",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Basilique Saint-Martin de Tours (néo-byzantine, achevée 1924, abrite le tombeau de saint Martin)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Basilique_Saint-Martin_de_Tours",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Château royal de Tours (résidence royale médiévale, bord de Loire — Tour de Guise + Logis des gouverneurs)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Ch%C3%A2teau_de_Tours",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Musée des Beaux-Arts de Tours (ancien palais archiépiscopal, collections Mantegna, Rembrandt, Boucher, Delacroix)",
      type: "musee",
      source: "https://mba.tours.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  communesBassin: [
    {
      slug: "joue-les-tours",
      nameFr: "Joué-lès-Tours",
      distanceKm: 5,
      source: "https://fr.wikipedia.org/wiki/Jou%C3%A9-l%C3%A8s-Tours",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "saint-pierre-des-corps",
      nameFr: "Saint-Pierre-des-Corps",
      distanceKm: 3,
      source: "https://fr.wikipedia.org/wiki/Saint-Pierre-des-Corps",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "saint-avertin",
      nameFr: "Saint-Avertin",
      distanceKm: 4,
      source: "https://fr.wikipedia.org/wiki/Saint-Avertin",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "chambray-les-tours",
      nameFr: "Chambray-lès-Tours",
      distanceKm: 6,
      source: "https://fr.wikipedia.org/wiki/Chambray-l%C3%A8s-Tours",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "saint-cyr-sur-loire",
      nameFr: "Saint-Cyr-sur-Loire",
      distanceKm: 4,
      source: "https://fr.wikipedia.org/wiki/Saint-Cyr-sur-Loire",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "la-riche",
      nameFr: "La Riche",
      distanceKm: 3,
      source: "https://fr.wikipedia.org/wiki/La_Riche",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "tours-nord",
      nameFr: "Tours Nord (quartier rive droite Loire)",
      distanceKm: 2,
      source: "https://fr.wikipedia.org/wiki/Tours",
      verifiedOn: "2026-05-18",
    },
  ],

  vignoblesProches: [
    {
      aoc: "Vouvray AOC (chenin blanc — sec, demi-sec, moelleux, effervescent ; ~2 200 ha)",
      distanceKm: 10,
      source: "https://fr.wikipedia.org/wiki/Vouvray_(AOC)",
      verifiedOn: "2026-05-18",
    },
    {
      aoc: "Montlouis-sur-Loire AOC (chenin blanc, rive sud face à Vouvray)",
      distanceKm: 12,
      source: "https://fr.wikipedia.org/wiki/Montlouis_(AOC)",
      verifiedOn: "2026-05-18",
    },
    {
      aoc: "Touraine AOC (appellation régionale — sauvignon, gamay, cabernet franc, chenin)",
      distanceKm: 5,
      source: "https://fr.wikipedia.org/wiki/Touraine_(AOC)",
      verifiedOn: "2026-05-18",
    },
    {
      aoc: "Bourgueil AOC (cabernet franc — ~1 400 ha, rive droite Loire)",
      distanceKm: 40,
      source: "https://fr.wikipedia.org/wiki/Bourgueil_(AOC)",
      verifiedOn: "2026-05-18",
    },
    {
      aoc: "Saint-Nicolas-de-Bourgueil AOC (cabernet franc, voisine de Bourgueil)",
      distanceKm: 45,
      source: "https://fr.wikipedia.org/wiki/Saint-Nicolas-de-Bourgueil_(AOC)",
      verifiedOn: "2026-05-18",
    },
    {
      aoc: "Chinon AOC (cabernet franc / chenin)",
      distanceKm: 50,
      source: "https://fr.wikipedia.org/wiki/Chinon_(AOC)",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Couche 3 — Multi-taille PME/ETI/GE ─────────────────────────

  // Label EPV : la Touraine compte plusieurs entreprises labellisées
  // (cuir, soie, tonnellerie, gastronomie) mais sans cross-référence
  // individuelle confirmée par dataset officiel data.economie.gouv.fr
  // au moment de la revue, champ vide pour respecter zéro invention.
  labelsEpvEtArtisanat: [],

  zonesActivitesParcs: [
    {
      nom: "Parc d'activités des Granges-Galand (Saint-Avertin / Chambray-lès-Tours — tertiaire, R&D, industries)",
      type: "parc_tech",
      secteurDominant: "Tertiaire / R&D / industries",
      source: "https://www.tours-metropole.fr/economie-emploi",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Quartier des 2 Lions (Tours sud — campus universitaire + tertiaire + startups)",
      type: "district_eco",
      secteurDominant: "Université / tertiaire / startups",
      source: "https://fr.wikipedia.org/wiki/Les_Deux_Lions",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Mame — Cité de la Création et de l'Innovation (Tours — ancien site imprimerie Mame, écosystème ICC / numérique / startups)",
      type: "district_eco",
      secteurDominant: "Industries culturelles et créatives / numérique / startups",
      source: "https://www.mame.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Parc d'activités Isoparc (Sorigny — sud Tours Métropole, industrie / logistique)",
      type: "zac",
      secteurDominant: "Industrie / logistique",
      source: "https://www.tours-metropole.fr/economie-emploi",
      verifiedOn: "2026-05-18",
    },
  ],

  grandesEcolesEtUniversites: [
    {
      nom: "Université de Tours (Université François-Rabelais, fondée 1969)",
      type: "universite",
      specialites: ["Sciences", "Droit", "Économie", "Santé", "Lettres", "Sciences humaines"],
      source: "https://www.univ-tours.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Polytech Tours (École Polytechnique Universitaire de l'Université de Tours)",
      type: "ecole_ingenieur",
      specialites: [
        "Aménagement & environnement",
        "Électronique & systèmes de l'énergie",
        "Informatique",
        "Mécanique & conception",
        "Génie civil",
      ],
      source: "https://polytech.univ-tours.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ESCEM Tours (École Supérieure de Commerce et de Management)",
      type: "ecole_commerce",
      specialites: ["Management", "Marketing", "Finance", "Entrepreneuriat"],
      source: "https://www.escem.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "INSA Centre-Val de Loire (campus Blois — antenne Tours via partenariats Polytech)",
      type: "ecole_ingenieur",
      specialites: [
        "Sécurité & technologies informatiques",
        "Énergie",
        "Maîtrise des risques industriels",
      ],
      source: "https://www.insa-centrevaldeloire.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "IUT de Tours (composante Université de Tours)",
      type: "iut",
      specialites: [
        "GEII",
        "Informatique",
        "Mesures physiques",
        "Génie biologique",
        "Tech de commercialisation",
      ],
      source: "https://iut.univ-tours.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  polesRechercheRD: [
    {
      nom: "INRAE Centre Val de Loire (Tours-Nouzilly — recherche animale, infectiologie, comportement, agroécologie)",
      organisme: "inrae",
      domaine: "Sciences animales / infectiologie / agroécologie",
      source: "https://www.inrae.fr/centres/val-de-loire",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "CNRS Délégation Centre Limousin Poitou-Charentes (sites Tours — UMRs avec université de Tours)",
      organisme: "cnrs",
      domaine: "Sciences fondamentales / sciences pour l'ingénieur / SHS",
      source: "https://www.cnrs.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "INSERM (sites Tours — unités mixtes UFR Médecine, dont neurosciences, immunologie, infectiologie)",
      organisme: "inserm",
      domaine: "Santé / sciences biomédicales / neurosciences",
      source: "https://www.inserm.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  grandsGroupesImplantes: [
    {
      nom: "STMicroelectronics Tours (héritier SGS-Thomson — site historique semi-conducteurs : composants discrets, capteurs, microcontrôleurs)",
      secteur: "Semi-conducteurs / microélectronique",
      typeImplantation: "site_majeur",
      source: "https://www.st.com/content/st_com/en/about/st_company_information/where-we-are.html",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "SKF Tours (site historique SKF France — roulements à billes et à rouleaux)",
      secteur: "Mécanique / roulements industriels",
      typeImplantation: "site_majeur",
      source: "https://www.skf.com/group/our-company/contact-us/locations",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Michelin (usine Joué-lès-Tours — commune limitrophe sud)",
      secteur: "Pneumatique / caoutchouc",
      typeImplantation: "usine_principale",
      source: "https://fr.wikipedia.org/wiki/Jou%C3%A9-l%C3%A8s-Tours",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Tupperware France (siège Joué-lès-Tours)",
      secteur: "Articles ménagers / plasturgie",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/Tupperware",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Hutchinson (groupe TotalEnergies — sites historiques Touraine / Centre-Val de Loire)",
      secteur: "Caoutchouc / élastomères / pièces auto-aéro",
      typeImplantation: "site_majeur",
      source: "https://fr.wikipedia.org/wiki/Hutchinson_(entreprise)",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Couche 2bis — tags KB sectorielles ─────────────────────────────
  // Volontairement vide en V1 : la KB Prisma ne contient pas encore
  // d'entries sectorielles dédiées (Phase B du sprint).
  kbSectorTags: [
    "industrie-manufacturiere",
    "energie-cleantech",
    "viticulture-haut-de-gamme",
    "agroalimentaire-igp",
  ],

  // ─── Optionnels (hors scoring dashboard) ────────────────────────────
  capitaleFrenchTech: {
    statut: "communaute",
    nomChapitre:
      "French Tech Loire Valley (communauté French Tech labellisée — écosystème startups Centre-Val de Loire incluant Tours, Orléans, Blois)",
    source: "https://lafrenchtech.com/fr/communaute-french-tech/",
    verifiedOn: "2026-05-18",
  },

  cciCompetente: {
    nom: "CCI Touraine (Chambre de Commerce et d'Industrie de Touraine — Indre-et-Loire)",
    source: "https://www.touraine.cci.fr/",
    verifiedOn: "2026-05-18",
  },

  distancesGrandesMetropoles: [
    {
      metropole: "Paris",
      distanceKm: 239,
      tempsMnTgv: 65,
      tempsMnRoute: 145,
      source: "https://www.sncf-connect.com/gares/saint-pierre-des-corps",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Nantes",
      distanceKm: 200,
      tempsMnTgv: 110,
      tempsMnRoute: 135,
      source: "https://www.sncf-connect.com/",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Bordeaux",
      distanceKm: 350,
      tempsMnTgv: 165,
      source: "https://www.sncf-connect.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  incubateursAccelerateurs: [
    {
      nom: "Mame — Cité de la Création et de l'Innovation (Tours — pépinière ICC + numérique + startups)",
      focus: "ICC / numérique / startups",
      source: "https://www.mame.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Village by CA Touraine - Poitou (Crédit Agricole — accélérateur startups B2B)",
      focus: "Généraliste B2B / fintech / agritech",
      source: "https://www.levillagebyca.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Spécificités locales hors grille (Touraine + Val de Loire UNESCO) ─
  specificitesLocales: [
    {
      theme: "val_de_loire_unesco",
      description:
        "Tours est au cœur du Val de Loire inscrit UNESCO 2000 (ref. 933, paysage culturel vivant Sully-sur-Loire → Chalonnes, ~280 km, 800 km² — patrimoine fluvial, châteaux Renaissance, vignobles).",
      source: "https://whc.unesco.org/en/list/933",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "capitale_touraine_jardin_de_la_france",
      description:
        "Capitale historique de la Touraine, surnommée « jardin de la France » (Rabelais) — patrimoine ducal et royal (résidences royales Val de Loire), bassin agricole et viticole exceptionnel.",
      source: "https://fr.wikipedia.org/wiki/Tours",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "vignoble_val_de_loire_historique",
      description:
        "4e vignoble français en volume : AOC Vouvray (chenin, ~2 200 ha, 10 km), Montlouis-sur-Loire, Touraine régionale, Bourgueil & Saint-Nicolas-de-Bourgueil, Chinon — cabernet franc et chenin emblématiques.",
      source: "https://fr.wikipedia.org/wiki/Vignoble_du_Val_de_Loire",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "pole_semiconducteurs_stmicro",
      description:
        "Pôle semi-conducteurs européen majeur : STMicroelectronics Tours (héritier SGS-Thomson, site historique français) — composants discrets, capteurs, microcontrôleurs ; écosystème S2E2 (Smart Electricity, siège Tours).",
      source: "https://www.st.com/content/st_com/en/about/st_company_information/where-we-are.html",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "sainte_maure_aop_volailles_touraine_igp",
      description:
        "Bassin fromager et avicole renommé : Sainte-Maure-de-Touraine AOP (fromage de chèvre cendré à paille traversante depuis 1990) + Volailles de Touraine IGP (poulets, chapons, pintades, dindes fermières).",
      source:
        "https://www.inao.gouv.fr/Espace-professionnel-et-outils/Rechercher-un-signe-officiel",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Métadonnées de revue ───────────────────────────────────────────
  lastReviewedOn: "2026-05-18",
  reviewedBy: "Claude Code Opus 4.7 (sprint City Quality V3 ville #25)",
};
