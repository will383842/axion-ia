/**
 * Prospection — Requêtes de lecture pour la console admin (T6/T7).
 *
 * Server-only, stub-aware (au build `stub.invalid`, le Proxy Prisma renvoie
 * `[]/null/0` → les pages rendent vide sans casser le SSG). Pagination keyset
 * (pas d'OFFSET profond) pour la base entreprises (Web Vitals / échelle).
 */

import { prisma } from "@/lib/prisma";
import {
  REGION_LABELS,
  type RegionCode,
  ALL_DEPARTEMENTS,
  regionLabelOfDepartement,
} from "@/lib/prospection/departement-to-region";
import { SECTEUR_LABELS, type Secteur } from "@/lib/prospection/enums";
import { aggregateActivity } from "./activity-stats";

export interface FranceKpis {
  stockAttendu: number;
  collectees: number;
  enrichies: number;
  exploitables: number;
  pctCompletion: number;
  pctExploitableSurStock: number;
}

export async function getFranceKpis(): Promise<FranceKpis> {
  const fr = await prisma.prospectionGeoCoverageStat.findFirst({
    where: { scope: "france", scopeId: "FR", dimKey: "*|*|*" },
  });
  return {
    stockAttendu: fr?.stockAttendu ?? 0,
    collectees: fr?.collectees ?? 0,
    enrichies: fr?.enrichies ?? 0,
    exploitables: fr?.exploitables ?? 0,
    pctCompletion: fr?.pctCompletion ?? 0,
    pctExploitableSurStock: fr?.pctExploitableSurStock ?? 0,
  };
}

export async function listActiveCampaigns() {
  return prisma.prospectionCampaign.findMany({
    where: { statut: { in: ["active", "en_pause", "en_pause_quota"] } },
    orderBy: [{ priorite: "desc" }, { createdAt: "desc" }],
    take: 50,
  });
}

export async function listCampaigns() {
  return prisma.prospectionCampaign.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
}

export async function getCampaign(id: string) {
  return prisma.prospectionCampaign.findUnique({
    where: { id },
    include: { cells: { take: 500, orderBy: { updatedAt: "desc" } } },
  });
}

export interface CompanyFilters {
  departement?: string | undefined;
  secteur?: string | undefined;
  taille?: string | undefined;
  contactabilite?: string | undefined;
  cursor?: string | undefined;
  take?: number | undefined;
}

/** Base entreprises — keyset pagination (curseur sur `id`). */
export async function listCompanies(f: CompanyFilters) {
  const take = Math.min(f.take ?? 50, 200);
  return prisma.prospectionCompany.findMany({
    where: {
      statutDiffusion: "diffusible",
      optOut: false,
      ...(f.departement ? { departement: f.departement } : {}),
      ...(f.secteur ? { secteur: f.secteur as never } : {}),
      ...(f.taille ? { taille: f.taille as never } : {}),
      ...(f.contactabilite ? { contactabilite: f.contactabilite as never } : {}),
    },
    orderBy: { id: "asc" },
    take: take + 1,
    ...(f.cursor ? { cursor: { id: f.cursor }, skip: 1 } : {}),
  });
}

export async function countContactsByTab() {
  const [exploitable, partiel, nonContactable] = await Promise.all([
    prisma.prospectionCompany.count({
      where: { contactabilite: "exploitable", optOut: false, statutDiffusion: "diffusible" },
    }),
    prisma.prospectionCompany.count({
      where: { contactabilite: "partiel", optOut: false, statutDiffusion: "diffusible" },
    }),
    prisma.prospectionCompany.count({
      where: { contactabilite: "non_contactable", optOut: false, statutDiffusion: "diffusible" },
    }),
  ]);
  return { exploitable, partiel, nonContactable };
}

export async function listRegionCoverage() {
  const rows = await prisma.prospectionGeoCoverageStat.findMany({
    where: { scope: "region", dimKey: "*|*|*" },
    orderBy: { collectees: "desc" },
  });
  return rows.map((r) => ({
    ...r,
    regionLabel: REGION_LABELS[r.scopeId as RegionCode] ?? r.scopeId,
  }));
}

export async function getCompanyBySiren(siren: string) {
  return prisma.prospectionCompany.findUnique({
    where: { siren },
    include: {
      contacts: { orderBy: [{ isPrimary: "desc" }, { type: "asc" }] },
      persons: { where: { optOut: false }, orderBy: { nom: "asc" } },
      establishments: { take: 20, orderBy: { estSiege: "desc" } },
    },
  });
}

export async function getPersonByKey(personKey: string) {
  return prisma.prospectionPerson.findMany({
    where: { personKey, optOut: false },
    include: { company: { select: { siren: true, denomination: true, departement: true } } },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Couverture ventilée par ACTIVITÉ. Sans `secteur` → par secteur (grossier) ;
 * avec `secteur` → par code NAF dans ce secteur (fin, ex. architectes du BTP).
 * Filtrable par département. Agrégation live (admin, force-dynamic, stub-aware).
 */
export async function getActivityBreakdown(opts: { departement?: string; secteur?: string }) {
  const base = {
    statutDiffusion: "diffusible" as never,
    etatAdministratif: "actif" as never,
    optOut: false,
    naf: { not: null },
    taille: { not: null },
    ...(opts.departement ? { departement: opts.departement } : {}),
  };

  if (opts.secteur) {
    // Drill-down : par code NAF DANS un secteur (ex. architectes du BTP).
    const where = { ...base, secteur: opts.secteur as never };
    const [contactRows, enrichedRows] = await Promise.all([
      prisma.prospectionCompany.groupBy({
        by: ["naf", "contactabilite"],
        where,
        _count: { _all: true },
      }),
      prisma.prospectionCompany.groupBy({
        by: ["naf"],
        where: { ...where, enrichmentStatus: "enriched" as never },
        _count: { _all: true },
      }),
    ]);
    return aggregateActivity(
      contactRows.map((r) => ({
        key: r.naf,
        contactabilite: r.contactabilite,
        count: r._count._all,
      })),
      enrichedRows.map((r) => ({ key: r.naf, count: r._count._all })),
      (k) => k, // NAF : le code EST le libellé le plus précis disponible ici
    );
  }

  // Vue grossière : par secteur.
  const [contactRows, enrichedRows] = await Promise.all([
    prisma.prospectionCompany.groupBy({
      by: ["secteur", "contactabilite"],
      where: base,
      _count: { _all: true },
    }),
    prisma.prospectionCompany.groupBy({
      by: ["secteur"],
      where: { ...base, enrichmentStatus: "enriched" as never },
      _count: { _all: true },
    }),
  ]);
  return aggregateActivity(
    contactRows.map((r) => ({
      key: r.secteur,
      contactabilite: r.contactabilite,
      count: r._count._all,
    })),
    enrichedRows.map((r) => ({ key: r.secteur, count: r._count._all })),
    (k) => SECTEUR_LABELS[k as Secteur] ?? k,
  );
}

/**
 * Prospection Santé (V2) — répartition des praticiens par spécialité (cardiologie,
 * ophtalmologie…), que le NAF ne distingue pas. Filtrable par département.
 */
export async function getSpecialiteBreakdown(opts: { departement?: string }) {
  const rows = await prisma.prospectionHealthPractitioner.groupBy({
    by: ["specialite"],
    where: {
      optOut: false,
      ...(opts.departement ? { departement: opts.departement } : {}),
    },
    _count: { _all: true },
  });
  return rows
    .map((r) => ({ specialite: r.specialite, count: r._count._all }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Complétion PAR DÉPARTEMENT (page Départements — balayage 1-clic). Retourne les
 * 101 départements avec leur couverture (0 si non démarré), triés par n°.
 */
export async function listDepartmentCoverage() {
  const stats = await prisma.prospectionGeoCoverageStat.findMany({
    where: { scope: "departement", dimKey: "*|*|*" },
  });
  const byDep = new Map(stats.map((s) => [s.scopeId, s]));
  return ALL_DEPARTEMENTS.map((dep) => {
    const s = byDep.get(dep);
    return {
      departement: dep,
      region: regionLabelOfDepartement(dep),
      stockAttendu: s?.stockAttendu ?? 0,
      collectees: s?.collectees ?? 0,
      exploitables: s?.exploitables ?? 0,
      pctCompletion: s?.pctCompletion ?? 0,
      demarre: !!s && (s.collectees > 0 || s.stockAttendu > 0),
    };
  });
}

export async function listSuppressions() {
  return prisma.prospectionSuppressionEntry.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
}

export async function listRecentEvents() {
  return prisma.prospectionEvent.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
}
