/**
 * Prospection — Orchestrateur de campagne (T4).
 *
 * Détend la campagne en `CoverageCell` (paresseuses, via `StockReference`),
 * upsert les cellules (dédup clé unique), met à jour `cellulesTotal`, et enfile
 * la collecte des cellules `a_faire`/`erreur` UNIQUEMENT (reprise-sur-panne :
 * jamais de re-collecte d'une cellule `fait`). Idempotence : jobId à nonce
 * d'attempt (via `enqueueCollect`) → pas de no-op BullMQ.
 */

import type { Prisma } from "../../../../prisma/generated/client";
import { cellsFromStockRefs, type CampaignTargeting, type StockRefRow } from "./campaign-expansion";

export interface OrchestratorDb {
  prospectionStockReference: {
    findMany(args: { where: Prisma.ProspectionStockReferenceWhereInput }): Promise<StockRefRow[]>;
  };
  prospectionCoverageCell: {
    upsert(args: Prisma.ProspectionCoverageCellUpsertArgs): Promise<{ id: string; statut: string }>;
  };
  prospectionCampaign: {
    update(args: Prisma.ProspectionCampaignUpdateArgs): Promise<unknown>;
  };
}

export interface OrchestrateResult {
  cellsTotal: number;
  cellsEnqueued: number;
}

export async function orchestrateCampaign(
  db: OrchestratorDb,
  campaign: { id: string } & CampaignTargeting,
  opts: {
    enqueueCollect: (cellId: string, runId: string) => Promise<void>;
    genRunId: () => string;
    quotaMax?: number;
  },
): Promise<OrchestrateResult> {
  // Garde-fou : un ciblage vide (aucun secteur NI code NAF) collecterait tout le
  // département — footgun. On exige un ciblage explicite (le wizard T6 le valide aussi).
  if (campaign.secteurs.length === 0 && campaign.nafCodes.length === 0) {
    throw new Error(
      `Campagne ${campaign.id} : ciblage vide (aucun secteur ni code NAF) — refusé pour éviter la collecte d'un département entier.`,
    );
  }
  if (campaign.departements.length === 0 || campaign.tailles.length === 0) {
    throw new Error(`Campagne ${campaign.id} : départements ou tailles manquants.`);
  }

  const refs = await db.prospectionStockReference.findMany({
    where: {
      departement: { in: campaign.departements },
      taille: { in: campaign.tailles },
    },
  });
  const specs = cellsFromStockRefs(campaign, refs);

  let cellsEnqueued = 0;
  let collectedQuota = 0;
  for (const spec of specs) {
    const cell = await db.prospectionCoverageCell.upsert({
      where: {
        campaignId_departement_naf_taille: {
          campaignId: campaign.id,
          departement: spec.departement,
          naf: spec.naf,
          taille: spec.taille,
        },
      },
      create: {
        campaign: { connect: { id: campaign.id } },
        departement: spec.departement,
        region: spec.region,
        naf: spec.naf,
        secteur: spec.secteur,
        taille: spec.taille,
        attendu: spec.attendu,
      },
      // Re-orchestration : on rafraîchit `attendu` (dénominateur peut bouger) mais
      // on ne réinitialise PAS le statut (une cellule `fait` reste `fait`).
      update: { attendu: spec.attendu, region: spec.region, secteur: spec.secteur },
    });

    // N'enfile QUE les cellules à faire / en erreur (reprise-sur-panne).
    if (cell.statut === "a_faire" || cell.statut === "erreur") {
      if (opts.quotaMax && opts.quotaMax > 0 && collectedQuota >= opts.quotaMax) break;
      await opts.enqueueCollect(cell.id, opts.genRunId());
      cellsEnqueued++;
      collectedQuota += spec.attendu;
    }
  }

  await db.prospectionCampaign.update({
    where: { id: campaign.id },
    data: { cellulesTotal: specs.length, statut: "active" },
  });

  return { cellsTotal: specs.length, cellsEnqueued };
}
