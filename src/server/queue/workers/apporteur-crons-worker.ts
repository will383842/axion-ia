/**
 * RÉSEAU D'APPORTEURS — passages planifiés (2026-09-27).
 *
 *   · `relance-invitation` (08:00 UTC) — rappels J+3 / J+7 de l'invitation à
 *     l'échange de 15 minutes, pour les personnes qui n'ont pas réservé
 *     (`features/commercial-application/relances-invitation-apporteur.ts`).
 *   · `reponses-entrantes` (toutes les 15 minutes, 2026-09-27) — relève dans
 *     la boîte Zoho Mail les réponses des candidats à leur invitation ; une
 *     réponse humaine arrête leurs rappels
 *     (`features/commercial-application/reponses-entrantes-apporteur.ts`).
 *   · `invitation-auto` (toutes les 5 minutes, 2026-09-28) — invite à
 *     l'échange de 15 minutes tout DOSSIER COMPLET d'apporteur (depuis le
 *     29/09 : plus le premier contact ni l'écran 1), et toute candidature à
 *     une offre commerciale, 15 minutes après sa réception
 *     (`features/commercial-application/invitation-auto.ts`).
 *   · `reseau-quotidien` (07:00 UTC, 2026-10-05) — démarrage manuel du réseau :
 *     confirmations réputées acquises, fins de protection, commissions,
 *     vigilance, « commande signée » (`features/apporteurs-reseau/passage-quotidien.ts`).
 *   · `reseau-facturation` (toutes les heures, minute 10 UTC, 2026-10-06) — seulement
 *     « commissions » et « autofacturation » : l'apporteur est facturé dès que sa commission est due.
 *
 * Doctrine de log : on ne journalise que ce qui s'est passé. Un passage qui ne
 * trouve rien à faire se tait ; un passage suspendu (lien de réservation absent)
 * le dit, parce que c'est une panne de configuration, pas une journée calme.
 */

import { Worker, type Job } from "bullmq";

import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
import type { ApporteurCronJobData, ApporteurCronJobType } from "@/server/queue/types";

export const APPORTEUR_CRONS_QUEUE_NAME = "apporteur-crons";

export type { ApporteurCronJobData, ApporteurCronJobType };

async function processJob(job: Job<ApporteurCronJobData>): Promise<void> {
  // 🔑 Aiguillage par le NOM du job (celui que `bootRepeatableJobs` pose),
  // repli sur `data.type`. Un job sans nom connu reste un passage des rappels :
  // c'est ce que faisait ce processeur avant qu'il ait deux passages.
  const type =
    job.name === "invitation-auto" || job.data?.type === "invitation-auto"
      ? "invitation-auto"
      : job.name === "reponses-entrantes" || job.data?.type === "reponses-entrantes"
        ? "reponses-entrantes"
        : "relance-invitation";
  if (job.name === "reseau-facturation" || job.data?.type === "reseau-facturation") {
    await passerFacturation();
    return;
  }
  if (job.name === "reseau-quotidien" || job.data?.type === "reseau-quotidien") {
    await passerReseau();
    return;
  }
  if (type === "invitation-auto") {
    await passerInvitations();
    return;
  }
  if (type === "reponses-entrantes") {
    await passerReponses();
    return;
  }
  // Import PARESSEUX : le passage tire `queues.ts`, importé par toute Server
  // Action — chargé à l'exécution, ce coût n'existe que dans le worker.
  const { passerRelancesInvitation } =
    await import("@/features/commercial-application/relances-invitation-apporteur");
  const r = await passerRelancesInvitation();
  if (r.suspendu) return; // déjà dit par le passage lui-même
  const parties = r.envoyees.j3 + r.envoyees.j7;
  if (parties > 0) {
    console.warn(
      `[apporteur-crons] rappels d'invitation : ${r.envoyees.j3} premier(s) rappel(s), ` +
        `${r.envoyees.j7} dernier(s) rappel(s), sur ${r.personnes} personne(s) invitée(s) ` +
        `dans la fenêtre — écartées : ${JSON.stringify(r.ecartees)}`,
    );
  }
}

async function passerInvitations(): Promise<void> {
  const { passerInvitationsAuto } =
    await import("@/features/commercial-application/invitation-auto");
  const r = await passerInvitationsAuto();
  if (r.suspendu) return; // déjà dit par le passage lui-même
  if (r.fichesCreees + r.envoyees + r.aReessayer > 0) {
    console.warn(
      `[apporteur-crons] invitation automatique : ${r.envoyees} invitation(s) envoyée(s), ` +
        `${r.fichesCreees} fiche(s) créée(s) depuis une candidature commerciale` +
        (r.aReessayer > 0 ? `, ${r.aReessayer} à reprendre au passage suivant` : "") +
        ` — écartées : ${JSON.stringify(r.ecartees)}`,
    );
  }
}

async function passerReseau(): Promise<void> {
  const { passerReseauApporteurs } = await import("@/features/apporteurs-reseau/passage-quotidien");
  const r = await passerReseauApporteurs();
  const { erreurs, ...faits } = r;
  if (Object.values(faits).some((n) => n > 0) || erreurs > 0) {
    console.warn(`[apporteur-crons] réseau quotidien : ${JSON.stringify(r)}`);
  }
}

async function passerFacturation(): Promise<void> {
  const { passerFacturationApporteurs } =
    await import("@/features/apporteurs-reseau/passage-quotidien");
  const r = await passerFacturationApporteurs();
  const { erreurs, ...faits } = r;
  if (Object.values(faits).some((n) => n > 0) || erreurs > 0) {
    console.warn(`[apporteur-crons] réseau facturation : ${JSON.stringify(r)}`);
  }
}

async function passerReponses(): Promise<void> {
  const { passerReponsesEntrantes } =
    await import("@/features/commercial-application/reponses-entrantes-apporteur");
  const r = await passerReponsesEntrantes();
  if (r.suspendu) return; // déjà dit par le passage lui-même (une fois, pour la config)
  const { humaines, automatiques } = r.enregistrees;
  if (humaines + automatiques > 0 || r.erreurs > 0) {
    console.warn(
      `[apporteur-crons] réponses entrantes : ${humaines} réponse(s) de candidat(s), ` +
        `${automatiques} réponse(s) automatique(s), sur ${r.lus} message(s) lu(s)` +
        (r.erreurs > 0 ? ` — ${r.erreurs} non enregistrée(s), reprises au passage suivant` : ""),
    );
  }
}

let workerInstance: Worker<ApporteurCronJobData> | null = null;

export function startApporteurCronsWorker(): Worker<ApporteurCronJobData> {
  if (workerInstance) return workerInstance;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL not set — apporteur-crons-worker cannot start");

  workerInstance = new Worker<ApporteurCronJobData>(APPORTEUR_CRONS_QUEUE_NAME, processJob, {
    connection: { url: redisUrl },
    // 1 : deux passages simultanés liraient le même état avant que l'un ait
    // écrit — le jobId déterministe éviterait le doublon d'envoi, pas le
    // double travail.
    concurrency: 1,
    lockDuration: 120_000,
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 100 },
  });

  workerInstance.on("failed", (job, err) => {
    console.error(`[apporteur-crons-worker] job ${job?.id} failed:`, err);
    captureWorkerError("apporteur-crons", APPORTEUR_CRONS_QUEUE_NAME, job, err);
  });

  return workerInstance;
}

export async function stopApporteurCronsWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
}
