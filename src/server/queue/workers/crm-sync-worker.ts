/**
 * Synchronisation sortante vers Axion CRM Pro — worker BullMQ (lot L2).
 *
 * DEUX PASSES, DEUX RÔLES
 * -----------------------
 *  · `emit`  — une ligne d'outbox précise, enfilée juste après l'écriture
 *              métier. C'est la FRAÎCHEUR : le CRM voit le lead en quelques
 *              secondes.
 *  · `sweep` — toutes les 10 minutes, reprend les lignes `pending`/`failed`
 *              dont l'heure de nouvelle tentative est venue. C'est la
 *              GARANTIE : si Redis a été purgé, si le worker était à terre, si
 *              le CRM était injoignable, c'est ce passage qui rattrape.
 *
 * 🔴 La leçon IndexNow s'applique ici mot pour mot : un job vert qui ne relaie
 * rien est le pire des états. Le balayage journalise donc ce qu'il a
 * RÉELLEMENT émis, et le retard du plus vieux `pending` — pas un « OK ».
 *
 * INERTE PAR DÉFAUT
 * -----------------
 * Sans `CRM_SYNC_ENABLED=true`, aucune ligne d'outbox n'existe (rien n'en écrit)
 * et l'émission sort immédiatement. Le worker tourne alors à vide, sans un seul
 * appel réseau ni une seule requête inutile.
 */

import { Worker, type Job } from "bullmq";

import { prisma } from "@/lib/prisma";
import { isCrmSyncEnabled } from "@/server/crm-sync/config";
import { emitOutboxRow } from "@/server/crm-sync/emit";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";

export const CRM_SYNC_QUEUE_NAME = "crm-sync";

export type CrmSyncJobType = "emit" | "sweep";

export interface CrmSyncJobData {
  readonly type?: CrmSyncJobType;
  /** Renseigné pour un job `emit`. */
  readonly outboxId?: string;
}

/** Plafond par passage : le CRM tourne sur un CPX22, on ne le mitraille pas. */
const SWEEP_BATCH = 50;

export async function sweepCrmSyncOutbox(): Promise<{
  emitted: number;
  sent: number;
  oldestPendingMinutes: number | null;
}> {
  if (!isCrmSyncEnabled()) return { emitted: 0, sent: 0, oldestPendingMinutes: null };

  const due = await prisma.crmSyncOutbox.findMany({
    where: {
      status: { in: ["pending", "failed"] },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }],
    },
    orderBy: { createdAt: "asc" },
    take: SWEEP_BATCH,
    select: { id: true },
  });

  let sent = 0;
  for (const row of due) {
    const result = await emitOutboxRow(row.id);
    if (result.status === "sent") sent += 1;
  }

  const oldest = await prisma.crmSyncOutbox.findFirst({
    where: { status: { in: ["pending", "failed"] } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });

  return {
    emitted: due.length,
    sent,
    oldestPendingMinutes: oldest
      ? Math.round((Date.now() - oldest.createdAt.getTime()) / 60_000)
      : null,
  };
}

async function processJob(job: Job<CrmSyncJobData>): Promise<void> {
  if (!isCrmSyncEnabled()) return;

  if (job.data.type === "sweep" || !job.data.outboxId) {
    const res = await sweepCrmSyncOutbox();
    // On ne journalise QUE ce qui s'est passé : un « rien à faire » toutes les
    // 10 minutes noierait les logs (144 lignes/jour) sans jamais rien apprendre.
    if (res.emitted > 0) {
      console.warn(
        `[crm-sync] balayage : ${res.sent}/${res.emitted} émis, retard max ${res.oldestPendingMinutes ?? 0} min`,
      );
    }
    return;
  }

  const result = await emitOutboxRow(job.data.outboxId);
  if (result.status === "gave_up") {
    console.error(
      `[crm-sync] abandon définitif de ${job.data.outboxId} (HTTP ${result.httpStatus ?? "?"}) : ${result.error ?? ""}`,
    );
  }
}

let workerInstance: Worker<CrmSyncJobData> | null = null;

export function startCrmSyncWorker(): Worker<CrmSyncJobData> {
  if (workerInstance) return workerInstance;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL not set — crm-sync-worker cannot start");

  workerInstance = new Worker<CrmSyncJobData>(CRM_SYNC_QUEUE_NAME, processJob, {
    connection: { url: redisUrl },
    // concurrency 1 : deux passages simultanés reprendraient les mêmes lignes
    // « dues » et enverraient l'événement deux fois. Le CRM est idempotent
    // (`event_id`), donc aucun doublon en base — mais deux fois le trafic et
    // des compteurs faux, pour rien.
    concurrency: 1,
    lockDuration: 120_000,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
  });

  workerInstance.on("failed", (job, err) => {
    console.error(`[crm-sync-worker] job ${job?.id} failed:`, err);
    captureWorkerError("crm-sync", CRM_SYNC_QUEUE_NAME, job, err);
  });

  return workerInstance;
}

export async function stopCrmSyncWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
}
