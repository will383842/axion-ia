/**
 * Prospection — Requêtes de lecture pour la console admin (T6/T7).
 *
 * Server-only, stub-aware (au build `stub.invalid`, le Proxy Prisma renvoie
 * `[]/null/0` → les pages rendent vide sans casser le SSG). Pagination keyset
 * (pas d'OFFSET profond) pour la base entreprises (Web Vitals / échelle).
 */

import { prisma } from "@/lib/prisma";
import { REGION_LABELS, type RegionCode } from "@/lib/prospection/departement-to-region";

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
    where: { personKey },
    include: { company: { select: { siren: true, denomination: true, departement: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function listSuppressions() {
  return prisma.prospectionSuppressionEntry.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
}

export async function listRecentEvents() {
  return prisma.prospectionEvent.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
}
