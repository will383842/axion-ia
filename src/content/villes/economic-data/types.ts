// Types data économique enrichie — couche 1bis du dataset villes (sprint
// City Quality 2026-05-18, recadrage Will : "fond" avant "forme").
//
// V2 (2026-05-18 soir) : ajout 6 champs après exemple concurrent Romans —
// marques historiques, IGP/AOP, salons sectoriels, patrimoine, communes
// bassin, vignobles proches. C'est la MATIÈRE éditoriale qui rend chaque
// page ville unique anti-doorway HCU 2024.
//
// CONTRAT ABSOLU : aucune invention. Chaque entrée a un champ `source`
// vérifiable (URL INSEE, INAO, Wikipédia, sites officiels marques/salons/
// patrimoine). Si la source n'existe pas, le champ doit être omis.

/** Code NAF/APE officiel (rév. 2008) — 4-5 chars, ou section NACE 1 lettre. */
export type NafCode = string;

/**
 * Secteur NAF dominant pour la ville. Source : INSEE Sirene v3.11 stats
 * par commune, ou rapport CCI, ou DataNova.
 */
export interface VilleSecteurDominant {
  readonly naf: NafCode;
  readonly label: string;
  readonly rank?: number;
  readonly etablissementsCount?: number;
  readonly source: string;
  readonly verifiedOn: string;
}

/**
 * Pôle de compétitivité officiel France 2025 (labellisé Phase V 2023-2026).
 * Source canonique : https://competitivite.gouv.fr/poles
 */
export interface VillePoleCompetitivite {
  readonly nom: string;
  readonly secteur: string;
  readonly type: "siege" | "rayonnement";
  readonly source: string;
  readonly verifiedOn: string;
}

/** Distances aux infrastructures de transport clés. */
export interface VilleDistances {
  readonly gareTgv?: {
    readonly nom: string;
    readonly distanceKm: number;
    readonly source: string;
  };
  readonly aeroportPrincipal?: {
    readonly nom: string;
    readonly distanceKm: number;
    readonly source: string;
  };
  readonly metroOuTram?: {
    readonly lignes: number;
    readonly source: string;
  };
  readonly verifiedOn: string;
}

/** Statistiques INSEE complémentaires. */
export interface VilleStatsInsee {
  readonly etablissementsActifs?: number;
  readonly creationsEntreprises?: number;
  readonly densiteEtablissementsPour1000?: number;
  readonly anneeReference: number;
  readonly source: string;
  readonly verifiedOn: string;
}

// ─── V2 (2026-05-18 soir) — MATIÈRE ÉDITORIALE UNIQUE PAR VILLE ──────────

/**
 * Marque historique emblématique associée à la ville (siège historique,
 * fondation, héritage industriel). Source : Wikipédia article marque, ou
 * site officiel marque (rubrique "histoire").
 *
 * Sélection B2B-pertinente pour Axion-IA : marques avec lien réel à la
 * ville (pas "vu à la TV"). Anonymisation non requise (faits publics).
 */
export interface VilleMarqueHistorique {
  readonly nom: string;
  /** Secteur (mode, agroalimentaire, banque, industrie, tech, etc.). */
  readonly secteur: string;
  /**
   * Type de lien à la ville :
   *  - "fondation"  : marque fondée dans la ville (ex Charles Jourdan à Romans)
   *  - "siege"      : siège social actuel dans la ville
   *  - "production" : usine/atelier historique dans la ville
   *  - "heritage"   : marque éteinte mais marquage culturel fort
   */
  readonly lienVille: "fondation" | "siege" | "production" | "heritage";
  readonly source: string;
  readonly verifiedOn: string;
}

/**
 * Produit sous Indication Géographique Protégée (IGP), Appellation d'Origine
 * Protégée (AOP), Appellation d'Origine Contrôlée (AOC) ou Spécialité
 * Traditionnelle Garantie (STG) rattaché à la ville ou à son bassin.
 *
 * Source canonique : INAO (institut national de l'origine et de la qualité)
 * https://www.inao.gouv.fr/Espace-professionnel-et-outils/Rechercher-un-signe-officiel
 */
export interface VilleProduitIgpAop {
  readonly nom: string;
  /** Catégorie : agroalimentaire / vin / fromage / charcuterie / autre. */
  readonly categorie: string;
  readonly signe: "IGP" | "AOP" | "AOC" | "STG" | "Label Rouge";
  readonly source: string;
  readonly verifiedOn: string;
}

/**
 * Salon professionnel ou événement sectoriel récurrent pertinent pour
 * les entreprises de la ville. Source : site officiel du salon, ou site
 * organisateur (Comexposium, GL Events, Reed Expositions, etc.).
 */
export interface VilleSalonSectoriel {
  readonly nom: string;
  /** Secteur cible du salon. */
  readonly secteur: string;
  /** Localisation du salon (ville ou région d'accueil). */
  readonly localisation: string;
  /**
   * Lien à la ville : `accueille` si le salon a lieu dans la ville,
   * `secteur_pertinent` si la ville a des exposants/secteur représenté.
   */
  readonly lienVille: "accueille" | "secteur_pertinent";
  readonly source: string;
  readonly verifiedOn: string;
}

/**
 * Patrimoine culturel/historique notable de la ville (musée, monument,
 * site UNESCO, cité métier). Source : site officiel du lieu, Wikipédia,
 * Ministère de la Culture base Mérimée.
 */
export interface VillePatrimoineNotable {
  readonly nom: string;
  /** Type : musée / monument / unesco / cité_metier / parc / autre. */
  readonly type:
    "musee" | "monument" | "unesco" | "cite_metier" | "parc" | "site_archeologique" | "autre";
  readonly source: string;
  readonly verifiedOn: string;
}

/**
 * Commune du bassin économique de la ville (rayonnement local). Permet
 * de cibler les pages "audit IA ville + intervention sur communes alentour".
 * Source : Wikipédia (intercommunalité), INSEE bassin de vie.
 */
export interface VilleCommuneBassin {
  readonly slug: string;
  readonly nameFr: string;
  /** Distance approximative à la ville mère (km, calcul Haversine ou source). */
  readonly distanceKm?: number;
  readonly source: string;
  readonly verifiedOn: string;
}

/**
 * AOC/AOP viticole à proximité (≤ 50 km recommandé). Permet de cibler les
 * pages "audit IA domaine viticole" pour villes en zone viticole.
 * Source : INAO, Wikipédia article AOC.
 */
export interface VilleVignobleProche {
  readonly aoc: string;
  /** Distance approx du centre-ville à la zone AOC (km). */
  readonly distanceKm?: number;
  readonly source: string;
  readonly verifiedOn: string;
}

/** Tags KB sectorielles à requêter pour cette ville (RAG ContentGen). */
export type VilleKbSectorTag = string;

/**
 * Spécificité locale hors grille standard (cas où la ville a une singularité
 * que les 11 champs standards ne capturent pas). Exemples :
 *   - Strasbourg : institutions européennes (Parlement, CEDH, CoE)
 *   - Annecy : zone transfrontalière Suisse
 *   - Toulouse : aérospatial (Airbus, CNES, ATR)
 *   - Reims : capitale du Champagne
 *
 * Source obligatoire. Pas de prose narrative — fait structuré.
 */
export interface VilleSpecificiteLocale {
  /** Thème (ex "institutions_europeennes", "aerospatial", "transfrontalier"). */
  readonly theme: string;
  /** Description courte factuelle (≤ 200 chars, pas de marketing). */
  readonly description: string;
  readonly source: string;
  readonly verifiedOn: string;
}

// ─── V3 (2026-05-18 ~21h) — multi-taille PME/ETI/GE ─────────────────

/**
 * Entreprise labellisée EPV (Entreprise du Patrimoine Vivant), label État
 * pour savoir-faire artisanal d'excellence. Cible : PME industrielles et artisanales.
 * Source canonique : https://www.economie.gouv.fr/entreprises/label-epv
 * Annuaire officiel : https://www.epv.org/annuaire
 */
export interface VilleLabelEpv {
  readonly nom: string;
  /** Secteur métier (cuir, verre, mode, gastronomie, etc.). */
  readonly secteur: string;
  readonly source: string;
  readonly verifiedOn: string;
}

/**
 * Zone d'activité, parc technologique, technopôle, ZAC majeure de la ville.
 * Cible : PME/ETI qui s'implantent. Source : sites collectivités, INSEE, ou
 * sites des aménageurs (SEMs, EPF).
 */
export interface VilleZoneActivite {
  readonly nom: string;
  /** Type : ZAC, parc technologique, technopôle, district économique, etc. */
  readonly type: "zac" | "parc_tech" | "technopole" | "district_eco" | "autre";
  /** Secteur dominant (si applicable). */
  readonly secteurDominant?: string;
  readonly source: string;
  readonly verifiedOn: string;
}

/**
 * Grande école ou université majeure dans la ville (ou proche couronne
 * pour Paris). Bassin de talents — cible ETI/GE qui recrutent.
 * Source : sites officiels, Wikipédia article école.
 */
export interface VilleEcoleUniversite {
  readonly nom: string;
  readonly type:
    "ecole_ingenieur" | "ecole_commerce" | "universite" | "iut" | "ens" | "sciences_po" | "autre";
  /** Spécialités principales (si pertinent IA/tech/business). */
  readonly specialites?: ReadonlyArray<string>;
  readonly source: string;
  readonly verifiedOn: string;
}

/**
 * Pôle de recherche publique (Inria, CEA, CNRS, ANR, INSERM, INRAE) présent
 * dans la ville. ≠ pôles compétitivité (qui sont consortium public/privé).
 * Cible : ETI/GE en R&D, PME tech. Très IA-pertinent.
 * Source : sites officiels organismes.
 */
export interface VillePoleRechercheRD {
  readonly nom: string;
  readonly organisme: "inria" | "cea" | "cnrs" | "anr" | "inserm" | "inrae" | "autre";
  /** Domaine de recherche (IA, biotech, énergie, etc.). */
  readonly domaine?: string;
  readonly source: string;
  readonly verifiedOn: string;
}

/**
 * Grand groupe implanté dans la ville (siège social ou site majeur).
 * Cible : GE + sous-traitants ETI/PME. Anonymisation non requise (faits
 * publics : siège déclaré au registre du commerce).
 * Source : déclarations officielles groupe, Wikipédia, INSEE Sirene.
 */
export interface VilleGrandGroupe {
  readonly nom: string;
  readonly secteur: string;
  /** Type d'implantation. */
  readonly typeImplantation:
    "siege_social" | "site_majeur" | "centre_rd" | "usine_principale" | "heritage";
  readonly source: string;
  readonly verifiedOn: string;
}

// ─── Optionnels (champs présents dans le type, hors scoring dashboard) ──

/**
 * Statut French Tech officiel (13 Capitales + 12 Communautés labellisées
 * par la Mission French Tech). Optionnel — toutes les villes ne l'ont pas.
 * Source : https://lafrenchtech.com/fr/communaute-french-tech/
 */
export interface VilleCapitaleFrenchTech {
  readonly statut: "capitale" | "communaute" | "siege_national";
  /** Nom officiel du chapitre French Tech local. */
  readonly nomChapitre?: string;
  readonly source: string;
  readonly verifiedOn: string;
}

/** Chambre de commerce et d'industrie compétente pour la ville. */
export interface VilleCciCompetente {
  readonly nom: string;
  readonly source: string;
  readonly verifiedOn: string;
}

/**
 * Distance à une grande métropole voisine (≠ la ville elle-même).
 * Surtout utile pour villes secondaires (Saint-Étienne→Lyon, Valence→Lyon).
 * Inutile pour Paris/Lyon/Marseille (qui SONT les métropoles).
 */
export interface VilleDistanceMetropole {
  readonly metropole: string;
  readonly distanceKm: number;
  /** Temps de trajet TGV ou autoroute (mn). */
  readonly tempsMnTgv?: number;
  readonly tempsMnRoute?: number;
  readonly source: string;
  readonly verifiedOn: string;
}

/**
 * Incubateur, accélérateur ou pépinière d'entreprises dans la ville.
 * Source : sites officiels (Station F, Wilco, Plug & Play, NUMA, etc.)
 * ou portail bpifrance-creation.fr.
 */
export interface VilleIncubateurAccelerateur {
  readonly nom: string;
  /** Focus thématique (généraliste, IA, biotech, fintech, etc.). */
  readonly focus?: string;
  readonly source: string;
  readonly verifiedOn: string;
}

/**
 * Data économique enrichie d'une ville. Tous les champs optionnels —
 * on ne remplit QUE si on a la source. Cette data sert de MATIÈRE à
 * ContentGen pour composer landing pages et articles. La rédaction se
 * fait Phase C, pas ici.
 */
export interface VilleEconomicData {
  // ── Couche 1 (livrée 2026-05-18 matin) ──────────────────────────────
  readonly topSectorsNaf?: ReadonlyArray<VilleSecteurDominant>;
  readonly polesCompetitivite?: ReadonlyArray<VillePoleCompetitivite>;
  readonly distances?: VilleDistances;
  readonly statsInsee?: VilleStatsInsee;
  readonly kbSectorTags?: ReadonlyArray<VilleKbSectorTag>;

  // ── Couche 2 (V2 2026-05-18 soir — matière éditoriale unique) ───────
  /** Marques historiques B2B-pertinentes liées à la ville (≥3 recommandé). */
  readonly marquesHistoriques?: ReadonlyArray<VilleMarqueHistorique>;
  /** IGP/AOP/AOC géographiques rattachées à la ville ou bassin. */
  readonly produitsIgpAop?: ReadonlyArray<VilleProduitIgpAop>;
  /** Salons sectoriels pertinents pour les entreprises de la ville. */
  readonly salonsSectoriels?: ReadonlyArray<VilleSalonSectoriel>;
  /** Patrimoine culturel notable (musées, monuments, UNESCO, cités métier). */
  readonly patrimoineNotable?: ReadonlyArray<VillePatrimoineNotable>;
  /** Communes du bassin économique (rayonnement local). */
  readonly communesBassin?: ReadonlyArray<VilleCommuneBassin>;
  /** Vignobles AOC à proximité ≤ 50 km (cas pertinent). */
  readonly vignoblesProches?: ReadonlyArray<VilleVignobleProche>;

  // ── Couche 3 (V3 2026-05-18 ~21h — multi-taille PME/ETI/GE) ─────
  /** Labels EPV (Entreprises du Patrimoine Vivant) — cible PME artisanales. */
  readonly labelsEpvEtArtisanat?: ReadonlyArray<VilleLabelEpv>;
  /** Zones d'activité, parcs techno, technopôles — cible PME/ETI. */
  readonly zonesActivitesParcs?: ReadonlyArray<VilleZoneActivite>;
  /** Grandes écoles et universités — cible ETI (recrutement). */
  readonly grandesEcolesEtUniversites?: ReadonlyArray<VilleEcoleUniversite>;
  /** Pôles recherche publique (Inria/CEA/CNRS/ANR) — cible ETI/GE. */
  readonly polesRechercheRD?: ReadonlyArray<VillePoleRechercheRD>;
  /** Grands groupes implantés (siège ou site majeur) — cible GE. */
  readonly grandsGroupesImplantes?: ReadonlyArray<VilleGrandGroupe>;

  // ── Optionnels (présents dans le type mais hors scoring dashboard) ──
  readonly capitaleFrenchTech?: VilleCapitaleFrenchTech;
  readonly cciCompetente?: VilleCciCompetente;
  readonly distancesGrandesMetropoles?: ReadonlyArray<VilleDistanceMetropole>;
  readonly incubateursAccelerateurs?: ReadonlyArray<VilleIncubateurAccelerateur>;

  // ── Métadonnées d'adaptation par ville ──────────────────────────────
  /**
   * Champs structurellement non applicables pour cette ville (ex Paris commune
   * n'a pas d'IGP propre ni vignoble ≤ 50 km — c'est une réalité, pas un
   * manque de remplissage). Les critères listés ici sont exemptés du scoring
   * (ne pénalisent pas la ville).
   *
   * Valeurs autorisées = nom des champs `VilleEconomicData` (ex "produitsIgpAop").
   */
  readonly notApplicableFields?: ReadonlyArray<EconomicDataDimension>;
  /**
   * Spécificités locales hors grille standard (institutions européennes,
   * zones transfrontalières, etc.).
   */
  readonly specificitesLocales?: ReadonlyArray<VilleSpecificiteLocale>;

  // ── Métadonnées de revue ────────────────────────────────────────────
  readonly lastReviewedOn: string;
  readonly reviewedBy: string;
}

/** Helpers pour le scoring dashboard. */

export function countNonEmptyEconomicFields(data: VilleEconomicData | undefined): number {
  if (!data) return 0;
  let n = 0;
  if (data.topSectorsNaf && data.topSectorsNaf.length > 0) n++;
  if (data.polesCompetitivite && data.polesCompetitivite.length > 0) n++;
  if (data.distances && (data.distances.gareTgv || data.distances.aeroportPrincipal)) n++;
  if (data.statsInsee) n++;
  if (data.kbSectorTags && data.kbSectorTags.length > 0) n++;
  if (data.marquesHistoriques && data.marquesHistoriques.length > 0) n++;
  if (data.produitsIgpAop && data.produitsIgpAop.length > 0) n++;
  if (data.salonsSectoriels && data.salonsSectoriels.length > 0) n++;
  if (data.patrimoineNotable && data.patrimoineNotable.length > 0) n++;
  if (data.communesBassin && data.communesBassin.length > 0) n++;
  if (data.vignoblesProches && data.vignoblesProches.length > 0) n++;
  if (data.labelsEpvEtArtisanat && data.labelsEpvEtArtisanat.length > 0) n++;
  if (data.zonesActivitesParcs && data.zonesActivitesParcs.length > 0) n++;
  if (data.grandesEcolesEtUniversites && data.grandesEcolesEtUniversites.length > 0) n++;
  if (data.polesRechercheRD && data.polesRechercheRD.length > 0) n++;
  if (data.grandsGroupesImplantes && data.grandsGroupesImplantes.length > 0) n++;
  return n;
}

export const ECONOMIC_DATA_DIMENSIONS = [
  "topSectorsNaf",
  "polesCompetitivite",
  "distances",
  "statsInsee",
  "kbSectorTags",
  "marquesHistoriques",
  "produitsIgpAop",
  "salonsSectoriels",
  "patrimoineNotable",
  "communesBassin",
  "vignoblesProches",
  "labelsEpvEtArtisanat",
  "zonesActivitesParcs",
  "grandesEcolesEtUniversites",
  "polesRechercheRD",
  "grandsGroupesImplantes",
] as const;

export type EconomicDataDimension = (typeof ECONOMIC_DATA_DIMENSIONS)[number];
