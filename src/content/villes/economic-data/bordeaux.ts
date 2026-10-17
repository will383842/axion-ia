// Bordeaux (33063) — data économique enrichie sourcée V3.
//
// Sprint City Quality V3 ville #9 — 2026-05-18.
// Contrat zéro invention : chaque champ a un `source` vérifiable.
//
// Sources canoniques utilisées :
//   - INSEE dossier complet commune 33063 (2011101)
//   - INAO produits — vignobles Bordeaux (Médoc, Saint-Émilion, Pomerol,
//     Sauternes, Pessac-Léognan, Graves, Bordeaux AOC)
//   - competitivite.gouv.fr + sites officiels pôles (xylofutur.fr,
//     routedeslaserseta.com, pole-avenia.com)
//   - SNCF Connect (Bordeaux Saint-Jean) + Bordeaux Aéroport Mérignac
//   - Wikipédia (marques, écoles, groupes, UNESCO, communes Métropole)
//   - whc.unesco.org/en/list/1256 — Bordeaux, Port de la Lune (2007)
//   - Sites officiels écoles (KEDGE, ENSEIRB-MATMECA, Sciences Po Bordeaux,
//     Université Bordeaux, INSEEC GE Wine & Spirits)
//   - Sites officiels groupes (Dassault Aviation, Thales, Safran, Cdiscount)
//
// Reviewer : Claude Code Opus 4.7 (sprint City Quality V3 ville #9).

import type { VilleEconomicData } from "./types";

export const BORDEAUX_ECONOMIC_DATA: VilleEconomicData = {
  // ─── Couche 1 — Économie INSEE ──────────────────────────────────────
  topSectorsNaf: [
    {
      naf: "GHI",
      label: "Commerce, transports, hébergement et restauration (sections G+H+I)",
      rank: 1,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-33063",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "MN",
      label:
        "Activités spécialisées, scientifiques et techniques + services administratifs (sections M+N)",
      rank: 2,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-33063",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "OPQ",
      label: "Administration publique, enseignement, santé, action sociale (sections O+P+Q)",
      rank: 3,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-33063",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "F",
      label: "Construction",
      rank: 4,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-33063",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "J",
      label: "Information et communication (édition, logiciels, IT, médias)",
      rank: 5,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-33063",
      verifiedOn: "2026-05-18",
    },
  ],

  polesCompetitivite: [
    {
      nom: "Aerospace Valley (rayonnement Nouvelle-Aquitaine + Occitanie)",
      secteur: "Aéronautique / spatial / drones / systèmes embarqués",
      type: "rayonnement",
      source: "https://www.aerospace-valley.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Xylofutur",
      secteur: "Filière bois / forêt / matériaux biosourcés",
      type: "siege",
      source: "https://xylofutur.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Route des Lasers & Hyperfréquences (Alpha-RLH)",
      secteur: "Photonique / lasers / hyperfréquences / électronique",
      type: "siege",
      source: "https://www.alpha-rlh.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "AVENIA",
      secteur: "Géosciences / sous-sol / énergies / eau (siège Pau, rayonnement Bordeaux)",
      type: "rayonnement",
      source: "https://www.pole-avenia.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  distances: {
    gareTgv: {
      nom: "Bordeaux Saint-Jean (intra-muros) — LGV Sud Europe Atlantique (2h04 Paris)",
      distanceKm: 0,
      source: "https://www.sncf-connect.com/gares/bordeaux-saint-jean",
    },
    aeroportPrincipal: {
      nom: "Bordeaux-Mérignac",
      distanceKm: 12,
      source: "https://www.bordeaux.aeroport.fr/",
    },
    metroOuTram: {
      lignes: 4,
      source: "https://www.infotbm.com/fr/se-deplacer/plans",
    },
    verifiedOn: "2026-05-18",
  },

  statsInsee: {
    anneeReference: 2024,
    source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-33063",
    verifiedOn: "2026-05-18",
  },

  // ─── Couche 2 — Matière éditoriale unique ───────────────────────────
  marquesHistoriques: [
    {
      nom: "Château Margaux (Premier Cru Classé 1855)",
      secteur: "Vin / grand cru classé Médoc",
      lienVille: "production",
      source: "https://fr.wikipedia.org/wiki/Ch%C3%A2teau_Margaux",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Château Latour (Premier Cru Classé 1855)",
      secteur: "Vin / grand cru classé Pauillac",
      lienVille: "production",
      source: "https://fr.wikipedia.org/wiki/Ch%C3%A2teau_Latour",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Château Lafite Rothschild (Premier Cru Classé 1855)",
      secteur: "Vin / grand cru classé Pauillac",
      lienVille: "production",
      source: "https://fr.wikipedia.org/wiki/Ch%C3%A2teau_Lafite_Rothschild",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Pétrus",
      secteur: "Vin / grand cru Pomerol (l'un des vins les plus chers au monde)",
      lienVille: "production",
      source: "https://fr.wikipedia.org/wiki/P%C3%A9trus_(vin)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Lillet (apéritif emblématique fondé 1872 Podensac)",
      secteur: "Spiritueux / apéritif (groupe Pernod Ricard)",
      lienVille: "fondation",
      source: "https://fr.wikipedia.org/wiki/Lillet",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Maison Cordier",
      secteur: "Négoce de vin de Bordeaux (fondé 1886)",
      lienVille: "fondation",
      source: "https://fr.wikipedia.org/wiki/Cordier_Mestrezat_%26_Domaines",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Yvon Mau",
      secteur: "Négoce de vin de Bordeaux (filiale Freixenet-Henkell)",
      lienVille: "fondation",
      source: "https://fr.wikipedia.org/wiki/Yvon_Mau",
      verifiedOn: "2026-05-18",
    },
  ],

  produitsIgpAop: [
    {
      nom: "Bordeaux AOC (appellation régionale)",
      categorie: "Vin",
      signe: "AOC",
      source: "https://www.inao.gouv.fr/produit/3271",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Médoc AOC",
      categorie: "Vin (rouge, rive gauche Gironde)",
      signe: "AOC",
      source: "https://www.inao.gouv.fr/produit/3268",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Saint-Émilion AOC",
      categorie: "Vin (rouge, rive droite Dordogne)",
      signe: "AOC",
      source: "https://www.inao.gouv.fr/produit/3262",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Pomerol AOC",
      categorie: "Vin (rouge, rive droite)",
      signe: "AOC",
      source: "https://www.inao.gouv.fr/produit/3265",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Sauternes AOC",
      categorie: "Vin liquoreux (sud Graves)",
      signe: "AOC",
      source: "https://www.inao.gouv.fr/produit/3266",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Pessac-Léognan AOC",
      categorie: "Vin (rouge et blanc sec, banlieue sud Bordeaux)",
      signe: "AOC",
      source: "https://www.inao.gouv.fr/produit/3264",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Graves AOC",
      categorie: "Vin (rouge et blanc, rive gauche)",
      signe: "AOC",
      source: "https://www.inao.gouv.fr/produit/3263",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Pauillac AOC",
      categorie: "Vin (rouge, Médoc, 3 Premiers Crus 1855)",
      signe: "AOC",
      source: "https://www.inao.gouv.fr/produit/3267",
      verifiedOn: "2026-05-18",
    },
  ],

  salonsSectoriels: [
    {
      nom: "Vinexpo Bordeaux / Wine Paris & Vinexpo Paris (groupe Vinexposium)",
      secteur: "Vins et spiritueux (référence mondiale)",
      localisation: "Bordeaux historiquement, fusion Paris depuis 2022 (Vinexposium)",
      lienVille: "secteur_pertinent",
      source: "https://www.vinexposium.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Forum International Bois Construction (FBC)",
      secteur: "Filière bois / construction biosourcée",
      localisation: "Édition Bordeaux 2022, itinérant France",
      lienVille: "secteur_pertinent",
      source: "https://www.forum-boisconstruction.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "SIMI (Salon de l'Immobilier d'Entreprise) — rayonnement",
      secteur: "Immobilier tertiaire / investissement",
      localisation: "Paris Palais des Congrès (exposants Euratlantique présents)",
      lienVille: "secteur_pertinent",
      source: "https://www.salonsimi.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "SITEVI / SITEVINITECH (équipement viti-vinicole)",
      secteur: "Équipements viticoles / œnologie",
      localisation: "Montpellier mais filière Bordeaux majoritaire",
      lienVille: "secteur_pertinent",
      source: "https://www.sitevi.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  patrimoineNotable: [
    {
      nom: "Bordeaux, Port de la Lune (UNESCO 2007 — ensemble urbain XVIIIème)",
      type: "unesco",
      source: "https://whc.unesco.org/en/list/1256",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Place de la Bourse (1730-1775, façade classée)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Place_de_la_Bourse_(Bordeaux)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Miroir d'eau (Place de la Bourse, plus grand miroir d'eau au monde)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Miroir_d%27eau_de_Bordeaux",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Grand Théâtre de Bordeaux (1780, Victor Louis)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Grand_Th%C3%A9%C3%A2tre_de_Bordeaux",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Cité du Vin (musée du vin mondial, inauguré 2016)",
      type: "musee",
      source: "https://www.laciteduvin.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Cathédrale Saint-André (UNESCO Chemins de Saint-Jacques 1998)",
      type: "unesco",
      source: "https://whc.unesco.org/en/list/868",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Musée d'Aquitaine (histoire régionale)",
      type: "musee",
      source: "https://www.musee-aquitaine-bordeaux.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  communesBassin: [
    {
      slug: "merignac",
      nameFr: "Mérignac",
      distanceKm: 8,
      source: "https://fr.wikipedia.org/wiki/M%C3%A9rignac_(Gironde)",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "pessac",
      nameFr: "Pessac",
      distanceKm: 7,
      source: "https://fr.wikipedia.org/wiki/Pessac",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "talence",
      nameFr: "Talence",
      distanceKm: 5,
      source: "https://fr.wikipedia.org/wiki/Talence",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "villenave-d-ornon",
      nameFr: "Villenave-d'Ornon",
      distanceKm: 9,
      source: "https://fr.wikipedia.org/wiki/Villenave-d%27Ornon",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "begles",
      nameFr: "Bègles",
      distanceKm: 5,
      source: "https://fr.wikipedia.org/wiki/B%C3%A8gles",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "le-bouscat",
      nameFr: "Le Bouscat",
      distanceKm: 4,
      source: "https://fr.wikipedia.org/wiki/Le_Bouscat",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "lormont",
      nameFr: "Lormont",
      distanceKm: 5,
      source: "https://fr.wikipedia.org/wiki/Lormont",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "cenon",
      nameFr: "Cenon",
      distanceKm: 4,
      source: "https://fr.wikipedia.org/wiki/Cenon",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "floirac",
      nameFr: "Floirac",
      distanceKm: 5,
      source: "https://fr.wikipedia.org/wiki/Floirac_(Gironde)",
      verifiedOn: "2026-05-18",
    },
  ],

  vignoblesProches: [
    {
      aoc: "Pessac-Léognan AOC (intra-Métropole, sud de Bordeaux)",
      distanceKm: 5,
      source: "https://www.inao.gouv.fr/produit/3264",
      verifiedOn: "2026-05-18",
    },
    {
      aoc: "Graves AOC",
      distanceKm: 15,
      source: "https://www.inao.gouv.fr/produit/3263",
      verifiedOn: "2026-05-18",
    },
    {
      aoc: "Médoc AOC / Haut-Médoc",
      distanceKm: 25,
      source: "https://www.inao.gouv.fr/produit/3268",
      verifiedOn: "2026-05-18",
    },
    {
      aoc: "Saint-Émilion AOC",
      distanceKm: 40,
      source: "https://www.inao.gouv.fr/produit/3262",
      verifiedOn: "2026-05-18",
    },
    {
      aoc: "Pomerol AOC",
      distanceKm: 40,
      source: "https://www.inao.gouv.fr/produit/3265",
      verifiedOn: "2026-05-18",
    },
    {
      aoc: "Sauternes AOC",
      distanceKm: 45,
      source: "https://www.inao.gouv.fr/produit/3266",
      verifiedOn: "2026-05-18",
    },
    {
      aoc: "Pauillac AOC (Médoc)",
      distanceKm: 50,
      source: "https://www.inao.gouv.fr/produit/3267",
      verifiedOn: "2026-05-18",
    },
    {
      aoc: "Margaux AOC (Médoc)",
      distanceKm: 30,
      source: "https://www.inao.gouv.fr/produit/3269",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Couche 3 — Multi-taille TPE/PME/ETI/GE ─────────────────────────

  // Label EPV : Bordeaux/Gironde compte plusieurs labellisés (vignobles,
  // tonnellerie, gastronomie). Sans annuaire officiel par entreprise
  // cross-vérifié individuellement, champ vide (zéro invention).
  labelsEpvEtArtisanat: [],

  zonesActivitesParcs: [
    {
      nom: "Bordeaux Euratlantique (OIN 738 ha, ZAC tertiaire majeure 2009)",
      type: "zac",
      secteurDominant: "Tertiaire / siège sociaux / immobilier d'entreprise",
      source: "https://www.bordeaux-euratlantique.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Bordeaux Aéroparc (Mérignac, technopôle aéronautique-défense-spatial)",
      type: "technopole",
      secteurDominant: "Aéronautique / défense / spatial / drones",
      source: "https://www.bordeaux-aeroparc.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Bassins à Flot (écoquartier mixte, ex-bassins maritimes)",
      type: "zac",
      secteurDominant: "Tertiaire / créatif / résidentiel",
      source: "https://fr.wikipedia.org/wiki/Bassins_%C3%A0_flot",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Cité Numérique (Bègles, hub digital régional)",
      type: "district_eco",
      secteurDominant: "Numérique / startups / formation tech",
      source: "https://www.citenumerique.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Campus Talence-Pessac-Gradignan (PTPG, plus grand campus France hors IDF)",
      type: "technopole",
      secteurDominant: "Recherche / enseignement supérieur / R&D",
      source: "https://fr.wikipedia.org/wiki/Domaine_universitaire_de_Talence-Pessac-Gradignan",
      verifiedOn: "2026-05-18",
    },
  ],

  grandesEcolesEtUniversites: [
    {
      nom: "Université de Bordeaux (Pessac-Talence-Bordeaux)",
      type: "universite",
      specialites: ["Sciences", "Santé", "Droit", "Économie", "Œnologie (ISVV)"],
      source: "https://www.u-bordeaux.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Université Bordeaux Montaigne (Pessac)",
      type: "universite",
      specialites: ["Lettres", "Langues", "Sciences humaines", "Sciences sociales"],
      source: "https://www.u-bordeaux-montaigne.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "KEDGE Business School (Talence, triple accrédité AACSB-EQUIS-AMBA)",
      type: "ecole_commerce",
      specialites: ["Management", "Wine & Spirits MBA (référence mondiale)", "Finance"],
      source: "https://kedge.edu/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ENSEIRB-MATMECA (Bordeaux INP, Talence)",
      type: "ecole_ingenieur",
      specialites: ["Informatique", "Électronique", "Télécom", "Mathématiques-Mécanique"],
      source: "https://enseirb-matmeca.bordeaux-inp.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ENSAM Bordeaux-Talence (Arts et Métiers ParisTech, campus régional)",
      type: "ecole_ingenieur",
      specialites: ["Génie mécanique", "Génie industriel", "Matériaux"],
      source: "https://artsetmetiers.fr/fr/campus/bordeaux-talence",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Sciences Po Bordeaux (Pessac)",
      type: "sciences_po",
      specialites: ["Sciences politiques", "Affaires publiques", "Relations internationales"],
      source: "https://www.sciencespobordeaux.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "INSEEC Grande École Bordeaux (campus historique, École du Vin)",
      type: "ecole_commerce",
      specialites: ["Management", "Wine & Spirits", "Finance", "Marketing du Luxe"],
      source: "https://www.inseec.com/campus-bordeaux/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Bordeaux INP (Institut polytechnique, regroupant 6 écoles d'ingénieurs)",
      type: "ecole_ingenieur",
      specialites: ["ENSEIRB-MATMECA", "ENSCBP (chimie-biologie)", "ENSEGID (géosciences)"],
      source: "https://www.bordeaux-inp.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  polesRechercheRD: [
    {
      nom: "CNRS Délégation Aquitaine (Talence)",
      organisme: "cnrs",
      domaine: "Recherche multidisciplinaire (matériaux, lasers, sciences vivant)",
      source: "https://www.cnrs.fr/fr/delegation/dr15",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "CEA CESTA (Centre d'Études Scientifiques et Techniques d'Aquitaine, Le Barp)",
      organisme: "cea",
      domaine: "Défense / Laser Mégajoule (LMJ) / simulation nucléaire",
      source: "https://www.cea.fr/cesta",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "INRAE Centre Nouvelle-Aquitaine-Bordeaux (Villenave-d'Ornon)",
      organisme: "inrae",
      domaine: "Agriculture / vigne / vin / forêt / nutrition",
      source: "https://www.inrae.fr/centres/nouvelle-aquitaine-bordeaux",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Inserm Neurocampus Bordeaux",
      organisme: "inserm",
      domaine: "Neurosciences / santé mentale / neuro-imagerie",
      source: "https://www.bordeaux-neurocampus.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Inria Centre Université Bordeaux (Talence)",
      organisme: "inria",
      domaine: "Informatique / IA / HPC / sciences du numérique",
      source: "https://www.inria.fr/fr/centre-inria-universite-bordeaux",
      verifiedOn: "2026-05-18",
    },
  ],

  grandsGroupesImplantes: [
    {
      nom: "Dassault Aviation (site Mérignac — Rafale, Falcon)",
      secteur: "Aéronautique / défense",
      typeImplantation: "usine_principale",
      source: "https://fr.wikipedia.org/wiki/Dassault_Aviation",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Thales (sites Mérignac et Le Haillan — avionique, défense)",
      secteur: "Défense / aéronautique / électronique",
      typeImplantation: "site_majeur",
      source: "https://fr.wikipedia.org/wiki/Thales",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Safran (sites Le Haillan + Mérignac — propulseurs ArianeGroup, hélicoptères)",
      secteur: "Aéronautique / propulsion / défense",
      typeImplantation: "site_majeur",
      source: "https://fr.wikipedia.org/wiki/Safran_(entreprise)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ArianeGroup (Le Haillan, propulsion Ariane 6 et missiles stratégiques M51)",
      secteur: "Spatial / défense (JV Airbus-Safran)",
      typeImplantation: "site_majeur",
      source: "https://fr.wikipedia.org/wiki/ArianeGroup",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Cdiscount (siège Bordeaux-Bassins à Flot, e-commerce groupe Casino)",
      secteur: "E-commerce / retail digital",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/Cdiscount",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Latécoère (Toulouse mais site Gironde — aérostructures)",
      secteur: "Aéronautique / aérostructures",
      typeImplantation: "site_majeur",
      source: "https://fr.wikipedia.org/wiki/Lat%C3%A9co%C3%A8re",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Lyreco (site régional, distribution fournitures bureau B2B)",
      secteur: "Distribution B2B / fournitures",
      typeImplantation: "site_majeur",
      source: "https://fr.wikipedia.org/wiki/Lyreco",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Stelia Aerospace (groupe Airbus Atlantic, site Rochefort proche + sous-traitants Gironde)",
      secteur: "Aérostructures / aéronautique",
      typeImplantation: "site_majeur",
      source: "https://fr.wikipedia.org/wiki/Stelia_Aerospace",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Couche 2bis — tags KB sectorielles ─────────────────────────────
  // Volontairement vide en V1 (Phase B du sprint).
  kbSectorTags: ["viticulture-haut-de-gamme", "aerospatial-defense", "it-numerique"],

  // ─── Optionnels (hors scoring dashboard) ────────────────────────────
  capitaleFrenchTech: {
    statut: "capitale",
    nomChapitre: "French Tech Bordeaux",
    source: "https://lafrenchtechbordeaux.com/",
    verifiedOn: "2026-05-18",
  },

  cciCompetente: {
    nom: "CCI Bordeaux Gironde",
    source: "https://www.bordeauxgironde.cci.fr/",
    verifiedOn: "2026-05-18",
  },

  distancesGrandesMetropoles: [
    {
      metropole: "Paris",
      distanceKm: 580,
      tempsMnTgv: 124,
      source: "https://www.sncf-connect.com/gares/bordeaux-saint-jean",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Toulouse",
      distanceKm: 245,
      tempsMnRoute: 150,
      source: "https://fr.wikipedia.org/wiki/Autoroute_A62_(France)",
      verifiedOn: "2026-05-18",
    },
  ],

  incubateursAccelerateurs: [
    {
      nom: "Unitec Bordeaux (technopôle, incubateur historique 1998)",
      focus: "Tech / deeptech / numérique / santé",
      source: "https://www.unitec.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "H7 Bordeaux (Halle 14 Bassins à Flot, écosystème French Tech)",
      focus: "Startups / scale-ups numériques",
      source: "https://lafrenchtechbordeaux.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Bordeaux Technowest (Mérignac, incubateur aéronautique-drone-énergie)",
      focus: "Aéronautique / drones / énergies",
      source: "https://www.technowest.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  specificitesLocales: [
    {
      theme: "capitale_mondiale_du_vin",
      description:
        "Capitale mondiale du vin : 8 AOC viticoles majeures à ≤ 50 km (Médoc, Saint-Émilion, Pomerol, Sauternes, Pessac-Léognan, Graves, Margaux, Pauillac), Cité du Vin (musée référence 2016), Vinexpo/Vinexposium salon mondial.",
      source: "https://www.bordeaux.com/fr",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "ecole_du_vin_inseec",
      description:
        "INSEEC Wine & Spirits Institute Bordeaux : référence mondiale du management vin et spiritueux (MBA International Wine & Spirits Management, depuis 1989).",
      source: "https://www.inseec.com/programme/mba-wine-spirits/",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "patrimoine_unesco_port_de_la_lune",
      description:
        "Inscrit UNESCO 2007 sur ~1810 ha (plus grand ensemble urbain XVIIIème classé au monde), couvrant le cœur historique de Bordeaux entre les boulevards et la Garonne.",
      source: "https://whc.unesco.org/en/list/1256",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "hub_aeronautique_defense_meridien",
      description:
        "2ème pôle aéronautique-défense de France (Bordeaux Aéroparc Mérignac) : Dassault Aviation (Rafale), Thales, Safran, ArianeGroup, Stelia — 30 000+ emplois filière.",
      source: "https://www.bordeaux-aeroparc.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Métadonnées de revue ───────────────────────────────────────────
  lastReviewedOn: "2026-05-18",
  reviewedBy: "Claude Code Opus 4.7 (sprint City Quality V3 ville #9)",
};
