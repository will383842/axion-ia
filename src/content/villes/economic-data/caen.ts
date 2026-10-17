// Caen (14118) — data économique enrichie sourcée V3 multi-taille.
//
// Sprint City Quality V3 2026-05-18, ville #36.
// Contrat zéro invention : chaque champ a un `source` vérifiable.
//
// Sources canoniques utilisées :
//   - INSEE dossier complet commune 14118 (2011101)
//   - competitivite.gouv.fr / entreprises.gouv.fr — pôles Phase V 2023-2026
//   - Sites officiels pôles (pole-hippolia.org, cosmetic-valley.com)
//   - Wikipédia articles gare/aéroport/entreprises/écoles/monuments
//   - Sites officiels écoles (unicaen.fr, em-normandie.com, ensicaen.fr)
//   - INAO (camembert, livarot, pont-l'évêque, calvados, cidre PdA,
//     andouille de Vire, neufchâtel)
//   - Sites officiels groupes (renault-trucks.com, bosch.fr, nxp.com)
//   - Mémorial de Caen (memorial-caen.fr), abbayes (caen.fr)
//
// Doctrine Caen : capitale historique du duché de Normandie (Guillaume le
// Conquérant), capitale française de la filière équine (pôle Hippolia siège
// bassin Colombelles), héritage WW2 Bataille de Normandie (Mémorial), R&D
// semi-conducteurs / cosmétique / nouvelles mobilités (Renault Trucks
// électrique Blainville-sur-Orne).
//
// Notes d'adaptation Caen :
//   - Pôle Hippolia : siège statutaire à Colombelles (8 rue Léopold Sedar
//     Senghor, 14460), commune du bassin Caen la Mer — rayonnement Caen
//     (pas siège commune Caen 14118 stricto sensu, mais rayonnement direct
//     car bassin urbain).
//   - Plusieurs grands sites industriels sont dans le bassin
//     (Mondeville/Bosch, Blainville-sur-Orne/Renault Trucks,
//     Colombelles/NXP) — typés `site_majeur` et notés en pleine honnêteté.
//   - EM Normandie : siège historique Le Havre (1871). Caen = campus,
//     pas siège — typé `ecole_commerce` localisation Caen sans titre siège.
//
// Reviewer : Claude Code Opus 4.7 (sprint City Quality V3 ville #36).

import type { VilleEconomicData } from "./types";

export const CAEN_ECONOMIC_DATA: VilleEconomicData = {
  // ─── Couche 1 — Économie INSEE ──────────────────────────────────────
  topSectorsNaf: [
    {
      naf: "GHI",
      label: "Commerce, transports, hébergement et restauration (sections G+H+I)",
      rank: 1,
      etablissementsCount: 2_649,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-14118",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "OPQ",
      label: "Administration publique, enseignement, santé, action sociale (sections O+P+Q)",
      rank: 2,
      etablissementsCount: 2_315,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-14118",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "MN",
      label:
        "Activités spécialisées, scientifiques et techniques + services administratifs (sections M+N)",
      rank: 3,
      etablissementsCount: 2_221,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-14118",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "K",
      label: "Activités financières et d'assurance",
      rank: 4,
      etablissementsCount: 749,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-14118",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "F",
      label: "Construction",
      rank: 5,
      etablissementsCount: 647,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-14118",
      verifiedOn: "2026-05-18",
    },
  ],

  polesCompetitivite: [
    {
      nom: "Hippolia",
      secteur:
        "Filière équine (santé, nutrition, équipements, services) — unique pôle dédié au cheval en France",
      // Siège statutaire à Colombelles (8 rue Léopold Sedar Senghor, 14460),
      // commune limitrophe de Caen dans la communauté urbaine Caen la Mer.
      // Labellisé Phase V 2023-2026 (annonce 27 mars 2023, DGE). Pour la
      // commune Caen 14118 stricto sensu = rayonnement direct (bassin
      // urbain commun, identité "capitale équine" portée par Caen).
      type: "rayonnement",
      source: "https://pole-hippolia.org/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Cosmetic Valley",
      secteur: "Parfumerie / cosmétique / packaging / sécurité produits",
      // Bureau régional Cosmetic Valley implanté à Caen depuis 2017,
      // animation filière Normandie (~250 entreprises, CA ~7 Md€).
      // Siège statutaire Chartres (Centre-Val de Loire).
      type: "rayonnement",
      source: "https://www.cosmetic-valley.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Nov@log",
      secteur: "Logistique / supply chain / mobilités",
      // Pôle logistique Normandie (siège Le Havre), rayonnement Caen via
      // axe portuaire Manche / corridor Atlantique.
      type: "rayonnement",
      source: "https://www.novalog.eu/",
      verifiedOn: "2026-05-18",
    },
  ],

  distances: {
    gareTgv: {
      // Gare de Caen sur l'axe Paris Saint-Lazare ↔ Cherbourg, service Intercités
      // Normandie (Paris-Caen 1h54 en direct). Pas de LGV directe.
      nom: "Gare de Caen — Intercités Normandie (Paris Saint-Lazare 1h54-2h15)",
      distanceKm: 0,
      source: "https://fr.wikipedia.org/wiki/Gare_de_Caen",
    },
    aeroportPrincipal: {
      nom: "Aéroport de Caen-Carpiquet (CFR)",
      distanceKm: 7,
      source: "https://fr.wikipedia.org/wiki/A%C3%A9roport_de_Caen-Carpiquet",
    },
    metroOuTram: {
      // Tramway de Caen, 3 lignes (T1/T2/T3) depuis juillet 2019 en
      // remplacement du tramway sur pneus historique. Réseau Twisto (Keolis).
      lignes: 3,
      source: "https://fr.wikipedia.org/wiki/Tramway_de_Caen",
    },
    verifiedOn: "2026-05-18",
  },

  statsInsee: {
    etablissementsActifs: 11_288,
    creationsEntreprises: 2_098,
    // densité calculée hors source explicite — laissée à omettre pour
    // respecter contrat zéro invention.
    anneeReference: 2023,
    source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-14118",
    verifiedOn: "2026-05-18",
  },

  // ─── Couche 2 — Matière éditoriale unique ───────────────────────────
  marquesHistoriques: [
    {
      // Tripes à la mode de Caen — recette historique caennaise emblématique
      // (boeuf braisé aux légumes et calvados), tradition gastronomique
      // documentée depuis le Moyen Âge à Caen.
      nom: "Tripes à la mode de Caen",
      secteur: "Gastronomie / agroalimentaire",
      lienVille: "heritage",
      source: "https://fr.wikipedia.org/wiki/Tripes_%C3%A0_la_mode_de_Caen",
      verifiedOn: "2026-05-18",
    },
    {
      // Pôle Hippolia : structure d'animation de la filière équine,
      // installée historiquement à la Maison du Cheval bassin caennais.
      // Marquage identitaire fort "Caen capitale du cheval".
      nom: "Hippolia (filière équine)",
      secteur: "Filière équine / R&D / innovation",
      lienVille: "heritage",
      source: "https://pole-hippolia.org/",
      verifiedOn: "2026-05-18",
    },
    {
      // Mémorial de Caen — institution culturelle majeure, marque
      // patrimoniale liée à la Bataille de Normandie 1944 et à l'histoire
      // de la paix au XXe siècle. Ouvert en 1988.
      nom: "Mémorial de Caen",
      secteur: "Culture / mémoire / tourisme",
      lienVille: "siege",
      source: "https://www.memorial-caen.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  produitsIgpAop: [
    {
      // Camembert de Normandie AOP (homologuée 1996 au niveau européen).
      // Aire géographique : Calvados, Manche, Orne, Eure, Seine-Maritime.
      nom: "Camembert de Normandie",
      categorie: "fromage",
      signe: "AOP",
      source: "https://www.inao.gouv.fr/produit/3258",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Pont-l'Évêque",
      categorie: "fromage",
      signe: "AOP",
      source: "https://www.inao.gouv.fr/produit/3262",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Livarot",
      categorie: "fromage",
      signe: "AOP",
      source: "https://www.inao.gouv.fr/produit/3260",
      verifiedOn: "2026-05-18",
    },
    {
      // Calvados AOC (eau-de-vie de cidre), aire d'appellation couvrant
      // Calvados, Orne, Manche + parties Eure/Seine-Maritime/Mayenne/Sarthe.
      nom: "Calvados",
      categorie: "spiritueux",
      signe: "AOC",
      source: "https://www.inao.gouv.fr/produit/3185",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Cidre Pays d'Auge",
      categorie: "cidre",
      signe: "AOP",
      source: "https://www.inao.gouv.fr/produit/3220",
      verifiedOn: "2026-05-18",
    },
    {
      // Andouille de Vire IGP — homologation 2014. Bassin de production
      // au sud-ouest du Calvados (Vire, à ~60 km de Caen).
      nom: "Andouille de Vire",
      categorie: "charcuterie",
      signe: "IGP",
      source: "https://www.inao.gouv.fr/produit/3155",
      verifiedOn: "2026-05-18",
    },
  ],

  salonsSectoriels: [
    {
      // Foire Internationale de Caen — événement économique multi-secteurs
      // historique, organisée chaque année au parc des expositions.
      nom: "Foire Internationale de Caen",
      secteur: "Multi-secteurs / grand public / B2B",
      localisation: "Parc des Expositions de Caen",
      lienVille: "accueille",
      source: "https://www.foiredecaen.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      // Equi'Days — événement filière équine Normandie, organisé
      // chaque année en octobre par le Conseil départemental du Calvados
      // avec rayonnement national.
      nom: "Equi'Days",
      secteur: "Filière équine / élevage / sports équestres",
      localisation: "Bassin Caen / Calvados",
      lienVille: "accueille",
      source: "https://www.calvados.fr/accueil/le-calvados-en-actions/equidays.html",
      verifiedOn: "2026-05-18",
    },
  ],

  patrimoineNotable: [
    {
      // Abbaye-aux-Hommes (Saint-Étienne) — fondée 1063-1066 par Guillaume
      // le Conquérant, classée Monuments Historiques (église 1840, bâtiments
      // conventuels 1911). Abrite l'hôtel de ville de Caen depuis 1961.
      nom: "Abbaye-aux-Hommes (Saint-Étienne) — fondée par Guillaume le Conquérant",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Abbaye_aux_Hommes_de_Caen",
      verifiedOn: "2026-05-18",
    },
    {
      // Abbaye-aux-Dames (Sainte-Trinité) — fondée vers 1062 par Mathilde
      // de Flandre, épouse de Guillaume le Conquérant. Siège actuel du
      // Conseil régional de Normandie.
      nom: "Abbaye-aux-Dames (Sainte-Trinité) — fondée par Mathilde de Flandre",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Abbaye_aux_Dames_de_Caen",
      verifiedOn: "2026-05-18",
    },
    {
      // Château de Caen — château fort construit vers 1060 par Guillaume
      // le Conquérant, l'un des plus vastes châteaux médiévaux d'Europe
      // (5,5 ha). Classé Monument Historique 1886/1997.
      nom: "Château de Caen — édifié par Guillaume le Conquérant",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Ch%C3%A2teau_de_Caen",
      verifiedOn: "2026-05-18",
    },
    {
      // Mémorial de Caen — musée d'histoire ouvert en 1988, dédié à
      // l'histoire du XXe siècle (Seconde Guerre mondiale, Bataille de
      // Normandie, Guerre froide, mémoire de la paix).
      nom: "Mémorial de Caen — musée d'histoire du XXe siècle et de la paix",
      type: "musee",
      source: "https://www.memorial-caen.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  communesBassin: [
    {
      slug: "herouville-saint-clair",
      nameFr: "Hérouville-Saint-Clair",
      distanceKm: 4,
      source: "https://fr.wikipedia.org/wiki/H%C3%A9rouville-Saint-Clair",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "mondeville",
      nameFr: "Mondeville",
      distanceKm: 4,
      source: "https://fr.wikipedia.org/wiki/Mondeville_(Calvados)",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "ifs",
      nameFr: "Ifs",
      distanceKm: 5,
      source: "https://fr.wikipedia.org/wiki/Ifs_(Calvados)",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "bretteville-sur-odon",
      nameFr: "Bretteville-sur-Odon",
      distanceKm: 4,
      source: "https://fr.wikipedia.org/wiki/Bretteville-sur-Odon",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "benouville",
      nameFr: "Bénouville",
      distanceKm: 10,
      source: "https://fr.wikipedia.org/wiki/B%C3%A9nouville_(Calvados)",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "colombelles",
      nameFr: "Colombelles",
      distanceKm: 5,
      source: "https://fr.wikipedia.org/wiki/Colombelles",
      verifiedOn: "2026-05-18",
    },
  ],

  // Caen est en zone cidricole (AOC Calvados / Cidre Pays d'Auge) mais pas
  // de vignoble AOC viticole à ≤ 50 km — la viticulture normande est très
  // marginale et hors AOC. Champ structurellement non applicable.
  vignoblesProches: [],

  // ─── Couche 3 — Multi-taille TPE/PME/ETI/GE ─────────────────────────

  // Pas de liste vérifiée individuellement d'entreprises EPV labellisées
  // à Caen (annuaire data.economie.gouv.fr non extrait par commune en V1).
  // Champ honnêtement vide pour respecter zéro invention. À compléter
  // Phase 2 sprint via extraction CSV annuaire EPV officiel.
  labelsEpvEtArtisanat: [],

  zonesActivitesParcs: [
    {
      // EffiScience (anciennement Citis) à Colombelles — technopôle
      // dédié au numérique, R&D et services tech, ~250 entreprises.
      nom: "EffiScience (technopôle Caen-Colombelles)",
      type: "technopole",
      secteurDominant: "Numérique / R&D / services tech",
      source: "https://fr.wikipedia.org/wiki/Colombelles",
      verifiedOn: "2026-05-18",
    },
    {
      // Plateau Nord de Caen — campus Côte de Nacre regroupe l'université
      // (UCN), CHU, GANIL, ENSICAEN sur ~80 ha.
      nom: "Plateau Nord de Caen (campus Côte de Nacre)",
      type: "parc_tech",
      secteurDominant: "Recherche / santé / enseignement supérieur",
      source: "https://www.unicaen.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      // ZAC Presqu'île de Caen — opération d'aménagement majeure le long
      // du canal et du port, mutation urbaine post-industrielle.
      nom: "ZAC Presqu'île de Caen",
      type: "zac",
      secteurDominant: "Tertiaire / culture / résidentiel mixte",
      source: "https://fr.wikipedia.org/wiki/Presqu%27%C3%AEle_de_Caen",
      verifiedOn: "2026-05-18",
    },
  ],

  grandesEcolesEtUniversites: [
    {
      // UCN — Université de Caen Normandie, fondée 1432 par Henri VI
      // d'Angleterre. ~31 000 étudiants, l'une des plus anciennes
      // universités françaises.
      nom: "Université de Caen Normandie (UCN) — fondée 1432",
      type: "universite",
      specialites: ["Sciences", "Lettres", "Droit", "Médecine", "Sciences humaines"],
      source: "https://www.unicaen.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      // ENSICAEN — École Nationale Supérieure d'Ingénieurs de Caen,
      // créée 1976 par fusion. EPSCP. 5 spécialités d'ingénieur.
      // ~750 étudiants. Implantée sur le plateau Nord (campus 2).
      nom: "ENSICAEN — École Nationale Supérieure d'Ingénieurs de Caen",
      type: "ecole_ingenieur",
      specialites: [
        "Électronique / systèmes embarqués",
        "Informatique",
        "Matériaux & chimie",
        "Génie industriel",
        "Mécanique & matériaux",
      ],
      source: "https://www.ensicaen.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      // EM Normandie — siège historique Le Havre (1871), Caen est un campus
      // (pas siège). Honnêteté éditoriale : on liste l'école comme campus
      // important à Caen, pas comme siège ville.
      nom: "EM Normandie (campus Caen — siège historique Le Havre, fondée 1871)",
      type: "ecole_commerce",
      specialites: ["Management", "Commerce international", "Finance", "Marketing"],
      source: "https://www.em-normandie.com/",
      verifiedOn: "2026-05-18",
    },
    {
      // Sciences Po Rennes — campus délocalisé à Caen depuis 2012,
      // formation tronc commun L1 puis cursus Rennes.
      nom: "Sciences Po Rennes — Campus Caen",
      type: "sciences_po",
      specialites: ["Sciences politiques", "Affaires publiques"],
      source: "https://www.sciencespo-rennes.fr/etudier/campus-caen",
      verifiedOn: "2026-05-18",
    },
  ],

  polesRechercheRD: [
    {
      // GANIL — Grand Accélérateur National d'Ions Lourds, GIE CEA/CNRS,
      // implanté à Caen depuis 1983, accélérateur de particules majeur
      // pour la recherche en physique nucléaire et applications médicales.
      nom: "GANIL — Grand Accélérateur National d'Ions Lourds",
      organisme: "cea",
      domaine: "Physique nucléaire / accélérateur de particules / radiothérapie",
      source: "https://www.ganil-spiral2.eu/",
      verifiedOn: "2026-05-18",
    },
    {
      // GREYC UMR 6072 — laboratoire informatique CNRS / UCN / ENSICAEN
      // (IA, cybersécurité, traitement du signal, biométrie).
      nom: "GREYC UMR 6072 (CNRS / UCN / ENSICAEN)",
      organisme: "cnrs",
      domaine: "Informatique / IA / cybersécurité / image / signal",
      source: "https://www.greyc.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      // CIMAP UMR 6252 — Centre de recherche sur les Ions, les Matériaux
      // et la Photonique (CEA/CNRS/ENSICAEN/UCN).
      nom: "CIMAP UMR 6252 (CEA / CNRS / ENSICAEN / UCN)",
      organisme: "cnrs",
      domaine: "Photonique / matériaux / interactions ions-matière",
      source: "https://cimap.ensicaen.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  grandsGroupesImplantes: [
    {
      // Renault Trucks — usine de Blainville-sur-Orne (15 km nord-est de
      // Caen, bassin Caen la Mer), ~1 690 CDI. Production cabines + camions
      // moyens-tonnage électriques (2000e e-truck janvier 2025).
      // Site dans le bassin Caen — pas commune Caen 14118 stricto sensu.
      nom: "Renault Trucks (usine Blainville-sur-Orne, ~1 690 CDI, e-trucks)",
      secteur: "Automobile / poids lourds / mobilités électriques",
      typeImplantation: "usine_principale",
      source: "https://fr.wikipedia.org/wiki/Usine_Renault_Trucks_de_Blainville",
      verifiedOn: "2026-05-18",
    },
    {
      // Robert Bosch France — site de Mondeville (commune limitrophe Caen).
      // Électronique automobile + sous-traitance électronique grand public.
      // Effectifs en repli (500→400 récents, après ~1 250 historiques).
      nom: "Robert Bosch France (site Mondeville — électronique automobile)",
      secteur: "Équipementier automobile / électronique",
      typeImplantation: "site_majeur",
      source: "https://www.bosch.fr/notre-entreprise/bosch-en-france/mondeville/",
      verifiedOn: "2026-05-18",
    },
    {
      // NXP Semiconductors France — Campus EffiScience à Colombelles,
      // centre R&D conception circuits intégrés (pas wafer manufacturing).
      // Bassin Caen la Mer.
      nom: "NXP Semiconductors France (centre R&D Colombelles — conception CI)",
      secteur: "Semi-conducteurs / R&D circuits intégrés",
      typeImplantation: "centre_rd",
      source: "https://www.nxp.com/company/about-nxp/worldwide-locations/france",
      verifiedOn: "2026-05-18",
    },
    {
      // Atos / Bull — héritage Bull historique à Caen, activité IT services.
      // Effectifs et statut variables suite restructurations Atos 2024-2025.
      nom: "Atos (héritage Bull — services IT)",
      secteur: "Services numériques / IT / HPC",
      typeImplantation: "site_majeur",
      source: "https://atos.net/fr/france",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Couche 2bis — tags KB sectorielles ─────────────────────────────
  // Volontairement vide en V1 (KB Prisma sans entries sectorielles dédiées,
  // Phase B du sprint).
  kbSectorTags: [
    "automobile-mobilite",
    "enseignement-recherche",
    "agriculture-elevage",
    "agroalimentaire-igp",
  ],

  // ─── Optionnels (hors scoring dashboard) ────────────────────────────
  capitaleFrenchTech: {
    statut: "communaute",
    nomChapitre: "Communauté French Tech Normandie",
    source: "https://lafrenchtech.com/fr/communaute-french-tech/",
    verifiedOn: "2026-05-18",
  },

  cciCompetente: {
    nom: "CCI Caen Normandie",
    source: "https://www.caen.cci.fr/",
    verifiedOn: "2026-05-18",
  },

  distancesGrandesMetropoles: [
    {
      // Paris Saint-Lazare ↔ Caen en Intercités Normandie (~1h54-2h15).
      // Autoroute A13 + A84 ~232 km.
      metropole: "Paris",
      distanceKm: 232,
      tempsMnTgv: 114,
      tempsMnRoute: 150,
      source: "https://fr.wikipedia.org/wiki/Gare_de_Caen",
      verifiedOn: "2026-05-18",
    },
    {
      // Rennes ↔ Caen par A84 (Autoroute des Estuaires) ~180 km.
      metropole: "Rennes",
      distanceKm: 180,
      tempsMnRoute: 130,
      source: "https://fr.wikipedia.org/wiki/Autoroute_A84_(France)",
      verifiedOn: "2026-05-18",
    },
  ],

  incubateursAccelerateurs: [
    {
      // Normandie Incubation — incubateur public régional, sites Caen
      // (plateau Nord) + Rouen + Le Havre. Accompagnement projets innovants
      // issus de la recherche.
      nom: "Normandie Incubation",
      focus: "Deeptech / innovation issue de la recherche",
      source: "https://www.normandie-incubation.com/",
      verifiedOn: "2026-05-18",
    },
    {
      // Le Dôme — Caen Normandie, lieu de culture scientifique +
      // accompagnement projets innovation citoyenne / numérique.
      nom: "Le Dôme — Caen Normandie",
      focus: "Culture scientifique / innovation ouverte",
      source: "https://www.ledome.info/",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Spécificités locales Caen ──────────────────────────────────────
  specificitesLocales: [
    {
      theme: "capitale_filiere_equine",
      description:
        "Caen est reconnue comme capitale française de la filière équine (pôle Hippolia, unique pôle de compétitivité dédié au cheval en France). Le bassin caennais concentre élevages, recherche vétérinaire, équipements et événements (Equi'Days).",
      source: "https://pole-hippolia.org/",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "memoire_bataille_normandie_1944",
      description:
        "Caen, ville-martyre détruite à 73 % en 1944 lors de la Bataille de Normandie, abrite le Mémorial de Caen (1988), institution mémorielle internationale de référence sur le XXe siècle et la paix.",
      source: "https://www.memorial-caen.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "heritage_guillaume_conquerant",
      description:
        "Caen est la cité de Guillaume le Conquérant (XIe siècle) : Abbaye-aux-Hommes (sa sépulture), Abbaye-aux-Dames (Mathilde de Flandre), Château de Caen (5,5 ha, l'un des plus vastes d'Europe médiévale).",
      source: "https://fr.wikipedia.org/wiki/Caen",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Adaptations Caen (zéro invention) ──────────────────────────────
  // Caen n'a pas de vignoble AOC viticole à ≤ 50 km (la viticulture
  // normande est marginale et hors AOC ; les AOC cidricoles/spiritueuses
  // sont déjà comptées en `produitsIgpAop`).
  notApplicableFields: ["vignoblesProches"],

  // ─── Métadonnées de revue ───────────────────────────────────────────
  lastReviewedOn: "2026-05-18",
  reviewedBy: "Claude Code Opus 4.7 (sprint City Quality V3 ville #36)",
};
