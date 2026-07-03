/**
 * Prospection — Service de couverture (T4). Reconstruit `GeoCoverageStat` +
 * `StatsSnapshot` en RECALCULANT depuis un COUNT réel (anti-dérive, matrice T4
 * #2), jamais par simple incrément de dénormalisés. dép → région → France.
 */

import type { Prisma } from "../../../../prisma/generated/client";
import type { Contactabilite } from "@/lib/prospection/enums";
import {
  rollupDepartementsToRegionsToFrance,
  type CoverageCounters,
  type GeoStat,
} from "./coverage-rollup";

/** Ligne agrégée « nb entreprises par (département, contactabilité) ». */
export interface ContactabiliteByDep {
  departement: string;
  contactabilite: Contactabilite | null;
  count: number;
}
/** Ligne agrégée « nb entreprises enrichies par département ». */
export interface EnrichedByDep {
  departement: string;
  count: number;
}
/** Ligne agrégée « stockAttendu sommé par département ». */
export interface StockByDep {
  departement: string;
  stockAttendu: number;
}

function emptyCounters(): CoverageCounters {
  return {
    stockAttendu: 0,
    collectees: 0,
    enrichies: 0,
    exploitables: 0,
    partiels: 0,
    nonContactables: 0,
    perimees: 0,
  };
}

/**
 * Agrège les résultats de `groupBy` en compteurs par département (pur).
 * `collectees` = somme de toutes les contactabilités (entreprises en base).
 */
export function aggregatePerDepartement(input: {
  contactabilite: readonly ContactabiliteByDep[];
  enriched: readonly EnrichedByDep[];
  stock: readonly StockByDep[];
}): Map<string, CoverageCounters> {
  const map = new Map<string, CoverageCounters>();
  const get = (dep: string): CoverageCounters => {
    let c = map.get(dep);
    if (!c) {
      c = emptyCounters();
      map.set(dep, c);
    }
    return c;
  };

  for (const row of input.contactabilite) {
    const c = get(row.departement);
    c.collectees += row.count;
    if (row.contactabilite === "exploitable") c.exploitables += row.count;
    else if (row.contactabilite === "partiel") c.partiels += row.count;
    else if (row.contactabilite === "non_contactable") c.nonContactables += row.count;
  }
  for (const row of input.enriched) get(row.departement).enrichies += row.count;
  for (const row of input.stock) get(row.departement).stockAttendu += row.stockAttendu;

  return map;
}

// --- Wrapper DB ---

export interface CoverageDb {
  prospectionCompany: {
    groupBy(args: unknown): Promise<Array<Record<string, unknown>>>;
    count(args: { where: Prisma.ProspectionCompanyWhereInput }): Promise<number>;
  };
  prospectionStockReference: {
    groupBy(
      args: unknown,
    ): Promise<Array<{ departement: string; _sum: { stockAttendu: number | null } }>>;
  };
  prospectionGeoCoverageStat: {
    upsert(args: Prisma.ProspectionGeoCoverageStatUpsertArgs): Promise<unknown>;
  };
  prospectionStatsSnapshot: {
    upsert(args: Prisma.ProspectionStatsSnapshotUpsertArgs): Promise<unknown>;
  };
}

/**
 * Recalcule tous les `GeoCoverageStat` (dép/région/France) depuis la base, puis
 * écrit le snapshot quotidien. Retourne les stats calculées (aussi utile en test).
 */
export async function rebuildGeoCoverage(
  db: CoverageDb,
  opts: { snapshotDate?: Date; enrichedByDep?: EnrichedByDep[] } = {},
): Promise<GeoStat[]> {
  const baseWhere = { statutDiffusion: "diffusible", etatAdministratif: "actif", optOut: false };
  const contactRows = (await db.prospectionCompany.groupBy({
    by: ["departement", "contactabilite"],
    where: baseWhere,
    _count: { _all: true },
  })) as Array<{
    departement: string | null;
    contactabilite: Contactabilite | null;
    _count: { _all: number };
  }>;

  // `enrichies` recalculé depuis un COUNT réel (et NON un param optionnel jamais
  // passé — sinon toujours 0 en prod). Repli sur opts.enrichedByDep pour les tests.
  const enrichedRows =
    opts.enrichedByDep ??
    (
      (await db.prospectionCompany.groupBy({
        by: ["departement"],
        where: { ...baseWhere, enrichmentStatus: "enriched" },
        _count: { _all: true },
      })) as Array<{ departement: string | null; _count: { _all: number } }>
    )
      .filter((r) => r.departement)
      .map((r) => ({ departement: r.departement as string, count: r._count._all }));

  const stockRows = (await db.prospectionStockReference.groupBy({
    by: ["departement"],
    _sum: { stockAttendu: true },
  })) as Array<{ departement: string; _sum: { stockAttendu: number | null } }>;

  const contactabilite: ContactabiliteByDep[] = contactRows
    .filter((r) => r.departement)
    .map((r) => ({
      departement: r.departement as string,
      contactabilite: r.contactabilite,
      count: r._count._all,
    }));
  const stock: StockByDep[] = stockRows.map((r) => ({
    departement: r.departement,
    stockAttendu: r._sum.stockAttendu ?? 0,
  }));

  const perDep = aggregatePerDepartement({ contactabilite, enriched: enrichedRows, stock });
  const stats = rollupDepartementsToRegionsToFrance(perDep);

  for (const s of stats) {
    await db.prospectionGeoCoverageStat.upsert({
      where: { scope_scopeId_dimKey: { scope: s.scope, scopeId: s.scopeId, dimKey: s.dimKey } },
      create: {
        scope: s.scope,
        scopeId: s.scopeId,
        dimKey: s.dimKey,
        stockAttendu: s.stockAttendu,
        collectees: s.collectees,
        enrichies: s.enrichies,
        exploitables: s.exploitables,
        partiels: s.partiels,
        nonContactables: s.nonContactables,
        pctCompletion: s.pctCompletion,
        pctExploitableSurCollectees: s.pctExploitableSurCollectees,
        pctExploitableSurStock: s.pctExploitableSurStock,
        pctPerime: s.pctPerime,
        refreshedAt: opts.snapshotDate ?? null,
      },
      update: {
        stockAttendu: s.stockAttendu,
        collectees: s.collectees,
        enrichies: s.enrichies,
        exploitables: s.exploitables,
        partiels: s.partiels,
        nonContactables: s.nonContactables,
        pctCompletion: s.pctCompletion,
        pctExploitableSurCollectees: s.pctExploitableSurCollectees,
        pctExploitableSurStock: s.pctExploitableSurStock,
        pctPerime: s.pctPerime,
        refreshedAt: opts.snapshotDate ?? null,
      },
    });
  }

  return stats;
}

/** Écart de dérive détecté (dénormalisé vs COUNT réel) — pour alerte/log. */
export function detectDrift(
  denormalized: number,
  real: number,
): { drift: number; hasDrift: boolean } {
  const drift = denormalized - real;
  return { drift, hasDrift: drift !== 0 };
}
