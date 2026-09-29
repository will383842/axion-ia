/**
 * Worker BullMQ — le BALAYAGE du dossier client, toutes les 5 minutes
 * (chantier visio, PR 4 ; `src/server/visio/balayage.ts`).
 *
 * Démarré SEULEMENT si `DOSSIER_BALAYAGE_ENABLED === "true"` sur le worker
 * (`src/server/queue/worker.ts`) : il n'est allumé qu'APRÈS le lancement réel
 * de la reprise de l'historique Calendly (sinon l'historique arriverait en
 * rafale « à classer »). La borne du balayage est la date de son premier
 * passage.
 *
 * `concurrency: 1` : deux passages simultanés assureraient deux fois la même
 * rencontre (l'unicité `calendly_event_id` en refuserait une, mais le
 * passage lèverait pour rien).
 *
 * Aucune parole, aucun nom dans les journaux (PA-12) : des nombres.
 *
 * Marqueur de déploiement (vérification après mise en ligne, `grep` dans le
 * conteneur du worker) : `visio-balayage-worker`.
 */

import { Worker, type Job } from "bullmq";

import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
import type { VisioBalayageJobData } from "@/server/queue/types";

export const VISIO_BALAYAGE_QUEUE_NAME = "visio-balayage";

/** Le drapeau qui allume le balayage (lu à l'exécution, jamais figé au build). */
export function balayageActive(): boolean {
  return process.env.DOSSIER_BALAYAGE_ENABLED === "true";
}

async function processJob(_job: Job<VisioBalayageJobData>): Promise<void> {
  if (!balayageActive()) return;
  // Imports PARESSEUX : ces modules tirent Prisma ; ils ne sont chargés que
  // dans le worker, au premier passage.
  const [{ prisma }, { notify }, { passerBalayage }] = await Promise.all([
    import("@/lib/prisma"),
    import("@/server/notifications"),
    import("@/server/visio/balayage"),
  ]);
  const r = await passerBalayage(prisma, {
    notifier: notify,
    drapeauBrut: process.env.DOSSIER_BALAYAGE_ENABLED,
  });
  if (r.etapesEnEchec.length > 0 || r.rencontresAssurees > 0 || r.f1 > 0) {
    console.warn(
      `[visio-balayage-worker] ${r.rencontresAssurees} rencontre(s) assurée(s), ` +
        `${r.f1} rendez-vous sans compte rendu, ${r.comptesRendusAValider} compte(s) rendu(s) ` +
        `à valider depuis 3 j, ${r.suitesEchues} suite(s) échue(s)` +
        (r.etapesEnEchec.length > 0 ? ` — étapes en échec : ${r.etapesEnEchec.join(", ")}` : ""),
    );
  }
}

let workerInstance: Worker<VisioBalayageJobData> | null = null;

export function startVisioBalayageWorker(): Worker<VisioBalayageJobData> {
  if (workerInstance) return workerInstance;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL not set — visio-balayage-worker cannot start");

  workerInstance = new Worker<VisioBalayageJobData>(VISIO_BALAYAGE_QUEUE_NAME, processJob, {
    connection: { url: redisUrl },
    concurrency: 1,
    lockDuration: 120_000,
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 100 },
  });

  workerInstance.on("failed", (job, err) => {
    console.error(`[visio-balayage-worker] job ${job?.id} failed:`, err);
    captureWorkerError("visio-balayage", VISIO_BALAYAGE_QUEUE_NAME, job, err);
  });

  return workerInstance;
}
