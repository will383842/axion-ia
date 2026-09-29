/**
 * LE WORKER DU CIRCUIT VISIO (file `visio`, CONCURRENCE 1) — chantier visio, PR 6.
 *
 * Deux sortes de jobs :
 *   · `etape` — charge `{ v: 1, rencontreId, etape }` et RIEN d'autre : jamais
 *     une parole, un nom, un texte dans `job.data` (Redis, Sentry, journaux).
 *     Le worker retrouve en base l'étape due de cette rencontre et l'exécute
 *     (`executerEtape`) ; l'état fait foi en base, la file n'est qu'un réveil ;
 *   · `balayage` — toutes les 5 minutes (`balayerCircuit`) : entrées dans le
 *     circuit, verrous expirés, purges de l'audio, reprise après plafond,
 *     étapes dues mises en file.
 *
 * Concurrence 1 : la transcription consomme ≈ 7 000 jetons par tranche et le
 * palier 1 du compte en accorde 10 000 par minute ; et le worker n'a qu'1 Go.
 *
 * SIGTERM : l'étape en cours s'arrête à la prochaine tranche et repasse
 * `a_faire` SANS compter d'essai (`InterruptionArret`).
 *
 * Aucun `server-only`, aucune action serveur, rien de Next atteignable
 * (`aucun-module-du-worker-nimporte-server-only.spec.ts`).
 */

import { Queue, Worker, type Job } from "bullmq";

import { captureWorkerError } from "@/server/queue/lib/sentry-worker";

export const VISIO_QUEUE_NAME = "visio";
export const PATTERN_BALAYAGE_VISIO = "*/5 * * * *";

export interface VisioJobData {
  readonly v: 1;
  readonly rencontreId?: string;
  readonly etape?: string;
}

let file: Queue<VisioJobData> | null = null;

/** La file, créée au premier usage (jamais à l'import). `null` si BullMQ est coupé. */
export async function obtenirFileVisio(): Promise<Queue<VisioJobData> | null> {
  if (file) return file;
  const { getBullConnection } = await import("@/server/queue/connection");
  const connection = getBullConnection();
  if (!connection) return null;
  file = new Queue<VisioJobData>(VISIO_QUEUE_NAME, {
    connection,
    defaultJobOptions: { attempts: 1, removeOnComplete: true, removeOnFail: { count: 200 } },
  });
  return file;
}

/** Met en file les étapes dues (dédupliquées par rencontre et étape). */
export async function mettreEnFile(
  dues: ReadonlyArray<{ readonly rencontreId: string; readonly etape: string }>,
): Promise<number> {
  const q = await obtenirFileVisio();
  if (!q || dues.length === 0) return 0;
  for (const d of dues) {
    await q.add(
      "etape",
      { v: 1, rencontreId: d.rencontreId, etape: d.etape },
      { jobId: `visio-${d.rencontreId}-${d.etape}` },
    );
  }
  return dues.length;
}

async function traiter(job: Job<VisioJobData>): Promise<void> {
  const [{ depsReelles }, { balayerCircuit }, { executerEtape }, { prisma }] = await Promise.all([
    import("@/server/visio/circuit"),
    import("@/server/visio/balayage-circuit"),
    import("@/server/visio/etapes"),
    import("@/lib/prisma"),
  ]);
  const deps = await depsReelles();
  if (job.name === "balayage") {
    const b = await balayerCircuit(prisma, deps);
    await mettreEnFile(b.dues);
    if (
      b.entrees + b.purgesProgrammees + b.verrousLiberes + b.audiosEnRetard + b.reprisesPlafond >
      0
    ) {
      // Des nombres seulement : jamais une parole ni un nom.
      console.warn(
        `[visio-worker] balayage : ${b.entrees} entrée(s), ${b.purgesProgrammees} purge(s), ` +
          `${b.verrousLiberes} verrou(s) libéré(s), ${b.audiosEnRetard} audio(s) en retard, ` +
          `${b.reprisesPlafond} reprise(s) après plafond, ${b.dues.length} étape(s) due(s)`,
      );
    }
    return;
  }
  const { rencontreId, etape } = job.data;
  if (job.data.v !== 1 || !rencontreId || !etape) return;
  const dues = await balayerCircuit(prisma, deps, rencontreId);
  for (const d of dues.dues.filter((x) => x.etape === etape)) {
    const issue = await executerEtape(deps, d.id);
    if (issue === "reussie") {
      const suite = await balayerCircuit(prisma, deps, rencontreId);
      await mettreEnFile(suite.dues);
    }
  }
}

let instance: Worker<VisioJobData> | null = null;

export function startVisioWorker(): Worker<VisioJobData> {
  if (instance) return instance;
  const redisUrl = process.env["REDIS_URL"];
  if (!redisUrl) throw new Error("REDIS_URL not set — visio-worker cannot start");
  instance = new Worker<VisioJobData>(VISIO_QUEUE_NAME, traiter, {
    connection: { url: redisUrl },
    concurrency: 1,
    lockDuration: 120_000,
  });
  instance.on("failed", (job, err) => {
    console.error(`[visio-worker] job ${job?.id} failed: ${err.name}`);
    captureWorkerError("visio", VISIO_QUEUE_NAME, job, err);
  });
  process.once("SIGTERM", () => {
    void import("@/server/visio/circuit").then((m) => m.demanderArretDuCircuit());
  });
  void programmerBalayageVisio();
  return instance;
}

/** Le balayage répété (5 min), posé au démarrage du worker. */
export async function programmerBalayageVisio(): Promise<void> {
  const q = await obtenirFileVisio();
  if (!q) return;
  for (const existant of await q.getRepeatableJobs()) {
    if (existant.name === "balayage" && existant.pattern !== PATTERN_BALAYAGE_VISIO) {
      await q.removeRepeatableByKey(existant.key);
    }
  }
  await q.add(
    "balayage",
    { v: 1 },
    { repeat: { pattern: PATTERN_BALAYAGE_VISIO }, jobId: "visio-balayage-cron" },
  );
}
