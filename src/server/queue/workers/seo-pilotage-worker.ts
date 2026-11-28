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
 * Tâches : `ingestion-gsc` (06 h 37, Paris), `rattrapage-gsc` (jusqu'à 30 jours d'historique par passage),
 * `purge` (dimanche), `recalcul` (P6a, 07 h 07 : champs existants depuis l'historique, sans appel
 * Google), `inspection` (07 h, rotation d'inspection d'URL sous quota partagé), `robots-ia` (P10 :
 * passages des robots d'IA, agrégats Cloudflare ; sans jeton Cloudflare la tâche saute, « indisponible »).
 * Des NOMBRES seulement dans les journaux : jamais une requête de recherche,
 * jamais un nom.
 *
 * ⚠️ `inspection` est longue (jusqu'à 1 400 appels espacés d'au moins 200 ms, soit 30 à 40 min) ; avec
 * `concurrency: 1`, les rattrapages de :07, :27 et :47 attendent derrière elle. Sans conséquence :
 * le rattrapage reprend au passage suivant.
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
  "recalcul",
  "inspection",
  "robots-ia",
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
    const [{ prisma }, ingestion, recalcul, geo] = await Promise.all([
      import("@/lib/prisma"),
      import("@/server/seo-pilotage/ingestion"),
      import("@/server/seo-pilotage/recalcul"),
      import("@/server/seo-pilotage/geo"),
    ]);
    const mode = await lireModePilotage(prisma);
    if (tache === "recalcul") {
      const r = await recalcul.tacheRecalcul({ prisma });
      console.warn(
        r.issue === "saute"
          ? `[seo-pilotage-worker] recalcul (${mode}) sauté : ${r.motif}`
          : `[seo-pilotage-worker] recalcul (${mode}) : ${r.routesMisesAJour} route(s), ${r.motsCles} mot(s)-clé(s)`,
      );
      return r.issue === "saute" ? { issue: "saute", motif: r.motif } : { issue: "fait", tache };
    }
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
    if (tache === "robots-ia") {
      const b = await geo.tacheRobotsIa({ prisma });
      // Les motifs sont des phrases fixes, sans secret. Un saut anormal (jeton sans droit, erreur
      // Cloudflare) est un avertissement ; « pas de jeton » est l'état normal, en simple journal.
      if (b.issue === "saute") {
        (b.anormal ? console.warn : console.log)(
          `[seo-pilotage-worker] robots-ia sauté : ${b.motif}`,
        );
      } else {
        console.log(
          `[seo-pilotage-worker] robots-ia (${mode}) : ${b.lignes} ligne(s) d'agrégat, ${b.incomplets} jour(s) tronqué(s) laissé(s) tel(s)`,
        );
      }
      return b.issue === "saute" ? { issue: "saute", motif: b.motif } : { issue: "fait", tache };
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
    if (r.issue === "lot") {
      // Rattrapage : jusqu'à JOURS_PAR_PASSAGE jours. Des nombres et des codes seulement.
      const n = (k: string) => r.jours.filter((x) => x.issue === k).length;
      const echecs = r.jours.filter((x) => x.issue === "echec");
      const ligne =
        `[seo-pilotage-worker] ${tache} (${mode}) : ${r.jours.length} jour(s) traité(s), ` +
        `${n("reussi")} réussi(s), ${n("occupe") + n("abandonne") + n("deja")} ignoré(s), ` +
        `${echecs.length} échec(s)${echecs[0]?.issue === "echec" ? ` (${echecs[0].code})` : ""}, arrêt ${r.arret}`;
      (echecs.length > 0 ? console.error : console.warn)(ligne);
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
        `[seo-pilotage-worker] ${tache} sauté : table du pilotage absente (migration pas encore passée).`,
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
