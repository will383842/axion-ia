/**
 * Relais de la file de sortie vers Axion Partners — worker BullMQ (INT-T02).
 *
 * Un seul type de job, `relayer`, répété chaque minute : numéroter ce qui a été validé, envoyer ce
 * qui est dû (`src/server/partners-sync/relais.ts`). Le rejeu n'est PAS confié à BullMQ
 * (`attempts: 1`) : il vit dans la file elle-même (`attempts`, `next_attempt_at`), qui survit à une
 * purge de Redis et se lit en base.
 *
 * Pas d'envoi « immédiat » après l'écriture : l'événement est écrit DANS la transaction métier, et
 * un job posé avant le commit chercherait une ligne encore invisible. La minute de latence est le
 * prix de l'exactitude.
 *
 * INERTE PAR DÉFAUT, et à trois niveaux :
 *   · `worker.ts` ne démarre ce worker, ni ne programme son job, que si `PARTNERS_SYNC_ENABLED`
 *     vaut `true` — drapeau fermé, aucun travail de fond n'existe ;
 *   · `startPartnersSyncWorker` et `programmerRelaisPartners` refusent de s'exécuter canal fermé ;
 *   · chaque passage du relais recommence par le verrou (le drapeau peut tomber entre deux).
 * Importer ce module n'exécute rien.
 */
import { Queue, Worker } from "bullmq";

import { canalPartnersOuvert } from "@/server/partners-sync/config";
import { relayer } from "@/server/partners-sync/relais";
import { getBullConnectionOrThrow } from "@/server/queue/connection";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";

export const PARTNERS_SYNC_QUEUE_NAME = "partners-sync";
const JOB_ID_REPETE = "partners-sync-relais-cron";
const CADENCE = "* * * * *";

export type PartnersSyncJobData = { readonly type: "relayer" };

let workerInstance: Worker<PartnersSyncJobData> | null = null;

export function startPartnersSyncWorker(): Worker<PartnersSyncJobData> {
  if (!canalPartnersOuvert()) {
    throw new Error(
      "[partners-sync] canal fermé : le worker ne démarre pas (PARTNERS_SYNC_ENABLED).",
    );
  }
  if (workerInstance) return workerInstance;

  workerInstance = new Worker<PartnersSyncJobData>(
    PARTNERS_SYNC_QUEUE_NAME,
    async () => {
      const bilan = await relayer();
      // On ne journalise que ce qui s'est passé : 1 440 « rien à faire » par jour ne diraient rien.
      if (bilan.numerotees + bilan.envoyees + bilan.abandonnees > 0) {
        console.warn(
          `[partners-sync] relais : ${bilan.numerotees} numérotée(s), ${bilan.envoyees} envoyée(s), ` +
            `${bilan.abandonnees} abandon(s)`,
        );
      }
    },
    {
      connection: getBullConnectionOrThrow(),
      // Un seul passage à la fois dans ce processus ; entre processus, le verrou consultatif
      // sérialise la numérotation et l'`event_id` dédoublonne côté Partners.
      concurrency: 1,
      lockDuration: 120_000,
    },
  );

  workerInstance.on("failed", (job, err) => {
    console.error(`[partners-sync-worker] job ${job?.id} failed:`, err);
    captureWorkerError("partners-sync", PARTNERS_SYNC_QUEUE_NAME, job, err);
  });

  return workerInstance;
}

/** Programme le passage répété du relais. Canal fermé : ne fait rien, ne crée pas même la file. */
export async function programmerRelaisPartners(): Promise<void> {
  if (!canalPartnersOuvert()) return;
  const file = new Queue<PartnersSyncJobData>(PARTNERS_SYNC_QUEUE_NAME, {
    connection: getBullConnectionOrThrow(),
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: { age: 24 * 3600, count: 200 },
      removeOnFail: { age: 7 * 24 * 3600, count: 500 },
    },
  });
  try {
    await file.add(
      "relayer",
      { type: "relayer" },
      { repeat: { pattern: CADENCE }, jobId: JOB_ID_REPETE },
    );
  } finally {
    await file.close();
  }
}
