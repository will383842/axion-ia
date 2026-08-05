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
import { resoudreDureeReelleACloture } from "@/server/qualiopi/presence/duree-reelle";
import {
  decideSessionTransitions,
  type SessionCronSnapshot,
} from "@/server/qualiopi/formations/crons";
import { getFinancementValidations } from "@/server/qualiopi/financements/validation-service";
import { STATUTS_FACTURE_OUVERTE } from "@/server/qualiopi/financements/statuts-facture";
import { calculerEcheanceFacture } from "@/server/qualiopi/financements/conditions-client";
import { palierPourJours, libellePalier } from "@/server/qualiopi/financements/relance-paliers";
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
  envoyerRelanceQuestionnaire,
  envoyerEnqueteEntreprise,
  notifierAlerteInterne,
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
  // Relances questionnaires sans réponse (J+3 puis J+10, plafond 2) — 2026-08-04
  | "formation-crons.relance-questionnaires"
  // Enquête satisfaction ENTREPRISE au contact client (J+30) — indicateur 30
  | "formation-crons.enquete-entreprise-j30"
  // T15 AGENT A — moteur d'alertes système (daily 07:00)
  | "formation-crons.alertes"
  // T17 CLUSTER 3 — convocation réglementaire J-5 (off.9)
  | "formation-crons.convocation-j5"
  // Hub facturation Phase 3 — marquage des factures en retard (STATUT SEUL,
  // AUCUN email : les relances sont 100 % manuelles, règle produit).
  | "formation-crons.factures-retard"
  // Hub facturation Phase 5 — génération des BROUILLONS des plans récurrents
  // (émission + envoi = clics admin, jamais automatiques).
  | "formation-crons.plans-recurrents"
  // Parcours vente — expiration des devis à dateValidite (SPEC_PART5 §D.10).
  | "formation-crons.devis-expiration";

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
    /**
     * Durée réelle à figer, résolue AVANT la transaction (cf.
     * `resoudreDureeReelleACloture`). `null` = ne rien écrire.
     */
    dureeReelleHeures?: number | null;
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
    data: {
      statut: input.to,
      // Même règle que la clôture MANUELLE (`sessions.ts`) : la durée réelle se
      // fige au passage en « réalisée ». Écrite d'un seul côté, elle manquerait
      // à toutes les sessions clôturées par le cron J+24 h — c'est-à-dire la
      // majorité.
      ...(input.dureeReelleHeures != null ? { dureeReelleHeures: input.dureeReelleHeures } : {}),
    },
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
        // ⚠️ `not: null` et NON `> 0`. Le durcissement en `> 0` a été tenté puis
        // RETIRÉ : `emargementSigneAt` n'est posé que par la grille présentielle
        // (`saveEmargementAction`), jamais par l'import distanciel ni par la
        // correction manuelle. Une session 100 % distancielle où personne ne se
        // connecte — annulation de fait, panne, désistement collectif — devenait
        // alors DÉFINITIVEMENT non clôturable, ni ici ni manuellement, et
        // alimentait une alerte critique non résorbable.
        // Un verrou sans porte de sortie est pire que le trou qu'il ferme.
        // Le durcissement reste souhaitable, mais suppose d'abord que tous les
        // chemins de saisie de présence posent une trace, et qu'un administrateur
        // dispose d'une clôture explicite motivée. À reprendre comme un lot dédié.
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

      const dureeReelleHeures = await resoudreDureeReelleACloture(decision.sessionId);

      await prisma.$transaction(async (tx) => {
        await applyTransitionInTx(tx, {
          sessionId: decision.sessionId,
          from: decision.from,
          to: decision.to,
          trigger: "cron.cloture_auto_j24h",
          dureeReelleHeures,
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

  // Trouve tous les enrollments éligibles : session realisee, pas encore d'attestation.
  //
  // 🔴 GARDE (2026-08-03) — `evaluations: { some: { type: "finale" } }`
  //
  // Sans cette condition, ce cron émettait une attestation de fin de formation
  // pour TOUT inscrit d'une session `realisee`, évaluation des acquis ou non.
  // Constaté en production sur le premier dossier réel (AXI-ATT-2026-003) : le
  // document certifiait que la stagiaire « en a satisfait les exigences » et
  // affichait, deux lignes plus bas, « Compétences acquises : Évaluation des
  // acquis non réalisée ». Une attestation qui se contredit elle-même.
  //
  // La chronologie rendait le défaut systématique, pas accidentel :
  //   J+1 08:00 UTC  cloture-auto        → session `realisee`
  //   J+1 09:00 UTC  attestations-auto   → attestation émise
  //   J+2 07:00 UTC  alerte R05          → « évaluation manquante » : 22 h trop tard
  // L'organisme était donc prévenu APRÈS avoir délivré la pièce.
  //
  // L'attestation vaut preuve de l'indicateur 11 (atteinte des objectifs, non
  // graduable). L'émettre sans évaluation ne fait pas gagner un indicateur : ça
  // fabrique une pièce qui documente le manquement. On ne génère plus, et on
  // laisse l'alerte R05 faire son travail.
  // `satisfies` plutôt que `as const` : `as const` fige le tableau de `in` en
  // `readonly`, que Prisma refuse.
  const where = {
    session: { statut: "realisee" },
    statut: { in: ["planifiee", "presente"] },
    attestationGenereeAt: null,
  } satisfies Prisma.EnrollmentWhereInput;

  const enrollments = await prisma.enrollment.findMany({
    where: { ...where, evaluations: { some: { type: "finale" } } },
    select: { id: true, session: { select: { id: true } } },
  });

  // Comptés séparément pour que le log dise « 3 en attente d'évaluation » plutôt
  // que de rester silencieux sur ce qu'il a délibérément sauté.
  const enAttenteEvaluation = await prisma.enrollment.count({
    where: { ...where, evaluations: { none: { type: "finale" } } },
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
    `[formation-crons] attestations-auto: ${ok} générées, ${ko} erreurs ` +
      `(${enrollments.length} candidats scannés, ${enAttenteEvaluation} en attente d'évaluation finale)`,
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

  // 🔴 RATTRAPAGE (2026-08-03) — la fenêtre de 24 h laissait tomber définitivement
  //
  // L'ancienne sélection était `dateFin ∈ [now-36h, now-12h]` ET `statut = realisee`.
  // Les DEUX conditions devaient être vraies le même matin, au passage de 08:00 UTC.
  // Une session clôturée avec un jour de retard sortait de la fenêtre et **ne
  // recevait jamais son questionnaire** : pas de seconde chance, pas d'alerte.
  //
  // Constaté sur le premier dossier réel (INVEST SUN, session du 31/07) :
  //   01/08 08:00 → dans la fenêtre, session pas encore `realisee` → sauté
  //   02/08 08:00 → session `realisee`, fenêtre dépassée           → sauté
  // Résultat : 0 appréciation recueillie, indicateurs 8 et 30 vides sur la seule
  // action réalisée de l'organisme.
  //
  // On sélectionne désormais sur **l'absence d'envoi**, pas sur une tranche de
  // temps : tout inscrit d'une session réalisée depuis au moins 12 h dont le
  // questionnaire de satisfaction à chaud n'a pas encore été envoyé. Le critère
  // devient l'état réel du dossier, pas l'heure à laquelle le cron passe.
  //
  // Le `envoyeAt: null` rend l'opération idempotente : une fois parti, l'email ne
  // repart pas au scan suivant. Le plancher de 12 h évite d'écrire au stagiaire
  // le soir même de la formation.
  //
  // Borne de 90 jours : au-delà, relancer sur une session ancienne n'a plus de
  // sens et exhumerait des dossiers clos à la première mise en service.
  const now = new Date();
  const planchier = new Date(now.getTime() - 12 * 60 * 60 * 1000);
  const plafond = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const enrollments = await prisma.enrollment.findMany({
    where: {
      statut: { in: ["planifiee", "presente"] },
      session: {
        statut: "realisee",
        dateFin: { gte: plafond, lte: planchier },
      },
      questionnaires: {
        some: { type: "satisfaction_chaud", envoyeAt: null, reponduAt: null },
      },
    },
    select: { id: true },
  });

  let ok = 0;
  let ko = 0;

  for (const enrollment of enrollments) {
    try {
      await envoyerSatisfactionJ1(enrollment.id);
      // Marque l'envoi : c'est ce qui rend le rattrapage idempotent, et ce qui
      // permet à la console de distinguer « jamais envoyé » de « sans réponse ».
      await prisma.questionnaire.updateMany({
        where: { enrollmentId: enrollment.id, type: "satisfaction_chaud", envoyeAt: null },
        data: { envoyeAt: new Date() },
      });
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
    `[formation-crons] satisfaction-j1: ${ok} emails enqueués, ${ko} erreurs ` +
      `(${enrollments.length} candidats en attente d'envoi — rattrapage sans fenêtre)`,
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

  // 🔴 RATTRAPAGE (2026-08-03) — même défaut que `satisfaction-j1`, même remède.
  //
  // La fenêtre `dateFin ∈ [J-30±12h]` ne laissait qu'une seule chance : un cron
  // qui ne passe pas ce matin-là, ou une session clôturée tardivement, et le
  // suivi à froid ne partait jamais. C'est la SECONDE des deux sources
  // d'appréciation qu'exige l'indicateur 30 — la perdre coûte l'indicateur.
  //
  // On sélectionne sur l'absence d'envoi, avec un plancher de 30 jours (le suivi
  // à froid n'a de sens qu'après un délai de mise en pratique) et un plafond de
  // 180 jours (au-delà, on n'exhume pas un dossier clos).
  const now = new Date();
  const planchier = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const plafond = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

  const enrollments = await prisma.enrollment.findMany({
    where: {
      statut: { in: ["planifiee", "presente"] },
      session: {
        statut: "realisee",
        dateFin: { gte: plafond, lte: planchier },
      },
      questionnaires: {
        some: { type: "satisfaction_froid", envoyeAt: null, reponduAt: null },
      },
    },
    select: { id: true },
  });

  let ok = 0;
  let ko = 0;

  for (const enrollment of enrollments) {
    try {
      await envoyerSuiviJ30(enrollment.id);
      await prisma.questionnaire.updateMany({
        where: { enrollmentId: enrollment.id, type: "satisfaction_froid", envoyeAt: null },
        data: { envoyeAt: new Date() },
      });
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

    // Notifie l'équipe interne des alertes CRITIQUES non encore notifiées.
    // Seuil = critique UNIQUEMENT (anti-spam) ; l'idempotence réelle vit dans
    // notifierAlerteInterne (claim notifiedAt) — un doublon reste impossible même
    // si findMany voit une alerte déjà en cours de notification.
    const aNotifier = await prisma.alerteSysteme.findMany({
      where: { niveau: "critique", resolue: false, notifiedAt: null },
      select: { id: true },
    });
    let notifiees = 0;
    for (const a of aNotifier) {
      try {
        await notifierAlerteInterne(a.id);
        notifiees++;
      } catch (err) {
        console.error(
          `[formation-crons] alertes: erreur notif ${a.id}:`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    console.log(
      `[formation-crons] alertes: ${crees} créées, ${resolues} résolues, ${notifiees} notifiée(s)`,
    );
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
// Hub facturation Phase 3 — factures en retard (STATUT SEULEMENT)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Marque `en_retard` les factures CRM ouvertes dont l'échéance est dépassée, et
 * RÉPARE au passage celles qui n'ont pas d'échéance du tout.
 *
 * AUCUN email : la détection alimente l'écran Hub et (Phase 4) les relances
 * PROPOSÉES — l'envoi reste un clic admin. Les délais différenciés
 * entreprise/financeur sont encodés dans `echeanceAt` au moment de l'émission
 * (delai_paiement_jours vs delai_paiement_financeur_jours). Idempotent
 * (updateMany conditionné au statut, une proposition par facture+palier).
 *
 * ── 🔴 Réparation automatique de l'échéance manquante ─────────────────────────
 *
 * Le filtre `echeanceAt: { lt: now }` n'a JAMAIS ramené les lignes à échéance
 * nulle (aucune comparaison SQL n'est vraie pour NULL), et la boucle refermait
 * le trou d'un `if (f.echeanceAt === null) continue;`. Une facture émise sans
 * échéance était donc structurellement INVISIBLE du recouvrement : jamais
 * `en_retard`, jamais relancée, jamais alertée — et le défaut se rouvre à chaque
 * chemin de création qui oublie la colonne.
 *
 * Un script de rattrapage manuel ne suffit pas : il faudrait le relancer après
 * chaque oubli. La réparation est donc faite ICI, à chaque passage quotidien :
 * échéance = `emiseAt` (repli `createdAt`) + délai du client (repli 30 j), via
 * la même fonction pure que les émetteurs (`calculerEcheanceFacture`).
 *
 * Garde-fous, tous délibérés :
 *  - hors avoirs (`avoirDeId`) et hors reprises d'historique (`estImportee`) —
 *    on ne fabrique pas de date sur des données venues d'un système tiers ;
 *  - `emiseAt ?? createdAt` : sans aucune date d'origine connue on ne répare
 *    PAS (inventer un point de départ inventerait une ancienneté de créance) ;
 *  - si l'échéance reconstituée est déjà échue de plus de 60 jours, on la
 *    PERSISTE mais on ne crée AUCUNE relance au même passage. Une facture mal
 *    datée (reprise, import approximatif) produirait sinon d'emblée une relance
 *    J30 sur une créance dont l'ancienneté vient d'être devinée. Le palier
 *    tombera au run du lendemain, ce qui laisse une journée pour corriger la
 *    date à la main. Le passage en `en_retard`, lui, est appliqué : c'est un
 *    constat d'état, pas une sollicitation du client.
 */
async function handleFacturesRetard(): Promise<void> {
  const now = new Date();
  // Factures ouvertes échues OU sans échéance — hors avoirs et reprises
  // d'historique. Les brouillons sont exclus par le filtre de statut.
  const candidates = await prisma.factureFormation.findMany({
    where: {
      statut: { in: [...STATUTS_FACTURE_OUVERTE] },
      OR: [{ echeanceAt: { lt: now } }, { echeanceAt: null }],
      avoirDeId: null,
      estImportee: false,
    },
    select: {
      id: true,
      numero: true,
      statut: true,
      echeanceAt: true,
      emiseAt: true,
      createdAt: true,
      montantTtcCents: true,
      montantHtCents: true,
      // Délai de paiement propre au client (F61) — base de la réparation.
      client: { select: { delaiPaiementJours: true } },
      payments: { where: { status: "succeeded" }, select: { amountCents: true } },
      avoirs: {
        where: { statut: { not: "annulee" } },
        select: { montantTtcCents: true, montantHtCents: true },
      },
    },
  });

  let marquees = 0;
  let proposees = 0;
  let echeancesReparees = 0;
  for (const f of candidates) {
    // Reste dû NET (revue M3/M4) : TTC + avoirs (négatifs) − encaissements.
    // Créance éteinte (avoir total, trop-perçu) → ni retard, ni relance.
    const encaisse = f.payments.reduce((acc, p) => acc + p.amountCents, 0);
    const avoirsTtc = f.avoirs.reduce((acc, a) => acc + (a.montantTtcCents ?? a.montantHtCents), 0);
    const netDuCents = (f.montantTtcCents ?? f.montantHtCents) + avoirsTtc - encaisse;
    if (netDuCents <= 0) continue;

    // ── Réparation de l'échéance manquante ────────────────────────────────
    let echeance = f.echeanceAt;
    let reparee = false;
    if (echeance === null) {
      const origine = f.emiseAt ?? f.createdAt;
      // Aucune date d'origine exploitable → on ne devine rien, on passe.
      if (origine === null) continue;
      echeance = calculerEcheanceFacture(origine, f.client?.delaiPaiementJours ?? null);
      await prisma.factureFormation.updateMany({
        // `echeanceAt: null` dans le `where` : idempotent et sans course — si un
        // autre chemin a posé l'échéance entre-temps, on n'écrase pas la sienne.
        where: { id: f.id, echeanceAt: null },
        data: { echeanceAt: echeance },
      });
      echeancesReparees++;
      reparee = true;
      console.log(
        `[formation-crons] factures-retard: échéance reconstituée pour ${f.numero} → ${echeance.toISOString().slice(0, 10)} (émission ${origine.toISOString().slice(0, 10)} + délai client)`,
      );
    }

    // Une échéance future (facture sans échéance mais pas encore due) n'est ni
    // en retard ni relançable : la réparation seule suffit pour ce passage.
    if (echeance.getTime() >= now.getTime()) continue;

    if (f.statut !== "en_retard") {
      await prisma.factureFormation.updateMany({
        // Filtre volontairement PLUS ÉTROIT que le SSOT : on ne repasse pas en
        // `en_retard` une ligne qui y est déjà (idempotence de l'écriture).
        where: { id: f.id, statut: { in: ["emise", "partiellement_payee"] } },
        data: { statut: "en_retard" },
      });
      marquees++;
    }

    const jours = Math.floor((now.getTime() - echeance.getTime()) / 86_400_000);

    // Échéance tout juste reconstituée ET déjà très ancienne : on laisse passer
    // un jour avant de proposer une relance (cf. en-tête).
    if (reparee && jours > 60) continue;

    // Une proposition par facture+palier (idempotent) — montant = SOLDE net.
    //
    // 🔴 L'échelle s'arrêtait à `j30` : au-delà de trente jours, plus AUCUNE
    // relance n'était proposée. La créance la plus ancienne — donc la plus en
    // danger — était la seule à ne plus jamais remonter à l'écran. L'échelle
    // complète (J1 → J60, mise en demeure incluse) vit dans `relance-paliers.ts`.
    const palier = palierPourJours(jours);
    if (palier === null) continue;
    const deja = await prisma.relanceProposee.findFirst({
      where: { factureFormationId: f.id, palier },
      select: { id: true },
    });
    if (deja !== null) continue;
    await prisma.relanceProposee.create({
      data: {
        type: "facture_retard",
        palier,
        factureFormationId: f.id,
        // ⚠️ Note INTERNE, affichée à l'admin dans le hub. Elle n'est PLUS le
        // corps de l'e-mail envoyé au client (ce jargon partait tel quel) : la
        // rédaction vit dans le gabarit `qualiopi-relance-impayee`, choisie par
        // le ton du palier.
        suggestion: `Facture ${f.numero} — solde de ${(netDuCents / 100).toFixed(2)} € TTC échu le ${echeance.toLocaleDateString("fr-FR")} — ${libellePalier(palier)}.`,
      },
    });
    proposees++;
  }

  console.log(
    `[formation-crons] factures-retard: ${marquees} passée(s) en retard, ${proposees} relance(s) proposée(s), ${echeancesReparees} échéance(s) manquante(s) reconstituée(s) — AUCUN email client (manuel)`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Worker dispatcher (exporté pour test d'intégration)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Daily 05:00 UTC — génère les BROUILLONS des plans récurrents échus.
 * Telegram interne pour signaler les brouillons à valider — l'émission et
 * l'envoi restent des clics admin (aucune facture ne part seule).
 */
async function handlePlansRecurrents(): Promise<void> {
  // Import paresseux : évite de charger la chaîne PDF/config au chargement du
  // worker (et dans son spec d'intégration).
  const { genererBrouillonsPlansEchus } =
    await import("@/server/qualiopi/financements/plan-recurrent");
  const { generes, clos } = await genererBrouillonsPlansEchus(new Date());
  if (generes > 0) {
    await sendTelegramFacturation(
      `🧾 ${generes} brouillon${generes > 1 ? "s" : ""} de facture récurrente à valider dans le Hub facturation`,
    );
  }
  console.log(
    `[formation-crons] plans-recurrents: ${generes} brouillon(s) généré(s), ${clos} plan(s) clos — émission MANUELLE`,
  );
}

/** Telegram best-effort (le module telegram est booking-agnostique). */
async function sendTelegramFacturation(body: string): Promise<void> {
  try {
    const { sendTelegram } = await import("@/lib/telegram");
    await sendTelegram({ tag: "AUTO", body, silent: true });
  } catch {
    // Best-effort.
  }
}

/**
 * Daily 08:30 UTC — relance les questionnaires ENVOYÉS restés sans réponse.
 *
 * 🔴 Constaté sur le premier dossier réel : les questionnaires partaient
 * (satisfaction-j1, suivi-j30), puis PLUS RIEN. Aucune relance, et l'indicateur
 * 30 restait à « 0 appréciation » pendant que tout le monde croyait le
 * processus complet. La trace des relances (`relanceCount`,
 * `derniereRelanceAt`) est aussi la PREUVE, devant l'auditeur, que le recueil
 * est réellement organisé — une non-réponse d'un tiers n'est pas une faute de
 * l'organisme, l'absence de tentative tracée, si.
 *
 * Calendrier : 1ʳᵉ relance à J+3 après l'envoi, 2ᵉ à J+7 après la 1ʳᵉ
 * (≈ J+10). PLAFOND À 2 : au-delà, on n'insiste plus par email — la relance
 * téléphonique manuelle prend le relais, depuis le bloc « Retours en attente »
 * de la console.
 *
 * Même doctrine que satisfaction-j1 : la sélection porte sur l'ÉTAT du dossier
 * (envoyé, sans réponse, relance due), jamais sur une fenêtre horaire — un cron
 * raté un matin se rattrape le lendemain. Borne à 90 jours : au-delà, relancer
 * exhume des dossiers clos.
 */
async function handleRelanceQuestionnaires(): Promise<void> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    console.log("[formation-crons] relance-questionnaires: stub DB, skip");
    return;
  }

  const now = new Date();
  const j3 = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const j7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const plafond90j = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const questionnaires = await prisma.questionnaire.findMany({
    where: {
      reponduAt: null,
      envoyeAt: { not: null, gte: plafond90j },
      OR: [
        // 1ʳᵉ relance : envoyé depuis ≥ 3 jours, jamais relancé.
        { relanceCount: 0, envoyeAt: { lte: j3 } },
        // 2ᵉ relance : 1ʳᵉ relance depuis ≥ 7 jours. Le plafond de 2 est
        // STRUCTUREL : aucune branche ne matche relanceCount ≥ 2.
        { relanceCount: 1, derniereRelanceAt: { lte: j7 } },
      ],
    },
    select: { id: true },
  });

  let ok = 0;
  let ko = 0;
  for (const q of questionnaires) {
    try {
      await envoyerRelanceQuestionnaire(q.id);
      ok++;
    } catch (err) {
      ko++;
      console.error(
        `[formation-crons] relance-questionnaires: erreur questionnaire ${q.id}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  console.log(
    `[formation-crons] relance-questionnaires: ${ok} relances enqueuées, ${ko} erreurs (${questionnaires.length} dues)`,
  );
}

/**
 * Daily 08:15 UTC — enquête ENTREPRISE aux contacts clients (J+30).
 *
 * 🔴 L'indicateur 30 exige des appréciations d'AU MOINS DEUX sources. Le retour
 * stagiaire est automatisé depuis toujours ; celui de l'ENTREPRISE cliente
 * n'avait aucun canal — il se tapait à la main dans la console. Le contact
 * client reçoit une page publique à jeton ; sa réponse est versée
 * automatiquement en appréciation « entreprise ».
 *
 * Même doctrine anti-fenêtre que satisfaction-j1 : sélection sur l'ÉTAT
 * (session réalisée depuis ≥ 30 jours, enquête jamais envoyée), pas sur
 * l'heure de passage. Borne à 90 jours.
 */
async function handleEnqueteEntrepriseJ30(): Promise<void> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    console.log("[formation-crons] enquete-entreprise-j30: stub DB, skip");
    return;
  }

  const now = new Date();
  const j30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const plafond90j = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const sessions = await prisma.trainingSession.findMany({
    where: {
      statut: "realisee",
      dateFin: { gte: plafond90j, lte: j30 },
      client: { contactEmail: { not: null } },
      // Jamais envoyée : aucune enquête entreprise expédiée sur cette session.
      // (Le questionnaire est ancré sur une inscription de la session.)
      NOT: {
        enrollments: {
          some: {
            questionnaires: {
              some: { type: "satisfaction_entreprise", envoyeAt: { not: null } },
            },
          },
        },
      },
    },
    select: { id: true },
  });

  let ok = 0;
  let ko = 0;
  for (const session of sessions) {
    try {
      await envoyerEnqueteEntreprise(session.id);
      // Marque l'envoi — même contrat d'idempotence que satisfaction-j1.
      await prisma.questionnaire.updateMany({
        where: {
          type: "satisfaction_entreprise",
          envoyeAt: null,
          enrollment: { sessionId: session.id },
        },
        data: { envoyeAt: new Date() },
      });
      ok++;
    } catch (err) {
      ko++;
      console.error(
        `[formation-crons] enquete-entreprise-j30: erreur session ${session.id}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  console.log(
    `[formation-crons] enquete-entreprise-j30: ${ok} enquêtes enqueuées, ${ko} erreurs (${sessions.length} candidates)`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Parcours vente — expiration des devis (SPEC_PART5 §D.10)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Daily 06:45 UTC — passe `envoye → expire` les devis dont `dateValidite` est
 * dépassée.
 *
 * 🔴 Avant ce cron, AUCUN chemin ne posait jamais ce statut à l'échéance : seul
 * `reviseDevisAction` l'écrivait (en expirant l'ancienne version d'un devis
 * révisé). Un devis mort depuis des mois restait « envoyé » pour toujours —
 * le tableau de bord mentait, et `createSessionAction` refusait le devis sans
 * que rien n'explique pourquoi.
 *
 * Statut seul, AUCUN email (même politique que factures-retard). Les alertes
 * `devis_expire_j7` / `devis_expire` (évaluateur, 07:00) s'appuient sur l'état
 * posé ici — d'où l'horaire AVANT le job alertes.
 *
 * ## Relance J+3 (même passage)
 *
 * Un devis `envoye` sans réponse depuis 3 jours fait l'objet d'une PROPOSITION
 * de relance dans le hub facturation (envoi = clic admin, jamais automatique) —
 * la mécanique exacte de `quote-pending-reminder` côté booking, appliquée aux
 * devis CRM. Distincte de l'alerte `devis_sans_reponse` (J+7, évaluateur) :
 * la RelanceProposee est une ACTION proposée, l'alerte une ESCALADE de
 * pilotage (cf. `relance-paliers.ts`). L'expiration est posée AVANT la
 * sélection : un devis échu ce matin ne reçoit pas de relance de courtoisie.
 */
async function handleDevisExpiration(): Promise<void> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    console.log("[formation-crons] devis-expiration: stub DB, skip");
    return;
  }
  const now = new Date();

  const res = await prisma.devis.updateMany({
    where: { statut: "envoye", dateValidite: { lt: now } },
    data: { statut: "expire" },
  });

  const dormants = await prisma.devis.findMany({
    where: { statut: "envoye", sentAt: { not: null, lte: new Date(now.getTime() - 3 * 86_400_000) } },
    select: {
      id: true,
      numero: true,
      dateValidite: true,
      client: { select: { raisonSociale: true } },
    },
  });
  let proposees = 0;
  for (const d of dormants) {
    // Une proposition par devis (palier unique j3) — idempotent entre passages.
    const deja = await prisma.relanceProposee.findFirst({
      where: { devisId: d.id, palier: "j3" },
      select: { id: true },
    });
    if (deja !== null) continue;
    await prisma.relanceProposee.create({
      data: {
        type: "devis_sans_reponse",
        palier: "j3",
        devisId: d.id,
        suggestion: `Devis ${d.numero} (${d.client.raisonSociale}) envoyé sans réponse depuis 3 jours — valable jusqu'au ${d.dateValidite.toLocaleDateString("fr-FR")} — relance de courtoisie.`,
      },
    });
    proposees++;
  }

  console.log(
    `[formation-crons] devis-expiration: ${res.count} devis passé(s) envoye→expire, ${proposees} relance(s) J+3 proposée(s) (${dormants.length} sans réponse) — AUCUN email client (manuel)`,
  );
}

const HANDLERS: Record<FormationCronJobType, () => Promise<void>> = {
  "formation-crons.date-debut": handleDateDebut,
  "formation-crons.cloture-auto": handleClotureAuto,
  "formation-crons.attestations-auto": handleAttestationsAuto,
  "formation-crons.rappel-j7": handleRappelJ7,
  "formation-crons.satisfaction-j1": handleSatisfactionJ1,
  "formation-crons.suivi-j30": handleSuiviJ30,
  "formation-crons.relance-questionnaires": handleRelanceQuestionnaires,
  "formation-crons.enquete-entreprise-j30": handleEnqueteEntrepriseJ30,
  "formation-crons.alertes": handleAlertes,
  "formation-crons.convocation-j5": handleConvocationJ5,
  "formation-crons.factures-retard": handleFacturesRetard,
  "formation-crons.plans-recurrents": handlePlansRecurrents,
  "formation-crons.devis-expiration": handleDevisExpiration,
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
