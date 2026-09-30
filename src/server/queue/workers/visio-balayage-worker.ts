/**
 * Worker BullMQ — le BALAYAGE du dossier client, toutes les 5 minutes
 * (chantier visio, PR 4 ; `src/server/visio/balayage.ts`).
 *
 * Démarré TOUJOURS (V1, F1) : il porte aussi le seul appel périodique de
 * l'ENREGISTREUR (clôture d'office, purges, témoin de clé, alertes jeton), qui
 * ne doit jamais dépendre d'un drapeau du dossier client. Seul le balayage du
 * DOSSIER CLIENT (`passerBalayage`) reste sous `DOSSIER_BALAYAGE_ENABLED ===
 * "true"` : il n'est allumé qu'APRÈS le lancement réel de la reprise de
 * l'historique Calendly (sinon l'historique arriverait en rafale « à
 * classer »). La borne du balayage est la date de son premier passage.
 * Garde : `drapeau-eteint-un-enregistrement-muet-est-cloture-et-date.spec.ts`.
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

type ModuleEnregistreur = typeof import("@/server/visio/balayage-enregistreur");
type BaseEnregistreur = Parameters<ModuleEnregistreur["balayerEnregistreur"]>[0];

export const VISIO_BALAYAGE_QUEUE_NAME = "visio-balayage";

/** Le drapeau qui allume le balayage (lu à l'exécution, jamais figé au build). */
export function balayageActive(): boolean {
  return process.env.DOSSIER_BALAYAGE_ENABLED === "true";
}

async function processJob(_job: Job<VisioBalayageJobData>): Promise<void> {
  // Imports PARESSEUX : ces modules tirent Prisma ; ils ne sont chargés que
  // dans le worker, au premier passage.
  const [{ prisma }, enregistreur] = await Promise.all([
    import("@/lib/prisma"),
    import("@/server/visio/balayage-enregistreur"),
  ]);
  if (balayageActive()) await passerDossierClient(prisma);
  // TOUJOURS, drapeau éteint compris, et même si le dossier client a levé.
  await passerEnregistreur(prisma, enregistreur);
}

type BaseDossier = Parameters<typeof import("@/server/visio/balayage")["passerBalayage"]>[0];

/**
 * Le dossier client (PR 4), dans son propre `try` (V1, F6) : une panne hors
 * de ses étapes (lecture de la borne) ne saute plus l'enregistreur.
 */
async function passerDossierClient(prisma: BaseDossier): Promise<void> {
  try {
    const [{ notify }, { passerBalayage }] = await Promise.all([
      import("@/server/notifications"),
      import("@/server/visio/balayage"),
    ]);
    const r = await passerBalayage(prisma, {
      notifier: notify,
      drapeauBrut: process.env.DOSSIER_BALAYAGE_ENABLED,
    });
    if (r.etapesEnEchec.length > 0 || r.rencontresAssurees > 0) {
      console.warn(
        `[visio-balayage-worker] ${r.rencontresAssurees} rencontre(s) assurée(s), ` +
          `${r.comptesRendusAValider} compte(s) rendu(s) ` +
          `à valider depuis 3 j, ${r.suitesEchues} suite(s) échue(s)` +
          (r.etapesEnEchec.length > 0 ? ` — étapes en échec : ${r.etapesEnEchec.join(", ")}` : ""),
      );
    }
  } catch (err) {
    console.error(
      "[visio-balayage-worker] dossier client en échec :",
      err instanceof Error ? err.name : "inconnue",
    );
    captureWorkerError("visio-balayage", VISIO_BALAYAGE_QUEUE_NAME, undefined, err);
  }
}

/**
 * L'enregistreur (PR 5) : clôture d'office, reprise des purges de refus,
 * témoin de clé, alertes jeton J-14 / J-3 et extension silencieuse.
 * Après le dossier client, dans son propre `try` : une panne de l'un
 * n'arrête pas l'autre (garde `une-panne-de-borne-n-empeche-pas-l-enregistreur.spec.ts`). Garde : `le-worker-de-balayage-appelle-l-enregistreur.spec.ts`.
 */
async function passerEnregistreur(prisma: BaseEnregistreur, m: ModuleEnregistreur): Promise<void> {
  try {
    const b = await m.balayerEnregistreur(prisma, m.notifierParTelegram, {
      maintenant: new Date(),
      version: process.env.BUILD_SHA ?? "inconnue",
    });
    if (b.alertes > 0 || !b.temoinOk) {
      console.warn(
        `[visio-balayage-worker] enregistreur : ${b.alertes} alerte(s) envoyée(s), ` +
          `témoin de clé ${b.temoinOk ? "lu" : "en échec"}`,
      );
    }
  } catch (err) {
    console.error(
      "[visio-balayage-worker] enregistreur en échec :",
      err instanceof Error ? err.name : "inconnue",
    );
    captureWorkerError("visio-balayage", VISIO_BALAYAGE_QUEUE_NAME, undefined, err);
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
