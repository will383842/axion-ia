/**
 * Worker BullMQ — le robot « pilotage SEO » (P4). File `seo-pilotage`, charge `{ tache, tick }`.
 *
 * ÉTEINT PAR DÉFAUT : sans `CONTENT_PILOTAGE_SEO="true"` exact, une tâche rend « saute » AVANT
 * toute lecture de base et tout appel réseau (aucun appel Google, aucune écriture).
 *
 * Fenêtre app/worker (AGENTS.md, « DEUX conteneurs ») : le worker peut tourner AVANT que la
 * migration de P2 soit passée. Une table ou colonne absente (P2021 / P2022) fait SAUTER la tâche,
 * sans échec : elle sera rejouée au créneau suivant.
 *
 * Une `tache` inconnue est journalisée et IGNORÉE — l'inverse du défaut de `content-refresh`
 * (AUDIT § 5 bis-4) : une app plus récente peut poser une tâche que ce worker ne connaît pas
 * encore, elle ne doit rien exécuter par défaut.
 *
 * Tâches : `ingestion-gsc` (06 h 37, Paris), `rattrapage-gsc` (un jour d'historique par passage),
 * `purge` (dimanche), `inspection` (07 h, rotation d'inspection d'URL sous quota partagé). Des NOMBRES seulement dans les journaux : jamais une requête de recherche,
 * jamais un nom.
 *
 * Marqueur de déploiement (`grep` dans le conteneur du worker) : `seo-pilotage-worker`.
 */
import { Worker, type Job } from "bullmq";

import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
import type { SeoPilotageJobData } from "@/server/queue/types";
import {
  buildStub,
  estTableAbsente,
  lireModePilotage,
  pilotageSeoActif,
} from "@/server/seo-pilotage/interrupteur";

export const SEO_PILOTAGE_QUEUE_NAME = "seo-pilotage";

export const TACHES_SEO_PILOTAGE = [
  "ingestion-gsc",
  "rattrapage-gsc",
  "purge",
  "inspection",
] as const;
export type TacheSeoPilotage = (typeof TACHES_SEO_PILOTAGE)[number];

export type IssueJob =
  | { readonly issue: "ignoree" }
  | { readonly issue: "saute"; readonly motif: string }
  | { readonly issue: "fait"; readonly tache: TacheSeoPilotage };

function estTacheConnue(t: unknown): t is TacheSeoPilotage {
  return (TACHES_SEO_PILOTAGE as ReadonlyArray<unknown>).includes(t);
}

export async function runSeoPilotageJob(
  job: Pick<Job<SeoPilotageJobData>, "data">,
): Promise<IssueJob> {
  const tache: unknown = job.data?.tache;
  if (!estTacheConnue(tache)) {
    // Jamais de valeur brute dans le journal (longueur bornée, caractères non imprimables retirés).
    const vue = String(tache)
      .replace(/[^\w.-]/g, "?")
      .slice(0, 40);
    console.warn(`[seo-pilotage-worker] tâche inconnue ignorée : ${vue}`);
    return { issue: "ignoree" };
  }
  if (!pilotageSeoActif()) return { issue: "saute", motif: "interrupteur_eteint" };
  if (buildStub()) {
    console.log("[seo-pilotage-worker] build stub : saut.");
    return { issue: "saute", motif: "stub" };
  }

  try {
    // Imports paresseux : Prisma n'est chargé qu'une fois l'interrupteur vérifié.
    const [{ prisma }, ingestion] = await Promise.all([
      import("@/lib/prisma"),
      import("@/server/seo-pilotage/ingestion"),
    ]);
    const mode = await lireModePilotage(prisma);
    if (tache === "inspection") {
      const [{ redis }, { tacheInspection }] = await Promise.all([
        import("@/lib/redis"),
        import("@/server/seo-pilotage/inspection/tache"),
      ]);
      const b = await tacheInspection({ prisma, redis });
      // Des nombres seulement : jamais un chemin, jamais une URL.
      const journal = b.arret === "fini" ? console.log : console.warn;
      journal(
        `[seo-pilotage-worker] inspection (${mode}) : ${b.inspectees} page(s) inspectée(s), ` +
          `${b.ecrites} ligne(s) écrite(s), ${b.inchangees} inchangée(s), ${b.echecs} échec(s), arrêt ${b.arret}`,
      );
      return { issue: "fait", tache };
    }
    if (tache === "purge") {
      const b = await ingestion.tachePurge({ prisma });
      console.warn(
        `[seo-pilotage-worker] purge (${mode}) : ${b.semainesCumulees} semaine(s) cumulée(s), ` +
          `${b.semainesEnAttente} en attente, ${b.joursSupprimes} ligne(s) de jour supprimée(s), ` +
          `${b.semainesSupprimees} ligne(s) de semaine supprimée(s), ${b.requetesRetirees} requête(s) retirée(s)`,
      );
      return { issue: "fait", tache };
    }
    const r =
      tache === "ingestion-gsc"
        ? await ingestion.tacheIngestionGsc({ prisma })
        : await ingestion.tacheRattrapageGsc({ prisma });
    if (r.issue === "saute") {
      console.log(`[seo-pilotage-worker] ${tache} sauté : ${r.motif}`);
      return { issue: "saute", motif: r.motif };
    }
    if (r.issue === "termine") {
      console.log(`[seo-pilotage-worker] ${tache} : ${r.motif}`);
      return { issue: "fait", tache };
    }
    const j = r.jour;
    // Un échec de collecte est journalisé en ERREUR (visible), sans faire échouer le job : l'état
    // vit en base et le jour est repris au passage suivant.
    const journal = j.issue === "echec" || j.issue === "abandonne" ? console.error : console.warn;
    journal(
      j.issue === "reussi"
        ? `[seo-pilotage-worker] ${tache} (${mode}) ${j.jour} : ${j.pages} page(s), ${j.requetes} requête(s), ` +
            `${j.requetesFiltrees} filtrée(s), ${j.pagesIsolees} isolée(s), écart total ${j.ecartTotal ?? "inconnu"}`
        : `[seo-pilotage-worker] ${tache} ${j.jour} : ${j.issue}${j.issue === "echec" ? ` (${j.code})` : ""}`,
    );
    return { issue: "fait", tache };
  } catch (err) {
    if (estTableAbsente(err)) {
      console.warn(
        `[seo-pilotage-worker] ${tache} sauté : tables du pilotage absentes (migration P2 pas encore passée).`,
      );
      return { issue: "saute", motif: "tables_absentes" };
    }
    throw err;
  }
}

let workerInstance: Worker<SeoPilotageJobData> | null = null;

export function startSeoPilotageWorker(): Worker<SeoPilotageJobData> {
  if (workerInstance) return workerInstance;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL not set — seo-pilotage-worker cannot start");

  workerInstance = new Worker<SeoPilotageJobData>(SEO_PILOTAGE_QUEUE_NAME, runSeoPilotageJob, {
    connection: { url: redisUrl },
    // Un seul passage à la fois : l'ingestion et le rattrapage ne se chevauchent jamais.
    concurrency: 1,
    lockDuration: 600_000,
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 100 },
  });
  workerInstance.on("failed", (job, err) => {
    console.error(`[seo-pilotage-worker] job ${job?.id} failed: ${err.name}`);
    captureWorkerError("seo-pilotage", SEO_PILOTAGE_QUEUE_NAME, job, err);
  });
  return workerInstance;
}
