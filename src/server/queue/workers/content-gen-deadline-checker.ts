/**
 * Sprint Campaign Controls (§ 25.2 v1.8 2026-05-22) — C.3
 *
 * Deadline checker worker — Cron 5 0 * * * (00:05 UTC daily).
 *
 * Scanne les campagnes running/scheduled avec endDate <= NOW() et les
 * passe en `completed + completedAt = NOW() + completedReason = 'deadline_reached'`.
 *
 * Si la campagne a un recurringSchedule, retire le repeatable BullMQ job.
 * Log SOC2 CAMPAIGN_AUTO_STOPPED_DEADLINE.
 *
 * ⚠️ CE WORKER TOURNE HORS DE NEXT (`tsx src/server/queue/worker.ts`).
 *
 * 🔴 Il journalisait par `logActivity`, une Server Action qui lit `headers()`
 * dans le même `try` que son écriture : hors requête, `headers()` lève, le
 * `catch` best-effort avale, et AUCUNE ligne n'était écrite. Depuis le
 * 2026-09-16 il écrit par `ecrireJournalActivite` — ni directive, ni requête —
 * en se déclarant `acteurSysteme`, donc `adminUserId: null`. Garde d'import :
 * `__tests__/content-gen-deadline-checker.graphe-worker.spec.ts`.
 */

import { Queue, Worker } from "bullmq";
import { prisma } from "@/lib/prisma";
import {
  acteurSysteme,
  ecrireJournalActivite,
} from "@/server/content-gen/shared/activity-log-writer";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";

const QUEUE_NAME = "content-gen-deadline-checker";

let contentGenQueue: Queue | null = null;
function getContentGenQueue(): Queue | null {
  if (contentGenQueue) return contentGenQueue;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;
  contentGenQueue = new Queue("content-gen", { connection: { url: redisUrl } });
  return contentGenQueue;
}

async function processJob(): Promise<void> {
  const now = new Date();

  // Scanne campagnes running ou scheduled avec endDate dépassée
  const toStop = await prisma.coverageCampaign.findMany({
    where: {
      status: { in: ["running", "scheduled"] },
      endDate: { lte: now },
    },
    select: { id: true, name: true, recurringSchedule: true },
  });

  if (toStop.length === 0) {
    return;
  }

  for (const campaign of toStop) {
    // 1. Passer la campagne en completed
    await prisma.coverageCampaign.update({
      where: { id: campaign.id },
      data: {
        status: "completed",
        completedAt: now,
        completedReason: "deadline_reached",
      },
    });

    // 2. Purger les jobs queued BullMQ (best-effort)
    const queuedJobs = await prisma.contentGenJob.findMany({
      where: { campaignId: campaign.id, status: "queued" },
      select: { id: true },
      take: 5000,
    });
    if (queuedJobs.length > 0) {
      // Update DB status
      await prisma.contentGenJob.updateMany({
        where: { id: { in: queuedJobs.map((j) => j.id) } },
        data: {
          status: "cancelled",
          errorMessage: `Campagne ${campaign.id} auto-stoppée (deadline_reached)`,
          completedAt: now,
        },
      });
      // Purge BullMQ
      const queue = getContentGenQueue();
      if (queue) {
        for (const job of queuedJobs) {
          try {
            const bullJob = await queue.getJob(`gen-${job.id}`);
            if (bullJob) {
              const state = await bullJob.getState();
              if (state === "waiting" || state === "delayed" || state === "prioritized") {
                await bullJob.remove();
              }
            }
          } catch {
            // best-effort
          }
        }
      }
    }

    // 3. Retirer le repeatable BullMQ job si recurringSchedule défini
    if (campaign.recurringSchedule) {
      const queue = getContentGenQueue();
      if (queue) {
        try {
          await queue.removeRepeatable(`campaign-${campaign.id}-recurring`, {
            pattern: campaign.recurringSchedule,
            tz: "Europe/Paris",
          });
        } catch (err) {
          console.warn(
            `[deadline-checker] failed to remove repeatable for campaign ${campaign.id}:`,
            err,
          );
        }
      }
    }

    // 4. Log SOC2. 🔑 `adminUserId: null` — personne n'est derrière cet acte, et
    //    `ActivityLog.adminUserId` est un `@db.Uuid` lié à `AdminUser` : la chaîne
    //    `"system:deadline-checker"` qui y figurait avant le 2026-09-16 aurait fait
    //    lever le `create` de toute façon. L'auteur se lit dans `changes.origine`.
    await ecrireJournalActivite(acteurSysteme("content-gen-deadline-checker"), {
      action: "content-gen.campaign.auto-stopped",
      targetType: "CoverageCampaign",
      targetId: campaign.id,
      changes: {
        soc2: "CAMPAIGN_AUTO_STOPPED_DEADLINE",
        completedReason: "deadline_reached",
        queuedJobsCancelled: queuedJobs.length,
      },
    });

    console.log(
      `[content-gen-deadline-checker] campaign=${campaign.id} (${campaign.name}) deadline_reached → completed`,
    );
  }

  console.log(`[content-gen-deadline-checker] auto-stopped ${toStop.length} campaign(s)`);
}

let workerInstance: Worker | null = null;

export function startContentDeadlineCheckerWorker(): Worker {
  if (workerInstance) return workerInstance;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL not set — content-gen-deadline-checker cannot start");
  workerInstance = new Worker(QUEUE_NAME, processJob, {
    connection: { url: redisUrl },
    concurrency: 1,
    lockDuration: 120_000,
  });
  workerInstance.on("failed", (job, err) => {
    console.error(`[content-gen-deadline-checker] job ${job?.id} failed:`, err);
    captureWorkerError("content-gen-deadline-checker", QUEUE_NAME, job, err);
  });
  return workerInstance;
}

export async function stopContentDeadlineCheckerWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
  if (contentGenQueue) {
    await contentGenQueue.close();
    contentGenQueue = null;
  }
}
