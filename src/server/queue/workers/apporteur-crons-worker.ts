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
 *     Le même passage ARCHIVE (2026-10-07) les apporteurs dont le contrat est
 *     contresigné ou l'issue « Non retenu » enregistrée, sur 7 jours glissants
 *     (`features/commercial-application/archivage-auto-apporteurs.ts`) ; les
 *     fiches plus anciennes relèvent du rattrapage manuel
 *     (`pnpm rattrapage:archivage-apporteurs`).
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

// Lié au type : ajouter un `ApporteurCronJobType` sans l'ajouter ici casse `pnpm typecheck`
// (le Record est exhaustif), au lieu de laisser le NOUVEAU worker ignorer son propre job.
const NOMS_PAR_TYPE: Record<ApporteurCronJobType, true> = {
  "relance-invitation": true,
  "reponses-entrantes": true,
  "invitation-auto": true,
  "reseau-quotidien": true,
  "reseau-facturation": true,
  "releve-mensuel": true,
};
export const NOMS_CONNUS = Object.keys(NOMS_PAR_TYPE) as readonly ApporteurCronJobType[];

async function processJob(job: Job<ApporteurCronJobData>): Promise<void> {
  // 🔑 Aiguillage par le NOM du job (celui que `bootRepeatableJobs` pose),
  // repli sur `data.type`. Un job sans nom connu est journalisé et ignoré (voir plus bas) :
  // il ne retombe plus sur les rappels d'invitation.
  const est = (nom: string): boolean => job.name === nom || job.data?.type === nom;
  // Un nom inconnu est journalisé et IGNORÉ : il retombait sur les rappels d'invitation,
  // arrêtés le 26/10 (lot 0 du relevé mensuel : un ancien worker ne doit rien lancer
  // d'un nom qu'il ne connaît pas).
  if (!NOMS_CONNUS.some(est)) {
    console.warn(`[apporteur-crons] job au nom inconnu ignoré : « ${String(job.name)} »`);
    return;
  }
  const type = est("invitation-auto")
    ? "invitation-auto"
    : est("reponses-entrantes")
      ? "reponses-entrantes"
      : "relance-invitation";
  if (job.name === "reseau-facturation" || job.data?.type === "reseau-facturation") {
    await passerFacturation();
    return;
  }
  if (est("releve-mensuel")) {
    await passerReleves();
    return;
  }
  if (job.name === "reseau-quotidien" || job.data?.type === "reseau-quotidien") {
    await passerReseau();
    return;
  }
  if (type === "invitation-auto") {
    await passerInvitations();
    await passerArchivage(job);
    await passerSurveillance(job);
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

/** Fenêtre du passage automatique : le rattrapage manuel couvre l'avant. */
const FENETRE_ARCHIVAGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Range les apporteurs arrivés au bout (contresigné, non retenu). Une panne ici
 * ne fait PAS échouer le passage des invitations : elle se rapporte, et le
 * passage suivant (5 minutes) réessaie — l'écriture est idempotente.
 */
async function passerArchivage(job: Job<ApporteurCronJobData>): Promise<void> {
  try {
    const { archiverApporteursTermines } =
      await import("@/features/commercial-application/archivage-auto-apporteurs");
    const r = await archiverApporteursTermines({
      appliquer: true,
      depuis: new Date(Date.now() - FENETRE_ARCHIVAGE_MS),
    });
    if (r.archivees > 0) {
      console.warn(
        `[apporteur-crons] archivage automatique : ${r.archivees} fiche(s) archivée(s) ` +
          `(contrats contresignés : ${r.personnesContresignees}, non retenus : ${r.personnesNonRetenues})`,
      );
    }
    if (r.desarchivees > 0) {
      console.warn(
        `[apporteur-crons] archivage automatique : ${r.desarchivees} fiche(s) rouverte(s) ` +
          `(« Non retenu » corrigé en « Retenu »)`,
      );
    }
  } catch (err) {
    console.error("[apporteur-crons] archivage automatique en échec :", err);
    captureWorkerError("apporteur-crons", APPORTEUR_CRONS_QUEUE_NAME, job, err);
  }
}

async function noterReussite(nom: "reseau-quotidien" | "reseau-facturation"): Promise<void> {
  try {
    const { noterPassageReussi } =
      await import("@/features/apporteurs-reseau/surveillance-passages");
    await noterPassageReussi(nom);
  } catch (err) {
    console.error("[apporteur-crons] horodatage du passage en échec :", err);
  }
}

/**
 * Contrôle de fraîcheur des passages d'argent (#2464 pt 5), au rythme de `invitation-auto`
 * (5 min). Se tait si tout est à jour ; sinon alerte INTERNE, une fois par jour. Ne fait jamais
 * échouer le passage des invitations.
 */
async function passerSurveillance(job: Job<ApporteurCronJobData>): Promise<void> {
  try {
    const { verifierPassages } = await import("@/features/apporteurs-reseau/surveillance-passages");
    const signales = await verifierPassages();
    if (signales.length > 0) {
      console.warn(`[apporteur-crons] passage(s) en retard signalé(s) : ${signales.join(", ")}`);
    }
  } catch (err) {
    console.error("[apporteur-crons] surveillance des passages en échec :", err);
    captureWorkerError("apporteur-crons", APPORTEUR_CRONS_QUEUE_NAME, job, err);
  }
}

async function passerReseau(): Promise<void> {
  const { passerReseauApporteurs } = await import("@/features/apporteurs-reseau/passage-quotidien");
  const r = await passerReseauApporteurs();
  const { erreurs, ...faits } = r;
  // #2464 pt 5 : seul un passage SANS étape en erreur compte comme réussi.
  if (erreurs === 0) await noterReussite("reseau-quotidien");
  if (Object.values(faits).some((n) => n > 0) || erreurs > 0) {
    console.warn(`[apporteur-crons] réseau quotidien : ${JSON.stringify(r)}`);
  }
}

async function passerFacturation(): Promise<void> {
  const { passerFacturationApporteurs } =
    await import("@/features/apporteurs-reseau/passage-quotidien");
  const r = await passerFacturationApporteurs();
  const { erreurs, ...faits } = r;
  if (erreurs === 0) await noterReussite("reseau-facturation");
  if (Object.values(faits).some((n) => n > 0) || erreurs > 0) {
    console.warn(`[apporteur-crons] réseau facturation : ${JSON.stringify(r)}`);
  }
}

/** Relevé mensuel : PRÉPARE les relevés du mois précédent et alerte en interne ; n'envoie rien. */
async function passerReleves(): Promise<void> {
  const { passerReleveMensuel } =
    await import("@/features/apporteurs-reseau/releve-mensuel/passage-mensuel");
  const r = await passerReleveMensuel();
  if (r.statut === "ok" && (r.crees > 0 || r.echecs > 0 || r.alerte)) {
    console.warn(`[apporteur-crons] relevé mensuel : ${JSON.stringify(r)}`);
  }
}

async function passerReponses(): Promise<void> {
  const { passerReponsesEntrantes } =
    await import("@/features/commercial-application/reponses-entrantes-apporteur");
  // R6 : une réponse par e-mail arrête les relances d'attente. Injecté ici : le
  // relevé reste hors de Next (la file d'e-mails tire `next-auth`), le worker,
  // lui, charge déjà ce module pour l'archivage automatique.
  const { annulerRelancesLeadApporteur } =
    await import("@/features/commercial-application/relances-lead-apporteur");
  const r = await passerReponsesEntrantes({ annulerRelances: annulerRelancesLeadApporteur });
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
