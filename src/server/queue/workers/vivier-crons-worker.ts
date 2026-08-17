/**
 * VIVIER CANDIDATS — passage quotidien J+30 (lot L4, plan §2.3).
 *
 * Un seul travail : intégrer au vivier CRM les candidatures dont la fenêtre
 * d'opposition de 30 jours est ÉCHUE et qui n'ont pas fait l'objet d'une
 * opposition. Rien d'autre — l'envoi des emails d'information est une campagne
 * déclenchée à la main (drapeau `VIVIER_STOCK_ENABLED`), pas un automatisme.
 *
 * ── Pourquoi une file séparée de `crm-sync` ─────────────────────────────────
 * `crm-sync` transporte des ÉVÉNEMENTS (« ceci vient d'arriver »). Ce passage-ci
 * applique une RÈGLE DE TEMPS (« ce délai est écoulé »). Les mêler ferait
 * dépendre l'horloge RGPD de la santé de la file de synchro, et rendrait
 * illisible le tableau de bord des deux.
 *
 * ── Inertie ────────────────────────────────────────────────────────────────
 * `integrateVivierStock()` lit la base, mais n'écrit vers le CRM qu'à travers
 * l'outbox, qui REFUSE tout flux `vivier` tant que `CRM_SYNC_CANDIDATES_ENABLED`
 * est à OFF. Et tant que personne n'a été informé, `vivierInfoSentAt` est NULL
 * partout : la requête ne remonte rien. Le worker tourne donc à vide, sans un
 * seul appel réseau.
 *
 * 🔴 La fenêtre de 30 jours n'est PAS un paramètre de ce worker. Elle vit dans
 * `VIVIER_OPPOSITION_WINDOW_DAYS` et ne se règle pas depuis une file de jobs :
 * une donnée de conformité ne doit pas pouvoir être changée par un payload.
 */

import { Worker, type Job } from "bullmq";

import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
import type { VivierCronJobData, VivierCronJobType } from "@/server/queue/types";

export const VIVIER_CRONS_QUEUE_NAME = "vivier-crons";

export type { VivierCronJobData, VivierCronJobType };

async function processJob(_job: Job<VivierCronJobData>): Promise<void> {
  // 🔴 Import PARESSEUX, et non en tête de fichier. `server/vivier/stock`
  // dépend de `queues.ts` (pour mettre les emails en file), et `queues.ts` est
  // importé par toute Server Action : un import statique ici recréerait un
  // CYCLE et alourdirait de ~2 s le chargement de modules totalement
  // étrangers au vivier — ce qui a réellement fait échouer un test sans
  // rapport (`api/calendly/client-event`, budget 5 s) pendant ce lot.
  // Chargé à l'exécution du job, ce coût n'existe que dans le worker.
  const { integrateVivierStock } = await import("@/server/vivier/stock");
  const report = await integrateVivierStock();

  // Doctrine de log (leçon IndexNow) : on ne journalise QUE ce qui s'est passé.
  // Un « rien à faire » quotidien noierait les logs sans jamais rien apprendre —
  // mais dès qu'il y a du travail dû, le compte rendu est explicite.
  if (report.due > 0) {
    console.warn(
      `[vivier-crons] ${report.integrated}/${report.due} candidature(s) intégrée(s) au vivier, ${report.skipped} écartée(s)`,
    );
  }
}

let workerInstance: Worker<VivierCronJobData> | null = null;

export function startVivierCronsWorker(): Worker<VivierCronJobData> {
  if (workerInstance) return workerInstance;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL not set — vivier-crons-worker cannot start");

  workerInstance = new Worker<VivierCronJobData>(VIVIER_CRONS_QUEUE_NAME, processJob, {
    connection: { url: redisUrl },
    // concurrency 1 : deux passages simultanés reprendraient les mêmes lignes
    // dues. Le CRM est idempotent (`event_id`), donc aucun doublon en base —
    // mais deux fois le trafic, et des compteurs faux.
    concurrency: 1,
    lockDuration: 120_000,
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 100 },
  });

  workerInstance.on("failed", (job, err) => {
    console.error(`[vivier-crons-worker] job ${job?.id} failed:`, err);
    captureWorkerError("vivier-crons", VIVIER_CRONS_QUEUE_NAME, job, err);
  });

  return workerInstance;
}

export async function stopVivierCronsWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
}
