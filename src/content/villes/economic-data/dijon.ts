// Dijon (21231) — data économique enrichie sourcée V3 multi-taille.
//
// Sprint City Quality V3 2026-05-18, ville n°17.
// Contrat zéro invention : chaque champ a un `source` vérifiable.
//
// Spécificité Dijon : capitale historique de la Bourgogne, capitale de la
// moutarde (Maille, Amora — siège Dijon), Cité Internationale de la
// Gastronomie et du Vin (ouverte 6 mai 2022), centre historique inscrit
// au périmètre UNESCO 2015 des Climats du vignoble de Bourgogne (dossier
// ref. 1425). Vignobles Côte de Nuits limitrophes (Marsannay AOC démarre
// à Chenôve, banlieue sud de Dijon).
//
// Bassin agroalimentaire/luxe : Maille + Amora (Unilever, fusion McCormick
// annoncée 30 mars 2026), Mulot et Petitjean (pain d'épices, place Bossuet),
// Lanvin chocolat (héritage), SEB Cocotte-Minute (Selongey, Côte-d'Or,
// production 800 000 cocottes/an), Cassis de Dijon IGP 2013 / Cassis de
// Bourgogne IGP 2015. Pôle pharma : Laboratoires URGO siège Chenôve,
// usine Chevigny-Saint-Sauveur.
//
// Sources canoniques utilisées :
//   - INSEE dossier complet commune 21231 (2011101)
//   - competitivite.gouv.fr — pôles Phase V 2023-2026 (Vitagora siège Dijon)
//   - UNESCO Centre du patrimoine mondial (whc.unesco.org/en/list/1425)
//   - INAO (cahier des charges AOC/IGP, ref. produits Bourgogne)
//   - Sites officiels marques + écoles + groupes + Wikipédia
//   - SNCF Connect (Gare Dijon-Ville, LGV Rhin-Rhône)
//
// Reviewer : Claude Code Opus 4.7 (sprint City Quality V3 ville #17).

import type { VilleEconomicData } from "./types";

export const DIJON_ECONOMIC_DATA: VilleEconomicData = {
  // ─── Couche 1 — Économie INSEE ──────────────────────────────────────
  topSectorsNaf: [
    {
      naf: "GHI",
      label: "Commerce, transports, hébergement et restauration",
      rank: 1,
      etablissementsCount: 3_621,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-21231",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "MN",
      label:
        "Activités spécialisées, scientifiques et techniques + services administratifs (sections M+N)",
      rank: 2,
      etablissementsCount: 3_130,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-21231",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "OPQ",
      label: "Administration publique, enseignement, santé, action sociale",
      rank: 3,
      etablissementsCount: 2_761,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-21231",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "RU",
      label: "Autres activités de services (sections R+S+T+U)",
      rank: 4,
      etablissementsCount: 1_590,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-21231",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "F",
      label: "Construction",
      rank: 5,
      etablissementsCount: 1_037,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-21231",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "K",
      label: "Activités financières et d'assurance",
      rank: 6,
      etablissementsCount: 887,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-21231",
      verifiedOn: "2026-05-18",
    },
  ],

  polesCompetitivite: [
    {
      nom: "Vitagora",
      secteur:
        "Agroalimentaire / goût / nutrition / santé (siège Dijon, 16 rue de l'Hôpital — ~680 adhérents, accélérateur ToasterLab depuis 2016)",
      type: "siege",
      source: "https://www.vitagora.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  distances: {
    gareTgv: {
      nom: "Gare de Dijon-Ville — LGV Rhin-Rhône, Paris-Lyon ~1h34 (262 km, 13 trains/jour)",
      distanceKm: 0,
      source: "https://www.sncf-connect.com/gares/dijon-ville",
    },
    aeroportPrincipal: {
      nom: "Aéroport Dijon-Bourgogne (DIJ, Longvic) — petit aéroport régional ; Paris-CDG en ~2h35 à 3h51 par train via correspondances.",
      distanceKm: 6,
      source:
        "https://en.destinationdijon.com/practical-information/practical-information/how-to-get-to-dijon/",
    },
    metroOuTram: {
      lignes: 2,
      source: "https://www.divia.fr/",
    },
    verifiedOn: "2026-05-18",
  },

  statsInsee: {
    etablissementsActifs: 14_946,
    creationsEntreprises: 2_775,
    anneeReference: 2023,
    source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-21231",
    verifiedOn: "2026-05-18",
  },

  // ─── Couche 2 — Matière éditoriale unique (moutarde + Climats Bourgogne) ─
  marquesHistoriques: [
    {
      nom: "Maille",
      secteur:
        "Moutarde / condiments (fondée 1747 à Paris par Antoine-Claude Maille, fournisseur de la cour de Hongrie 1752, armes du Roi de France 1769 — production Dijon)",
      lienVille: "production",
      source: "https://fr.wikipedia.org/wiki/Maille_(marque_agroalimentaire)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Amora",
      secteur:
        "Moutarde / condiments (siège Dijon — marque déposée 1919 au tribunal de commerce de Dijon par Armand Bizouard ; rachat Unilever ; combinaison annoncée avec McCormick & Company le 30 mars 2026)",
      lienVille: "siege",
      source: "https://fr.wikipedia.org/wiki/Amora_Maille",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Mulot et Petitjean",
      secteur:
        "Pain d'épices de Dijon (boutique historique place Bossuet — savoir-faire local préservé, visites ministérielles régulières)",
      lienVille: "fondation",
      source: "https://www.mulotpetitjean.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Lanvin (chocolat)",
      secteur:
        "Chocolaterie (héritage Dijon — chocolat Lanvin distinct de la maison de couture Lanvin parisienne)",
      lienVille: "heritage",
      source: "https://fr.wikipedia.org/wiki/Lanvin_(chocolat)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "SEB (Société d'Emboutissage de Bourgogne — Cocotte-Minute)",
      secteur:
        "Petit électroménager (Selongey, Côte-d'Or — 800 000 cocottes/an, centre de compétence mondial pour les autocuiseurs SEB depuis 1953, frères Lescure)",
      lienVille: "production",
      source: "https://www.groupeseb.com/en/news/75-millionth-cocotte-minuter-produced-selongey",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Laboratoires URGO",
      secteur:
        "Santé / pansements (siège historique Chenôve — issu des Laboratoires Fournier, leader fabrication pansements ; usine Chevigny-Saint-Sauveur)",
      lienVille: "siege",
      source: "https://fr.wikipedia.org/wiki/Laboratoires_Urgo",
      verifiedOn: "2026-05-18",
    },
  ],

  produitsIgpAop: [
    {
      nom: "Crème de Cassis de Dijon",
      categorie: "Liqueur / spiritueux (cassis Côte-d'Or)",
      signe: "IGP",
      source: "https://www.inao.gouv.fr/produit/4433",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Crème de Cassis de Bourgogne",
      categorie: "Liqueur / spiritueux (zone Bourgogne élargie)",
      signe: "IGP",
      source: "https://extranet.inao.gouv.fr/fichier/PNOCDIGCremedeCassisdeBourgogne.pdf",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Bourgogne AOC (massif des appellations Bourgogne)",
      categorie: "Vin",
      signe: "AOC",
      source:
        "https://www.inao.gouv.fr/Espace-professionnel-et-outils/Rechercher-un-signe-officiel",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Marsannay",
      categorie: "Vin (Côte de Nuits, commune limitrophe sud de Dijon — AOC 1987)",
      signe: "AOC",
      source: "https://fr.wikipedia.org/wiki/Marsannay_(AOC)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Époisses",
      categorie: "Fromage à pâte molle à croûte lavée (Côte-d'Or)",
      signe: "AOP",
      source:
        "https://www.inao.gouv.fr/Espace-professionnel-et-outils/Rechercher-un-signe-officiel",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Charolais (viande)",
      categorie: "Viande bovine (Bourgogne, Côte-d'Or incluse)",
      signe: "AOP",
      source:
        "https://www.inao.gouv.fr/Espace-professionnel-et-outils/Rechercher-un-signe-officiel",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Moutarde de Bourgogne",
      categorie: "Condiment (graines et vin blanc AOC Bourgogne)",
      signe: "IGP",
      source:
        "https://www.inao.gouv.fr/Espace-professionnel-et-outils/Rechercher-un-signe-officiel",
      verifiedOn: "2026-05-18",
    },
  ],

  salonsSectoriels: [
    {
      nom: "Foire Internationale et Gastronomique de Dijon",
      secteur:
        "Gastronomie / artisanat / habitat / régional (créée 1921, ~200 000 visiteurs/an, 4e foire internationale de France)",
      localisation: "Parc des Expositions et Congrès de Dijon",
      lienVille: "accueille",
      source: "https://www.foirededijon.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "French Tech Connect Dijon",
      secteur: "Tech / innovation / startups Bourgogne-Franche-Comté",
      localisation: "Dijon",
      lienVille: "accueille",
      source:
        "https://www.macommune.info/french-tech-connect-2025-de-retour-le-3-juillet-a-dijon-le-programme/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Salons et événements de la Cité Internationale de la Gastronomie et du Vin",
      secteur:
        "Gastronomie / vin / agroalimentaire prestige (ouverte 6 mai 2022, 6,5 ha — Ferrandi Paris, École des Vins de Bourgogne, Village by CA, ToasterLab/Vitagora)",
      localisation: "Dijon (ancien site hospitalier)",
      lienVille: "accueille",
      source:
        "https://www.banquedesterritoires.fr/la-cite-internationale-de-la-gastronomie-et-du-vin-de-dijon-ouvre-le-6-mai-2022",
      verifiedOn: "2026-05-18",
    },
  ],

  patrimoineNotable: [
    {
      nom: "Climats du vignoble de Bourgogne (UNESCO 2015, ref. 1425) — centre historique de Dijon embodie la dimension politique-régulatoire qui a fait naître le système des Climats",
      type: "unesco",
      source: "https://whc.unesco.org/en/list/1425/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Palais des Ducs et des États de Bourgogne (centre historique Dijon — Place de la Libération)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Palais_des_ducs_et_des_%C3%89tats_de_Bourgogne",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Cité Internationale de la Gastronomie et du Vin (ouverture 6 mai 2022, 6,5 ha)",
      type: "cite_metier",
      source:
        "https://en.destinationdijon.com/destination/the-international-cite-of-gastronomy-and-wine/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Musée des Beaux-Arts de Dijon (Palais des Ducs — 2e musée de France par ancienneté)",
      type: "musee",
      source: "https://beaux-arts.dijon.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Cathédrale Saint-Bénigne de Dijon (gothique, rotonde romane)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Cath%C3%A9drale_Saint-B%C3%A9nigne_de_Dijon",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Chartreuse de Champmol (Puits de Moïse, Claus Sluter — vestiges nécropole ducale)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Chartreuse_de_Champmol",
      verifiedOn: "2026-05-18",
    },
  ],

  communesBassin: [
    {
      slug: "chenove",
      nameFr: "Chenôve",
      distanceKm: 4,
      source: "https://fr.wikipedia.org/wiki/Chen%C3%B4ve",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "talant",
      nameFr: "Talant",
      distanceKm: 4,
      source: "https://fr.wikipedia.org/wiki/Talant",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "quetigny",
      nameFr: "Quetigny",
      distanceKm: 5,
      source: "https://fr.wikipedia.org/wiki/Quetigny",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "longvic",
      nameFr: "Longvic",
      distanceKm: 4,
      source: "https://fr.wikipedia.org/wiki/Longvic",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "fontaine-les-dijon",
      nameFr: "Fontaine-lès-Dijon",
      distanceKm: 3,
      source: "https://fr.wikipedia.org/wiki/Fontaine-l%C3%A8s-Dijon",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "saint-apollinaire",
      nameFr: "Saint-Apollinaire",
      distanceKm: 4,
      source: "https://fr.wikipedia.org/wiki/Saint-Apollinaire_(C%C3%B4te-d%27Or)",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "marsannay-la-cote",
      nameFr: "Marsannay-la-Côte",
      distanceKm: 6,
      source: "https://fr.wikipedia.org/wiki/Marsannay-la-C%C3%B4te",
      verifiedOn: "2026-05-18",
    },
  ],

  vignoblesProches: [
    {
      aoc: "Marsannay AOC (Côte de Nuits — appellation la plus septentrionale, démarre à Chenôve banlieue sud de Dijon, 230 ha)",
      distanceKm: 6,
      source: "https://fr.wikipedia.org/wiki/Marsannay_(AOC)",
      verifiedOn: "2026-05-18",
    },
    {
      aoc: "Côte de Nuits (Gevrey-Chambertin, Vougeot, Vosne-Romanée, Nuits-Saint-Georges)",
      distanceKm: 20,
      source: "https://whc.unesco.org/en/list/1425/",
      verifiedOn: "2026-05-18",
    },
    {
      aoc: "Côte de Beaune (Aloxe-Corton, Beaune, Pommard, Volnay, Meursault)",
      distanceKm: 40,
      source: "https://whc.unesco.org/en/list/1425/",
      verifiedOn: "2026-05-18",
    },
    {
      aoc: "Côte Chalonnaise (Mercurey, Givry, Rully)",
      distanceKm: 50,
      source: "https://www.vins-bourgogne.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Couche 3 — Multi-taille TPE/PME/ETI/GE ─────────────────────────

  // Label EPV : Mulot et Petitjean (pain d'épices Dijon) figure dans
  // l'écosystème artisanal mais sans cross-référence individuelle confirmée
  // par dataset officiel data.economie.gouv.fr au moment de la revue,
  // champ vide pour respecter zéro invention. À enrichir Phase 2 sprint.
  labelsEpvEtArtisanat: [],

  zonesActivitesParcs: [
    {
      nom: "Parc Mazen-Sully / Valmy (Dijon nord — tertiaire, R&D, sièges sociaux)",
      type: "parc_tech",
      secteurDominant: "Tertiaire / R&D / agroalimentaire",
      source: "https://prodij.metropole-dijon.fr/ecosysteme-economique/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Cap Nord (Dijon Métropole — zone logistique et industrielle)",
      type: "zac",
      secteurDominant: "Logistique / industrie",
      source: "https://prodij.metropole-dijon.fr/ecosysteme-economique/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Cité Internationale de la Gastronomie et du Vin (écosystème Village by CA + ToasterLab Vitagora + Bourgogne-Franche-Comté Foodtech)",
      type: "district_eco",
      secteurDominant: "Agroalimentaire / vin / foodtech / startups",
      source:
        "https://en.destinationdijon.com/destination/the-international-cite-of-gastronomy-and-wine/",
      verifiedOn: "2026-05-18",
    },
  ],

  grandesEcolesEtUniversites: [
    {
      nom: "Burgundy School of Business (BSB, ex-ESC Dijon — fondée 1899, siège Dijon — triple accréditation AACSB+EQUIS+AMBA, top 1% mondial)",
      type: "ecole_commerce",
      specialites: ["Management", "Wine & Spirits Business", "Finance", "Marketing"],
      source: "https://bsb-education.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Institut Agro Dijon (ex-AgroSup Dijon depuis 2022)",
      type: "ecole_ingenieur",
      specialites: [
        "Sciences agronomiques",
        "Sciences alimentaires (1er en France, 24e mondial Scimago)",
        "Sciences environnementales",
      ],
      source: "https://institut-agro-dijon.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Université de Bourgogne (uB)",
      type: "universite",
      specialites: ["Sciences", "Droit", "Économie", "Santé", "Lettres", "STAPS"],
      source: "https://www.u-bourgogne.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ESIREM (École Supérieure d'Ingénieurs de Recherche en Matériaux et Infotronique, université de Bourgogne)",
      type: "ecole_ingenieur",
      specialites: ["Matériaux", "Infotronique", "Mécatronique", "Sciences pour l'ingénieur"],
      source: "https://esirem.u-bourgogne.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ESEO Dijon (École Supérieure d'Électronique de l'Ouest — campus Dijon)",
      type: "ecole_ingenieur",
      specialites: ["Électronique", "Systèmes embarqués", "IA", "Génie informatique"],
      source: "https://www.eseo.fr/campus/dijon",
      verifiedOn: "2026-05-18",
    },
  ],

  polesRechercheRD: [
    {
      nom: "INRAE Centre Bourgogne-Franche-Comté (Dijon — recherche agronomique, vigne, grandes cultures, microbiome)",
      organisme: "inrae",
      domaine: "Agronomie / vigne / sciences alimentaires / microbiologie",
      source: "https://www.inrae.fr/centres/bourgogne-franche-comte",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "CNRS Délégation Centre-Est (sites Dijon — unités mixtes uB/CNRS dont ICB, LICB, IMB)",
      organisme: "cnrs",
      domaine: "Sciences fondamentales / matériaux / chimie / mathématiques",
      source: "https://www.cnrs.fr/fr/delegation/centre-est",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "INSERM (sites Dijon — Centre des Sciences du Goût et de l'Alimentation CSGA, UMR 1324 INRAE/CNRS/uB)",
      organisme: "inserm",
      domaine: "Sciences du goût / nutrition / neurosciences sensorielles",
      source: "https://csga.inrae.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  grandsGroupesImplantes: [
    {
      nom: "Laboratoires URGO (siège Chenôve — pansements grand public + médical, leader fabrication France)",
      secteur: "Santé / pharmacie / dispositifs médicaux",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/Laboratoires_Urgo",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Amora (siège Dijon — moutarde, condiments — groupe Unilever, combinaison annoncée avec McCormick & Co le 30 mars 2026)",
      secteur: "Agroalimentaire / condiments",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/Amora_Maille",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Groupe SEB — site Selongey (Côte-d'Or, 30 km nord Dijon — centre mondial Cocotte-Minute, 800 000 unités/an + site Is-sur-Tille)",
      secteur: "Petit électroménager",
      typeImplantation: "usine_principale",
      source: "https://www.groupeseb.com/en/news/75-millionth-cocotte-minuter-produced-selongey",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Mulot et Petitjean (siège Dijon, place Bossuet — pain d'épices, savoir-faire artisanal)",
      secteur: "Agroalimentaire / confiserie",
      typeImplantation: "siege_social",
      source: "https://www.mulotpetitjean.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Lanvin (chocolat) — site Dijon (groupe Carambar & Co / Lutti)",
      secteur: "Agroalimentaire / chocolaterie",
      typeImplantation: "site_majeur",
      source: "https://fr.wikipedia.org/wiki/Lanvin_(chocolat)",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Couche 2bis — tags KB sectorielles ─────────────────────────────
  // Volontairement vide en V1 : la KB Prisma ne contient pas encore
  // d'entries sectorielles dédiées (Phase B du sprint).
  kbSectorTags: ["viticulture-haut-de-gamme", "agroalimentaire-igp", "chimie-pharma"],

  // ─── Optionnels (hors scoring dashboard) ────────────────────────────
  capitaleFrenchTech: {
    statut: "capitale",
    nomChapitre:
      "French Tech Bourgogne-Franche-Comté (labellisée Capitale French Tech 2023, ~450 organisations membres)",
    source: "https://lafrenchtech.com/fr/communaute-french-tech/",
    verifiedOn: "2026-05-18",
  },

  cciCompetente: {
    nom: "CCI Métropole de Bourgogne — site de Dijon (groupe CCI Côte-d'Or · Saône-et-Loire, ~53 000 entreprises)",
    source: "https://www.metropoledebourgogne.cci.fr/cci-dijon",
    verifiedOn: "2026-05-18",
  },

  distancesGrandesMetropoles: [
    {
      metropole: "Paris",
      distanceKm: 262,
      tempsMnTgv: 94,
      tempsMnRoute: 195,
      source: "https://www.sncf-connect.com/gares/dijon-ville",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Lyon",
      distanceKm: 195,
      tempsMnTgv: 110,
      tempsMnRoute: 120,
      source: "https://www.sncf-connect.com/",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Strasbourg",
      distanceKm: 335,
      tempsMnTgv: 120,
      source: "https://en.wikipedia.org/wiki/LGV_Rhin-Rh%C3%B4ne",
      verifiedOn: "2026-05-18",
    },
  ],

  incubateursAccelerateurs: [
    {
      nom: "ToasterLab (accélérateur Vitagora — agroalimentaire / foodtech international)",
      focus: "Foodtech / agroalimentaire / goût-nutrition-santé",
      source: "https://www.vitagora.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Village by CA Dijon (Crédit Agricole — startups B2B)",
      focus: "Généraliste B2B / foodtech / agritech",
      source: "https://www.levillagebyca.com/fr/dijon",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Premice (incubateur public Bourgogne-Franche-Comté — deeptech)",
      focus: "Deeptech / recherche / spin-off universitaires",
      source: "https://www.premice-bfc.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Spécificités locales hors grille (moutarde + gastronomie + Climats) ─
  specificitesLocales: [
    {
      theme: "capitale_moutarde",
      description:
        "Capitale historique de la moutarde de Dijon : sièges Maille (production) et Amora (siège social marque déposée Dijon 1919). Moutarde de Bourgogne IGP utilise graines + vin blanc AOC Bourgogne.",
      source: "https://fr.wikipedia.org/wiki/Amora_Maille",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "cite_gastronomie_vin",
      description:
        "Cité Internationale de la Gastronomie et du Vin ouverte 6 mai 2022 (6,5 ha, ancien hôpital) — Ferrandi Paris, École des Vins de Bourgogne, Village by CA, ToasterLab/Vitagora, 9 cinémas Pathé.",
      source:
        "https://www.banquedesterritoires.fr/la-cite-internationale-de-la-gastronomie-et-du-vin-de-dijon-ouvre-le-6-mai-2022",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "climats_unesco_centre_politique",
      description:
        "Centre historique de Dijon inscrit UNESCO 2015 comme partie intégrante des Climats du vignoble de Bourgogne (ref. 1425) — incarne la dimension politique et régulatoire qui a fait naître le système des Climats (60 km de vignobles Côte de Nuits + Côte de Beaune jusqu'à Santenay).",
      source: "https://whc.unesco.org/en/list/1425/",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "capitale_historique_bourgogne",
      description:
        "Ancienne capitale du Duché de Bourgogne (XIVe-XVe s., Ducs Valois — Philippe le Hardi, Jean sans Peur, Philippe le Bon, Charles le Téméraire). Palais des Ducs + Chartreuse de Champmol (Puits de Moïse, Claus Sluter) = patrimoine ducal européen majeur.",
      source: "https://fr.wikipedia.org/wiki/Palais_des_ducs_et_des_%C3%89tats_de_Bourgogne",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "cassis_de_dijon",
      description:
        "Crème de Cassis de Dijon (IGP 2013) + Crème de Cassis de Bourgogne (IGP 2015) — héritage liquoriste mondial (arrêt CJCE 1979 « Cassis de Dijon », fondateur de la libre circulation des marchandises en Europe).",
      source: "https://www.inao.gouv.fr/produit/4433",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Métadonnées de revue ───────────────────────────────────────────
  lastReviewedOn: "2026-05-18",
  reviewedBy: "Claude Code Opus 4.7 (sprint City Quality V3 ville #17)",
};
