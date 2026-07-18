/**
 * Content Generator — resynchronisation des compteurs de campagne (fix 2026-07-18).
 *
 * Bug corrigé : `CoverageCampaign.failedCount` / `publishedCount` n'étaient
 * écrits par PERSONNE (seul `generatedCount` est incrémenté, à l'enqueue, par
 * l'orchestrateur). La console affichait donc « échecs : 0, publiés : 0 » sur
 * toutes les campagnes — mesuré en prod le 2026-07-17 : la campagne running
 * affichait 0/0 pour 890 échecs et 63 publiés réels.
 *
 * Choix de conception : RECALCUL idempotent (un `groupBy` sur les jobs) plutôt
 * que des incréments aux transitions de statut. Les incréments seraient
 * dispersés dans 4+ workers (gen, publish, quality-improver, deadline-checker),
 * fragiles aux retries BullMQ (double-incrément) et incapables de rattraper
 * l'historique. Le recalcul est auto-réparant et remet à niveau les campagnes
 * existantes dès le premier tick. Coût : 2 requêtes par tick (15 min) + 1 write
 * par campagne UNIQUEMENT si dérive constatée.
 *
 * Appelé par l'orchestrateur en tête de tick, AVANT l'early-return « no running
 * campaigns » — pour corriger aussi les campagnes paused/completed. Fail-open
 * côté appelant : une erreur ici ne doit jamais bloquer l'orchestration.
 */

import { prisma } from "@/lib/prisma";

export interface CounterDrift {
  readonly campaignId: string;
  readonly failedCount: number;
  readonly publishedCount: number;
}

/**
 * Calcule les compteurs réels par campagne depuis l'agrégat des jobs et ne
 * retourne QUE les campagnes en dérive (valeur stockée ≠ valeur réelle).
 * Pure vis-à-vis de l'écriture — testable sans mock d'update.
 */
export async function computeCounterDrifts(): Promise<ReadonlyArray<CounterDrift>> {
  const [byStatus, campaigns] = await Promise.all([
    prisma.contentGenJob.groupBy({
      by: ["campaignId", "status"],
      where: { campaignId: { not: null } },
      _count: { _all: true },
    }),
    prisma.coverageCampaign.findMany({
      where: { archivedAt: null },
      select: { id: true, failedCount: true, publishedCount: true },
    }),
  ]);

  const agg = new Map<string, { failed: number; published: number }>();
  for (const row of byStatus) {
    if (!row.campaignId) continue;
    const entry = agg.get(row.campaignId) ?? { failed: 0, published: 0 };
    if (row.status === "failed") entry.failed = row._count._all;
    if (row.status === "published") entry.published = row._count._all;
    agg.set(row.campaignId, entry);
  }

  const drifts: CounterDrift[] = [];
  for (const c of campaigns) {
    const real = agg.get(c.id) ?? { failed: 0, published: 0 };
    if (c.failedCount !== real.failed || c.publishedCount !== real.published) {
      drifts.push({ campaignId: c.id, failedCount: real.failed, publishedCount: real.published });
    }
  }
  return drifts;
}

/**
 * Resynchronise les compteurs des campagnes en dérive. Retourne le nombre de
 * campagnes corrigées (0 en régime nominal — aucun write inutile).
 */
export async function syncCampaignCounters(): Promise<number> {
  const drifts = await computeCounterDrifts();
  for (const d of drifts) {
    await prisma.coverageCampaign.update({
      where: { id: d.campaignId },
      data: { failedCount: d.failedCount, publishedCount: d.publishedCount },
    });
  }
  return drifts.length;
}
