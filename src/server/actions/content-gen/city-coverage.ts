/**
 * Content Generator — Dashboard couverture villes pilote (V3 multi-taille).
 *
 * Recadrage Will 2026-05-18 :
 *   - V1 matin : mesure de la copy rédigée (mauvais critère, repivoté).
 *   - V2 après-midi : mesure du fond (data INSEE + secteurs + pôles + distances + KB).
 *   - V3 soir : extension à TPE/PME/ETI/GE après exemple concurrent Romans.
 *     Ajout marques historiques, IGP/AOP, salons, patrimoine, bassin,
 *     vignobles, EPV, zones activités, écoles, R&D, grands groupes.
 *
 * Contrat zéro invention : chaque entrée `VilleEconomicData` exige un
 * champ `source` vérifiable (cf. economic-data/types.ts).
 *
 * 8 dimensions × 18 critères :
 *   1. identite            : data_insee (1)
 *   2. economie            : top_sectors_naf + stats_insee_detail (2)
 *   3. innovation          : poles_competitivite + poles_recherche_rd + grandes_ecoles (3)
 *   4. tissu_entreprises   : grands_groupes + zones_activites + labels_epv (3)
 *   5. patrimoine_terroir  : marques + igp_aop + patrimoine + vignobles (4)
 *   6. rayonnement         : salons + communes_bassin (2)
 *   7. infrastructure      : gare_tgv + aeroport_metro (2)
 *   8. kb_sectorielle      : kb_sector_tags (1)
 */

// Structure depuis `core` (~578 ms) et data économique depuis son propre module
// (~1,25 s) : ce fichier a besoin des deux, mais JAMAIS du contenu éditorial —
// inutile de payer les 29 Mo de `copy/` que traîne le barrel `@/content/villes`.
import { getVilleCore, VILLES_CORE } from "@/content/villes/core";
import { getVilleEconomicData } from "@/content/villes/economic-data";
import type { EconomicDataDimension } from "@/content/villes/economic-data/types";
import { requireAdmin } from "./_auth";

/** Map critère ID → champ VilleEconomicData (pour matcher notApplicableFields). */
const CRITERION_TO_FIELD: Record<string, EconomicDataDimension | null> = {
  data_insee: null,
  top_sectors_naf: "topSectorsNaf",
  stats_insee_detail: "statsInsee",
  poles_competitivite: "polesCompetitivite",
  poles_recherche_rd: "polesRechercheRD",
  grandes_ecoles: "grandesEcolesEtUniversites",
  grands_groupes: "grandsGroupesImplantes",
  zones_activites: "zonesActivitesParcs",
  labels_epv: "labelsEpvEtArtisanat",
  marques_historiques: "marquesHistoriques",
  produits_igp_aop: "produitsIgpAop",
  patrimoine_notable: "patrimoineNotable",
  vignobles_proches: "vignoblesProches",
  salons_sectoriels: "salonsSectoriels",
  communes_bassin: "communesBassin",
  gare_tgv: "distances",
  aeroport_ou_metro: "distances",
  kb_sector_tags: "kbSectorTags",
};

/**
 * 39 villes pilote du sprint manuel 2026-05-18 — top démographique France
 * métropolitaine. Saint-Denis (La Réunion) exclu (pas dans dataset INSEE
 * métropole actuel).
 */
export const PILOT_CITY_SLUGS = [
  "paris",
  "marseille",
  "lyon",
  "toulouse",
  "nice",
  "nantes",
  "montpellier",
  "strasbourg",
  "bordeaux",
  "lille",
  "rennes",
  "toulon",
  "reims",
  "saint-etienne",
  "le-havre",
  "villeurbanne",
  "dijon",
  "angers",
  "grenoble",
  "nimes",
  "aix-en-provence",
  "clermont-ferrand",
  "le-mans",
  "brest",
  "tours",
  "amiens",
  "annecy",
  "limoges",
  "metz",
  "perpignan",
  "boulogne-billancourt",
  "besancon",
  "orleans",
  "rouen",
  "montreuil",
  "caen",
  "argenteuil",
  "mulhouse",
  "nancy",
] as const;

export type PilotCitySlug = (typeof PILOT_CITY_SLUGS)[number];

export type CriterionStatus = "green" | "yellow" | "red";

export interface Criterion {
  readonly id: string;
  readonly label: string;
  readonly status: CriterionStatus;
  readonly detail?: string;
  readonly sourced?: boolean;
  /** Si true, le critère est exempté du scoring (champ N/A pour cette ville). */
  readonly notApplicable?: boolean;
}

export interface CityDimension {
  readonly id:
    | "identite"
    | "economie"
    | "innovation"
    | "tissu_entreprises"
    | "patrimoine_terroir"
    | "rayonnement"
    | "infrastructure"
    | "kb_sectorielle";
  readonly label: string;
  readonly criteria: ReadonlyArray<Criterion>;
  readonly scorePct: number;
}

export interface CityCoverageRow {
  readonly slug: PilotCitySlug;
  readonly nameFr: string;
  readonly population: number;
  readonly inseeCode: string;
  readonly region: string;
  readonly indexable: boolean;
  readonly lastReviewedOn: string | null;
  readonly reviewedBy: string | null;
  readonly dimensions: ReadonlyArray<CityDimension>;
  readonly globalScorePct: number;
  readonly greenCount: number;
  readonly totalCriteria: number;
}

const ALL_DIMENSION_IDS: ReadonlyArray<CityDimension["id"]> = [
  "identite",
  "economie",
  "innovation",
  "tissu_entreprises",
  "patrimoine_terroir",
  "rayonnement",
  "infrastructure",
  "kb_sectorielle",
];

function statusScore(s: CriterionStatus): number {
  if (s === "green") return 1;
  if (s === "yellow") return 0.5;
  return 0;
}

function avg(values: ReadonlyArray<number>): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Critère "liste sourcée" : vert si ≥ minGreen items tous sourcés, jaune si ≥ 1, rouge sinon. */
function scoreSourcedList<T extends { source: string }>(
  items: ReadonlyArray<T> | undefined,
  minGreen: number,
): { status: CriterionStatus; sourced: boolean; count: number } {
  const count = items?.length ?? 0;
  const allSourced = items?.every((i) => i.source.length > 0) ?? false;
  if (count >= minGreen && allSourced) return { status: "green", sourced: true, count };
  if (count >= 1) return { status: "yellow", sourced: allSourced && count > 0, count };
  return { status: "red", sourced: false, count };
}

/**
 * Calcule la couverture data enrichie d'une ville pilote.
 * Pure — pas d'I/O DB, lit uniquement les fichiers TS curatés.
 */
export async function computeCityCoverage(slug: PilotCitySlug): Promise<CityCoverageRow | null> {
  const ville = getVilleCore(slug);
  if (!ville) return null;
  const eco = getVilleEconomicData(slug);

  // ── Dimension 1 : identité INSEE ──────────────────────────────────────
  const identiteCriteria: ReadonlyArray<Criterion> = [
    {
      id: "data_insee",
      label: "Data INSEE de base",
      status: "green",
      sourced: true,
      detail: `INSEE ${ville.inseeCode} · pop. ${ville.population.toLocaleString("fr-FR")}`,
    },
  ];

  // ── Dimension 2 : économie ────────────────────────────────────────────
  const sectorsScore = scoreSourcedList(eco?.topSectorsNaf, 3);
  const hasStats = Boolean(eco?.statsInsee);
  const economieCriteria: ReadonlyArray<Criterion> = [
    {
      id: "top_sectors_naf",
      label: "Top secteurs NAF (≥3 sourcés)",
      status: sectorsScore.status,
      sourced: sectorsScore.sourced,
      ...(sectorsScore.count > 0
        ? {
            detail: `${sectorsScore.count} secteurs${sectorsScore.sourced ? " · sourcés" : ""}`,
          }
        : {}),
    },
    {
      id: "stats_insee_detail",
      label: "Stats INSEE détaillées (établissements, créations)",
      status: hasStats ? "green" : "red",
      sourced: hasStats,
      ...(hasStats && eco?.statsInsee?.etablissementsActifs
        ? { detail: `${eco.statsInsee.etablissementsActifs.toLocaleString("fr-FR")} étab.` }
        : {}),
    },
  ];

  // ── Dimension 3 : innovation (pôles + R&D + écoles) ───────────────────
  const polesScore = scoreSourcedList(eco?.polesCompetitivite, 1);
  const rdScore = scoreSourcedList(eco?.polesRechercheRD, 1);
  const ecolesScore = scoreSourcedList(eco?.grandesEcolesEtUniversites, 2);
  const innovationCriteria: ReadonlyArray<Criterion> = [
    {
      id: "poles_competitivite",
      label: "Pôles compétitivité (≥1)",
      status: polesScore.status,
      sourced: polesScore.sourced,
      ...(polesScore.count > 0
        ? { detail: `${polesScore.count} pôle${polesScore.count > 1 ? "s" : ""}` }
        : {}),
    },
    {
      id: "poles_recherche_rd",
      label: "Pôles recherche publique (Inria/CEA/CNRS)",
      status: rdScore.status,
      sourced: rdScore.sourced,
      ...(rdScore.count > 0
        ? { detail: `${rdScore.count} organisme${rdScore.count > 1 ? "s" : ""}` }
        : {}),
    },
    {
      id: "grandes_ecoles",
      label: "Grandes écoles & universités (≥2)",
      status: ecolesScore.status,
      sourced: ecolesScore.sourced,
      ...(ecolesScore.count > 0 ? { detail: `${ecolesScore.count} établ.` } : {}),
    },
  ];

  // ── Dimension 4 : tissu entreprises (multi-taille) ────────────────────
  const groupesScore = scoreSourcedList(eco?.grandsGroupesImplantes, 3);
  const zonesScore = scoreSourcedList(eco?.zonesActivitesParcs, 1);
  const epvScore = scoreSourcedList(eco?.labelsEpvEtArtisanat, 1);
  const tissuCriteria: ReadonlyArray<Criterion> = [
    {
      id: "grands_groupes",
      label: "Grands groupes implantés (≥3)",
      status: groupesScore.status,
      sourced: groupesScore.sourced,
      ...(groupesScore.count > 0 ? { detail: `${groupesScore.count} groupes` } : {}),
    },
    {
      id: "zones_activites",
      label: "Zones d'activité / parcs (≥1)",
      status: zonesScore.status,
      sourced: zonesScore.sourced,
      ...(zonesScore.count > 0 ? { detail: `${zonesScore.count} zones` } : {}),
    },
    {
      id: "labels_epv",
      label: "Labels EPV / artisanat (≥1)",
      status: epvScore.status,
      sourced: epvScore.sourced,
      ...(epvScore.count > 0 ? { detail: `${epvScore.count} EPV` } : {}),
    },
  ];

  // ── Dimension 5 : patrimoine + terroir ────────────────────────────────
  const marquesScore = scoreSourcedList(eco?.marquesHistoriques, 3);
  const igpScore = scoreSourcedList(eco?.produitsIgpAop, 1);
  const patrimoineScore = scoreSourcedList(eco?.patrimoineNotable, 2);
  const vignoblesScore = scoreSourcedList(eco?.vignoblesProches, 1);
  const patrimoineTerroirCriteria: ReadonlyArray<Criterion> = [
    {
      id: "marques_historiques",
      label: "Marques historiques (≥3 B2B)",
      status: marquesScore.status,
      sourced: marquesScore.sourced,
      ...(marquesScore.count > 0 ? { detail: `${marquesScore.count} marques` } : {}),
    },
    {
      id: "produits_igp_aop",
      label: "Produits IGP/AOP/AOC (≥1)",
      status: igpScore.status,
      sourced: igpScore.sourced,
      ...(igpScore.count > 0 ? { detail: `${igpScore.count} produits` } : {}),
    },
    {
      id: "patrimoine_notable",
      label: "Patrimoine culturel notable (≥2)",
      status: patrimoineScore.status,
      sourced: patrimoineScore.sourced,
      ...(patrimoineScore.count > 0 ? { detail: `${patrimoineScore.count} lieux` } : {}),
    },
    {
      id: "vignobles_proches",
      label: "Vignobles AOC ≤ 50 km (si pertinent)",
      status: vignoblesScore.status,
      sourced: vignoblesScore.sourced,
      ...(vignoblesScore.count > 0 ? { detail: `${vignoblesScore.count} AOC` } : {}),
    },
  ];

  // ── Dimension 6 : rayonnement local ───────────────────────────────────
  const salonsScore = scoreSourcedList(eco?.salonsSectoriels, 2);
  const bassinScore = scoreSourcedList(eco?.communesBassin, 3);
  const rayonnementCriteria: ReadonlyArray<Criterion> = [
    {
      id: "salons_sectoriels",
      label: "Salons sectoriels pertinents (≥2)",
      status: salonsScore.status,
      sourced: salonsScore.sourced,
      ...(salonsScore.count > 0 ? { detail: `${salonsScore.count} salons` } : {}),
    },
    {
      id: "communes_bassin",
      label: "Communes du bassin (≥3)",
      status: bassinScore.status,
      sourced: bassinScore.sourced,
      ...(bassinScore.count > 0 ? { detail: `${bassinScore.count} communes` } : {}),
    },
  ];

  // ── Dimension 7 : infrastructure transport ────────────────────────────
  const hasGareTgv = Boolean(eco?.distances?.gareTgv);
  const hasAeroport = Boolean(eco?.distances?.aeroportPrincipal);
  const hasMetro = Boolean(eco?.distances?.metroOuTram);
  const infraCriteria: ReadonlyArray<Criterion> = [
    {
      id: "gare_tgv",
      label: "Gare TGV (distance sourcée)",
      status: hasGareTgv ? "green" : "red",
      sourced: hasGareTgv,
      ...(eco?.distances?.gareTgv
        ? {
            detail: `${eco.distances.gareTgv.nom} · ${eco.distances.gareTgv.distanceKm} km`,
          }
        : {}),
    },
    {
      id: "aeroport_ou_metro",
      label: "Aéroport ou métro/tram",
      status: hasAeroport || hasMetro ? "green" : "red",
      sourced: hasAeroport || hasMetro,
      ...(eco?.distances?.aeroportPrincipal
        ? {
            detail: `${eco.distances.aeroportPrincipal.nom} · ${eco.distances.aeroportPrincipal.distanceKm} km`,
          }
        : hasMetro
          ? { detail: `${eco?.distances?.metroOuTram?.lignes ?? 0} lignes` }
          : {}),
    },
  ];

  // ── Dimension 8 : KB sectorielle ──────────────────────────────────────
  const kbTagsCount = eco?.kbSectorTags?.length ?? 0;
  const kbCriteria: ReadonlyArray<Criterion> = [
    {
      id: "kb_sector_tags",
      label: "Tags KB sectorielles (RAG ContentGen, ≥2)",
      status: kbTagsCount >= 2 ? "green" : kbTagsCount >= 1 ? "yellow" : "red",
      sourced: kbTagsCount > 0,
      ...(kbTagsCount > 0 ? { detail: `${kbTagsCount} tag${kbTagsCount > 1 ? "s" : ""}` } : {}),
    },
  ];

  // Marque les critères dont le champ data est listé comme N/A pour la ville.
  const naSet = new Set<EconomicDataDimension>(eco?.notApplicableFields ?? []);
  function applyNa<T extends Criterion>(c: T): T {
    const field = CRITERION_TO_FIELD[c.id];
    if (field && naSet.has(field)) {
      return { ...c, notApplicable: true } as T;
    }
    return c;
  }

  function dimensionScore(criteria: ReadonlyArray<Criterion>): number {
    const eligible = criteria.filter((c) => !c.notApplicable);
    if (eligible.length === 0) return 100; // tous N/A = dimension neutre = vert
    return avg(eligible.map((c) => statusScore(c.status))) * 100;
  }

  // Applique l'exemption N/A à chaque liste avant calcul.
  const applyNaList = (list: ReadonlyArray<Criterion>): ReadonlyArray<Criterion> =>
    list.map(applyNa);

  const identiteFinal = applyNaList(identiteCriteria);
  const economieFinal = applyNaList(economieCriteria);
  const innovationFinal = applyNaList(innovationCriteria);
  const tissuFinal = applyNaList(tissuCriteria);
  const patrimoineFinal = applyNaList(patrimoineTerroirCriteria);
  const rayonnementFinal = applyNaList(rayonnementCriteria);
  const infraFinal = applyNaList(infraCriteria);
  const kbFinal = applyNaList(kbCriteria);

  const dimensions: ReadonlyArray<CityDimension> = [
    {
      id: "identite",
      label: "Identité INSEE",
      criteria: identiteFinal,
      scorePct: dimensionScore(identiteFinal),
    },
    {
      id: "economie",
      label: "Économie & INSEE",
      criteria: economieFinal,
      scorePct: dimensionScore(economieFinal),
    },
    {
      id: "innovation",
      label: "Innovation & talents",
      criteria: innovationFinal,
      scorePct: dimensionScore(innovationFinal),
    },
    {
      id: "tissu_entreprises",
      label: "Tissu entreprises (TPE→GE)",
      criteria: tissuFinal,
      scorePct: dimensionScore(tissuFinal),
    },
    {
      id: "patrimoine_terroir",
      label: "Patrimoine & terroir",
      criteria: patrimoineFinal,
      scorePct: dimensionScore(patrimoineFinal),
    },
    {
      id: "rayonnement",
      label: "Rayonnement local",
      criteria: rayonnementFinal,
      scorePct: dimensionScore(rayonnementFinal),
    },
    {
      id: "infrastructure",
      label: "Infrastructure transport",
      criteria: infraFinal,
      scorePct: dimensionScore(infraFinal),
    },
    {
      id: "kb_sectorielle",
      label: "KB sectorielle",
      criteria: kbFinal,
      scorePct: dimensionScore(kbFinal),
    },
  ];

  const allCriteria = dimensions.flatMap((d) => d.criteria);
  // greenCount exclut les critères N/A (ne pas pénaliser ni compter en faux verts)
  const eligibleCriteria = allCriteria.filter((c) => !c.notApplicable);
  const greenCount = eligibleCriteria.filter((c) => c.status === "green").length;
  const eligibleTotal = eligibleCriteria.length;
  const globalScorePct = avg(dimensions.map((d) => d.scorePct));
  // Indexable = secteurs NAF sourcés (matière métier minimum).
  const indexable = sectorsScore.status === "green";

  return {
    slug,
    nameFr: ville.nameFr,
    population: ville.population,
    inseeCode: ville.inseeCode,
    region: ville.region,
    indexable,
    lastReviewedOn: eco?.lastReviewedOn ?? null,
    reviewedBy: eco?.reviewedBy ?? null,
    dimensions,
    globalScorePct,
    greenCount,
    // totalCriteria reflète les critères ÉLIGIBLES (hors N/A) — le ratio
    // greenCount/totalCriteria est ainsi équitable cross-villes.
    totalCriteria: eligibleTotal,
  };
}

export interface CityCoverageSummary {
  readonly rows: ReadonlyArray<CityCoverageRow>;
  readonly totals: {
    readonly totalCities: number;
    readonly indexableCities: number;
    readonly perfectCities: number;
    readonly avgScorePct: number;
    readonly totalCriteriaGreen: number;
    readonly totalCriteria: number;
  };
  readonly totalCitiesInBase: number;
}

export async function getCityCoverage(): Promise<CityCoverageSummary> {
  "use server";
  await requireAdmin();
  const rows = (
    await Promise.all(PILOT_CITY_SLUGS.map((slug) => computeCityCoverage(slug)))
  ).filter((r): r is CityCoverageRow => r !== null);

  const indexableCities = rows.filter((r) => r.indexable).length;
  const perfectCities = rows.filter((r) => r.greenCount === r.totalCriteria).length;
  const avgScorePct = avg(rows.map((r) => r.globalScorePct));
  const totalCriteriaGreen = rows.reduce((acc, r) => acc + r.greenCount, 0);
  const totalCriteria = rows.reduce((acc, r) => acc + r.totalCriteria, 0);

  return {
    rows,
    totals: {
      totalCities: rows.length,
      indexableCities,
      perfectCities,
      avgScorePct,
      totalCriteriaGreen,
      totalCriteria,
    },
    totalCitiesInBase: VILLES_CORE.length,
  };
}

/** Utilitaire export pour tests. */
export const _internal = {
  ALL_DIMENSION_IDS,
  statusScore,
  avg,
  scoreSourcedList,
};
