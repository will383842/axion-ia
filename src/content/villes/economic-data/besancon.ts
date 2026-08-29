// Besançon (25056) — data économique enrichie sourcée V3 multi-taille.
//
// Sprint City Quality V3 2026-05-18, ville n°32.
// Contrat zéro invention : chaque champ a un `source` vérifiable.
//
// Singularité Besançon : capitale française de l'horlogerie et des
// microtechniques de précision (XVIIIe-XXIe s. — héritage Lip, Yema,
// Pequignet, Maty), siège du Pôle des Microtechniques (PMT, labellisé
// Phase V 2023-2026), ville d'accueil de Micronora (salon international
// référence mondiale des microtechniques, biennal, 800 exposants /
// 41 pays). Citadelle de Vauban inscrite UNESCO 2008 (Fortifications
// de Vauban, ref. 1283, 12 sites du Réseau Vauban). Ville natale de
// Victor Hugo (1802) et des Frères Lumière (1862/1864).
//
// Bassin économique : grands groupes joaillerie/horlogerie (Maty siège
// Besançon depuis 1951, Smoby Toys à proximité), héritage industriel
// Lip (horlogerie historique, faillite 1973), reprise Yema (horlogerie
// française), Pequignet (manufacture haut-de-gamme Morteau, Doubs).
// Sochaux/Peugeot à 80 km (bassin automobile Doubs-Belfort).
//
// Sources canoniques utilisées :
//   - INSEE dossier complet commune 25056 (2011101)
//   - competitivite.gouv.fr — Pôle PMT Phase V 2023-2026 (siège Besançon)
//   - UNESCO Centre du patrimoine mondial (whc.unesco.org/en/list/1283)
//   - Réseau des sites majeurs de Vauban (sites-vauban.org)
//   - INAO (Comté AOP, Morbier AOP, Mont d'Or AOP)
//   - Sites officiels marques + écoles + groupes + Wikipédia
//   - SNCF Connect (Gare Besançon Franche-Comté TGV LGV Rhin-Rhône)
//
// Reviewer : Claude Code Opus 4.7 (sprint City Quality V3 ville #32).

import type { VilleEconomicData } from "./types";

export const BESANCON_ECONOMIC_DATA: VilleEconomicData = {
  // ─── Couche 1 — Économie INSEE ──────────────────────────────────────
  topSectorsNaf: [
    {
      naf: "GHI",
      label: "Commerce, transports, hébergement et restauration (sections G+H+I)",
      rank: 1,
      etablissementsCount: 2_316,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-25056",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "OPQ",
      label: "Administration publique, enseignement, santé, action sociale (sections O+P+Q)",
      rank: 2,
      etablissementsCount: 2_247,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-25056",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "MN",
      label:
        "Activités spécialisées, scientifiques et techniques + services administratifs (sections M+N)",
      rank: 3,
      etablissementsCount: 1_793,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-25056",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "RU",
      label: "Autres activités de services (sections R+S+T+U)",
      rank: 4,
      etablissementsCount: 1_088,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-25056",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "L",
      label: "Activités immobilières (section L)",
      rank: 5,
      etablissementsCount: 582,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-25056",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "K",
      label: "Activités financières et d'assurance (section K)",
      rank: 6,
      etablissementsCount: 521,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-25056",
      verifiedOn: "2026-05-18",
    },
  ],

  polesCompetitivite: [
    {
      nom: "Pôle des Microtechniques (PMT)",
      secteur:
        "Microtechniques de précision / horlogerie / micro-nanotechnologies / santé connectée / aéronautique — siège TEMIS Innovation, 18 rue Alain-Savary, Besançon. Plus de 270 adhérents, labellisé depuis 2005, Phase V 2023-2026 confirmée par l'État le 27 mars 2023.",
      type: "siege",
      source:
        "https://www.entreprises.gouv.fr/fr/innovation/poles-de-competitivite/pmt-pole-des-microtechniques",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Vitagora",
      secteur:
        "Agroalimentaire / goût / nutrition / santé (rayonnement Bourgogne-Franche-Comté — siège Dijon)",
      type: "rayonnement",
      source: "https://www.vitagora.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  distances: {
    gareTgv: {
      nom: "Gare Besançon Franche-Comté TGV (Auxon-Dessus, 10 km nord-ouest) — LGV Rhin-Rhône, Paris-Lyon ~2h05, complétée par la Gare de Besançon-Viotte (centre-ville, TER + TGV directs Paris)",
      distanceKm: 10,
      source: "https://www.sncf-connect.com/gares/besancon-franche-comte-tgv",
    },
    aeroportPrincipal: {
      nom: "Aéroport Bâle-Mulhouse-Fribourg EuroAirport (BSL/MLH/EAP) — ~140 km via A36 ; aéroport régional Dole-Tavaux à 45 km",
      distanceKm: 140,
      source: "https://www.euroairport.com/",
    },
    metroOuTram: {
      lignes: 2,
      source: "https://www.ginko.voyage/",
    },
    verifiedOn: "2026-05-18",
  },

  statsInsee: {
    etablissementsActifs: 9_952,
    creationsEntreprises: 1_824,
    anneeReference: 2023,
    source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-25056",
    verifiedOn: "2026-05-18",
  },

  // ─── Couche 2 — Matière éditoriale unique (horlogerie + Vauban) ─────
  marquesHistoriques: [
    {
      nom: "Maty",
      secteur:
        "Joaillerie / horlogerie / vente par correspondance (fondée 1951 à Besançon par Gérard Mantion, 24 ans — siège historique boulevard John F. Kennedy ; pionnier du catalogue VPC bijouterie en France)",
      lienVille: "fondation",
      source: "https://fr.wikipedia.org/wiki/Maty_(entreprise)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Lip",
      secteur:
        "Horlogerie historique (fondée 1867 à Besançon par Emmanuel Lipmann — emblématique de l'horlogerie française XXe s., conflit social Lip 1973-1976 mondialement connu, marque relancée plusieurs fois depuis)",
      lienVille: "heritage",
      source: "https://fr.wikipedia.org/wiki/Lip_(entreprise)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Yema",
      secteur:
        "Horlogerie française (fondée 1948 à Besançon par Henry Louis Belmont — montres aviateur et plongée, rachat 2009, production assemblée à Morteau, Doubs ; renaissance horlogère Besançon)",
      lienVille: "fondation",
      source: "https://fr.wikipedia.org/wiki/Yema",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Pequignet",
      secteur:
        "Horlogerie haut-de-gamme (manufacture indépendante française fondée 1973 à Morteau, Doubs, 60 km Besançon — calibre maison Royal 2011, bassin horloger franc-comtois)",
      lienVille: "heritage",
      source: "https://fr.wikipedia.org/wiki/Pequignet",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Smoby Toys",
      secteur:
        "Jouets / puériculture (fondé 1924, siège à Lavans-lès-Saint-Claude, Jura — bassin économique Franche-Comté, leader européen jouet en bois et plastique)",
      lienVille: "heritage",
      source: "https://fr.wikipedia.org/wiki/Smoby",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Société Bisontine d'Horlogerie / Observatoire de Besançon (Poinçon de la vipère)",
      secteur:
        "Horlogerie / chronométrie (l'Observatoire de Besançon délivre depuis 1897 le célèbre poinçon « Vipère » garantissant la précision chronométrique d'une montre — unique en Europe avec Genève)",
      lienVille: "production",
      source: "https://fr.wikipedia.org/wiki/Observatoire_de_Besan%C3%A7on",
      verifiedOn: "2026-05-18",
    },
  ],

  produitsIgpAop: [
    {
      nom: "Comté",
      categorie:
        "Fromage à pâte pressée cuite (massif jurassien — Doubs/Jura/Ain, plus grosse production AOP française en volume)",
      signe: "AOP",
      source:
        "https://www.inao.gouv.fr/Espace-professionnel-et-outils/Rechercher-un-signe-officiel",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Morbier",
      categorie: "Fromage à pâte pressée non cuite (Franche-Comté, raie cendrée centrale)",
      signe: "AOP",
      source:
        "https://www.inao.gouv.fr/Espace-professionnel-et-outils/Rechercher-un-signe-officiel",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Mont d'Or (Vacherin du Haut-Doubs)",
      categorie: "Fromage à pâte molle saisonnier (Haut-Doubs, ceinture d'épicéa)",
      signe: "AOP",
      source:
        "https://www.inao.gouv.fr/Espace-professionnel-et-outils/Rechercher-un-signe-officiel",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Saucisse de Morteau",
      categorie: "Charcuterie fumée (Haut-Doubs, fumée bois résineux)",
      signe: "IGP",
      source:
        "https://www.inao.gouv.fr/Espace-professionnel-et-outils/Rechercher-un-signe-officiel",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Saucisse de Montbéliard",
      categorie: "Charcuterie fumée au cumin (Doubs/Territoire de Belfort)",
      signe: "IGP",
      source:
        "https://www.inao.gouv.fr/Espace-professionnel-et-outils/Rechercher-un-signe-officiel",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Bleu de Gex Haut-Jura (Bleu de Septmoncel)",
      categorie: "Fromage à pâte persillée (massif jurassien)",
      signe: "AOP",
      source:
        "https://www.inao.gouv.fr/Espace-professionnel-et-outils/Rechercher-un-signe-officiel",
      verifiedOn: "2026-05-18",
    },
  ],

  salonsSectoriels: [
    {
      nom: "Micronora",
      secteur:
        "Salon international des microtechniques, de la précision et des nanotechnologies (référence mondiale, biennal — édition 2024 : 800 exposants, 41 pays, 25 000 m² ; prochaine édition 29 septembre - 2 octobre 2026)",
      localisation: "Parc des Expositions Micropolis, Besançon",
      lienVille: "accueille",
      source: "https://micronora.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Salon des Vins de Besançon",
      secteur: "Œnologie / vins de France (annuel, Micropolis)",
      localisation: "Micropolis Besançon",
      lienVille: "accueille",
      source: "https://www.micropolis.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Foire Comtoise de Besançon",
      secteur:
        "Foire généraliste / habitat / artisanat / gastronomie régionale (annuelle, ~9 jours)",
      localisation: "Micropolis Besançon",
      lienVille: "accueille",
      source: "https://www.foirecomtoise.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  patrimoineNotable: [
    {
      nom: "Citadelle de Besançon (Fortifications de Vauban, UNESCO 2008, ref. 1283) — pièce maîtresse du Réseau des 12 sites majeurs de Vauban inscrits le 7 juillet 2008 à Québec",
      type: "unesco",
      source: "https://whc.unesco.org/en/list/1283/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Front Royal et Fort Griffon (Besançon, ensemble Vauban — éléments inscrits avec la Citadelle)",
      type: "monument",
      source: "https://sites-vauban.org/en/major-sites/besancon",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Horloge astronomique de la Cathédrale Saint-Jean (Auguste-Lucien Vérité, 1860 — 30 000 pièces, 70 cadrans, 122 indications)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Horloge_astronomique_de_Besan%C3%A7on",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Maison natale de Victor Hugo (140 Grande Rue — Hugo né à Besançon le 26 février 1802, musée municipal)",
      type: "musee",
      source: "https://www.besancon.fr/maison-victor-hugo/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Musée du Temps (Palais Granvelle — collections horlogerie/chronométrie, héritage capitale française de l'horlogerie)",
      type: "musee",
      source: "https://www.mdt.besancon.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Musée des Beaux-Arts et d'Archéologie de Besançon (le plus ancien musée public de France, ouvert en 1694, avant le Louvre)",
      type: "musee",
      source: "https://www.mbaa.besancon.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Observatoire de Besançon (Société Bisontine d'Horlogerie — délivre depuis 1897 le poinçon « Vipère » de précision chronométrique)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Observatoire_de_Besan%C3%A7on",
      verifiedOn: "2026-05-18",
    },
  ],

  communesBassin: [
    {
      slug: "saint-vit",
      nameFr: "Saint-Vit",
      distanceKm: 18,
      source: "https://fr.wikipedia.org/wiki/Saint-Vit",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "pirey",
      nameFr: "Pirey",
      distanceKm: 7,
      source: "https://fr.wikipedia.org/wiki/Pirey",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "chatillon-le-duc",
      nameFr: "Châtillon-le-Duc",
      distanceKm: 7,
      source: "https://fr.wikipedia.org/wiki/Ch%C3%A2tillon-le-Duc",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "ecole-valentin",
      nameFr: "École-Valentin",
      distanceKm: 5,
      source: "https://fr.wikipedia.org/wiki/%C3%89cole-Valentin",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "devecey",
      nameFr: "Devecey",
      distanceKm: 10,
      source: "https://fr.wikipedia.org/wiki/Devecey",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "chalezeule",
      nameFr: "Chalezeule",
      distanceKm: 4,
      source: "https://fr.wikipedia.org/wiki/Chalezeule",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "saone",
      nameFr: "Saône",
      distanceKm: 8,
      source: "https://fr.wikipedia.org/wiki/Sa%C3%B4ne_(Doubs)",
      verifiedOn: "2026-05-18",
    },
  ],

  // Vignobles AOC du Jura (Arbois, Château-Chalon, L'Étoile, Côtes du Jura)
  // sont les plus proches mais à 60-90 km de Besançon (Arbois ~60 km par
  // l'A36). Au-delà du seuil ≤ 50 km recommandé du type. Le champ est donc
  // structurellement non applicable — exempté du scoring via notApplicableFields.
  // Mention factuelle dans specificitesLocales pour contexte éditorial.

  // ─── Couche 3 — Multi-taille PME/ETI/GE ─────────────────────────

  // Label EPV : Besançon héberge l'écosystème horloger franc-comtois
  // (Yema, Pequignet, Lip via reprises) mais les labels EPV individuels
  // ne sont pas cross-référencés au moment de la revue. Annuaire officiel
  // à interroger Phase 2 : data.economie.gouv.fr/explore/dataset/entreprises-du-patrimoine-vivant-epv
  // Pour respecter zéro invention, champ vide en V1.
  labelsEpvEtArtisanat: [],

  zonesActivitesParcs: [
    {
      nom: "TEMIS Innovation Microtechnique (Besançon — technopôle dédié microtechniques, siège PMT, 18 rue Alain-Savary)",
      type: "technopole",
      secteurDominant: "Microtechniques / horlogerie / nanotechnologies / R&D",
      source: "https://www.temis.org/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "TEMIS Santé (Besançon — pôle dédié santé/dispositifs médicaux/biomédical)",
      type: "parc_tech",
      secteurDominant: "Santé / dispositifs médicaux / biotech",
      source: "https://www.temis.org/temis-sante/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Parc d'activités de Châteaufarine (Besançon ouest — commercial + PME tertiaire)",
      type: "zac",
      secteurDominant: "Commerce / tertiaire / PME",
      source: "https://www.grandbesancon.fr/economie/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Zone industrielle de Trépillot (Besançon — industrie + logistique)",
      type: "district_eco",
      secteurDominant: "Industrie / logistique",
      source: "https://www.grandbesancon.fr/economie/",
      verifiedOn: "2026-05-18",
    },
  ],

  grandesEcolesEtUniversites: [
    {
      nom: "Université de Franche-Comté (UFC, fondée 1423 — l'une des plus anciennes universités de France, ~26 000 étudiants)",
      type: "universite",
      specialites: ["Sciences", "Lettres", "Droit", "Économie", "Médecine", "STAPS", "STGI"],
      source: "https://www.univ-fcomte.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ENSMM (École Nationale Supérieure de Mécanique et des Microtechniques) — siège Besançon, école d'ingénieurs sous tutelle MESRI, formation phare mécanique + microtechniques",
      type: "ecole_ingenieur",
      specialites: [
        "Mécanique de précision",
        "Microtechniques",
        "Mécatronique",
        "Robotique",
        "Sciences pour l'ingénieur",
      ],
      source: "https://www.ens2m.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ESTA Belfort-Besançon (École Supérieure des Technologies et des Affaires — école de commerce/ingénieurs business)",
      type: "ecole_commerce",
      specialites: ["Ingénieur d'affaires", "Business engineering", "Commerce technologique B2B"],
      source: "https://www.esta-groupe.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "IUT de Besançon-Vesoul (Université de Franche-Comté)",
      type: "iut",
      specialites: ["Génie mécanique", "Génie civil", "Informatique", "Réseaux et télécoms", "MMI"],
      source: "https://iut-bv.univ-fcomte.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ISIFC (Institut Supérieur d'Ingénieurs de Franche-Comté — école d'ingénieurs biomédicaux, université de Franche-Comté)",
      type: "ecole_ingenieur",
      specialites: ["Génie biomédical", "Dispositifs médicaux", "Microtechniques santé"],
      source: "https://isifc.univ-fcomte.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  polesRechercheRD: [
    {
      nom: "Institut FEMTO-ST (Franche-Comté Électronique Mécanique Thermique Optique — Sciences et Technologies, UMR CNRS 6174 — l'un des plus grands laboratoires français en sciences pour l'ingénieur, ~750 personnes)",
      organisme: "cnrs",
      domaine:
        "Microtechniques / mécanique / optique / thermique / temps-fréquence / micro-nano-systèmes",
      source: "https://www.femto-st.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "INRAE Centre Bourgogne-Franche-Comté (sites Besançon — agro-écologie, alimentation, environnement)",
      organisme: "inrae",
      domaine: "Agronomie / agroécologie / forêt / environnement",
      source: "https://www.inrae.fr/centres/bourgogne-franche-comte",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "CNRS Délégation Centre-Est (sites Besançon — UMR FEMTO-ST, Chrono-Environnement, LMB, ThéMA, etc.)",
      organisme: "cnrs",
      domaine: "Sciences pour l'ingénieur / environnement / mathématiques / sciences humaines",
      source: "https://www.cnrs.fr/fr/delegation/centre-est",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "INSERM (sites Besançon — UMR EFS Bourgogne-Franche-Comté, recherche biomédicale CHRU Besançon)",
      organisme: "inserm",
      domaine: "Sciences biomédicales / immunologie / cancérologie",
      source: "https://www.inserm.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  grandsGroupesImplantes: [
    {
      nom: "Maty (siège social Besançon — boulevard John F. Kennedy, joaillerie/horlogerie/VPC, fondé 1951 par Gérard Mantion)",
      secteur: "Joaillerie / horlogerie / e-commerce",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/Maty_(entreprise)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Yema (siège commercial Besançon, production Morteau Doubs — marque horlogère française relancée 2009)",
      secteur: "Horlogerie",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/Yema",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Stellantis Sochaux (~80 km nord-est de Besançon — historique Peugeot, plus grand site automobile de France, ~10 000 salariés, production 3008/5008)",
      secteur: "Automobile",
      typeImplantation: "site_majeur",
      source: "https://fr.wikipedia.org/wiki/Usine_PSA_Peugeot_Citro%C3%ABn_de_Sochaux",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Schrader Pacific (site Pontarlier ~60 km Besançon — capteurs de pression pneumatiques TPMS, leader mondial)",
      secteur: "Équipementier automobile",
      typeImplantation: "site_majeur",
      source: "https://fr.wikipedia.org/wiki/Schrader_International",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Alstom Belfort (~90 km — site historique TGV/locomotives, ~700 salariés)",
      secteur: "Ferroviaire / transport",
      typeImplantation: "site_majeur",
      source: "https://fr.wikipedia.org/wiki/Alstom",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Smoby Toys (Lavans-lès-Saint-Claude, Jura — siège leader européen jouet en plastique, bassin Franche-Comté)",
      secteur: "Jouet / puériculture",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/Smoby",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Couche 2bis — tags KB sectorielles ─────────────────────────────
  // Volontairement vide en V1 : la KB Prisma ne contient pas encore
  // d'entries sectorielles dédiées (Phase B du sprint).
  kbSectorTags: [
    "mecanique-precision",
    "dispositifs-medicaux",
    "enseignement-recherche",
    "agroalimentaire-igp",
  ],

  // ─── Optionnels (hors scoring dashboard) ────────────────────────────
  capitaleFrenchTech: {
    statut: "communaute",
    nomChapitre:
      "French Tech Bourgogne-Franche-Comté (Capitale French Tech 2023, écosystème ~450 organisations — chapitre Besançon couvert)",
    source: "https://lafrenchtech.com/fr/communaute-french-tech/",
    verifiedOn: "2026-05-18",
  },

  cciCompetente: {
    nom: "CCI du Doubs (siège Besançon — ~21 000 entreprises ressortissantes, regroupée au sein de CCI Bourgogne-Franche-Comté)",
    source: "https://www.doubs.cci.fr/",
    verifiedOn: "2026-05-18",
  },

  distancesGrandesMetropoles: [
    {
      metropole: "Paris",
      distanceKm: 410,
      tempsMnTgv: 125,
      tempsMnRoute: 300,
      source: "https://www.sncf-connect.com/gares/besancon-franche-comte-tgv",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Lyon",
      distanceKm: 230,
      tempsMnTgv: 120,
      tempsMnRoute: 165,
      source: "https://www.sncf-connect.com/",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Strasbourg",
      distanceKm: 240,
      tempsMnTgv: 145,
      tempsMnRoute: 165,
      source: "https://en.wikipedia.org/wiki/LGV_Rhin-Rh%C3%B4ne",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Dijon",
      distanceKm: 95,
      tempsMnTgv: 30,
      tempsMnRoute: 70,
      source: "https://www.sncf-connect.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  incubateursAccelerateurs: [
    {
      nom: "Incubateur Premice (incubateur public Bourgogne-Franche-Comté — deeptech, spin-off universitaires UFC/uB, antenne Besançon)",
      focus: "Deeptech / recherche / spin-off universitaires",
      source: "https://www.premice-bfc.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "TEMIS Innovation — incubation Microtechniques (technopôle Besançon, accompagnement startups microtechs et santé)",
      focus: "Microtechniques / santé / horlogerie / R&D appliquée",
      source: "https://www.temis.org/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Village by CA Franche-Comté (Crédit Agricole — site Besançon)",
      focus: "Généraliste B2B / industrie / tech",
      source: "https://www.levillagebyca.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Adaptations Besançon (zéro invention) ──────────────────────────
  // Vignobles AOC du Jura (Arbois, Château-Chalon, L'Étoile, Côtes du Jura)
  // les plus proches sont situés à 60-90 km de Besançon (Arbois ~60 km),
  // au-delà du seuil ≤ 50 km recommandé. Le champ vignoblesProches est
  // donc structurellement non applicable — exempté du scoring pour ne
  // pas pénaliser injustement la ville. Mention factuelle dans
  // specificitesLocales pour contexte éditorial.
  notApplicableFields: ["vignoblesProches"],

  // ─── Spécificités locales hors grille (capitale horlogerie + Vauban) ─
  specificitesLocales: [
    {
      theme: "capitale_horlogerie_microtechniques",
      description:
        "Capitale française historique de l'horlogerie et des microtechniques de précision (XVIIIe-XXIe s.) : siège PMT, ENSMM, Institut FEMTO-ST, Observatoire de Besançon (poinçon Vipère depuis 1897), bassin horloger franc-comtois Morteau-Maîche-Besançon. Micronora salon mondial biennal référence.",
      source:
        "https://www.entreprises.gouv.fr/fr/innovation/poles-de-competitivite/pmt-pole-des-microtechniques",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "citadelle_vauban_unesco",
      description:
        "Citadelle de Besançon inscrite UNESCO 2008 dans le cadre des « Fortifications de Vauban » (ref. 1283) — réseau de 12 sites majeurs Vauban inscrits le 7 juillet 2008 à Québec. Pièce maîtresse de l'architecture militaire bastionnée du XVIIe s. ; ensemble Citadelle + Front Royal + Fort Griffon.",
      source: "https://whc.unesco.org/en/list/1283/",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "ville_natale_victor_hugo_lumiere",
      description:
        "Ville natale de Victor Hugo (26 février 1802, 140 Grande Rue — maison-musée municipale) et berceau familial des Frères Lumière (Auguste 1862, Louis 1864 — leur père Antoine était originaire de Besançon, déménagement à Lyon en 1870). Patrimoine littéraire et scientifique mondial.",
      source: "https://www.besancon.fr/maison-victor-hugo/",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "vignobles_jura_au_dela_50km",
      description:
        "Vignobles AOC Arbois (60 km), Château-Chalon, L'Étoile, Côtes du Jura accessibles via A36 — bassin œnologique Jura emblématique (vin jaune, vin de paille, savagnin) ; au-delà du seuil ≤ 50 km mais pertinent pour audits IA domaines viticoles franc-comtois.",
      source: "https://www.jura-vins.com/",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "fromages_aop_jurassiens",
      description:
        "Bassin AOP fromager le plus dense de France (Comté 1ère AOP française en volume, Morbier, Mont d'Or, Bleu de Gex) + IGP charcuteries (Saucisse de Morteau, Saucisse de Montbéliard). Filière agroalimentaire Doubs/Jura cible audit IA traçabilité origine.",
      source: "https://www.inao.gouv.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "poincon_vipere_observatoire",
      description:
        "L'Observatoire de Besançon délivre depuis 1897 le célèbre poinçon « Tête de Vipère » garantissant la précision chronométrique d'une montre selon le standard ISO 3159 — unique en Europe avec le Poinçon de Genève, héritage de la capitale française de l'horlogerie.",
      source: "https://fr.wikipedia.org/wiki/Observatoire_de_Besan%C3%A7on",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Métadonnées de revue ───────────────────────────────────────────
  lastReviewedOn: "2026-05-18",
  reviewedBy: "Claude Code Opus 4.7 (sprint City Quality V3 ville #32)",
};
