// Worker BullMQ — Qualiopi Formation crons (T6 + T9).
//
// Queue unique `formation-crons` qui dispatche par `type`. Pattern miroir de
// `booking-crons-worker.ts` — 1 seule queue, handlers idempotents, fail-soft
// par entité.
//
// Jobs actifs (T6) :
//   - formation-crons.date-debut   : planifiee → en_cours quand dateDebut <= now
//   - formation-crons.cloture-auto : en_cours  → realisee quand dateFin + 24h <= now
//
// Jobs actifs (T9) :
//   - formation-crons.attestations-auto : scan sessions realisee → génère attestations
//                                         pour enrollments sans attestation (daily 09:00).
//
// Extension T15 (RAPPELS — hors T6) :
//   Rappels J-7/J-5 (convocation stagiaires), J+1 (satisfaction), J+30 (suivi)
//   sont des EMAILS. Ils seront câblés ici via de nouveaux types de job dans T15,
//   en utilisant le même dispatcher. Ajouter dans HANDLERS :
//     "formation-crons.rappel-j7"  : scan sessions planifiees J-7, enqueueEmail convocation
//     "formation-crons.rappel-satisfaction" : scan sessions realisees J+1, enqueueEmail satisfaction
//     "formation-crons.rappel-suivi"        : scan sessions realisees J+30, enqueueEmail suivi
//   Décision T6 : aucun stub ni mock — les handlers email seront réels à T15.

import { Worker } from "bullmq";
import { getBullConnectionOrThrow } from "../connection";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
import { prisma } from "@/lib/prisma";
import { assertSessionTransition } from "@/server/qualiopi/formations/state-machine";
import {
  decideSessionTransitions,
  type SessionCronSnapshot,
} from "@/server/qualiopi/formations/crons";
import { getFinancementValidations } from "@/server/qualiopi/financements/validation-service";
import { writeSessionTransition } from "@/server/qualiopi/formations/transition-helper";
import type { TrainingSessionStatut } from "@/server/qualiopi/formations/types";
import type { Prisma } from "../../../../prisma/generated/client";
import { genererAttestationPourEnrollment } from "@/server/qualiopi/evaluations/attestation-service";
import { invalidateIndicateursCache } from "@/server/qualiopi/indicateurs/service";
import {
  envoyerConvocation,
  envoyerRappelJ7,
  envoyerSatisfactionJ1,
  envoyerSuiviJ30,
} from "@/server/qualiopi/notifications/notifications-service";
import { synchroniserAlertes } from "@/server/qualiopi/alertes/alertes-service";

// ─────────────────────────────────────────────────────────────────────────────
// Types job
// ─────────────────────────────────────────────────────────────────────────────

export type FormationCronJobType =
  | "formation-crons.date-debut"
  | "formation-crons.cloture-auto"
  | "formation-crons.attestations-auto"
  // T15 — rappels lifecycle email
  | "formation-crons.rappel-j7"
  | "formation-crons.satisfaction-j1"
  | "formation-crons.suivi-j30"
  // T15 AGENT A — moteur d'alertes système (daily 07:00)
  | "formation-crons.alertes"
  // T17 CLUSTER 3 — convocation réglementaire J-5 (off.9)
  | "formation-crons.convocation-j5";

export interface FormationCronJobData {
  type: FormationCronJobType;
  tick: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper interne : écriture d'une FormationTransition + update statut (cron)
// Réutilise writeSessionTransition du helper partagé (formations/transition-helper.ts).
// ─────────────────────────────────────────────────────────────────────────────

async function applyTransitionInTx(
  tx: Prisma.TransactionClient,
  input: {
    sessionId: string;
    from: TrainingSessionStatut;
    to: TrainingSessionStatut;
    trigger: string;
  },
): Promise<void> {
  await writeSessionTransition(tx, {
    sessionId: input.sessionId,
    from: input.from,
    to: input.to,
    trigger: input.trigger,
    triggeredBy: "cron",
  });
  await tx.trainingSession.update({
    where: { id: input.sessionId },
    data: { statut: input.to },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Daily 08:00 UTC — planifiee → en_cours quand dateDebut <= now.
 *
 * Scan toutes les sessions `planifiee` dont dateDebut est passée. Pour chacune,
 * applique la transition en_cours dans une transaction idempotente.
 * Fail-soft par session : une erreur sur une session ne bloque pas les autres.
 */
async function handleDateDebut(): Promise<void> {
  const now = new Date();

  // Scan uniquement les sessions planifiees dont dateDebut est dépassée.
  const candidates = await prisma.trainingSession.findMany({
    where: {
      statut: "planifiee",
      dateDebut: { lte: now },
    },
    select: { id: true, statut: true, dateDebut: true, dateFin: true },
  });

  // Utilise la fonction pure pour la décision (testable en isolation).
  const snapshots: SessionCronSnapshot[] = candidates.map((s) => ({
    id: s.id,
    statut: s.statut as TrainingSessionStatut,
    dateDebut: s.dateDebut,
    dateFin: s.dateFin,
  }));
  const decisions = decideSessionTransitions(snapshots, now).filter((d) => d.to === "en_cours");

  let applied = 0;
  for (const decision of decisions) {
    try {
      // Garde financement : ne pas passer en_cours si des validations critiques existent.
      // Fail-soft : en cas d'erreur de lecture, on skippe (pas de transition silencieuse).
      let financementEntries: Awaited<ReturnType<typeof getFinancementValidations>> = [];
      try {
        financementEntries = await getFinancementValidations(decision.sessionId);
      } catch (fetchErr) {
        console.error(
          `[formation-crons] date-debut: impossible de vérifier le financement session ${decision.sessionId}, skip:`,
          fetchErr instanceof Error ? fetchErr.message : String(fetchErr),
        );
        continue;
      }
      const critiques = financementEntries.filter(
        (e) => e.result.ok === false && e.result.gravite === "critique",
      );
      if (critiques.length > 0) {
        const messages = critiques.map((e) => e.result.alerte ?? e.code).join(" | ");
        console.warn(
          `[formation-crons] date-debut: session ${decision.sessionId} maintenue planifiee — alerte(s) financement critique(s) : ${messages}`,
        );
        continue;
      }

      // assertSessionTransition lève si la machine d'états l'interdit.
      assertSessionTransition(decision.from, decision.to);

      await prisma.$transaction(async (tx) => {
        await applyTransitionInTx(tx, {
          sessionId: decision.sessionId,
          from: decision.from,
          to: decision.to,
          trigger: "cron.date_debut",
        });
      });
      applied++;
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === "P2002") {
        // @@unique [sessionId, toStatus, trigger] → déjà appliqué, idempotent ok.
        applied++;
        continue;
      }
      // Fail-soft : log et continue les autres sessions.
      console.error(
        `[formation-crons] date-debut: erreur session ${decision.sessionId}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  console.log(
    `[formation-crons] date-debut: ${applied}/${decisions.length} transition(s) planifiee→en_cours (${candidates.length} candidats scannés)`,
  );
}

/**
 * Daily 08:00 UTC — en_cours → realisee quand dateFin + 24h <= now (auto-clôture).
 *
 * Scan toutes les sessions `en_cours` dont dateFin + 24h est passée. Pour chacune,
 * applique la transition realisee dans une transaction idempotente.
 * Fail-soft par session.
 */
async function handleClotureAuto(): Promise<void> {
  const now = new Date();
  // Calcule le seuil : dateFin <= now - 24h
  const threshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const candidates = await prisma.trainingSession.findMany({
    where: {
      statut: "en_cours",
      dateFin: { lte: threshold },
    },
    select: { id: true, statut: true, dateDebut: true, dateFin: true },
  });

  const snapshots: SessionCronSnapshot[] = candidates.map((s) => ({
    id: s.id,
    statut: s.statut as TrainingSessionStatut,
    dateDebut: s.dateDebut,
    dateFin: s.dateFin,
  }));
  const decisions = decideSessionTransitions(snapshots, now).filter((d) => d.to === "realisee");

  let applied = 0;
  let skippedSansEmargement = 0;
  for (const decision of decisions) {
    try {
      assertSessionTransition(decision.from, decision.to);

      // Garde émargement (conformité ind.12 / R.6313-3) : ne JAMAIS clôturer
      // automatiquement une session « réalisée » sans aucune trace de présence.
      // Une session sans émargement reste `en_cours` et sera signalée par l'alerte
      // R03 pour traitement manuel — au lieu d'alimenter BPF/certificats/attestations
      // avec une session non prouvée. (Symétrie avec la garde manuelle sessions.ts.)
      const totalInscrits = await prisma.enrollment.count({
        where: { sessionId: decision.sessionId },
      });
      if (totalInscrits > 0) {
        const avecEmargement = await prisma.enrollment.count({
          where: {
            sessionId: decision.sessionId,
            OR: [{ emargementSigneAt: { not: null } }, { tauxPresencePct: { not: null } }],
          },
        });
        if (avecEmargement === 0) {
          skippedSansEmargement++;
          continue;
        }
      }

      await prisma.$transaction(async (tx) => {
        await applyTransitionInTx(tx, {
          sessionId: decision.sessionId,
          from: decision.from,
          to: decision.to,
          trigger: "cron.cloture_auto_j24h",
        });
      });
      applied++;
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === "P2002") {
        applied++;
        continue;
      }
      console.error(
        `[formation-crons] cloture-auto: erreur session ${decision.sessionId}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  console.log(
    `[formation-crons] cloture-auto: ${applied}/${decisions.length} transition(s) en_cours→realisee (${candidates.length} candidats scannés, ${skippedSansEmargement} ignorée(s) sans émargement)`,
  );

  // Invalide le cache indicateurs pour chaque année touchée (best-effort, fail-soft).
  // Les sessions clôturées alimentent les indicateurs Qualiopi — le cache doit être
  // purgé pour que le prochain accès recalcule avec les données à jour.
  if (applied > 0) {
    const anneesTouches = new Set(
      decisions
        .filter((d) => d.to === "realisee")
        .map((d) => {
          const candidate = candidates.find((c) => c.id === d.sessionId);
          return candidate?.dateFin?.getFullYear() ?? null;
        })
        .filter((a): a is number => a !== null),
    );
    for (const annee of anneesTouches) {
      try {
        await invalidateIndicateursCache(annee);
      } catch {
        // fail-soft : invalidation cache non bloquante
      }
    }
  }
}

/**
 * Daily 09:00 — Génère les attestations automatiques pour les sessions `realisee`.
 *
 * Scan toutes les sessions `realisee` ayant des enrollments (statut planifiee ou
 * presente) dont l'attestation n'a pas encore été générée (attestationGenereeAt: null).
 * Pour chaque enrollment, délègue à `genererAttestationPourEnrollment` (AGENT A).
 * Fail-soft par enrollment : une erreur ne bloque pas les autres.
 * Idempotence garantie car `realisee` n'arrive qu'après dateFin + 24h (cloture-auto).
 */
async function handleAttestationsAuto(): Promise<void> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    console.log("[formation-crons] attestations-auto: stub DB, skip");
    return;
  }

  // Trouve tous les enrollments éligibles : session realisee, pas encore d'attestation
  const enrollments = await prisma.enrollment.findMany({
    where: {
      session: { statut: "realisee" },
      statut: { in: ["planifiee", "presente"] },
      attestationGenereeAt: null,
    },
    select: { id: true, session: { select: { id: true } } },
  });

  let ok = 0;
  let ko = 0;

  for (const enrollment of enrollments) {
    try {
      await genererAttestationPourEnrollment(enrollment.id);
      ok++;
    } catch (err) {
      ko++;
      console.error(
        `[formation-crons] attestations-auto: erreur enrollment ${enrollment.id}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  console.log(
    `[formation-crons] attestations-auto: ${ok} générées, ${ko} erreurs (${enrollments.length} candidats scannés)`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// T15 — Handlers emails lifecycle (rappel J-7, satisfaction J+1, suivi J+30)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Daily 08:00 UTC — Sessions `planifiee` dont dateDebut = now + 7j (fenêtre ±12h).
 *
 * Scan les sessions planifiées dont dateDebut est dans [now+6j12h, now+7j12h].
 * Pour chacune, appelle envoyerRappelJ7(sessionId) qui enqueue un email par
 * enrollment inscrit. Fail-soft par session.
 */
async function handleRappelJ7(): Promise<void> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    console.log("[formation-crons] rappel-j7: stub DB, skip");
    return;
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() + 6.5 * 24 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 7.5 * 24 * 60 * 60 * 1000);

  const sessions = await prisma.trainingSession.findMany({
    where: {
      statut: "planifiee",
      dateDebut: { gte: windowStart, lte: windowEnd },
    },
    select: { id: true },
  });

  let ok = 0;
  let ko = 0;

  for (const session of sessions) {
    try {
      await envoyerRappelJ7(session.id);
      ok++;
    } catch (err) {
      ko++;
      console.error(
        `[formation-crons] rappel-j7: erreur session ${session.id}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  console.log(
    `[formation-crons] rappel-j7: ${ok} sessions traitées, ${ko} erreurs (${sessions.length} candidats scannés)`,
  );
}

/**
 * Daily 08:00 UTC — Sessions `realisee` dont dateFin = yesterday (fenêtre J+1).
 *
 * Scan les sessions realisées dont dateFin est dans [now-36h, now-12h].
 * Pour chaque enrollment présent/planifié, enqueue satisfaction J+1.
 * Fail-soft par enrollment.
 */
async function handleSatisfactionJ1(): Promise<void> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    console.log("[formation-crons] satisfaction-j1: stub DB, skip");
    return;
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() - 36 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() - 12 * 60 * 60 * 1000);

  const enrollments = await prisma.enrollment.findMany({
    where: {
      statut: { in: ["planifiee", "presente"] },
      session: {
        statut: "realisee",
        dateFin: { gte: windowStart, lte: windowEnd },
      },
    },
    select: { id: true },
  });

  let ok = 0;
  let ko = 0;

  for (const enrollment of enrollments) {
    try {
      await envoyerSatisfactionJ1(enrollment.id);
      ok++;
    } catch (err) {
      ko++;
      console.error(
        `[formation-crons] satisfaction-j1: erreur enrollment ${enrollment.id}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  console.log(
    `[formation-crons] satisfaction-j1: ${ok} emails enqueués, ${ko} erreurs (${enrollments.length} candidats scannés)`,
  );
}

/**
 * Daily 08:00 UTC — Sessions `realisee` dont dateFin = 30 jours ago (fenêtre J+30).
 *
 * Scan les sessions realisées dont dateFin est dans [now-30j-12h, now-30j+12h].
 * Pour chaque enrollment présent/planifié, enqueue suivi J+30.
 * Fail-soft par enrollment.
 */
async function handleSuiviJ30(): Promise<void> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    console.log("[formation-crons] suivi-j30: stub DB, skip");
    return;
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() - (30 * 24 + 12) * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() - (30 * 24 - 12) * 60 * 60 * 1000);

  const enrollments = await prisma.enrollment.findMany({
    where: {
      statut: { in: ["planifiee", "presente"] },
      session: {
        statut: "realisee",
        dateFin: { gte: windowStart, lte: windowEnd },
      },
    },
    select: { id: true },
  });

  let ok = 0;
  let ko = 0;

  for (const enrollment of enrollments) {
    try {
      await envoyerSuiviJ30(enrollment.id);
      ok++;
    } catch (err) {
      ko++;
      console.error(
        `[formation-crons] suivi-j30: erreur enrollment ${enrollment.id}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  console.log(
    `[formation-crons] suivi-j30: ${ok} emails enqueués, ${ko} erreurs (${enrollments.length} candidats scannés)`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// T15 AGENT A — Handler alertes système (synchronisation cron 07:00)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Daily 07:00 UTC — Synchronise les alertes système (évalue toutes les règles,
 * crée les nouvelles, résout automatiquement celles dont la condition a disparu).
 *
 * Fail-soft : toute erreur est loggée mais n'interrompt pas le cron.
 * Stub-aware : synchroniserAlertes retourne {0,0} si DATABASE_URL = stub.invalid.
 */
async function handleAlertes(): Promise<void> {
  try {
    const { crees, resolues } = await synchroniserAlertes();
    console.log(`[formation-crons] alertes: ${crees} créées, ${resolues} résolues automatiquement`);
  } catch (err) {
    console.error(
      "[formation-crons] alertes: erreur synchronisation:",
      err instanceof Error ? err.message : String(err),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// T17 CLUSTER 3 — Convocation réglementaire J-5 (off.9)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Daily 08:00 UTC — Sessions `planifiee` dont dateDebut = J-5 (fenêtre ±12h).
 *
 * Scan les sessions planifiées dont dateDebut est dans [now+4j12h, now+5j12h].
 * Pour chaque enrollment actif (statut planifiee ou presente), envoie la
 * convocation réglementaire via envoyerConvocation(enrollmentId).
 * Idempotent : jobId BullMQ = `qualiopi-convocation-{enrollmentId}` (déjà géré
 * par envoyerConvocation — un second envoi est ignoré si le premier est pending).
 * Fail-soft par enrollment : une erreur ne bloque pas les autres stagiaires.
 *
 * Distinction J-7 vs J-5 :
 *   - J-7 (handleRappelJ7) : rappel/information avant la session.
 *   - J-5 (handleConvocationJ5) : convocation réglementaire obligatoire (off.9).
 */
async function handleConvocationJ5(): Promise<void> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    console.log("[formation-crons] convocation-j5: stub DB, skip");
    return;
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() + 4.5 * 24 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 5.5 * 24 * 60 * 60 * 1000);

  const sessions = await prisma.trainingSession.findMany({
    where: {
      statut: "planifiee",
      dateDebut: { gte: windowStart, lte: windowEnd },
    },
    select: {
      id: true,
      enrollments: {
        where: { statut: { in: ["planifiee", "presente"] } },
        select: { id: true },
      },
    },
  });

  let ok = 0;
  let ko = 0;

  for (const session of sessions) {
    for (const enrollment of session.enrollments) {
      try {
        await envoyerConvocation(enrollment.id);
        ok++;
      } catch (err) {
        ko++;
        console.error(
          `[formation-crons] convocation-j5: erreur enrollment ${enrollment.id}:`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }
  }

  const totalEnrollments = sessions.reduce((acc, s) => acc + s.enrollments.length, 0);
  console.log(
    `[formation-crons] convocation-j5: ${ok} convocations envoyées, ${ko} erreurs (${sessions.length} sessions scannées, ${totalEnrollments} enrollments)`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Worker dispatcher (exporté pour test d'intégration)
// ─────────────────────────────────────────────────────────────────────────────

const HANDLERS: Record<FormationCronJobType, () => Promise<void>> = {
  "formation-crons.date-debut": handleDateDebut,
  "formation-crons.cloture-auto": handleClotureAuto,
  "formation-crons.attestations-auto": handleAttestationsAuto,
  "formation-crons.rappel-j7": handleRappelJ7,
  "formation-crons.satisfaction-j1": handleSatisfactionJ1,
  "formation-crons.suivi-j30": handleSuiviJ30,
  "formation-crons.alertes": handleAlertes,
  "formation-crons.convocation-j5": handleConvocationJ5,
};

/** Logique de dispatch pure (exportée pour les tests). */
export async function formationCronsHandler(data: FormationCronJobData): Promise<void> {
  const handler = HANDLERS[data.type];
  if (!handler) {
    console.warn(`[formation-crons-worker] unknown job type: ${data.type}`);
    return;
  }
  await handler();
}

export function startFormationCronsWorker(): Worker<FormationCronJobData> {
  const worker = new Worker<FormationCronJobData>(
    "formation-crons",
    async (job) => {
      await formationCronsHandler(job.data);
    },
    {
      connection: getBullConnectionOrThrow(),
      concurrency: 1,
      lockDuration: 120_000,
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  );

  worker.on("ready", () => console.log("[formation-crons-worker] ready"));
  worker.on("failed", (job, err) => {
    console.error(`[formation-crons-worker] failed type=${job?.data?.type ?? "?"}: ${err.message}`);
    captureWorkerError("formation-crons", "formation-crons", job, err);
  });

  return worker;
}
