"use server";

/**
 * Prospection — Server Action d'export segmenté (T8).
 * RBAC `dpo|admin` (capacité export) + journal d'accès + re-filtre RGPD live.
 * Renvoie les 3 CSV (le client déclenche le téléchargement) — pas de fichier
 * hors web-root ni route de download à sécuriser en V1.
 */

import { prisma } from "@/lib/prisma";
import { requireProspectionAccess } from "./_auth";
import { buildSegmentedExport, type ExportRowWithRgpd } from "@/server/prospection/export/generate";
import { buildSuppressionSets } from "@/server/prospection/rgpd/export-filter";

export interface ExportFilters {
  departement?: string;
  secteur?: string;
  taille?: string;
}

export interface ExportResult {
  exploitables: string;
  partiels: string;
  aCompleter: string;
  counts: { exploitables: number; partiels: number; a_completer: number };
  excluded: number;
  excludedByReason: Record<string, number>;
}

const MAX_ROWS = 100_000;

export async function generateProspectionExport(filters: ExportFilters): Promise<ExportResult> {
  const session = await requireProspectionAccess("export");

  const companies = await prisma.prospectionCompany.findMany({
    where: {
      ...(filters.departement ? { departement: filters.departement } : {}),
      ...(filters.secteur ? { secteur: filters.secteur as never } : {}),
      ...(filters.taille ? { taille: filters.taille as never } : {}),
    },
    orderBy: { id: "asc" },
    take: MAX_ROWS,
    include: {
      contacts: { where: { type: "email" }, select: { valueNormalized: true, isPrimary: true } },
    },
  });

  const suppressions = buildSuppressionSets(
    await prisma.prospectionSuppressionEntry.findMany({
      select: { type: true, valueNormalized: true },
    }),
  );

  const rows: ExportRowWithRgpd[] = companies.map((c) => {
    const emails = c.contacts.map((x) => x.valueNormalized);
    return {
      siren: c.siren,
      denomination: c.denomination,
      naf: c.naf,
      secteur: c.secteur,
      taille: c.taille,
      departement: c.departement,
      commune: c.commune,
      emailPrincipal: emails[0] ?? null,
      telephonePrincipal: c.telephonePublic,
      contactabilite: c.contactabilite,
      leadScore: c.leadScore,
      source: c.source,
      lastCollectedAt: c.lastCollectedAt,
      statutDiffusion: c.statutDiffusion,
      optOut: c.optOut,
      emails,
    };
  });

  const out = buildSegmentedExport(rows, suppressions);

  // Journal d'accès RGPD (export de données perso).
  await prisma.prospectionAccessLog.create({
    data: {
      userId: session.userId,
      action: "export",
      cible: JSON.stringify({ filters, counts: out.counts, excluded: out.excluded }),
    },
  });
  await prisma.prospectionEvent.create({
    data: {
      type: "export",
      actorId: session.userId,
      reason: `export ${out.counts.exploitables + out.counts.partiels + out.counts.a_completer} lignes`,
    },
  });

  return {
    exploitables: out.exploitables,
    partiels: out.partiels,
    aCompleter: out.aCompleter,
    counts: out.counts,
    excluded: out.excluded,
    excludedByReason: out.excludedByReason,
  };
}
