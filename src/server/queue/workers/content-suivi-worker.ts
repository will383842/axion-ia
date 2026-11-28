/**
 * Worker BullMQ — suivi des résultats des contenus publiés (chaîne éditoriale, C12).
 * File `chaine-suivi`, charge `{ tache, tick }`. ÉTEINT PAR DÉFAUT : sans `CONTENT_CHAINE_SUIVI="true"`
 * exact, la tâche sort AVANT toute lecture de base.
 *
 * Fenêtre app/worker (AGENTS.md, « DEUX conteneurs ») : une table absente (P2021) fait SAUTER la
 * tâche sans échec ; une `tache` inconnue est journalisée et IGNORÉE (jamais exécutée par défaut).
 * Des NOMBRES seulement dans les journaux.
 *
 * Marqueur de déploiement (`grep` dans le conteneur du worker) : `content-suivi-worker`.
 */
import { Worker, type Job } from "bullmq";

import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
import type { ChaineSuiviJobData } from "@/server/queue/types";
import { buildStub, estTableAbsente } from "@/server/seo-pilotage/interrupteur";
import { suiviResultatsActif } from "@/server/content-gen/suivi/interrupteur";

export const CHAINE_SUIVI_QUEUE_NAME = "chaine-suivi";
export const TACHES_CHAINE_SUIVI = ["suivi-resultats"] as const;

export type IssueSuivi =
  | { readonly issue: "ignoree" }
  | { readonly issue: "saute"; readonly motif: string }
  | { readonly issue: "fait"; readonly contenus: number; readonly ecrites: number };

export async function runChaineSuiviJob(
  job: Pick<Job<ChaineSuiviJobData>, "data">,
): Promise<IssueSuivi> {
  const tache: unknown = job.data?.tache;
  if (!(TACHES_CHAINE_SUIVI as ReadonlyArray<unknown>).includes(tache)) {
    const vue = String(tache)
      .replace(/[^\w.-]/g, "?")
      .slice(0, 40);
    console.warn(`[content-suivi-worker] tâche inconnue ignorée : ${vue}`);
    return { issue: "ignoree" };
  }
  if (!suiviResultatsActif()) return { issue: "saute", motif: "interrupteur_eteint" };
  if (buildStub()) return { issue: "saute", motif: "stub" };
  try {
    const [{ prisma }, { tacheSuiviResultats }] = await Promise.all([
      import("@/lib/prisma"),
      import("@/server/content-gen/suivi/tache"),
    ]);
    const b = await tacheSuiviResultats({ prisma });
    console.log(
      `[content-suivi-worker] suivi-resultats : ${b.contenus} contenu(s), ${b.ecrites} ligne(s) écrite(s), ${b.dejaEcrites} déjà écrite(s)`,
    );
    return { issue: "fait", contenus: b.contenus, ecrites: b.ecrites };
  } catch (err) {
    if (estTableAbsente(err)) {
      console.warn("[content-suivi-worker] sauté : table absente (migration pas encore passée).");
      return { issue: "saute", motif: "tables_absentes" };
    }
    throw err;
  }
}

let workerInstance: Worker<ChaineSuiviJobData> | null = null;

export function startChaineSuiviWorker(): Worker<ChaineSuiviJobData> {
  if (workerInstance) return workerInstance;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL not set — content-suivi-worker cannot start");
  workerInstance = new Worker<ChaineSuiviJobData>(CHAINE_SUIVI_QUEUE_NAME, runChaineSuiviJob, {
    connection: { url: redisUrl },
    concurrency: 1,
    lockDuration: 300_000,
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 100 },
  });
  workerInstance.on("failed", (job, err) => {
    console.error(`[content-suivi-worker] job ${job?.id} failed: ${err.name}`);
    captureWorkerError("chaine-suivi", CHAINE_SUIVI_QUEUE_NAME, job, err);
  });
  return workerInstance;
}
