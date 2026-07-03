/**
 * Prospection — Collecte d'une cellule (T4).
 *
 * Le backbone Stock (T3) a déjà peuplé toutes les entreprises. « Collecter » une
 * cellule = COMPTER les entreprises diffusibles/actives/non-opt-out du triplet
 * (dép, naf, taille), tracer un `CollectRun`, décider `fait|erreur` (exhaustivité
 * `collecte ≥ attendu`), et enfiler l'enrichissement. Idempotent : recompter ne
 * crée AUCUNE nouvelle entreprise (matrice T4 #6). Anti-doublon garanti par le
 * schéma (upsert SIREN en amont).
 */

import type { Prisma } from "../../../../prisma/generated/client";
import type { CellStatut, Taille } from "@/lib/prospection/enums";
import { decideCellOutcome } from "./campaign-expansion";

export interface CollectDb {
  prospectionCompany: {
    count(args: { where: Prisma.ProspectionCompanyWhereInput }): Promise<number>;
    findMany(args: {
      where: Prisma.ProspectionCompanyWhereInput;
      select: { id: true };
      take?: number;
    }): Promise<{ id: string }[]>;
  };
  prospectionCollectRun: {
    create(args: Prisma.ProspectionCollectRunCreateArgs): Promise<{ id: string }>;
    update(args: Prisma.ProspectionCollectRunUpdateArgs): Promise<unknown>;
  };
  prospectionCoverageCell: {
    update(args: Prisma.ProspectionCoverageCellUpdateArgs): Promise<unknown>;
  };
}

export interface CellToCollect {
  id: string;
  departement: string;
  naf: string;
  taille: Taille;
  attendu: number;
}

export interface CollectResult {
  collecte: number;
  statut: CellStatut;
  runId: string;
  enrichEnqueued: number;
}

/** WHERE des entreprises prospectables d'une cellule (RGPD : opt-out + non-diffusible exclus). */
export function prospectableWhere(cell: CellToCollect): Prisma.ProspectionCompanyWhereInput {
  return {
    departement: cell.departement,
    naf: cell.naf,
    taille: cell.taille,
    statutDiffusion: "diffusible",
    etatAdministratif: "actif",
    optOut: false,
  };
}

export async function collectCell(
  db: CollectDb,
  cell: CellToCollect,
  opts: {
    enrichirContacts: boolean;
    toleranceRatio?: number;
    now?: () => Date;
    enqueueEnrich?: (companyId: string) => Promise<void>;
    maxEnrichPerCell?: number;
  },
): Promise<CollectResult> {
  const now = opts.now ?? (() => new Date());
  const run = await db.prospectionCollectRun.create({
    data: { cell: { connect: { id: cell.id } }, startedAt: now(), status: "running" },
  });

  const where = prospectableWhere(cell);
  const collecte = await db.prospectionCompany.count({ where });
  const statut = decideCellOutcome(collecte, cell.attendu, opts.toleranceRatio ?? 0);

  let enrichEnqueued = 0;
  if (opts.enrichirContacts && opts.enqueueEnrich) {
    const pending = await db.prospectionCompany.findMany({
      where: { ...where, enrichmentStatus: "pending" },
      select: { id: true },
      take: opts.maxEnrichPerCell ?? 5000,
    });
    for (const c of pending) {
      await opts.enqueueEnrich(c.id);
      enrichEnqueued++;
    }
  }

  await db.prospectionCollectRun.update({
    where: { id: run.id },
    data: {
      finishedAt: now(),
      nbResultats: collecte,
      nbNouveaux: 0, // backbone déjà ingéré : la collecte ne crée pas de nouveaux
      nbDoublons: 0,
      status: statut === "fait" ? "done" : "error",
    },
  });

  await db.prospectionCoverageCell.update({
    where: { id: cell.id },
    data: {
      collecte,
      statut,
      lastError: statut === "erreur" ? `collecte ${collecte} < attendu ${cell.attendu}` : null,
      errorCode: statut === "erreur" ? "EXHAUSTIVITE" : null,
    },
  });

  return { collecte, statut, runId: run.id, enrichEnqueued };
}
