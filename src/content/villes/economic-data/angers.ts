// Angers (49007) — data économique enrichie sourcée V3 multi-taille.
//
// Sprint City Quality V3 2026-05-18, ville n°18.
// Contrat zéro invention : chaque champ a un `source` vérifiable.
//
// Sources canoniques utilisées :
//   - INSEE dossier complet commune 49007 (2011101)
//   - competitivite.gouv.fr + site officiel Vegepolys Valley (Phase V 2023-2026)
//   - Wikipédia articles gare/écoles/entreprises/monuments
//   - whc.unesco.org/en/list/933 (Val de Loire Sully-sur-Loire → Chalonnes)
//   - SNCF Connect (gare Angers Saint-Laud) + angers.aeroport.fr
//   - INAO (appellations Anjou / Coteaux-du-Layon / Saumur)
//   - Sites officiels (sival-angers.com, chateau-angers.fr, cointreau.com, etc.)
//   - ALDEV (Angers développement) + ANGERS LOIRE MÉTROPOLE
//
// Doctrine Angers : capitale française du végétal (Vegepolys Valley siège
// mondial), héritage Cointreau (1849) + Bull/Atos (depuis 1960) + Scania
// (depuis 1992, ~1500 emplois), pôle viticole Anjou-Saumur (Coteaux-du-Layon
// AOP à 30 km, Anjou AOC sur la commune), Val de Loire UNESCO 2000 (limite
// ouest périmètre à Chalonnes-sur-Loire). Capitale historique du Maine-et-Loire.
//
// Reviewer : Claude Code Opus 4.7 (sprint City Quality V3 ville #18).

import type { VilleEconomicData } from "./types";

export const ANGERS_ECONOMIC_DATA: VilleEconomicData = {
  // ─── Couche 1 — Économie INSEE ──────────────────────────────────────
  topSectorsNaf: [
    {
      naf: "GHI",
      label: "Commerce, transports, hébergement et restauration (sections G+H+I)",
      rank: 1,
      etablissementsCount: 2_622,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-49007",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "OPQ",
      label: "Administration publique, enseignement, santé, action sociale (sections O+P+Q)",
      rank: 2,
      etablissementsCount: 2_593,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-49007",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "MN",
      label:
        "Activités spécialisées, scientifiques et techniques + services administratifs (sections M+N)",
      rank: 3,
      etablissementsCount: 2_449,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-49007",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "RU",
      label: "Autres activités de services (sections R+S+T+U)",
      rank: 4,
      etablissementsCount: 1_315,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-49007",
      verifiedOn: "2026-05-18",
    },
    {
      naf: "L",
      label: "Activités immobilières",
      rank: 5,
      etablissementsCount: 777,
      source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-49007",
      verifiedOn: "2026-05-18",
    },
  ],

  polesCompetitivite: [
    {
      nom: "Vegepolys Valley",
      secteur: "Filière végétale — semences / horticulture / arboriculture / viticulture / agro",
      type: "siege",
      source: "https://www.vegepolysvalley.eu/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Atlanpole Biotherapies",
      secteur: "Biothérapies / santé / médicaments innovants (rayonnement Nantes-Angers-Tours)",
      type: "rayonnement",
      source: "https://www.atlanpolebiotherapies.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  distances: {
    gareTgv: {
      nom: "Gare d'Angers Saint-Laud (TGV Paris-Montparnasse 1h21, 13 AR/jour)",
      distanceKm: 0,
      source: "https://www.sncf-connect.com/en-en/train/timetables/angers/paris",
    },
    aeroportPrincipal: {
      nom: "Aéroport Angers-Loire (Marcé) — vols loisirs saisonniers ; CDG accessible TGV direct 2h21",
      distanceKm: 23,
      source: "https://angers.aeroport.fr/",
    },
    metroOuTram: {
      lignes: 2,
      source: "https://www.irigo.fr/fr/reseau/plans/tramway",
    },
    verifiedOn: "2026-05-18",
  },

  statsInsee: {
    etablissementsActifs: 12_222,
    creationsEntreprises: 2_901,
    anneeReference: 2023,
    source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-49007",
    verifiedOn: "2026-05-18",
  },

  // ─── Couche 2 — Matière éditoriale unique ───────────────────────────
  marquesHistoriques: [
    {
      nom: "Cointreau",
      secteur:
        "Spiritueux / liqueur triple-sec (fondé Angers 1849, site Saint-Barthélemy-d'Anjou 1972)",
      lienVille: "fondation",
      source: "https://fr.wikipedia.org/wiki/Cointreau",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Bull (Groupe Atos / Eviden)",
      secteur:
        "Informatique / supercalculateurs / cybersécurité (site historique Angers depuis 1960)",
      lienVille: "production",
      source: "https://www.wiki-anjou.fr/index.php/Bull_Angers",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Giffard",
      secteur: "Spiritueux / sirops / liqueurs (fondé Angers 1885)",
      lienVille: "fondation",
      source: "https://fr.wikipedia.org/wiki/Giffard_(entreprise)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Bouvet-Ladubay",
      secteur: "Vins effervescents Saumur (bassin Anjou, fondé 1851 Saint-Hilaire-Saint-Florent)",
      lienVille: "heritage",
      source: "https://fr.wikipedia.org/wiki/Bouvet-Ladubay",
      verifiedOn: "2026-05-18",
    },
  ],

  produitsIgpAop: [
    {
      nom: "Anjou (AOC vins rouges, blancs, rosés effervescents)",
      categorie: "vin",
      signe: "AOC",
      source: "https://fr.wikipedia.org/wiki/Anjou_(AOC)",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Coteaux-du-Layon (AOP vin blanc liquoreux, ~1400 ha sud-ouest Angers)",
      categorie: "vin",
      signe: "AOP",
      source: "https://www.inao.gouv.fr/produit/8931",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Saumur (AOC vins, bassin Anjou-Saumur)",
      categorie: "vin",
      signe: "AOC",
      source:
        "https://www.vinsvignesvignerons.com/Les-regions-viticoles-de-France/Region-viticole-Loire/ANJOU-SAUMUR",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Crémant de Loire (AOC vins effervescents)",
      categorie: "vin",
      signe: "AOC",
      source: "https://fr.wikipedia.org/wiki/Cr%C3%A9mant_de_Loire",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Maine-Anjou (AOP viande bovine race rouge des prés)",
      categorie: "viande",
      signe: "AOP",
      source: "https://fr.wikipedia.org/wiki/Maine-Anjou_(AOP)",
      verifiedOn: "2026-05-18",
    },
  ],

  salonsSectoriels: [
    {
      nom: "SIVAL — Salon International des Techniques de Productions Végétales",
      secteur:
        "Filière végétale spécialisée (viticulture, horticulture, arboriculture, maraîchage, semences)",
      localisation: "Parc des expositions d'Angers",
      lienVille: "accueille",
      source: "https://www.sival-angers.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Salon Made in Angers",
      secteur: "Découverte entreprises locales / industrie / artisanat",
      localisation: "Angers Loire Métropole",
      lienVille: "accueille",
      source: "https://www.madeinangers.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  patrimoineNotable: [
    {
      nom: "Val de Loire (UNESCO 2000, périmètre Sully-sur-Loire → Chalonnes-sur-Loire à ~25 km ouest Angers)",
      type: "unesco",
      source: "https://whc.unesco.org/en/list/933/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Château d'Angers (CMN) — Tenture de l'Apocalypse (1373-1382, 103 m, UNESCO Mémoire du monde)",
      type: "monument",
      source: "https://www.chateau-angers.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Cathédrale Saint-Maurice d'Angers (gothique angevin XIIe-XIIIe)",
      type: "monument",
      source: "https://fr.wikipedia.org/wiki/Cath%C3%A9drale_Saint-Maurice_d%27Angers",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Musée des Beaux-Arts d'Angers (Logis Barrault, XVe)",
      type: "musee",
      source: "https://musees.angers.fr/lieux/musee-des-beaux-arts/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Terra Botanica (parc thématique végétal européen)",
      type: "parc",
      source: "https://www.terrabotanica.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  communesBassin: [
    {
      slug: "avrille",
      nameFr: "Avrillé",
      distanceKm: 5,
      source: "https://fr.wikipedia.org/wiki/Avrill%C3%A9_(Maine-et-Loire)",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "trelaze",
      nameFr: "Trélazé",
      distanceKm: 6,
      source: "https://fr.wikipedia.org/wiki/Tr%C3%A9laz%C3%A9",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "saint-barthelemy-d-anjou",
      nameFr: "Saint-Barthélemy-d'Anjou",
      distanceKm: 5,
      source: "https://fr.wikipedia.org/wiki/Saint-Barth%C3%A9lemy-d%27Anjou",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "beaucouze",
      nameFr: "Beaucouzé",
      distanceKm: 6,
      source: "https://fr.wikipedia.org/wiki/Beaucouz%C3%A9",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "bouchemaine",
      nameFr: "Bouchemaine",
      distanceKm: 8,
      source: "https://fr.wikipedia.org/wiki/Bouchemaine",
      verifiedOn: "2026-05-18",
    },
    {
      slug: "les-ponts-de-ce",
      nameFr: "Les Ponts-de-Cé",
      distanceKm: 6,
      source: "https://fr.wikipedia.org/wiki/Les_Ponts-de-C%C3%A9",
      verifiedOn: "2026-05-18",
    },
  ],

  vignoblesProches: [
    {
      aoc: "Anjou (AOC sur la commune d'Angers — produit dans le département Maine-et-Loire)",
      distanceKm: 0,
      source: "https://fr.wikipedia.org/wiki/Anjou_(AOC)",
      verifiedOn: "2026-05-18",
    },
    {
      aoc: "Coteaux-du-Layon (AOP ~1400 ha sud-ouest Angers)",
      distanceKm: 30,
      source: "https://www.inao.gouv.fr/produit/8931",
      verifiedOn: "2026-05-18",
    },
    {
      aoc: "Saumur (AOC bassin Anjou-Saumur)",
      distanceKm: 40,
      source: "https://fr.wikipedia.org/wiki/Saumur_(AOC)",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Couche 3 — Multi-taille PME/ETI/GE ─────────────────────────

  // Annuaire EPV : entreprises labellisées dans Maine-et-Loire (ex Bohin,
  // Cointreau Distillerie). Sans extraction CSV vérifiée par entreprise,
  // champ vide pour respecter zéro invention.
  labelsEpvEtArtisanat: [],

  zonesActivitesParcs: [
    {
      nom: "Technopole Angers — site Belle-Beille",
      type: "technopole",
      secteurDominant: "Tech / numérique / objets connectés / végétal",
      source: "https://angerstechnopole.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Campus du Végétal (Vegepolys Valley)",
      type: "parc_tech",
      secteurDominant: "Recherche & formation filière végétale",
      source: "https://www.vegepolysvalley.eu/le-campus-du-vegetal/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Zone industrielle d'Écouflant / Monplaisir (site Scania)",
      type: "zac",
      secteurDominant: "Industrie automobile / poids lourds",
      source: "https://fr.wikipedia.org/wiki/Usine_Scania_d%27Angers",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Parc d'activités Angers-Beaucouzé",
      type: "zac",
      secteurDominant: "Tertiaire / industrie / logistique",
      source: "https://www.angersloiremetropole.fr/",
      verifiedOn: "2026-05-18",
    },
  ],

  grandesEcolesEtUniversites: [
    {
      nom: "Université d'Angers (UA)",
      type: "universite",
      specialites: ["Sciences", "Droit", "Médecine", "Tourisme", "Lettres"],
      source: "https://www.univ-angers.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ESEO — École Supérieure d'Électronique de l'Ouest",
      type: "ecole_ingenieur",
      specialites: ["Électronique", "Informatique", "Systèmes embarqués", "IA"],
      source: "https://www.eseo.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ESSCA — École Supérieure des Sciences Commerciales d'Angers",
      type: "ecole_commerce",
      specialites: ["Management", "Finance", "Marketing", "International business"],
      source: "https://www.essca.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ESA — École Supérieure des Agricultures (Angers, fondée 1898, EESPIG/CTI)",
      type: "ecole_ingenieur",
      specialites: ["Agronomie", "Agroalimentaire", "Environnement", "Viticulture"],
      source: "https://www.groupe-esa.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Université Catholique de l'Ouest (UCO)",
      type: "universite",
      specialites: ["Lettres", "Sciences humaines", "Théologie", "Sciences"],
      source: "https://www.uco.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "ESAIP — École d'Ingénieurs (numérique & environnement, campus Saint-Barthélemy-d'Anjou)",
      type: "ecole_ingenieur",
      specialites: ["Informatique", "Cybersécurité", "Environnement industriel"],
      source: "https://www.esaip.org/",
      verifiedOn: "2026-05-18",
    },
  ],

  polesRechercheRD: [
    {
      nom: "INRAE Pays de la Loire — site Angers-Beaucouzé (IRHS UMR 1345)",
      organisme: "inrae",
      domaine: "Recherche horticulture / semences / santé du végétal",
      source: "https://www.pays-de-la-loire.inrae.fr/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Eviden (Atos) — Centre mondial supercalculateurs Angers Belle-Beille",
      organisme: "autre",
      domaine: "Supercalculateurs / HPC / simulateurs quantiques / cybersécurité",
      source:
        "https://www.usinenouvelle.com/article/atos-construit-un-centre-mondial-d-essai-de-supercalculateurs-sur-son-site-d-angers.N718354",
      verifiedOn: "2026-05-18",
    },
  ],

  grandsGroupesImplantes: [
    {
      nom: "Eviden / Atos (ex-Bull)",
      secteur: "Informatique / supercalculateurs / cybersécurité",
      typeImplantation: "site_majeur",
      source: "https://www.wiki-anjou.fr/index.php/Bull_Angers",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Scania Production Angers",
      secteur:
        "Constructeur poids lourds (1500 emplois, ~120 camions/jour, marchés bassin méditerranéen)",
      typeImplantation: "usine_principale",
      source: "https://fr.wikipedia.org/wiki/Usine_Scania_d%27Angers",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Cointreau (Groupe Rémy Cointreau)",
      secteur: "Spiritueux / liqueurs (site production Saint-Barthélemy-d'Anjou)",
      typeImplantation: "usine_principale",
      source: "https://fr.wikipedia.org/wiki/Cointreau",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "Thales (site Angers)",
      secteur: "Électronique de défense / aéronautique",
      typeImplantation: "site_majeur",
      source: "https://www.thalesgroup.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Couche 2bis — tags KB sectorielles ─────────────────────────────
  kbSectorTags: ["agroalimentaire-igp", "industrie-manufacturiere", "it-numerique"],

  // ─── Optionnels (hors scoring dashboard) ────────────────────────────
  capitaleFrenchTech: {
    statut: "communaute",
    nomChapitre: "French Tech Angers (labellisée 2015, métropole Angers Loire Métropole)",
    source: "https://www.angersfrenchtech.com/",
    verifiedOn: "2026-05-18",
  },

  cciCompetente: {
    nom: "CCI Maine-et-Loire",
    source: "https://www.maineetloire.cci.fr/",
    verifiedOn: "2026-05-18",
  },

  distancesGrandesMetropoles: [
    {
      metropole: "Nantes",
      distanceKm: 90,
      tempsMnTgv: 40,
      tempsMnRoute: 60,
      source: "https://www.sncf-connect.com/",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Paris",
      distanceKm: 265,
      tempsMnTgv: 81,
      source: "https://www.sncf-connect.com/en-en/train/timetables/angers/paris",
      verifiedOn: "2026-05-18",
    },
    {
      metropole: "Rennes",
      distanceKm: 130,
      tempsMnRoute: 90,
      source: "https://fr.mappy.com/",
      verifiedOn: "2026-05-18",
    },
  ],

  incubateursAccelerateurs: [
    {
      nom: "Angers Technopole",
      focus: "Tech / IoT / numérique / startups innovantes",
      source: "https://angerstechnopole.com/",
      verifiedOn: "2026-05-18",
    },
    {
      nom: "WeForge (incubateur ESSCA)",
      focus: "Entrepreneuriat étudiant ESSCA",
      source: "https://www.essca.fr/weforge/",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Spécificités Angers ────────────────────────────────────────────
  specificitesLocales: [
    {
      theme: "capitale_mondiale_du_vegetal",
      description:
        "Angers siège mondial du pôle Vegepolys Valley (filière végétale, 560+ membres, 6 régions). Capitale française horticulture / semences / arboriculture.",
      source: "https://www.angers-developpement.com/angers-siege-du-pole-mondial-du-vegetal/",
      verifiedOn: "2026-05-18",
    },
    {
      theme: "limite_ouest_val_de_loire_unesco",
      description:
        "Val de Loire UNESCO 2000 s'arrête à Chalonnes-sur-Loire (~25 km ouest Angers). Angers porte d'entrée occidentale du périmètre patrimonial.",
      source: "https://whc.unesco.org/en/list/933/",
      verifiedOn: "2026-05-18",
    },
  ],

  // ─── Métadonnées de revue ───────────────────────────────────────────
  lastReviewedOn: "2026-05-18",
  reviewedBy: "Claude Code Opus 4.7 (sprint City Quality V3 ville #18)",
};
