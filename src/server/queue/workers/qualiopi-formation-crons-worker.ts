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
import { inscriptionsActives } from "@/server/qualiopi/inscriptions/inscriptions-actives";
import { relancerEtExpirerMissions } from "@/server/qualiopi/trainers/mission-formateur";
import { accordRequis } from "@/server/qualiopi/trainers/delai-reponse-mission";
import {
  envoyerConvocationJ7Formateur,
  envoyerRappelJ1Formateur,
  FENETRE_CONVOCATION_J7_JOURS,
  FENETRE_RAPPEL_J1_HEURES,
} from "@/server/qualiopi/trainers/convocation-formateur";
import { getBullConnectionOrThrow } from "../connection";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
import { prisma } from "@/lib/prisma";
import { assertSessionTransition } from "@/server/qualiopi/formations/state-machine";
import { resoudreDureeReelleACloture } from "@/server/qualiopi/presence/duree-reelle";
import {
  mesurerTraceCloture,
  clotureSansAucuneTrace,
} from "@/server/qualiopi/presence/trace-cloture";
// 🔴 2026-08-24, cahier D2 — CE SIGNAL MANQUAIT ICI, et c'est tout le défaut :
// la mesure était faite, le cas PARTIEL simplement jamais lu. La clôture
// manuelle le signalait ; celle-ci — le chemin dominant — non.
import { signalerClotureIncomplete } from "@/server/qualiopi/alertes/signal-cloture";
import {
  decideSessionTransitions,
  type SessionCronSnapshot,
} from "@/server/qualiopi/formations/crons";
import { getFinancementValidations } from "@/server/qualiopi/financements/validation-service";
import { STATUTS_FACTURE_OUVERTE } from "@/server/qualiopi/financements/statuts-facture";
import { calculerEcheanceFacture } from "@/server/qualiopi/financements/conditions-client";
import { palierPourJours, libellePalier } from "@/server/qualiopi/financements/relance-paliers";
// M7 — le MÊME résolveur que la chaîne d'envoi (`facturation-hub.ts`) : la
// proposition ne peut plus annoncer un débiteur que l'envoi contredirait.
import { resoudreDestinataireRelance } from "@/server/qualiopi/financements/relance-destinataire";
import { writeSessionTransition } from "@/server/qualiopi/formations/transition-helper";
import { verifierSanteEmails } from "@/server/email/health";
import type { TrainingSessionStatut } from "@/server/qualiopi/formations/types";
import type { Prisma } from "../../../../prisma/generated/client";
import { genererAttestationPourEnrollment } from "@/server/qualiopi/evaluations/attestation-service";
import { invalidateIndicateursCache } from "@/server/qualiopi/indicateurs/service";
import {
  envoyerConvocation,
  envoyerPositionnement,
  envoyerRappelJ7,
  envoyerRappelJ1,
  envoyerSatisfactionJ1,
  envoyerSuiviJ30,
  envoyerRelanceQuestionnaire,
  envoyerEnqueteEntreprise,
} from "@/server/qualiopi/notifications/notifications-service";
import { synchroniserAlertes } from "@/server/qualiopi/alertes/alertes-service";
import { notifierAlertesGroupees } from "@/server/qualiopi/alertes/envoi-groupe";
// La MEME mesure que la regle d alerte rappel_j7_non_envoye : une seconde
// requete jumelle divergerait au premier changement de borne.
import { sessionsSansRappelJ7 } from "@/server/qualiopi/notifications/rappel-j7-manquant";
import {
  gestePositionnement,
  HORIZON_JOURS,
} from "@/server/qualiopi/parcours/relance-positionnement";

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
  // 2026-08-17 — recueil du POSITIONNEMENT avant l'entrée en formation (ind. 8).
  // ⚠️ Pas un compte à rebours : état + rattrapage, cf. `relance-positionnement.ts`.
  | "formation-crons.positionnement"
  // 2026-08-16 — liens de signature des sessions qui COMMENCENT aujourd'hui.
  // Envoyer un lien n'engage pas l'organisme (signer, si) : automatisable.
  | "formation-crons.liens-emargement-j0"
  // Hub facturation Phase 3 — marquage des factures en retard (STATUT SEUL,
  // AUCUN email : les relances sont 100 % manuelles, règle produit).
  | "formation-crons.factures-retard"
  // Hub facturation Phase 5 — génération des BROUILLONS des plans récurrents
  // (émission + envoi = clics admin, jamais automatiques).
  | "formation-crons.plans-recurrents"
  // Parcours vente — expiration des devis à dateValidite (SPEC_PART5 §D.10).
  | "formation-crons.devis-expiration"
  // Fraîcheur des offres d'emploi (Google for Jobs) — rappel Telegram hebdo
  // des offres à republier. AUCUN bump de date automatique (règle Google).
  | "formation-crons.offres-fraicheur"
  | "formation-crons.rappels-entretien"
  // Lot 4 — les candidatures que plus personne ne fait avancer. Alerte SEULE :
  // aucun statut n'est changé, aucun e-mail ne part au candidat. Décider de
  // répondre reste un geste humain.
  | "formation-crons.candidatures-en-sommeil"
  // Surveillance de la chaîne d'envoi (audit 2026-08-16) — HORAIRE.
  //
  // ⚠️ Ce passage n'est pas « formation », et il vit pourtant ici. C'est un
  // choix : `formation-crons` est le seul répartiteur de crons déjà branché sur
  // le moteur d'alertes, et la chaîne d'e-mails est précisément ce qui porte la
  // conformité de la formation. Créer une file dédiée pour un `count()` horaire
  // aurait ajouté une septième file à surveiller pour surveiller.
  | "formation-crons.email-sante"
  // Cycle de vie du formateur sur une session (2026-09-03).
  | "formation-crons.missions-formateur"
  | "formation-crons.formateur-convocation-j7"
  | "formation-crons.formateur-rappel-j1"
  // 🔴 Rappel de la VEILLE au STAGIAIRE (2026-09-05, ADR 0048 §4.3). À ne pas
  // confondre avec `formateur-rappel-j1` juste au-dessus : celui-ci s'adresse
  // aux participants, et il porte le lien de connexion.
  | "formation-crons.rappel-j1";

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
      // 🔴 `CONF-01` (2026-08-20) — la mesure était DUPLIQUÉE avec la clôture
      // manuelle (`actions/qualiopi/sessions.ts`), sous un commentaire disant
      // que « les deux DOIVENT rester alignées ». Elles ne peuvent plus
      // diverger : il n'y a qu'une mesure, dans `presence/trace-cloture.ts`,
      // et c'est là que vit la mise en garde sur le durcissement.
      //
      // Elle exclut désormais les `abandon` et `exclu` : renoncer n'est pas une
      // absence de preuve, c'est une sortie du dispositif.
      const trace = await mesurerTraceCloture(decision.sessionId);
      if (clotureSansAucuneTrace(trace)) {
        skippedSansEmargement++;
        continue;
      }

      // La session est cloturable — mais si des inscrits actifs n'ont AUCUNE
      // trace, il faut le dire. On ne bloque pas (arbitrage ecrit dans
      // `trace-cloture.ts` : le durcissement rendrait des sessions
      // definitivement non cloturables), on SIGNALE.
      signalerClotureIncomplete(decision.sessionId, trace);

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
 * presente) dont l'attestation n'a pas encore été générée (attestationGenereeAt: null)
 * ET qui portent les PREUVES exigées : taux de présence mesuré, trace d'assiduité
 * vérifiable, évaluation finale (cf. `preuvesRequises` plus bas).
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

  // 🔴 2026-09-05 — LES PREUVES, ET NON PLUS LA SEULE ÉVALUATION.
  //
  // `attestation-service` refuse désormais d'émettre sans taux de présence
  // MESURÉ ni trace d'assiduité vérifiable — les mêmes exigences que le
  // certificat de réalisation, qui les portait seul jusqu'ici (l'attestation,
  // due au STAGIAIRE par L.6353-1, était moins gardée que la pièce du payeur).
  //
  // Le cron pré-filtre sur ces mêmes preuves plutôt que de laisser le service
  // lever : sans ce filtre, chaque passage compterait en ERREURS des dossiers
  // qui ne sont pas en panne, seulement incomplets — et le journal du matin
  // deviendrait illisible là où il doit être actionnable.
  //
  // ⚠️ Le cron ne passe JAMAIS `motifPreuvesManquantes` : la soupape est un acte
  // humain, écrit et porté au registre. Un automate qui se la donnerait à
  // lui-même ne serait qu'un contournement avec un nom rassurant.
  const preuvesRequises = {
    tauxPresencePct: { not: null },
    evaluations: { some: { type: "finale" } },
    OR: [
      { emargementSignatures: { some: { revokedAt: null } } },
      {
        presences: {
          some: {
            source: { in: ["import_zoom", "import_teams", "import_meet"] },
            importId: { not: null },
          },
        },
      },
    ],
  } satisfies Prisma.EnrollmentWhereInput;

  const enrollments = await prisma.enrollment.findMany({
    where: { ...where, ...preuvesRequises },
    select: { id: true, session: { select: { id: true } } },
  });

  // Comptés séparément pour que le log dise « 3 en attente d'évaluation » plutôt
  // que de rester silencieux sur ce qu'il a délibérément sauté.
  const enAttenteEvaluation = await prisma.enrollment.count({
    where: { ...where, evaluations: { none: { type: "finale" } } },
  });

  // Évaluées MAIS sans preuve d'assiduité. DÉRIVÉ par soustraction d'un
  // sous-ensemble à son sur-ensemble (`preuvesRequises` contient déjà
  // `evaluations: some finale`), et non par une troisième requête qui
  // divergerait de `preuvesRequises` le jour où l'une des deux bougerait.
  const avecEvaluation = await prisma.enrollment.count({
    where: { ...where, evaluations: { some: { type: "finale" } } },
  });
  const sansPreuvePresence = avecEvaluation - enrollments.length;

  let ok = 0;
  let ko = 0;

  // 🔴 2026-08-26 — LE RETOUR EST LU. Il était JETÉ, et `ok++` s'incrémentait
  // quoi qu'il arrive.
  //
  // `genererAttestationPourEnrollment` rend `{ resultat, documentId }`, et
  // `resultat` vaut `"aucune"` quand le taux de présence est sous le seuil :
  // aucune pièce n'est alors produite, et c'est le BON comportement. Mais le
  // journal annonçait quand même « 1 générées » — mesuré en dev le 2026-08-26,
  // le cron déclarait une attestation produite alors que ZÉRO ligne
  // `DocumentGenere` avait été écrite.
  //
  // Les DONNÉES étaient saines : aucune attestation fausse n'a jamais été
  // émise. C'est le COMPTE RENDU qui mentait — et c'est cette ligne-là qu'un
  // humain lit le matin pour croire la chaîne en ordre. Sur une pièce
  // d'indicateur 11, un journal qui surdéclare est un faux témoignage de
  // conformité.
  //
  // ⚠️ Même famille que `D5-1-C2` (convocation-j5, 2026-08-21) et que les six
  // fonctions d'envoi alignées le 2026-08-20. Ici, le membre oublié.
  let sansPiece = 0;

  for (const enrollment of enrollments) {
    try {
      const { resultat } = await genererAttestationPourEnrollment(enrollment.id);
      if (resultat === "aucune") sansPiece++;
      else ok++;
    } catch (err) {
      ko++;
      console.error(
        `[formation-crons] attestations-auto: erreur enrollment ${enrollment.id}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  console.log(
    `[formation-crons] attestations-auto: ${ok} générées, ${sansPiece} sans pièce ` +
      `(présence sous le seuil), ${ko} erreurs ` +
      `(${enrollments.length} candidats scannés, ${enAttenteEvaluation} en attente d'évaluation finale, ` +
      `${sansPreuvePresence} évaluées mais sans taux mesuré ni trace d'assiduité)`,
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
  // 🔴 PLUS DE FENÊTRE BASSE (2026-08-24) — MÊME DÉFAUT QUE LA CONVOCATION,
  // MÊME CORRECTIF.
  //
  // L'ancienne sélection était `dateDebut ∈ [J-7,5 ; J-6,5]` au passage quotidien
  // de 08:00 UTC. Trois conséquences :
  //
  //   1. une session créée moins de 7,5 jours avant son début n'entrait JAMAIS
  //      dans la fenêtre — et c'est le cas ordinaire, pas le cas limite : la
  //      session du 31/07 a été créée le 31/07 pour un début le même jour,
  //      celle du 16/08 la veille ;
  //   2. un worker arrêté pendant le créneau perdait l'occurrence, sans retour ;
  //   3. rien ne permettait de savoir combien de rappels manquaient.
  //
  // Le plafond haut demeure : on ne rappelle pas trois mois à l'avance, le
  // message porte les informations logistiques finales. Ce qui disparaît, c'est
  // le plancher — le cron RATTRAPE chaque jour, tant que la session n'a pas
  // commencé.
  const plafond = new Date(now.getTime() + 7.5 * 24 * 60 * 60 * 1000);
  // 🔴 S5 (2026-08-26) — LE RAPPEL NE PART JAMAIS LE MÊME MATIN QUE LA
  // CONVOCATION. Défaut mesuré (AN-S6) : une session créée moins de 5,5 j du
  // début recevait la convocation (cron HORAIRE, rattrapant) puis le rappel
  // J-7 au passage de 08:00 — deux messages quasi identiques dans la même
  // matinée, les drapeaux `convocationEnvoyeeAt` et `rappelJ7EnvoyeAt`
  // n'étant jamais croisés. Le rappel exige désormais que la convocation soit
  // PARTIE depuis au moins 24 h pour chaque inscrit actif.
  const seuilConvocation24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const sessions = await prisma.trainingSession.findMany({
    where: {
      statut: "planifiee",
      // L'ÉTAT, pas la date : tant que la colonne est nulle, la session reste
      // candidate. `envoyerRappelJ7` ne l'écrit qu'après avoir remis à la file
      // le message de CHAQUE inscrit.
      rappelJ7EnvoyeAt: null,
      // Pas encore commencée : rappeler après coup n'informe plus personne.
      // Ce cas relève d'un écart à consigner — c'est l'objet du relevé ci-dessous.
      dateDebut: { gt: now, lte: plafond },
    },
    // Les convocations des inscrits ACTIFS, pour décider en mémoire : la
    // condition « tous convoqués depuis ≥ 24 h » s'exprime mal en un seul
    // `where` Prisma lisible, et le volume (quelques sessions planifiées sous
    // J+7,5) rend le filtre applicatif gratuit — et testable à sec.
    select: {
      id: true,
      enrollments: {
        where: { ...inscriptionsActives() },
        select: { convocationEnvoyeeAt: true },
      },
    },
  });

  // La session saute son tour tant qu'UN inscrit actif n'a pas sa convocation
  // partie depuis 24 h — jamais convoqué compris : le cron de convocation est
  // horaire, il passera avant le prochain tour du rappel, et rappeler avant
  // d'avoir convoqué inverserait les deux pièces. Le rattrapage par état
  // (`rappelJ7EnvoyeAt: null`) représentera la session au passage suivant.
  const candidates = sessions.filter(
    (s) =>
      s.enrollments.length > 0 &&
      s.enrollments.every(
        (e) => e.convocationEnvoyeeAt !== null && e.convocationEnvoyeeAt < seuilConvocation24h,
      ),
  );

  // 🔑 CE QUE LE COMPTE À REBOURS RENDAIT INVISIBLE : les sessions qui ont
  // DÉMARRÉ sans que personne n'ait été rappelé. Sans cette ligne, le journal
  // dirait « 3 sessions traitées » sans jamais mentionner les cinq qui sont
  // passées à travers. Un chiffre qui ne compte que ses succès ne mesure rien.
  // 🔴 2026-08-24, cahier D5 — la MESURE est partagée avec la règle d'alerte
  // `rappel_j7_non_envoye`. Elle vivait ici seule, et son résultat n'allait
  // qu'au journal ; la règle en avait besoin. Écrire une seconde requête
  // jumelle aurait recréé la divergence que ce dépôt paie sans arrêt — c'est
  // exactement ce que `CONF-01` a fermé sur la trace de clôture.
  //
  // Le journal garde sa ligne : il sert au diagnostic d'un passage de cron,
  // l'alerte sert à la personne qui doit consigner l'écart. Les deux lisent la
  // même chose.
  const manquees = (await sessionsSansRappelJ7(now)).length;
  if (manquees > 0) {
    console.error(
      `[formation-crons] rappel-j7: ÉCART — ${manquees} session(s) des 30 derniers ` +
        "jours ont commencé sans qu'aucun rappel n'ait été envoyé (aucune trace " +
        "`rappelJ7EnvoyeAt`). Le rappel n'est plus envoyable pour elles.",
    );
  }

  let ok = 0;
  let ko = 0;

  for (const session of candidates) {
    try {
      // 🔴 `D5-1-C1` — le compteur ne compte plus un envoi qui n'est pas parti.
      // Ce cron n'écrit aucune trace en base (c'est le constat `D5-1-C2`, à
      // traiter à part) : le journal est donc le SEUL endroit où l'échec peut
      // se voir. Un « 12 rappels envoyés » qui en compte 3 réellement partis
      // ferme la seule fenêtre qui restait.
      if (await envoyerRappelJ7(session.id)) {
        ok++;
      } else {
        ko++;
      }
    } catch (err) {
      ko++;
      console.error(
        `[formation-crons] rappel-j7: erreur session ${session.id}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  console.log(
    `[formation-crons] rappel-j7: ${ok} sessions traitées, ${ko} erreurs ` +
      `(${sessions.length} candidats scannés, ${sessions.length - candidates.length} en attente ` +
      `des 24 h post-convocation)`,
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
      // 🔴 `D5-1-C1` (2026-08-20) — la trace n'est posée QUE si l'envoi est
      // réellement parti. `enqueueEmail` ne lève pas quand la file est absente
      // ou qu'une règle gare le message en corbeille : elle rend « non envoyé ».
      // Poser `envoyeAt` malgré tout écartait DÉFINITIVEMENT le destinataire du
      // rattrapage — la reconstitution littérale de l'incident « aucune
      // convocation jamais envoyée ».
      if (!(await envoyerSatisfactionJ1(enrollment.id))) {
        ko++;
        continue;
      }
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
      // 🔴 `D5-1-C1` (2026-08-20) — la trace n'est posée QUE si l'envoi est
      // réellement parti. `enqueueEmail` ne lève pas quand la file est absente
      // ou qu'une règle gare le message en corbeille : elle rend « non envoyé ».
      // Poser `envoyeAt` malgré tout écartait DÉFINITIVEMENT le destinataire du
      // rattrapage — la reconstitution littérale de l'incident « aucune
      // convocation jamais envoyée ».
      if (!(await envoyerSuiviJ30(enrollment.id))) {
        ko++;
        continue;
      }
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

    // Lot 14 (T3b) — notification GROUPÉE, par guichet.
    //
    // 🔴 Avant : une boucle qui appelait `notifierAlerteInterne` par alerte,
    // vers une adresse unique. À 400 alertes ouvertes c'était 400 e-mails dans
    // la même boîte — et une boîte qu'on n'ouvre plus ne garde rien. Désormais
    // un message par (guichet, code), au destinataire dérivé de l'acte.
    // Le périmètre notifié est INCHANGÉ (critiques + déblocages du parcours
    // vente) : ce lot change le routage et le groupage, pas le seuil.
    const envoi = await notifierAlertesGroupees();

    console.log(
      `[formation-crons] alertes: ${crees} créées, ${resolues} résolues, ` +
        `${envoi.messages} message(s) pour ${envoi.alertes} alerte(s)` +
        (envoi.sansGuichet > 0 ? `, ${envoi.sansGuichet} SANS GUICHET` : ""),
    );
    // Un repli n'est jamais tu : le guichet nominal n'a pas été servi, et
    // quelqu'un doit pouvoir l'apprendre autrement qu'en comparant des boîtes.
    for (const repli of envoi.replis) {
      console.warn(`[formation-crons] alertes: repli — ${repli}`);
    }
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
  // 🔴 PLUS DE FENÊTRE BASSE (2026-08-15). L'ancienne sélection ne retenait que
  // les sessions dont `dateDebut` tombait dans [J-5,5 ; J-4,5] au passage de
  // 08:00 UTC. Vérifié en base de production : sur tout l'historique, AUCUNE
  // convocation n'était jamais partie — et la cause n'était pas le cron, qui
  // tourne bien, mais cette fenêtre. Aucune session réelle n'a jamais existé
  // cinq jours avant son début : celle du 31/07 a été créée le 31/07 à 14h51
  // pour un début à 07h00, celle du 16/08 la veille. Une session créée À
  // L'INTÉRIEUR de sa propre fenêtre n'y entre jamais, et rien ne la rattrapait.
  //
  // Le plafond haut demeure : on ne convoque pas trois mois à l'avance, la
  // convocation porte les informations logistiques finales. Ce qui disparaît,
  // c'est le plancher — donc le cron RATTRAPE, chaque jour, tant que la session
  // n'a pas commencé.
  const plafond = new Date(now.getTime() + 5.5 * 24 * 60 * 60 * 1000);

  const enrollments = await prisma.enrollment.findMany({
    where: {
      statut: { in: ["planifiee", "presente"] },
      // L'ÉTAT, pas la date : tant que la colonne est nulle, l'inscription
      // reste candidate. Une exécution manquée (déploiement, coupure Redis)
      // cesse d'être définitive.
      convocationEnvoyeeAt: null,
      session: {
        statut: "planifiee",
        // Pas encore commencée : convoquer après coup fabriquerait une pièce
        // fausse. Ce cas relève d'un écart à consigner, pas d'un envoi.
        dateDebut: { gt: now, lte: plafond },
      },
    },
    select: { id: true },
  });

  let ok = 0;
  let ko = 0;

  for (const enrollment of enrollments) {
    try {
      // 🔴 `D5-1-C2` (2026-08-21) — la valeur de retour était JETÉE, et `ok++`
      // s'incrémentait quoi qu'il arrive. Les DONNÉES étaient saines (la trace
      // `convocationEnvoyeeAt` s'écrit dans la fonction, et seulement en cas de
      // succès : l'inscription restait candidate au rattrapage). Mais le
      // journal annonçait « N convocation(s) envoyée(s) » en comptant celles
      // qui n'étaient pas parties.
      //
      // ⚠️ C'est le dernier membre non aligné de la famille corrigée le
      // 2026-08-20 : six fonctions d'envoi rendent un booléen et leurs six
      // appels le lisent. Celle-ci rendait `void` parce que sa trace était déjà
      // juste — mais son APPELANT ne pouvait toujours pas distinguer un envoi
      // d'un échec, et c'est ce qu'un opérateur lit le matin.
      if (await envoyerConvocation(enrollment.id)) {
        ok++;
      } else {
        ko++;
      }
    } catch (err) {
      ko++;
      console.error(
        `[formation-crons] convocation-j5: erreur enrollment ${enrollment.id}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  // ⚠️ Ce que le cron ne peut PAS rattraper, il le DIT. Une session déjà
  // commencée sans convocation est un écart d'indicateur 9 : il se consigne, il
  // ne se répare pas par un envoi antidaté.
  const manquees = await prisma.enrollment.count({
    where: {
      statut: { in: ["planifiee", "presente"] },
      convocationEnvoyeeAt: null,
      session: { dateDebut: { lte: now }, statut: { in: ["planifiee", "en_cours", "realisee"] } },
    },
  });
  if (manquees > 0) {
    console.error(
      `[formation-crons] convocation-j5: ${manquees} inscription(s) dont la session a DÉMARRÉ sans convocation — ` +
        `écart ind. 9 à consigner, aucun envoi rétroactif ne le répare`,
    );
  }

  console.log(
    `[formation-crons] convocation-j5: ${ok} convocation(s) envoyée(s), ${ko} erreur(s) ` +
      `(${enrollments.length} inscription(s) candidate(s), ${manquees} déjà démarrée(s) sans convocation)`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Positionnement — recueil et relances AVANT l'entrée en formation (ind. 8)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Envoie les positionnements jamais partis, relance ceux restés sans réponse.
 *
 * 🔴 Le défaut : le positionnement partait UNE fois, à la conclusion de la
 * pièce contractuelle, et plus rien ensuite. Un stagiaire silencieux n'était
 * jamais relancé, et le jour de la formation arrivait sans que le besoin ait
 * été recueilli. Devant un auditeur, une non-réponse du stagiaire n'est pas une
 * faute de l'organisme — l'absence de tentative tracée, si.
 *
 * ⚠️ Aucune fenêtre basse, exactement comme la convocation : le critère est
 * l'ÉTAT du questionnaire, pas la distance à une date. Une exécution manquée
 * cesse d'être définitive. La décision vit dans `relance-positionnement.ts`.
 */
async function handlePositionnement(): Promise<void> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    console.log("[formation-crons] positionnement: stub DB, skip");
    return;
  }

  const now = new Date();
  const plafond = new Date(now.getTime() + (HORIZON_JOURS + 0.5) * 24 * 60 * 60 * 1000);

  const candidats = await prisma.questionnaire.findMany({
    where: {
      type: "positionnement",
      // L'ÉTAT : tant que personne n'a répondu, le questionnaire reste candidat.
      reponduAt: null,
      enrollment: {
        statut: { in: ["planifiee", "presente"] },
        session: {
          statut: "planifiee",
          // Pas encore commencée. Un positionnement recueilli après le début ne
          // mesure plus le besoin d'entrée : la pièce serait datée et FAUSSE.
          dateDebut: { gt: now, lte: plafond },
        },
      },
    },
    select: {
      id: true,
      envoyeAt: true,
      reponduAt: true,
      relanceCount: true,
      derniereRelanceAt: true,
      enrollment: { select: { session: { select: { dateDebut: true } } } },
    },
  });

  let envoyes = 0;
  let relances = 0;
  let ko = 0;

  for (const q of candidats) {
    const geste = gestePositionnement({
      envoyeAt: q.envoyeAt,
      reponduAt: q.reponduAt,
      relanceCount: q.relanceCount,
      derniereRelanceAt: q.derniereRelanceAt,
      dateDebut: q.enrollment.session.dateDebut,
      maintenant: now,
    });
    if (geste === "rien") continue;

    try {
      // 🔴 `D5-1-C1` (2026-08-20) — la trace n'est posée QUE si l'envoi est
      // réellement parti. `enqueueEmail` ne lève pas quand la file est absente
      // ou qu'une règle gare le message en corbeille : elle rend « non envoyé ».
      // Poser `envoyeAt` malgré tout écartait DÉFINITIVEMENT le destinataire du
      // rattrapage — la reconstitution littérale de l'incident « aucune
      // convocation jamais envoyée ».
      if (!(await envoyerPositionnement(q.id))) {
        ko++;
        continue;
      }
      if (geste === "relancer") {
        // 🔴 La trace de la relance EST la preuve. Sans elle, on ne saurait ni
        // combien de fois on a tenté, ni quand — et le plafond ne tiendrait pas.
        await prisma.questionnaire.update({
          where: { id: q.id },
          data: { relanceCount: { increment: 1 }, derniereRelanceAt: now },
        });
        relances++;
      } else {
        // 🔴 SANS CETTE ÉCRITURE, le cron renvoyait le MÊME e-mail chaque matin.
        //
        // `gestePositionnement` décide sur l'ÉTAT : tant que `envoyeAt` est nul,
        // il rend « envoyer ». La branche ne posait rien — donc, sur l'horizon de
        // 15 jours, jusqu'à quinze e-mails identiques au stagiaire, et la branche
        // « relancer » jamais atteinte : le plafond de 2 ne bornait rien.
        //
        // Posée APRÈS l'enqueue, comme convocation / satisfaction-j1 : marquer
        // avant ferait mentir la colonne si la file est indisponible, et le
        // rattrapage ne reviendrait jamais. Le `envoyeAt: null` du `where` ferme
        // la course entre deux passages concurrents.
        //
        // `updateMany` et non `update`, comme satisfaction-j1 (l. ~547) et
        // enquete-entreprise-j30 : à zéro ligne touchée — un autre passage a
        // déjà marqué — `update` lèverait P2025, que le `catch` compterait en
        // `ko` et journaliserait comme une erreur, ALORS QUE L'E-MAIL EST PARTI.
        // Le compteur mentirait sur un envoi réussi. `updateMany` est muet.
        await prisma.questionnaire.updateMany({
          where: { id: q.id, envoyeAt: null },
          data: { envoyeAt: now },
        });
        envoyes++;
      }
    } catch (err) {
      ko++;
      console.error(
        `[formation-crons] positionnement: erreur questionnaire ${q.id}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  // ⚠️ Ce que le cron ne peut PAS rattraper, il le DIT — même règle que la
  // convocation. Une session démarrée sans positionnement recueilli est un
  // écart d'indicateur 8 : il se consigne, il ne se répare pas par un envoi.
  const manques = await prisma.questionnaire.count({
    where: {
      type: "positionnement",
      reponduAt: null,
      enrollment: {
        statut: { in: ["planifiee", "presente"] },
        session: { dateDebut: { lte: now }, statut: { in: ["planifiee", "en_cours", "realisee"] } },
      },
    },
  });
  if (manques > 0) {
    console.error(
      `[formation-crons] positionnement: ${manques} inscription(s) dont la session a DÉMARRÉ sans ` +
        `positionnement recueilli — écart ind. 8 à consigner, aucun envoi rétroactif ne le répare`,
    );
  }

  console.log(
    `[formation-crons] positionnement: ${envoyes} envoi(s), ${relances} relance(s), ${ko} erreur(s) ` +
      `(${candidats.length} candidat(s), ${manques} session(s) démarrée(s) sans réponse)`,
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
      // 🔴 M7 (2026-08-27) — LE DÉBITEUR DÉCIDE DE QUI L'ON RÉCLAME.
      //
      // Sur une facture libellée à un financeur (subrogation), l'OPCO règle
      // l'organisme DIRECTEMENT : le client ne doit rien pour ce montant.
      // Mesuré en dev, ce cron proposait pourtant de le relancer — même
      // facture, même palier, aucune mention du financeur. L'opérateur qui
      // traitait sa pile n'avait aucun signal.
      //
      // ⚠️ On ne SUPPRIME pas la proposition : la créance existe toujours,
      // simplement l'OPCO en est le débiteur. La faire disparaître remplacerait
      // un mauvais rappel par un impayé INVISIBLE — pire.
      //
      // 🔑 Ces quatre champs ne sont pas choisis ici : ce sont EXACTEMENT ceux
      // que `resoudreDestinataireRelance` consomme. La proposition et l'envoi
      // dérivent ainsi du même résolveur — une note qui annonce l'OPCO est une
      // note dont l'envoi partira à l'OPCO. Deux dérivations séparées auraient
      // fini par se contredire, et c'est le pire des deux mondes : un écran qui
      // dit une chose et un e-mail qui en fait une autre.
      destinataire: true,
      destinataireNom: true,
      dossierFinancement: {
        select: {
          financeurNom: true,
          financeurContactNom: true,
          financeurContactEmail: true,
          numeroDossierExterne: true,
          subrogation: true,
        },
      },
      // Délai de paiement propre au client (F61) — base de la réparation.
      // `raisonSociale` / `opcoIdentifie` : consommés par le résolveur.
      client: {
        select: {
          delaiPaiementJours: true,
          raisonSociale: true,
          opcoIdentifie: true,
          contactNom: true,
          contactEmail: true,
        },
      },
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
  // M7 : combien de propositions visent l'OPCO et non le client.
  let subrogees = 0;
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
    // 🔴 M7 — LE DÉBITEUR, PAS SEULEMENT LA CRÉANCE.
    //
    // En subrogation, la relance change de destinataire : c'est le DOSSIER
    // FINANCEUR qu'on relance, pas le client. Le type `dossier_financeur`
    // existait déjà dans l'énumération et n'était produit nulle part — il est
    // fait pour ce cas.
    //
    // La note d'écran nomme explicitement le financeur et le dossier, pour que
    // l'opérateur ne puisse pas cliquer « relancer » en croyant s'adresser au
    // client. Sans elle, la seule différence serait un champ en base que
    // personne ne lit.
    const debiteur = resoudreDestinataireRelance({
      destinataire: f.destinataire,
      destinataireNom: f.destinataireNom,
      dossier: f.dossierFinancement,
      client: f.client,
    });
    const subroge = debiteur.qualite === "financeur";
    const solde = `${(netDuCents / 100).toFixed(2)} € TTC`;
    const echeanceFr = echeance.toLocaleDateString("fr-FR");

    await prisma.relanceProposee.create({
      data: {
        type: subroge ? "dossier_financeur" : "facture_retard",
        palier,
        factureFormationId: f.id,
        // ⚠️ Note INTERNE, affichée à l'admin dans le hub. Elle n'est PLUS le
        // corps de l'e-mail envoyé au client (ce jargon partait tel quel) : la
        // rédaction vit dans le gabarit `qualiopi-relance-impayee`, choisie par
        // le ton du palier.
        // 🔑 `debiteur.precision` et `debiteur.empechement` viennent du
        // résolveur, pas d'une phrase réécrite ici. L'empêchement mérite d'être
        // ANNONCÉ dès la proposition : sans contact financeur connu, l'envoi
        // sera refusé au clic — le dire maintenant évite un aller-retour, et
        // désigne le travail réel (renseigner le gestionnaire du dossier).
        // ⚠️ `debiteur.nom` est le nom du GESTIONNAIRE quand le dossier en porte
        // un (« M. Dupont ») — il n'a rien à faire dans « le règlement est dû
        // par … » : ce n'est pas lui qui doit, c'est son organisme. C'est
        // `precision` qui nomme le financeur ET le dossier.
        suggestion: subroge
          ? `SUBROGATION OPCO — ne pas relancer le client. Facture ${f.numero}, solde de ${solde} ` +
            `échu le ${echeanceFr} : le règlement est dû par le FINANCEUR, à relancer sur le ` +
            `dossier de financement — ${libellePalier(palier)}. ${debiteur.precision ?? ""}` +
            (debiteur.empechement !== null
              ? " ⚠️ Aucun e-mail de gestionnaire connu : l'envoi sera refusé tant que le dossier n'en porte pas."
              : "")
          : `Facture ${f.numero} — solde de ${solde} échu le ${echeanceFr} — ${libellePalier(palier)}.`,
      },
    });
    if (subroge) subrogees++;
    proposees++;
  }

  console.log(
    `[formation-crons] factures-retard: ${marquees} passée(s) en retard, ${proposees} relance(s) proposée(s) ` +
      `dont ${subrogees} vers l'OPCO (subrogation), ${echeancesReparees} échéance(s) manquante(s) reconstituée(s) ` +
      `— AUCUN email : toute relance d'impayé est déclenchée A LA MAIN`,
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
      // 🔴 Le positionnement a son PROPRE canal (`formation-crons.positionnement`).
      //
      // Il est devenu éligible ici le jour où l'envoi initial a enfin posé
      // `envoyeAt`. Or ce cron-ci ne connaît QUE la distance à l'envoi : il
      // ignore la date de début de session, et relancerait donc un
      // positionnement jusqu'à 90 jours APRÈS le début — voire après la fin — de
      // la formation. `gestePositionnement` l'interdit explicitement : recueilli
      // après le début, le positionnement ne mesure plus le besoin d'entrée, la
      // pièce serait datée et FAUSSE. Deux calendriers sur le même compteur
      // rendraient de surcroît la trace inexplicable devant un auditeur (1ʳᵉ
      // relance à J+3 ou J+4 selon le cron qui a gagné la course).
      type: { not: "positionnement" },
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
      // 🔴 `D5-1-C1` — le compteur suit l'envoi RÉEL. La trace `relanceCount`,
      // elle, est posée dans le service APRÈS vérification : un envoi qui
      // échoue n'épuise donc plus le plafond de deux relances. Sans cela, la
      // voie de relance se fermait sans qu'un seul message soit parti.
      if (await envoyerRelanceQuestionnaire(q.id)) {
        ok++;
      } else {
        ko++;
      }
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
      // 🔴 2026-08-26 — `type: "entreprise"` AJOUTÉ. La sélection ne portait
      // que sur `contactEmail`, jamais sur le TYPE du client. Mesuré en dev :
      // « Camille Berger », client PARTICULIER, recevait l'enquête. Et le
      // gabarit n'a rien de neutre — il dit « Votre avis d'entreprise
      // cliente », « ce que votre entreprise a pensé », « les effets attendus
      // dans votre activité ». Un particulier qui a payé SA PROPRE formation
      // se voyait donc demander ce que son entreprise pensait du stage de son
      // salarié.
      //
      // Deux dégâts, pas un : la personne reçoit un message absurde, ET la
      // mesure « satisfaction entreprise » se remplit de réponses qui ne
      // viennent d'aucune entreprise — un indicateur Qualiopi pollué à sa
      // source.
      client: { type: "entreprise", contactEmail: { not: null } },
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
      // 🔴 `D5-1-C1` (2026-08-20) — la trace n'est posée QUE si l'envoi est
      // réellement parti. `enqueueEmail` ne lève pas quand la file est absente
      // ou qu'une règle gare le message en corbeille : elle rend « non envoyé ».
      // Poser `envoyeAt` malgré tout écartait DÉFINITIVEMENT le destinataire du
      // rattrapage — la reconstitution littérale de l'incident « aucune
      // convocation jamais envoyée ».
      if (!(await envoyerEnqueteEntreprise(session.id))) {
        ko++;
        continue;
      }
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
    where: {
      statut: "envoye",
      sentAt: { not: null, lte: new Date(now.getTime() - 3 * 86_400_000) },
    },
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

/**
 * Fraîcheur des offres d'emploi (hebdo lundi 08:15). Détecte les offres dont le
 * datePosted effectif (celui du JSON-LD Google for Jobs) dépasse le seuil et le
 * rappelle sur Telegram (groupe 💼 Candidatures). La republication reste un clic
 * HUMAIN en console (« Republier ») — jamais de rafraîchissement automatique de
 * date sans retouche réelle de l'offre (fausse fraîcheur = pénalité Google).
 */
async function handleOffresFraicheur(): Promise<void> {
  const { listStaleJobPostings, JOB_OFFER_FRESHNESS_MAX_DAYS } =
    await import("@/server/careers/freshness");
  const stale = await listStaleJobPostings(new Date());
  if (stale.length === 0) {
    console.log("[formation-crons] offres-fraicheur: 0 offre à republier");
    return;
  }
  const { notify } = await import("@/server/notifications");
  await notify({
    category: "JOB_OFFERS_STALE",
    payload: {
      thresholdDays: JOB_OFFER_FRESHNESS_MAX_DAYS,
      offers: stale.map((o) => ({ title: o.title, daysOld: o.daysOld, kind: o.kind })),
    },
    // Un rappel par jour maximum, même si le job est rejoué (retry BullMQ).
    dedupKey: `job-offers-stale-${new Date().toISOString().slice(0, 10)}`,
  });
  console.log(
    `[formation-crons] offres-fraicheur: ${stale.length} offre(s) > ${JOB_OFFER_FRESHNESS_MAX_DAYS} j signalée(s) sur Telegram`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// J-0 — les liens de signature partent le matin même
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Émet et envoie les liens de signature des sessions qui COMMENCENT aujourd'hui.
 *
 * 🔴 Pourquoi ce cron existe. Sur le premier dossier réel, AXI-SESS-2026-005,
 * la stagiaire n'a jamais pu émarger : l'émission des liens était un geste
 * manuel, sur un écran qu'il fallait penser à ouvrir le bon jour. Rien ne le
 * rappelait, et la seule alerte possible se levait trois jours plus tard, soit
 * un jour après l'expiration des jetons.
 *
 * La frontière du plan est respectée : **envoyer un lien de signature n'engage
 * pas l'organisme** — c'est SIGNER qui engage, et signer reste le geste du
 * stagiaire. L'automatiser est donc légitime, au même titre que la convocation.
 *
 * ⚠️ LA GARDE QUI COMPTE : on ne traite QUE les sessions dont AUCUN inscrit
 * actif n'a de jeton vivant. Sans elle, une session de trois jours verrait ses
 * liens réémis chaque matin — et comme toute émission révoque la précédente,
 * les stagiaires arriveraient le jour 2 avec un lien mort dans leur boîte,
 * pendant que la console afficherait « liens émis ». Le remède aurait fabriqué
 * une panne plus subtile que la maladie.
 *
 * ⚠️ Une session sans journée déclarée n'est PAS forcée : `creerTokenInscription`
 * refuse, et il a raison — une feuille sans horaires réels est insuffisamment
 * probante. Le cron le journalise ; l'alerte `session_sans_dispositif_emargement`
 * le rend visible dans la console le jour même.
 */
async function handleLiensEmargementJ0(): Promise<void> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    console.log("[formation-crons] liens-emargement-j0: stub DB, skip");
    return;
  }

  const now = new Date();
  // 🔴 S5 (2026-08-26) — PLUS DE FENÊTRE JOUR UTC (résidu M2). L'ancienne
  // sélection était `dateDebut ∈ [minuit UTC ; minuit+24h[` au SEUL passage de
  // 06:00 : une session créée à 10 h pour l'après-midi — le cas ordinaire, cf.
  // AXI-SESS-2026-005 — ne rencontrait aucun passage avant son démarrage, et
  // la stagiaire ne pouvait pas émarger. Même correctif que convocation-j5
  // (queues.ts en documente le motif) : le cron passe à l'HORAIRE, et la
  // sélection devient un ÉTAT — session qui commence aujourd'hui OU commencée
  // depuis moins de 24 h, sans jeton vivant. La garde anti-réémission
  // ci-dessous fait qu'un passage horaire ne réémet jamais des liens vivants.
  const finJour = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0) +
      24 * 60 * 60 * 1000,
  );
  const borneBasse24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const sessions = await prisma.trainingSession.findMany({
    where: {
      statut: { in: ["planifiee", "en_cours"] },
      dateDebut: { gte: borneBasse24h, lt: finJour },
      AND: [
        { enrollments: { some: { ...inscriptionsActives() } } },
        // La garde anti-réémission : personne n'a de lien vivant.
        {
          enrollments: {
            none: { emargementTokens: { some: { revokedAt: null, expiresAt: { gt: now } } } },
          },
        },
      ],
    },
    select: { id: true, numero: true, _count: { select: { jours: true } } },
    take: 50,
  });

  let traitees = 0;
  let sansJournees = 0;
  let enEchec = 0;

  for (const session of sessions) {
    if (session._count.jours === 0) {
      sansJournees++;
      console.error(
        `[formation-crons] liens-emargement-j0: ${session.numero} commence aujourd'hui SANS journée déclarée — ` +
          `aucun lien ne peut être émis, personne ne pourra signer. Déclarez les journées puis envoyez les liens.`,
      );
      continue;
    }
    try {
      // ⚠️ Import DYNAMIQUE, et pas en tête de fichier. `envoi-liens.ts` tire
      // `queues.ts`, qui instancie une file BullMQ au chargement du module. En
      // tête, il entrerait dans le graphe de CE fichier — que plusieurs specs
      // chargent en simulant `notifications-service` pour couper précisément
      // cette chaîne. Elles se sont mises à échouer au collect, sur un module
      // qu'elles ne testent pas. Même raisonnement que le commentaire de
      // `types.ts` sur le cycle worker ↔ queues.
      const { envoyerLiensPourSession } = await import("@/server/qualiopi/emargement/envoi-liens");
      const r = await envoyerLiensPourSession({ sessionId: session.id, origine: "cron-j0" });
      if (r.ok) {
        traitees++;
        if (r.echecs.length > 0) {
          console.error(
            `[formation-crons] liens-emargement-j0: ${session.numero} — ${r.echecs.length} stagiaire(s) sans lien : ` +
              r.echecs.map((e) => `${e.stagiaireNom} (${e.motif})`).join(" · "),
          );
        }
      } else {
        enEchec++;
        console.error(`[formation-crons] liens-emargement-j0: ${session.numero} — ${r.motif}`);
      }
    } catch (err) {
      enEchec++;
      console.error(
        `[formation-crons] liens-emargement-j0: erreur session ${session.numero}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  console.log(
    `[formation-crons] liens-emargement-j0: ${traitees} session(s) servie(s), ` +
      `${sansJournees} sans journée déclarée, ${enEchec} en échec ` +
      `(${sessions.length} session(s) sans lien vivant, démarrant aujourd'hui ou depuis < 24 h)`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Cycle de vie du FORMATEUR sur une session (2026-09-03)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Quotidien 08:10 UTC — relance les propositions de mission sans réponse
 * depuis trois jours (une fois), puis expire celles dont la session a démarré.
 * Tout le travail vit dans le service : le cron ne fait que l'appeler et dire
 * ce qui s'est passé.
 */
async function handleMissionsFormateur(): Promise<void> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    console.log("[formation-crons] missions-formateur: stub DB, skip");
    return;
  }
  const bilan = await relancerEtExpirerMissions(new Date());
  console.log(
    `[formation-crons] missions-formateur: ${bilan.relancees} relance(s) envoyée(s), ` +
      `${bilan.sansReponse} sans réponse dans le délai (session libérée), ` +
      `${bilan.expirees} proposition(s) expirée(s), ${bilan.erreurs} erreur(s)`,
  );
}

/**
 * Sélection par ÉTAT, pas par date : les affectations d'une session planifiée
 * qui démarre dans la fenêtre et dont la trace d'envoi est vide. Une
 * affectation posée à J-3 reçoit donc sa convocation au passage suivant — au
 * lieu de la manquer parce que « J-7 est passé ».
 */
/**
 * 🔴 Deux messages d'infos pratiques le MÊME JOUR ne renseignent qu'une fois.
 *
 * Les deux crons sélectionnent indépendamment, sur deux champs distincts et
 * dans deux fenêtres qui se CHEVAUCHENT (7,5 j et 36 h). Une affectation posée
 * à J-1 tombe donc dans les deux : le formateur reçoit la convocation le matin,
 * puis le rappel quelques heures plus tard — et les deux gabarits partagent le
 * même `InfosPratiquesFormateurBloc`, donc c'est deux fois le même contenu.
 *
 * Ce n'est pas une perte d'information (rien ne manque jamais au formateur,
 * quel que soit celui des deux qui part), c'est une perte de crédit : un
 * expéditeur qui écrit deux fois la même chose dans la journée se fait filtrer,
 * et le message de la veille au soir — le seul qu'on veut vraiment voir lu —
 * arrive derrière un doublon.
 */
const DELAI_ANTI_DOUBLON_MS = 24 * 60 * 60 * 1000;

async function affectationsAConvoquer(
  now: Date,
  fenetreMs: number,
  trace: "convocationJ7EnvoyeeAt" | "rappelJ1EnvoyeAt",
): Promise<Array<{ id: string }>> {
  const plafond = new Date(now.getTime() + fenetreMs);

  /**
   * La condition est ASYMÉTRIQUE, et c'est voulu.
   *
   * - Le RAPPEL se tait si la convocation est partie il y a moins de 24 h. Au
   *   delà, il reprend son rôle : une convocation vieille de cinq jours ne
   *   dispense pas de rappeler la veille.
   * - La CONVOCATION se tait dès que le rappel est parti, sans condition de
   *   délai. Le rappel ne part qu'à moins de 36 h du début ; une convocation
   *   qui suivrait arriverait forcément APRÈS lui, pour annoncer un événement
   *   déjà annoncé. Il n'existe aucun délai qui la rende de nouveau utile.
   *
   * On filtre à la SÉLECTION plutôt que de poser la trace de l'autre message :
   * écrire `rappelJ1EnvoyeAt` sans avoir envoyé de rappel ferait mentir la
   * seule colonne où l'on relit ce que le formateur a reçu — et cette colonne
   * est lue ailleurs, notamment par l'alerte `session_contact_sur_place_absent`
   * pour savoir si l'e-mail muet est déjà parti.
   */
  const pasDeDoublon =
    trace === "rappelJ1EnvoyeAt"
      ? {
          OR: [
            { convocationJ7EnvoyeeAt: null },
            {
              convocationJ7EnvoyeeAt: {
                lt: new Date(now.getTime() - DELAI_ANTI_DOUBLON_MS),
              },
            },
          ],
        }
      : { rappelJ1EnvoyeAt: null };

  const affectations = await prisma.sessionFormateur.findMany({
    where: {
      [trace]: null,
      ...pasDeDoublon,
      session: { statut: "planifiee", dateDebut: { gt: now, lte: plafond } },
    },
    select: {
      id: true,
      sessionId: true,
      trainerId: true,
      trainer: { select: { statut: true } },
    },
  });
  if (affectations.length === 0) return [];

  /**
   * 🔴 LE FILTRE QUI MANQUAIT (constaté en production le 2026-09-04).
   *
   * Cette sélection ne regardait QUE `SessionFormateur` et les dates. Le statut
   * de la MISSION — proposée, acceptée, refusée — n'était consulté nulle part.
   * Résultat observé sur AXI-SESS-2026-001 : proposition envoyée à 16h30
   * (« acceptez-vous d'animer cette session ? »), rappel de la veille envoyé à
   * 16h40 (« votre session de demain, voici les informations pratiques »). Dix
   * minutes d'écart, au même destinataire, qui n'avait rien accepté.
   *
   * Ce n'est pas qu'une maladresse de ton : envoyer les informations pratiques
   * d'une session à quelqu'un qui ne l'a pas acceptée lui fait croire que
   * l'affaire est conclue, et l'organisme perd le signal qui lui disait de
   * chercher quelqu'un d'autre.
   *
   * La règle : on informe quand l'accord n'est PAS requis (salarié,
   * dirigeant-formateur — cf. `accordRequis`), ou quand il a été DONNÉ. Un
   * sous-traitant silencieux ne reçoit rien tant qu'il n'a pas répondu.
   */
  const aAccepte = new Set(
    (
      await prisma.missionFormateur.findMany({
        where: {
          statut: "acceptee",
          OR: affectations.map((a) => ({ sessionId: a.sessionId, trainerId: a.trainerId })),
        },
        select: { sessionId: true, trainerId: true },
      })
    ).map((m) => `${m.sessionId}|${m.trainerId}`),
  );

  return affectations
    .filter((a) => !accordRequis(a.trainer.statut) || aAccepte.has(`${a.sessionId}|${a.trainerId}`))
    .map((a) => ({ id: a.id }));
}

async function traiterAffectations(
  quoi: "formateur-convocation-j7" | "formateur-rappel-j1",
  affectations: Array<{ id: string }>,
  envoyer: (id: string) => Promise<boolean>,
): Promise<void> {
  let ok = 0;
  let ko = 0;
  for (const a of affectations) {
    try {
      if (await envoyer(a.id)) ok++;
      else ko++;
    } catch (err) {
      ko++;
      console.error(
        `[formation-crons] ${quoi}: erreur affectation ${a.id}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }
  console.log(
    `[formation-crons] ${quoi}: ${ok} envoyé(s), ${ko} erreur(s) (${affectations.length} candidat(s))`,
  );
}

/** Quotidien 08:05 UTC — convocation pratique J-7 du formateur. */
async function handleFormateurConvocationJ7(): Promise<void> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    console.log("[formation-crons] formateur-convocation-j7: stub DB, skip");
    return;
  }
  const now = new Date();
  const affectations = await affectationsAConvoquer(
    now,
    FENETRE_CONVOCATION_J7_JOURS * 24 * 60 * 60 * 1000,
    "convocationJ7EnvoyeeAt",
  );
  await traiterAffectations(
    "formateur-convocation-j7",
    affectations,
    envoyerConvocationJ7Formateur,
  );
}

/** Horaire — rappel J-1 du formateur, dans les 36 h précédant le démarrage. */
async function handleFormateurRappelJ1(): Promise<void> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    console.log("[formation-crons] formateur-rappel-j1: stub DB, skip");
    return;
  }
  const now = new Date();
  const affectations = await affectationsAConvoquer(
    now,
    FENETRE_RAPPEL_J1_HEURES * 60 * 60 * 1000,
    "rappelJ1EnvoyeAt",
  );
  await traiterAffectations("formateur-rappel-j1", affectations, envoyerRappelJ1Formateur);
}

// ─────────────────────────────────────────────────────────────────────────────
// Rappel de la VEILLE au STAGIAIRE — ADR 0048 §4.3
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fenêtre du rappel stagiaire de la veille : 30 h.
 *
 * Volontairement plus large que 24 h. Le cron est horaire ; à exactement 24 h,
 * une session qui démarre à 09:00 ne deviendrait candidate qu'au passage de
 * 09:45 la veille, et le message arriverait le matin même pour une séance de
 * l'après-midi — ce qui n'est plus « la veille ». 30 h garantit un passage en
 * fin de journée précédente quelle que soit l'heure de démarrage.
 */
const FENETRE_RAPPEL_J1_STAGIAIRE_HEURES = 30;

/**
 * Anti-doublon avec le rappel J-7 — DEUX HEURES, et non vingt-quatre.
 *
 * ⚠️ C'est l'arbitrage INVERSE de `DELAI_ANTI_DOUBLON_MS` (24 h) qui gouverne
 * les deux e-mails du formateur, et l'écart est délibéré.
 *
 * Côté formateur, les deux messages partagent le même bloc d'informations
 * pratiques : le second n'apporte rien, et 24 h de silence ne coûtent rien.
 * Côté stagiaire, le rappel de la veille porte quelque chose que le J-7 ne
 * porte PAS — le lien de connexion en entier. Un délai de 24 h créerait donc un
 * trou exact : une session créée moins de 24 h avant son début reçoit son
 * rappel J-7 le matin, et n'aurait jamais son lien de connexion. C'est
 * précisément le cas ordinaire dans ce dépôt (session du 31/07 créée le 31/07).
 *
 * Deux heures suffisent à ce que les deux messages ne tombent pas dans la même
 * boîte à la même minute, sans jamais fermer la porte au seul message qui dit
 * comment entrer.
 */
const DELAI_ANTI_DOUBLON_J1_STAGIAIRE_MS = 2 * 60 * 60 * 1000;

/**
 * Horaire — rappel de la veille aux STAGIAIRES d'une session qui démarre.
 *
 * 🔴 Pas de colonne d'état sur `TrainingSession`, contrairement au rappel J-7,
 * et c'est un choix motivé : l'idempotence ET la preuve sont déjà portées par
 * `email_logs`, une ligne par `jobId` posée dès l'enfilage et lue par
 * `envoyerRappelJ1`. Ajouter une colonne redirait ce que le journal dit,
 * imposerait une migration, et surtout ouvrirait la fenêtre décrite dans
 * `AGENTS.md` — le worker atterrit ~50 min AVANT l'app qui applique les
 * migrations, donc un cron horaire qui lirait une colonne fraîchement migrée
 * échouerait à chaque passage pendant cette heure-là.
 *
 * Le rattrapage est donc par la FENÊTRE (30 h) et non par l'état : chaque
 * passage horaire représente toute session encore non prévenue.
 */
async function handleRappelJ1(): Promise<void> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    console.log("[formation-crons] rappel-j1: stub DB, skip");
    return;
  }

  const now = new Date();
  const plafond = new Date(now.getTime() + FENETRE_RAPPEL_J1_STAGIAIRE_HEURES * 60 * 60 * 1000);
  const seuilAntiDoublon = new Date(now.getTime() - DELAI_ANTI_DOUBLON_J1_STAGIAIRE_MS);

  const sessions = await prisma.trainingSession.findMany({
    where: {
      statut: "planifiee",
      // Pas encore commencée : rappeler après coup n'informe plus personne.
      dateDebut: { gt: now, lte: plafond },
      // Jamais dans la même heure que le rappel J-7 — voir la constante.
      OR: [{ rappelJ7EnvoyeAt: null }, { rappelJ7EnvoyeAt: { lt: seuilAntiDoublon } }],
    },
    select: { id: true },
  });

  let ok = 0;
  let ko = 0;
  for (const session of sessions) {
    try {
      if (await envoyerRappelJ1(session.id)) ok++;
      else ko++;
    } catch (err) {
      ko++;
      console.error(
        `[formation-crons] rappel-j1: erreur session ${session.id}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  // On journalise CHAQUE passage, même vide : un cron dont on ne voit que les
  // envois ne se distingue pas d'un cron qui ne tourne plus.
  console.log(
    `[formation-crons] rappel-j1: ${ok} session(s) traitée(s), ${ko} en écart ` +
      `(${sessions.length} candidate(s) sous ${FENETRE_RAPPEL_J1_STAGIAIRE_HEURES} h)`,
  );
}

/**
 * Rappels d'entretien — J-1 et H-1, deux passages par tick.
 *
 * 🔑 Import PARESSEUX du module de rappels : il touche `prisma` et la file, et
 * ce fichier est chargé par le worker au démarrage. Le charger en tête ferait
 * ouvrir une connexion pour un cron qui ne tourne peut-être jamais.
 */
async function handleRappelsEntretien(): Promise<void> {
  const { envoyerRappelsEntretien } = await import("@/server/careers/rappels-entretien");
  const passages = await envoyerRappelsEntretien();
  for (const r of passages) {
    // 🔴 On journalise CHAQUE passage, même vide. Un cron dont on ne voit que
    // les envois ne se distingue pas d'un cron qui ne tourne plus.
    const alerte = r.echecs > 0 || r.adressesIllisibles > 0 || r.plafondAtteint;
    const ligne =
      `[formation-crons] rappels-entretien ${r.moment}: ` +
      `${r.candidats} candidat(s), ${r.envoyes} envoyé(s), ${r.echecs} échec(s)` +
      (r.adressesIllisibles > 0 ? `, ${r.adressesIllisibles} adresse(s) illisible(s)` : "") +
      (r.plafondAtteint ? " — PLAFOND ATTEINT" : "");
    if (alerte) console.error(ligne);
    else console.log(ligne);
  }
}

/**
 * Quotidien — les candidatures oubliées, signalées sur Telegram.
 *
 * 🔴 CE CRON N'ÉCRIT RIEN SUR LES DOSSIERS. Il ne change aucun statut, il
 * n'envoie rien au candidat, il n'archive personne. Un « rattrapage
 * automatique » écrirait à la place du recruteur des réponses qu'il n'a pas
 * relues — et le premier refus expédié par une machine coûterait plus cher que
 * tous les oublis qu'il prétend corriger.
 *
 * 🔑 Import PARESSEUX : le module touche `prisma` et le moteur de
 * notifications, et ce fichier est chargé au démarrage du worker.
 */
async function handleCandidaturesEnSommeil(): Promise<void> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    console.log("[formation-crons] candidatures-en-sommeil: stub DB, skip");
    return;
  }
  const { signalerDossiersEnSommeil } = await import("@/server/careers/dossiers-en-sommeil");
  const bilan = await signalerDossiersEnSommeil(new Date());
  // On journalise même quand il n'y a rien : un cron dont on ne voit que les
  // alertes ne se distingue pas d'un cron qui ne tourne plus.
  const ligne =
    `[formation-crons] candidatures-en-sommeil: ${bilan.dossiers.length} dossier(s) — ` +
    `${bilan.parMotif.jamais_repondu} jamais répondu, ${bilan.parMotif.sans_activite} sans activité` +
    (bilan.plafondAtteint ? " — PLAFOND D'EXAMEN ATTEINT" : "");
  if (bilan.plafondAtteint) console.error(ligne);
  else console.log(ligne);
}

const HANDLERS: Record<FormationCronJobType, () => Promise<void>> = {
  "formation-crons.date-debut": handleDateDebut,
  "formation-crons.positionnement": handlePositionnement,
  "formation-crons.cloture-auto": handleClotureAuto,
  "formation-crons.attestations-auto": handleAttestationsAuto,
  "formation-crons.rappel-j7": handleRappelJ7,
  "formation-crons.satisfaction-j1": handleSatisfactionJ1,
  "formation-crons.suivi-j30": handleSuiviJ30,
  "formation-crons.relance-questionnaires": handleRelanceQuestionnaires,
  "formation-crons.enquete-entreprise-j30": handleEnqueteEntrepriseJ30,
  "formation-crons.alertes": handleAlertes,
  "formation-crons.convocation-j5": handleConvocationJ5,
  "formation-crons.liens-emargement-j0": handleLiensEmargementJ0,
  "formation-crons.factures-retard": handleFacturesRetard,
  "formation-crons.plans-recurrents": handlePlansRecurrents,
  "formation-crons.devis-expiration": handleDevisExpiration,
  "formation-crons.offres-fraicheur": handleOffresFraicheur,
  "formation-crons.rappels-entretien": handleRappelsEntretien,
  "formation-crons.candidatures-en-sommeil": handleCandidaturesEnSommeil,
  "formation-crons.email-sante": handleEmailSante,
  "formation-crons.missions-formateur": handleMissionsFormateur,
  "formation-crons.formateur-convocation-j7": handleFormateurConvocationJ7,
  "formation-crons.formateur-rappel-j1": handleFormateurRappelJ1,
  "formation-crons.rappel-j1": handleRappelJ1,
};

/**
 * Surveillance horaire de la chaîne d'envoi (audit 2026-08-16).
 *
 * Le corps vit dans `server/email/health.ts` — ici on ne fait que déclencher et
 * tracer. Fail-soft par construction : `verifierSanteEmails` ne lève pas, mais
 * le `catch` reste, parce qu'une surveillance qui casse son propre cron ferait
 * taire au passage tout ce que ce cron surveille par ailleurs.
 */
async function handleEmailSante(): Promise<void> {
  try {
    const sante = await verifierSanteEmails();

    // Le battement du webhook de rebonds accompagne CHAQUE ligne, saine ou non.
    // C'est le seul moyen de répondre à « ZeptoMail nous appelle-t-il ? » sans
    // ouvrir leur console : `JAMAIS` après un appel de test depuis leur
    // interface signifie que l'abonnement n'atteint pas la route.
    // Cf. `server/email/webhook-battement.ts`.
    const battement = `dernier appel webhook : ${sante.dernierAppelWebhook ?? "JAMAIS"}`;

    if (sante.alertesLevees.length === 0) {
      console.log(
        `[formation-crons] email-sante: RAS (${sante.echecsRecents} échec(s) récent(s), ` +
          `${sante.bloquesEnFile} en attente) — ${battement}`,
      );
      return;
    }
    console.error(
      `[formation-crons] email-sante: ${sante.alertesLevees.join(", ")} — ` +
        `${sante.echecsRecents} échec(s), ${sante.bloquesEnFile} bloqué(s) — ${battement}`,
    );
  } catch (e) {
    console.error(
      "[formation-crons] email-sante: surveillance en échec :",
      e instanceof Error ? e.message : String(e),
    );
  }
}

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
