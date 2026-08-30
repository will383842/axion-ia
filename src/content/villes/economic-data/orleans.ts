// Orléans (45234) — data économique enrichie sourcée V3 multi-taille.
//
// Sprint City Quality V3 2026-05-18, ville n°33.
// Contrat zéro invention : chaque champ a un `source` vérifiable.
//
// Spécificité Orléans : préfecture du Loiret et capitale historique de la
// région Centre-Val de Loire, ville de Jeanne d'Arc (libération du siège
// le 8 mai 1429 — fête johannique annuelle depuis 1430, la plus ancienne
// commémoration civique de France). Périmètre est du Val de Loire inscrit
// UNESCO 2000 (ref. 933, paysage culturel vivant Sully-sur-Loire →
// Chalonnes). Pôle cosmétique (Cosmetic Valley, siège Chartres, rayonnement
// fort sur Orléans — 1er pôle mondial de la filière). Siège John Deere
// France (ex-John Deere SA, machines agricoles, héritier Cailloux & Massey
// Ferguson historique). Pôle eau & milieux DREAM (siège Orléans). Vignoble
// Orléans AOC + Orléans-Cléry AOC intra-périphérie.
//
// Pôles compétitivité Phase V 2023-2026 : DREAM Eau & Milieux (siège
// Orléans), Cosmetic Valley (siège Chartres, rayonnement Orléans), Elastopôle
// (siège Vierzon, rayonnement Centre-Val de Loire dont Orléans — caoutchouc
// et polymères industriels).
//
// Sources canoniques utilisées :
//   - INSEE dossier complet commune 45234 (2011101)
//   - competitivite.gouv.fr — pôles Phase V 2023-2026
//   - UNESCO Centre du patrimoine mondial (whc.unesco.org/en/list/933)
//   - INAO (cahier des charges AOC/IGP, ref. produits Centre / Val de Loire)
//   - Sites officiels marques + écoles + groupes + Wikipédia
//   - SNCF Connect (Gare Orléans-Centre + Les Aubrais, axe Paris-Limoges-Toulouse)
//
// Reviewer : Claude Code Opus 4.7 (sprint City Quality V3 ville #33).

import type { VilleEconomicData } from "./types";

export const ORLEANS_ECONOMIC_DATA: VilleEconomicData = {
  // ─── Couche 1 — Économie INSEE ──────────────────────────────────────
  topSectorsNaf: [
    {
      naf: "GHI",
      label: "Commerce, transports, hébergement et restauration (sections G+H+I)",
      rank: 1,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-45234",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "MN",
      label:
        "Activités spécialisées, scientifiques et techniques + services administratifs (sections M+N)",
      rank: 2,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-45234",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "OPQ",
      label: "Administration publique, enseignement, santé, action sociale (sections O+P+Q)",
      rank: 3,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-45234",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "RU",
      label: "Autres activités de services (sections R+S+T+U)",
      rank: 4,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-45234",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "F",
      label: "Construction",
      rank: 5,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-45234",
      verifiedOn: "2026-05-18",
    },
  ],

  polesCompetitivite: [
    {
      nom: "DREAM Eau & Milieux",
      secteur:
        "Gestion durable de l'eau / milieux aquatiques / réseaux / risques (siège Orléans, pôle labellisé Phase V — rayonnement Centre-Val de Loire et Pays de la Loire)",
      type: "siege",
      source: "https://www.poledream.org/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Cosmetic Valley",
      secteur:
        "Cosmétique-parfumerie (siège Chartres — 1er pôle mondial de la filière, ~800 entreprises, rayonnement fort sur Orléans / Centre-Val de Loire)",
      type: "rayonnement",
      source: "https://www.cosmetic-valley.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Elastopôle",
      secteur:
        "Caoutchouc / élastomères / polymères industriels (siège Vierzon, rayonnement Centre-Val de Loire dont Orléans — automobile, aéronautique, BTP, santé)",
      type: "rayonnement",
      source: "https://www.elastopole.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "S2E2 (Sciences et Systèmes de l'Énergie Électrique)",
      secteur:
        "Smart Electricity / efficacité énergétique / réseaux intelligents (siège Tours, rayonnement Centre-Val de Loire incluant Orléans)",
      type: "rayonnement",
      source: "https://www.s2e2.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  distances: {
    gareTgv: {
      nom: "Gare d'Orléans-Les Aubrais (commune Fleury-les-Aubrais, axe POLT Paris-Orléans-Limoges-Toulouse + connexion TGV via correspondance Massy/Paris). Orléans-Centre dessert le centre-ville.",
      distanceKm: 4,
      source: "https://www.sncf-connect.com/gares/les-aubrais-orleans",
    },
    aeroportPrincipal: {
      nom: "Aéroport Paris-Orly (vols commerciaux internationaux — Orléans n'a pas d'aéroport commercial propre, Saint-Denis-de-l'Hôtel est aviation d'affaires)",
      distanceKm: 110,
      source: "https://www.parisaeroport.fr/orly",
    },
    metroOuTram: {
      lignes: 2,
      source: "https://www.reseau-tao.fr/",
    },
    verifiedOn: "2026-05-18",
  },

  statsInsee: {
    anneeReference: 2023,
    source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-45234",
    verifiedOn: "2026-05-18",
  },

  // ─── Couche 2 — Matière éditoriale unique (Val de Loire + Jeanne d'Arc) ─
  marquesHistoriques: [
    {
      nom: "John Deere France",
      secteur:
        "Machines agricoles / équipements agraires (siège France à Ormes-Orléans depuis 1965 — héritier Lanz/Massey Ferguson historique, principal employeur industriel agglomération)",
      lienVille: "siege",
      source: "https://fr.wikipedia.org/wiki/John_Deere",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Famar (laboratoires pharmaceutiques)",
      secteur:
        "Sous-traitance pharmaceutique (CDMO — site historique à Saint-Jean-de-Braye / Orléans Métropole, façonnage de médicaments génériques et spécialités)",
      lienVille: "production",
      source: "https://fr.wikipedia.org/wiki/Famar",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Vinaigre d'Orléans (corporation des vinaigriers)",
      secteur:
        "Vinaigrerie / fermentation acétique (héritage XIVe siècle — corporation reconnue 1394, méthode orléanaise au tonneau, dernière maison historique : Vinaigrerie Martin-Pouret fondée 1797)",
      lienVille: "heritage",
      source: "https://fr.wikipedia.org/wiki/Vinaigre_d%27Orl%C3%A9ans",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Martin-Pouret",
      secteur:
        "Vinaigrerie artisanale (fondée 1797 à Fay-aux-Loges puis Orléans — dernier représentant de la méthode orléanaise traditionnelle au tonneau, vinaigres et moutardes)",
      lienVille: "fondation",
      source: "https://www.martin-pouret.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Cotignac d'Orléans",
      secteur:
        "Confiserie historique / confitures de coings (spécialité orléanaise depuis le Moyen Âge, présentée à Jeanne d'Arc lors de son entrée 1429)",
      lienVille: "heritage",
      source: "https://fr.wikipedia.org/wiki/Cotignac_d%27Orl%C3%A9ans",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Hutchinson (groupe TotalEnergies)",
      secteur:
        "Caoutchouc / élastomères / pièces auto-aéro (sites historiques Centre-Val de Loire, dont Châlette-sur-Loing et bassin orléanais)",
      lienVille: "production",
      source: "https://fr.wikipedia.org/wiki/Hutchinson_(entreprise)",
      verifiedOn: "2026-05-18",
    },
  ],

  produitsIgpAop: [
    {
      nom: "Orléans",
      categorie:
        "Vin (AOC depuis 2006 — pinot meunier, pinot gris, chardonnay ; ~110 ha intra-couronne orléanaise)",
      signe: "AOC",
      source: "https://fr.wikipedia.org/wiki/Orl%C3%A9ans_(AOC)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Orléans-Cléry",
      categorie:
        "Vin rouge (AOC depuis 2006 — exclusivement cabernet franc, sud-ouest de l'agglomération orléanaise, ~10 ha)",
      signe: "AOC",
      source: "https://fr.wikipedia.org/wiki/Orl%C3%A9ans-Cl%C3%A9ry_(AOC)",
      verifiedOn: "2026-05-18",
    },
  ],

  salonsSectoriels: [
    {
      nom: "Fêtes de Jeanne d'Arc (Festival johannique d'Orléans)",
      secteur:
        "Patrimoine / événementiel culturel (depuis 1430 — plus ancienne commémoration civique de France, semaine autour du 8 mai, défilés, marché médiéval, cérémonies religieuses et civiles)",
      localisation: "Orléans (centre-ville historique)",
      lienVille: "accueille",
      source: "https://www.fetesdejeannedarc.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Festival International du Cirque d'Orléans",
      secteur:
        "Arts du cirque / culture (festival international annuel — compagnies internationales, parc des expositions CO'Met Orléans)",
      localisation: "Orléans CO'Met",
      lienVille: "accueille",
      source: "https://www.festivaldorleans.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Cosmetic Days (Cosmetic Valley)",
      secteur:
        "Cosmétique / parfumerie (rendez-vous BtoB international Cosmetic Valley — territoire Centre-Val de Loire incluant Orléans Métropole)",
      localisation: "Centre-Val de Loire (Cosmetic Valley)",
      lienVille: "secteur_pertinent",
      source: "https://www.cosmetic-valley.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Salon des Vins de Loire",
      secteur:
        "Vins du Val de Loire / œnotourisme (salon professionnel régional — vignerons Orléans AOC + Touraine + Anjou-Saumur)",
      localisation: "Centre-Val de Loire / Pays de la Loire",
      lienVille: "secteur_pertinent",
      source: "https://www.salondesvinsdeloire.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  patrimoineNotable: [
    {
      nom: "Val de Loire entre Sully-sur-Loire et Chalonnes (UNESCO 2000, ref. 933) — Orléans est à l'extrémité est du périmètre inscrit, paysage culturel vivant",
      type: "unesco",
      source: "https://whc.unesco.org/en/list/933",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Cathédrale Sainte-Croix d'Orléans (gothique flamboyant XIIIe-XIXe s. — l'une des plus tardives de France, ornements Jeanne d'Arc, deux tours néogothiques)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Cath%C3%A9drale_Sainte-Croix_d%27Orl%C3%A9ans",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Maison de Jeanne d'Arc (reconstitution de la maison où elle séjourna en avril-mai 1429, musée et centre d'interprétation johannique)",
      type: "musee",
      source: "https://www.jeannedarc.com.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Hôtel Groslot (Renaissance, XVIe s. — ancienne mairie d'Orléans, où mourut François II en 1560 ; jardins remarquables)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/H%C3%B4tel_Groslot",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Musée des Beaux-Arts d'Orléans (collections du XVe au XXe s., 2e collection française de pastels — Vélasquez, Le Tintoret, Watteau, Boucher, Gauguin)",
      type: "musee",
      source: "https://www.orleans-metropole.fr/culture/musees/musee-des-beaux-arts",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Musée historique et archéologique de l'Orléanais (Hôtel Cabu, Renaissance — trésor de Neuvy-en-Sullias, bronzes gallo-romains)",
      type: "musee",
      source:
        "https://www.orleans-metropole.fr/culture/musees/musee-historique-et-archeologique-de-l-orleanais",
      verifiedOn: "2026-05-18",
    },
  ],

  communesBassin: [
    {
      slug: "saint-jean-de-braye",
      nameFr: "Saint-Jean-de-Braye",
      distanceKm: 4,
      source: "https://fr.wikipedia.org/wiki/Saint-Jean-de-Braye",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "olivet",
      nameFr: "Olivet",
      distanceKm: 5,
      source: "https://fr.wikipedia.org/wiki/Olivet_(Loiret)",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "la-chapelle-saint-mesmin",
      nameFr: "La Chapelle-Saint-Mesmin",
      distanceKm: 6,
      source: "https://fr.wikipedia.org/wiki/La_Chapelle-Saint-Mesmin",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "saint-jean-de-la-ruelle",
      nameFr: "Saint-Jean-de-la-Ruelle",
      distanceKm: 3,
      source: "https://fr.wikipedia.org/wiki/Saint-Jean-de-la-Ruelle",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "fleury-les-aubrais",
      nameFr: "Fleury-les-Aubrais",
      distanceKm: 4,
      source: "https://fr.wikipedia.org/wiki/Fleury-les-Aubrais",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "saran",
      nameFr: "Saran",
      distanceKm: 7,
      source: "https://fr.wikipedia.org/wiki/Saran_(Loiret)",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "ormes",
      nameFr: "Ormes",
      distanceKm: 9,
      source: "https://fr.wikipedia.org/wiki/Ormes_(Loiret)",
      verifiedOn: "2026-05-18",
    },
  ],

  vignoblesProches: [
    {
      aoc: "Orléans AOC (pinot meunier, pinot gris, chardonnay — ~110 ha intra-couronne, AOC depuis 2006)",
      distanceKm: 5,
      source: "https://fr.wikipedia.org/wiki/Orl%C3%A9ans_(AOC)",
      verifiedOn: "2026-05-18",
    },
    {
      aoc: "Orléans-Cléry AOC (cabernet franc rouge uniquement, ~10 ha, AOC depuis 2006)",
      distanceKm: 10,
      source: "https://fr.wikipedia.org/wiki/Orl%C3%A9ans-Cl%C3%A9ry_(AOC)",
      verifiedOn: "2026-05-18",
    },
    {
      aoc: "Coteaux du Giennois AOC (sauvignon, pinot noir, gamay — confluence Loire/Giennois, est du Loiret)",
      distanceKm: 50,
      source: "https://fr.wikipedia.org/wiki/Coteaux_du_Giennois_(AOC)",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Couche 3 — Multi-taille PME/ETI/GE ─────────────────────────

  // Label EPV : le Loiret compte plusieurs entreprises labellisées (vinaigrerie
  // Martin-Pouret, artisans du Val de Loire, etc.) mais sans cross-référence
  // individuelle confirmée par dataset officiel data.economie.gouv.fr/explore
  // /dataset/entreprises-du-patrimoine-vivant-epv au moment de la revue,
  // champ vide pour respecter zéro invention.
  labelsEpvEtArtisanat: [],

  zonesActivitesParcs: [
    {
      nom: "Parc Technologique Orléans Charbonnière (sud-est Orléans Métropole — siège John Deere France à Ormes / Saran historiquement, technopôle agglo)",
      type: "technopole",
      secteurDominant: "Industrie / R&D / agro-machinisme / tertiaire",
      source: "https://www.orleans-metropole.fr/economie",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Pôle 45 (Ormes / Saran — plus grand parc d'activités du Loiret, 800+ entreprises, logistique nationale)",
      type: "zac",
      secteurDominant: "Logistique / commerce / industrie",
      source: "https://fr.wikipedia.org/wiki/P%C3%B4le_45",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Cosmetopée / Cosmetic Valley sites Orléans Métropole (sites cosmétiques et parfumerie rayonnement Cosmetic Valley)",
      type: "district_eco",
      secteurDominant: "Cosmétique / parfumerie / pharmacie",
      source: "https://www.cosmetic-valley.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "CO'Met Orléans (parc des expositions, congrès et arena multifonction — ouvert 2022, ~10 000 places)",
      type: "district_eco",
      secteurDominant: "Événementiel / congrès / salons / culture",
      source: "https://www.cometorleans.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  grandesEcolesEtUniversites: [
    {
      nom: "Université d'Orléans (fondée 1306, refondée 1962 — l'une des plus anciennes universités de France)",
      type: "universite",
      specialites: [
        "Sciences",
        "Droit",
        "Économie",
        "Gestion",
        "Lettres",
        "Sciences humaines",
        "STAPS",
      ],
      source: "https://www.univ-orleans.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Polytech Orléans (École Polytechnique Universitaire de l'Université d'Orléans — école d'ingénieurs)",
      type: "ecole_ingenieur",
      specialites: [
        "Génie civil & géo-environnement",
        "Génie électrique",
        "Génie physique & systèmes embarqués",
        "Mécanique & énergétique",
        "Production industrielle",
        "Technologies pour la santé",
      ],
      source: "https://www.univ-orleans.fr/fr/polytech",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "INSA Centre-Val de Loire (campus Bourges + Blois — antenne Orléans via partenariats Polytech, école d'ingénieurs publique)",
      type: "ecole_ingenieur",
      specialites: [
        "Sécurité & technologies informatiques",
        "Énergie & risques industriels",
        "Génie des systèmes industriels",
      ],
      source: "https://www.insa-centrevaldeloire.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ESAD Orléans (École Supérieure d'Art et de Design d'Orléans — école publique d'art et de design, diplôme DNA + DNSEP)",
      type: "autre",
      specialites: ["Design d'objet", "Design graphique", "Design d'espace", "Art contemporain"],
      source: "https://www.esad-orleans.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "IUT d'Orléans (composante Université d'Orléans — Bourges-Châteauroux-Orléans-Issoudun)",
      type: "iut",
      specialites: [
        "GEII",
        "Informatique",
        "Mesures physiques",
        "GMP",
        "Tech de commercialisation",
      ],
      source: "https://www.univ-orleans.fr/fr/iut-orleans",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ESCEM Orléans (École Supérieure de Commerce et de Management — antenne Tours-Orléans, management & business)",
      type: "ecole_commerce",
      specialites: ["Management", "Marketing", "Finance", "Entrepreneuriat"],
      source: "https://www.escem.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  polesRechercheRD: [
    {
      nom: "CNRS Centre Orléans (Délégation Centre Limousin Poitou-Charentes — sites Orléans : CBM, ICMN, ISTO, CEMHTI, LPC2E, biophysique moléculaire)",
      organisme: "cnrs",
      domaine:
        "Sciences de la Terre / biophysique moléculaire / matériaux / sciences pour l'ingénieur",
      source: "https://www.cnrs.fr/fr/dr8",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "BRGM (Bureau de Recherches Géologiques et Minières — siège national à Orléans-La Source, principal site français)",
      organisme: "autre",
      domaine: "Géosciences / sous-sol / risques naturels / eau / mines / stockage CO₂",
      source: "https://www.brgm.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "INRAE Centre Val de Loire (sites Orléans-Ardon — agroécologie, foresterie, sols, biologie environnementale)",
      organisme: "inrae",
      domaine: "Agroécologie / foresterie / sols / biodiversité",
      source: "https://www.inrae.fr/centres/val-de-loire",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "INSERM (sites Orléans — unités mixtes Université d'Orléans, biophysique moléculaire / pharmacologie)",
      organisme: "inserm",
      domaine: "Santé / sciences biomédicales / biophysique",
      source: "https://www.inserm.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  grandsGroupesImplantes: [
    {
      nom: "John Deere France (siège France à Ormes-Orléans — machines agricoles, principal employeur industriel agglo)",
      secteur: "Machines agricoles / agro-équipements",
      typeImplantation: "siege_social",
      source: "https://fr.wikipedia.org/wiki/John_Deere",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Famar (CDMO pharmaceutique — site historique Saint-Jean-de-Braye, façonnage médicaments)",
      secteur: "Pharmaceutique / sous-traitance CDMO",
      typeImplantation: "site_majeur",
      source: "https://fr.wikipedia.org/wiki/Famar",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "BRGM (Bureau de Recherches Géologiques et Minières — siège national Orléans-La Source, EPIC français de référence)",
      secteur: "Géosciences / sous-sol / R&D publique",
      typeImplantation: "siege_social",
      source: "https://www.brgm.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Hutchinson (groupe TotalEnergies — sites Châlette-sur-Loing / bassin Loiret, caoutchouc-élastomères)",
      secteur: "Caoutchouc / élastomères / pièces auto-aéro",
      typeImplantation: "site_majeur",
      source: "https://fr.wikipedia.org/wiki/Hutchinson_(entreprise)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Servier (laboratoires pharmaceutiques — sites industriels Loiret incluant Gidy à 15 km nord-ouest Orléans)",
      secteur: "Pharmaceutique",
      typeImplantation: "site_majeur",
      source: "https://fr.wikipedia.org/wiki/Servier",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Shiseido Europe (centre de recherche cosmétique à Ormes — Cosmetic Valley, R&D parfumerie/cosmétique)",
      secteur: "Cosmétique / parfumerie / R&D",
      typeImplantation: "centre_rd",
      source: "https://fr.wikipedia.org/wiki/Shiseido",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Couche 2bis — tags KB sectorielles ─────────────────────────────
  // Volontairement vide en V1 : la KB Prisma ne contient pas encore
  // d'entries sectorielles dédiées (Phase B du sprint).
  kbSectorTags: [
    "chimie-pharma",
    "agriculture-elevage",
    "enseignement-recherche",
    "agroalimentaire-igp",
  ],

  // ─── Optionnels (hors scoring dashboard) ────────────────────────────
  capitaleFrenchTech: {
    statut: "communaute",
    nomChapitre:
      "French Tech Loire Valley (communauté French Tech labellisée — écosystème startups Centre-Val de Loire incluant Orléans, Tours, Blois)",
    source: "https://lafrenchtech.com/fr/communaute-french-tech/",
    verifiedOn: "2026-05-18",
  },

  cciCompetente: {
    nom: "CCI Loiret (Chambre de Commerce et d'Industrie du Loiret)",
    source: "https://www.loiret.cci.fr/",
    verifiedOn: "2026-05-18",
  },

  distancesGrandesMetropoles: [
    {
      metropole: "Paris",
      distanceKm: 132,
      tempsMnTgv: 60,
      tempsMnRoute: 90,
      source: "https://www.sncf-connect.com/gares/les-aubrais-orleans",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Tours",
      distanceKm: 115,
      tempsMnRoute: 75,
      source: "https://www.sncf-connect.com/",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Lyon",
      distanceKm: 450,
      tempsMnRoute: 280,
      source: "https://www.sncf-connect.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  incubateursAccelerateurs: [
    {
      nom: "Le LAB'O (Orléans Métropole — incubateur et pépinière numérique, 14 000 m², 130+ entreprises hébergées, startups tech/IA/cyber)",
      focus: "Numérique / startups / IA / cybersécurité",
      source: "https://www.lab-o.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Village by CA Centre-Loire (Crédit Agricole — accélérateur startups B2B Loiret/Centre)",
      focus: "Généraliste B2B / fintech / agritech / cosmétique",
      source: "https://www.levillagebyca.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Cosmetic Valley — Bio'rizon / accélérateurs cosmétique (rayonnement Orléans Métropole)",
      focus: "Cosmétique / parfumerie / biotech",
      source: "https://www.cosmetic-valley.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Spécificités locales hors grille (Jeanne d'Arc + Val de Loire UNESCO) ─
  specificitesLocales: [
    {
      theme: "val_de_loire_unesco",
      description:
        "Orléans est à l'extrémité est du Val de Loire inscrit UNESCO 2000 (ref. 933, paysage culturel vivant Sully-sur-Loire → Chalonnes, ~280 km, 800 km² — patrimoine fluvial, châteaux Renaissance, vignobles).",
      source: "https://whc.unesco.org/en/list/933",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "jeanne_darc_fetes_johanniques",
      description:
        "Ville de Jeanne d'Arc : libération du siège anglais le 8 mai 1429 — Fêtes de Jeanne d'Arc commémorées sans interruption depuis 1430 (la plus ancienne commémoration civique de France, semaine autour du 8 mai chaque année).",
      source: "https://www.fetesdejeannedarc.com/",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "siege_john_deere_france",
      description:
        "Siège France de John Deere à Ormes-Orléans depuis 1965 (machines agricoles, héritier Lanz / Massey Ferguson) — principal employeur industriel de l'agglomération, ~2 000 collaborateurs.",
      source: "https://fr.wikipedia.org/wiki/John_Deere",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "cosmetic_valley_rayonnement",
      description:
        "Rayonnement fort de Cosmetic Valley (siège Chartres, 1er pôle mondial cosmétique-parfumerie, ~800 entreprises, ~70 000 emplois) sur Orléans Métropole — Shiseido R&D Ormes, Caudalie, LVMH Recherche à proximité.",
      source: "https://www.cosmetic-valley.com/",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "brgm_siege_national_geosciences",
      description:
        "Siège national du BRGM (Bureau de Recherches Géologiques et Minières) à Orléans-La Source — principal EPIC français de géosciences (sous-sol, eau, risques naturels, stockage CO₂), ~1 100 collaborateurs.",
      source: "https://www.brgm.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "vinaigre_orleans_methode_tonneau",
      description:
        "Patrimoine vinaigrier : corporation reconnue en 1394 — méthode orléanaise au tonneau (fermentation acétique lente, sans copeaux), perpétuée par Vinaigrerie Martin-Pouret fondée 1797, seule maison historique survivante.",
      source: "https://fr.wikipedia.org/wiki/Vinaigre_d%27Orl%C3%A9ans",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "andouille_jargeau_demarche_igp",
      description:
        "L'Andouille de Jargeau (commune du bassin orléanais à ~25 km est) est une spécialité charcutière fumée artisanale historique. Une démarche d'obtention de l'IGP est en cours auprès de l'INAO, mais le signe officiel n'a pas encore été accordé à ce jour.",
      source: "https://fr.wikipedia.org/wiki/Andouille_de_Jargeau",
      verifiedOn: "2026-05-20",
    },
    {
      theme: "vinaigre_orleans_patrimoine",
      description:
        "Le Vinaigre d'Orléans (méthode orléanaise au tonneau, corporation reconnue 1394) est un produit patrimonial local mais ne bénéficie d'aucun signe officiel INAO (ni AOP, ni IGP, ni Label Rouge). Sa notoriété repose sur la tradition artisanale perpétuée par la Vinaigrerie Martin-Pouret (fondée 1797).",
      source: "https://fr.wikipedia.org/wiki/Vinaigre_d%27Orl%C3%A9ans",
      verifiedOn: "2026-05-20",
    },
    {
      theme: "vignoble_orleans_aoc_intra_couronne",
      description:
        "Vignoble Orléans AOC + Orléans-Cléry AOC intra-couronne orléanaise (depuis 2006) — pinot meunier, pinot gris, chardonnay et cabernet franc, ~120 ha au cœur même de l'agglomération.",
      source: "https://fr.wikipedia.org/wiki/Orl%C3%A9ans_(AOC)",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Métadonnées de revue ───────────────────────────────────────────
  lastReviewedOn: "2026-05-18",
  reviewedBy: "Claude Code Opus 4.7 (sprint City Quality V3 ville #33)",
};
