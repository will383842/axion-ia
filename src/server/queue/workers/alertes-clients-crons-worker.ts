/**
 * ALERTES CLIENTS — passage planifié (2026-11-15) : le RÉCAP QUOTIDIEN de 7 h 30 (Paris).
 *
 * Le passage lit la veille et enfile l'e-mail (`server/alertes-clients/recap.ts`). Un seul envoi par
 * jour : le jobId de l'e-mail porte le jour. Si l'envoi échoue, le passage LÈVE (BullMQ le range en
 * « échec » et Sentry le voit) : un récap manquant ne doit jamais passer pour une journée calme.
 *
 * `rattraperRecapSiManque` : BullMQ ne rejoue pas un répétable manqué. Si le conteneur était arrêté à
 * 7 h 30 (déploiement, redémarrage), le worker, à son démarrage, envoie le récap du jour s'il est
 * passé 7 h 30 — le jobId empêche tout doublon si le passage de 7 h 30 avait bien eu lieu.
 */

import { Worker, type Job } from "bullmq";

import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
import type { AlertesClientsCronJobData } from "@/server/queue/types";

export const ALERTES_CLIENTS_CRONS_QUEUE_NAME = "alertes-clients-crons";

export type { AlertesClientsCronJobData };

/** Import PARESSEUX : le passage tire Prisma et le hub de notifications, inutiles à l'importeur. */
async function passerRecap(maintenant: Date): Promise<void> {
  const { envoyerRecapVeille } = await import("@/server/alertes-clients/recap");
  const r = await envoyerRecapVeille(maintenant);
  if (r === "failed") throw new Error("récap quotidien des demandes de clients non parti");
}

async function processJob(_job: Job<AlertesClientsCronJobData>): Promise<void> {
  await passerRecap(new Date());
}

/**
 * Rattrape le récap du jour si le conteneur était arrêté à 7 h 30. Ne lève jamais : un échec est
 * tracé (le passage le fait déjà) et le démarrage du worker continue. Renvoie ce qui s'est passé,
 * pour le test.
 */
export async function rattraperRecapSiManque(
  maintenant: Date = new Date(),
): Promise<"trop-tot" | "tente" | "echec"> {
  // TOUT le corps est dans le `try` : appelée par `void` au démarrage du worker, elle ne doit
  // jamais laisser un rejet non géré (import, calcul de l'heure, passage).
  try {
    const { heureMinuteParis } = await import("@/server/alertes-clients/bornes-paris");
    const { heure, minute } = heureMinuteParis(maintenant);
    if (heure < 7 || (heure === 7 && minute < 30)) return "trop-tot";
    await passerRecap(maintenant);
    return "tente";
  } catch (e) {
    console.error("[alertes-clients-crons] rattrapage du récap :", (e as Error).message);
    return "echec";
  }
}

/**
 * Sentry n'est prévenu qu'au DERNIER essai : sinon un même échec remonte une fois par essai (3 essais
 * × le message déjà tracé par le récap). Portée limitée à cette file.
 */
export function estDernierEssai(job: Pick<Job, "attemptsMade" | "opts"> | undefined): boolean {
  if (!job) return true;
  return job.attemptsMade >= (job.opts?.attempts ?? 1);
}

let workerInstance: Worker<AlertesClientsCronJobData> | null = null;

export function startAlertesClientsCronsWorker(): Worker<AlertesClientsCronJobData> {
  if (workerInstance) return workerInstance;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL not set — alertes-clients-crons-worker cannot start");

  workerInstance = new Worker<AlertesClientsCronJobData>(
    ALERTES_CLIENTS_CRONS_QUEUE_NAME,
    processJob,
    {
      connection: { url: redisUrl },
      concurrency: 1,
      lockDuration: 120_000,
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 100 },
    },
  );

  workerInstance.on("failed", (job, err) => {
    console.error(`[alertes-clients-crons-worker] job ${job?.id} failed:`, err);
    if (!estDernierEssai(job)) return;
    captureWorkerError("alertes-clients-crons", ALERTES_CLIENTS_CRONS_QUEUE_NAME, job, err);
  });

  return workerInstance;
}

export async function stopAlertesClientsCronsWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
}
